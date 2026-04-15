# 02. Modes, Missions, and Runtime

> **Normative document.**
> This document defines mission structure, mission operating modes, the four-phase model, and phase transition controls.

## Purpose

A mission converts a user request into an executable protocol object. The mission layer exists so that Geas can answer all of the following before any implementation begins:

- what problem is being solved
- what scope was committed
- what phase the work is in
- what rigor level is appropriate
- what work is currently active, paused, or complete
- what evidence is required before leaving the phase

These questions apply equally whether the work is software delivery, research coordination, content production, or data pipeline construction.

## Mission Model

A mission is the smallest protocol object that can carry a coherent user objective across multiple tasks.

### Required fields

A mission MUST contain at least the following fields (canonical shape in `mission-spec.schema.json`):

| field | description |
|---|---|
| `mission_id` | unique identifier for the mission — format: `mission-{YYYYMMDD}-{8char}` (e.g., `mission-20260407-x7Kq9mPv`) |
| `mission` | human-readable statement of what the mission is |
| `done_when` | verifiable condition that must be true for the mission to be considered complete |
| `scope` | object containing `in` (promised surfaces, min 1) and `out` (explicit exclusions) |
| `acceptance_criteria` | array of verifiable statements that together define completion (min 1) |

### Optional fields

These fields are defined by `mission-spec.schema.json` but are not required:

| field | description |
|---|---|
| `mode` | mission operating mode (`lightweight`, `standard`, `full_depth`) |
| `domain_profile` | active domain profile identifier |
| `target_user` | who the mission outcome is for |
| `constraints` | boundaries and limitations that scope the work |
| `affected_surfaces` | surfaces the mission is expected to touch |
| `risk_notes` | known risks recorded during specifying |
| `assumptions` | assumptions made during specifying |
| `ambiguities` | open questions not yet resolved |

Projects MAY carry additional orchestration metadata on the mission object (schema permits `additionalProperties`). Those conventions are project-specific and not part of the canonical shape.

## Mission Intent Enum

The intent enum classifies the fundamental purpose of a mission. Projects use it to select default rigor, reviewer routing, and phase behavior.

| intent | description |
|---|---|
| `explore` | investigate, research, or prototype without commitment to ship |
| `plan` | produce a plan, design, or architecture without implementation |
| `build` | create new capability or deliverable |
| `fix` | correct a defect, regression, or incident |
| `review` | examine existing work for quality, compliance, or improvement |
| `decide` | reach a structured decision on a contested or ambiguous topic |
| `recover` | restore session integrity or resume interrupted work |

Projects MAY derive local sub-modes from these values, but they SHOULD retain the canonical enum for interoperability.

## Mission Operating Modes

Mission mode determines how much rigor is applied by default. Mode selection MUST be explicit. The mode controls phase depth, reviewer routing, and evidence thresholds without changing the fundamental phase sequence.

| mode | expected use | default rigor |
|---|---|---|
| `lightweight` | small, localized, low-risk changes | minimal compatible rigor; phases may be compact but not skipped semantically |
| `standard` | ordinary structured work | full task lifecycle with normal reviewer routing |
| `full_depth` | cross-cutting, risky, or ambiguous work | explicit design brief, broad review, strong evolution outputs |

Rules:

- A mission mode MUST NOT weaken the foundational invariants from doc 00.
- `full_depth` SHOULD be the default for new architectures, major refactors, security-sensitive changes, and unclear requirements.
- In urgent situations, `lightweight` mode SHOULD be used rather than inventing an emergency exception. Lightweight mode preserves all foundational invariants while minimizing ceremony.

## Initiative 4-Phase Model

Every mission operates through the following phases in order. A small mission MAY traverse some phases quickly if the required evidence is still produced, but no phase may be skipped semantically.

1. `specifying`
2. `building`
3. `polishing`
4. `evolving`

### Phase flow

```text
specifying --[phase gate 1]--> building --[phase gate 2]--> polishing --[phase gate 3]--> evolving --[phase gate 4]--> complete
```

### Phase-gate principles

Phase gates are hard boundaries between phases. They exist to prevent premature transitions that would undermine downstream quality.

