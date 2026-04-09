# 03. Task Model and Lifecycle

> **Normative document.**
> This document defines task classification, required metadata, contract quality rules, state transitions, state restoration semantics, retry budgets, and scope-control expectations.

## Purpose

A task is the executable unit of closure in Geas. The task model exists so that the protocol can answer, for each unit of work:

- what exactly is being changed
- how risky it is
- who should do it
- who must review it
- what evidence proves it succeeded
- where to restore to if it fails
- whether hidden scope or debt was introduced

## Task Classification

### `task_kind`

Describes what the task produces or does.

| value | meaning | typical primary worker slot |
|---|---|---|
| `implementation` | produce or modify the core deliverable | Implementer |
| `documentation` | create or update documentation, guides, or references | Communication Specialist |
| `configuration` | set up or modify parameters, environments, or templates | Operations Specialist |
| `design` | create or revise structural, visual, or methodological designs | Implementer or Design Authority |
| `review` | perform assessment, audit, or evaluation of existing work | Risk Specialist or Quality Specialist |
| `analysis` | investigate, explore, or extract insight from data, systems, or sources | Implementer or Quality Specialist |
| `delivery` | package and ship a release, publication, or final output | Operations Specialist |

Projects MAY define local sub-kinds (e.g., `implementation:frontend`, `review:security`) but the canonical kind MUST remain identifiable.

### `risk_level`

Describes how much damage the task can cause if it goes wrong.

| value | meaning |
|---|---|
| `low` | local change with low blast radius and easy rollback |
| `normal` | ordinary delivery work |
| `high` | significant blast radius, uncertainty, or sensitive surface |
| `critical` | safety-sensitive, trust-sensitive, or production-critical change where failure is materially costly |

### `gate_profile`

Determines which gate tiers apply to the task.

| value | Tier 0 | Tier 1 | Tier 2 | when to use |
|---|---|---|---|---|
| `implementation_change` | run | run | run | task that produces or modifies a primary deliverable |
| `artifact_only` | run | skip or narrow | run | documentation, design, review, or analysis without primary implementation change |
| `closure_ready` | run | optional | simplified | cleanup, delivery, or closure-assembly task |

### `vote_round_policy`

Determines when structured deliberation occurs for the task.

| value | meaning |
|---|---|
| `never` | skip discretionary readiness rounds (mandatory conflict handling still applies) |
| `auto` | run when trigger conditions are met (high risk, reviewer disagreement, open risks, resubmission) |
| `always` | always run a readiness round before final verdict |

## Core Task Metadata

### Schema-minimum fields

A task MUST contain at least:

| field | description |
|---|---|
| `task_id` | unique identifier for this task |
| `title` | short human-readable name |
| `description` | what this task accomplishes and why |
| `task_kind` | classification of work type (see Task Classification) |
| `risk_level` | blast radius and failure cost assessment |
| `status` | current lifecycle state |
| `base_snapshot` | reference to the shared work state when this task was admitted — used to detect staleness, guide integration, and define rollback point |
| `scope.surfaces` | affected surfaces, paths, or domains |
| `acceptance_criteria[]` | observable, falsifiable conditions that define completion |
| `routing.primary_worker_type` | specialist type assigned as primary implementer |
| `routing.required_reviewer_types[]` | specialist types required to review (computed by routing algorithm) |
| `gate_profile` | which gate tiers apply |
| `vote_round_policy` | when structured deliberation occurs |
| `retry_budget` | remaining verification retry attempts |
| `workspace` | isolated execution context for this task |

### Additional recommended fields

Mission mode defines how much rigor a mission requires: `lightweight` (lightest) → `standard` → `full_depth` (strictest). These fields are optional under `lightweight`, expected under `standard`, and effectively required under `full_depth`.

| field | description |
|---|---|
| `non_goals` | what this task explicitly will NOT do |
| `affected_interfaces` | interfaces, contracts, or schemas impacted by the change |
| `rollback_notes` | how to reverse the change if needed |
| `observability_notes` | how to monitor the change in operation |
| `sensitive_surfaces` | trust boundaries, credentials, or high-risk areas touched |
| `out_of_scope_policy` | how to handle discovered work outside the approved plan |
| `dependencies` | assumptions and external dependencies |
| `demo_steps` | how to demonstrate or reproduce the expected result |
| `phase_traceability` | link to the mission phase that motivated this task |

## Acceptance Criteria Quality Standard

Acceptance criteria MUST be actionable. Each criterion SHOULD be:

- **observable** — someone can tell whether it passed
- **bounded** — the criterion has a clear surface and does not imply open-ended cleanup
- **falsifiable** — there is a plausible failing observation
- **non-duplicative** — it is not merely a paraphrase of another criterion
- **non-contradictory** — it does not conflict with other criteria or known constraints

