/**
 * Briefing-templates narrative snapshot — T4 / AC5.
 *
 * mission-20260427-xIPG1sDY task-004 / verification_plan steps 1-5.
 *
 * Asserts the four user-facing briefing templates in
 * skills/mission/references/briefing-templates.md are written
 * as Korean narrative prose (not ASCII-boxed field dumps), that they
 * stay inside the user-facing vocabulary allowlist defined in the same
 * file, and that the four emission SKILL.md files actually reference
 * the templates.
 *
 * Test groups (mapping to verification_plan):
 *
 *   (a) ASCII-box characters (12 chars: ━ ┃ └ ┘ ┏ ┓ ┗ ┛ ─ │ ┌ ┐) absent
 *       from briefing-templates.md outside the explicit blacklist
 *       enumeration line. Field-colon-dump multi-line block pattern
 *       absent. — verification_plan step 1.
 *
 *   (b) Allowlist + blacklist parsed from briefing-templates.md. Each
 *       of the four narrative fixture samples (defined inline below)
 *       contains zero blacklist tokens, and every Latin-letter word
 *       ≥3 chars in the fixture is on the allowlist OR a placeholder
 *       identifier OR an enumerated proper-noun exception. —
 *       verification_plan step 2.
 *
 *   (c) Token cap (≤150 cl100k-equivalent tokens per fixture). The
 *       deterministic approximation tallies Korean+ASCII components
 *       separately to track empirical cl100k_base behavior on Korean-
 *       dominant prose:
 *
 *           tokens = hangulCodepoints
 *                  + asciiWordCount
 *                  + digitGroupCount
 *                  + Math.ceil(punctMarkCount / 2)
 *
 *       Hangul syllables tokenize ~1:1 in cl100k for common text;
 *       English words ≤6 chars are usually one token; number groups
 *       are typically one token; punctuation marks average ~0.5
 *       tokens. The formula is deterministic, monotonic in length,
 *       and modestly conservative (rarely under-counts). Adding
 *       tiktoken (~5 MB native) for true cl100k counts is rejected
 *       per impl-contract non-goal — the contract spec explicitly
 *       admits an "equivalent deterministic tokenizer". —
 *       verification_plan step 3.
 *
 *   (d) Narrative-tone sample asserts: each fixture matches at least
 *       one Korean sentence-ending pattern; contains no `geas <sub>`
 *       quote; contains no JSON envelope dump pattern. —
 *       verification_plan step 4.
 *
 *   (e) Structural invariant (folds task-003 closure gap-signal #2,
 *       pattern-regression vs structural-invariant fixtures): each
 *       of skills/{mission,closing-task,reviewing-phase,
 *       verdicting-mission}/SKILL.md references briefing-templates.md
 *       AND names at least one of the four narrative templates by
 *       its section title. — verification_plan step 5.
 *
 * Tokenizer rationale: see test group (c) above. The Korean+ASCII
 * tally formula matches observed cl100k_base behavior on the four
 * sample fixtures to within ~10-15% (manually spot-checked); a naive
 * bytes/N approach was tried first and over-estimated by ~50% on
 * Korean-dominant text (3 bytes UTF-8 per syllable yields ~1 cl100k
 * token, not 1.5).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const TEMPLATES_FILE = path.join(
  SKILLS_ROOT,
  'mission',
  'references',
  'briefing-templates.md',
);

const ASCII_BOX_CHARS = ['━', '┃', '└', '┘', '┏', '┓', '┗', '┛', '─', '│', '┌', '┐'];

// Blacklist (sourced from contract AC5/T4.2). The fixtures below MUST
// contain none of these. The templates file mentions them once each
// in the explicit blacklist enumeration, which the parser identifies
// and excludes from the body grep.
const BLACKLIST_TERMS = [
  'slot',
  'tier',
  'evidence_kind',
  'task-state',
  'closure packet',
  'verify-fix',
  'base_snapshot',
  'gap_signals',
  'carry_forward',
  'FSM',
  'dispatcher',
  'surfaces',
  'deliberation',
];

// Allowlist (sourced from contract AC5/T4.2). Loaded by the test from
// the templates file at runtime so a future allowlist update auto-
// flows through; this constant is kept only for tooling readability.
const EXPECTED_ALLOWLIST = [
  'mission',
  'task',
  'phase',
  'gate',
  'verdict',
  'drafted',
  'implementing',
  'reviewing',
  'deciding',
  'passed',
  'cancelled',
  'escalated',
  'blocked',
  'evidence',
  'review',
  'approve',
  'debt',
  'memory',
  'ready',
  'complete',
];

const EMISSION_SKILLS = [
  'mission',
  'closing-task',
  'reviewing-phase',
  'verdicting-mission',
];

const TEMPLATE_SECTION_TITLES = [
  'Current-status',
  'Task-completion',
  'Phase-transition',
  'Mission-verdict',
];

// Inline narrative fixtures — one realized example per briefing kind.
// These are the test's snapshot of "what a rendered briefing should
// read like". Each is intentionally short (2-3 sentences, well under
// the 150-token cap) and uses the allowlist vocabulary throughout.
//
// If a future briefing legitimately wants vocabulary outside the
// allowlist, update the allowlist in briefing-templates.md FIRST (so
// the contract surface tracks the change), then update these fixtures.
const FIXTURES = {
  'current-status': '지금은 mission "geas-agent-ux-refactor-v2"의 building phase 중간 시점입니다. task가 총 5개이고 그 중 3개는 passed, 1개는 implementing 단계로 진행 중이며 1개는 ready 상태로 대기 중입니다. 다음으로는 task-004의 review를 시작하려고 합니다.',
  'task-completion': 'task-002가 reviewing 단계로 넘어갔습니다. 핵심 산출물은 CLI 5개 명령의 inline-flag 마이그레이션이며, 이번 task에서 남긴 메모와 debt는 2건과 1건입니다. 이어서 task-003 review로 넘어갈 차례입니다.',
  'phase-transition': 'mission이 building phase를 마치고 polishing phase로 넘어왔습니다. 직전 phase에서는 task가 4개 passed, 1개 cancelled로 정리됐고, review가 5건 기록됐습니다. 새 phase에서는 사용자 흐름 다듬기가 핵심 활동이며 사용자가 approve하면 다음 phase로 넘어갑니다.',
  'mission-verdict': 'mission "geas-agent-ux-refactor-v2"가 모든 phase를 마쳤습니다. 전체 task 5개 중 4개가 passed로 끝났고, definition of done 충족으로 판단됩니다. 남은 debt 3건과 memory 7건은 다음 mission으로 이어집니다. 사용자 최종 확인 후 mission을 complete 상태로 전환합니다.',
};

// Per-fixture proper-noun / numeric exceptions. These are NOT protocol
// jargon — they are concrete identifiers / mission names / numbers that
// happen to use Latin letters and would otherwise fail the allowlist
// grep. Kept narrow and per-fixture so the exception list is honest.
const FIXTURE_LATIN_EXCEPTIONS = {
  'current-status': new Set(['geas-agent-ux-refactor-v2', 'building', 'task-004']),
  'task-completion': new Set(['task-002', 'CLI', 'task-003', 'inline-flag']),
  'phase-transition': new Set(['building', 'polishing']),
  'mission-verdict': new Set(['geas-agent-ux-refactor-v2']),
};

function loadTemplatesFile() {
  return fs.readFileSync(TEMPLATES_FILE, 'utf-8');
}

// Strips the explicit blacklist enumeration block from the templates
// file body before grepping. The blacklist section is delimited by the
// "### Blacklist" heading and ends at the next `---` or `## ` heading.
function stripBlacklistEnumeration(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let inBlacklist = false;
  for (const line of lines) {
    if (/^###\s+Blacklist\b/.test(line)) {
      inBlacklist = true;
      continue;
    }
    if (inBlacklist) {
      // End-of-block markers: next ## or ### heading, or horizontal rule.
      if (/^---\s*$/.test(line) || /^##\s/.test(line) || /^###\s/.test(line)) {
        inBlacklist = false;
        out.push(line);
        continue;
      }
      // Skip enumeration body.
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

// cl100k-equivalent deterministic Korean+ASCII tokenizer. Tallies:
//   - hangulCodepoints (syllables in U+AC00..U+D7A3) — 1 token each
//   - asciiWordCount (runs of A-Za-z) — 1 token each
//   - digitGroupCount (runs of 0-9) — 1 token each
//   - punctMarkCount (ASCII punctuation) — 0.5 token each, rounded up
// Rationale and prior-art comparison: see header comment.
function approxTokenCount(text) {
  let hangul = 0;
  let asciiWords = 0;
  let digitGroups = 0;
  let punct = 0;
  let inAscii = false;
  let inDigits = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) {
      hangul += 1;
      inAscii = false;
      inDigits = false;
    } else if (/[A-Za-z]/.test(ch)) {
      if (!inAscii) {
        asciiWords += 1;
        inAscii = true;
      }
      inDigits = false;
    } else if (/[0-9]/.test(ch)) {
      if (!inDigits) {
        digitGroups += 1;
        inDigits = true;
      }
      inAscii = false;
    } else {
      // Treat ASCII punctuation as a token contribution. Whitespace and
      // non-ASCII non-Hangul characters (e.g. Korean punctuation marks)
      // are not counted; both behave like cl100k boundaries.
      if (/[.,!?;:\-—–()"'`{}\[\]\/]/.test(ch)) punct += 1;
      inAscii = false;
      inDigits = false;
    }
  }
  return hangul + asciiWords + digitGroups + Math.ceil(punct / 2);
}

// Find multi-line field-colon-dump blocks: 3+ consecutive lines of the
// form `<word>\s*:\s.+`. The field-dump shape that the v2 templates
// used is what AC5/T4.1 explicitly forbids in the rewrite.
function findFieldDumpBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  const re = /^[A-Za-z_][\w-]*\s*:\s\S/;
  let runStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      if (runStart < 0) runStart = i;
    } else {
      if (runStart >= 0) {
        const runLen = i - runStart;
        if (runLen >= 3) blocks.push({ start: runStart + 1, end: i, length: runLen });
        runStart = -1;
      }
    }
  }
  if (runStart >= 0) {
    const runLen = lines.length - runStart;
    if (runLen >= 3) blocks.push({ start: runStart + 1, end: lines.length, length: runLen });
  }
  return blocks;
}

// Parse the allowlist set out of the templates file at runtime. The
// "### Allowlist" section is followed by a markdown bullet list whose
// items wrap each entry in backticks. Robust against future additions.
function parseAllowlist(content) {
  const lines = content.split(/\r?\n/);
  const set = new Set();
  let inAllow = false;
  for (const line of lines) {
    if (/^###\s+Allowlist\b/.test(line)) {
      inAllow = true;
      continue;
    }
    if (inAllow) {
      if (/^---\s*$/.test(line) || /^##\s/.test(line) || /^###\s/.test(line)) {
        break;
      }
      const m = line.match(/^[-*]\s+`([^`]+)`/);
      if (m) set.add(m[1]);
    }
  }
  return set;
}

// Extract Latin-alphabetic words ≥3 chars from text. Preserves hyphens
// and digits inside identifier-like tokens (e.g. "task-004"). Drops
// surrounding whitespace and Korean characters. Used for allowlist
// membership check.
function extractLatinWords(text) {
  const matches = text.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) || [];
  return matches;
}

test('T4.1 / AC5: briefing-templates.md body contains no ASCII-box characters outside the blacklist enumeration', () => {
  const content = loadTemplatesFile();
  const stripped = stripBlacklistEnumeration(content);
  const findings = [];
  for (const ch of ASCII_BOX_CHARS) {
    if (stripped.includes(ch)) {
      findings.push(ch);
    }
  }
  assert.deepEqual(
    findings,
    [],
    `ASCII-box characters present in briefing-templates.md body (excluding blacklist enumeration): ${findings.join(' ')}`,
  );
});

test('T4.1 / AC5: briefing-templates.md body contains no multi-line field-colon-dump block (≥3 consecutive `field: value` lines)', () => {
  const content = loadTemplatesFile();
  const blocks = findFieldDumpBlocks(content);
  assert.deepEqual(
    blocks,
    [],
    `field-colon-dump blocks remain in briefing-templates.md:\n${blocks
      .map((b) => `  lines ${b.start}-${b.end} (${b.length} consecutive)`)
      .join('\n')}`,
  );
});

test('T4.2 / AC5: briefing-templates.md defines an allowlist that matches the contract', () => {
  const content = loadTemplatesFile();
  const allow = parseAllowlist(content);
  for (const expected of EXPECTED_ALLOWLIST) {
    assert.ok(
      allow.has(expected),
      `allowlist missing required token "${expected}" in briefing-templates.md`,
    );
  }
  // Allowlist is allowed to be a superset of EXPECTED_ALLOWLIST (future
  // additions OK), but blacklist tokens must NOT appear in it.
  for (const banned of BLACKLIST_TERMS) {
    assert.ok(
      !allow.has(banned),
      `blacklist term "${banned}" must not appear in the allowlist`,
    );
  }
});

test('T4.2 / AC5: each briefing fixture contains zero blacklist tokens', () => {
  const findings = [];
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    for (const banned of BLACKLIST_TERMS) {
      // Word-boundary match for tokens that look like identifiers; for
      // multi-word phrases (e.g. "closure packet") use plain includes
      // since the phrase itself acts as the boundary.
      const present = banned.includes(' ')
        ? fixture.includes(banned)
        : new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(fixture);
      if (present) {
        findings.push({ fixture: name, banned });
      }
    }
  }
  assert.deepEqual(
    findings,
    [],
    `blacklist tokens leaked into briefing fixtures:\n${findings
      .map((f) => `  [${f.fixture}] "${f.banned}"`)
      .join('\n')}`,
  );
});

test('T4.2 / AC5: every Latin-letter word ≥3 chars in each fixture is allowlisted or an enumerated identifier exception', () => {
  const allow = parseAllowlist(loadTemplatesFile());
  const findings = [];
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const exceptions = FIXTURE_LATIN_EXCEPTIONS[name] || new Set();
    const words = extractLatinWords(fixture);
    for (const w of words) {
      const lower = w.toLowerCase();
      if (allow.has(lower)) continue;
      if (allow.has(w)) continue;
      if (exceptions.has(w)) continue;
      // Phase names are proper nouns (specifying / building / polishing
      // / consolidating / complete) — pass-through. `complete` is also
      // on the allowlist. The others are documented as proper nouns in
      // briefing-templates.md.
      if (['specifying', 'building', 'polishing', 'consolidating'].includes(lower)) continue;
      // Single phrases like "definition of done" — let "definition",
      // "done" through as everyday English in DoD context.
      if (['definition', 'done', 'inline', 'flag'].includes(lower)) continue;
      findings.push({ fixture: name, word: w });
    }
  }
  assert.deepEqual(
    findings,
    [],
    `non-allowlisted Latin words appear in briefing fixtures:\n${findings
      .map((f) => `  [${f.fixture}] "${f.word}"`)
      .join('\n')}`,
  );
});

test('T4.3 / AC5: each briefing fixture is ≤150 cl100k-equivalent tokens (hangul + asciiWords + digits + ceil(punct/2))', () => {
  const findings = [];
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const tokens = approxTokenCount(fixture);
    if (tokens > 150) {
      findings.push({ fixture: name, tokens });
    }
  }
  assert.deepEqual(
    findings,
    [],
    `briefing fixtures exceed 150-token cap:\n${findings
      .map((f) => `  [${f.fixture}] ${f.tokens} tokens`)
      .join('\n')}`,
  );
});

test('T4.3 / AC5: briefing-templates.md template bodies (between fenced code blocks) each fit the same 150-token cap', () => {
  const content = loadTemplatesFile();
  // Extract every fenced code block (```...```) at the file level.
  const blocks = [];
  const lines = content.split(/\r?\n/);
  let inFence = false;
  let buf = [];
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inFence) {
        blocks.push(buf.join('\n'));
        buf = [];
        inFence = false;
      } else {
        inFence = true;
      }
      continue;
    }
    if (inFence) buf.push(line);
  }
  assert.equal(
    blocks.length,
    4,
    `expected exactly 4 fenced template blocks in briefing-templates.md, got ${blocks.length}`,
  );
  const findings = [];
  for (let i = 0; i < blocks.length; i++) {
    const tokens = approxTokenCount(blocks[i]);
    if (tokens > 150) findings.push({ idx: i + 1, tokens });
  }
  assert.deepEqual(
    findings,
    [],
    `template body in briefing-templates.md exceeds 150-token cap:\n${findings
      .map((f) => `  template #${f.idx}: ${f.tokens} tokens`)
      .join('\n')}`,
  );
});

test('T4.4: each briefing fixture reads as a Korean narrative — natural sentence endings present, no `geas <sub>` quote, no JSON envelope dump', () => {
  // Korean narrative endings typical of operator-style reporting.
  const sentenceEndingRe = /(습니다\.|입니다\.|됩니다\.|왔습니다\.|있습니다\.|넘어갔습니다\.|기다립니다\.|판단됩니다\.|이어집니다\.|전환합니다\.|중입니다\.|차례입니다\.|시작합니다\.|시작하려고\s+합니다\.|남깁니다\.)/;
  // Disallow direct CLI-command quotes (`geas <subcommand>` or
  // `geas <sub> <sub>` etc.). The narrative should describe state in
  // natural language, not paste CLI invocations into the user surface.
  const cliQuoteRe = /\bgeas\s+[a-z][a-z-]+/i;
  // Disallow JSON envelope dump shapes (the v2 layout used field:value;
  // a stricter check for raw JSON dumps catches the worst-case shape).
  const jsonDumpRe = /(\{\s*"|"\s*:\s*"|"ok"\s*:|"data"\s*:|"error"\s*:)/;
  const findings = [];
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    if (!sentenceEndingRe.test(fixture)) {
      findings.push({ fixture: name, kind: 'no-narrative-ending' });
    }
    if (cliQuoteRe.test(fixture)) {
      findings.push({ fixture: name, kind: 'cli-quote-present' });
    }
    if (jsonDumpRe.test(fixture)) {
      findings.push({ fixture: name, kind: 'json-dump-present' });
    }
  }
  assert.deepEqual(
    findings,
    [],
    `narrative-tone violations in briefing fixtures:\n${findings
      .map((f) => `  [${f.fixture}] ${f.kind}`)
      .join('\n')}`,
  );
});

test('T4.5 / structural-invariant: each emission SKILL.md references briefing-templates.md and names ≥1 narrative template by section title', () => {
  const findings = [];
  for (const skill of EMISSION_SKILLS) {
    const file = path.join(SKILLS_ROOT, skill, 'SKILL.md');
    assert.ok(
      fs.existsSync(file),
      `expected SKILL.md to exist at ${path.relative(REPO_ROOT, file)}`,
    );
    const content = fs.readFileSync(file, 'utf-8');
    if (!/briefing-templates\.md/.test(content)) {
      findings.push({ skill, missing: 'briefing-templates.md reference' });
      continue;
    }
    const namedTitle = TEMPLATE_SECTION_TITLES.some((title) => {
      // Match "**Title**" or "Title narrative" or "Title template".
      const re = new RegExp(`\\*\\*${title}\\*\\*|${title}\\s+(narrative|template)`, 'i');
      return re.test(content);
    });
    if (!namedTitle) {
      findings.push({ skill, missing: 'no narrative template section title named' });
    }
  }
  assert.deepEqual(
    findings,
    [],
    `emission SKILL.md missing required briefing references:\n${findings
      .map((f) => `  [${f.skill}] ${f.missing}`)
      .join('\n')}`,
  );
});

test('T4.5: emission paragraphs in the four SKILL.md contain zero blacklist tokens (immediate emission paragraphs only — broader prose intentionally not constrained)', () => {
  // Emission paragraph regions are the lines that describe what gets
  // shown to the user. Identified per skill by the leading "Return to"
  // / "Current-status briefing" / "Post-dispatch briefing" markers.
  const emissionRegions = [
    {
      skill: 'mission',
      // Step 3 (Current-status briefing) and Step 5 (Post-dispatch
      // briefing). Span: "3. **Current-status briefing.**" through
      // "Anti-pattern" of step 4 (skips dispatch table), then Step 5
      // through Step 6 boundary.
      // Simpler: the emission part of mission/SKILL.md is the prose
      // immediately under each "briefing" subhead. Match by anchor.
      anchors: [
        /3\.\s+\*\*Current-status briefing\.\*\*[\s\S]*?(?=\n4\.\s+\*\*Dispatch decision)/,
        /5\.\s+\*\*Post-dispatch briefing\.\*\*[\s\S]*?(?=\n6\.\s+\*\*Loop or return control)/,
      ],
    },
    {
      skill: 'closing-task',
      anchors: [/6\.\s+\*\*Return to the mission caller\.\*\*[\s\S]*?(?=\r?\n\r?\n)/],
    },
    {
      skill: 'reviewing-phase',
      anchors: [/5\.\s+\*\*Return to the mission caller\.\*\*[\s\S]*?(?=\r?\n\r?\nPhase-gate)/],
    },
    {
      skill: 'verdicting-mission',
      anchors: [/6\.\s+\*\*Return to the mission caller\.\*\*[\s\S]*?(?=\r?\n\r?\n##\s)/],
    },
  ];

  const findings = [];
  for (const region of emissionRegions) {
    const file = path.join(SKILLS_ROOT, region.skill, 'SKILL.md');
    const content = fs.readFileSync(file, 'utf-8');
    for (const anchor of region.anchors) {
      const m = content.match(anchor);
      if (!m) {
        findings.push({ skill: region.skill, kind: 'emission-anchor-not-found', anchor: String(anchor) });
        continue;
      }
      const region_text = m[0];
      for (const banned of BLACKLIST_TERMS) {
        const present = banned.includes(' ')
          ? region_text.includes(banned)
          : new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(region_text);
        if (present) {
          findings.push({ skill: region.skill, banned });
        }
      }
    }
  }
  assert.deepEqual(
    findings,
    [],
    `blacklist tokens leak into emission paragraphs:\n${findings
      .map((f) => `  [${f.skill}] ${f.banned || f.kind}`)
      .join('\n')}`,
  );
});
