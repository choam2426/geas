# 08. Session Recovery and Resumability

> **Normative document.**
> This document defines checkpoints, safe boundaries, recovery classes, recovery packets, and the conservative rules Geas uses to resume interrupted work without pretending certainty.

## Purpose

Structured work sessions are long, tool-dependent, and failure-prone. Recovery exists to preserve integrity when interruption happens because of:

- session compaction
- sub-agent loss
- tool timeout
- crash or disconnect
- corrupted workspace
- ambiguous partial progress

The purpose of recovery is **not** to maximize continuity at any cost. Its purpose is to preserve correctness while recovering as much valid work as possible.

## Recovery Classes

Each recovery class describes a category of session interruption and the expected recovery posture. A project MAY define additional subtypes, but these canonical classes SHOULD remain recognizable.

| class | description |
|---|---|
| `post_compact_resume` | session was compacted by the host platform; context is partially or fully lost but artifacts on disk may be intact |
| `warm_session_resume` | session ended gracefully or nearly so; most context is available and artifacts are consistent |
| `interrupted_subagent_resume` | a delegated sub-agent was lost mid-execution; parent session is intact but the sub-agent's work is uncertain |
| `dirty_state_recovery` | unsaved or ambiguous local changes exist; workspace state does not match any known checkpoint |
| `manual_repair_required` | automated recovery cannot safely proceed; user intervention is needed before work can resume |

## Recovery Anchor

A recovery anchor is the minimum set of information the engine needs to assess the situation and decide on a recovery path. A recovery attempt SHOULD gather, at minimum:

- `run.json` (including the `checkpoint` field for last known progress)
- `record.json` for active tasks (section existence shows per-task progress)
- `events.jsonl` in `state/` for recent event history
- latest `recovery-packet.json` if available
- active task artifacts
- workspace status

If the anchor is incomplete, the engine MUST become more conservative, not less.

## Checkpoint Protocol

Checkpoints record progress so that recovery can identify where work stopped. The protocol defines two checkpoint moments and a recommended two-phase pattern.

### `write-before-launch`

Before a risky step or delegated sub-agent execution begins, the runtime SHOULD write intended next-step metadata.

### `write-after-step`

After the step has truly completed and the artifact exists, the runtime SHOULD update the checkpoint.

### Two-phase checkpoint

Recommended flow:

1. intent write
2. perform step and create artifact
3. commit checkpoint as completed

If phase 2 fails, the runtime MUST treat the transition as incomplete unless artifact existence and validity prove otherwise.

## Step-Level Progress

A runtime SHOULD maintain a `remaining_steps[]` concept or equivalent. This list tracks which steps in a sub-pipeline have not yet been confirmed complete.

| rule | description |
|---|---|
| add before execution | steps are added to the list before they begin |
| remove after confirmation | a step is removed only after its success is confirmed |
| resume from next incomplete | recovery resumes from the next confirmed incomplete step |
| empty list means done | an empty list implies the local sub-pipeline completed |

## Safe and Unsafe Boundaries

Exact resume is allowed only from a safe boundary — a point where all preceding work is fully persisted and no ambiguity remains about what has been completed.

### Safe boundaries

| boundary | description |
|---|---|
| task admitted, implementation not started | task contract exists but no workspace changes have been made |
| implementation completed, self-check persisted | implementation is done and the worker's self-check artifact is saved |
| review set complete and persisted | all required specialist reviews are saved |
| integration result persisted | the integration result artifact is written and valid |
| gate result persisted | the evidence gate result artifact is written and valid |
| closure packet persisted, final verdict not yet issued | closure packet is assembled but Decision Maker has not yet rendered the verdict |

### Unsafe boundaries

| boundary | description |
|---|---|
| partially edited workspace, no trustworthy checkpoint | workspace contains changes but no checkpoint confirms what was intended or completed |
| gate execution mid-flight, no confirmed result | evidence gate is running but has not produced a persisted result |
| integration in progress, ambiguous status | integration was attempted but its success or failure is unclear |
| final verdict claimed but packet missing | a verdict is recorded but the closure packet that supports it does not exist |

Unsafe boundaries REQUIRE replay or state restoration. They MUST NOT be represented as complete.

## Recovery Decision Table

This table maps observed states to recommended recovery outcomes. When the situation does not match any row exactly, choose the most conservative compatible outcome.

| observed state | artifact completeness | default outcome |
|---|---|---|
| implementation in progress, workspace clean, contract exists | high | `resume_with_revalidation` |
| implementation in progress, workspace dirty, partial artifacts | medium | `replay_current_step` or `restore_to_safe_boundary` |
| integration claimed, result artifact missing | low | `restore_to_safe_boundary` |
| verified claimed, gate result missing | low | `restore_to_safe_boundary` |
| passed claimed, final verdict missing | invalid | hard block |
| multiple in-flight tasks with conflicting signals | varies | evaluate per task; choose the most conservative compatible outcome |
| runtime anchor missing or corrupted | none | `manual_repair_required` |

