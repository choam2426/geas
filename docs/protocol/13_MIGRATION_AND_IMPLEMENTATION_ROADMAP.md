# 13. Migration and Implementation Roadmap

## Goal

Incrementally migrate the split docs and schemas from this bundle into the actual codebase.

## Phase 1 -- Minimum Enforceable State

**Dependencies**: none (starting phase)

Implement first:
1. `task.json` / `implementation-contract.json` validator
2. `worker-self-check.json` validator
3. `ready -> implementing` admission hook
4. `specialist-review.json` / `integration-result.json` / `gate-result.json`
5. `closure-packet.json` completeness check
6. `final-verdict.json` required for `passed` -- without it, `passed` is prohibited

**Completion criteria deliverables**:
- schemas: `task.schema.json`, `implementation-contract.schema.json`, `worker-self-check.schema.json`, `specialist-review.schema.json`, `integration-result.schema.json`, `gate-result.schema.json`, `closure-packet.schema.json`, `final-verdict.schema.json`
- hooks: `pre_implementation` admission hook, `post_implementation` self-check hook, `pre_verdict_submission` completeness hook
- artifacts: validator implementations for each schema

## Phase 2 -- Baseline, Stale, Parallelism

**Dependencies**: Phase 1 completion required

1. `base_commit` check
2. `revalidation-record.json`
3. lock manifest
4. integration lane serialization
5. bounded parallel dispatch

**Completion criteria deliverables**:
- schemas: `revalidation-record.schema.json`, `lock-manifest.schema.json`
- hooks: `stale_start` detection hook, `lock_conflict` detection hook, `integration_lane` serialization hook
- artifacts: base_commit comparison logic, parallel dispatch scheduler

## Phase 3 -- Evolution Core

**Dependencies**: Phase 2 completion required

1. `retrospective.json`
2. `rules-update.json`
3. `debt-register.json`
4. `gap-assessment.json`
5. phase review / mission summary wiring

**Completion criteria deliverables**:
- schemas: `retrospective.schema.json`, `rules-update.schema.json`, `debt-register.schema.json`, `gap-assessment.schema.json`, `phase-review.schema.json`
- hooks: `post_pass_learning` hook (enforces retrospective creation), `phase_transition_review` hook (checks for gap/debt/rules existence)
- artifacts: debt rollup aggregation logic, gap assessment comparison logic

## Phase 4 -- Memory Core

**Dependencies**: Phase 3 completion required

1. `memory-candidate.json`
2. `memory-entry.json`
3. `memory-review.json`
4. `memory-packet.json`
5. application log-based reinforcement / weakening
6. rules + agent_memory retrieval wiring

**Completion criteria deliverables**:
- schemas: `memory-candidate.schema.json`, `memory-entry.schema.json`, `memory-review.schema.json`, `memory-packet.schema.json`, `memory-application-log.schema.json`, `memory-index.schema.json`
- hooks: memory promotion gate hook, superseded memory injection warning hook
- artifacts: retrieval scoring logic, packet builder, confidence/freshness calculation logic

## Phase 5 -- Recovery and Context Engine

**Dependencies**: Phase 4 completion required

1. extended `run.json`
2. `recovery-packet.json`
3. `session-latest.md` / `task-focus` summary maintenance
4. packet stale regeneration hook
5. post-compact restore flow

**Completion criteria deliverables**:
- schemas: `run.schema.json` (extended), `recovery-packet.schema.json`
- hooks: `session_checkpoint` hook, `packet_stale` regeneration hook, post-compact restore hook
- artifacts: recovery decision table implementation, checkpoint two-phase write logic, recovery incident record generator

## Phase 6 -- Refinement

**Dependencies**: Phases 1-5 all completed required

1. conformance suite automation
2. chaos exercise
3. memory review cadence tooling
4. policy registry tuning
5. debt/gap dashboard

**Completion criteria deliverables**:
- conformance suite: automated test suite covering all conformance scenarios from doc 12
- chaos exercise scenario implementations (see below)
- memory review cadence management tool (review_after expiry detection and notification)
- policy registry: override management tool based on `.geas/rules.md`
- debt/gap dashboard: visualization of debt-register and gap-assessment

### Chaos Exercise Scope

Chaos exercises test the following 5 scenarios:
1. **mid-task interruption recovery**: forced session termination while task is in `implementing` state, followed by recovery
2. **stale worktree recovery**: resume when the worktree's base_commit is behind the current main
3. **lock orphan detection**: detecting and cleaning up locks that were not released after a task terminated
4. **contradictory memory handling**: verifying packet builder behavior when conflicting memory entries exist on the same topic
5. **missing specialist review gate**: verifying that gate entry is blocked when a required specialist review is missing

## Phase Failure Response

When a phase's completion criteria deliverables are not met:

1. **validator/hook implementation failure**: the phase is not marked as complete. The next phase cannot be entered.
2. **schema change incompatible with existing artifacts**: write a migration script to transform existing `.geas/` artifacts to the new schema. Artifacts that cannot be transformed are moved to a `_legacy/` subdirectory, and tasks referencing those artifacts undergo revalidation.
3. **defect from a previous phase discovered in a later phase**: return to the phase where the defect originated and fix it. Re-verify any deliverables from already-completed later phases that are affected by the defect.