- A phase gate MUST examine both artifacts and semantic readiness.
- Leaving a phase without its required gate evidence is non-conformant.
- A phase gate is not cosmetic; it is an enforcement point.

## Phase Semantics

### 1) `specifying`

Converts a user request into a structured, executable mission definition. Ends when the team has enough clarity to begin implementation safely.

| aspect | content |
|---|---|
| **what it does** | normalize request into mission language / freeze `scope_in` / resolve or record major design decisions / compile initial tasks / determine required rigor |
| **outputs** | mission spec, design brief (when required), task contracts, vote-round result (full_depth), phase review |
| **exit conditions** | mission definition stable enough to execute / task list actionable / blocking ambiguity resolved or converted to exploratory tasks / design brief approval recorded when required |

### 2) `building`

Implements the essential value path of the mission. The primary phase where tasks move through the full lifecycle from `ready` to `passed`.

| aspect | content |
|---|---|
| **what it does** | implement core value path / iterate through task closures / convert intent into validated change sets |
| **outputs** | per task: implementation contract, worker self-check, specialist review, gate result, closure packet, challenge review (high/critical), final verdict, retrospective · phase level: gap assessment, debt register, phase review |
| **exit conditions** | all MVP-critical tasks `passed` / no unresolved blocking conflict / critical debt absent or formally escalated / scope creep visible and assessed |

### 3) `polishing`

Hardens the result for delivery, adoption, or internal trust. Applies specialist-slot reviews across all relevant quality dimensions.

| aspect | content |
|---|---|
| **what it does** | harden result for delivery readiness / perform specialist-slot reviews across all quality dimensions / identify entropy: dead artifacts, boilerplate, drift, hidden shortcuts |
| **outputs** | specialist-slot reviews (security, documentation, entropy), debt register updates, gap assessment, phase review |
| **exit conditions** | high and critical debt triaged / required specialist reviews for delivery surfaces complete / known risks have recorded rationale / documentation and operational readiness not stale |

### 4) `evolving`

Captures what was learned and prepares the system for future work. Prevents missions from ending with amnesia by extracting lessons, consolidating debt, and feeding the memory system.

| aspect | content |
|---|---|
| **what it does** | compare promised scope with delivered scope / extract lessons, memories, and rules / consolidate debt / prepare carry-forward for next mission |
| **outputs** | gap assessment, rules update, debt register (final), mission summary, phase review |
| **exit conditions** | gap assessment exists / retrospective bundle exists / rules and memory actions recorded / debt snapshot captured / mission summary exists |

## `run.json` Key Fields

The runtime anchor is the persistent state object that tracks session progress. Canonical shape is in `run-state.schema.json`.

### Required fields

| field | description |
|---|---|
| `status` | session status: `initialized`, `in_progress`, or `complete` |

### Common fields

| field | description |
|---|---|
| `mission_id` | identifier of the active mission (e.g., `mission-20260407-x7Kq9mPv`), used to locate spec and artifact files (nullable) |
| `mission` | human-readable mission statement from the current mission spec (nullable when no mission is active) |
| `phase` | current mission phase: `specifying`, `building`, `polishing`, `evolving`, or `complete` (nullable when not set) |
| `scheduler_state` | scheduler state: `active`, `idle`, or `paused` |
| `current_task_id` | task currently in focus (nullable) |
| `completed_tasks` | list of task identifiers that have reached `passed` state |
| `decisions` | list of DecisionRecord identifiers created during the session |
| `recovery_class` | recovery class from the last session recovery (`post_compact_resume`, `warm_session_resume`, `interrupted_subagent_resume`, `dirty_state_recovery`, `manual_repair_required`); null when the session is clean |
| `checkpoint` | last committed checkpoint object (see Checkpoint object below) |
| `created_at` / `updated_at` | ISO-8601 timestamps maintained by the CLI |

### Checkpoint object

The checkpoint sub-object captures state for recovery:

