/**
 * `geas deliberation` — append-only deliberations at mission or task level.
 *
 *   geas deliberation append --mission <id> --level mission             (stdin: entry)
 *   geas deliberation append --mission <id> --level task --task <id>    (stdin: entry)
 *
 * Writes:
 *   - mission-level → `.geas/missions/{mission_id}/deliberations.json`
 *   - task-level    → `.geas/missions/{mission_id}/tasks/{task_id}/deliberations.json`
 *
 * Mode gate: deliberation append is only permitted when the mission spec's
 * `mode == "full_depth"`. Attempts from lightweight / standard missions
 * return `guard_failed`.
 *
 * Validation: entries are validated against the deliberation schema and
 * protocol 03 §168 aggregation rule (`result` must be consistent with
 * voter composition). CLI does NOT auto-inject entry_id — deliberation
 * entries are identified by position in the entries array.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
import {
  atomicWriteJson,
  ensureDir,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  findProjectRoot,
  isValidMissionId,
  isValidTaskId,
  missionDeliberationsPath,
  missionSpecPath,
  taskDeliberationsPath,
  tmpDir,
} from '../lib/paths';
import { readPayloadJson, readPayloadText, StdinError } from '../lib/input';
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
    emitErr(
      makeError(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}.`,
        {
          hint: "run 'geas setup' to bootstrap the .geas/ tree",
          exit_category: 'missing_artifact',
        },
      ),
    );
  }
  return root as string;
}

/** AC3: scalar formatter for deliberation append. */
function formatDeliberationAppend(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string | null }; level?: string; result?: string; entries_count?: number };
  const taskPart = d.ids?.task_id ? ` task=${d.ids.task_id}` : '';
  return `deliberation appended: ${d.ids?.mission_id ?? '<unknown>'}${taskPart} level=${d.level ?? '?'} result=${d.result ?? '?'} entries=${d.entries_count ?? 0}`;
}

/** T2.8 path (b): structural guard hint folded to single string. */
function foldGuardHint(hints: unknown): string | undefined {
  if (hints === undefined || hints === null) return undefined;
  if (typeof hints === 'string') return hints;
  if (typeof hints !== 'object') return String(hints);
  const obj = hints as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = k.replace(/_/g, ' ');
    if (Array.isArray(v)) {
      parts.push(`${key}: ${v.join(', ')}`);
    } else if (v !== null && typeof v === 'object') {
      parts.push(`${key}: ${JSON.stringify(v)}`);
    } else {
      parts.push(`${key}: ${String(v)}`);
    }
  }
  return parts.length > 0 ? parts.join('; ') : undefined;
}

