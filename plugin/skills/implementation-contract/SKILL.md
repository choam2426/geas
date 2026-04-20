---
name: implementation-contract
description: Pre-implementation agreement — the implementer proposes a concrete plan, reviewers approve before any code is written. Prevents wasted cycles caused by misunderstood requirements.
---

# Implementation Contract

Before an `implementing` state entry, the implementer states "what I will do" and the key reviewers agree to it. This catches scope/requirement mismatches before they become rework.

## When to Use

Orchestrator invokes this skill right after the task transitions `ready`. It runs once per task, before the first evidence write. Amendments during implementation are handled by the same skill (see Amendment Flow below).

## Inputs

1. **Task contract** — `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` (goal, acceptance criteria, surfaces, verification_plan, risk_level).
2. **Mission spec and mission-design** — for project-wide context the implementer must honor.
3. **Memory** — `.geas/memory/shared.md`, `.geas/memory/agents/{agent_type}.md` (prior lessons).
4. **Supersede chain** — if `supersedes` is non-null, read the prior task's closure evidence to avoid repeating the same mistake.

## Artifact

The approved plan lives at:

```
.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json
```

Schema: `implementation-contract` — `summary`, `rationale`, `change_scope`, `planned_actions`, `non_goals`, `alternatives_considered`, `assumptions`, `open_questions`.

## Flow

### Step 1 — Implementer drafts

Spawn the primary worker (from `routing.primary_worker_type`) with the task contract and mission context. The implementer returns a JSON object that populates the implementation-contract schema.

Contract body must be honest about:

- **planned_actions** — concrete steps, specific enough that a reviewer can inspect them.
- **change_scope** — files/surfaces/modules that will change (must stay inside `contract.surfaces`).
- **non_goals** — things the implementer explicitly will NOT do, even if tempting.
- **open_questions** — every ambiguity the implementer has, not a sanitized subset.

The orchestrator runs the CLI:

```bash
geas impl-contract set --mission {mission_id} --task {task_id} <<'EOF'
<implementation_contract_json>
EOF
```

(Note: `impl-contract set` is the canonical CLI surface per CLI.md §3; the current bundle exposes `self-check set` and `evidence append` separately. Implementers writing the contract through orchestrator tooling should use the CLI surface registered for this purpose.)

### Step 2 — Reviewer concurrence

For each slot in `routing.required_reviewers`, spawn the concrete agent and ask: "read the implementation contract above, state whether it would satisfy the task contract you just inspected. Record your view as a review-kind evidence entry."

Each reviewer writes evidence under their slot:

```bash
geas evidence append --mission {mission_id} --task {task_id} \
    --agent {concrete_agent} --slot {slot} <<'EOF'
{
  "evidence_kind": "review",
  "summary": "implementation-contract review",
  "verdict": "approved" | "changes_requested" | "blocked",
  "concerns": [...],
  "rationale": "...",
  "scope_examined": "implementation-contract.json",
  "methods_used": ["read contract", "mapped to acceptance criteria"],
  "scope_excluded": []
}
EOF
```

The CLI enforces agent-slot independence: whoever takes `implementer` on this task cannot also hold a reviewer or verifier slot here. If the same concrete agent covers multiple reviewer slots (e.g. security-engineer as both `risk-assessor` and `operator`), they write separate evidence files per slot.

### Step 3 — Resolve

- **All reviewers `approved`** → orchestrator moves the task to `implementing` (`geas task transition --to implementing`). The implementer may now write code and append an `implementation`-kind evidence entry.
- **Any `changes_requested`** → return the concerns to the implementer. They update the implementation-contract and resubmit. One revision cycle is the default budget.
- **Any `blocked`** → the plan as stated cannot proceed. The orchestrator either (a) escalates to decision-maker if the block is structural, or (b) opens a task-level deliberation if reviewers disagree on whether the plan is workable.

### Step 4 — First evidence entry

Once the implementation-contract is approved and the task enters `implementing`, the implementer writes their first evidence entry (kind `implementation`) referencing what they actually did. The self-check follows at the end of the implementation phase (see `self-check set`).

## Amendment Flow

Approved contract + discovered reality mismatch → amend rather than restart. Material changes that trigger amendment:

1. The plan needs to touch something outside `change_scope`.
2. An acceptance criterion reveals itself as wrong or underspecified.
3. `risk_level` rose because of what the implementer found.
4. A new external dependency appears.
5. An item from `non_goals` must come in-scope to satisfy an acceptance criterion.

### Process

1. Implementer pauses coding.
2. Implementer appends a new implementation-kind evidence entry with the amendment details (summary = "amendment proposal", revision_ref pointing at the prior implementation entry).
3. Risk-assessor (and design-authority if structural) review the amendment via a new review-kind evidence entry.
4. On approval, implementer resumes. On rejection, task may need to enter `blocked` or escalate.

Amendments never overwrite prior entries — everything append-only. The evidence history shows the full plan trajectory for anyone reading later.

## Rules

1. Every task gets an implementation-contract. No skipping for "simple" tasks — the friction of stating the plan catches the ambiguity that causes rework.
2. `non_goals` is mandatory content, not a courtesy. Undeclared scope is the top source of "why did you also change that file" review cycles.
3. `open_questions` must be stated plainly. Implementers silently picking an interpretation of an ambiguous requirement is the anti-pattern this skill exists to prevent.
4. One revision cycle default. If reviewers still disagree after one round, escalate to task-level deliberation rather than loop again.
5. Amendments during `implementing` require reviewer concurrence BEFORE resuming code changes.
