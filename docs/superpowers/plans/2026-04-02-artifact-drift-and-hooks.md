# Artifact Drift & Hooks Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 artifact drift issues and migrate all Python hooks to Node.js, eliminating the undeclared Python dependency.

**Architecture:** 4 sequential layers: schema/doc alignment → hook path fixes → classification enforcement → Node.js hook migration. Each layer depends on the previous.

**Tech Stack:** JSON Schema (draft 2020-12), Markdown, Node.js, Bash

**Spec:** `docs/superpowers/specs/2026-04-02-artifact-drift-and-hooks-design.md`

---

## File Structure

**Layer 1 — Schema/Doc modifications:**
- Modify: `docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md`
- Modify: `docs/protocol/schemas/integration-result.schema.json`
- Modify: `docs/protocol/schemas/closure-packet.schema.json`

**Layer 2 — Hook fixes:**
- Modify: `plugin/hooks/scripts/verify-pipeline.sh`
- Modify: `plugin/hooks/scripts/protect-geas-state.sh`

**Layer 3 — Pipeline behavior:**
- Modify: `plugin/skills/orchestrating/SKILL.md`
- Modify: `plugin/skills/orchestrating/references/pipeline.md`

**Layer 4 — Node.js migration:**
- Create: `plugin/hooks/scripts/lib/geas-hooks.js`
- Create: 16 `.js` files in `plugin/hooks/scripts/lib/`
- Modify: 16 `.sh` files (replace Python with Node.js wrapper)

---

## Layer 1: Schema/Doc Alignment

### Task 1: Fix protocol 03 field name + integration-result schema + closure-packet schema (E4+E5+E6)

**Files:**
- Modify: `docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md:36`
- Modify: `docs/protocol/schemas/integration-result.schema.json`
- Modify: `docs/protocol/schemas/closure-packet.schema.json:144-160`

- [ ] **Step 1: Fix protocol 03 — state → status (E4)**

In `docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md`, line 36, the core metadata list has `` `state` ``. Change it:

```
old: - `state`
new: - `status`
```

Then grep for any other backtick-quoted `state` used as a field name (not a value like `ready`):

```bash
grep -n '`state`' docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md
```

