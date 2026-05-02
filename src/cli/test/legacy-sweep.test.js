/**
 * Legacy term sweep — Phase 1 closure gate P1.end.3.
 *
 * Asserts the v3 surfaces (src/cli/, skills/, agents/,
 * hooks/) contain no occurrences of terminology that was retired
 * by the v3 protocol rewrite.
 *
 * `docs/superpowers/specs/` is explicitly excluded because it contains
 * the migration strategy / salvage notes which legitimately refer to
 * legacy concepts.
 *
 * Keep this aligned with the list in
 * `docs/superpowers/specs/2026-04-20-migration-phase1-plan.md § P1.end.3`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const LEGACY_TERMS = [
  'policy-override',
  'lock-manifest',
  'recovery-packet',
  'health-check',
  // Guard against the legacy phase name. Match as a standalone word to
  // avoid false positives on English prose (e.g. "evolving system").
  'evolving',
  'rules-update',
  'pipeline_step',
  'run-state',
  'scheduler_state',
  'recovery_class',
  'design-brief',
  'checkpoint_phase',
  'carry-forward',
  'intentional_cuts',
];

const SCAN_ROOTS = [
  'src/cli',
  'skills',
  'agents',
  'hooks',
];

// These paths are excluded from the sweep because they are build
// artefacts or vendor directories that are not authored by us.
const EXCLUDED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  '.tmp',
  '.git',
]);

// This very test file has to literally spell out every legacy term in
// order to search for them; it must not be swept for its own legacy
// strings.
const EXCLUDED_FILES = new Set([
  path.resolve(__dirname, 'legacy-sweep.test.js'),
]);

function isExcludedDir(name) {
  return EXCLUDED_SEGMENTS.has(name);
}

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (isExcludedDir(e.name)) continue;
      walk(path.join(dir, e.name), acc);
    } else if (e.isFile()) {
      const full = path.join(dir, e.name);
      if (EXCLUDED_FILES.has(path.resolve(full))) continue;
      acc.push(full);
    }
  }
}

function listScanTargets() {
  const out = [];
  for (const rel of SCAN_ROOTS) {
    const abs = path.join(REPO_ROOT, rel);
    if (fs.existsSync(abs)) walk(abs, out);
  }
  return out;
}

test('no legacy v1/v2 terms remain in v3 surfaces', () => {
  const files = listScanTargets();
  assert.ok(files.length > 0, 'expected at least one file in the scan roots');

  const findings = [];
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const term of LEGACY_TERMS) {
      // `evolving` uses a word-boundary match because it is a common
      // English word that could appear in prose without referring to
      // the legacy phase concept. Every other term is a distinctive
      // hyphenated / snake-case identifier and is matched as-is.
      const re =
        term === 'evolving'
          ? /\bevolving\b/
          : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (re.test(content)) {
        findings.push({ file: path.relative(REPO_ROOT, file), term });
      }
    }
  }

  assert.deepEqual(
    findings,
    [],
    `legacy terms remain in v3 surfaces:\n${findings
      .map((f) => `  ${f.file}: '${f.term}'`)
      .join('\n')}`,
  );
});

// ── T1 bridge test removed in T5.5 ────────────────────────────────────
//
// mission-20260427-xIPG1sDY task-005 / verification_plan step 5.
//
// The original "envelope.ts bridge: emit() delegates to output.ts writer
// helpers" test asserted that envelope.ts imported from ./output and
// called writeOkEnvelope / writeLegacyErrEnvelope from inside emit() —
// the T1 Option A bridge contract. That contract no longer applies:
// envelope.ts dropped its emit / err / ok / EXIT_CODES exports in T5.5
// (mission-20260427-xIPG1sDY task-005), leaving the file as solely the
// events.jsonl recorder. The bridge served its design purpose during
// the T2 (task-006) migration window and is retired on schedule.
//
// Replacement coverage:
//   - src/cli/test/envelope-no-legacy-exports.test.js binary-asserts
//     env.emit / env.err / env.ok / env.EXIT_CODES are undefined.

// ── T3.1 / AC4: SKILL.md migration sweep ──────────────────────────────
//
// mission-20260427-xIPG1sDY task-003 / verification_plan step 1.
//
// After T2 framework ships and T3 migrates the 17 SKILL.md files, no
// SKILL.md body should still promote the legacy CLI patterns:
//   (a) `cat <<EOF` / `<<'EOF'` heredoc-style payload injection
//   (b) `cat <something>.json | geas <command>` stdin-pipe form
//
// The grep is intentionally narrow: bare `--file <path>` mentions are
// allowed (it remains a back-compat alias and several commands accept
// only `--file`); only the heredoc and stdin-pipe forms are flagged. A
// SKILL.md may still mention "stdin" descriptively (e.g. "this command
// accepts JSON via --file or stdin") — what we forbid is the actual
// invocation pattern that pipes a file or heredoc into the CLI.
//
// references/*.md is INCLUDED in the sweep because per T3.1 the legacy
// invocation patterns are forbidden everywhere in skills/, not
// just in the SKILL.md bodies.

const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');

function listSkillMarkdown() {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && full.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  walk(SKILLS_ROOT);
  return out;
}

test('T3.1 / AC4: no `cat <<EOF` heredoc invocations remain in skills/', () => {
  const files = listSkillMarkdown();
  assert.ok(files.length > 0, 'expected at least one SKILL.md / reference under skills/');

  const findings = [];
  // Match `cat <<EOF`, `cat <<'EOF'`, `cat <<"EOF"`, with any whitespace
  // between cat and <<. The closing EOF is not required to match here —
  // the open marker alone is enough to prove a heredoc invocation pattern.
  const heredoc = /cat\s+<<-?\s*['"]?EOF['"]?/;

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (heredoc.test(line)) {
        findings.push({
          file: path.relative(REPO_ROOT, file),
          line: idx + 1,
          text: line.trim(),
        });
      }
    });
  }

  assert.deepEqual(
    findings,
    [],
    `legacy heredoc invocations remain in skills/:\n${findings
      .map((f) => `  ${f.file}:${f.line}  ${f.text}`)
      .join('\n')}`,
  );
});

test('T3.1 / AC4: no `cat <file>.json | geas` stdin-pipe invocations remain in skills/', () => {
  const files = listSkillMarkdown();
  assert.ok(files.length > 0, 'expected at least one SKILL.md / reference under skills/');

  const findings = [];
  // Match `cat <something> | geas` — captures the actual invocation
  // pattern. We intentionally ignore prose mentions of "stdin" because
  // running-gate/SKILL.md legitimately reminds the reader that
  // `geas gate run` does NOT take stdin (anti-pattern callout).
  const pipeIntoGeas = /\bcat\s+\S+\s*\|\s*geas\s/;

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (pipeIntoGeas.test(line)) {
        findings.push({
          file: path.relative(REPO_ROOT, file),
          line: idx + 1,
          text: line.trim(),
        });
      }
    });
  }

  assert.deepEqual(
    findings,
    [],
    `legacy stdin-pipe invocations remain in skills/:\n${findings
      .map((f) => `  ${f.file}:${f.line}  ${f.text}`)
      .join('\n')}`,
  );
});