Bad criterion example: “the feature should feel better.”  
Good criterion examples:
- Software: “submitting an invalid token returns HTTP 401 and shows the user a re-authentication path.”
- Research: “the literature review covers at least 3 independent sources published after 2020 and identifies contradictions.”
- Content: “the summary is under 200 words, cites the original source, and includes no unsupported claims.”

## Task Decomposition Rules

A task SHOULD be decomposed before implementation if any of the following are true:

- it spans more than one independently reviewable domain
- it couples a major structural change with user-facing behavior change
- it requires mutually contradictory reviewer focus
- it changes many unrelated paths with no coherent acceptance story
- the worker cannot state non-goals clearly
- the estimated blast radius is broader than the selected risk level suggests

A `critical` task SHOULD remain as small as practical.

## Task States

### Primary states

| state | meaning |
|---|---|
| `drafted` | task exists but is not yet admission-ready |
| `ready` | admitted, baseline-valid, and eligible for implementation |
| `implementing` | primary work is being performed inside an isolated workspace |
| `reviewed` | implementation artifact exists and the required review set has been produced |
| `integrated` | the change has entered the integration baseline |
| `verified` | the evidence gate has passed |
| `passed` | Decision Maker has accepted the closure packet — done |

### Auxiliary states

| state | meaning |
|---|---|
| `blocked` | progress is impossible without resolving an external or structural issue |
| `escalated` | local decision authority is insufficient; higher judgment is required |
| `cancelled` | work is intentionally abandoned with a recorded reason |

## Failure Is Not a State

Failure is not a task state. When a gate fails or a verdict iterates, the task rewinds to its rewind target via `geas task transition`. The failure is recorded as an event in `events.jsonl` (event type: `gate_failed`, `verdict_iterate`, or `unrecoverable_error`). No separate failure artifact is needed.

## Implementation Contract

An implementation contract is a pre-approved agreement between the worker and reviewers that defines what will be done, how, and what will not be changed. It exists so that everyone — worker, reviewers, and orchestrator — shares the same expectations before work begins. No task may begin implementation without an approved implementation contract.

> **Storage**: The implementation contract is stored as a section in `record.json` (via `geas task record add --section implementation_contract`), not as a separate file.

### Required fields

| field | description |
|---|---|
| `planned_actions` | concrete steps to be taken, in order — specific enough for the worker to execute and reviewers to verify |
| `non_goals` | what this task explicitly will NOT do (scope creep prevention) |
| `status` | contract lifecycle: `draft`, `in_review`, `approved`, `revision_requested` |

### What a good contract additionally clarifies

| question | description |
|---|---|
| why this approach | why the chosen method is preferred over alternatives |
| what it depends on | interfaces or assumptions it relies on |
| what stays untouched | what will **not** be changed |
| how to show success | how completion will be demonstrated |
| where reviewers should look | where to focus review effort |
| which risks are accepted | risks that are accepted, mitigated, or deferred |

### Contract approval rules

- The contract MUST be readable by the primary worker and the required reviewers.
- An implementation-bearing task SHOULD have contract review led by Design Authority.
- A material scope change after contract approval MUST trigger an amendment.
- A task MUST remain in `ready` if the contract is rejected.
- After repeated rejection, the orchestrator SHOULD decompose, clarify, or escalate the task rather than forcing execution.

## Contract Amendment Rules

An approved contract MUST be amended and re-approved when any of the following occur:

### What counts as material

A scope change is material when any of the following are true:

- paths outside the task's `scope.surfaces` are changed
- acceptance criteria are added or modified
- risk_level increases
- a new external dependency is introduced
- an item in `non_goals` enters scope

Unrecorded contract drift is non-conformant.

## Worker Self-Check

Before claiming implementation completion, the primary worker MUST produce a worker self-check.

> **Storage**: The worker self-check is stored as a section in `record.json` (via `geas task record add --section self_check`), not as a separate file.

### Schema-minimum fields

- `confidence` — integer 1-5 (see Confidence semantics below)
- `summary` — assessment of what was done and current state
- `known_risks[]` — risks the worker identified during implementation
- `untested_paths[]` — code paths or scenarios the worker did not test

### Interpretation rules

The worker self-check is not a confession booth; it is structured review acceleration.

The review system MUST consume it for:

- Quality Specialist prioritization
- Design Authority review focus
- Challenger review
- low-confidence threshold adjustment
- stub verification and debt candidate generation

### Confidence semantics

`confidence` is a 1–5 scalar:

| score | meaning |
|---|---|
| `1` | highly uncertain |
| `2` | meaningful risk of incomplete or incorrect implementation |
| `3` | moderate confidence with known gaps |
| `4` | strong confidence with limited caveats |
| `5` | high confidence and strong evidence |

A confidence score MUST NOT be treated as proof. It is a review signal, not a verdict.

## Debt Emission at Task Level

