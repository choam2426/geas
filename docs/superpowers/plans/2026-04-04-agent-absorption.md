# Agent Absorption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repository-manager and process-lead agents, absorbing their responsibilities into the orchestrator. Agent count 12 → 10.

**Architecture:** Replace agent spawns with direct orchestrator execution. No pipeline step removal — Resolve and Retrospective remain as steps, just executed directly instead of via subagent.

**Tech Stack:** Markdown skill files, protocol documents, JSON plugin manifest.

**Spec:** `docs/superpowers/specs/2026-04-04-agent-absorption-design.md`

---

### Task 1: Delete agent files and update plugin.json

**Files:**
- Delete: `plugin/agents/repository-manager.md`
- Delete: `plugin/agents/process-lead.md`
- Modify: `plugin/plugin.json`

- [ ] **Step 1: Delete agent files**

```bash
rm plugin/agents/repository-manager.md plugin/agents/process-lead.md
```

- [ ] **Step 2: Update plugin.json agents array**

In `plugin/plugin.json`, remove these two lines from the `"agents"` array:
```json
    "./agents/process-lead.md",
    "./agents/repository-manager.md",
```

- [ ] **Step 3: Verify agent count**

```bash
ls plugin/agents/*.md | wc -l
# Expected: 10
```

- [ ] **Step 4: Commit**

```bash
git add -u plugin/agents/ && git add plugin/plugin.json
git commit -m "feat: remove repository-manager and process-lead agents (12 → 10)"
```

---

### Task 2: Rewrite pipeline.md Resolve and Retrospective steps

**Files:**
- Modify: `plugin/skills/orchestrating/references/pipeline.md`

- [ ] **Step 1: Rewrite Resolve Ship section**

Find (around line 385-389):
```markdown
- **Ship**: Read `.geas/missions/{mission_id}/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn repository_manager for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "repository-manager"
  ```
  Agent(agent: "repository-manager", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/missions/{mission_id}/evidence/{task-id}/repository-manager.json")
  ```
```

Replace with:
```markdown
- **Ship**: Read `.geas/missions/{mission_id}/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then commit directly:
  Update run.json checkpoint: `pipeline_step` = "resolve"
  ```bash
  git add -A && git commit -m "{conventional commit message for task-id}"
  ```
  Log: `{"event": "task_resolved", "task_id": "{task-id}", "commit": "{hash from git rev-parse HEAD}", "timestamp": "<actual>"}`
```

- [ ] **Step 2: Rewrite Retrospective section**

