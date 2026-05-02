---
name: mission
description: Drives Geas missions end-to-end. Bootstraps the .geas/ tree if absent, inspects mission state, dispatches to the appropriate sub-skill per phase, and produces structured briefings at task completion, phase transition, and mission verdict. The single user entry point for mission work.
user-invocable: true
---

# Mission

## Overview

`mission` is the Geas dispatcher. It runs in the main session (never spawned), owns state inspection and briefing, and routes each invocation to the phase-appropriate sub-skill. Sub-skills perform the work and return; this dispatcher reconciles their output with `.geas/` state and continues or halts.

<HARD-GATE> Sub-skills are orchestrated only by `mission`; do not invoke them elsewhere. The CLI (`geas`) is the sole writer to `.geas/`; no direct file edits.

## When to Use

- User invokes `/mission` to start, continue, or resume mission work.
- User describes a task that is plausibly a new mission and `.geas/` is absent.
- User asks "where are we?" on an existing mission.
- Do NOT use for trivial single-file requests that clearly fit no mission (point this out and do the work directly with no spec).
- Do NOT use to answer questions about the framework itself — use `navigating-geas`.

## Preconditions

None. The dispatcher handles `.geas/` bootstrap, so it is safe to call in a fresh project.

## Process

1. **Bootstrap check.**
   - Run `geas context`. If `.geas/` is missing, run `geas setup`, then re-run `geas context`.
   - `geas setup` is idempotent and preserves existing files; it lists created vs. existed paths.
   - If the user request is trivial and no mission exists, tell the user you will bypass the mission pipeline, do the work directly, and return.

2. **State inspection.**
   - For the active mission, run `geas mission state --mission <id>` to get phase, approval flags, task counts, and last event.
   - Read `.geas/memory/shared.md` and, if present, `.geas/memory/agents/orchestrator.md`.
   - Validate artifact consistency with state. If drift is detected (state claims a phase incompatible with existing phase-reviews, or references a mission spec that is missing), halt and surface a ⚠ block.

3. **Current-status briefing.**
   - Render the **Current-status** narrative template from `references/briefing-templates.md` (section 1) and emit it to the user in Korean. The template is 2-4 short sentences naming the current `phase`, the task counts (passed / active / blocked), the most recent activity, and the next intended action. Stay inside the user-facing vocabulary allowlist defined at the top of `references/briefing-templates.md`; words in the blacklist there must not appear in the emitted text.
   - Always emit the full briefing on a decision point (approval needed, drift, corruption); `--brief` flag otherwise honored.

4. **Dispatch decision.** Map `(phase, state)` to a sub-skill:

   | Phase | State signal | Dispatch |
   |---|---|---|
   | specifying | no mission spec OR spec not yet user-approved | `specifying-mission` |
   | specifying | spec approved, initial tasks not all approved | `drafting-task` (per task) |
   | building | tasks ready with deps satisfied | `scheduling-work` |
   | building | task is `implementing`, implementer has appended self-check | transition `implementing → reviewing` via `geas task transition --to reviewing`, then dispatch reviewer + verifier (next row) |
   | building | task is `reviewing`, no reviewer or verifier evidence yet | spawn each `routing.required_reviewers` slot via `reviewing-task`, in parallel with the verifier slot via `verifying-task` |
   | building | required reviewers + verifier evidence present for a task | `running-gate` |
   | building | gate verdict pass on a task | `closing-task` |
   | building | all mission-scope tasks terminal | `reviewing-phase` |
   | polishing | new tasks needed | `drafting-task` then `scheduling-work` |
   | polishing | integration clean | `reviewing-phase` |
   | consolidating | entry | `consolidating-mission` |
   | consolidating | candidates promoted, verdict pending | `verdicting-mission` |
   | any | reviewer verdict conflict, structural challenge, or phase rollback in `full_depth` mode | `convening-deliberation` |

   Anti-pattern: never advance phase without the matching phase-review; never invoke a sub-skill outside the table above.

   Codex adapter: when any dispatched path needs a spawned agent, follow `references/codex-agent-dispatch.md`. Codex does not auto-register `agents/` files from the plugin manifest, so the dispatcher must make sure the relevant agent file body is loaded into the spawned prompt.

5. **Post-dispatch briefing.** When a sub-skill returns, render the matching narrative template from `references/briefing-templates.md` (sections 2-4) in Korean and emit it. Each template is a short narration; the user-facing vocabulary allowlist + blacklist at the top of that file constrains the emitted text in every case.
   - **Task-completion** narrative (section 2) after `closing-task`, or after gate runs back to `cancelled` / `escalated`.
   - **Phase-transition** narrative (section 3) after `reviewing-phase` and the matching phase advance both succeed.
   - **Mission-verdict** narrative (section 4) after `verdicting-mission`; this one requires user final confirmation before transitioning to `complete`.

