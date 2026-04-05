# 12. Enforcement, Conformance, and Metrics

> **Normative document.**
> This document defines enforcement points, allowed and forbidden hook behavior, conformance scenarios, observability expectations, health signals, and mandatory corrective responses.

## Purpose

A protocol that cannot be enforced will drift into ceremony. This document exists to ensure that Geas remains operationally binding instead of aspirational.

## Enforcement Event Timeline

A default lifecycle SHOULD include the following enforcement points. Each point represents a moment where the protocol can validate invariants, block invalid progression, or emit telemetry.

| # | enforcement point | when it fires |
|---|---|---|
| 1 | `task_admission` | a new task enters the active pipeline |
| 2 | `pre_implementation` | before work begins on an admitted task |
| 3 | `post_implementation` | after the worker signals implementation complete |
| 4 | `pre_integration` | before merging output into the shared workspace |
| 5 | `post_integration` | after integration succeeds |
| 6 | `pre_gate` | before evidence gate evaluation starts |
| 7 | `post_gate` | after evidence gate produces a verdict |
| 8 | `pre_verdict_submission` | before the final verdict is submitted |
| 9 | `final_verdict` | when the Decision Maker issues pass, iterate, or escalate |
| 10 | `session_checkpoint` | at periodic or event-driven session save points |
| 11 | `post_pass_learning` | after a task reaches `passed`, triggering retrospective |
| 12 | `phase_transition_review` | when the mission moves between phases |

A project MAY add more, but SHOULD NOT remove the semantic coverage these points provide.

## Hook Responsibilities

Hooks are the executable enforcement mechanism at each point. They must stay within well-defined boundaries to avoid replacing the judgment that belongs to agents and reviewers.

### Allowed responsibilities

Hooks and validators MAY perform:

| responsibility | example |
|---|---|
| artifact completeness checks | verify closure packet has all required fields |
| enum / schema checks | validate task status is a legal value |
| invariant checks | confirm task_id consistency across artifacts |
| stale-start blocking | reject implementation start when base_snapshot is outdated |
| lock conflict blocking | prevent parallel work on conflicting resources |
| missing-review blocking | block gate entry when required reviews are absent |
| packet freshness checks | detect packets generated before the latest contract amendment |
| state and summary synchronization | update runtime state files and session summaries |
| phase-transition precondition checks | verify evolving exit gate conditions before phase close |
| telemetry emission | record timing, outcome, and resource usage |
| documented policy enforcement | apply rules explicitly stated in project policy |

### Forbidden responsibilities

Hooks MUST NOT perform actions that belong to agents, reviewers, or authority roles.

| forbidden action | why |
|---|---|
| issue product verdicts | verdicts require agent judgment, not automation |
| replace specialist review | review quality depends on domain reasoning |
| invent missing evidence | fabricated evidence undermines the entire gate model |
| convert ambiguous state into success | uncertainty must be surfaced, not hidden |
| bypass mandatory review or recovery rules | skipping safeguards erodes protocol trust |
| override the current contract without explicit policy authority | contract changes require deliberate approval |

## Hook Failure Handling

If a hook fails:

- the transition SHOULD stop by default
- one automatic retry MAY be attempted
- repeated failure SHOULD move the task to `blocked` or trigger recovery depending on cause
- partial side effects SHOULD be quarantined and not treated as valid evidence

## Conformance Classes

Conformance classes group related protocol expectations so that a project can describe which areas it enforces and where gaps remain.

A project MAY describe its maturity in local language, but baseline protocol conformance SHOULD cover at least the following classes:

| class | what it covers |
|---|---|
| state integrity conformance | task state transitions follow legal paths with required preconditions |
| artifact conformance | all required artifacts exist and validate against their schemas |
| review and gate conformance | reviews are routed correctly, gates are run, verdicts are recorded |
| recovery conformance | session recovery follows safe-boundary rules and produces valid state |
| evolution conformance | retrospectives, debt, gap assessments, and rules updates happen on schedule |
| observability conformance | telemetry is emitted at enforcement points and can be correlated |

