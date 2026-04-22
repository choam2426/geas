---
name: implementing-task
description: Invoked by a spawned implementer after the orchestrator dispatches an approved, dependency-satisfied task. Writes the implementation contract, performs the work per that plan (amending the contract if the direction shifts materially), and appends implementation evidence plus the self-check via the CLI. Reviewers examine the result after self-check completes.
user-invocable: false
---

# Implementing Task

## Overview

You have been spawned as the implementer for an approved task. You own the full span of the `implementing` state: write the implementation-contract (the plan reviewers will later follow), do the work, amend the plan if direction shifts materially, and close out with implementation evidence + self-check. Reviewers do NOT review the plan before you code — per protocol doc 03, required reviewers submit their evidence **after** your self-check completes. The implementation-contract is a reviewer-visible reference, not a pre-work approval gate.

<HARD-GATE> Every task gets an implementation-contract; there is no "simple task" shortcut. The CLI is the sole writer to `.geas/`. The same concrete agent cannot hold implementer and reviewer/verifier on the same task. `non_goals` and `open_questions` are mandatory content, not decorative. If you are tempted to wait for reviewer sign-off before coding, stop — that is not how v3 works.

## When to Use

- The orchestrator has dispatched you for a task in `implementing` (either first dispatch from `ready`, or a verify-fix revision).
- You have access to the task contract, the mission spec + mission design, and shared + agent memory.
- Do NOT run when the task is still in `drafted` or `ready` — scheduler transitions the task to `implementing` before spawning you.
- Do NOT run to "review" or "verify" — those are different spawned skills.

## Preconditions

- `task-state.status == implementing` at the moment you are spawned. The scheduler transitions `ready → implementing` before your spawn on first dispatch; `running-gate` transitions `reviewing → implementing` on verify-fix rewinds and the CLI increments `verify_fix_iterations` in that path.
- Task contract exists under `missions/{mission_id}/tasks/{task_id}/contract.json` with `approved_by` set.
- Mission spec is `user_approved: true` for specifying-phase tasks; `approved_by: decision-maker` for mid-mission scope-in tasks.
- `base_snapshot` still matches the real workspace (if not, return to orchestrator to rebase).
- If `supersedes` is non-null, you have read the prior task's closure evidence.

## Process

1. **Read everything in your lane.** Contract, mission spec, mission design (if present), `shared.md`, `agents/{your_agent_type}.md`, any prior evidence on this task (revisions), and the supersedes chain if present.
2. **Write the implementation contract** as an `implementation-contract` payload. This is the plan reviewers will read post-work to trace what you intended vs. what you delivered:
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
   **Stage to a file with the Write tool, then pass `--file`.** Do not use heredoc — prose in `rationale` / `planned_actions` routinely breaks bash parsing:
   ```bash
   # Step 1: Write tool → e.g. <workspace>/.tmp/impl-contract.json (body above)
   # Step 2: hand the file to the CLI
   geas impl-contract set --mission <id> --task <id> --file <workspace>/.tmp/impl-contract.json
   ```
   The CLI injects `mission_id` / `task_id` / timestamps and validates against `implementation-contract.schema`.
3. **Do the work per the plan.** Stay inside `change_scope`. The implementation-contract is a live document — if reality forces a material deviation (plan needs to touch outside `change_scope`, an assumption broke, risk rose, a non-goal must come in-scope), pause and amend before pushing ahead (step 4). Minor adjustments that stay within scope do not require amendment; record them in `deviations_from_plan` at self-check time.
4. **Amend the contract when direction shifts materially.** Run `geas impl-contract set` again with the revised body; the CLI replaces the prior contract (full-replace semantics) so reviewers later see the current plan. Amendment is NOT gated on reviewer approval — keeping the document current is an obligation to future readers, not a concurrence checkpoint. If the amendment itself is so structural it should pause the task, stop and hand back to the orchestrator; they decide whether to open a task-level deliberation via `convening-deliberation`.
5. **Append implementation evidence** when the work is ready for review. **Use the Write tool to stage the payload to a file outside `.geas/`, then hand it to the CLI with `--file`.** Never write the JSON body inside a bash heredoc — prose inside the body (rationale, summary) breaks shell parsing on apostrophes/quotes/non-ASCII.
   ```bash
   # Step 1: Write tool → e.g. <workspace>/.tmp/impl-evidence.json
   {
     "evidence_kind": "implementation",
     "summary": "what you did",
     "rationale": "<why these changes, in this shape>",
     "scope_examined": "<surfaces actually touched>",
     "methods_used": ["<concrete tools/procedures>"],
     "revision_ref": null
   }

   # Step 2: hand the file to the CLI
   geas evidence append --mission {mission_id} --task {task_id} \
       --agent {your_concrete_agent} --slot implementer \
       --file <workspace>/.tmp/impl-evidence.json
   ```
   On a revision run (verify-fix rewind), set `revision_ref` to the prior implementation entry's `entry_id`. The CLI auto-injects `entry_id`, `artifacts: []`, `memory_suggestions: []`, `debt_candidates: []`, `gap_signals: []`, `created_at`; you only need to supply the semantic fields above.
