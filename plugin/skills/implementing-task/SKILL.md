---
name: implementing-task
description: Invoked by a spawned implementer after the orchestrator dispatches an approved, dependency-satisfied task. Produces the implementation plan, coordinates one-round reviewer concurrence on the plan, implements per the approved plan, and appends implementation evidence plus the self-check via the CLI.
user-invocable: false
---

# Implementing Task

## Overview

You have been spawned as the implementer for an approved task. Before writing code, state the concrete plan (implementation-contract shape) and get reviewer concurrence on the plan. Only after plan approval do you transition to `implementing`, make the changes, and close out with implementation evidence + a self-check entry. Amendments during implementation go through the same concurrence loop.

<HARD-GATE> Every task gets an implementation-contract; there is no "simple task" shortcut. The CLI is the sole writer to `.geas/`. The same concrete agent cannot hold implementer and reviewer/verifier on the same task. `non_goals` and `open_questions` are mandatory, not decorative.

## When to Use

- The orchestrator has dispatched you for a task in `ready` (first run) or in the verify-fix loop (revision run) state.
- You have access to the task contract, the mission spec + mission design, and shared + agent memory.
- Do NOT run when the task is still in `drafted` — wait for approval.
- Do NOT run to "review" or "verify" — those are different spawned skills.

## Preconditions

- `task-state.status == ready` on first run, or `task-state.status == implementing` on a verify-fix revision.
- Task contract exists under `missions/{mission_id}/tasks/{task_id}/contract.json` with `approved_by` set.
- Mission spec is `user_approved: true` for specifying-phase tasks; `approved_by: decision-maker` for mid-mission scope-in tasks.
- `base_snapshot` still matches the real workspace (if not, return to orchestrator to rebase).
- If `supersedes` is non-null, you have read the prior task's closure evidence.

## Process

1. **Read everything in your lane.** Contract, mission spec, mission design (if present), `shared.md`, `agents/{your_agent_type}.md`, any prior evidence on this task (revisions), and the supersedes chain if present.
2. **Draft the implementation plan** as an `implementation-contract` payload:
   ```json
   {
     "summary": "...",
     "rationale": "...",
     "change_scope": ["<surface>", "..."],
     "planned_actions": ["step 1", "step 2", "..."],
     "non_goals": ["...", "..."],
     "alternatives_considered": ["..."],
     "assumptions": ["..."],
     "open_questions": ["..."]
   }
   ```
   - `change_scope` must stay inside `contract.surfaces`.
   - `planned_actions` must be specific enough for a reviewer to inspect.
   - `non_goals` names things tempting but out of scope.
   - `open_questions` names every real ambiguity; do not silently pick an interpretation.
   Record via the CLI surface the orchestrator registered for this purpose (currently `geas self-check set` captures the equivalent pre-work envelope; if `geas impl-contract set` is registered in this environment, use it).
3. **Wait for one-round reviewer concurrence.** The orchestrator spawns each reviewer in `routing.required_reviewers` to run `reviewing-task` against your plan. Each reviewer appends a review-kind evidence entry with verdict `approved` / `changes_requested` / `blocked`.
   - All `approved` → proceed to step 5.
   - Any `changes_requested` → go to step 4.
   - Any `blocked` → halt; orchestrator either escalates to decision-maker (structural) or opens a task-level deliberation via `convening-deliberation`.
4. **Revise once.** Incorporate the concerns, append a new `implementation`-kind evidence entry with `summary: "amendment proposal"` and `revision_ref` to the prior plan entry, and request a fresh review round. If reviewers still disagree after one revision, escalate rather than loop; the orchestrator opens a task-level deliberation.
5. **Transition to `implementing`.** The orchestrator calls `geas task transition --to implementing`. The CLI increments `verify_fix_iterations` on rewind (not first entry).
6. **Do the work per the approved plan.** Stay inside `change_scope`. If reality forces a material deviation (plan needs to touch outside `change_scope`, a criterion is wrong, risk rose, new dependency appeared, a non-goal must come in-scope), pause and amend via step 4.
7. **Append implementation evidence.**
   ```bash
   geas evidence append --mission {mission_id} --task {task_id} \
       --agent {your_concrete_agent} --slot implementer <<'EOF'
   {
     "evidence_kind": "implementation",
     "summary": "what you did",
     "concerns": [...],
     "rationale": "...",
     "scope_examined": "<surfaces touched>",
     "methods_used": ["..."],
     "revision_ref": null
   }
   EOF
   ```
   On a revision run, set `revision_ref` to the prior `evidence_id`.
