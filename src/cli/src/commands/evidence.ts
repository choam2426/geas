/**
 * Evidence command group — role-based evidence file creation and reading.
 *
 * v4: Paths moved to tasks/{tid}/evidence/{agent}.json (was evidence/{tid}/{agent}.json).
 *     Schema validation via evidence.schema.json with role-based required fields.
 *     `evidence record` replaced by `evidence add`.
 * v5: Added `evidence submit TASK ROLE SUMMARY` positional builder command.
 *     `evidence add` preserved as legacy flag-based interface.
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

/** Shared handler options for both submit and add commands */
interface EvidenceWriteOpts {
  mission?: string;
  task?: string;
  phase?: string;
  agent?: string;
  role?: string;
  set: string[];
  dryRun?: boolean;
  positionalSummary?: string;
}

/**
 * Shared evidence write handler used by both `evidence submit` and `evidence add`.
 */
function evidenceWriteHandler(parentCmd: Command, opts: EvidenceWriteOpts): void {
  try {
    const cwd = getCwd(parentCmd);
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

    if (!opts.role) {
      fileError('', 'evidence add', 'Role is required.');
      return;
    }

    if (!opts.agent) {
      fileError('', 'evidence add', 'Agent name is required.');
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
    let evidenceData: Record<string, unknown> | undefined;

    try {
      evidenceData = readInputData() as Record<string, unknown>;
    } catch (readErr: unknown) {
      const rnErr = readErr as NodeJS.ErrnoException;
      if (rnErr.code === 'NO_STDIN') {
        // Empty stdin is OK if --set or positional args provide data; fall through.
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
        deepMergeSetOverrides(evidenceData, overrides);
      } else {
        evidenceData = overrides;
      }
    }

    // Apply positional summary if provided (from `evidence submit`)
    if (opts.positionalSummary) {
      if (!evidenceData) evidenceData = {};
      if (evidenceData.summary === undefined) {
        evidenceData.summary = opts.positionalSummary;
      }
    }

    if (!evidenceData) {
      noStdinError(
        'evidence add',
        'No data provided. Pipe JSON to stdin, use --set <key=value>, or use positional args.',
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
}

export function registerEvidenceCommands(program: Command): void {
  const cmd = program
    .command('evidence')
    .description('Role-based evidence file management');

  // --- evidence submit TASK ROLE SUMMARY (positional builder) ---
  cmd
    .command('submit <task> <role> [summary]')
    .description('Create evidence file with positional args: geas evidence submit TASK ROLE SUMMARY')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .option('--agent <name>', 'Agent name (defaults to role value)')
    .option('--phase <phase>', 'Phase name for mission-level evidence (polishing, evolving)')
    .option('--set <key=value...>', 'Set individual fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((task: string | undefined, role: string | undefined, summary: string | undefined, opts: {
      mission?: string;
      agent?: string;
      phase?: string;
      set: string[];
      dryRun?: boolean;
    }) => {
      evidenceWriteHandler(cmd, {
        mission: opts.mission,
        task: task,
        phase: opts.phase,
        agent: opts.agent || role,
        role: role,
        set: opts.set,
        dryRun: opts.dryRun,
        positionalSummary: summary,
      });
    });

  // --- evidence add (legacy flag-based interface) ---
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
      evidenceWriteHandler(cmd, {
        mission: opts.mission,
        task: opts.task,
        phase: opts.phase,
        agent: opts.agent,
        role: opts.role,
        set: opts.set,
        dryRun: opts.dryRun,
      });
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
