---
name: reviewing-task
description: Invoked by a spawned reviewer (challenger, risk-assessor, operator, or communicator) after an implementer has appended implementation evidence and a self-check entry. Reads the task contract, implementation evidence, and the latest self-check entry, then produces a review-kind evidence entry with verdict, concerns, scope_examined, and methods_used.
user-invocable: false
---

# Reviewing Task

## Overview

You have been spawned as a reviewer for a task. Your slot's system prompt defines your stance (challenger = adversarial, risk-assessor = failure modes, operator = operability + runtime concerns, communicator = surfaces affecting humans). This skill captures the shared procedure; stance lives in your agent file, not here. You read the evidence in your lane, form a verdict, and append one review-kind evidence entry through the CLI.

<HARD-GATE> You cannot also hold implementer or verifier on the same task — CLI enforces agent-slot independence. Review is evidence, not negotiation: record your view honestly, including dissent. A verdict of `approved` does not mean "no concerns"; it means "the concerns I have do not block acceptance".

## When to Use

- The orchestrator has spawned you as a reviewer after the implementer has appended implementation evidence and appended a self-check entry. Per protocol doc 03, required reviewers submit evidence **after** the self-check is appended; there is no pre-code plan concurrence round in v3.
- You were handed: your slot identity, the task's `mission_id` + `task_id`, and access to `.geas/`.
- Do NOT run to "verify" — `verifying-task` is the verifier's procedure and executes `verification_plan`.
- Do NOT run if you authored the implementation evidence you'd be reviewing.
- Do NOT run on a task that is still in `implementing` and has no self-check yet — wait for the implementer to finish.

## Preconditions

- `task-state.status == reviewing` (the orchestrator transitions `implementing → reviewing` once the implementer has appended implementation evidence + a self-check entry, then spawns reviewers).
- Task contract exists with `approved_by` set.
- Implementation-kind evidence entry exists (latest per-implementer entry is the one you grade against; walk back via `revision_ref` for trajectory).
- `self-check.json` exists and is schema-valid.
- `implementation-contract.json` exists (reviewer-visible plan input; lets you trace intent vs. delivery).
- You are not the implementer on this task (CLI enforces; stop if unsure).

## Process

1. **Read your inputs in order. Start with `reviewer_focus`.**
   - **Self-check first**: read the **latest entry** in `self-check.json` (`entries[entries.length - 1]`). `reviewer_focus` is the implementer's own list of "where I am least sure — look here first". Read it before anything else and let it shape where you spend time. Also read `completed_work` (what actually landed this pass), `deviations_from_plan` (how it diverged from impl-contract), `known_risks` (forward-looking concerns), `gap_signals` (scope/expectation mismatches). On verify-fix iterations, earlier entries remain in the file and are reachable via `revision_ref`, but the latest entry is the current view. There is no `confidence` field in v3 self-check.
   - Task contract: `goal`, `acceptance_criteria`, `verification_plan`, `surfaces`, `routing`, `risk_level`, `dependencies`, `supersedes`.
   - Implementation evidence (latest entry; walk back via `revision_ref` for trajectory).
   - Mission spec + mission design for project-wide constraints.
   - Prior review entries on this task (to avoid duplicating concerns already raised and resolved). Per-criterion pass/fail is NOT your input — that lives in the verifier's `criteria_results`; you are answering slot-specific questions, not grading criteria.
2. **Scope your review to your slot's lens.**
   - challenger: adversarial — what would cause this to fail? where are the hidden assumptions?
   - risk-assessor: failure modes — what happens when something goes wrong? are risks honest?
   - operator: runtime + operability — can this be deployed, observed, rolled back?
   - communicator: affects humans — are the surfaces visible to users consistent, safe, understandable?
   Record exactly what you examined in `scope_examined`; if a criterion lives outside your slot's lens, state that in `scope_excluded`.
3. **Choose a verdict.**
   - `approved` — criteria are met within your lens; concerns (if any) are non-blocking and recorded honestly.
   - `changes_requested` — specific corrections needed; each concern must cite a criterion or surface and suggest the correction.
   - `blocked` — the plan or implementation as stated cannot proceed; structural issue, scope violation, dependency failure, etc.
4. **Write the review-kind evidence entry** via CLI. Every listed field is required for `review` kind per the evidence schema. For the exact field list, run `geas schema template evidence --op append --kind review`.

   `geas evidence append` accepts inline flags (preferred when concerns / rationale are short prose) or a full JSON payload via `--file`. Inline form:
   ```bash
   geas evidence append --mission <id> --task <id> \
       --agent <your_concrete_agent> --slot <your_slot> \
       --evidence-kind review \
       --summary "one-line summary of your verdict" \
       --verdict approved \
       --concern "race condition in module.ts L142 when N>100; reproducible with the attached script" \
       --concern "retry count is a magic number; callers cannot tune it" \
       --rationale "why this verdict, citing artifacts + entry_ids" \
       --scope-examined "what you actually inspected — files, flows, docs" \
       --method-used "read contract" --method-used "diff implementation" --method-used "run verification_plan step 2" \
       --scope-excluded "performance envelope — that is the operator's lens, not mine"
   ```
   `--concern`, `--method-used`, `--scope-excluded` are repeatable. Free-body `--<field>-from-file` aliases (`--summary-from-file`, `--rationale-from-file`, `--scope-examined-from-file`) cover prose-heavy fields. The full-payload `--file <path>` form remains as a back-compat alias for callers who already author the full JSON; never use a bash heredoc — apostrophes / quotes inside concerns or rationale break shell parsing. See `mission/SKILL.md` § Tmp file lifecycle for staging location and cleanup.

   - `concerns` is `string[]` — each concern is one plain-text sentence (or a short paragraph). No `{severity, text}` objects; the schema rejects them. Severity is conveyed by `verdict`: if a concern is blocking, the whole verdict is `blocked`; if it requires rework, `changes_requested`; otherwise `approved` with the concern still recorded for the audit trail. Write specific concerns — "line 142" beats "performance looks sketchy".
   - `scope_excluded` is `string[]` — omit (or empty) when nothing is excluded; never a single string.
   - `methods_used` must have at least one concrete entry (schema `minItems: 1`).
