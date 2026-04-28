/**
 * IN-8 dependency-status preflight grep — T3.4 / B3.
 *
 * mission-20260427-xIPG1sDY task-003 / verification_plan step 4.
 *
 * Asserts that plugin/skills/drafting-task/SKILL.md and
 * plugin/skills/specifying-mission/SKILL.md both carry the IN-8
 * dependency-status preflight prose:
 *
 *   (i) the file mentions a preflight section/keyword
 *       (regex: 'preflight' OR '사전 점검')
 *  (ii) the file enumerates the three terminal-but-not-passing dep
 *       statuses (regex: 'cancelled' AND 'escalated' AND 'void')
 * (iii) the file describes the user-escalate step
 *       (regex: 'escalate' AND ('user' OR '사용자'))
 *
 * The preflight is the ritual that runs before `geas task approve` —
 * read each `contract.dependencies` task id's
 * `.geas/missions/<mission-id>/tasks/<dep-id>/task-state.json`,
 * inspect the `status` field, and halt + escalate to the user if any
 * dependency is in `cancelled` / `escalated` / `void`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'plugin', 'skills');

const TARGETS = ['drafting-task', 'specifying-mission'];

function loadSkill(name) {
  const file = path.join(SKILLS_ROOT, name, 'SKILL.md');
  assert.ok(
    fs.existsSync(file),
    `expected SKILL.md to exist at ${path.relative(REPO_ROOT, file)}`,
  );
  return { file, content: fs.readFileSync(file, 'utf-8') };
}

test('T3.4 / B3: each target SKILL.md mentions an IN-8 preflight (preflight OR 사전 점검)', () => {
  const findings = [];
  // Match either the English keyword or the Korean phrase. Case-insensitive
  // on the English side because skills sometimes use "Preflight" as a
  // section heading.
  const preflightRe = /(preflight|사전\s*점검)/i;

  for (const name of TARGETS) {
    const { file, content } = loadSkill(name);
    if (!preflightRe.test(content)) {
      findings.push(path.relative(REPO_ROOT, file));
    }
  }

  assert.deepEqual(
    findings,
    [],
    `IN-8 preflight keyword (preflight OR 사전 점검) missing in:\n${findings
      .map((f) => `  ${f}`)
      .join('\n')}`,
  );
});

test('T3.4 / B3: each target SKILL.md enumerates cancelled / escalated / void dep statuses', () => {
  const findings = [];
  const cancelledRe = /\bcancelled\b/;
  const escalatedRe = /\bescalated\b/;
  const voidRe = /\bvoid\b/;

  for (const name of TARGETS) {
    const { file, content } = loadSkill(name);
    const missing = [];
    if (!cancelledRe.test(content)) missing.push('cancelled');
    if (!escalatedRe.test(content)) missing.push('escalated');
    if (!voidRe.test(content)) missing.push('void');
    if (missing.length > 0) {
      findings.push({
        file: path.relative(REPO_ROOT, file),
        missing,
      });
    }
  }

  assert.deepEqual(
    findings,
    [],
    `IN-8 dep-status keywords missing in:\n${findings
      .map((f) => `  ${f.file}: ${f.missing.join(', ')}`)
      .join('\n')}`,
  );
});

test('T3.4 / B3: each target SKILL.md describes the user-escalate step', () => {
  const findings = [];
  const escalateRe = /escalate/i;
  const userRe = /(\buser\b|사용자)/i;

  for (const name of TARGETS) {
    const { file, content } = loadSkill(name);
    const missing = [];
    if (!escalateRe.test(content)) missing.push('escalate');
    if (!userRe.test(content)) missing.push('user OR 사용자');
    if (missing.length > 0) {
      findings.push({
        file: path.relative(REPO_ROOT, file),
        missing,
      });
    }
  }

  assert.deepEqual(
    findings,
    [],
    `IN-8 user-escalate prose missing in:\n${findings
      .map((f) => `  ${f.file}: ${f.missing.join(', ')}`)
      .join('\n')}`,
  );
});
