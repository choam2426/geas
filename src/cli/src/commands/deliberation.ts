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

import { emit, err, ok, recordEvent } from '../lib/envelope';
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
import { readStdinJson, StdinError } from '../lib/input';
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

function registerDeliberationAppend(cmd: Command): void {
  cmd
    .command('append')
    .description(
      'Append a deliberation entry. Requires mission mode = full_depth.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--level <level>', '"mission" or "task"')
    .option('--task <id>', 'Task ID (required when --level task)')
    .action(
      (opts: { mission: string; level: string; task?: string }) => {
        if (!isValidMissionId(opts.mission)) {
          emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
        }
        if (opts.level !== 'mission' && opts.level !== 'task') {
          emit(err('invalid_argument', `--level must be 'mission' or 'task'`));
        }
        if (opts.level === 'task') {
          if (!opts.task || !isValidTaskId(opts.task)) {
            emit(
              err(
                'invalid_argument',
                '--task <id> is required when --level is task',
              ),
            );
          }
        } else if (opts.task) {
          emit(
            err(
              'invalid_argument',
              '--task must not be set when --level is mission',
            ),
          );
        }

        const root = needProjectRoot();
        const spec = readJsonFile<Record<string, unknown>>(
          missionSpecPath(root, opts.mission),
        );
        if (!spec) {
          emit(
            err(
              'missing_artifact',
              `mission spec not found for ${opts.mission}`,
            ),
          );
        }

        // Mode gate — deliberation is permitted only in full_depth missions.
        const mode = typeof spec!.mode === 'string' ? (spec!.mode as string) : '';
        if (mode !== 'full_depth') {
          emit(
            err(
              'guard_failed',
              `deliberation is only permitted when mission mode is 'full_depth' (mission '${opts.mission}' mode is '${mode || 'unset'}')`,
              { mission_mode: mode || null, required_mode: 'full_depth' },
            ),
          );
        }

        let payload: Record<string, unknown>;
        try {
          payload = readStdinJson() as Record<string, unknown>;
        } catch (e) {
          if (e instanceof StdinError) emit(err('invalid_argument', e.message));
          throw e;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          emit(
            err(
              'invalid_argument',
              'deliberation append expects a JSON object on stdin',
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
          emit(
            err(
              'guard_failed',
              `deliberation result '${providedResult || '(unset)'}' is inconsistent with votes; expected '${expectedResult}' per protocol 03 aggregation rule`,
              {
                expected_result: expectedResult,
                provided_result: providedResult || null,
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
          emit(
            err(
              'schema_validation_failed',
              'deliberation schema validation failed',
              v.errors,
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

        emit(
          ok({
            path: slashPath(filePath),
            ids: {
              mission_id: opts.mission,
              task_id: opts.task ?? null,
            },
            level: opts.level,
            result: expectedResult,
            entries_count: merged.entries.length,
          }),
        );
      },
    );
}

export function registerDeliberationCommands(program: Command): void {
  const d = program
    .command('deliberation')
    .description(
      'Append-only deliberation log. Mission or task level. Requires full_depth mode.',
    );
  registerDeliberationAppend(d);
}