Change any that refer to the JSON field. Keep the section heading "Task States" as-is (it's a conceptual term, not a field name).

- [ ] **Step 2: Fix integration-result schema (E5)**

Edit `docs/protocol/schemas/integration-result.schema.json`:

1. In `required` array: rename `"status"` → `"conflict_status"`, remove `"files_changed"` from required (make it optional)
2. In `properties`: rename `"status"` key → `"conflict_status"`, change enum from `["success", "conflict", "failed"]` → `["clean", "resolved", "failed"]`
3. Remove `"drift_classification"` property entirely
4. Remove `"conflict_details"` property entirely

The `required` array should be:
```json
"required": ["version", "artifact_type", "artifact_id", "producer_type", "created_at", "task_id", "integration_branch", "merge_commit", "base_commit", "conflict_status"]
```

The `conflict_status` property:
```json
"conflict_status": {
  "type": "string",
  "enum": ["clean", "resolved", "failed"]
}
```

- [ ] **Step 3: Fix closure-packet open_risks (E6)**

Edit `docs/protocol/schemas/closure-packet.schema.json`. Replace the `open_risks` section (lines ~144-160):

```
old:
    "open_risks": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "items"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["none", "present"]
        },
        "items": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },

new:
    "open_risks": {
      "type": "object",
      "additionalProperties": false,
      "required": ["status", "items"],
      "properties": {
        "status": {
          "type": "string",
          "enum": ["none", "present", "acknowledged"]
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["description"],
            "properties": {
              "description": { "type": "string" },
              "acknowledged": { "type": "boolean", "default": false },
              "source": { "type": "string" }
            }
          }
        }
      }
    },
```

- [ ] **Step 4: Verify**

```bash
grep -n '`state`' docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md
grep "conflict_status" docs/protocol/schemas/integration-result.schema.json
grep "drift_classification" docs/protocol/schemas/integration-result.schema.json
grep -A3 '"items"' docs/protocol/schemas/closure-packet.schema.json | head -8
```

Expected: first grep 0 matches, second has match, third 0 matches, fourth shows `"type": "object"`.

- [ ] **Step 5: Commit**

```bash
git add docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md docs/protocol/schemas/integration-result.schema.json docs/protocol/schemas/closure-packet.schema.json
git commit -m "fix: align schemas with pipeline — state→status, integration-result fields, open_risks objects

E4: protocol 03 field name state→status (schema already uses status).
E5: integration-result: status→conflict_status, enum clean/resolved/failed.
E6: closure-packet: open_risks.items from string[] to object[] with acknowledged field."
```

---

## Layer 2: Hook Point Fixes

### Task 2: Fix verify-pipeline.sh challenge-review path (E2)

**Files:**
- Modify: `plugin/hooks/scripts/verify-pipeline.sh:44`

- [ ] **Step 1: Fix challenge-review path**

Edit `plugin/hooks/scripts/verify-pipeline.sh`. Line 44 checks the wrong path:

```
old:     if not os.path.isfile(os.path.join(edir, 'challenge-review.json')):
new:     tdir = os.path.join(geas, 'tasks', tid)
         if not os.path.isfile(os.path.join(tdir, 'challenge-review.json')):
```

Also update the warning message on the next line:

```
old:         missing.append(f'  - {tid}: challenge-review.json (Critical Reviewer Challenge) missing')
new:         missing.append(f'  - {tid}: tasks/{tid}/challenge-review.json (Critical Reviewer Challenge) missing')
```

Do NOT change the other evidence checks (architecture-authority-review, qa-engineer, product-authority-verdict) — they correctly use `edir` (evidence path).

- [ ] **Step 2: Verify**

```bash
grep "challenge-review" plugin/hooks/scripts/verify-pipeline.sh
```

Expected: references `tasks/{tid}/`, not `evidence/{tid}/`.

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/scripts/verify-pipeline.sh
git commit -m "fix(hooks): verify-pipeline checks tasks/ for challenge-review.json

E2: Same pattern as A2 — challenge-review lives in tasks/{tid}/ not evidence/{tid}/."
```

---

### Task 3: Fix scope.paths directory matching (E3)

**Files:**
- Modify: `plugin/hooks/scripts/protect-geas-state.sh:63`

- [ ] **Step 1: Add startswith fallback to scope check**

Edit `plugin/hooks/scripts/protect-geas-state.sh`. Current line 63 (from Phase A fix):

```
old: if scope_paths and not any(fnmatch.fnmatch(rel, p) for p in scope_paths):
new: if scope_paths and not any(fnmatch.fnmatch(rel, p) or rel.startswith(p.rstrip('/') + '/') for p in scope_paths):
```

This handles both glob patterns (`*.go` via fnmatch) and directory prefixes (`src/auth/` via startswith).

- [ ] **Step 2: Verify**

```bash
grep "startswith" plugin/hooks/scripts/protect-geas-state.sh
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/scripts/protect-geas-state.sh
git commit -m "fix(hooks): scope.paths matches directory prefixes via startswith

E3: fnmatch('src/auth/Login.tsx', 'src/auth/') returns False.
Added startswith fallback so directory paths match files inside them."
```

---

## Layer 3: Classification Enforcement

### Task 4: Add classification validation gate (E1)

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md`
- Modify: `plugin/skills/orchestrating/references/pipeline.md`

- [ ] **Step 1: Add validation gate to orchestrating/SKILL.md**

Edit `plugin/skills/orchestrating/SKILL.md`. Find the Specifying phase section (around line 195-198):

```
old:
### Phase 1: Specifying
Read `references/specifying.md` and follow the procedure.
Minimum: intake (seed spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.

new:
### Phase 1: Specifying
Read `references/specifying.md` and follow the procedure.
Minimum: intake (seed spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.

#### Task Classification Validation [MANDATORY]

After task-compiler produces each TaskContract, verify these fields exist:
- `risk_level` (low | normal | high | critical)
- `vote_round_policy` (never | auto | always)
- `task_kind` (code | docs | config | design | audit | release)
- `gate_profile` (code_change | artifact_only | closure_ready)

If ANY field is missing:
1. Read the task's goal, acceptance_criteria, and scope.paths
2. Apply task-compiler/SKILL.md classification criteria:
   - Risk Signals for risk_level
   - Decision Tree for vote_round_policy
   - Signal tables for task_kind and gate_profile
3. Write the missing fields to the TaskContract
4. Log: {"event": "classification_filled", "task_id": "...", "fields_added": [...], "timestamp": "<actual>"}

Do NOT proceed to building phase until ALL tasks have complete classification.
```

- [ ] **Step 2: Add classification fallback to pipeline.md**

Edit `plugin/skills/orchestrating/references/pipeline.md`. Find the "Start Task" section (line ~16). Insert after "Read TaskContract. Check dependencies are `"passed"`." :

```
old:
## Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- Update status to `"implementing"`. Log `task_started` event.

new:
## Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- **Classification Fallback**: If the TaskContract is missing classification fields at pipeline start:
  - `risk_level` missing → assign `"normal"`
  - `vote_round_policy` missing → assign `"auto"`
  - `task_kind` missing → assign `"code"`
  - `gate_profile` missing → assign `"code_change"`
  - Log: `{"event": "classification_defaulted", "task_id": "...", "fields_defaulted": [...], "timestamp": "<actual>"}`
- Update status to `"implementing"`. Log `task_started` event.
```

- [ ] **Step 3: Verify**

```bash
grep -n "Classification Validation" plugin/skills/orchestrating/SKILL.md
grep -n "Classification Fallback" plugin/skills/orchestrating/references/pipeline.md
```

Expected: 1 match each.

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md plugin/skills/orchestrating/references/pipeline.md
git commit -m "feat: add classification validation gate and pipeline fallback

E1: orchestrating validates classification fields after task compilation.
Pipeline defaults missing fields as last-resort (normal/auto/code/code_change).
vote_round_policy defaults to auto (safer than never for unclassified tasks)."
```

---

## Layer 4: Node.js Hook Migration

### Task 5: Create Node.js hook helper module (F1)

**Files:**
- Create: `plugin/hooks/scripts/lib/geas-hooks.js`

- [ ] **Step 1: Create the helper module**

```bash
mkdir -p plugin/hooks/scripts/lib
```

Write `plugin/hooks/scripts/lib/geas-hooks.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

/** Read all of stdin synchronously and return trimmed string */
function readStdin() {
  return fs.readFileSync(0, 'utf8').trim();
}

/** Parse hook input JSON from stdin. Returns {cwd, toolInput, filePath, agentType, command, raw} */
function parseInput(raw) {
  if (!raw) raw = readStdin();
  const d = JSON.parse(raw);
  const cwd = d.cwd || '';
  let ti = d.tool_input || {};
  if (typeof ti === 'string') { try { ti = JSON.parse(ti); } catch { ti = {}; } }
  const filePath = (ti && typeof ti === 'object') ? (ti.file_path || '') : '';
  let agentType = (d.agent_type || '').toLowerCase();
  if (agentType.includes(':')) agentType = agentType.split(':').pop();
  const command = (ti && typeof ti === 'object') ? (ti.command || '') : '';
  return { cwd, toolInput: ti, filePath, agentType, command, raw: d };
}

/** Get .geas/ directory path */
function geasDir(cwd) { return path.join(cwd, '.geas'); }

/** Read and parse JSON file. Returns null if file doesn't exist or parse fails. */
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

/** Write JSON with 2-space indent + trailing newline */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Append a JSON object as one line to a JSONL file */
function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

/** Print warning to stderr: [Geas] WARNING: msg */
function warn(msg) { process.stderr.write('[Geas] WARNING: ' + msg + '\n'); }

/** Print info to stderr: [Geas] msg */
function info(msg) { process.stderr.write('[Geas] ' + msg + '\n'); }

/** Simple fnmatch-style glob matching (supports * and ?) */
function fnmatch(str, pattern) {
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  re += '$';
  return new RegExp(re).test(str);
}

/** Check if a relative path matches any scope.paths entry (fnmatch + directory prefix) */
function matchScope(rel, scopePaths) {
  if (!scopePaths || !scopePaths.length) return true;
  return scopePaths.some(p =>
    fnmatch(rel, p) || rel.startsWith(p.replace(/\/$/, '') + '/')
  );
}

/** Output additionalContext JSON for SubagentStart hooks */
function outputContext(context) {
  if (context) process.stdout.write(JSON.stringify({ additionalContext: context }) + '\n');
}

/** Check if a file exists */
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

/** Get relative path from cwd, normalized to forward slashes */
function relPath(filePath, cwd) {
  return path.relative(cwd, filePath).replace(/\\/g, '/');
}

module.exports = {
  readStdin, parseInput, geasDir, readJson, writeJson, appendJsonl,
  warn, info, fnmatch, matchScope, outputContext, exists, relPath
};
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "const h = require('./plugin/hooks/scripts/lib/geas-hooks'); console.log(Object.keys(h).join(', '))"
```

Expected: `readStdin, parseInput, geasDir, readJson, writeJson, appendJsonl, warn, info, fnmatch, matchScope, outputContext, exists, relPath`

- [ ] **Step 3: Commit**

```bash
git add plugin/hooks/scripts/lib/geas-hooks.js
git commit -m "feat: add Node.js hook helper module

F1: Shared helper for all hooks — parseInput, readJson, writeJson,
fnmatch, matchScope, warn/info, appendJsonl. Eliminates Python dependency."
```

---

### Task 6: Migrate stateless hooks to Node.js (F1 — batch 1)

**Files:**
- Modify: `plugin/hooks/scripts/verify-task-status.sh`
- Modify: `plugin/hooks/scripts/protect-geas-state.sh`
- Modify: `plugin/hooks/scripts/verify-pipeline.sh`
- Modify: `plugin/hooks/scripts/check-debt.sh`
- Modify: `plugin/hooks/scripts/stale-start-check.sh`
- Modify: `plugin/hooks/scripts/integration-lane-check.sh`

These are "stateless" hooks — they read state, check conditions, print warnings. No complex context injection.

- [ ] **Step 1: Rewrite verify-task-status.sh**

Replace the entire file content:

```bash
#!/bin/bash
# verify-task-status.sh — PostToolUse hook (Write|Edit)
# When a task is marked "passed", verifies all mandatory evidence exists.
set -euo pipefail

node -e "
const h = require(require('path').join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/tasks\/[^/]+\.json$/.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || d.status !== 'passed') process.exit(0);

const tid = d.task_id || d.id || '';
if (!tid) process.exit(0);
const geas = h.geasDir(cwd);
const edir = require('path').join(geas, 'evidence', tid);
const tdir = require('path').join(geas, 'tasks', tid);

if (!h.exists(require('path').join(edir, 'architecture-authority-review.json')))
  h.warn(tid + ' marked as passed but architecture-authority-review.json is missing');
if (!h.exists(require('path').join(edir, 'qa-engineer.json')))
  h.warn(tid + ' marked as passed but qa-engineer.json is missing');
if (!h.exists(require('path').join(tdir, 'challenge-review.json')))
  h.warn(tid + ' marked as passed but tasks/' + tid + '/challenge-review.json is missing');
if (!h.exists(require('path').join(edir, 'product-authority-verdict.json')))
  h.warn(tid + ' marked as passed but product-authority-verdict.json is missing');
if (!h.exists(require('path').join(tdir, 'retrospective.json')))
  h.warn(tid + ' marked as passed but tasks/' + tid + '/retrospective.json is missing');

// Check rubric_scores
const qa = h.readJson(require('path').join(edir, 'qa-engineer.json'));
if (qa && (!qa.rubric_scores || !Object.keys(qa.rubric_scores).length))
  h.warn(tid + ' qa-engineer.json is missing rubric_scores');
const arch = h.readJson(require('path').join(edir, 'architecture-authority-review.json'));
if (arch && (!arch.rubric_scores || !Object.keys(arch.rubric_scores).length))
  h.warn(tid + ' architecture-authority-review.json is missing rubric_scores');
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 2: Rewrite protect-geas-state.sh**

Replace entire file:

```bash
#!/bin/bash
# protect-geas-state.sh — PostToolUse hook (Write|Edit)
# Monitors .geas/ state file integrity. Injects real timestamps. Warns on scope violations.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);

const geas = h.geasDir(cwd);
const rel = h.relPath(filePath, cwd);

// Scope check — only for non-.geas files
if (!rel.startsWith('.geas/') && !rel.startsWith('.geas\\\\')) {
  const run = h.readJson(path.join(geas, 'state', 'run.json'));
  if (run && run.current_task_id) {
    const task = h.readJson(path.join(geas, 'tasks', run.current_task_id + '.json'));
    if (task) {
      const scopePaths = (task.scope && task.scope.paths) || [];
      if (scopePaths.length && !h.matchScope(rel, scopePaths))
        h.warn('Write to ' + rel + ' outside scope.paths in ' + run.current_task_id);
    }
  }
}

// .geas/ JSON timestamp injection
if (/\/.geas\/.*\.json$/.test(filePath.replace(/\\\\/g,'/')) && h.exists(filePath)) {
  const d = h.readJson(filePath);
  if (d) {
    const ts = d.created_at || '';
    if (!ts || /:00:00Z$/.test(ts) || /:00:00\\.000Z$/.test(ts)) {
      d.created_at = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');
      h.writeJson(filePath, d);
    }
  }
}

// seed.json frozen warning
if (filePath.replace(/\\\\/g,'/').endsWith('.geas/spec/seed.json'))
  h.warn('seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes.');
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 3: Rewrite verify-pipeline.sh**

Replace entire file:

```bash
#!/bin/bash
# verify-pipeline.sh — Stop hook
# Checks pipeline completeness before session end.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
const run = h.readJson(path.join(geas, 'state', 'run.json'));
if (!run) process.exit(0);

const completed = run.completed_tasks || [];
if (!completed.length) process.exit(0);

const missing = [];
for (const tid of completed) {
  const edir = path.join(geas, 'evidence', tid);
  const tdir = path.join(geas, 'tasks', tid);
  if (!h.exists(path.join(edir, 'architecture-authority-review.json')))
    missing.push('  - ' + tid + ': architecture-authority-review.json (Code Review) missing');
  if (!h.exists(path.join(edir, 'qa-engineer.json')))
    missing.push('  - ' + tid + ': qa-engineer.json (QA Testing) missing');
  if (!h.exists(path.join(tdir, 'challenge-review.json')))
    missing.push('  - ' + tid + ': tasks/' + tid + '/challenge-review.json (Critical Reviewer) missing');
  if (!h.exists(path.join(edir, 'product-authority-verdict.json')))
    missing.push('  - ' + tid + ': product-authority-verdict.json (Product Authority) missing');
  if (!h.exists(path.join(tdir, 'retrospective.json')))
    missing.push('  - ' + tid + ': tasks/' + tid + '/retrospective.json (Retrospective) missing');
}

if (missing.length) {
  h.info('Pipeline incomplete. MANDATORY evidence missing:');
  missing.forEach(m => process.stderr.write(m + '\\n'));
  process.stderr.write('\\nExecute the missing steps before completing the session.\\n');
  process.exit(2);
}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 4: Rewrite check-debt.sh**

Replace entire file:

```bash
#!/bin/bash
# check-debt.sh — PostToolUse hook (Write|Edit)
# Warns when 3+ HIGH severity debt items are open.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/evolution/debt-register.json')) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.items) process.exit(0);

const highOpen = d.items.filter(i => i.severity === 'high' && i.status === 'open');
if (highOpen.length >= 3)
  h.warn('Debt register has ' + highOpen.length + ' open HIGH severity items. Consider addressing before proceeding.');
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 5: Rewrite stale-start-check.sh**

Replace entire file:

```bash
#!/bin/bash
# stale-start-check.sh — PostToolUse hook (Write|Edit)
# Warns if task enters implementing with stale base_commit.
set -euo pipefail

node -e "
const path = require('path');
const {execSync} = require('child_process');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/tasks\/[^/]+\.json$/.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || d.status !== 'implementing' || !d.base_commit) process.exit(0);

