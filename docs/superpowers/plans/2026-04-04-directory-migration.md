# .geas/ Directory Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all mission-scoped artifacts from flat `.geas/` directories to `.geas/missions/{mission_id}/`, enabling concurrent mission support.

**Architecture:** Mechanical path replacement across 57 files (471 occurrences). No logic changes. All old `.geas/{type}/` paths become `.geas/missions/{mission_id}/{type}/`. Setup creates cross-mission dirs only; intake creates per-mission dirs.

**Tech Stack:** Markdown skill files, protocol documents, JSON schemas, bash hook scripts.

**Spec:** `docs/superpowers/specs/2026-04-04-directory-migration-design.md`

---

## Replacement Rules

Every task in this plan applies these rules. The subagent MUST read each file, apply ALL applicable rules, and write the file back. Do not use blind find-replace — read context to ensure correctness.

| Rule | Old pattern | New pattern | Notes |
|------|------------|-------------|-------|
| R1 | `.geas/spec/mission-{mission_id}.json` | `.geas/missions/{mission_id}/spec.json` | Also covers `mission-{n}`, `mission-{id}` variants |
| R2 | `.geas/tasks/{task-id}` | `.geas/missions/{mission_id}/tasks/{task-id}` | Covers `.json` files and `/` subdirs. Also `{task_id}` variant |
| R3 | `.geas/evidence/{task-id}` | `.geas/missions/{mission_id}/evidence/{task-id}` | Also `{task_id}` variant. Also `.geas/evidence/polishing/` → `.geas/missions/{mission_id}/evidence/polishing/` |
| R4 | `.geas/contracts/{task-id}` | `.geas/missions/{mission_id}/contracts/{task-id}` | Also `{task_id}` variant |
| R5 | `.geas/packets/{task-id}` | `.geas/missions/{mission_id}/packets/{task-id}` | Also `{task_id}` variant |
| R6 | `.geas/decisions/{dec-id}` | `.geas/missions/{mission_id}/decisions/{dec-id}` | Also `{id}`, `{dec_id}` variants. Also `decisions/pending` |
| R7 | `.geas/evolution/debt-register` | `.geas/missions/{mission_id}/evolution/debt-register` | |
| R7b | `.geas/evolution/gap-assessment` | `.geas/missions/{mission_id}/evolution/gap-assessment` | |
| R7c | `.geas/evolution/rules-update` | `.geas/missions/{mission_id}/evolution/rules-update` | |
| R8 | `.geas/evolution/phase-review-{transition}` | `.geas/missions/{mission_id}/phase-reviews/{transition}` | Directory changes from evolution/ to phase-reviews/ |
| R9 | `.geas/summaries/mission-summary` | `.geas/missions/{mission_id}/mission-summary` | |

**DO NOT change** paths under: `.geas/state/`, `.geas/memory/`, `.geas/ledger/`, `.geas/rules.md`, `.geas/recovery/`, `.geas/summaries/run-summary-*`.

**Variable naming**: Some files use `{task-id}`, others use `{task_id}`. Preserve whichever form the file already uses. Same for `{mission_id}` vs `{mission-id}`.

---

### Task 1: Setup and intake — directory creation

**Files:**
- Modify: `plugin/skills/setup/SKILL.md`
- Modify: `plugin/skills/intake/SKILL.md`

- [ ] **Step 1: Rewrite setup mkdir command**

In `plugin/skills/setup/SKILL.md`, find the mkdir line (line 19):
```bash
mkdir -p .geas/spec .geas/state .geas/state/task-focus .geas/tasks .geas/contracts .geas/packets .geas/evidence .geas/decisions .geas/decisions/pending .geas/evolution .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/memory/retro .geas/memory/incidents .geas/recovery
```

Replace with (cross-mission only):
```bash
mkdir -p .geas/state .geas/state/task-focus .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/memory/retro .geas/memory/incidents .geas/recovery
```

- [ ] **Step 2: Remove debt-register initialization from setup**

In setup/SKILL.md, find the debt-register creation block (lines 22-35, starting with "Write the initial debt register") and remove it entirely. The orchestrator creates it lazily when first needed.

- [ ] **Step 3: Update rules.md template in setup**