6. **Loop or return control.**
   - If the next dispatch is automatic (next task in a batch, gate → closure), continue.
   - If a user interaction point is reached (mission spec approval, phase-transition approval, mission-verdict final confirmation), return control with the appropriate briefing.

## User interaction points

- Bootstrap initialization: confirm Geas should set up `.geas/` in the current project.
- Mission spec approval: surfaced by `specifying-mission`, confirmed in this dispatcher before the CLI approve call.
- Phase-transition approval: on every phase boundary, user sees the transition briefing before the next dispatch.
- Mission-verdict final confirmation: mandatory full briefing; user approves before `mission-state update --phase complete`.

## Tmp file lifecycle

Sub-skills sometimes need to stage prose-heavy CLI input (free-body fields like `--goal-from-file`) or short-lived scratch artifacts. The conventions below are mandatory; the hook and the dispatcher both rely on them.

- **Staging location.** All sub-skill scratch files go under `.geas/tmp/` only. No top-level `tmp/`, no `.tmp/`, no per-skill scratch directories.
- **Immediate cleanup by sub-skills.** A sub-skill that stages a tmp file must delete it as soon as the CLI consumes it (typically right after the `geas ... --file <path>` call returns). Tmp files are not artifacts; they are not part of the audit trail.
- **Bulk cleanup by the dispatcher.** This dispatcher triggers a bulk cleanup of `.geas/tmp/` after `verdicting-mission` returns (mission verdict authored) and at every phase-review boundary. Sub-skills that crashed before their own cleanup are reaped here.
- **Hook allowlist scope.** The pre-tool-use write-block hook (`geas-write-block`) permits direct Write/Edit only under `.geas/tmp/`. Everything else under `.geas/` remains CLI-only — no exceptions.

## Red Flags

| Excuse | Reality |
|---|---|
| "I already ran `geas mission state` last turn — skip inspection" | State inspection is per-invocation. Skipping it misses drift and stale artifact hints, which corrupt downstream dispatch. |
| "The user said to continue — dispatch directly without briefing" | The current-status briefing is the user's only handle on what is about to happen. Skipping it hides dispatch intent. |
| "Sub-skill X already does state checks — orchestrator can shortcut" | Dispatcher owns the cross-cutting view (drift, multiple tasks, phase boundaries). Sub-skills only see their slice. |
| "This mission is small — edit `.geas/` by hand to save time" | The CLI is the only writer; direct edits break schemas, transition guards, and resume flows. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas context` | Detect `.geas/` presence and list known missions. |
| `geas setup` | Bootstrap `.geas/` tree on first use. |
| `geas mission state --mission <id>` | Per-invocation state inspection. |
| `geas mission-state update --mission <id> --phase <p>` | Phase advance after sub-skill + user approval. |
| `geas phase-review append --mission <id>` | Dispatched through `reviewing-phase`; dispatcher never writes evidence directly. |

Sub-skill dispatch — all 15 sub-skills are invoked conditionally per the dispatch table in Process step 4.

## Outputs

- Korean briefings to the user (current status, task completion, phase transition, mission verdict).
- No direct `.geas/` writes. All artifact writes happen inside sub-skills that call the CLI.

## Failure Handling

- **Artifact drift** (state vs. artifacts mismatch): halt, surface ⚠ block in the current-status briefing, ask the user how to proceed. Do not auto-correct.
- **State inspection error** (corrupt JSON, CLI throws): halt, report the raw error, escalate to the user. Do not retry silently.
- **Sub-skill returns with unexpected state** (e.g., `running-gate` returns block): surface the block in the next briefing; re-enter dispatch on user approval only.
- **CLI guard failure** (illegal transition): read the CLI hint, fix the missing precondition by re-dispatching the correct sub-skill, or halt if the precondition is a user decision.

## Related Skills

- **Invoked by**: user (`/mission`).
- **Invokes** (15, conditional): `specifying-mission`, `drafting-task`, `scheduling-work`, `running-gate`, `closing-task`, `reviewing-phase`, `consolidating-mission`, `verdicting-mission`, `convening-deliberation`, `implementing-task`, `reviewing-task`, `verifying-task`, `deliberating-on-proposal`, `designing-solution`, `deciding-on-approval`.
- **Do NOT invoke**: `reviewing-task`, `verifying-task`, `implementing-task`, `deliberating-on-proposal`, `designing-solution`, `deciding-on-approval` directly in the main session. These are spawned-agent skills; the dispatcher requests them through the dispatched main-session sub-skill (`scheduling-work`, `running-gate`, `convening-deliberation`, etc.), which spawns the concrete agent.

## Remember

- Bootstrap, inspect, brief, dispatch, brief, loop. No step is optional.
- Dispatcher never writes to `.geas/`; sub-skills do, via CLI.
- Mission spec is immutable after approval; scope changes are new missions or scope-in tasks.
- Trivial requests bypass the mission pipeline entirely — say so, do it, return.