6. **Append the self-check entry.** The self-check is an append-only log: one entry per implementer pass. It is a worker-side factual record, not a confidence score. The reviewer and the gate read the latest entry to orient their own checks. **Same pattern: Write tool → `--file`.**
   ```bash
   # Step 1: Write tool → e.g. <workspace>/.tmp/self-check.json
   {
     "completed_work": "<one paragraph: what you actually landed on which surfaces>",
     "reviewer_focus": [
       "<area reviewers should inspect first — your own known weak spot 1>",
       "<area 2>"
     ],
     "known_risks": [
       "<forward-looking risk or unresolved concern that remains after implementation>"
     ],
     "deviations_from_plan": [
       "<how the actual work diverged from implementation-contract.planned_actions, if at all>"
     ],
     "gap_signals": [
       "<early signal of scope or expectation gap noticed during work>"
     ],
     "revision_ref": null
   }

   # Step 2: hand the file to the CLI
   geas self-check append --mission {mission_id} --task {task_id} \
       --file <workspace>/.tmp/self-check.json
   ```
   On a verify-fix re-entry, set `revision_ref` to the prior self-check entry's `entry_id` so reviewers can trace iteration history. The CLI assigns `entry_id` and `created_at` automatically; prior entries are preserved so the iteration log stays intact.
   - `completed_work` is a factual statement of what landed in this pass, not a confidence claim. No "mostly done", no 1–5 score.
   - `reviewer_focus` is the main honesty test: name the areas you yourself are least sure about. An empty array on a non-trivial task is a red flag.
   - `known_risks` are forward-looking (what could still break); `deviations_from_plan` and `gap_signals` are backward-looking (what actually happened vs. the plan / vs. the scope).
   - All five content fields plus `revision_ref` are required by the schema; use `[]` for arrays that legitimately have nothing and `null` for `revision_ref` on the first pass.
   - Per-criterion pass/fail belongs to the verifier's evidence (`criteria_results`), NOT here. Do not restate criterion outcomes in self-check.
7. **Return.** The orchestrator spawns the required reviewers (they run `reviewing-task` against your impl-contract + implementation evidence + self-check), then the verifier runs `verifying-task`, then `running-gate` aggregates. You are done.

## Red Flags

