/**
 * Evidence command group — record evidence JSON to per-task directories,
 * read evidence for a task/agent.
 *
 * Paths: .geas/missions/{mid}/evidence/{tid}/{agent}.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { success, fileError } from '../lib/output';
import { resolveGeasDir, resolveMissionDir, normalizePath } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';

export function registerEvidenceCommands(program: Command): void {
  const cmd = program
    .command('evidence')
    .description('Evidence directory management and file write');

  // --- evidence record ---
  cmd
    .command('record')
    .description('Write evidence JSON to the evidence directory')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--task <tid>', 'Task identifier')
    .requiredOption('--agent <name>', 'Agent name (used as filename)')
    .requiredOption('--data <json>', 'Evidence data as JSON string')
    .action((opts: { mission: string; task: string; agent: string; data: string }) => {
      try {
        // Parse and validate data
        let evidenceData: Record<string, unknown>;
        try {
          evidenceData = JSON.parse(opts.data) as Record<string, unknown>;
        } catch {
          fileError(opts.data, 'parse', 'Invalid JSON in --data');
          return;
        }

        if (typeof evidenceData !== 'object' || evidenceData === null || Array.isArray(evidenceData)) {
          fileError(opts.data, 'parse', '--data must be a JSON object');
          return;
        }

        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Sanitize agent name: only allow alphanumeric, dash, underscore
        const agentName = opts.agent.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!agentName) {
          fileError(opts.agent, 'validate', 'Agent name is empty after sanitization');
          return;
        }

        const evidenceDir = path.resolve(missionDir, 'evidence', opts.task);
        ensureDir(evidenceDir);

        const filePath = path.resolve(evidenceDir, `${agentName}.json`);

        writeJsonFile(filePath, evidenceData);

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          task_id: opts.task,
          agent: agentName,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'evidence record', nodeErr.message || String(err));
      }
    });

  // --- evidence read ---
  cmd
    .command('read')
    .description('Read evidence for a task (single agent or all)')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--task <tid>', 'Task identifier')
    .option('--agent <name>', 'Agent name (omit to list all)')
    .action((opts: { mission: string; task: string; agent?: string }) => {
      try {
        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const evidenceDir = path.resolve(missionDir, 'evidence', opts.task);

        if (opts.agent) {
          // Read a single agent's evidence
          const agentName = opts.agent.replace(/[^a-zA-Z0-9_-]/g, '');
          if (!agentName) {
            fileError(opts.agent, 'validate', 'Agent name is empty after sanitization');
            return;
          }

          const filePath = path.resolve(evidenceDir, `${agentName}.json`);
          const data = readJsonFile(filePath);
          if (data === null) {
            fileError(normalizePath(filePath), 'read', 'Evidence file not found');
            return;
          }

          success({
            mission_id: opts.mission,
            task_id: opts.task,
            agent: agentName,
            evidence: data,
          });
        } else {
          // List all evidence files for the task
          if (!fs.existsSync(evidenceDir)) {
            success({
              mission_id: opts.mission,
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
            mission_id: opts.mission,
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