try {
  const head = execSync('git rev-parse HEAD', {cwd, encoding: 'utf8'}).trim();
  if (head !== d.base_commit)
    h.warn('Task ' + (d.task_id||'') + ' entering implementing with stale base_commit. base=' + d.base_commit.slice(0,8) + ' HEAD=' + head.slice(0,8));
} catch {}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 6: Rewrite integration-lane-check.sh**

Replace entire file:

```bash
#!/bin/bash
# integration-lane-check.sh — PostToolUse hook (Bash)
# Warns if git merge/rebase runs without integration lock held.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, command} = h.parseInput();
if (!cwd || !command) process.exit(0);
if (!/git\s+(merge|rebase)/.test(command)) process.exit(0);

const locks = h.readJson(path.join(h.geasDir(cwd), 'state', 'locks.json'));
if (!locks) process.exit(0);

const held = (locks.locks || []).filter(l => l.lock_type === 'integration' && l.status === 'held');
if (!held.length)
  h.warn('git merge/rebase detected but no integration lock is held. Acquire lock first.');
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 7: Verify no Python in modified hooks**

```bash
grep -l "python" plugin/hooks/scripts/verify-task-status.sh plugin/hooks/scripts/protect-geas-state.sh plugin/hooks/scripts/verify-pipeline.sh plugin/hooks/scripts/check-debt.sh plugin/hooks/scripts/stale-start-check.sh plugin/hooks/scripts/integration-lane-check.sh
```

Expected: 0 matches.

- [ ] **Step 8: Commit**

```bash
git add plugin/hooks/scripts/verify-task-status.sh plugin/hooks/scripts/protect-geas-state.sh plugin/hooks/scripts/verify-pipeline.sh plugin/hooks/scripts/check-debt.sh plugin/hooks/scripts/stale-start-check.sh plugin/hooks/scripts/integration-lane-check.sh
git commit -m "refactor(hooks): migrate 6 stateless hooks from Python to Node.js