| field | description |
|---|---|
| `pipeline_step` | current step in the pipeline |
| `agent_in_flight` | agent currently executing |
| `pending_evidence` | evidence artifacts not yet persisted |
| `retry_count` | current retry count for the in-flight step |
| `parallel_batch` | task IDs in the current parallel batch (null when running sequentially) |
| `completed_in_batch` | completed steps within the current batch |
| `remaining_steps` | ordered list of steps still to complete |
| `last_updated` | ISO-8601 timestamp of the last checkpoint write |
| `checkpoint_phase` | `pending` (intent recorded) or `committed` (step completed) |

## Phase Entry Rules

Phase entry rules define the preconditions that must hold before a mission can transition into each phase. They prevent premature advancement that would produce low-quality downstream work.

### Entering `specifying`

A new mission enters `specifying` when:

- user intent exists
- the target workspace or delivery surface is identifiable
- no unresolved prior recovery condition exists: previous session recovery is complete or no recovery is needed, the baseline is in a verifiable state, and no orphaned tasks remain from prior missions

### Entering `building`

A mission MUST NOT enter `building` until the design brief and task set are adequate for execution at the selected rigor level.

### Entering `polishing`

A mission SHOULD enter `polishing` only when the core value path is functionally present. `Polishing` MUST NOT become a substitute for unfinished core implementation unless the mission is explicitly re-scoped.

### Entering `evolving`

A mission MUST enter `evolving` before closure for any non-trivial change. A project MAY compress the evolving phase in a tiny task, but it MUST still preserve the lesson / debt / gap surfaces.

## Phase Review Artifacts

The Phase Semantics section above lists all artifacts each phase produces. This section defines which of those artifacts **must exist before transitioning** to the next phase. Attempting a transition without these is a protocol violation.

| Phase exit | Required artifacts |
|---|---|
| `specifying` → `building` | spec.json, design-brief.json (approved), ≥1 task contract |
| `building` → `polishing` | all tasks passed/cancelled, gap-assessment-building.json |
| `polishing` → `evolving` | gap-assessment-polishing.json, debt-register.json, no blocked/escalated tasks |
| `evolving` → complete | gap-assessment-evolving.json, mission-summary.md |

### Additional recommended artifacts

These preserve decision history across the mission. Higher mission mode rigor makes their inclusion increasingly expected.

| artifact | what it captures |
|---|---|
| decision record | rationale for major scope changes or conflict resolution |
| rules update | rule changes derived from the mission |
| run summary | human-readable summary of the mission run |

## Scope In / Scope Out

Scope tracking prevents the common failure mode where delivered work silently diverges from promised work.

- `scope_in` is the promised scope captured during specifying.
- `scope_out` is the delivered scope supported by `passed` task evidence.

Rules:

- `scope_out` MUST be derived from evidence-bearing tasks, not from aspirational summaries.
- Any material drift between `scope_in` and `scope_out` MUST feed the gap assessment.
- Unapproved scope expansion SHOULD trigger an implementation-contract amendment or phase-level reapproval.

## Mission Amendment Rules

A mission MAY be amended, but only under controlled conditions. Uncontrolled amendment is a primary source of scope drift and accountability loss.

Amendment is REQUIRED when any of the following become true:

- the accepted scope changes materially
- design assumptions change
- risk level rises materially
- an external dependency invalidates the original plan

### Amendment approval

- scope changes: approved by Decision Maker
- design assumption changes: approved by Design Authority
- changes affecting both: approved by both

An amendment SHOULD produce:

| artifact | description |
|---|---|
| updated rationale | why the amendment is necessary |
| updated affected tasks | which tasks are added, changed, or removed |
| updated risk summary | new or changed risks |
| updated phase review notes | impact on the current phase |

## Phase Transition Failure

If a phase transition fails, the protocol requires explicit recovery rather than hand-waving past missing evidence.

1. The Orchestrator MUST identify which exit condition was not met.
2. Missing items MUST be converted into explicit work, not dismissed.
3. Repeated failed attempts SHOULD cause re-scope or escalation.
4. The failure history MUST remain visible in the phase-review record.

## Key Statement

Mission and runtime structure exist to stop large AI-assisted efforts from dissolving into a bag of local optimizations. A mission without explicit phase semantics is not governed work.
