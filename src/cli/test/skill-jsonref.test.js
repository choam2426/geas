/**
 * SKILL.md inline-JSON-template sweep — T3.2 / AC6.
 *
 * mission-20260427-xIPG1sDY task-003 / verification_plan step 2.
 *
 * After T3.2 migration, skills/<name>/SKILL.md bodies must NOT
 * contain inline JSON template blocks (a `^\s*\{\s*$` line followed
 * eventually by a `^\s*\}\s*$` line with at least 3 lines total in the
 * block). Such templates are replaced by `geas schema template <name>
 * --op <op> [--kind <kind>]` invocation directives.
 *
 * Per the contract, the carve-out is intentional:
 *   - skills/*\/references/*.md is allowed to contain inline JSON
 *     (the references files are explanatory, not procedural). This test
 *     scans SKILL.md only.
 *   - Single-line JSON object snippets used inside inline-flag examples
 *     (e.g. `--criterion-result '{"criterion":"...","passed":true}'`)
 *     are NOT matched because the open `{` and close `}` appear on the
 *     same line. The grep pattern only catches multi-line blocks where
 *     `{` and `}` sit on their own indented lines.
 *
 * Positive replacement assertion: every SKILL.md that USED to carry an
 * inline JSON template at base_snapshot now references `geas schema
 * template`. The list of such files is hard-coded against the T3 base.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');

function listSkillMdBodies() {
  // Only top-level SKILL.md per skill folder; skip references/.
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(SKILLS_ROOT, e.name, 'SKILL.md');
    if (fs.existsSync(skillFile)) out.push(skillFile);
  }
  return out;
}

function findMultilineJsonBlocks(content) {
  // Scan for opening line `^\s*\{\s*$` then continue until matching
  // closing line `^\s*\}\s*$`. Block size = end - start + 1; only
  // report blocks with size >= 3.
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let openLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (openLine < 0 && /^\s*\{\s*$/.test(line)) {
      openLine = i;
    } else if (openLine >= 0 && /^\s*\}\s*$/.test(line)) {
      const size = i - openLine + 1;
      if (size >= 3) {
        blocks.push({ start: openLine + 1, end: i + 1, size });
      }
      openLine = -1;
    }
  }
  return blocks;
}

test('T3.2 / AC6: no multi-line inline JSON template blocks remain in skills/*/SKILL.md', () => {
  const files = listSkillMdBodies();
  assert.equal(
    files.length,
    17,
    `expected exactly 17 SKILL.md files under skills/, got ${files.length}`,
  );

  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const blocks = findMultilineJsonBlocks(content);
    for (const b of blocks) {
      findings.push({
        file: path.relative(REPO_ROOT, file),
        block: `${b.start}-${b.end}`,
        size: b.size,
      });
    }
  }

  assert.deepEqual(
    findings,
    [],
    `inline JSON template blocks remain in SKILL.md bodies:\n${findings
      .map((f) => `  ${f.file}: lines ${f.block} (${f.size} lines)`)
      .join('\n')}`,
  );
});

// Positive-replacement assertion: every SKILL.md that previously carried
// an inline JSON template REPRESENTING A CLI PAYLOAD at task-003
// base_snapshot must now reference `geas schema template`. Hard-listed
// against the base_snapshot grep.
//
// `deliberating-on-proposal` is intentionally excluded: its base_snapshot
// inline JSON described the voter's in-process return shape (handed back
// to the convening skill in the same conversation), not a CLI payload.
// That skill performs zero `.geas/` writes, so a `geas schema template`
// reference would be misleading. The block was removed in T3.2 by
// converting the shape into prose.
const SKILLS_THAT_HAD_INLINE_JSON = [
  'closing-task',
  'convening-deliberation',
  'deciding-on-approval',
  'designing-solution',
  'drafting-task',
  'implementing-task',
  'reviewing-phase',
  'reviewing-task',
  'specifying-mission',
  'verdicting-mission',
  'verifying-task',
];

test('T3.2 / AC6: every previously-templated SKILL.md now references `geas schema template`', () => {
  const findings = [];
  for (const skill of SKILLS_THAT_HAD_INLINE_JSON) {
    const file = path.join(SKILLS_ROOT, skill, 'SKILL.md');
    assert.ok(
      fs.existsSync(file),
      `expected SKILL.md to exist at ${path.relative(REPO_ROOT, file)}`,
    );
    const content = fs.readFileSync(file, 'utf-8');
    if (!/geas\s+schema\s+template/.test(content)) {
      findings.push(path.relative(REPO_ROOT, file));
    }
  }

  assert.deepEqual(
    findings,
    [],
    `SKILL.md files lost their inline JSON template but did not gain a \`geas schema template\` reference:\n${findings
      .map((f) => `  ${f}`)
      .join('\n')}`,
  );
});