F1 batch 1: verify-task-status, protect-geas-state, verify-pipeline,
check-debt, stale-start-check, integration-lane-check.
All use shared lib/geas-hooks.js. Python no longer required for these hooks."
```

---

### Task 7: Migrate context-injection hooks to Node.js (F1 — batch 2)

**Files:**
- Modify: `plugin/hooks/scripts/inject-context.sh`
- Modify: `plugin/hooks/scripts/restore-context.sh`
- Modify: `plugin/hooks/scripts/session-init.sh`
- Modify: `plugin/hooks/scripts/agent-telemetry.sh`

- [ ] **Step 1: Rewrite inject-context.sh**

Replace entire file:

```bash
#!/bin/bash
# inject-context.sh — SubagentStart hook
# Injects rules.md + policy overrides + per-agent memory into every sub-agent's context.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, agentType} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

const parts = [];

// Inject rules.md
const rulesPath = path.join(geas, 'rules.md');
if (h.exists(rulesPath)) {
  const content = fs.readFileSync(rulesPath, 'utf8').trim();
  if (content) {
    parts.push('--- PROJECT RULES (.geas/rules.md) ---');
    parts.push(content);
  }
}

// Inject active policy overrides
const ov = h.readJson(path.join(geas, 'state', 'policy-overrides.json'));
if (ov) {
  const active = (ov.overrides || []).filter(o => !o.expired);
  if (active.length) {
    parts.push('--- ACTIVE POLICY OVERRIDES ---');
    active.forEach(o => parts.push('- ' + (o.rule_id||'?') + ': ' + (o.action||'?') + ' (reason: ' + (o.reason||'?') + ', expires: ' + (o.expires_at||'?') + ')'));
  }
}

