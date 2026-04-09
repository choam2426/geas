# Dashboard Schema Refactor Design

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Align dashboard (Tauri + React) with post-optimization protocol schemas and .geas/ directory structure

## Context

The protocol underwent a major optimization (v3):
- 30 schemas consolidated to 17 artifacts + `_defs`
- Per-step artifacts (gate-result, closure-packet, final-verdict, specialist-review, worker-self-check, challenge-review) merged into `record.schema.json` (single execution record per task)
- Role-based evidence merged into `evidence.schema.json`
- Memory simplified from 6 schemas + 9-state lifecycle to 2-state (draft/active) with `rules.md` + `memory/agents/{agent}.md`
- Task directory structure changed from flat files to nested directories

The dashboard's Rust models (`models.rs`), Tauri commands (`commands/mod.rs`), TypeScript types (`types.ts`), and React components are all misaligned with these changes.

## Design Decisions

1. **Read-only** — no write operations added
2. **Canonical only** — all legacy compatibility removed (no aliases, no fallback chains)
3. **Single pass** — all changes in one batch, not incremental
4. **Model-first (bottom-up)** — Rust models -> Tauri commands -> TS types -> React components

## Scope

### In-scope (11 artifact schemas)

| Schema | .geas/ Path | Display Location |
|--------|------------|-----------------|
| run-state | `state/run.json` | Project overview |
| health-check | `state/health-check.json` | Project overview (alert banner) |
| mission-spec | `missions/{mid}/spec.json` | Mission detail |
| design-brief | `missions/{mid}/design-brief.json` | Mission detail |
| vote-round | `missions/{mid}/decisions/*.json` | Mission detail |
| phase-review | `missions/{mid}/phase-reviews/*.json` | Mission detail |
| gap-assessment | `missions/{mid}/evolution/gap-assessment.json` | Mission detail |
| debt-register | `missions/{mid}/evolution/debt-register.json` | Mission detail |
| task-contract | `missions/{mid}/tasks/{tid}/contract.json` | Task detail |
| record | `missions/{mid}/tasks/{tid}/record.json` | Task detail |
| evidence | `missions/{mid}/tasks/{tid}/evidence/*.json` | Task detail |

### Out-of-scope (6 schemas)

lock-manifest, recovery-packet, rules-update, policy-override, failure-record, revalidation-record — operational/transient, no display value in read-only dashboard.

### Memory model change

`memory/entries/*.json` + `memory/candidates/*.json` (JSON, 9-state) -> `memory/agents/{agent}.md` (markdown, 2-state)

## .geas/ Path Changes

| Current (dashboard) | New canonical | Change |
|--------------------|-------------|--------|
| `tasks/*.json` (flat) | `tasks/{tid}/contract.json` | Structure change — directory-based |
| — | `tasks/{tid}/record.json` | New path |
| — | `tasks/{tid}/evidence/{agent}.json` | New path |
| `memory/entries/`, `memory/candidates/` | `memory/agents/{agent}.md` | Complete restructure |
| — | `state/health-check.json` | New path |
| — | `missions/{mid}/design-brief.json` | New path |
| — | `missions/{mid}/decisions/*.json` | New path |
| — | `missions/{mid}/phase-reviews/*.json` | New path |
| — | `missions/{mid}/evolution/gap-assessment.json` | New path |
| `state/run.json` | `state/run.json` | Same |
| `missions/{mid}/spec.json` | `missions/{mid}/spec.json` | Same |
| `missions/{mid}/evolution/debt-register.json` | `missions/{mid}/evolution/debt-register.json` | Same |
| `ledger/events.jsonl` / `state/events.jsonl` | `state/events.jsonl` | Same |
| `rules.md` | `rules.md` | Same |

## Rust Model Changes

### Existing model modifications

#### RunState
Add: `decisions: Vec<String>`, `session_latest_path: Option<String>`, `recovery_class: Option<String>`, `scheduler_state: Option<String>`, `created_at: Option<String>`

#### Checkpoint
Add: `pending_evidence: Vec<String>`, `retry_count: Option<u32>`, `remaining_steps: Vec<String>`, `checkpoint_phase: Option<String>`

#### TaskContract
Add: `version: Option<String>`, `artifact_type: Option<String>`, `artifact_id: Option<String>`, `producer_type: Option<String>`, `created_at: Option<String>`, `gate_profile: Option<String>`, `vote_round_policy: Option<String>`, `eval_commands: Vec<String>`, `rubric: Option<Rubric>`, `retry_budget: Option<u32>`, `base_snapshot: Option<String>`