Any task MAY emit debt during implementation, review, verification, or closure.

### Minimum debt classification

| axis | values |
|---|---|
| `severity` | `low` · `normal` · `high` · `critical` |
| `kind` | `output_quality` · `verification_gap` · `structural` · `risk` · `process` · `documentation` · `operations` |

Debt differs from blockers:

- blockers prevent forward motion now
- debt allows forward motion but imposes future cost or risk

A team MUST NOT classify a blocker as debt merely to preserve throughput.

## Transition Table

| from | to | required condition |
|---|---|---|
| `drafted` | `ready` | `contract.json` exists |
| `ready` | `implementing` | `record.json` `implementation_contract` section (status=approved) |
| `implementing` | `reviewed` | `record.json` `self_check` section + `evidence/` implementer role |
| `reviewed` | `integrated` | `record.json` `gate_result` section (verdict=pass) + `evidence/` reviewer or tester role |
| `integrated` | `verified` | evidence gate passed |
| `verified` | `passed` | `record.json` verdict (pass) + `closure` + `retrospective` sections + `challenge_review` (high/critical) |
| any active | `blocked` | external, structural, or resource issue prevents safe progress |
| any active | `escalated` | unresolved conflict or authority boundary reached |
| any active | `cancelled` | explicit cancellation with recorded reason |
| `blocked` | `ready` | blocking cause resolved and revalidation passed |
| `escalated` | `ready` | escalation resolved and task re-entered deliberately |
| `integrated` | `implementing` | gate fail causes verify-fix loop |
| `integrated` | `reviewed` | integration failure or divergence requires reconciliation |
| `verified` | `ready` / `implementing` / `reviewed` | final verdict = `iterate` with explicit restoration target |

**Status source of truth**: The task's lifecycle status lives in `contract.json` (managed by `geas task transition`). `record.json` has no status field -- it accumulates section data only.

## Transition Invariants

1. A task MUST NOT skip required states by summary alone.
2. A task MUST NOT advance if the required artifact is missing or invalid.
3. A task MUST NOT become `passed` from any state other than `verified`.
4. A task MUST restore conservatively when evidence is uncertain.
5. A task in `blocked` or `escalated` MUST preserve enough state to explain re-entry.

## Rewind Targets

### Default restoration guidance

| failure location | default restoration target |
|---|---|
| implementation-quality failure discovered at gate | `implementing` |
| missing review artifact | `ready` or `reviewed` depending on cause |
| baseline divergence before integration | `ready` |
| integration failure after baseline merge | `reviewed` |
| final-verdict iterate due to product concern | `ready`, `reviewed`, or `implementing` as recorded |

State restoration MUST be explicit. “Try again” is not a valid restoration instruction.

## Retry Budget

### Initial values

A project MAY tune retry budgets, but the default SHOULD remain:

| gate_profile | suggested initial retry_budget |
|---|---:|
| `implementation_change` | 2 |
| `artifact_only` | 1 |
| `closure_ready` | 1 |

### Depletion rules

- `gate fail` consumes 1
- `block` consumes 0
- `error` consumes 0 unless local policy says otherwise
- `iterate` from final verdict consumes 0 but counts toward the iterate repetition cap

### Budget exhaustion

When retry budget reaches zero and the task still fails verification, the orchestrator SHOULD either:

- decompose the task
- escalate the task
- formally de-scope the task
- cancel the task with reason

## Iterate Repetition Cap

A final verdict of `iterate` is a product judgment, not a gate failure. It does not consume `retry_budget`. However, repeated iterate outcomes indicate unresolved decision quality.

Default rule:

- after 3 cumulative `iterate` verdicts on the same task, transition to `escalated` unless the user explicitly resets the path

## Scope Change Control

The following changes MUST be treated as scope deltas and recorded:

- touching paths outside the approved plan
- introducing user-visible behavior not covered by acceptance criteria
- creating a new dependency or interface
- changing delivery pipeline, sensitive data handling, or runtime configuration
- introducing a significant follow-up requirement

A scope delta MUST feed either:

- contract amendment
- debt registration
- gap assessment
- or all three

## Cancellation Rules

A cancelled task MUST record:

- why it was cancelled
- whether any partial artifact remains useful
- whether any debt or memory candidate was emitted
- whether a replacement task or de-scope path exists

Cancellation MUST NOT silently erase evidence already produced.

## Representative Flow

### Happy path

`drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed`

### Verify-fix path

`ready -> implementing -> reviewed -> integrated(fail) -> implementing -> reviewed -> integrated -> verified(pass) -> passed`

### Product-iterate path

`verified -> final verdict iterate -> reviewed or implementing -> ... -> verified -> passed`

## Key Statement

A task in Geas is not merely work to do. It is a governed contract whose lifecycle forces scope clarity, evidence production, and conservative recovery when reality disagrees with optimism.
