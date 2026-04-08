# Protocol Optimization — Implementation Plan

**Date**: 2026-04-08
**Design spec**: `docs/superpowers/specs/2026-04-08-protocol-optimization-design.md`
**Total files affected**: ~90 (modify ~60, delete ~30)

---

## Step 1: Protocol Docs + Schemas + CLAUDE.md + README

**Commit message**: `docs: protocol v4 — record.json, simplified memory, CLI-only`

### 1.1 Protocol docs — English (modify 11, leave 4 unchanged)

| Doc | Change |
|-----|--------|
| 00 (Foundations) | Update artifact list, mention record.json |
| 03 (Task Model) | record.json structure, updated .geas/ layout, transition guards table, status source of truth = contract.json |
| 04 (Workspace) | Remove summaries/, task-focus/, ledger/ references |
| 05 (Gate/Vote/Verdict) | Record sections replace separate files, closure/verdict/challenge in record.json |
| 06 (Evidence Matrix) | Role-based evidence schema (implementer/reviewer/tester/authority), CLI-based evidence creation |
| 07 (Memory Overview) | Simplified 2-state model, entries/ + agents/*.md, conventions → rules.md |
| 08 (Memory Lifecycle) | Remove 9-state lifecycle, replace with draft → active |
| 09 (Memory Retrieval) | Simplify retrieval to entries/ scan + agents/ inject |
| 10 (Session Recovery) | Remove task-focus/ references, rely on run.json + record.json |
| 11 (Runtime Artifacts) | Updated directory structure, record.json schema, new CLI commands |
| 12 (Enforcement) | Updated transition guard table (6 guards), phase guard table (3 guards) |
| Unchanged | 01 (Agents), 02 (Missions), 13 (Evolution), INDEX |

### 1.1b Protocol docs — Korean mirror (same 11 files)

`docs/ko/protocol/` mirrors the same changes as English docs. Must be updated in the same commit to maintain sync.

### 1.2 Protocol schemas (new 2, delete 15)

| Action | Schema |
|--------|--------|
| **New** | `record.schema.json` — task execution record with all sections |
| **New** | `evidence.schema.json` — role-based evidence (implementer/reviewer/tester/authority) |
| **Delete** | `worker-self-check.schema.json`, `gate-result.schema.json`, `closure-packet.schema.json`, `final-verdict.schema.json`, `challenge-review.schema.json`, `integration-result.schema.json`, `retrospective.schema.json`, `implementation-contract.schema.json`, `specialist-review.schema.json`, `memory-candidate.schema.json`, `memory-application-log.schema.json`, `memory-review.schema.json`, `memory-packet.schema.json`, `memory-entry.schema.json`, `memory-index.schema.json` |

Remaining schemas: 18 (31 - 15 deleted + 2 new)

### 1.3 Protocol examples (update to match new schemas)

Update example files in `docs/protocol/examples/` to reflect record.json and simplified memory.

### 1.4 CLAUDE.md

- Project Structure: update .geas/ layout
- CLI-Only Rule: "zero exceptions" (remove worktree/agent exception)
- Skill count: 15 → 12
- Hook count: 12 → 9
- Core skills list: remove context-packet, write-prd, write-stories
- Add record.json description
- Update memory system description

### 1.5 README.md + README.ko.md

- Update feature descriptions to reflect simplified protocol
- Update skill/hook counts
- Sync both files

### 1.6 docs/architecture/DESIGN.md

- Update .geas/ directory diagram
- Update artifact flow description

---

## Step 2: CLI Modification + Tests

**Commit message**: `feat(cli): record.json, evidence add, transition guards, --file flag`

### 2.1 New commands

| Command | File | Description |
|---------|------|-------------|
| `task record add` | `src/commands/task-record.ts` (new) | Add section to record.json with --set and --file. Duplicate section = overwrite. |
| `task record get` | `src/commands/task-record.ts` (new) | Read record or section |
| `evidence add` | `src/commands/evidence.ts` (new) | Create role-based evidence file. Duplicate agent = overwrite. |
| `packet create` | `src/commands/packet.ts` (new) | Create context packet .md |
| `memory agent-note` | `src/commands/memory.ts` (modify) | Append to agents/{name}.md |
| `decision write` | `src/commands/decision.ts` (new or modify) | Write vote round result |

### 2.2 Modified commands

| Command | Change |
|---------|--------|
| `task transition` | Expand guards: 1 → 6 per-task + 3 phase |
| `task create` | Write to `tasks/{tid}/contract.json` (was `tasks/{tid}.json`), create `tasks/{tid}/evidence/` and `tasks/{tid}/packets/` subdirs |
| `mission create` | Create `decisions/`, `evolution/`, `phase-reviews/` only (was also `contracts/`, `packets/`, etc.) |
| `state update` | Add phase guard checks |
| `mission write-spec` | Add `--file` flag |
| `mission write-brief` | Add `--file` flag |
| All `--data` commands | Add `--file` alternative |

### 2.3 Deleted commands

| Command | Replacement |
|---------|------------|
| `task verdict` | `task record add --section verdict` |
| `task self-check` | `task record add --section self_check` |
| `task closure` | `task record add --section closure` |
| `task contract` | `task record add --section implementation_contract` |
| `evidence record` | `evidence add` |

### 2.3b Unchanged commands

| Command | Notes |
|---------|-------|
| `lock acquire/release` | No changes needed |
| `context read` | No changes needed |
| `recovery create/read` | No changes needed |

### 2.4 Schema updates in CLI

- Copy new `record.schema.json`, `evidence.schema.json` to `plugin/cli/schemas/`
- Copy updated `memory-entry.schema.json`
- Delete schemas for removed artifact types
- Run `npm run copy-schemas` after protocol schema changes

### 2.5 Transition guards (`transition-guards.ts`)

```typescript
// 6 per-task guards
'drafted->ready':       checkContractExists(taskDir)
'ready->implementing':  checkRecordSection(taskDir, 'implementation_contract', {status: 'approved'})
'implementing->reviewed': checkRecordSection(taskDir, 'self_check') && checkEvidenceExists(taskDir, 'implementer')
'reviewed->integrated': checkRecordSection(taskDir, 'gate_result', {verdict: 'pass'}) && checkEvidenceRole(taskDir, ['reviewer', 'tester'])
'integrated->verified': pass
'verified->passed':     checkRecordSection(taskDir, 'verdict', {verdict: 'pass'}) && checkRecordSection(taskDir, 'closure') && checkRecordSection(taskDir, 'retrospective') && checkChallengeReview(taskDir, riskLevel)
```

### 2.6 Phase guards (`phase-guards.ts`)

```typescript
'building->polishing':  allTasksPassed(missionDir)
'polishing->evolving':  hasSecurityReviewOrDebt(missionDir)
'evolving->complete':   hasGapAssessmentOrSummary(missionDir)
```

### 2.7 Tests (`test/integration.js`)

Add test phases:
- Phase: record.json operations (add section, get section, get full, --file flag)
- Phase: evidence add (each role, missing required fields)
- Phase: transition guards (each of 6 transitions, blocked + allowed)
- Phase: phase guards (each of 3 phase transitions)
- Phase: packet create
- Phase: memory agent-note, memory add
- Update existing tests for new paths (contract.json location change)

### 2.8 Build verification

```bash
npm run typecheck
npm run build
node plugin/cli/test/integration.js
```

---

## Step 3: Skill Modification + plugin.json

**Commit message**: `refactor(skills): remove schemas, CLI commands, delete unused skills`

### 3.1 Delete skills (3 entire directories)

```
plugin/skills/write-prd/          (unused stub)
plugin/skills/write-stories/      (unused stub)
plugin/skills/context-packet/     (absorbed into mission skill)
```

### 3.2 Delete all skill-local schemas (27 files across 12 directories)

```bash
rm -rf plugin/skills/*/schemas/
```

### 3.3 Modify skill SKILL.md files (12 files)

| Skill | Changes |
|-------|---------|
| mission/SKILL.md | Absorb context-packet logic, use CLI commands for all state writes, reference record.json |
| mission/references/pipeline.md | Replace per-file artifact instructions with `geas task record add` commands |
| mission/references/building.md | Update task lifecycle references |
| mission/references/polishing.md | Update artifact references |
| mission/references/evolving.md | Update artifact references, simplified memory |
| mission/references/specifying.md | Update artifact references |
| intake/SKILL.md | Remove schema references |
| task-compiler/SKILL.md | Update task contract path (tasks/{tid}/contract.json) |
| implementation-contract/SKILL.md | Reference record.json section instead of separate file |
| evidence-gate/SKILL.md | Reference record.json gate_result section |
| verify-fix-loop/SKILL.md | Update artifact references |
| vote-round/SKILL.md | Remove schema references |
| memorizing/SKILL.md | Simplified to rules.md + agents/*.md, no entries/ or index |
| scheduling/SKILL.md | Remove schema references |
| setup/SKILL.md | New .geas/ directory structure (see 3.4) |
| policy-managing/SKILL.md | rules.md now includes conventions |
| reporting/SKILL.md | Update artifact paths |

### 3.4 Setup skill — new .geas/ directory structure

```bash
# Before
mkdir -p .geas/state .geas/state/task-focus .geas/ledger .geas/summaries \
  .geas/memory/_project .geas/memory/agents .geas/memory/candidates \
  .geas/memory/entries .geas/memory/logs .geas/memory/retro \
  .geas/memory/incidents .geas/recovery