New sub-struct `Rubric { dimensions: Vec<RubricDimension> }`, `RubricDimension { name: String, threshold: u32 }`

#### MissionSpec
Remove legacy fallbacks: `title`, `statement`, `risks`, `scope_in`, `scope_out` fields and `mission_name()` / `done_when_text()` helper methods.

Add: `version: Option<String>`, `artifact_type: Option<String>`, `artifact_id: Option<String>`, `producer_type: Option<String>`, `mission_id: Option<String>`, `source: Option<String>`, `affected_surfaces: Vec<String>`, `ambiguities: Vec<String>`, `completeness_checklist: Option<serde_json::Value>`

`scope` becomes `Option<MissionScope>` with `{ in_scope: Vec<String>, out_scope: Vec<String> }` (serde rename "in"/"out").

#### DebtRegister
Add: `version: Option<String>`, `artifact_type: Option<String>`, `artifact_id: Option<String>`, `producer_type: Option<String>`, `scope: Option<String>`, `created_at: Option<String>`, `rollup_by_kind: Option<KindRollup>`

New struct `KindRollup { output_quality, verification_gap, structural, risk, process, documentation, operations: u32 }`

#### DebtItem
Add: `owner_type: Option<String>`, `target_phase: Option<String>`

#### SeverityRollup
Remove `#[serde(alias = "medium")]` from `normal` field.

### New models

#### HealthCheck
```
version, artifact_type, artifact_id, producer_type: String
signals: Vec<HealthSignal>  // exactly 8
any_triggered: bool
trigger_context: Option<String>
created_at: String
```

`HealthSignal { name, detail: Option<String>, mandatory_response: Option<String>, value: f64, threshold: f64, triggered: bool }`

#### DesignBrief
```
version, artifact_type, artifact_id, producer_type, mission_id: String
depth: String  // lightweight|standard|full_depth
status: String  // draft|reviewing|approved
chosen_approach: String
non_goals: Vec<String>
verification_strategy: String
alternatives_considered: Vec<Alternative>  // Optional
architecture_decisions: Vec<ArchDecision>  // Optional
risks: Vec<DesignRisk>  // Optional
preserve_list: Vec<String>  // Optional
created_at: String
```

#### VoteRound
```
version, artifact_type, artifact_id, producer_type: String
round_type: String  // proposal_round|readiness_round
task_id: String
participants: Vec<String>
votes: Vec<Vote>
result: String  // agree|disagree|ship|iterate|escalate|inconclusive
quorum_met: bool
proposal_summary: Option<String>
created_at: String
```

`Vote { voter: String, vote: String, rationale: String, severity: Option<String> }`

#### PhaseReview
```
version, artifact_type, artifact_id, producer_type: String
mission_phase: String
status: String  // ready_to_enter|ready_to_exit|blocked|escalated
summary: String
gate_criteria_met: Vec<String>
gate_criteria_unmet: Vec<String>
risk_notes: Vec<String>
next_phase: Option<String>
created_at: String
```

#### GapAssessment
```
version, artifact_type, artifact_id, producer_type: String
scope_in_summary, scope_out_summary: String
fully_delivered, partially_delivered, not_delivered: Vec<String>
intentional_cuts, unexpected_additions, recommended_followups: Vec<String>
created_at: String
```

#### Record (task execution record)
```
version: String
task_id: String
created_at, updated_at: Option<String>
implementation_contract: Option<ImplContract>
self_check: Option<SelfCheck>
gate_result: Option<GateResult>
challenge_review: Option<ChallengeReview>
verdict: Option<Verdict>
closure: Option<Closure>
retrospective: Option<Retrospective>
```

