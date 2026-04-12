/**
 * Evidence command group — role-based evidence file creation and reading.
 *
 * v4: Paths moved to tasks/{tid}/evidence/{agent}.json (was evidence/{tid}/{agent}.json).
 *     Schema validation via evidence.schema.json with role-based required fields.
 *     `evidence record` replaced by `evidence add`.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { resolveGeasDir, normalizePath, validateIdentifier } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { getCwd } from '../lib/cwd';
import { readInputData, parseSetFlags, deepMergeSetOverrides } from '../lib/input';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

/**
 * Resolve mission ID from --mission flag or run.json.
 */
function resolveMissionId(geasDir: string, missionOpt?: string): string {
  if (missionOpt) return missionOpt;
  const runPath = path.resolve(geasDir, 'state', 'run.json');
  const run = readJsonFile<Record<string, unknown>>(runPath);
  if (run?.mission_id && typeof run.mission_id === 'string') {
    return run.mission_id;
  }
  const err = new Error('No --mission provided and no mission_id in run.json');
  (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
  throw err;
}

/** Reject invalid agent names instead of sanitizing (S3) */
const SAFE_AGENT_RE = /^[a-zA-Z0-9_-]+$/;

export function registerEvidenceCommands(program: Command): void {
  const cmd = program
    .command('evidence')
    .description('Role-based evidence file management');

  // --- evidence add ---
  cmd
    .command('add')
    .description('Create or overwrite a role-based evidence file (JSON via stdin and/or --set)')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .option('--task <tid>', 'Task identifier (use --phase for phase-level evidence)')
    .option('--phase <phase>', 'Phase name for mission-level evidence (polishing, evolving)')
    .requiredOption('--agent <name>', 'Agent name (used as filename)')
    .requiredOption('--role <role>', 'Agent role (implementer, reviewer, tester, authority)')
    .option('--set <key=value...>', 'Set individual fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: {
      mission?: string;
      task?: string;
      phase?: string;
      agent: string;
      role: string;
      set: string[];
      dryRun?: boolean;
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');

        if (!opts.task && !opts.phase) {
          fileError('', 'evidence add', 'Either --task or --phase is required.');
          return;
        }
        if (opts.task && opts.phase) {
          fileError('', 'evidence add', 'Use --task or --phase, not both.');
          return;
        }

        if (opts.task) validateIdentifier(opts.task, 'task ID');

        // Reject invalid agent names instead of sanitizing (S3)
        if (!SAFE_AGENT_RE.test(opts.agent)) {
          fileError(opts.agent, 'validate', `Invalid agent name: "${opts.agent}". Only alphanumeric, underscore, and hyphen are allowed.`);
          return;
        }
        const agentName = opts.agent;

        // Build evidence data: stdin JSON forms the base, --set overlays on top.
        // Shallow merge semantics (Object.assign) match parseSetFlags, which
        // produces only top-level / bracketed-array keys.
        let evidenceData: Record<string, unknown> | undefined;

        try {
          evidenceData = readInputData() as Record<string, unknown>;
        } catch (readErr: unknown) {
          const rnErr = readErr as NodeJS.ErrnoException;
          if (rnErr.code === 'NO_STDIN') {
            // Empty stdin is OK if --set provides data; fall through.
            evidenceData = undefined;
          } else if (rnErr.code === 'INVALID_JSON') {
            if (opts.dryRun) { dryRunParseError(rnErr.message); return; }
            fileError('', 'parse', rnErr.message);
            return;
          } else {
            throw readErr;
          }
        }

        if (opts.set.length > 0) {
          const overrides = parseSetFlags(opts.set);
          if (evidenceData) {
            // stdin-base + --set overlay: deep merge so nested dot-path fields
            // don't clobber sibling keys in the base object.
            deepMergeSetOverrides(evidenceData, overrides);
          } else {
            evidenceData = overrides;
          }
        }

        if (!evidenceData) {
          noStdinError(
            'evidence add',
            'No data provided. Pipe JSON to stdin, or use --set <key=value>.',
          );
          return;
        }

        // Force-overwrite metadata from CLI flags (I1: prevent spoofing)
        evidenceData.version = '1.0';
        evidenceData.agent = agentName;
        evidenceData.task_id = opts.task || opts.phase!;
        evidenceData.role = opts.role;

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, evidenceData, 'evidence');
          return;
        }

        // Validate against evidence schema (includes role-based allOf checks)
        const result = validate('evidence', evidenceData);
        if (!result.valid) {
          validationError('evidence', result.errors || []);
          return;
        }

        const missionDir = path.resolve(geasDir, 'missions', missionId);
        let evidenceDir: string;

        if (opts.phase) {
          // Phase-level evidence: polishing → polishing/evidence/, evolving → evolution/evidence/
          const phaseDir = opts.phase === 'evolving' ? 'evolution' : opts.phase;
          evidenceDir = path.resolve(missionDir, phaseDir, 'evidence');
        } else {
          // Task-level evidence: missions/{mid}/tasks/{tid}/evidence/
          evidenceDir = path.resolve(missionDir, 'tasks', opts.task!, 'evidence');

          // Verify task exists (I1: prevent orphan evidence)
          const contractPath = path.resolve(missionDir, 'tasks', opts.task!, 'contract.json');
          if (!fs.existsSync(contractPath)) {
            fileError(`tasks/${opts.task}/contract.json`, 'validate', 'Task does not exist. Cannot create evidence for non-existent task.');
            return;
          }
        }

        ensureDir(evidenceDir);

        const filePath = path.resolve(evidenceDir, `${agentName}.json`);
        writeJsonFile(filePath, evidenceData, { cwd });

        success({
          written: normalizePath(filePath),
          mission_id: missionId,
          ...(opts.task ? { task_id: opts.task } : { phase: opts.phase }),
          agent: agentName,
          role: opts.role,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'evidence add', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // --- evidence read ---
  cmd
    .command('read')
    .description('Read evidence for a task (single agent or all)')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <tid>', 'Task identifier')
    .option('--agent <name>', 'Agent name (omit to list all)')
    .action((opts: { mission?: string; task: string; agent?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.task, 'task ID');
        const missionDir = path.resolve(geasDir, 'missions', missionId);

        // v4: evidence inside tasks/{tid}/evidence/
        const evidenceDir = path.resolve(missionDir, 'tasks', opts.task, 'evidence');

        if (opts.agent) {
          if (!SAFE_AGENT_RE.test(opts.agent)) {
            fileError(opts.agent, 'validate', `Invalid agent name: "${opts.agent}". Only alphanumeric, underscore, and hyphen are allowed.`);
            return;
          }
          const agentName = opts.agent;

          const filePath = path.resolve(evidenceDir, `${agentName}.json`);
          const data = readJsonFile(filePath);
          if (data === null) {
            fileError(normalizePath(filePath), 'read', 'Evidence file not found');
            return;
          }

          success({
            mission_id: missionId,
            task_id: opts.task,
            agent: agentName,
            evidence: data,
          });
        } else {
          if (!fs.existsSync(evidenceDir)) {
            success({
              mission_id: missionId,
              task_id: opts.task,
              agents: [],
              evidence: {},
            });
            return;
          }

          const files = fs.readdirSync(evidenceDir).filter((f) => f.endsWith('.json'));
          const evidence: Record<string, unknown> = {};
          const agents: string[] = [];

          for (const file of files) {
            const agentKey = file.replace(/\.json$/, '');
            agents.push(agentKey);
            const data = readJsonFile(path.resolve(evidenceDir, file));
            if (data !== null) {
              evidence[agentKey] = data;
            }
          }

          success({
            mission_id: missionId,
            task_id: opts.task,
            agents,
            evidence,
          });
        }
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'evidence read', nodeErr.message || String(err));
      }
    });
}

/** Commander variadic option collector for --set. */
function collectSet(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
