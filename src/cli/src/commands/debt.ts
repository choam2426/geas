/**
 * `geas debt` — project-level debts ledger commands.
 *
 *   geas debt register                                    (stdin: debt entry)
 *   geas debt update-status --debt <id>                   (stdin: status patch)
 *   geas debt list [--mission <id>] [--status <status>]   (read-only query)
 *
 * Writes to the **project-level** ledger at `.geas/debts.json`. A single
 * ledger file tracks debts across all missions in the project; each
 * `debtItem` records its origin mission/task in `introduced_by` and its
 * resolution mission/task in `resolved_by`.
 *
 * Per CLI.md §9, the debts file is **not** a pure append-only log:
 *   - `debt register` appends a new entry (assigns `debt_id` monotonically
 *     as `debt-{NNN}`).
 *   - `debt update-status` mutates an existing entry's `status`,
 *     `resolved_by`, and `resolution_rationale` (only those three fields).
 *
 * All other mutations on existing entries are rejected. Protocol 07 keeps
 * debts "mutable in a bounded way": the ledger reflects current project
 * state rather than a history of state transitions. Event history for any
 * particular `debt_id` is recoverable from `events.jsonl`.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import { atomicWriteJson, ensureDir, readJsonFile } from '../lib/fs-atomic';
import {
  debtsPath,
  findProjectRoot,
  isValidMissionId,
  isValidTaskId,
  tmpDir,
} from '../lib/paths';
import { readPayloadJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(
      err(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
      ),
    );
  }
  return root as string;
}

/** Shape of the on-disk debts ledger. */
interface DebtsFile {
  entries: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/** Allowed enum values — duplicated here to catch obvious typos before schema. */
const SEVERITY_ENUM = new Set(['low', 'normal', 'high', 'critical']);
const KIND_ENUM = new Set([
  'output_quality',
  'verification_gap',
  'structural',
  'risk',
  'process',
  'documentation',
  'operations',
]);
const STATUS_ENUM = new Set(['open', 'resolved', 'dropped']);

const DEBT_ID_RE = /^debt-[0-9]{3}$/;

/**
 * Read the debts ledger, returning a valid-shape struct even if the file
 * is missing (setup normally initializes it). Missing file is treated as
 * empty ledger with `created_at=updated_at=now` — callers overwrite these.
 */
function loadLedger(root: string): DebtsFile {
  const p = debtsPath(root);
  const current = readJsonFile<DebtsFile>(p);
  if (current && Array.isArray(current.entries)) {
    return current;
  }
  const ts = nowUtc();
  return { entries: [], created_at: ts, updated_at: ts };
}

/** Compute the next `debt-NNN` id from the current entries array. */
function nextDebtId(entries: Array<Record<string, unknown>>): string {
  let max = 0;
  for (const e of entries) {
    const id = typeof e.debt_id === 'string' ? e.debt_id : '';
    const m = DEBT_ID_RE.exec(id);
    if (!m) continue;
    const n = parseInt(id.slice('debt-'.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  return `debt-${next.toString().padStart(3, '0')}`;
}

function registerRegister(debt: Command): void {
  debt
    .command('register')
    .description(
      'Append a new entry to `.geas/debts.json` (project-level). Payload via --file or stdin: debt body (debt_id auto-assigned, status forced to open).',
    )
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { file?: string }) => {
      const root = needProjectRoot();

      let payload: Record<string, unknown>;
      try {
        payload = readPayloadJson(opts.file) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(
          err(
            'invalid_argument',
            'debt register expects a JSON object payload (one entry body)',
          ),
        );
      }

      // Validate `introduced_by` upfront for a clearer error than schema alone.
      const introduced = payload.introduced_by as
        | { mission_id?: unknown; task_id?: unknown }
        | undefined;
      if (
        !introduced ||
        typeof introduced !== 'object' ||
        typeof introduced.mission_id !== 'string' ||
        typeof introduced.task_id !== 'string'
      ) {
        emit(
          err(
            'invalid_argument',
            'introduced_by is required with mission_id and task_id (project-level ledger traces each debt back to its origin mission/task)',
          ),
        );
      }
      if (!isValidMissionId(introduced.mission_id as string)) {
        emit(
          err(
            'invalid_argument',
            `invalid introduced_by.mission_id '${introduced.mission_id as string}'`,
          ),
        );
      }
      if (!isValidTaskId(introduced.task_id as string)) {
        emit(
          err(
            'invalid_argument',
            `invalid introduced_by.task_id '${introduced.task_id as string}'`,
          ),
        );
      }

      // Quick enum sanity checks.
      if (
        typeof payload.severity !== 'string' ||
        !SEVERITY_ENUM.has(payload.severity)
      ) {
        emit(
          err(
            'invalid_argument',
            `severity must be one of ${[...SEVERITY_ENUM].join(', ')}`,
          ),
        );
      }
      if (typeof payload.kind !== 'string' || !KIND_ENUM.has(payload.kind)) {
        emit(
          err(
            'invalid_argument',
            `kind must be one of ${[...KIND_ENUM].join(', ')}`,
          ),
        );
      }

      const ledger = loadLedger(root);
      const debtId = nextDebtId(ledger.entries);

      // Build the new entry. CLI-owned fields are written authoritatively.
      // status is forced to open on register; `debt update-status` handles
      // transitions. resolved_by / resolution_rationale are null on register.
      const entry: Record<string, unknown> = {
        debt_id: debtId,
        severity: payload.severity,
        kind: payload.kind,
        title: payload.title,
        description: payload.description,
        status: 'open',
        introduced_by: {
          mission_id: (introduced.mission_id as string),
          task_id: (introduced.task_id as string),
        },
        resolved_by: null,
        resolution_rationale: null,
      };

      const ts = nowUtc();
      const next: DebtsFile = {
        entries: [...ledger.entries, entry],
        created_at: ledger.created_at || ts,
        updated_at: ts,
      };

      const v = validate('debts', next);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'debts schema validation failed',
            v.errors,
          ),
        );
      }

      const target = debtsPath(root);
      ensureDir(path.dirname(target));
      atomicWriteJson(target, next, tmpDir(root));

      recordEvent(root, {
        kind: 'debt_registered',
        actor: 'cli:auto',
        payload: {
          artifact: slashPath(path.relative(root, target)),
          debt_id: debtId,
          mission_id: (introduced.mission_id as string),
          task_id: (introduced.task_id as string),
          severity: payload.severity,
          kind: payload.kind,
        },
      });

      emit(
        ok({
          path: slashPath(target),
          ids: { debt_id: debtId },
          entry,
        }),
      );
    });
}