interface DeliberationsFile {
  mission_id: string;
  level: 'mission' | 'task';
  task_id?: string;
  entries: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/**
 * Enforce protocol 03 §168: `result` must be consistent with voter
 * composition.
 *   - any vote = escalate           → result = escalate
 *   - else majority agree           → result = agree
 *   - else majority disagree        → result = disagree
 *   - else (tie or < 2 voters)      → result = inconclusive
 * This is applied as a guard *in addition* to schema validation so that
 * orchestrators who assemble the entry themselves can't smuggle a
 * result that contradicts the votes.
 */
function aggregateExpected(
  votes: Array<{ vote: string }>,
): 'agree' | 'disagree' | 'escalate' | 'inconclusive' {
  if (!Array.isArray(votes) || votes.length < 2) return 'inconclusive';
  let agree = 0,
    disagree = 0,
    escalate = 0;
  for (const v of votes) {
    if (v && v.vote === 'escalate') escalate++;
    else if (v && v.vote === 'agree') agree++;
    else if (v && v.vote === 'disagree') disagree++;
  }
  if (escalate > 0) return 'escalate';
  if (agree > disagree) return 'agree';
  if (disagree > agree) return 'disagree';
  return 'inconclusive';
}

interface DeliberationAppendInlineOpts {
  mission: string;
  level: string;
  task?: string;
  file?: string;
  entryFromFile?: string;
  proposalSummary?: string;
  proposalSummaryFromFile?: string;
  vote?: string[];
  result?: string;
}

/**
 * AC1 (task-006 verify-fix iteration 1): build a deliberation entry
 * payload from inline flags. --vote uses the shorthand
 * voter:vote:rationale (split on first two colons; rationale may
 * contain colons). Returns null if no inline flag is present.
 */
function buildDeliberationPayloadFromFlags(
  opts: DeliberationAppendInlineOpts,
): Record<string, unknown> | null {
  const inlineFlagPresent =
    opts.proposalSummary !== undefined ||
    opts.proposalSummaryFromFile !== undefined ||
    (Array.isArray(opts.vote) && opts.vote.length > 0) ||
    opts.result !== undefined;
  if (!inlineFlagPresent) return null;

  const payload: Record<string, unknown> = {};
  if (opts.proposalSummaryFromFile !== undefined) {
    try {
      payload.proposal_summary = readPayloadText(opts.proposalSummaryFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --proposal-summary <text> inline or --proposal-summary-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.proposalSummary !== undefined) {
    payload.proposal_summary = opts.proposalSummary;
  }
  if (Array.isArray(opts.vote) && opts.vote.length > 0) {
    payload.votes = opts.vote.map((raw) => parseVoteShorthand(raw));
  }
  if (opts.result !== undefined) payload.result = opts.result;
  return payload;
}

/**
 * Parse a `--vote voter:vote:rationale` shorthand into the vote object
 * shape required by the deliberation schema. The rationale may itself
 * contain colons, so we split only on the first two.
 */
function parseVoteShorthand(raw: string): Record<string, unknown> {
  const firstColon = raw.indexOf(':');
  if (firstColon < 0) {
    emitErr(
      makeError(
        'invalid_argument',
        `--vote must be voter:vote:rationale (got '${raw}')`,
        {
          hint: "format: --vote 'challenger:agree:short rationale text'",
          exit_category: 'validation',
        },
      ),
    );
  }
  const voter = raw.slice(0, firstColon);
  const rest = raw.slice(firstColon + 1);
  const secondColon = rest.indexOf(':');
  if (secondColon < 0) {
    emitErr(
      makeError(
        'invalid_argument',
        `--vote must be voter:vote:rationale (got '${raw}')`,
        {
          hint: "format: --vote 'challenger:agree:short rationale text'",
          exit_category: 'validation',
        },
      ),
    );
  }
  const vote = rest.slice(0, secondColon);
  const rationale = rest.slice(secondColon + 1);
  return { voter, vote, rationale };
}

function registerDeliberationAppend(cmd: Command): void {
  cmd
    .command('append')
    .description(
      'Append a deliberation entry. Accepts inline flags (--proposal-summary, --vote voter:vote:rationale..., --result) or full JSON via --file/stdin/--entry-from-file. Free-body --proposal-summary also accepts --proposal-summary-from-file. Requires mission mode = full_depth.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--level <level>', '"mission" or "task"')
    .option('--task <id>', 'Task ID (required when --level task)')
    .option('--file <path>', 'Read full JSON entry from file (overrides inline flags) instead of stdin')
    .option('--entry-from-file <path>', 'Named alias for --file (free-body entry payload)')
    .option('--proposal-summary <text>', 'Short summary of the question (free-body — short prose)')
    .option('--proposal-summary-from-file <path>', 'Read proposal_summary text from file')
    .option('--vote <voter:vote:rationale...>', 'Vote shorthand (repeatable; e.g. challenger:agree:rationale text)')
    .option('--result <result>', 'Result: agree, disagree, escalate, or inconclusive')
    .action(
      (opts: DeliberationAppendInlineOpts) => {
        if (!isValidMissionId(opts.mission)) {
          emitErr(
            makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
              hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
              exit_category: 'validation',
            }),
          );
        }
        if (opts.level !== 'mission' && opts.level !== 'task') {
          emitErr(
            makeError('invalid_argument', `--level must be 'mission' or 'task'`, {
              hint: "valid --level values: 'mission' or 'task'",
              exit_category: 'validation',
            }),
          );
        }
        if (opts.level === 'task') {
          if (!opts.task || !isValidTaskId(opts.task)) {
            emitErr(
              makeError(
                'invalid_argument',
                '--task <id> is required when --level is task',
                {
                  hint: "pass --task task-NNN when --level is task",
                  exit_category: 'validation',
                },
              ),
            );
          }
        } else if (opts.task) {
          emitErr(
            makeError(
              'invalid_argument',
              '--task must not be set when --level is mission',
              {
                hint: 'omit --task or change --level to task',
                exit_category: 'validation',
              },
            ),
          );
        }

        const root = needProjectRoot();
        const spec = readJsonFile<Record<string, unknown>>(
          missionSpecPath(root, opts.mission),
        );
        if (!spec) {
          emitErr(
            makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
              hint: "run 'geas mission create' to bootstrap the mission first",
              exit_category: 'missing_artifact',
            }),
          );
        }

        // Mode gate — deliberation is permitted only in full_depth missions.
        const mode = typeof spec!.mode === 'string' ? (spec!.mode as string) : '';
        if (mode !== 'full_depth') {
          emitErr(
            makeError(
              'guard_failed',
              `deliberation is only permitted when mission mode is 'full_depth' (mission '${opts.mission}' mode is '${mode || 'unset'}')`,
              {
                hint: foldGuardHint({ mission_mode: mode || null, required_mode: 'full_depth' }) ?? "set mission mode to 'full_depth' or skip the deliberation",
                exit_category: 'guard',
              },
            ),
          );
        }

        let payload: Record<string, unknown>;
        const payloadSrcFile = opts.file ?? opts.entryFromFile;
        if (payloadSrcFile !== undefined) {
          try {
            payload = readPayloadJson(payloadSrcFile) as Record<string, unknown>;
          } catch (e) {
            if (e instanceof StdinError) {
              emitErr(
                makeError('invalid_argument', e.message, {
                  hint: 'pass JSON via --file/--entry-from-file <path> or use inline flags (--proposal-summary, --vote..., --result)',
                  exit_category: 'validation',
                }),
              );
            }
            throw e;
          }
        } else {
          const inline = buildDeliberationPayloadFromFlags(opts);
          if (inline !== null) {
            payload = inline;
          } else {
            try {
              payload = readPayloadJson(undefined) as Record<string, unknown>;
            } catch (e) {
              if (e instanceof StdinError) {
                emitErr(
                  makeError('invalid_argument', e.message, {
                    hint: 'use inline flags (--proposal-summary, --vote..., --result) or pass JSON via --file/--entry-from-file <path> or stdin',
                    exit_category: 'validation',
                  }),
                );
              }
              throw e;
            }
          }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          emitErr(
            makeError(
              'invalid_argument',
              'deliberation append expects a JSON object payload',
              {
                hint: 'wrap the entry fields in a single JSON object, or use inline flags',
                exit_category: 'validation',
              },
            ),
          );
        }

        // Strip any client-provided created_at; CLI authoritative.
        delete payload.created_at;
        payload.created_at = nowUtc();

        const votes = Array.isArray(payload.votes)
          ? (payload.votes as Array<{ vote: string }>)
          : [];
        const expectedResult = aggregateExpected(votes);
        const providedResult = typeof payload.result === 'string' ? payload.result : '';
        if (providedResult !== expectedResult) {
          emitErr(
            makeError(
              'guard_failed',
              `deliberation result '${providedResult || '(unset)'}' is inconsistent with votes; expected '${expectedResult}' per protocol 03 aggregation rule`,
              {
                hint: foldGuardHint({ expected_result: expectedResult, provided_result: providedResult || null }) ?? `set result to '${expectedResult}' to match the votes`,
                exit_category: 'guard',
              },
            ),
          );
        }

        const filePath =
          opts.level === 'mission'
            ? missionDeliberationsPath(root, opts.mission)
            : taskDeliberationsPath(root, opts.mission, opts.task as string);

        const existing = readJsonFile<DeliberationsFile>(filePath);
        const ts = nowUtc();
        const merged: DeliberationsFile = {
          mission_id: opts.mission,
          level: opts.level as 'mission' | 'task',
          ...(opts.level === 'task' ? { task_id: opts.task as string } : {}),
          entries: existing && Array.isArray(existing.entries)
            ? [...existing.entries, payload]
            : [payload],
          created_at: existing?.created_at ?? ts,
          updated_at: ts,
        };

        const v = validate('deliberation', merged);
        if (!v.ok) {
          emitErr(
            makeError(
              'schema_validation_failed',
              'deliberation schema validation failed',
              {
                hint: 'inspect ajv errors and fix the entry body, then retry',
                exit_category: 'validation',
              },
            ),
          );
        }

        ensureDir(path.dirname(filePath));
        atomicWriteJson(filePath, merged, tmpDir(root));

        recordEvent(root, {
          kind: 'deliberation_appended',
          actor: 'cli:auto',
          payload: {
            mission_id: opts.mission,
            task_id: opts.task ?? null,
            level: opts.level,
            artifact: slashPath(path.relative(root, filePath)),
            result: expectedResult,
          },
        });

        emitOk('deliberation append', {
          path: slashPath(filePath),
          ids: {
            mission_id: opts.mission,
            task_id: opts.task ?? null,
          },
          level: opts.level,
          result: expectedResult,
          entries_count: merged.entries.length,
        });
      },
    );
}

export function registerDeliberationCommands(program: Command): void {
  registerFormatter('deliberation append', formatDeliberationAppend);
  const d = program
    .command('deliberation')
    .description(
      'Append-only deliberation log. Mission or task level. Requires full_depth mode.',
    );
  registerDeliberationAppend(d);
}