| Excuse | Reality |
|---|---|
| "This task is trivial — skip the plan and just code" | The plan catches the ambiguity that causes rework. Friction is the point. Protocol doc 03 requires an impl-contract for every task; there is no "simple task" shortcut. |
| "Wait for reviewers to approve the plan before coding" | v3 protocol has no pre-code reviewer concurrence. Reviewers submit evidence after your self-check. Waiting for approval that never arrives stalls every task. |
| "I'll leave `non_goals` empty since it's self-evident" | Undeclared scope is the top source of "why did you change that too" review cycles. |
| "I'll pick a reasonable interpretation of the ambiguous requirement silently" | `open_questions` exists to surface exactly that. Silent interpretation is the anti-pattern this skill prevents. |
| "Put `confidence: 5` in self-check" | The self-check schema has no `confidence` field. That was the v2 shape. v3 self-check is factual (`completed_work`, `reviewer_focus`, `known_risks`, `deviations_from_plan`, `gap_signals`); a confidence score gets rejected at append time. |
| "Leave `reviewer_focus` empty — everything looks fine" | `reviewer_focus` is the main honesty test. Empty array on a non-trivial task claims zero self-known weak spots, which is almost never true. Name the areas you are least sure about so reviewers land there first. |
| "Restate each criterion's pass/fail in self-check" | Per-criterion pass/fail is the verifier's `criteria_results`. Self-check is a worker-side factual record of what was done, not a grading sheet. |
| "I'll amend the plan after the fact by editing my implementation entry" | Plan amendments go through `geas impl-contract set` (full-replace). Deviations that stay within the original plan go in `deviations_from_plan` at self-check time. Overwriting implementation evidence breaks the trajectory audit. |
| "I'll also review my own work to save a round" | CLI enforces agent-slot independence. Implementer cannot hold reviewer or verifier on the same task. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas impl-contract set --mission <id> --task <id>` | Record / update the implementation plan. Full-replace each call — the CLI keeps only the current plan, which reviewers read post-work. |
| `geas evidence append --slot implementer --agent <concrete> --mission <id> --task <id>` | Append implementation-kind evidence (initial + revisions on verify-fix rewinds). |
| `geas self-check append --mission <id> --task <id>` | Append the end-of-pass self-check entry (completed_work, reviewer_focus, known_risks, deviations_from_plan, gap_signals, revision_ref). One entry per implementer pass. |

Task-state transitions are owned by the orchestrator / scheduler / gate, not by this skill:
- `ready → implementing` is done by `scheduling-work` before your spawn.
- `implementing → reviewing` is done by the orchestrator after your self-check is appended (and before reviewers are spawned).
- `reviewing → implementing` on verify-fix is done by `running-gate`, which triggers a fresh implementer spawn.

Sub-skills you do NOT invoke: `reviewing-task` (reviewers run it), `verifying-task` (verifier runs it), `running-gate` (orchestrator invokes after evidence is in).

## Outputs

- One `implementation-contract.json` (via `geas impl-contract set`) before any code; updated in place if direction shifts.
- One or more `implementation`-kind evidence entries (initial + any verify-fix revisions with `revision_ref`).
- A new entry appended to `self-check.json` capturing `completed_work`, `reviewer_focus`, `known_risks`, `deviations_from_plan`, `gap_signals`, and `revision_ref` for this pass.
- Source changes inside `change_scope` only.
- No direct writes to `.geas/` — every append is through the CLI.

## Failure Handling

- **Structural ambiguity you cannot resolve from the contract + spec + design**: stop before coding. Return to orchestrator with the `open_questions` front-loaded. Orchestrator either clarifies or opens a task-level deliberation.
- **Material scope drift discovered mid-implementation**: stop coding, amend the impl-contract via `geas impl-contract set`, record the drift in `deviations_from_plan` at self-check time, then continue. If the drift is large enough to need escalation, return to orchestrator.
- **Surface conflict with another in-flight task**: stop; return to orchestrator. `contract.surfaces` is the allowlist; scheduling should not have dispatched you.
- **CLI `guard_failed` on implementation evidence append**: inspect hints; common cause is agent-slot independence violation (you hold another slot on this task).
- **CLI `schema_validation_failed` on self-check append**: schema validation failure; fix the body (see Step 6) and retry.
- **Verify-fix rewind**: the CLI has already moved the task back to `implementing` and bumped `verify_fix_iterations`. Read the prior reviewer concerns + gate details, amend the impl-contract if the plan changed, and set `revision_ref` on both the next implementation evidence entry AND the next self-check entry so reviewers can follow iteration history on both logs.

## Related Skills

- **Invoked by**: `scheduling-work` on first dispatch (after it transitions `ready → implementing`), and `running-gate` verify-fix loop on revisions (after it rewinds `reviewing → implementing`).
- **Invokes**: no sub-skills. CLI surfaces only.
- **Do NOT invoke**: `reviewing-task` (reviewers run it, post-work only), `verifying-task` (verifier runs it), `running-gate` (orchestrator runs this after your evidence + self-check are in place and reviewers + verifier have appended), `closing-task` (orchestrator runs it after gate pass).

## Remember

- Plan, code, self-check — in that order. No pre-code reviewer approval step exists in v3; waiting for one is the anti-pattern this skill prevents.
- `non_goals` and `open_questions` are mandatory content.
- Stay inside `change_scope`; material deviations mean amending the impl-contract, not silently going outside scope.
- Self-check is factual, not a confidence score. `completed_work` + honest `reviewer_focus` beat any 1–5 rating.
- One clean pass; verify-fix loop is entered only when the gate fails.
