/**
 * Legacy term sweep — Phase 1 closure gate P1.end.3.
 *
 * Asserts the v3 surfaces (src/cli/, plugin/skills/, plugin/agents/,
 * plugin/hooks/) contain no occurrences of terminology that was retired
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
  'plugin/skills',
  'plugin/agents',
  'plugin/hooks',
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

// ── T1 bridge code-level delegation pattern (envelope -> output) ──────
//
// mission-20260427-xIPG1sDY task-001 / verification_plan step 6.
// Asserts that envelope.ts source declares an import from './output' AND
// references the writer helpers in the bridge body. Pairs with the
// runtime equivalence tests in output.test.js (T1 bridge equivalence
// section): one proves the bytes on stdout match, this one proves the
// code path actually flows through output.ts. A future regression that
// reverts the bridge to envelope.ts's own JSON.stringify+process.exit
// would still pass the runtime tests today (because stdout bytes are
// identical) but would silently strip the bridge's central premise
// (unified OutputState routing). This grep catches that.

test('envelope.ts bridge: emit() delegates to output.ts writer helpers', () => {
  const envelopePath = path.join(
    REPO_ROOT,
    'src',
    'cli',
    'src',
    'lib',
    'envelope.ts',
  );
  const src = fs.readFileSync(envelopePath, 'utf-8');

  // (1) Imports from output.ts
  assert.ok(
    /from ['"]\.\/output['"]/.test(src),
    'envelope.ts must import from ./output (bridge delegation pattern)',
  );

  // (2) Bridge body references the non-exiting writer helpers
  assert.ok(
    /writeOkEnvelope\s*\(/.test(src),
    'envelope.ts emit() must call writeOkEnvelope on the success path',
  );
  assert.ok(
    /writeLegacyErrEnvelope\s*\(/.test(src),
    'envelope.ts emit() must call writeLegacyErrEnvelope on the error path',
  );

  // (3) Legacy EXIT_CODES still drives process.exit on the error path —
  // proving Option A (legacy exit code preservation at T1 merge).
  assert.ok(
    /process\.exit\(EXIT_CODES\[/.test(src),
    'envelope.ts emit() must still exit with EXIT_CODES[code] (Option A)',
  );
});