Find:
```
- Write results to .geas/evidence/{task-id}/{your-name}.json as JSON
```
Replace with:
```
- Write results to .geas/missions/{mission_id}/evidence/{task-id}/{your-name}.json as JSON (read mission_id from .geas/state/run.json)
```

- [ ] **Step 4: Update setup report**

Find:
```
- .geas/: initialized (spec, state, tasks, contracts, packets, evidence, decisions, ledger, summaries, memory)
```
Replace with:
```
- .geas/: initialized (state, ledger, summaries, memory, recovery)
- Mission directories will be created by intake when the mission starts.
```

- [ ] **Step 5: Update intake output path and add mission dir creation**

In `plugin/skills/intake/SKILL.md`, apply R1 to all `.geas/spec/` references. The key changes:

Find: `Ensure .geas/spec/ directory exists:` and the mkdir line.
Replace with:
```markdown
Ensure the mission directory exists:
```bash
mkdir -p .geas/missions/{mission_id}/tasks .geas/missions/{mission_id}/evidence .geas/missions/{mission_id}/contracts .geas/missions/{mission_id}/packets .geas/missions/{mission_id}/decisions/pending .geas/missions/{mission_id}/evolution .geas/missions/{mission_id}/phase-reviews
```
```

Find: `Determine the next mission ID by scanning .geas/spec/mission-*.json`
Replace with: `Determine the next mission ID by scanning .geas/missions/mission-*/ directories`

Find: `Write .geas/spec/mission-{n}.json`
Replace with: `Write .geas/missions/{mission_id}/spec.json`

Update all remaining `.geas/spec/mission-` references in the Output section to `.geas/missions/{mission_id}/spec.json`.

Find the description text: `produces an immutable mission spec file (.geas/spec/mission-{n}.json)`
Replace with: `produces an immutable mission spec file (.geas/missions/{mission_id}/spec.json)`

- [ ] **Step 6: Verify**

```bash
grep -c "\.geas/spec/" plugin/skills/setup/SKILL.md plugin/skills/intake/SKILL.md
# Expected: 0 for both

grep -c "\.geas/missions/" plugin/skills/intake/SKILL.md
# Expected: positive number
```

- [ ] **Step 7: Commit**

```bash
git add plugin/skills/setup/SKILL.md plugin/skills/intake/SKILL.md
git commit -m "feat(setup,intake): migrate to .geas/missions/ directory structure"
```

---

### Task 2: Orchestrating SKILL.md — startup and orchestration paths

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md`

- [ ] **Step 1: Read the file and apply all rules**

Read `plugin/skills/orchestrating/SKILL.md` fully. Apply rules R1-R9 to every occurrence. Key areas:
- Line 28: evidence paths → R3
- Line 70: task file reads → R2
- Lines 80-93: evolution/debt paths → R7, R7c
- Line 179: packets path → R5
- Line 195: spec path → R1

Also update the rules.md evidence template in `session-init.sh` section if referenced.

- [ ] **Step 2: Verify**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" plugin/skills/orchestrating/SKILL.md
# Expected: 0

grep -c "\.geas/missions/" plugin/skills/orchestrating/SKILL.md
# Expected: positive number
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md
git commit -m "feat(orchestrating): migrate all paths to .geas/missions/{mission_id}/"
```

---

### Task 3: Pipeline.md — per-task pipeline paths (heaviest file)

**Files:**
- Modify: `plugin/skills/orchestrating/references/pipeline.md`

This file has ~48 old path occurrences. It references tasks, evidence, contracts, packets, decisions, and evolution paths throughout the 14-step pipeline.

- [ ] **Step 1: Read the full file and apply all rules**

