/**
 * Codex plugin agent dispatch contract.
 *
 * Codex installs Geas agents as plugin files, not as auto-registered runtime
 * agents. Main-session skills that spawn sub-agents must therefore load the
 * concrete agents/*.md prompt explicitly, and spawned-only skills must refuse
 * to run without that prompt.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'plugins', 'geas', 'skills');

function readSkill(name) {
  return fs.readFileSync(path.join(SKILLS_ROOT, name, 'SKILL.md'), 'utf8');
}

test('Codex agent dispatch reference defines explicit agents/*.md prompt loading', () => {
  const body = fs.readFileSync(
    path.join(SKILLS_ROOT, 'mission', 'references', 'codex-agent-dispatch.md'),
    'utf8',
  );

  for (const required of [
    '.codex-plugin/plugin.json',
    'agents/authority/{slot}.md',
    'agents/software/{concrete_agent_type}.md',
    'agents/research/{concrete_agent_type}.md',
    'missing_agent_prompt',
  ]) {
    assert.match(body, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('main-session spawning skills reference the Codex agent dispatch adapter', () => {
  for (const skill of [
    'mission',
    'specifying-mission',
    'scheduling-work',
    'convening-deliberation',
    'running-gate',
    'verdicting-mission',
  ]) {
    assert.match(
      readSkill(skill),
      /codex-agent-dispatch\.md/,
      `${skill} must point spawning paths at the Codex agent dispatch adapter`,
    );
  }
});

test('spawned-only skills fail closed when the agent prompt is missing', () => {
  for (const skill of [
    'implementing-task',
    'reviewing-task',
    'verifying-task',
    'deliberating-on-proposal',
    'designing-solution',
    'deciding-on-approval',
  ]) {
    assert.match(
      readSkill(skill),
      /missing_agent_prompt/,
      `${skill} must refuse generic spawned execution without the agent file body`,
    );
  }
});