# After
mkdir -p .geas/state .geas/memory/agents .geas/recovery
```

13 directories → 4 directories. Setup also:
- Creates rules.md (conventions + rules unified, no separate conventions.md)
- Removes conventions.md creation
- Removes task-focus/ initialization

### 3.5 plugin.json

- Remove write-prd, write-stories, context-packet from skills list
- Version bump

---

## Step 4: Hook Modification

**Commit message**: `refactor(hooks): delete agent-telemetry, update paths`

### 4.1 Delete (3 hooks)

```
plugin/hooks/scripts/agent-telemetry.sh        (non-core telemetry)
plugin/hooks/scripts/memory-promotion-gate.sh   (9-state model removed)
plugin/hooks/scripts/memory-superseded-warning.sh (superseded/decayed states removed)
```

### 4.2 Modify hooks.json

- Remove 3 deleted hooks from registration

### 4.3 Modify hook scripts (4 hooks)

| Hook | Change |
|------|--------|
| inject-context.sh | Update memory path references (no _project/, agents/ are .md now) |
| session-init.sh | Update .geas/ directory checks (no summaries/, task-focus/, ledger/) |
| restore-context.sh | Update state restoration (no task-focus/) |
| packet-stale-check.sh | Update packet paths (missions/{mid}/packets/ → tasks/{tid}/packets/) |

Leave unchanged: calculate-cost.sh, checkpoint-pre-write.sh, checkpoint-post-write.sh, integration-lane-check.sh, protect-geas-state.sh

---

## Step 5: Agent.md Modification

**Commit message**: `feat(agents): add evidence and memory self-management rules`

### 5.1 Add to all 14 agent .md files

Each agent gets a `## Before Exiting` section with:
1. Evidence CLI command (role-specific)
2. Memory update CLI command