// Inject per-agent memory
if (agentType) {
  const memPath = path.join(geas, 'memory', 'agents', agentType + '.md');
  if (h.exists(memPath)) {
    const content = fs.readFileSync(memPath, 'utf8').trim();
    if (content) {
      parts.push('--- YOUR MEMORY (.geas/memory/agents/' + agentType + '.md) ---');
      parts.push(content);
    }
  }
}

if (parts.length) h.outputContext(parts.join('\\n\\n'));
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 2: Rewrite session-init.sh**

Replace entire file:

```bash
#!/bin/bash
# session-init.sh — SessionStart hook
# Checks .geas/ state on session start and injects context.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

const runFile = path.join(geas, 'state', 'run.json');
if (!h.exists(runFile)) {
  h.info('.geas/ directory exists but no run.json. Run setup first.');
  process.exit(0);
}

const d = h.readJson(runFile);
if (d) {
  const status = d.status || 'unknown';
  const phase = d.phase || 'unknown';
  const mission = d.mission || 'unknown';
  const completed = (d.completed_tasks || []).length;
  h.info('Session resumed. Mission: ' + mission + ' | Phase: ' + phase + ' | Status: ' + status + ' | Tasks completed: ' + completed);

  const cp = d.checkpoint || {};
  if (cp.pipeline_step) {
    const tid = d.current_task_id || '';
    h.info('Checkpoint: task=' + tid + ', step=' + cp.pipeline_step + ', agent=' + (cp.agent_in_flight || ''));
  }
}

// Create rules.md if missing
const rulesPath = path.join(geas, 'rules.md');
if (!h.exists(rulesPath)) {
  const template = '# Agent Rules\\n\\n## Evidence\\n- Write results to .geas/evidence/{task-id}/{your-name}.json as JSON\\n- Required fields: agent, task_id, summary, files_changed, created_at\\n- created_at is auto-injected by the PostToolUse hook. No manual timestamp needed.\\n\\n## Code\\n- Respect scope.paths from the TaskContract — only modify files within the declared scope\\n- Do not modify files outside the task scope\\n';
  fs.writeFileSync(rulesPath, template, 'utf8');
  h.info('Created .geas/rules.md with initial template.');
}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 3: Rewrite agent-telemetry.sh**

Replace entire file:

```bash
#!/bin/bash
# agent-telemetry.sh — SubagentStop hook
# Logs agent spawn metadata to costs.jsonl.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, agentType} = h.parseInput();
if (!cwd || !agentType) process.exit(0);

const geas = h.geasDir(cwd);
const run = h.readJson(path.join(geas, 'state', 'run.json'));
const taskId = run ? (run.current_task_id || '') : '';
const phase = run ? (run.phase || '') : '';

