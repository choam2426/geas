/**
 * Decision command group — write and read decision records.
 *
 * Paths: .geas/missions/{mid}/decisions/{decision_id}.json
 *
 * Decision records capture structured decisions and their rationale
 * as produced during vote rounds or authority decisions.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { success, fileError } from '../lib/output';
import { resolveGeasDir, resolveMissionDir, normalizePath } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { getCwd } from '../lib/cwd';

export function registerDecisionCommands(program: Command): void {
  const cmd = program
    .command('decision')
    .description('Decision record read/write');

  // --- decision write ---
  cmd
    .command('write')
    .description('Write a decision record')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--data <json>', 'Decision record data as JSON string')
    .action((opts: { mission: string; data: string }, cmd: Command) => {
      try {
        // Parse data
        let decisionData: Record<string, unknown>;
        try {
          decisionData = JSON.parse(opts.data) as Record<string, unknown>;
        } catch {
          fileError(opts.data, 'parse', 'Invalid JSON in --data');
          return;
        }

        if (typeof decisionData !== 'object' || decisionData === null || Array.isArray(decisionData)) {
          fileError(opts.data, 'parse', '--data must be a JSON object');
          return;
        }

        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Determine decision ID from data or generate one
        let decisionId = (decisionData.decision_id as string)
          || (decisionData.artifact_id as string)
          || (decisionData.id as string);

        if (!decisionId) {
          // Auto-generate based on timestamp
          const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
          decisionId = `decision-${ts}`;
          decisionData.decision_id = decisionId;
        }

        // Sanitize decision ID for use as filename
        const safeId = decisionId.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) {
          fileError(decisionId, 'validate', 'Decision ID is empty after sanitization');
          return;
        }

        const decisionsDir = path.resolve(missionDir, 'decisions');
        ensureDir(decisionsDir);

        const filePath = path.resolve(decisionsDir, `${safeId}.json`);

        writeJsonFile(filePath, decisionData);

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          decision_id: safeId,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'decision write', nodeErr.message || String(err));
      }
    });

  // --- decision read ---
  cmd
    .command('read')
    .description('Read a decision record by ID')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--id <dec-id>', 'Decision record ID')
    .action((opts: { mission: string; id: string }, cmd: Command) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Sanitize decision ID
        const safeId = opts.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) {
          fileError(opts.id, 'validate', 'Decision ID is empty after sanitization');
          return;
        }

        const filePath = path.resolve(missionDir, 'decisions', `${safeId}.json`);
        const data = readJsonFile(filePath);

        if (data === null) {
          // Also check inside the pending/ subdirectory
          const pendingPath = path.resolve(missionDir, 'decisions', 'pending', `${safeId}.json`);
          const pendingData = readJsonFile(pendingPath);

          if (pendingData === null) {
            fileError(normalizePath(filePath), 'read', `Decision record '${safeId}' not found`);
            return;
          }

          success({
            mission_id: opts.mission,
            decision_id: safeId,
            status: 'pending',
            decision: pendingData,
          });
          return;
        }

        success({
          mission_id: opts.mission,
          decision_id: safeId,
          decision: data,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'decision read', nodeErr.message || String(err));
      }
    });

  // --- decision list ---
  cmd
    .command('list')
    .description('List all decision records for a mission')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .action((opts: { mission: string }, cmd: Command) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const decisionsDir = path.resolve(missionDir, 'decisions');

        if (!fs.existsSync(decisionsDir)) {
          success({
            mission_id: opts.mission,
            decisions: [],
            total: 0,
          });
          return;
        }

        const files = fs.readdirSync(decisionsDir).filter((f) => f.endsWith('.json'));
        const decisions: Array<{ decision_id: string; data: unknown }> = [];

        for (const file of files) {
          const decId = file.replace(/\.json$/, '');
          const data = readJsonFile(path.resolve(decisionsDir, file));
          if (data !== null) {
            decisions.push({ decision_id: decId, data });
          }
        }

        success({
          mission_id: opts.mission,
          decisions,
          total: decisions.length,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'decision list', nodeErr.message || String(err));
      }
    });
}