### 5.2 Role mapping

| Agent | Role | Evidence command |
|-------|------|-----------------|
| software-engineer | implementer | `geas evidence add --role implementer --set "files_changed=..."` |
| platform-engineer | implementer | same |
| research-engineer | implementer | same |
| design-authority | reviewer | `geas evidence add --role reviewer --set "verdict=..." --set "concerns=..."` |
| qa-engineer | tester | `geas evidence add --role tester --set "verdict=..." --set "criteria_results=..."` |
| security-engineer | reviewer | `geas evidence add --role reviewer --set "verdict=..." --set "concerns=..."` |
| product-authority | authority | `geas evidence add --role authority --set "verdict=..." --set "rationale=..."` |
| challenger | reviewer | `geas evidence add --role reviewer --set "verdict=..." --set "concerns=..." --set "blocking=..."` |
| technical-writer | implementer | same |
| research-writer | implementer | same |
| research-analyst | reviewer | same as reviewer |
| literature-analyst | reviewer | same as reviewer |
| methodology-reviewer | reviewer | same as reviewer |
| research-integrity-reviewer | reviewer | same as reviewer |

---

## Step 6: Reference Docs Update

**Commit message**: `docs: update SKILLS.md, HOOKS.md, DESIGN.md references`

### 6.1 docs/reference/SKILLS.md

- Remove write-prd, write-stories, context-packet
- Update skill descriptions for record.json pattern
- Update count: 15 → 12

### 6.2 docs/reference/HOOKS.md

- Remove agent-telemetry.sh, memory-promotion-gate.sh, memory-superseded-warning.sh
- Update hook descriptions
- Update count: 12 → 9

### 6.3 docs/architecture/DESIGN.md

- Update .geas/ directory diagram
- Update artifact flow
- Update CLI command reference

---

## Summary

| Step | Files modified | Files deleted | Commit |
|------|---------------|---------------|--------|
| 1. Docs + schemas + CLAUDE.md + README | ~42 (22 EN + 11 KO + 5 CLAUDE/README + 4 arch/ref) | ~13 schemas + ~3 examples | `docs: protocol v4` |
| 2. CLI | ~15 | ~5 command files | `feat(cli): record.json, guards` |
| 3. Skills + plugin.json | ~17 | ~30 (3 skills + 27 schemas) | `refactor(skills): simplify` |
| 4. Hooks | ~4 | 3 | `refactor(hooks): cleanup` |
| 5. Agents | 14 | 0 | `feat(agents): self-management` |
| 6. Reference docs | 3 | 0 | `docs: update references` |
| **Total** | **~95** | **~54** | **6 commits** |