h.appendJsonl(path.join(geas, 'ledger', 'costs.jsonl'), {
  event: 'agent_stop', agent: agentType, task_id: taskId,
  phase: phase, timestamp: new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z')
});
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 4: Rewrite restore-context.sh**

This is the most complex hook (~180 lines of Python). Replace entire file:

```bash
#!/bin/bash
# restore-context.sh — PostCompact hook
# Re-injects critical Geas state after context compaction.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
const runFile = path.join(geas, 'state', 'run.json');
if (!fs.existsSync(geas) || !h.exists(runFile)) process.exit(0);

const d = h.readJson(runFile);
if (!d) process.exit(0);

const parts = [];
parts.push('--- GEAS STATE (restored after context compaction) ---');

const status = d.status || 'unknown';
const phase = d.phase || 'unknown';
const mission = d.mission || '';
const tid = d.current_task_id || '';
const completed = d.completed_tasks || [];

parts.push('Phase: ' + phase + ' | Status: ' + status);
parts.push('Mission: ' + mission);
parts.push('Current task: ' + tid);
const last5 = completed.slice(-5).join(', ') + (completed.length > 5 ? '...' : '');
parts.push('Completed tasks: ' + completed.length + ' (' + last5 + ')');

const cp = d.checkpoint || {};
const remaining = cp.remaining_steps || [];
if (cp.pipeline_step) parts.push('Pipeline step: ' + cp.pipeline_step);
if (cp.agent_in_flight) parts.push('Agent in flight: ' + cp.agent_in_flight);
if (remaining.length) {
  parts.push('Remaining steps: ' + remaining.join(', '));
  parts.push('NEXT STEP: ' + remaining[0]);
}

if (d.recovery_class) parts.push('Recovery class: ' + d.recovery_class);

// Task contract summary
let taskGoal = '';
if (tid) {
  const task = h.readJson(path.join(geas, 'tasks', tid + '.json'));
  if (task) {
    taskGoal = task.goal || '';
    parts.push('Task goal: ' + taskGoal);
    const criteria = task.acceptance_criteria || [];
    if (criteria.length) {
      parts.push('Acceptance criteria:');
      criteria.forEach((c, i) => parts.push('  ' + (i+1) + '. ' + c));
    }
  }
}

// Session context
const slPath = path.join(geas, 'state', 'session-latest.md');
if (h.exists(slPath)) {
  const sc = fs.readFileSync(slPath, 'utf8').trim();
  if (sc) { parts.push(''); parts.push('--- SESSION CONTEXT ---'); parts.push(sc); }
}

// Rules (first 30 lines)
const rulesPath = path.join(geas, 'rules.md');
let rulesLines = [];
if (h.exists(rulesPath)) {
  rulesLines = fs.readFileSync(rulesPath, 'utf8').split('\\n').slice(0, 30);
  parts.push(''); parts.push('--- KEY RULES ---'); parts.push(rulesLines.join('\\n').trim());
}

// Memory state
const mi = h.readJson(path.join(geas, 'state', 'memory-index.json'));
let memTotal = 0;
const memCounts = {};
if (mi && mi.entries) {
  memTotal = mi.entries.length;
  mi.entries.forEach(e => { const s = e.state || 'unknown'; memCounts[s] = (memCounts[s]||0)+1; });
}
if (memTotal > 0) {
  parts.push(''); parts.push('--- MEMORY STATE ---');
  const summary = Object.entries(memCounts).sort().map(([s,c]) => s+': '+c).join(', ');
  parts.push('Total memories: ' + memTotal + ' (' + summary + ')');
}

// L0 Anti-forgetting
parts.push(''); parts.push('## L0 ANTI-FORGETTING');
parts.push('The following items MUST be retained across compaction:');
const l0 = [];
l0.push('1. Phase: ' + phase + ' (status: ' + status + ')');
l0.push('2. Focus task: ' + (tid || '(none)') + (taskGoal ? ' — ' + taskGoal : ''));
l0.push('3. Rewind reason: ' + (d.recovery_class || '(clean session, no recovery)'));
l0.push('4. Required next artifact: ' + (remaining.length ? remaining[0] : '(pipeline complete or unknown)'));

// Open risks
let openRisks = [];
if (tid) {
  const cpkt = h.readJson(path.join(geas, 'tasks', tid, 'closure-packet.json'));
  if (cpkt && cpkt.open_risks) openRisks = cpkt.open_risks.items || [];
}
if (openRisks.length) {
  const strs = openRisks.slice(0,3).map(r => typeof r === 'object' ? (r.description || JSON.stringify(r)) : String(r));
  l0.push('5. Open risks: ' + strs.join('; '));
} else l0.push('5. Open risks: (none found)');

l0.push('6. Recovery outcome: ' + (d.recovery_class || '(clean session)'));
const ruleCount = rulesLines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
l0.push('7. Active rules: ' + ruleCount + ' lines loaded from rules.md | Memories: ' + memTotal + ' entries');

l0.forEach(item => parts.push(item));

h.outputContext(parts.join('\\n'));
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 5: Verify**

```bash
grep -l "python" plugin/hooks/scripts/inject-context.sh plugin/hooks/scripts/session-init.sh plugin/hooks/scripts/agent-telemetry.sh plugin/hooks/scripts/restore-context.sh
```

Expected: 0 matches.

- [ ] **Step 6: Commit**

```bash
git add plugin/hooks/scripts/inject-context.sh plugin/hooks/scripts/session-init.sh plugin/hooks/scripts/agent-telemetry.sh plugin/hooks/scripts/restore-context.sh
git commit -m "refactor(hooks): migrate 4 context hooks from Python to Node.js