5. **Return.** The orchestrator aggregates every required reviewer's verdict in Tier 2 of `running-gate`. You do not wait for other reviewers; you do not see their verdicts.

## Red Flags

| Excuse | Reality |
|---|---|
| "The implementer is senior — rubber-stamp approved" | Reviewer verdict is evidence, not deference. The gate reads your verdict as an independent signal. |
| "I'll leave concerns out of `approved` entries to keep things clean" | Dissent is captured even on `approved`. Concerns are the audit substrate for memory extraction and phase-review. |
| "I'll request changes on style issues while structural issues go unnamed" | Structural issues get `changes_requested` or `blocked`. Nitpicking style while ignoring structure is the classic review failure. |
| "I'll examine beyond my slot's lens to be helpful" | Stay in lane. Cross-slot commentary blurs the audit; if another slot is missing a view, raise it to the orchestrator, don't absorb the slot. |
| "I'll edit the implementation directly and mark approved" | Reviewers never edit. If you can fix it yourself, you are an implementer — and you cannot be both on this task. |
| "I'll skip reading prior reviews to stay unbiased" | Prior reviews name resolved concerns; re-raising them wastes the verify-fix budget. |
| "I'll review the impl-contract before any code exists (pre-work concurrence)" | v3 protocol has no pre-code review round. Per doc 03 §70, reviewers submit after the self-check completes. Reviewing a plan with no implementation to grade it against is work you were not asked to do and that the gate does not consume. |
| "Put concerns as `{severity, text}` objects like the old docs showed" | The evidence schema is `concerns: string[]`. Objects are rejected at append. Severity lives in `verdict`, not inside each concern. |
| "`scope_excluded` is just a quick note, a single string is fine" | `scope_excluded` is `string[]`. Use `[]` for nothing excluded, otherwise one entry per excluded item. A single string fails schema validation. |
| "Read self-check's `confidence` to calibrate my review" | v3 self-check has no `confidence`. Read `reviewer_focus` first — the implementer's own weak-spot list is far more useful than a 1–5 score ever was. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas evidence append --slot <your_slot> --agent <concrete> --mission <id> --task <id>` | Append one review-kind evidence entry with verdict + concerns. |

Read-only helpers:
| CLI command | Purpose |
|---|---|
| `geas mission state --mission <id>` | Confirm phase + approval state. |
| `geas context` | Mission overview from the dispatcher view. |

(There is no `geas evidence list` or `geas event query`. Walk prior evidence by reading `.geas/missions/{id}/tasks/{id}/evidence/*.json` directly; trace transitions by reading `.geas/events.jsonl` if a history view is needed.)

Sub-skills you do NOT invoke: none.

## Outputs

- One review-kind evidence entry per spawn, written to `.geas/missions/{mission_id}/tasks/{task_id}/evidence/*.{your_slot}.json`.
- No other artifacts.

## Failure Handling

- **Implementation evidence missing** (post-work review): stop; return to orchestrator. Do not review absent work.
- **Self-check missing or schema-invalid**: return to orchestrator with a note; the implementer must append a valid self-check entry before the gate's Tier 0 passes. The v3 self-check is append-only with a top-level `entries[]` envelope. A self-check missing the envelope, missing `revision_ref` per entry, or using v2 field names (`confidence`, `surprises`, `remaining_risks`, `acceptance_criteria_status`) is schema-invalid and must be rewritten.
- **Criterion outside your slot's lens**: record `scope_excluded`; do not issue verdict over that criterion.
- **Evidence of implementer-as-reviewer conflict**: refuse the review, return with note. CLI should have prevented the spawn.
- **Base_snapshot drift**: raise as `blocked` with concern about snapshot mismatch; orchestrator re-bases.

## Related Skills

- **Invoked by**: the orchestrator after the implementer has appended implementation evidence + a self-check entry and the task has transitioned to `reviewing`; and `running-gate` verify-fix loop (post-revision re-review, after the implementer appends a new self-check entry following a `reviewing → implementing` rewind and re-transition to `reviewing`).
- **Invokes**: none.
- **Do NOT invoke**: `verifying-task` (verifier runs it separately), `running-gate` (orchestrator aggregates verdicts), `implementing-task` (you're reviewing, not implementing).

## Remember

- Stay in your slot's lens; record `scope_excluded` for what you did not examine.
- Verdict is evidence, not negotiation. Concerns are captured even on `approved`.
- One entry per spawn; re-reviews after revisions are new entries.
- You cannot also be implementer or verifier on this task.
- Every writes goes through the CLI; no direct `.geas/` edits.
