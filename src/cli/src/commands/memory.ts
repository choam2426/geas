/**
 * `geas memory` — shared and agent-scoped memory markdown writers.
 *
 *   geas memory shared-set                       (stdin: full markdown)
 *   geas memory agent-set --agent <agent_type>   (stdin: full markdown)
 *
 * Writes to:
 *   `.geas/memory/shared.md`
 *   `.geas/memory/agents/{agent_type}.md`
 *
 * Per CLI.md §14.8:
 *   - stdin is the full markdown body, written byte-for-byte.
 *   - Full-replace semantics (NOT patch/append). Callers that want to
 *     extend existing memory read the current file, edit, and resubmit.
 *   - Atomic temp → fsync → rename via `atomicWrite` (fs-atomic).
 *   - No schema validation — `.geas/memory/*.md` is free-form markdown.
 *   - The CLI writes markdown only; it does NOT touch `memory-update.json`.
 *     The semantic change log (added/modified/removed with reason and
 *     evidence_refs) is produced by the orchestrator in consolidating
 *     phase via `memory-update set`, outside this command.
 *
 * Agent identifier rules (protocol 06):
 *   - `--agent` is a **concrete agent type** (kebab-case), not a slot id.
 *   - Slot ids (`orchestrator`, `decision-maker`, `design-authority`,
 *     `challenger`, `implementer`, `verifier`, `risk-assessor`,
 *     `operator`, `communicator`) are rejected as agent identifiers.
 *     Authority slots happen to share names with their single concrete
 *     agent type; using the slot id here would collapse that distinction
 *     at the filesystem level, so the CLI forces callers to name a
 *     concrete type explicitly.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
import { atomicWrite, ensureDir } from '../lib/fs-atomic';
import {
  agentMemoryPath,
  agentsMemoryDir,
  findProjectRoot,
  isValidAgentOrSlot,
  sharedMemoryPath,
  tmpDir,
} from '../lib/paths';
import { readPayloadText, StdinError } from '../lib/input';

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

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatters for the
 * two memory subcommands.
 */
function formatMemorySharedSet(data: unknown): string {
  const d = data as { path?: string; bytes?: number };
  return `memory shared set: ${d.path ?? '<unknown>'} (${d.bytes ?? 0} bytes)`;
}
function formatMemoryAgentSet(data: unknown): string {
  const d = data as { path?: string; agent?: string; bytes?: number };
  return `memory agent set: ${d.agent ?? '<unknown>'} → ${d.path ?? '<unknown>'} (${d.bytes ?? 0} bytes)`;
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

/**
 * Protocol slot identifiers (protocol 01). These are NOT valid as
 * `--agent` values because agent memory is namespaced by **concrete
 * agent type**, not slot. See protocol 06 §Agent Memory.
 */
const SLOT_IDS = new Set([
  'orchestrator',
  'decision-maker',
  'design-authority',
  'challenger',
  'implementer',
  'verifier',
  'risk-assessor',
  'operator',
  'communicator',
]);

function readContent(filePath?: string): string {
  try {
    return readPayloadText(filePath);
  } catch (e) {
    if (e instanceof StdinError) {
      emitErr(
        makeError('invalid_argument', e.message, {
          hint: 'pass the markdown via --file <path> or pipe through stdin',
          exit_category: 'validation',
        }),
      );
    }
    throw e;
  }
}

function registerSharedSet(mem: Command): void {
  mem
    .command('shared-set')
    .description(
      'Replace `.geas/memory/shared.md` with markdown read from --file or stdin (atomic write).',
    )
    .option('--file <path>', 'Read markdown from file instead of stdin')
    .action((opts: { file?: string }) => {
      const root = needProjectRoot();
      const content = readContent(opts.file);

      const targetPath = sharedMemoryPath(root);
      atomicWrite(targetPath, content, tmpDir(root));

      recordEvent(root, {
        kind: 'memory_shared_set',
        actor: 'cli:auto',
        payload: {
          artifact: slashPath(path.relative(root, targetPath)),
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
      });

      emitOk('memory shared-set', {
        path: slashPath(targetPath),
        scope: 'shared',
        bytes: Buffer.byteLength(content, 'utf-8'),
      });
    });
}

function registerAgentSet(mem: Command): void {
  mem
    .command('agent-set')
    .description(
      'Replace `.geas/memory/agents/{agent}.md` with markdown read from --file or stdin. `--agent` must be a concrete agent type (kebab-case), not a slot id.',
    )
    .requiredOption(
      '--agent <agent_type>',
      'Concrete agent type (kebab-case). Slot ids (implementer, verifier, challenger, decision-maker, design-authority, orchestrator, risk-assessor, operator, communicator) are rejected.',
    )
    .option('--file <path>', 'Read markdown from file instead of stdin')
    .action((opts: { agent: string; file?: string }) => {
      const agent = opts.agent;
      if (!isValidAgentOrSlot(agent)) {
        emitErr(
          makeError(
            'invalid_argument',
            `invalid --agent '${agent}' (expected kebab-case: ${'^[a-z0-9][a-z0-9-]*$'})`,
            {
              hint: 'agent ids must match ^[a-z0-9][a-z0-9-]*$',
              exit_category: 'validation',
            },
          ),
        );
      }
      if (SLOT_IDS.has(agent)) {
        emitErr(
          makeError(
            'invalid_argument',
            `--agent '${agent}' names a protocol slot, not a concrete agent type. Agent memory is namespaced by concrete agent type (protocol 06 §Agent Memory). For authority slots where the slot and the concrete type happen to share a name, pass the concrete type explicitly.`,
            {
              hint: foldGuardHint({ slot_ids: [...SLOT_IDS] }) ?? 'pass a concrete agent type, not a slot id',
              exit_category: 'validation',
            },
          ),
        );
      }

      const root = needProjectRoot();
      const content = readContent(opts.file);

      ensureDir(agentsMemoryDir(root));
      const targetPath = agentMemoryPath(root, agent);
      atomicWrite(targetPath, content, tmpDir(root));

      recordEvent(root, {
        kind: 'memory_agent_set',
        actor: 'cli:auto',
        payload: {
          artifact: slashPath(path.relative(root, targetPath)),
          agent,
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
      });

      emitOk('memory agent-set', {
        path: slashPath(targetPath),
        scope: 'agent',
        agent,
        bytes: Buffer.byteLength(content, 'utf-8'),
      });
    });
}

export function registerMemoryCommands(program: Command): void {
  registerFormatter('memory shared-set', formatMemorySharedSet);
  registerFormatter('memory agent-set', formatMemoryAgentSet);
  const mem = program
    .command('memory')
    .description('Memory markdown writers (shared.md and agents/{type}.md).');
  registerSharedSet(mem);
  registerAgentSet(mem);
}