F1 batch 2: inject-context, session-init, agent-telemetry, restore-context.
restore-context is the most complex hook (L0 anti-forgetting, session context, memory state)."
```

---

### Task 8: Migrate remaining hooks to Node.js (F1 — batch 3)

**Files:**
- Modify: `plugin/hooks/scripts/lock-conflict-check.sh`
- Modify: `plugin/hooks/scripts/memory-promotion-gate.sh`
- Modify: `plugin/hooks/scripts/memory-review-cadence.sh`
- Modify: `plugin/hooks/scripts/memory-superseded-warning.sh`
- Modify: `plugin/hooks/scripts/packet-stale-check.sh`
- Modify: `plugin/hooks/scripts/calculate-cost.sh`

- [ ] **Step 1: Rewrite lock-conflict-check.sh**

Replace entire file:

```bash
#!/bin/bash
# lock-conflict-check.sh — PostToolUse hook (Write on locks.json)
# Detects conflicting locks between tasks.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/state/locks.json')) process.exit(0);

const locks = h.readJson(filePath);
if (!locks || !locks.locks) process.exit(0);

const held = locks.locks.filter(l => l.status === 'held');
const byType = {};
held.forEach(l => { (byType[l.lock_type] = byType[l.lock_type] || []).push(l); });

const conflicts = [];
Object.entries(byType).forEach(([type, group]) => {
  for (let i = 0; i < group.length; i++) {
    for (let j = i+1; j < group.length; j++) {
      if (group[i].task_id === group[j].task_id) continue;
      const overlap = (group[i].targets||[]).filter(t => (group[j].targets||[]).includes(t));
      if (overlap.length)
        conflicts.push(type + ': ' + group[i].task_id + ' vs ' + group[j].task_id + ' on [' + overlap.join(', ') + ']');
    }
  }
});

if (conflicts.length) {
  h.warn('Lock conflicts detected:');
  conflicts.forEach(c => process.stderr.write('  ' + c + '\\n'));
}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 2: Rewrite memory-promotion-gate.sh**

Replace entire file:

```bash
#!/bin/bash
# memory-promotion-gate.sh — PostToolUse hook (Write on memory entries)
# Verifies promotion conditions for memory entries.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/memory\/entries\//.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.state) process.exit(0);

const warnings = [];
const refs = (d.evidence_refs || []).length;
const reuses = d.successful_reuses || 0;
const contradictions = d.contradiction_count || 0;

if (d.state === 'provisional' && refs < 2 && (d.evidence_count || 0) < 2)
  warnings.push('provisional requires evidence_refs >= 2 or evidence_count >= 2 (has ' + refs + ')');
if (d.state === 'stable' && (reuses < 3 || contradictions > 0))
  warnings.push('stable requires successful_reuses >= 3 AND contradiction_count == 0 (has reuses=' + reuses + ', contradictions=' + contradictions + ')');
if (d.state === 'canonical' && reuses < 5)
  warnings.push('canonical requires successful_reuses >= 5 (has ' + reuses + ')');

warnings.forEach(w => h.warn('Memory ' + (d.memory_id||'?') + ': ' + w));
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 3: Rewrite memory-review-cadence.sh**

Replace entire file:

```bash
#!/bin/bash
# memory-review-cadence.sh — SessionStart hook
# Detects memory entries past their review_after date.
set -euo pipefail

node -e "
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const mi = h.readJson(path.join(h.geasDir(cwd), 'state', 'memory-index.json'));
if (!mi || !mi.entries) process.exit(0);

const now = new Date();
const reviewable = ['provisional', 'stable', 'canonical'];
const expired = mi.entries.filter(e =>
  reviewable.includes(e.state) && e.review_after && new Date(e.review_after) < now
);

if (expired.length) {
  h.info(expired.length + ' memory entries past review date:');
  expired.slice(0, 10).forEach(e =>
    process.stderr.write('  - ' + e.memory_id + ' (' + e.state + ') due: ' + e.review_after + '\\n')
  );
  if (expired.length > 10) process.stderr.write('  ... and ' + (expired.length - 10) + ' more\\n');
  h.info('Run /geas:memorizing for batch review.');
}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 4: Rewrite memory-superseded-warning.sh**

Replace entire file:

```bash
#!/bin/bash
# memory-superseded-warning.sh — PostToolUse hook (Write on packets)
# Warns if a context packet references stale memory.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/packets\//.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const mi = h.readJson(path.join(h.geasDir(cwd), 'state', 'memory-index.json'));
if (!mi || !mi.entries) process.exit(0);

const stateMap = {};
mi.entries.forEach(e => { stateMap[e.memory_id] = e.state; });

const content = fs.readFileSync(filePath, 'utf8');
const ids = (content.match(/\\[mem-[^\\]]+\\]/g) || []).map(m => m.slice(1, -1));
const stale = ['superseded', 'under_review', 'decayed', 'archived', 'rejected'];

ids.forEach(id => {
  if (stale.includes(stateMap[id]))
    h.warn('Packet references ' + id + ' which is ' + stateMap[id] + '. Consider regenerating.');
});
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 5: Rewrite packet-stale-check.sh**

Replace entire file:

```bash
#!/bin/bash
# packet-stale-check.sh — PostToolUse hook (Write on run.json)
# Warns when context packets may be stale after recovery.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/state/run.json')) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.current_task_id || !d.recovery_class) process.exit(0);

