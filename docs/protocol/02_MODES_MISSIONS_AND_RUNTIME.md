# 02. Missions and Runtime

> **Normative document.**
> This document defines mission structure, mission operating modes, the four-phase model, runtime phases, and phase transition controls.

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

A mission MUST contain at least the following fields:

| field | description |
|---|---|
| `mission_id` | unique identifier for the mission |
| `intent` | canonical intent enum value describing the mission's purpose |
| `goal` | human-readable description of the desired outcome |
| `done_when` | verifiable condition that must be true for the mission to be considered complete |
| `constraints` | boundaries and limitations that scope the work |
| `source_request` | the original user request that triggered the mission |
| `entry_signals` | conditions that were true when the mission was created |
| `scope_in` | the promised scope captured during specifying |
| `current_phase` | the active mission phase |

### Additional recommended metadata

Assurance profiles (doc 13) define rigor levels: `prototype` (lightest) → `delivery` → `hardened` → `regulated` (strictest). These fields are optional under `prototype`, expected under `delivery`, and effectively required under `hardened` and `regulated`. They capture context that improves recovery, traceability, and scope discipline.

| field | description |
|---|---|
| excluded scope / non-goals | explicitly out-of-scope items to prevent creep |
| risk summary | known risks and their mitigations |
| external dependency summary | dependencies outside the team's control |
| active assurance profile reference | link to the assurance profile governing this mission |
| phase owner notes | per-phase context from the Orchestrator |
| initial debt or known constraints | pre-existing technical or process debt |
| rollback / de-scope strategy | plan for controlled retreat if needed |

A project MAY store these in companion artifacts until schemas are extended.

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
| `recovery_first` | interrupted or damaged sessions | recovery and integrity restoration take priority over new implementation |
| `audit_only` | diagnosis, review, or evidence gathering without intended implementation change | strong traceability and review, lighter implementation path |

Rules:

- A mission mode MUST NOT weaken the foundational invariants from doc 00.
- `full_depth` SHOULD be the default for new architectures, major refactors, security-sensitive changes, and unclear requirements.
- `recovery_first` MUST suspend normal throughput optimization until state integrity is restored.

## Initiative 4-Phase Model

Every mission operates through the following phases in order. A small mission MAY traverse some phases quickly if the required evidence is still produced, but no phase may be skipped semantically.

1. `specifying`
2. `building`
3. `polishing`
4. `evolving`

### Phase flow

```text
specifying --[phase gate 1]--> building --[phase gate 2]--> polishing --[phase gate 3]--> evolving --[phase gate 4]--> close
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
| **outputs** | gap assessment, rules update, debt register (final), mission summary, phase review, memory promotion records |
| **exit conditions** | gap assessment exists / retrospective bundle exists / rules and memory actions recorded / debt snapshot captured / mission summary exists |

## Runtime Phases

Runtime phase describes what the session is doing **now**, regardless of mission phase. A session cycles through runtime phases multiple times within a single mission phase.

| runtime phase | primary allowed operations |
|---|---|
| `bootstrap` | load state, detect recovery conditions, verify environment and anchors |
| `planning` | clarify mission, refine tasks, review contracts, amend scope if allowed |
| `scheduling` | select ready tasks, calculate concurrency window, allocate locks |
| `executing` | implement or edit within workspace, produce local evidence |
| `integrating` | enter serialized integration lane, reconcile baseline, integrate changes |
| `verifying` | run gates, assemble packet, execute vote / verdict flow |
| `learning` | retrospective, memory extraction, debt and rule updates |
| `idle` | no active in-flight work; waiting, paused, or mission complete |

## `run.json` Key Fields

The runtime anchor is the persistent state object that tracks session progress. It SHOULD expose at least the following fields:

| field | description |
|---|---|
| `session_start_ref` | reference point (commit, snapshot, or timestamp) marking session start |
| `integration_target` | the target branch, environment, or artifact collection that receives integrated work |
| `phase` | current runtime phase |
| `mission_phase` | current mission phase |
| `focus_task_id` | the task currently being executed |
| `checkpoint_seq` | monotonically increasing checkpoint sequence number |
| `recovery_state` | recovery status (none, detecting, restoring, etc.) |
| `active_locks` | currently held resource locks |
| `packet_refs` | references to assembled closure packets |

### Additional recommended fields

Assurance profiles (doc 13) define rigor levels: `prototype` (lightest) → `delivery` → `hardened` → `regulated` (strictest). These fields are optional under `prototype`, expected under `delivery`, and effectively required under `hardened` and `regulated`.

| field | description |
|---|---|
| selected mission mode | the operating mode governing this mission |
| assurance profile | the active assurance profile reference |
| current integration lane owner | which agent holds the integration lane |
| remaining steps | estimated steps to phase or mission completion |
| last safe boundary | the most recent safe recovery point |
| last successful verification timestamp | when the last gate or verification passed |
| current blocking cause | the reason work is blocked, if applicable |

## Phase Entry Rules

Phase entry rules define the preconditions that must hold before a mission can transition into each phase. They prevent premature advancement that would produce low-quality downstream work.

### Entering `specifying`

A new mission enters `specifying` when:

- user intent exists
- the target workspace or delivery surface is identifiable
- no unresolved prior recovery condition prevents safe planning

### Entering `building`

A mission MUST NOT enter `building` until the design brief and task set are adequate for execution at the selected rigor level.

### Entering `polishing`

A mission SHOULD enter `polishing` only when the core value path is functionally present. `Polishing` MUST NOT become a substitute for unfinished core implementation unless the mission is explicitly re-scoped.

### Entering `evolving`

A mission MUST enter `evolving` before closure for any non-trivial change. A project MAY compress the evolving phase in a tiny task, but it MUST still preserve the lesson / debt / gap surfaces.

## Phase Review Artifacts

The Phase Semantics section above lists all artifacts each phase produces. This section defines which of those artifacts **must exist before transitioning** to the next phase. Attempting a transition without these is a protocol violation.

| transition | must exist | what it confirms |
|---|---|---|
| `specifying` → `building` | phase review | mission frozen, tasks ready, design brief approved (when required) |
| `building` → `polishing` | phase review, gap assessment | all MVP tasks passed, scope vs delivery status |
| `polishing` → `evolving` | phase review, gap assessment, debt register | specialist reviews complete, debt triaged |
| `evolving` → close | phase review, gap assessment, retrospective, debt register, mission summary | lessons extracted, debt finalized, mission documented |

### Additional recommended artifacts

These preserve decision history across the mission. Higher assurance profiles make their inclusion increasingly expected.

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
- the selected assurance profile no longer fits the work

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
3. Repeated failed attempts SHOULD cause re-scope, escalation, or assurance-profile review.
4. The failure history MUST remain visible in the phase-review record.

## Emergency Exception

A project MAY invoke an emergency path for hotfixes or incident response, but the following MUST still hold:

- task artifacts and evidence must exist
- the exception rationale must be recorded
- skipped hardening must be logged as debt or follow-up work
- the mission MUST still pass through evolving before true closure

Emergency exceptions are not a loophole; they are a controlled degradation path that preserves traceability even under time pressure.

## Key Statement

Mission and runtime structure exist to stop large AI-assisted efforts from dissolving into a bag of local optimizations. A mission without explicit phase semantics is not governed work.