Find (around line 393-415):
```markdown
### Retrospective (process-lead) [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update run.json checkpoint: `pipeline_step` = "retrospective", `agent_in_flight` = "process-lead"
```
Agent(agent: "process-lead", prompt: "Read all evidence at .geas/missions/{mission_id}/evidence/{task-id}/ and the closure packet at .geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json. Write a structured retrospective to .geas/missions/{mission_id}/tasks/{task-id}/retrospective.json with the following structure. Required fields:
- version: '1.0'
- artifact_type: 'retrospective'
- artifact_id: 'retro-{task-id}'
- producer_type: 'process_lead'
- task_id: '{task-id}'
- what_went_well: things that worked in this task
- what_broke: problems encountered during implementation, review, or gate
- what_was_surprising: unexpected findings or outcomes
- rule_candidates: proposed changes to rules.md (DO NOT modify rules.md directly — list proposals here)
- memory_candidates: lessons worth remembering for future tasks
- debt_candidates: new technical debt discovered during retrospective review
- next_time_guidance: specific advice for similar future tasks
- created_at: ISO 8601 timestamp")
```

Verify `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` exists.
```

Replace with:
```markdown
### Retrospective [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update run.json checkpoint: `pipeline_step` = "retrospective"

Orchestrator reads all evidence at `.geas/missions/{mission_id}/evidence/{task-id}/` and the closure packet at `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json`. Then writes `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json`:

```json
{
  "version": "1.0",
  "artifact_type": "retrospective",
  "artifact_id": "retro-{task-id}",
  "producer_type": "orchestration_authority",
  "task_id": "{task-id}",
  "what_went_well": ["things that worked in this task"],
  "what_broke": ["problems encountered during implementation, review, or gate"],
  "what_was_surprising": ["unexpected findings or outcomes"],
  "rule_candidates": ["proposed changes to rules.md — DO NOT modify rules.md directly"],
  "memory_candidates": ["lessons worth remembering for future tasks"],
  "debt_candidates": ["new technical debt discovered during retrospective review"],
  "next_time_guidance": ["specific advice for similar future tasks"],
  "created_at": "<ISO 8601>"
}
```

Verify `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` exists.
```

- [ ] **Step 3: Verify no remaining references**

```bash
grep -c "repository-manager\|process-lead" plugin/skills/orchestrating/references/pipeline.md
# Expected: 0
```

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/orchestrating/references/pipeline.md
git commit -m "feat(pipeline): absorb repository-manager and process-lead into orchestrator"
```

---

### Task 3: Rewrite evolving.md references

**Files:**
- Modify: `plugin/skills/orchestrating/references/evolving.md`

- [ ] **Step 1: Update Rules Update Approval producer_type**

Find (around line 72):
```
     "producer_type": "process_lead",
```
Replace with:
```
     "producer_type": "orchestration_authority",
```

- [ ] **Step 2: Rewrite Repository-manager Release Management section**

Find (around lines 189-193):
```markdown
### Repository-manager Release Management [MANDATORY]
```
Agent(agent: "repository-manager", prompt: "Create release: version bump, changelog from .geas/ledger/events.jsonl, final commit. Write to .geas/missions/{mission_id}/evidence/evolving/repository-manager-release.json")
```
Verify `.geas/missions/{mission_id}/evidence/evolving/repository-manager-release.json` exists.
```

Replace with:
```markdown
### Release Management [MANDATORY]

Orchestrator runs release directly:
1. Determine version bump (from gap-assessment and debt status)
2. Generate changelog from `.geas/ledger/events.jsonl`
3. Commit version bump and changelog
4. Tag release with semantic version
5. Log: `{"event": "release_created", "version": "...", "timestamp": "<actual>"}`
```

- [ ] **Step 3: Verify**

```bash
grep -c "repository-manager\|process-lead\|process_lead" plugin/skills/orchestrating/references/evolving.md
# Expected: 0
```

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/orchestrating/references/evolving.md
git commit -m "feat(evolving): absorb repository-manager and process-lead into orchestrator"
```

---

### Task 4: Update orchestrating/SKILL.md

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md`

- [ ] **Step 1: Replace git rules section**

Find (around lines 96-98):
```markdown
### Git operations
- **All git operations (commit, branch, PR) must be done by repository_manager.** Do not commit or manage branches directly.
- Spawn repository_manager at task Resolve for commits, and at Evolving for release management.
```

Replace with:
```markdown
### Git operations
- Orchestrator handles all git operations directly (commit, branch, tag).
- Use conventional commit format at Resolve: `feat:`, `fix:`, `refactor:`, etc.
- Release management (version bump, tag, changelog) at Evolving.
```

- [ ] **Step 2: Update role boundaries**

Find (around lines 100-103):
```markdown
### Your role boundaries
- Orchestrate only. Specialist agents implement all code, including bug fixes.
- All git operations go through repository_manager (commits, branches, PRs).
- Follow the protocol of the 4-phase execution flow completely.
```

Replace with:
```markdown
### Your role boundaries
- Orchestrate only. Specialist agents implement all code, including bug fixes.
- Orchestrator handles git and retrospectives directly (no agent spawn needed).
- Follow the protocol of the 4-phase execution flow completely.
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md
git commit -m "feat(orchestrating): update git and role boundary rules for agent absorption"
```

---

### Task 5: Update scheduling and other skill references

**Files:**
- Modify: `plugin/skills/scheduling/SKILL.md`
- Modify: `plugin/skills/memorizing/SKILL.md`
- Modify: `plugin/skills/reporting/SKILL.md`
- Modify: `plugin/skills/chaos-exercising/SKILL.md`

- [ ] **Step 1: scheduling.md**

Find (line 91):
```
When a task's pipeline finishes (repository_manager commits, retro done):
```
Replace with:
```
When a task's pipeline finishes (orchestrator commits, retro done):
```

- [ ] **Step 2: Other skills**

Read each file. Replace any `process_lead` or `repository_manager` agent references with `orchestration_authority` where they refer to who produces the artifact. Keep enum values in schemas unchanged.

- [ ] **Step 3: Verify**

```bash
grep -rl "repository.manager\|process.lead" plugin/skills/ --include="*.md" | grep -v "write-prd\|write-stories"
# Expected: no output
```

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/
git commit -m "feat(skills): update agent references for absorption"
```

---

### Task 6: Update protocol docs

**Files:**
- Modify: `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
- Modify: `docs/protocol/06_SPECIALIST_EVIDENCE_MATRIX.md`
- Modify: `docs/protocol/08_EVOLVING_MEMORY_LIFECYCLE.md`

- [ ] **Step 1: doc 01 — remove two agent type definitions**

In `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`:
- Remove the `### repository_manager` section entirely
- Remove the `### process_lead` section entirely
- Update the decision boundary table: remove rows referencing these types, update "durable memory promotion" to use `orchestration_authority` instead of `process_lead + endorsing authority`

- [ ] **Step 2: doc 06 — remove repository_manager row**

In the specialist evidence matrix, remove the repository_manager row.

- [ ] **Step 3: doc 08 — change process_lead to orchestration_authority**

Replace `process_lead` references with `orchestration_authority` where they describe who performs memory promotion reviews.

- [ ] **Step 4: Verify**

```bash
grep -c "repository_manager\|process_lead" docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md docs/protocol/06_SPECIALIST_EVIDENCE_MATRIX.md docs/protocol/08_EVOLVING_MEMORY_LIFECYCLE.md
# Expected: 0 for all three
```

- [ ] **Step 5: Commit**

```bash
git add docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md docs/protocol/06_SPECIALIST_EVIDENCE_MATRIX.md docs/protocol/08_EVOLVING_MEMORY_LIFECYCLE.md
git commit -m "docs(protocol): remove repository_manager and process_lead from protocol docs"
```

---

### Task 7: Update documentation — DESIGN.md, CLAUDE.md, READMEs, AGENTS.md

**Files:**
- Modify: `docs/architecture/DESIGN.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `README.ko.md`
- Modify: `docs/reference/AGENTS.md`

- [ ] **Step 1: DESIGN.md**

- Replace "12 agent types" with "10 agent types" wherever it appears
- Update plugin structure if it lists agent files
- Remove repository-manager and process-lead from any agent listing

- [ ] **Step 2: CLAUDE.md**

- Replace "12 agent definitions" with "10 agent definitions"

- [ ] **Step 3: README.md**

- Replace "12 agent types" with "10 agent types"
- Remove "Repository Manager" from the specialist roles list if present

- [ ] **Step 4: README.ko.md**

- Sync with README.md changes

- [ ] **Step 5: AGENTS.md**

- Remove repository-manager and process-lead descriptions from `docs/reference/AGENTS.md`

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/DESIGN.md CLAUDE.md README.md README.ko.md docs/reference/AGENTS.md
git commit -m "docs: update agent count 12 → 10 across all documentation"
```

---

### Task 8: Korean mirror docs

**Files:**
- Modify: `docs/ko/reference/AGENTS.md`
- Modify: `docs/ko/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
- Modify: `docs/ko/protocol/06_SPECIALIST_EVIDENCE_MATRIX.md`
- Modify: `docs/ko/protocol/08_EVOLVING_MEMORY_LIFECYCLE.md`
- Modify: `docs/ko/architecture/DESIGN.md`

- [ ] **Step 1: Apply same changes as English counterparts**

- [ ] **Step 2: Verify**

```bash
grep -rl "repository_manager\|process_lead" docs/ko/ --include="*.md"
# Expected: no output
```

- [ ] **Step 3: Commit**

```bash
git add docs/ko/
git commit -m "docs(ko): sync Korean mirror for agent absorption"
```

---

## Post-Implementation Verification

- [ ] **No agent references remain**

```bash
grep -rl "repository.manager\|process.lead\|process_lead\|repository_manager" plugin/ docs/ CLAUDE.md README.md README.ko.md --include="*.md" --include="*.json" | grep -v "superpowers/" | grep -v "examples/" | grep -v "_defs.schema" | grep -v "retrospective.schema"
# Expected: no output
```

- [ ] **Agent file count**

```bash
ls plugin/agents/*.md | wc -l
# Expected: 10
```

- [ ] **plugin.json agent entries**

```bash
grep -c "agents/" plugin/plugin.json
# Expected: 10
```
