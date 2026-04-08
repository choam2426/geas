/**
 * Memory command group — memory-index updates, candidate/entry writes,
 * promotion with lifecycle validation, application log writes.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { readJsonFile, writeJsonFile, atomicWriteJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

/**
 * Valid memory lifecycle transitions.
 * Key = current state, Value = set of allowed target states.
 * Based on protocol doc 08: draft->candidate->provisional->stable->canonical
 * plus review/decay/supersede/archive/reject lateral transitions.
 */
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  candidate:    new Set(['provisional', 'rejected', 'under_review']),
  provisional:  new Set(['stable', 'rejected', 'under_review', 'decayed']),
  stable:       new Set(['canonical', 'under_review', 'decayed', 'superseded']),
  canonical:    new Set(['under_review', 'decayed', 'superseded', 'archived']),
  under_review: new Set(['provisional', 'stable', 'canonical', 'rejected', 'decayed']),
  decayed:      new Set(['archived', 'under_review']),
  superseded:   new Set(['archived']),
  archived:     new Set([]),
  rejected:     new Set([]),
};

export function registerMemoryCommands(program: Command): void {
  const cmd = program
    .command('memory')
    .description('Memory entry CRUD (candidates, promotion, index)');

  // --- index-update ---
  cmd
    .command('index-update')
    .description('Add or update an entry in memory-index.json')
    .requiredOption('--data <json>', 'JSON object with memory index entry fields')
    .action((opts: { data: string }, cmd: Command) => {
      try {
        const entry = JSON.parse(opts.data) as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const indexPath = path.resolve(geasDir, 'state', 'memory-index.json');

        // Read existing index or create empty
        let index = readJsonFile<Record<string, unknown>>(indexPath);
        if (!index) {
          index = {
            meta: {
              version: '1.0',
              artifact_type: 'memory_index',
              artifact_id: 'memory-index',
              producer_type: 'orchestration_authority',
              created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            },
            entries: [],
          };
        }

        const entries = (index.entries as Record<string, unknown>[]) || [];
        const memoryId = entry.memory_id as string;
        if (!memoryId) {
          fileError(indexPath, 'index-update', 'memory_id is required in --data');
          return;
        }

        // Upsert: replace existing entry with same memory_id, or append
        const existingIdx = entries.findIndex(
          (e) => (e.memory_id as string) === memoryId
        );
        if (existingIdx >= 0) {
          entries[existingIdx] = entry;
        } else {
          entries.push(entry);
        }
        index.entries = entries;

        // Validate the full index against schema
        const result = validate('memory-index', index);
        if (!result.valid) {
          validationError('memory-index', result.errors || []);
          return;
        }

        atomicWriteJsonFile(indexPath, index, { cwd });
        success({
          ok: true,
          action: existingIdx >= 0 ? 'updated' : 'added',
          memory_id: memoryId,
          path: indexPath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('memory-index.json', 'index-update', msg);
      }
    });

  // --- promote ---
  cmd
    .command('promote')
    .description('Promote a memory entry to a new lifecycle state')
    .requiredOption('--id <mem-id>', 'Memory ID to promote')
    .requiredOption('--to <state>', 'Target lifecycle state')
    .action((opts: { id: string; to: string }, cmd: Command) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const targetState = opts.to;

        // Read from entries first, fall back to candidates
        const entryPath = path.resolve(geasDir, 'memory', 'entries', `${opts.id}.json`);
        const candidatePath = path.resolve(geasDir, 'memory', 'candidates', `${opts.id}.json`);

        let data = readJsonFile<Record<string, unknown>>(entryPath);
        let sourcePath = entryPath;
        let isCandidate = false;

        if (!data) {
          data = readJsonFile<Record<string, unknown>>(candidatePath);
          sourcePath = candidatePath;
          isCandidate = true;
        }

        if (!data) {
          fileError(opts.id, 'promote', `Memory entry not found at entries/ or candidates/`);
          return;
        }

        const currentState = (data.state as string) || 'candidate';

        // Validate transition
        const allowed = VALID_TRANSITIONS[currentState];
        if (!allowed || !allowed.has(targetState)) {
          const allowedList = allowed ? Array.from(allowed).join(', ') : 'none';
          fileError(
            opts.id,
            'promote',
            `Invalid transition: ${currentState} -> ${targetState}. Allowed: [${allowedList}]`
          );
          return;
        }

        // Update the state
        data.state = targetState;

        // Remove top-level created_at that enrichTimestamp may have injected
        // (it belongs in meta only; additionalProperties: false rejects it)
        delete data.created_at;

        // If promoting from candidate, transform to entry schema
        if (isCandidate) {
          // Remove candidate-only fields
          delete data.candidate_reason;
          delete data.source_artifacts;
          // Add entry-required fields with defaults
          if (!data.review_after) {
            // Default review: 30 days from now
            const reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + 30);
            data.review_after = reviewDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
          }
          if (!data.supersedes) data.supersedes = [];
          if (!('superseded_by' in data)) data.superseded_by = null;
          if (!data.tags) data.tags = [];
          if (!data.body) data.body = [];
          // Update meta artifact_type
          const meta = data.meta as Record<string, unknown> | undefined;
          if (meta) {
            meta.artifact_type = 'memory_entry';
          }
        }

        // If promoting from candidate, write to entries/ directory
        const destPath = path.resolve(geasDir, 'memory', 'entries', `${opts.id}.json`);

        // Validate against memory-entry schema
        const result = validate('memory-entry', data);
        if (!result.valid) {
          validationError('memory-entry', result.errors || []);
          return;
        }

        writeJsonFile(destPath, data, { cwd });

        // Remove the old candidate file after successful promotion
        if (isCandidate) {
          try {
            fs.unlinkSync(candidatePath);
          } catch {
            // Best-effort cleanup: ignore if already removed
          }
        }

        success({
          ok: true,
          memory_id: opts.id,
          from: currentState,
          to: targetState,
          path: destPath,
          moved_from_candidates: isCandidate,
        });
      } catch (err: unknown) {
        fileError(opts.id, 'promote', (err as Error).message);
      }
    });

  // --- candidate-write ---
  cmd
    .command('candidate-write')
    .description('Write a memory candidate to candidates/')
    .requiredOption('--data <json>', 'JSON memory candidate object')
    .action((opts: { data: string }, cmd: Command) => {
      try {
        const data = JSON.parse(opts.data) as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        const memoryId = data.memory_id as string;
        if (!memoryId) {
          fileError('candidates/', 'candidate-write', 'memory_id is required in --data');
          return;
        }

        // Validate against memory-candidate schema
        const result = validate('memory-candidate', data);
        if (!result.valid) {
          validationError('memory-candidate', result.errors || []);
          return;
        }

        const filePath = path.resolve(geasDir, 'memory', 'candidates', `${memoryId}.json`);
        writeJsonFile(filePath, data, { cwd });

        success({
          ok: true,
          memory_id: memoryId,
          path: filePath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('candidates/', 'candidate-write', msg);
      }
    });

  // --- entry-write ---
  cmd
    .command('entry-write')
    .description('Write a memory entry to entries/')
    .requiredOption('--data <json>', 'JSON memory entry object')
    .action((opts: { data: string }, cmd: Command) => {
      try {
        const data = JSON.parse(opts.data) as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        const memoryId = data.memory_id as string;
        if (!memoryId) {
          fileError('entries/', 'entry-write', 'memory_id is required in --data');
          return;
        }

        // Validate against memory-entry schema
        const result = validate('memory-entry', data);
        if (!result.valid) {
          validationError('memory-entry', result.errors || []);
          return;
        }

        const filePath = path.resolve(geasDir, 'memory', 'entries', `${memoryId}.json`);
        writeJsonFile(filePath, data, { cwd });

        success({
          ok: true,
          memory_id: memoryId,
          path: filePath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('entries/', 'entry-write', msg);
      }
    });

  // --- log-write ---
  cmd
    .command('log-write')
    .description('Write a memory application log entry')
    .requiredOption('--task <tid>', 'Task ID')
    .requiredOption('--memory <mid>', 'Memory ID')
    .requiredOption('--data <json>', 'JSON application log object')
    .action((opts: { task: string; memory: string; data: string }, cmd: Command) => {
      try {
        const data = JSON.parse(opts.data) as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        // Ensure task_id and memory_id are set from flags if not in data
        if (!data.task_id) data.task_id = opts.task;
        if (!data.memory_id) data.memory_id = opts.memory;

        // Validate against memory-application-log schema
        const result = validate('memory-application-log', data);
        if (!result.valid) {
          validationError('memory-application-log', result.errors || []);
          return;
        }

        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const safeTs = timestamp.replace(/:/g, '-');
        const filename = `${opts.memory}_${opts.task}_${safeTs}.json`;
        const filePath = path.resolve(geasDir, 'memory', 'application-logs', filename);
        writeJsonFile(filePath, data, { cwd });

        success({
          ok: true,
          task_id: opts.task,
          memory_id: opts.memory,
          path: filePath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('application-logs/', 'log-write', msg);
      }
    });
}
