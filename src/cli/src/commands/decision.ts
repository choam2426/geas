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
import { success, fileError, noStdinError } from '../lib/output';
import { resolveGeasDir, resolveMissionDir, normalizePath, validateIdentifier, assertContainedIn } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { getCwd } from '../lib/cwd';
import { readInputData } from '../lib/input';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

export function registerDecisionCommands(program: Command): void {
  const cmd = program
    .command('decision')
    .description('Decision record read/write');

  // --- decision write ---
  cmd
    .command('write')
    .description('Write a decision record (JSON via stdin)')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { mission: string; dryRun?: boolean }, cmd: Command) => {
      try {
        // Read JSON from stdin
        let decisionData: Record<string, unknown>;
        try {
          decisionData = readInputData() as Record<string, unknown>;
        } catch (readErr: unknown) {
          const rnErr = readErr as NodeJS.ErrnoException;
          if (rnErr.code === 'NO_STDIN') {
            noStdinError('decision write', rnErr.message);
            return;
          }
          if (rnErr.code === 'INVALID_JSON') {
            if (opts.dryRun) { dryRunParseError(rnErr.message); return; }
            fileError('', 'parse', rnErr.message);
            return;
          }
          throw readErr;
        }

        if (typeof decisionData !== 'object' || decisionData === null || Array.isArray(decisionData)) {
          if (opts.dryRun) { dryRunParseError('stdin JSON must be an object'); return; }
          fileError('', 'parse', 'stdin JSON must be an object');
          return;
        }

        // --dry-run: JSON parse check only (no schema for decisions)
        if (opts.dryRun) {
          dryRunGuard(true, decisionData, null);
          return;
        }

        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        validateIdentifier(opts.mission, 'mission');
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

        // Validate decision ID
        validateIdentifier(decisionId, 'decision_id');

        const decisionsDir = path.resolve(missionDir, 'decisions');
        ensureDir(decisionsDir);

        const filePath = path.resolve(decisionsDir, `${decisionId}.json`);
        assertContainedIn(filePath, missionDir);

        writeJsonFile(filePath, decisionData, { cwd });

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          decision_id: decisionId,
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
        validateIdentifier(opts.mission, 'mission');
        validateIdentifier(opts.id, 'decision_id');
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        const filePath = path.resolve(missionDir, 'decisions', `${opts.id}.json`);
        assertContainedIn(filePath, missionDir);
        const data = readJsonFile(filePath);

        if (data === null) {
          // Also check inside the pending/ subdirectory
          const pendingPath = path.resolve(missionDir, 'decisions', 'pending', `${opts.id}.json`);
          assertContainedIn(pendingPath, missionDir);
          const pendingData = readJsonFile(pendingPath);

          if (pendingData === null) {
            fileError(normalizePath(filePath), 'read', `Decision record '${opts.id}' not found`);
            return;
          }

          success({
            mission_id: opts.mission,
            decision_id: opts.id,
            status: 'pending',
            decision: pendingData,
          });
          return;
        }

        success({
          mission_id: opts.mission,
          decision_id: opts.id,
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
        validateIdentifier(opts.mission, 'mission');
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