8. **Write the self-check.**
   ```bash
   geas self-check set --mission {mission_id} --task {task_id} <<'EOF'
   {
     "confidence": 1-5,
     "acceptance_criteria_status": [{"criterion": "...", "status": "met|unmet|partial", "note": "..."}],
     "surprises": "...",
     "remaining_risks": ["..."]
   }
   EOF
   ```
   Self-check must cover every acceptance criterion. Honest confidence — do not inflate.
9. **Return.** The orchestrator now moves the task to `reviewed` and runs `running-gate`.

## Red Flags

| Excuse | Reality |
|---|---|
| "This task is trivial — skip the plan and just code" | The plan catches the ambiguity that causes rework. Friction is the point. |
| "I'll leave `non_goals` empty since it's self-evident" | Undeclared scope is the top source of "why did you change that too" review cycles. |
| "I'll pick a reasonable interpretation of the ambiguous requirement silently" | `open_questions` exists to surface exactly that. Silent interpretation is the anti-pattern this skill prevents. |
| "I'll inflate self-check confidence to look decisive" | Gate reads honest self-check; inflated confidence corrupts downstream memory extraction. |
| "I'll amend the plan after the fact in the same entry" | Amendments are append-only new entries with `revision_ref`. Overwriting breaks the trajectory audit. |
| "I'll also review my own work to save a round" | CLI enforces agent-slot independence. Implementer cannot hold reviewer or verifier on the same task. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas self-check set --mission <id> --task <id>` | Record pre-work plan envelope (and end-of-work self-check). |
| `geas evidence append --slot implementer --agent <concrete> --mission <id> --task <id>` | Append implementation-kind evidence (initial + revisions + amendments). |
| `geas task transition --to implementing` | Orchestrator-invoked; triggers CLI's `verify_fix_iterations` bookkeeping. |
| `geas task transition --to reviewed` | Orchestrator-invoked once implementation evidence + self-check are present. |

Sub-skills you do NOT invoke: `reviewing-task` (reviewers run it), `verifying-task` (verifier runs it), `running-gate` (orchestrator invokes after you return).

## Outputs

- One `implementation-contract.json` payload (via the registered CLI surface) before any code.
- One or more `implementation`-kind evidence entries (plan, amendments, final).
- One `self-check.json` entry capturing confidence + per-criterion status.
- Source changes inside `change_scope` only.
- No direct writes to `.geas/` — every append is through the CLI.

## Failure Handling

- **Reviewer `blocked`**: halt. Orchestrator decides (escalate to decision-maker, open task-level deliberation, or transition to `blocked`).
- **`changes_requested` on second round**: escalate via task-level deliberation. Do not loop indefinitely.
- **Material scope drift discovered mid-implementation**: stop coding, amend plan via step 4, wait for new concurrence, resume.
- **Surface conflict with another in-flight task**: stop; return to orchestrator. `contract.surfaces` is the allowlist; scheduling should not have dispatched you.
- **CLI `guard_failed` on transition**: inspect hint; usually missing implementation evidence or missing self-check.

## Related Skills

- **Invoked by**: the orchestrator's main-session skill (`scheduling-work` on first run, `running-gate` verify-fix loop on revisions) spawning you as the concrete implementer.
- **Invokes**: no sub-skills. CLI surfaces only.
- **Do NOT invoke**: `reviewing-task` (reviewers), `verifying-task` (verifier), `running-gate` (orchestrator runs this after you return), `closing-task` (orchestrator after gate pass).

## Remember

- Plan first, concurrence second, code third. No shortcuts.
- `non_goals` and `open_questions` are mandatory content.
- Stay inside `change_scope`; amend via a new evidence entry if reality forces a deviation.
- Self-check is honest, not marketing.
- One revision cycle default; escalate rather than loop.