## Core Conformance Scenarios

The following scenarios define what SHOULD happen when specific protocol violations or edge cases occur. Each scenario states the trigger condition and the expected enforcement response.

### State integrity

| scenario | expected response |
|---|---|
| `ready -> implementing` without approved contract | blocked |
| `implementing -> reviewed` without worker self-check | blocked |
| `verified -> passed` without final verdict | blocked |
| claimed `passed` with incomplete closure packet | blocked |

### Drift / revalidation

| scenario | expected response |
|---|---|
| stale task start without revalidation | blocked |
| integration attempt against mismatched base_snapshot | blocked |
| packet submitted after contract amendment without regeneration | blocked or warning by policy |

### Parallelism / locking

| scenario | expected response |
|---|---|
| overlapping unsafe locks running in parallel | blocked |
| simultaneous integration lane entry | blocked |
| abandoned lock not cleaned during recovery | warning, then blocked on repeated occurrence |

### Gate / rubric

| scenario | expected response |
|---|---|
| confidence tightening omitted when policy requires it | blocked |
| stub cap check omitted when placeholders are present | blocked |
| required eval evidence missing on agentic-control changes where mission mode or risk level requires it | blocked |

### Memory evolution

| scenario | expected response |
|---|---|
| direct promotion from weak anecdote to stable memory | blocked |
| superseded memory reused as active normative context | warning, then blocked on repeated occurrence |
| harmful reuse threshold exceeded without `under_review` transition | conformance failure |

### Evolution loop

| scenario | expected response |
|---|---|
| passed task without retrospective | warning, then blocked on repeated occurrence |
| phase closed without gap assessment | blocked |
| known debt omitted from transition review | conformance failure |

### Recovery

| scenario | expected response |
|---|---|
| exact resume attempted from unsafe boundary | blocked |
| claimed `verified` without gate artifact after interruption | state restoration |
| partial artifacts treated as canonical after recovery | blocked |

## Metrics Taxonomy

A healthy Geas implementation SHOULD observe at least six metric families. These families provide visibility into whether the protocol is producing good outcomes or drifting toward dysfunction.

### 1) Quality

Measures whether outputs meet their acceptance criteria and whether reviewers agree on quality.

| metric | what it tracks |
|---|---|
| gate fail rate | proportion of tasks that fail evidence gate |
| final verdict iterate rate | proportion of tasks sent back for rework by the Decision Maker |
| regression rate | previously passing criteria that fail after changes |
| acceptance-criterion miss rate | criteria marked incomplete at gate time |
| review disagreement rate | frequency of conflicting reviewer assessments |

### 2) Reliability

Measures whether the protocol infrastructure itself operates correctly.

| metric | what it tracks |
|---|---|
| recovery exact-resume rate | successful resumes from safe boundaries |
| recovery state-restoration rate | resumes requiring rollback to an earlier safe state |
| hook error rate | hook failures not caused by legitimate task problems |
| corrupted artifact rate | artifacts that fail schema validation unexpectedly |
| stale packet regeneration count | packets regenerated due to base_snapshot drift |

### 3) Throughput

Measures how efficiently work moves through the pipeline.

| metric | what it tracks |
|---|---|
| average task closure latency | time from `ready` to `passed` |
| queue time before implementation | time spent waiting for worker assignment |
| integration-lane wait time | time blocked waiting for integration access |
| time spent blocked | total time in `blocked` state across tasks |

### 4) Safety and risk

Measures whether high-risk work receives appropriate scrutiny.

| metric | what it tracks |
|---|---|
| critical-review challenge rate | proportion of high/critical tasks that receive Challenger review |
| policy override count | number of explicit policy overrides in the period |
| risk-area review coverage | proportion of risk-sensitive tasks with specialist review |
| placeholder / stub incident rate | stubs or placeholders discovered after integration |
| high-risk task escalation rate | proportion of high-risk tasks escalated to user |

### 5) Learning

Measures whether the protocol is improving itself over time.