Read `plugin/skills/orchestrating/references/pipeline.md` in its entirety. Apply R1-R9 to every occurrence. Key patterns:
- `.geas/tasks/{task-id}` → R2 (very frequent — task contracts, sub-artifacts)
- `.geas/evidence/{task-id}/` → R3 (specialist reviews, evidence files)
- `.geas/contracts/{task-id}.json` → R4 (implementation contracts)
- `.geas/packets/{task-id}/` → R5 (context packets)
- `.geas/decisions/` → R6 (decision records)
- `.geas/evolution/` → R7/R8 (debt register — NOT phase-review, those don't appear here)

Also update `remaining_steps` JSON example and Agent() prompt strings that contain paths.

- [ ] **Step 2: Verify**

```bash
grep -cE "\.geas/(tasks|evidence|contracts|packets|decisions|evolution)/" plugin/skills/orchestrating/references/pipeline.md
# Expected: 0

grep -c "\.geas/missions/" plugin/skills/orchestrating/references/pipeline.md
# Expected: ~48 or more
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/orchestrating/references/pipeline.md
git commit -m "feat(pipeline): migrate all per-task paths to .geas/missions/{mission_id}/"
```

---

### Task 4: Orchestrating references — specifying, building, polishing, evolving

**Files:**
- Modify: `plugin/skills/orchestrating/references/specifying.md`
- Modify: `plugin/skills/orchestrating/references/building.md`
- Modify: `plugin/skills/orchestrating/references/evolving.md`
- Modify: `plugin/skills/orchestrating/references/polishing.md`

- [ ] **Step 1: specifying.md — apply R1**

The file already uses `.geas/missions/{mission_id}/` for design-brief. Apply R1 to the remaining `.geas/spec/mission-{mission_id}.json` references (Seed Check, step 3a, step 4, step 7 gate conditions).

- [ ] **Step 2: building.md — apply R2, R7, R7b, R8**

Apply rules to:
- `.geas/tasks/` → R2
- `.geas/evolution/debt-register.json` → R7
- `.geas/evolution/gap-assessment-building-to-polishing.json` → R7b
- `.geas/evolution/phase-review-building-to-polishing.json` → R8 (→ `.geas/missions/{mission_id}/phase-reviews/building-to-polishing.json`)

- [ ] **Step 3: evolving.md — apply R1, R2, R7, R7b, R7c, R8, R9**

This file has ~33 occurrences. Apply all applicable rules:
- `.geas/spec/mission-{mission_id}.json` → R1
- `.geas/tasks/` → R2
- `.geas/evolution/` → R7, R7b, R7c, R8
- `.geas/summaries/mission-summary.md` → R9

- [ ] **Step 4: polishing.md — apply R3, R7, R7b, R8**

Apply rules to:
- `.geas/evidence/` → R3
- `.geas/evolution/` → R7, R7b, R8

- [ ] **Step 5: Verify all four files**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" plugin/skills/orchestrating/references/specifying.md plugin/skills/orchestrating/references/building.md plugin/skills/orchestrating/references/evolving.md plugin/skills/orchestrating/references/polishing.md
# Expected: 0 for all four
```

- [ ] **Step 6: Commit**

```bash
git add plugin/skills/orchestrating/references/
git commit -m "feat(orchestrating): migrate specifying, building, polishing, evolving paths"
```

---

### Task 5: Core execution skills — task-compiler, scheduling, context-packet

**Files:**
- Modify: `plugin/skills/task-compiler/SKILL.md`
- Modify: `plugin/skills/scheduling/SKILL.md`
- Modify: `plugin/skills/context-packet/SKILL.md`

- [ ] **Step 1: task-compiler — apply R1, R2**

- `.geas/spec/mission-{mission_id}.json` → R1 (already has design-brief path from previous change)
- `.geas/tasks/` → R2 (output path and dependency check)

- [ ] **Step 2: scheduling — apply R2**

- `.geas/tasks/` → R2 (batch construction reads task files)

- [ ] **Step 3: context-packet — apply R1, R2, R3, R5, R6, R7**

This file reads many artifact types for context assembly. Apply all applicable rules.

- [ ] **Step 4: Verify**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" plugin/skills/task-compiler/SKILL.md plugin/skills/scheduling/SKILL.md plugin/skills/context-packet/SKILL.md
# Expected: 0 for all three
```

- [ ] **Step 5: Commit**

```bash
git add plugin/skills/task-compiler/SKILL.md plugin/skills/scheduling/SKILL.md plugin/skills/context-packet/SKILL.md
git commit -m "feat(skills): migrate task-compiler, scheduling, context-packet paths"
```

---

### Task 6: Verification pipeline skills

**Files:**
- Modify: `plugin/skills/evidence-gate/SKILL.md`
- Modify: `plugin/skills/verify-fix-loop/SKILL.md`
- Modify: `plugin/skills/implementation-contract/SKILL.md`

- [ ] **Step 1: Read each file and apply all applicable rules**

- evidence-gate: R2, R3, R6, R7
- verify-fix-loop: R2, R6
- implementation-contract: R4

- [ ] **Step 2: Verify**

```bash
grep -cE "\.geas/(tasks|evidence|contracts|decisions|evolution)/" plugin/skills/evidence-gate/SKILL.md plugin/skills/verify-fix-loop/SKILL.md plugin/skills/implementation-contract/SKILL.md
# Expected: 0 for all three
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/evidence-gate/SKILL.md plugin/skills/verify-fix-loop/SKILL.md plugin/skills/implementation-contract/SKILL.md
git commit -m "feat(skills): migrate evidence-gate, verify-fix-loop, implementation-contract paths"
```

---

### Task 7: Remaining skills batch

**Files:**
- Modify: `plugin/skills/briefing/SKILL.md` (R3, R5)
- Modify: `plugin/skills/memorizing/SKILL.md` (R2, R3)
- Modify: `plugin/skills/reporting/SKILL.md` (R7, R7b)
- Modify: `plugin/skills/run-summary/SKILL.md` (R6, R9)
- Modify: `plugin/skills/ledger-query/SKILL.md` (R1, R2, R3, R4, R5, R6, R7)
- Modify: `plugin/skills/pivot-protocol/SKILL.md` (R6)
- Modify: `plugin/skills/decision/SKILL.md` (R6)
- Modify: `plugin/skills/cleanup/SKILL.md` (R7)
- Modify: `plugin/skills/conformance-checking/SKILL.md` (R2, R3, R4, R5, R6, R7, R8)
- Modify: `plugin/skills/chaos-exercising/SKILL.md` (R2, R3, inline script paths)
- Modify: `plugin/skills/policy-managing/SKILL.md` (R7)
- Modify: `plugin/skills/vote-round/SKILL.md` (R6 if present)
- Modify: `plugin/skills/vote-round/schemas/vote-round.schema.json` (R6 in description)

- [ ] **Step 1: Read each file and apply all applicable rules**

For each file, read it, apply the rules listed in parentheses above, write it back.

- [ ] **Step 2: Verify**

```bash
grep -rlE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" plugin/skills/briefing/ plugin/skills/memorizing/ plugin/skills/reporting/ plugin/skills/run-summary/ plugin/skills/ledger-query/ plugin/skills/pivot-protocol/ plugin/skills/decision/ plugin/skills/cleanup/ plugin/skills/conformance-checking/ plugin/skills/chaos-exercising/ plugin/skills/policy-managing/ plugin/skills/vote-round/
# Expected: no output
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/briefing/ plugin/skills/memorizing/ plugin/skills/reporting/ plugin/skills/run-summary/ plugin/skills/ledger-query/ plugin/skills/pivot-protocol/ plugin/skills/decision/ plugin/skills/cleanup/ plugin/skills/conformance-checking/ plugin/skills/chaos-exercising/ plugin/skills/policy-managing/ plugin/skills/vote-round/
git commit -m "feat(skills): migrate remaining skill paths to .geas/missions/{mission_id}/"
```

---

### Task 8: Hook scripts

**Files:**
- Modify: `plugin/hooks/scripts/session-init.sh`
- Modify: `plugin/hooks/scripts/memory-superseded-warning.sh`
- Modify: `plugin/hooks/scripts/check-debt.sh` (if it references evolution/)

- [ ] **Step 1: memory-superseded-warning.sh — update packets pattern**

Find: `if (!filePath.replace(/\\\\/g,'/').includes('/.geas/packets/')) process.exit(0);`
Replace with: `if (!filePath.replace(/\\\\/g,'/').includes('/.geas/missions/')) process.exit(0);`

Note: This broadens the match to any file under missions/, but the subsequent memory-id check filters it to only packet files that reference memory IDs. This is intentional — packets are now under missions/.

- [ ] **Step 2: session-init.sh — update rules.md template**

Find the evidence path in the rules template:
```
Write results to .geas/evidence/{task-id}/{your-name}.json
```
Replace with:
```
Write results to .geas/missions/{mission_id}/evidence/{task-id}/{your-name}.json (read mission_id from .geas/state/run.json)
```

- [ ] **Step 3: check-debt.sh — update evolution path if present**

Read the file. If it references `.geas/evolution/debt-register.json`, apply R7. If it only references `.geas/state/` paths, no change needed.

- [ ] **Step 4: Verify**

```bash
grep -rE "\.geas/(tasks|evidence|contracts|packets|decisions|evolution)/" plugin/hooks/scripts/
# Expected: no output (only .geas/state/ and .geas/missions/ should remain)
```

- [ ] **Step 5: Commit**

```bash
git add plugin/hooks/scripts/
git commit -m "feat(hooks): migrate hook path patterns to .geas/missions/"
```

---

### Task 9: Protocol docs — 03, 10, 11

**Files:**
- Modify: `docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md`
- Modify: `docs/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`
- Modify: `docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`

- [ ] **Step 1: doc 03 — apply R2, R3, R4**

The task lifecycle examples reference `.geas/tasks/`, `.geas/evidence/`, `.geas/contracts/`. Apply rules to all path occurrences.

- [ ] **Step 2: doc 10 — apply R2, R3, R5**

Recovery references task files, evidence, and packets. Apply rules.

- [ ] **Step 3: doc 11 — update all artifact path columns**

doc 11 has artifact tables with Storage path columns. Update every path in every table. Key changes:
- Pipeline Artifacts: all `.geas/tasks/` → R2, `.geas/evidence/` → R3, `.geas/contracts/` → R4, `.geas/decisions/` → R6, `.geas/packets/` → R5
- Evolution Artifacts: `.geas/evolution/` → R7/R7b/R7c/R8
- Human-Readable Summaries: mission-summary → R9
- The Specifying Artifacts table (added in previous change) already has correct paths

Also update directory structure in the Artifact Purpose Highlights section if paths are mentioned.

- [ ] **Step 4: Verify**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md docs/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md
# Expected: 0 for all three
```

- [ ] **Step 5: Commit**

```bash
git add docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md docs/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md
git commit -m "docs(protocol): migrate artifact paths in docs 03, 10, 11"
```

---

### Task 10: DESIGN.md and READMEs — directory structure

**Files:**
- Modify: `docs/architecture/DESIGN.md`
- Modify: `README.md`
- Modify: `README.ko.md`

- [ ] **Step 1: DESIGN.md Section 9 — full directory structure rewrite**

Find the `.geas/` directory structure section (Section 9, around line 240). Replace the entire structure with:

```
.geas/
  state/
    run.json                 # Session state, checkpoint, remaining_steps
    locks.json               # Lock manifest
    health-check.json        # Health signal calculation results
    memory-index.json        # Memory entry index
    session-latest.md        # Post-compact recovery context
    task-focus/{task_id}.md  # Per-task focus summaries

  missions/
    {mission_id}/
      spec.json                  # Mission spec frozen at intake (immutable)
      design-brief.json          # Design brief (user-approved)
      mission-summary.md         # Mission summary
      tasks/
        {task_id}.json               # TaskContract
        {task_id}/                   # Per-task artifacts
          worker-self-check.json
          integration-result.json
          gate-result.json
          closure-packet.json
          challenge-review.json
          final-verdict.json
          retrospective.json
      evidence/
        {task_id}/
          architecture-authority-review.json
          qa-engineer.json
          product-authority-verdict.json
        polishing/
          security-engineer.json
          technical-writer.json
      contracts/
        {task_id}.json             # Implementation contracts
      packets/
        {task_id}/
          {agent_type}.md            # Role-specific context packets
      decisions/
        {dec_id}.json              # Decision records
        pending/                   # In-progress proposals
      evolution/
        debt-register.json
        gap-assessment-{transition}.json
        rules-update-{seq}.json
      phase-reviews/
        specifying-to-building.json
        building-to-polishing.json
        polishing-to-evolving.json
        evolving-to-close.json

  memory/
    _project/conventions.md
    agents/{type}.md
    candidates/{memory_id}.json
    entries/{memory_id}.json
    logs/{task_id}-{memory_id}.json
    retro/{task_id}.json
    incidents/{id}.json

  summaries/
    run-summary-{timestamp}.md

  recovery/
    recovery-{id}.json

  ledger/
    events.jsonl

  rules.md
```

Also apply rules to any other path references in DESIGN.md (artifact tables, text references).

Remove the old `spec/`, `tasks/`, `evidence/`, `contracts/`, `packets/`, `decisions/`, `evolution/` sections from the directory tree.

- [ ] **Step 2: README.md — update .geas/ structure**

Find the `.geas/` structure display (around line 93-108). Replace with the abbreviated new structure:

```
.geas/
├── state/                        # session checkpoint, locks, health signals
├── missions/
│   └── {mission_id}/
│       ├── spec.json                 # mission spec (frozen at intake)
│       ├── design-brief.json         # design brief (user-approved)
│       ├── tasks/
│       │   ├── task-001.json         # task contract
│       │   └── task-001/
│       │       ├── worker-self-check.json
│       │       ├── gate-result.json
│       │       ├── closure-packet.json
│       │       ├── challenge-review.json
│       │       ├── final-verdict.json
│       │       └── retrospective.json
│       ├── evidence/                 # specialist review evidence
│       ├── evolution/                # debt register, gap assessments
│       └── phase-reviews/            # phase transition reviews
├── memory/                       # learned patterns (candidate -> canonical)
├── ledger/                       # append-only event log
└── rules.md                      # shared conventions (grows over time)
```

- [ ] **Step 3: README.ko.md — sync structure**

Apply the same structure change as README.md, using Korean comments where the original had Korean.

- [ ] **Step 4: Verify**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" docs/architecture/DESIGN.md README.md README.ko.md
# Expected: 0 for all three
```

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/DESIGN.md README.md README.ko.md
git commit -m "docs: update directory structure in DESIGN.md and READMEs"
```

---

### Task 11: Reference docs — SKILLS.md, HOOKS.md

**Files:**
- Modify: `docs/reference/SKILLS.md`
- Modify: `docs/reference/HOOKS.md`

- [ ] **Step 1: SKILLS.md — apply all rules**

This file has ~59 occurrences. Read fully and apply R1-R9 to every path reference.

- [ ] **Step 2: HOOKS.md — apply all rules**

Read and apply rules to all path references.

- [ ] **Step 3: Verify**

```bash
grep -cE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" docs/reference/SKILLS.md docs/reference/HOOKS.md
# Expected: 0 for both
```

- [ ] **Step 4: Commit**

```bash
git add docs/reference/SKILLS.md docs/reference/HOOKS.md
git commit -m "docs: migrate paths in SKILLS.md and HOOKS.md"
```

---

### Task 12: Korean mirror docs

**Files:**
- Modify: `docs/ko/reference/SKILLS.md`
- Modify: `docs/ko/reference/HOOKS.md`
- Modify: `docs/ko/architecture/DESIGN.md`
- Modify: `docs/ko/protocol/03_TASK_MODEL_AND_LIFECYCLE.md`
- Modify: `docs/ko/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`
- Modify: `docs/ko/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`

- [ ] **Step 1: Apply same rules as English counterparts**

For each Korean file, apply the exact same path replacements as its English counterpart (Tasks 9-11). The paths are identical — only surrounding text is Korean.

- [ ] **Step 2: Verify**

```bash
grep -rlE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" docs/ko/
# Expected: no output
```

- [ ] **Step 3: Commit**

```bash
git add docs/ko/
git commit -m "docs(ko): sync Korean mirror with directory migration"
```

---

## Post-Implementation Verification

After all tasks complete:

- [ ] **Full project scan for old paths**

```bash
# Should return ZERO matches (excluding superpowers specs/plans and protocol/examples)
grep -rlE "\.geas/(spec|tasks|evidence|contracts|packets|decisions|evolution)/" plugin/ docs/ CLAUDE.md README.md README.ko.md --include="*.md" --include="*.json" --include="*.sh" | grep -v "superpowers/" | grep -v "examples/"
```

- [ ] **Verify new paths exist in key files**

```bash
grep -c "\.geas/missions/" plugin/skills/orchestrating/references/pipeline.md
# Expected: ~48+

grep -c "\.geas/missions/" plugin/skills/orchestrating/SKILL.md
# Expected: positive

grep -c "\.geas/missions/" plugin/skills/setup/SKILL.md
# Expected: 0 (setup only creates cross-mission dirs)
```

- [ ] **Verify unchanged paths are still present**

```bash
grep -c "\.geas/state/" plugin/skills/orchestrating/SKILL.md
# Expected: positive (state/ unchanged)

grep -c "\.geas/memory/" plugin/skills/memorizing/SKILL.md
# Expected: positive (memory/ unchanged)

grep -c "\.geas/rules.md" plugin/skills/orchestrating/SKILL.md
# Expected: positive (rules.md unchanged)
```