function registerUpdateStatus(debt: Command): void {
  debt
    .command('update-status')
    .description(
      'Update status + resolved_by + resolution_rationale on an existing debt entry. Payload via --file or stdin: { status, resolved_by, resolution_rationale }.',
    )
    .requiredOption('--debt <id>', 'Debt ID (debt-NNN)')
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { debt: string; file?: string }) => {
      if (!DEBT_ID_RE.test(opts.debt)) {
        emit(
          err(
            'invalid_argument',
            `invalid debt id '${opts.debt}' (expected ^debt-[0-9]{3}$)`,
          ),
        );
      }

      const root = needProjectRoot();

      let payload: Record<string, unknown>;
      try {
        payload = readPayloadJson(opts.file) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(
          err(
            'invalid_argument',
            'debt update-status expects a JSON object payload',
          ),
        );
      }

      // Only three fields are legal in the patch. Anything else is a hard
      // error — CLI.md §9 forbids debts mutations outside this narrow set.
      const allowedKeys = new Set(['status', 'resolved_by', 'resolution_rationale']);
      for (const k of Object.keys(payload)) {
        if (!allowedKeys.has(k)) {
          emit(
            err(
              'append_only_violation',
              `debt update-status only accepts status, resolved_by, resolution_rationale — got '${k}'`,
              { field: k },
            ),
          );
        }
      }

      if (
        typeof payload.status !== 'string' ||
        !STATUS_ENUM.has(payload.status)
      ) {
        emit(
          err(
            'invalid_argument',
            `status must be one of ${[...STATUS_ENUM].join(', ')}`,
          ),
        );
      }

      // Terminal statuses require resolved_by + rationale. Going back to
      // open must clear them.
      if (payload.status === 'open') {
        if (payload.resolved_by !== undefined && payload.resolved_by !== null) {
          emit(
            err(
              'invalid_argument',
              'resolved_by must be null when status is open',
            ),
          );
        }
        if (
          payload.resolution_rationale !== undefined &&
          payload.resolution_rationale !== null
        ) {
          emit(
            err(
              'invalid_argument',
              'resolution_rationale must be null when status is open',
            ),
          );
        }
      } else {
        // resolved or dropped
        const rb = payload.resolved_by as
          | { mission_id?: unknown; task_id?: unknown }
          | null
          | undefined;
        if (
          !rb ||
          typeof rb !== 'object' ||
          typeof rb.mission_id !== 'string' ||
          typeof rb.task_id !== 'string'
        ) {
          emit(
            err(
              'invalid_argument',
              'resolved_by must include mission_id and task_id when status is resolved or dropped',
            ),
          );
        }
        if (!isValidMissionId(rb.mission_id as string)) {
          emit(
            err(
              'invalid_argument',
              `invalid resolved_by.mission_id '${rb.mission_id as string}'`,
            ),
          );
        }
        if (!isValidTaskId(rb.task_id as string)) {
          emit(
            err(
              'invalid_argument',
              `invalid resolved_by.task_id '${rb.task_id as string}'`,
            ),
          );
        }
        if (
          typeof payload.resolution_rationale !== 'string' ||
          payload.resolution_rationale.length === 0
        ) {
          emit(
            err(
              'invalid_argument',
              'resolution_rationale is required (non-empty string) when status is resolved or dropped',
            ),
          );
        }
      }

      const ledger = loadLedger(root);
      const idx = ledger.entries.findIndex(
        (e) => (e as { debt_id?: unknown }).debt_id === opts.debt,
      );
      if (idx < 0) {
        emit(
          err(
            'missing_artifact',
            `debt '${opts.debt}' not found in ledger`,
            { debt_id: opts.debt },
          ),
        );
      }

      const before = ledger.entries[idx];
      const updated = {
        ...before,
        status: payload.status,
        resolved_by:
          payload.status === 'open'
            ? null
            : {
                mission_id: (payload.resolved_by as { mission_id: string }).mission_id,
                task_id: (payload.resolved_by as { task_id: string }).task_id,
              },
        resolution_rationale:
          payload.status === 'open'
            ? null
            : (payload.resolution_rationale as string),
      };

      const ts = nowUtc();
      const nextEntries = ledger.entries.slice();
      nextEntries[idx] = updated;
      const next: DebtsFile = {
        entries: nextEntries,
        created_at: ledger.created_at,
        updated_at: ts,
      };

      const v = validate('debts', next);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'debts schema validation failed',
            v.errors,
          ),
        );
      }

      const target = debtsPath(root);
      ensureDir(path.dirname(target));
      atomicWriteJson(target, next, tmpDir(root));

      recordEvent(root, {
        kind: 'debt_status_updated',
        actor: 'cli:auto',
        payload: {
          artifact: slashPath(path.relative(root, target)),
          debt_id: opts.debt,
          from_status: (before as { status?: string }).status,
          to_status: payload.status,
        },
      });

      emit(
        ok({
          path: slashPath(target),
          ids: { debt_id: opts.debt },
          entry: updated,
        }),
      );
    });
}

