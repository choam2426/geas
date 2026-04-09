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
import { success, validationError, fileError } from '../lib/output';
import { resolveGeasDir, normalizePath, validateIdentifier } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { getCwd } from '../lib/cwd';
import { readInputData, parseSetFlags } from '../lib/input';

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
    .description('Create or overwrite a role-based evidence file')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <tid>', 'Task identifier')
    .requiredOption('--agent <name>', 'Agent name (used as filename)')
    .requiredOption('--role <role>', 'Agent role (implementer, reviewer, tester, authority)')
    .option('--data <json>', 'Evidence data as JSON string')
    .option('--file <path>', 'Read evidence data from JSON file')
    .option('--set <key=value...>', 'Set individual fields', collectSet, [])
    .action((opts: {
      mission?: string;
      task: string;
      agent: string;
      role: string;
      data?: string;
      file?: string;
      set: string[];
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.task, 'task ID');

        // Reject invalid agent names instead of sanitizing (S3)
        if (!SAFE_AGENT_RE.test(opts.agent)) {
          fileError(opts.agent, 'validate', `Invalid agent name: "${opts.agent}". Only alphanumeric, underscore, and hyphen are allowed.`);
          return;
        }
        const agentName = opts.agent;

        // Build evidence data
        let evidenceData: Record<string, unknown>;

        if (opts.data || opts.file) {
          evidenceData = readInputData(opts.data, opts.file) as Record<string, unknown>;
          if (opts.set.length > 0) {
            const overrides = parseSetFlags(opts.set);
            Object.assign(evidenceData, overrides);
          }
        } else if (opts.set.length > 0) {
          evidenceData = parseSetFlags(opts.set);
        } else {
          fileError('', 'evidence add', 'No data provided. Use --data, --file, or --set.');
          return;
        }

        // Force-overwrite metadata from CLI flags (I1: prevent spoofing)
        evidenceData.version = '1.0';
        evidenceData.agent = agentName;
        evidenceData.task_id = opts.task;
        evidenceData.role = opts.role;

        // Validate against evidence schema (includes role-based allOf checks)
        const result = validate('evidence', evidenceData);
        if (!result.valid) {
          validationError('evidence', result.errors || []);
          return;
        }

        // v4: evidence lives inside tasks/{tid}/evidence/
        const missionDir = path.resolve(geasDir, 'missions', missionId);
        const evidenceDir = path.resolve(missionDir, 'tasks', opts.task, 'evidence');

        // Verify task exists (I1: prevent orphan evidence)
        const contractPath = path.resolve(missionDir, 'tasks', opts.task, 'contract.json');
        if (!fs.existsSync(contractPath)) {
          fileError(`tasks/${opts.task}/contract.json`, 'validate', 'Task does not exist. Cannot create evidence for non-existent task.');
          return;
        }

        ensureDir(evidenceDir);

        const filePath = path.resolve(evidenceDir, `${agentName}.json`);
        writeJsonFile(filePath, evidenceData, { cwd });

        success({
          written: normalizePath(filePath),
          mission_id: missionId,
          task_id: opts.task,
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