| metric | what it tracks |
|---|---|
| memory promotion count | memories promoted to higher lifecycle states |
| successful memory reuse count | memories applied with positive outcome |
| harmful memory reuse count | memories applied with negative outcome |
| rules-update count | new or modified rules in the period |
| debt introduced vs resolved | balance of new debt against resolved debt |

### 6) Cost / efficiency

Measures whether effort is being wasted on avoidable rework or low-value activity.

| metric | what it tracks |
|---|---|
| repeated failure class count | distinct failure patterns that recur 3+ times |
| revalidation count | tasks requiring revalidation due to staleness |
| wasted speculative work count | work discarded due to incorrect assumptions |
| low-confidence worker rate | proportion of self-checks scoring 1-2 out of scale |

## Run Summary

A session SHOULD produce a human-readable run summary containing:

- tasks touched and final state
- failures / state restorations
- key reviews and verdicts
- memory and rules changes
- debt changes
- major timestamps or milestones

## Health Signals

Health signals are aggregate indicators derived from metrics that suggest systemic problems requiring attention. Projects SHOULD define concrete thresholds appropriate to their scale.

| signal | suggested threshold | meaning |
|---|---|---|
| memory bloat | many zero-reuse items relative to recent work | memory is accumulating faster than it is helping |
| review gap | repeated missing required reviews | review rigor is decaying |
| gate quality issue | iterate rate too high over recent tasks | requirements or gates are unclear |
| contradiction accumulation | stable memories repeatedly contradicted | memory review cadence is weak |
| repeated failure class | same failure pattern 3+ times | rule or memory hardening needed |
| debt stagnation | resolved debt significantly trails accepted debt | evolution phase is not paying off |
| scope-control weakness | repeated contract drift after approval | planning discipline is weak |
| low-confidence saturation | too many worker self-checks at 1-2 | tasks are oversized or context is weak |

## Observability Expectations

Observability enables post-hoc analysis and debugging of protocol behavior. An implementation SHOULD expose enough telemetry to correlate:

| dimension | example |
|---|---|
| which task was active | task_id in every trace span |
| which slot acted | slot name attached to each action |
| which artifact was produced or consumed | artifact type and identifier |
| which gate or hook ran | enforcement point name and outcome |
| which outcome occurred | pass, fail, block, error, iterate |
| resource consumption | time and cost per step where measurable |

Common naming SHOULD be used across traces, metrics, and logs so later analysis is possible.

## Detection Owner and Timing

Health calculations SHOULD happen at well-defined moments to ensure problems are caught early.

| timing | trigger |
|---|---|
| during `learning` | after each task completes retrospective |
| during phase transition review | before the mission moves to the next phase |
| on session start after recovery | as part of restore-context to detect pre-existing problems |
| on incident or policy override | immediately after exceptional events |

Results SHOULD be recorded in a visible health artifact or summary.

## Mandatory Responses

When a health signal exceeds its threshold, a project SHOULD define mandatory responses. Suggested defaults:

| signal | suggested response |
|---|---|
| memory bloat | review or archive low-value items |
| review gap | strengthen blocking at `pre_gate` |
| gate quality issue | clarify rubric or eval coverage |
| contradiction accumulation | move affected memory to `under_review` |
| repeated failure class | emit rule candidate and memory candidate |
| debt stagnation | schedule debt work explicitly |
| scope-control weakness | require stricter contract amendment |
| low-confidence saturation | split tasks or improve context packets |

## Traceability Cadence

At minimum, projects SHOULD review conformance at:

- mission close
- major delivery points
- after repeated recovery incidents
- after meaningful protocol changes
- after any policy override that weakened a normal hard-stop

## Policy Overrides

An override exists when a project intentionally weakens a normal hard-stop or requirement for a limited circumstance.

Override rules:

- MUST be explicit
- MUST have owner and rationale
- MUST state scope and expiration
- MUST NOT erase evidence obligations
- SHOULD trigger follow-up debt or review work

Higher-risk work SHOULD make overrides rarer and more visible, not easier.

## Key Statement

Enforcement is the difference between protocol and folklore. If Geas cannot block invalid progression, it is no longer governing the workflow.