function registerList(debt: Command): void {
  debt
    .command('list')
    .description(
      'Read-only query over `.geas/debts.json`. Filters on --status and/or --mission (matches introduced_by.mission_id OR resolved_by.mission_id).',
    )
    .option('--status <status>', 'Filter by status (open|resolved|dropped)')
    .option('--mission <id>', 'Filter by mission (matches origin or resolution)')
    .action((opts: { status?: string; mission?: string }) => {
      if (opts.status !== undefined && !STATUS_ENUM.has(opts.status)) {
        emit(
          err(
            'invalid_argument',
            `--status must be one of ${[...STATUS_ENUM].join(', ')}`,
          ),
        );
      }
      if (opts.mission !== undefined && !isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }

      const root = needProjectRoot();
      const ledger = loadLedger(root);

      let entries = ledger.entries.slice();
      if (opts.status) {
        entries = entries.filter(
          (e) => (e as { status?: string }).status === opts.status,
        );
      }
      if (opts.mission) {
        const m = opts.mission;
        entries = entries.filter((e) => {
          const ib = (e as { introduced_by?: { mission_id?: unknown } })
            .introduced_by;
          const rb = (e as { resolved_by?: { mission_id?: unknown } | null })
            .resolved_by;
          if (ib && ib.mission_id === m) return true;
          if (rb && rb.mission_id === m) return true;
          return false;
        });
      }

      const counts: Record<string, number> = { open: 0, resolved: 0, dropped: 0 };
      for (const e of entries) {
        const s = (e as { status?: string }).status ?? '';
        if (counts[s] !== undefined) counts[s]++;
      }

      emit(
        ok({
          path: slashPath(debtsPath(root)),
          total: entries.length,
          counts,
          entries,
        }),
      );
    });
}

export function registerDebtCommands(program: Command): void {
  const debt = program
    .command('debt')
    .description(
      'Project-level debts ledger (.geas/debts.json) — register, update-status, list.',
    );
  registerRegister(debt);
  registerUpdateStatus(debt);
  registerList(debt);
}