## Artifact Completeness Classification

Artifact completeness determines how much the recovery engine can trust the claimed state. The following grades provide a shared vocabulary for recovery decisions.

| grade | meaning |
|---|---|
| `high` | all required artifacts for the claimed state exist and validate |
| `medium` | many required artifacts exist, but continuity is incomplete |
| `low` | few required artifacts exist or some fail validation |
| `none` | no reliable task evidence exists |
| `invalid` | artifacts exist but are corrupted, contradictory, or non-parseable |

## Recovery Matching Rules

When multiple possible interpretations exist, the recovery engine SHOULD choose the least assumption-heavy interpretation.

Examples:

- if integration success is unclear, assume integration did **not** finish
- if gate output is missing, assume verification did **not** finish
- if a workspace contains edits but no self-check, assume implementation is incomplete

## Recovery Packet

A `recovery-packet` captures the engine's assessment of the interrupted state so that the next session can make informed decisions.

A recovery packet records what the engine observed and what action to take. Canonical shape in `recovery-packet.schema.json`. The required fields are:

- `recovery_id` — identifier for this recovery attempt
- `recovery_class` — canonical class (`post_compact_resume`, `warm_session_resume`, `interrupted_subagent_resume`, `dirty_state_recovery`, `manual_repair_required`)
- `focus_task_id` — task currently in focus for recovery
- `detected_problem` — what the engine found that triggered recovery
- `recommended_action` — the recovery path to take
- `artifacts_found` — artifacts that exist and validate
- `artifacts_missing` — artifacts expected but absent

If manual intervention is required, the `recovery_class` MUST be `manual_repair_required`. No separate boolean flag is needed — the class carries that signal.

## Workspace Recovery Rules

Workspace recovery depends on the combination of workspace cleanliness and checkpoint quality. These rules apply regardless of the recovery class.

### Clean workspace, good checkpoint

Resume may be possible after freshness check.

### Dirty workspace, coherent changes

The system MAY preserve the changes, but SHOULD replay or re-derive the next formal artifact from them rather than claiming progress already happened.

### Dirty workspace, incoherent or conflicting changes

Restore to last safe boundary or manual repair.

### Missing workspace

Recreate from baseline and replay from last safe boundary if artifacts support it.

## Recovery Safety Rules

These rules are non-negotiable. They apply to every recovery attempt regardless of class or context.

1. Recovery MUST prefer conservative state restoration over optimistic continuation.
2. Recovery MUST preserve evidence already validated whenever possible.
3. Recovery MUST quarantine partial artifacts rather than count them as canonical.
4. Recovery MUST NOT drop known blockers, risks, or debt.
5. Recovery MUST mark uncertainty explicitly.

## Partial Artifact Quarantine

If a hook or agent leaves a partial artifact behind:

- preserve it with a quarantine indicator or sidecar note
- do not treat it as valid canonical evidence
- inspect it only as auxiliary recovery information

## Nested Recovery

A recovery attempt can itself fail. When this happens:

- record the recovery failure
- avoid infinitely recursive recovery
- degrade to a simpler outcome such as manual repair or wider state restoration
- preserve all still-readable evidence

## Dirty State Recovery

Dirty state means unsaved or ambiguous local changes exist. This is one of the most common and most dangerous recovery situations because the workspace cannot be trusted to reflect any known checkpoint.

Rules:

- exact resume from dirty state is allowed only when checkpoints and artifacts make the next step obvious
- otherwise replay or restore to safe boundary
- high-risk dirty state SHOULD lean toward state restoration unless manual inspection is feasible

## Manual Repair Required

Manual repair is appropriate when:

- the runtime anchor is missing
- artifact corruption is severe
- multiple contradictory state claims cannot be resolved safely
- local policy requires user review before continuing

Manual repair SHOULD produce a small repair note so the next session knows what was decided.

## Recovery to Evolution Feedback

Recovery incidents are valuable learning input. Significant recovery events SHOULD feed:

- retrospective notes
- memory candidates
- rules candidates
- scheduler or checkpoint hardening

A team that recovers from the same failure repeatedly without changing process is not learning.

## Representative Scenarios

### Scenario 1 — Interrupted during gate execution

If command output is incomplete and no validated gate artifact exists:

- do not claim `verified`
- inspect whether the command can be safely re-run
- usually replay the gate

### Scenario 2 — Integration finished locally, verdict not generated

If the integration result exists and is valid:

- recover at the post-integration, pre-verdict safe boundary
- do not re-run implementation by default
- do refresh packet freshness if the baseline changed again

### Scenario 3 — Dirty workspace with missing checkpoint

Exact resume is prohibited. Recreate a conservative path from artifacts or restore to safe boundary.

## Key Statement

Recovery in Geas is deliberately skeptical. The protocol would rather replay a step than bless an ambiguity that later turns into an undebuggable false green.
