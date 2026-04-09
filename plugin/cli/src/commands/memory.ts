/**
 * Memory command group — simplified 2-file model.
 *
 * v4: Memory is two files:
 *   - .geas/rules.md (project conventions + learned rules)
 *   - .geas/memory/agents/{agent}.md (per-agent notes)
 *
 * All old commands (index-update, promote, candidate-write, entry-write,
 * log-write) are removed. Only agent-note remains.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { success, fileError } from '../lib/output';
import { resolveGeasDir, normalizePath, validateIdentifier, assertContainedIn } from '../lib/paths';
import { ensureDir } from '../lib/fs-atomic';
import { writeCheckpointPending } from '../lib/post-write-checks';
import { getCwd } from '../lib/cwd';

export function registerMemoryCommands(program: Command): void {
  const cmd = program
    .command('memory')
    .description('Memory system (rules.md + agent notes)');

  // --- memory init-rules ---
  cmd
    .command('init-rules')
    .description('Bootstrap .geas/rules.md with initial agent rules content')
    .option('--code-section <text>', 'Additional Code section content to append')
    .action((opts: { codeSection?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const rulesPath = path.resolve(geasDir, 'rules.md');

        // Do not overwrite if rules.md already exists
        if (fs.existsSync(rulesPath)) {
          const content = fs.readFileSync(rulesPath, 'utf-8');
          success({ action: 'skipped', reason: 'rules.md already exists', path: normalizePath(rulesPath) });
          return;
        }

        let content = `# Agent Rules

## Evidence
- Write evidence via CLI: \`geas evidence add --task {tid} --agent {name} --role {role} --set key=value\`
- Evidence is stored at .geas/missions/{mission_id}/tasks/{task-id}/evidence/{agent}.json
- created_at is auto-injected by the CLI. No manual timestamp needed.

## Code
- Respect scope.surfaces from the TaskContract — only modify files within the declared scope
`;

        if (opts.codeSection) {
          content += opts.codeSection + '\n';
        }

        ensureDir(path.dirname(rulesPath));
        fs.writeFileSync(rulesPath, content, 'utf-8');
        success({ action: 'created', path: normalizePath(rulesPath) });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'init-rules', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // --- memory agent-note ---
  cmd
    .command('agent-note')
    .description('Append a note to an agent\'s memory file (memory/agents/{agent}.md)')
    .requiredOption('--agent <name>', 'Agent type name (e.g., software-engineer)')
    .requiredOption('--add <text>', 'Note text to append')
    .action((opts: { agent: string; add: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        // Validate agent name (reject, never sanitize)
        validateIdentifier(opts.agent, 'agent');
        const agentName = opts.agent;

        const agentsDir = path.resolve(geasDir, 'memory', 'agents');
        ensureDir(agentsDir);

        const filePath = path.resolve(agentsDir, `${agentName}.md`);
        assertContainedIn(filePath, geasDir);

        // Checkpoint pending
        writeCheckpointPending(filePath, cwd);

        // Append to existing file or create with header
        let content: string;
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
          // Append the note as a bullet point
          const note = `- ${opts.add}\n`;
          content = content.trimEnd() + '\n' + note;
        } else {
          // Create new file with header
          const header = agentName
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          content = `# ${header} Memory\n\n- ${opts.add}\n`;
        }

        fs.writeFileSync(filePath, content, 'utf-8');

        success({
          written: normalizePath(filePath),
          agent: agentName,
          action: 'appended',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'agent-note', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // --- memory read ---
  cmd
    .command('read')
    .description('Read an agent\'s memory notes or rules.md')
    .option('--agent <name>', 'Agent name (omit to read rules.md)')
    .action((opts: { agent?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        if (opts.agent) {
          validateIdentifier(opts.agent, 'agent');
          const agentName = opts.agent;
          const filePath = path.resolve(geasDir, 'memory', 'agents', `${agentName}.md`);
          assertContainedIn(filePath, geasDir);
          if (!fs.existsSync(filePath)) {
            success({ agent: agentName, content: null, message: 'No memory notes found' });
            return;
          }
          const content = fs.readFileSync(filePath, 'utf-8');
          success({ agent: agentName, content });
        } else {
          const rulesPath = path.resolve(geasDir, 'rules.md');
          if (!fs.existsSync(rulesPath)) {
            success({ type: 'rules', content: null, message: 'rules.md not found' });
            return;
          }
          const content = fs.readFileSync(rulesPath, 'utf-8');
          success({ type: 'rules', content });
        }
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'memory read', nodeErr.message || String(err));
      }
    });
}