## Skill Alignment Roadmap

Gaps exist between current skill implementations and the protocol. The protocol is the target; skills are aligned upward to meet the protocol.

### Phase 1 Targets (Minimum Enforcement)

| Gap | Current skill | Protocol target | Affected skills |
|-----|----------|-------------|----------|
| Worker Self-Check generation | consumed only, no generation skill | worker must generate `worker-self-check.json` on implementation completion | `evidence-gate`, `context-packet` |
| Closure Packet assembly | none | assemble `closure-packet.json` after gate pass | `initiative`, `sprint` |
| Task state model | 5-state (`pending -> in_progress -> in_review -> testing -> passed`) | 7-state (`drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed`) | `task-compiler`, `initiative`, `sprint` |
| Tier 0 (Precheck) | none | pre-check for artifact existence, state, and baseline | `evidence-gate` |
| `block` gate verdict | `pass \| fail \| iterate` | `pass \| fail \| block` (block = structural defect) | `evidence-gate` |
| Final Verdict separation | `product_authority` Tier 3 combines gate and verdict | separate Evidence Gate (objective verification) and Final Verdict (product judgment) | `evidence-gate`, `initiative`, `sprint` |

### Phase 2 Targets (Baseline, Parallelism)

| Gap | Current skill | Protocol target | Affected skills |
|-----|----------|-------------|----------|
| `base_commit` recording | not in TaskContract | `base_commit` required in task metadata | `task-compiler` |
| `gate_profile` classification | replaced by situational description | `code_change \| artifact_only \| closure_ready` enum | `task-compiler`, `evidence-gate` |
| `task_kind`, `risk_level` | not used | task classification fields for routing, budget, and gate decisions | `task-compiler` |
| `vote_round_policy` | not used | `never \| auto \| always` per task | `task-compiler`, `vote-round` |

### Phase 3 Targets (Evolution Core)

| Gap | Current skill | Protocol target | Affected skills |
|-----|----------|-------------|----------|
| `readiness_round` | none | `ship \| iterate \| escalate` vote + quorum | `vote-round` |
| Vote severity | none | `minor \| major` disagree classification | `vote-round` |
| Debt Register structured format | `.geas/debt.json` (unstructured) | `debt-register.json` with severity/kind/status | `initiative` |
| Evolution Exit Gate | none | gap-assessment + debt-register + rules-update + mission summary required | `initiative` |
| Retrospective timing | executed before task passed | executed after task passed | `initiative`, `sprint` |

### Phase 4 Targets (Memory Core)

| Gap | Current skill | Protocol target | Affected skills |
|-----|----------|-------------|----------|
| Memory Evolution Pipeline | none | 9-state lifecycle + 6-stage promotion | new skill required |
| Memory candidate extraction | manual | automated extraction rules (2+ repeated failures, etc.) | new skill required |
| Rules.md update conditions | direct modification | evidence refs >= 2 or authority approval + `rules-update.json` | `initiative`, `sprint` |
| Application logging | none | record effects when memory is applied | new mechanism required |
| Confidence per-dimension adjustment | global (entire threshold +1) | per-dimension (only the relevant dimension +1) | `evidence-gate` |

### Phase 5 Targets (Recovery, Context)

| Gap | Current skill | Protocol target | Affected skills |
|-----|----------|-------------|----------|
| `remaining_steps` checkpoint | exists in skill but not in protocol | needs protocol reflection (reverse alignment) | doc 10 update |
| Repeated partial delivery forward-feed | none | items appearing in 2+ gap assessments -> seed.json constraints | `initiative` |

### Skill-Specific Mechanisms Requiring Protocol Reflection

The items below exist in skills but not in the protocol. They should either be added to the protocol or explicitly declared out of scope.

| Skill-specific item | Description | Recommended action |
|--------------|------|----------|
| Critical Reviewer Pre-ship Challenge | challenge step between gate and verdict | add to protocol (closure packet -> critical_reviewer challenge -> final verdict) |
| Ship Gate (4-file check) | evidence bundle existence verification | integrate into Tier 0 (Precheck) |
| `remaining_steps` checkpoint | core mechanism for session recovery | reflect in doc 10 |
| Entropy Scan / Cleanup | dead code cleanup in polish phase | add to doc 02 polish phase |
| Run Summary | session audit trail | add to doc 12 observability |
| Sprint Wrap-Up | Lightweight post-resolve section for rules approval + debt update in Sprint | Add to doc 02 as Sprint pattern extension |

## Migration Rule

- The existing monolithic detail document is preserved as reference.
- New discussions and implementations use the split docs + schemas as canonical.
- When semantic conflicts with the monolith are found, the canonical split docs take precedence.
- If contradictions within the split docs themselves are discovered during migration, record the contradiction in `gap-assessment.json` and resolve it following the gap forward-feed procedure in doc 14.