const packetsDir = path.join(h.geasDir(cwd), 'packets', d.current_task_id);
try {
  const files = fs.readdirSync(packetsDir).filter(f => f.endsWith('.md'));
  if (files.length)
    h.warn('Recovery detected (' + d.recovery_class + '). Context packets in packets/' + d.current_task_id + '/ may be stale. Consider regenerating.');
} catch {}
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 6: Rewrite calculate-cost.sh**

Replace entire file:

```bash
#!/bin/bash
# calculate-cost.sh — Stop hook
# Aggregates token usage from subagent sessions.
set -euo pipefail

node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const h = require(path.join(__dirname, 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

// Find Claude project directory
const normalized = cwd.replace(/\\\\/g, '/').replace(/^([A-Z]):/, (m,d) => '/' + d.toLowerCase());
const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 8);
const home = process.env.HOME || process.env.USERPROFILE || '';
const base = path.join(home, '.claude', 'projects');

let projectDir = null;
try {
  const dirs = fs.readdirSync(base);
  projectDir = dirs.find(d => d.includes(hash)) ? path.join(base, dirs.find(d => d.includes(hash))) : null;
} catch { process.exit(0); }
if (!projectDir) process.exit(0);

// Find most recent session with subagents
let sessionDir = null;
try {
  const entries = fs.readdirSync(projectDir)
    .filter(f => !f.endsWith('.jsonl') && fs.statSync(path.join(projectDir, f)).isDirectory())
    .sort((a, b) => fs.statSync(path.join(projectDir, b)).mtimeMs - fs.statSync(path.join(projectDir, a)).mtimeMs);
  sessionDir = entries[0] ? path.join(projectDir, entries[0]) : null;
} catch { process.exit(0); }
if (!sessionDir) process.exit(0);

// Parse subagent JSONLs
const totals = { input: 0, output: 0, cache_create: 0, cache_read: 0 };
const byAgent = {};

try {
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'));
  for (const f of files) {
    const agentDir = path.join(sessionDir, f.replace('.jsonl', ''));
    let agentName = 'unknown';
    const meta = h.readJson(path.join(sessionDir, f.replace('.jsonl', ''), '.meta.json'));
    if (meta) agentName = meta.agent_type || meta.name || 'unknown';

    const lines = fs.readFileSync(path.join(sessionDir, f), 'utf8').split('\\n').filter(Boolean);
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        const u = d.usage || {};
        totals.input += u.input_tokens || 0;
        totals.output += u.output_tokens || 0;
        totals.cache_create += u.cache_creation_input_tokens || 0;
        totals.cache_read += u.cache_read_input_tokens || 0;

        if (!byAgent[agentName]) byAgent[agentName] = { input: 0, output: 0 };
        byAgent[agentName].input += u.input_tokens || 0;
        byAgent[agentName].output += u.output_tokens || 0;
      } catch {}
    }
  }
} catch {}

const summary = { totals, by_agent: byAgent, timestamp: new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z') };
h.writeJson(path.join(geas, 'ledger', 'token-summary.json'), summary);

const agentCount = Object.keys(byAgent).length;
h.info('Token summary: input=' + totals.input + ' output=' + totals.output + ' agents=' + agentCount);
" -- "$0" <<< "$(cat)"
```

- [ ] **Step 7: Verify no Python in any hook**

```bash
grep -rl "python" plugin/hooks/scripts/*.sh
```

Expected: 0 matches (only the 2 pure-bash checkpoint hooks remain, which never used Python).

- [ ] **Step 8: Commit**

```bash
git add plugin/hooks/scripts/lock-conflict-check.sh plugin/hooks/scripts/memory-promotion-gate.sh plugin/hooks/scripts/memory-review-cadence.sh plugin/hooks/scripts/memory-superseded-warning.sh plugin/hooks/scripts/packet-stale-check.sh plugin/hooks/scripts/calculate-cost.sh
git commit -m "refactor(hooks): migrate remaining 6 hooks from Python to Node.js

F1 batch 3: lock-conflict-check, memory-promotion-gate, memory-review-cadence,
memory-superseded-warning, packet-stale-check, calculate-cost.
All 16 Python hooks now use Node.js. Python is no longer required."
```

---

## Execution Summary

| Task | Layer | Files | Fixes |
|------|-------|-------|-------|
| 1 | 1 | 3 schemas/docs | E4, E5, E6 |
| 2 | 2 | verify-pipeline.sh | E2 |
| 3 | 2 | protect-geas-state.sh | E3 |
| 4 | 3 | orchestrating + pipeline | E1 |
| 5 | 4 | lib/geas-hooks.js (new) | F1 helper |
| 6 | 4 | 6 hooks | F1 batch 1 |
| 7 | 4 | 4 hooks | F1 batch 2 |
| 8 | 4 | 6 hooks | F1 batch 3 |

**Layer dependencies:** 1 → 2 → 3 → 4. Within Layer 4, tasks 6-8 depend on task 5.
**Re-test point:** After Task 4 (Layer 3), re-run R2 to validate classification enforcement.