Sub-structs:
- `ImplContract { planned_actions: Vec<String>, status: String, worker: Option<String>, edge_cases: Vec<String>, non_goals: Vec<String>, demo_steps: Vec<String> }`
- `SelfCheck { confidence: u32, summary: String, known_risks: Vec<String>, untested_paths: Vec<String> }`
- `GateResult { verdict: String, tier_results: Option<TierResults>, rubric_scores: Vec<RubricScore>, blocking_dimensions: Vec<String> }`
- `TierResults { tier_0: Option<TierResult>, tier_1: Option<TierResult>, tier_2: Option<TierResult> }`
- `TierResult { status: String, details: Option<String> }` (status: pass|fail|block|error|skipped)
- `RubricScore { dimension: String, score: f64, threshold: Option<f64>, passed: bool, rationale: Option<String> }`
- `ChallengeReview { concerns: Vec<ConcernItem>, blocking: bool, summary: Option<String> }`
- `ConcernItem` — serde untagged enum: either plain `String` or `{ severity: String, description: String }`
- `Verdict { verdict: String, rationale: String, rewind_target: Option<String> }`
- `Closure { change_summary: String, task_summary: Option<String>, reviews: Vec<ClosureReview>, open_risks: Vec<String>, debt_items: Vec<String> }`
- `ClosureReview { reviewer_type: String, status: String, summary: Option<String> }` (status: approved|changes_requested|blocked)
- `Retrospective { what_went_well: Vec<String>, what_broke: Vec<String>, what_was_surprising: Vec<String>, rule_candidates: Vec<String>, memory_candidates: Vec<String>, debt_candidates: Vec<String>, next_time_guidance: Vec<String> }`

#### Evidence
```
version: String
agent: String
task_id: String
role: String  // implementer|reviewer|tester|authority
summary: String
created_at: String
files_changed: Vec<String>  // if implementer
commit: Option<String>
verdict: Option<String>
concerns: Vec<String>  // if reviewer
blocking: Option<bool>
rationale: Option<String>  // if authority
criteria_results: Vec<CriteriaResult>  // if tester
rubric_scores: Vec<serde_json::Value>
```

`CriteriaResult { criterion: String, passed: bool, details: Option<String> }`

#### AgentMemory (replaces MemoryFile/MemoryMeta/MemorySignals)
```
agent_name: String
content: String  // raw markdown
```

### Removed models
- `MemoryFile`
- `MemoryMeta`
- `MemorySignals`
- `MemorySummary` (return type)
- `MemoryDetail` (return type)

## Tauri Command Changes

### Modified commands

| Command | Change |
|---------|--------|
| `get_project_summary` | Include health-check alert status, expanded checkpoint fields |
| `get_tasks` | Traverse `tasks/*/contract.json` instead of `tasks/*.json` |
| `count_tasks` | Directory-based counting |
| `infer_phase` | Directory-based task scanning |
| `get_debt_info` | Include `rollup_by_kind` in response |
| `get_mission_detail` | Add design-brief, phase-reviews, decisions, gap-assessment |
| `get_memories` | Read `memory/agents/*.md` as markdown instead of JSON entries/candidates |

### New commands

| Command | Path | Returns |
|---------|------|---------|
| `get_task_detail` | `tasks/{tid}/` (contract + record + evidence) | TaskDetail |
| `get_health_check` | `state/health-check.json` | HealthCheck |
| `get_design_brief` | `missions/{mid}/design-brief.json` | DesignBrief |
| `get_vote_rounds` | `missions/{mid}/decisions/*.json` | Vec<VoteRound> |
| `get_phase_reviews` | `missions/{mid}/phase-reviews/*.json` | Vec<PhaseReview> |
| `get_gap_assessment` | `missions/{mid}/evolution/gap-assessment.json` | GapAssessment |

## TypeScript Type Changes

1:1 sync with Rust return types:
- Update existing: `ProjectSummary` (health alert fields), `TaskInfo` (expanded fields), `DebtInfo` (rollup_by_kind), `MissionSummary`
- Add: `HealthCheck`, `HealthSignal`, `DesignBrief`, `VoteRound`, `Vote`, `PhaseReview`, `GapAssessment`, `Record`, `Evidence`, `TaskDetail`, `AgentMemory`
- Remove: `MemorySummary`, `MemoryDetail`

## React Component Changes

| Component | Change |
|-----------|--------|
| **ProjectDashboard** | Health-check alert banner when `any_triggered=true`, show triggered signal names |
| **KanbanBoard** | Task cards show record progress (which sections exist as completion indicators) |
| **MissionDetailView** | Add sections: design-brief (approach + alternatives), vote-round list, phase-review status, gap-assessment delivery summary |
| **TaskDetailView** (new/expand) | Record pipeline view (7 sections as progress steps) + evidence cards per agent (role, verdict, summary) |
| **DebtDetailPanel** | Add rollup_by_kind table/breakdown alongside existing severity rollup |
| **MemoryBrowser** | Replace entries/candidates JSON explorer with agent-based markdown viewer (list agents, show markdown content) |
