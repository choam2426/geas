# Dashboard Schema Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Tauri dashboard with post-optimization protocol schemas and .geas/ directory structure (11 artifact schemas, directory-based tasks, simplified memory).

**Architecture:** Bottom-up: Rust models → Tauri commands → TypeScript types → React components. Each task produces a compiling, testable unit. Legacy compatibility code (aliases, fallback chains) is removed.

**Tech Stack:** Rust + Tauri v2 (backend), React 19 + TypeScript + Tailwind CSS (frontend), serde for JSON deserialization.

---

### Task 1: Update Rust models — RunState, Checkpoint, and existing tests

**Files:**
- Modify: `dashboard/src-tauri/src/models.rs:8-42` (Checkpoint + RunState structs)
- Modify: `dashboard/src-tauri/src/commands/tests.rs:38-78` (RunState tests)

- [ ] **Step 1: Write a failing test for new RunState fields**

Add to `dashboard/src-tauri/src/commands/tests.rs`:

```rust
#[test]
fn run_state_with_new_fields() {
    let json = r#"{
        "version": "1.0",
        "status": "in_progress",
        "mission_id": "mission-001",
        "mission": "Build dashboard",
        "phase": "building",
        "current_task_id": "task-003",
        "completed_tasks": ["task-001", "task-002"],
        "decisions": ["decision-001"],
        "session_latest_path": ".geas/state/session-latest.md",
        "recovery_class": "warm_session_resume",
        "scheduler_state": "active",
        "created_at": "2026-04-06T10:00:00Z",
        "checkpoint": {
            "last_updated": "2026-04-06T10:00:00Z",
            "pipeline_step": "implementation",
            "agent_in_flight": "software-engineer",
            "pending_evidence": ["evidence-001"],
            "retry_count": 2,
            "parallel_batch": ["task-003", "task-004"],
            "completed_in_batch": ["task-003"],
            "remaining_steps": ["review", "integrate"],
            "checkpoint_phase": "committed"
        }
    }"#;

    let rs: RunState = serde_json::from_str(json).unwrap();
    assert_eq!(rs.decisions.len(), 1);
    assert_eq!(rs.session_latest_path.as_deref(), Some(".geas/state/session-latest.md"));
    assert_eq!(rs.recovery_class.as_deref(), Some("warm_session_resume"));
    assert_eq!(rs.scheduler_state.as_deref(), Some("active"));
    assert_eq!(rs.created_at.as_deref(), Some("2026-04-06T10:00:00Z"));
    let cp = rs.checkpoint.unwrap();
    assert_eq!(cp.pending_evidence.len(), 1);
    assert_eq!(cp.retry_count, Some(2));
    assert_eq!(cp.remaining_steps.len(), 2);
    assert_eq!(cp.checkpoint_phase.as_deref(), Some("committed"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard/src-tauri && cargo test run_state_with_new_fields -- --nocapture`
Expected: FAIL — fields `decisions`, `session_latest_path`, etc. don't exist on RunState.

- [ ] **Step 3: Update Checkpoint struct**

In `dashboard/src-tauri/src/models.rs`, replace the Checkpoint struct:

```rust
/// Checkpoint within RunState
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Checkpoint {
    #[serde(default)]
    pub last_updated: Option<String>,
    #[serde(default)]
    pub pipeline_step: Option<String>,
    #[serde(default)]
    pub agent_in_flight: Option<String>,
    #[serde(default)]
    pub pending_evidence: Vec<String>,
    #[serde(default)]
    pub retry_count: Option<u32>,
    #[serde(default)]
    pub parallel_batch: Option<Vec<String>>,
    #[serde(default)]
    pub completed_in_batch: Vec<String>,
    #[serde(default)]
    pub remaining_steps: Vec<String>,
    #[serde(default)]
    pub checkpoint_phase: Option<String>,
}
```

- [ ] **Step 4: Update RunState struct**

In `dashboard/src-tauri/src/models.rs`, replace the RunState struct:

```rust
/// .geas/state/run.json
#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct RunState {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub mission: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub current_task_id: Option<String>,
    #[serde(default)]
    pub completed_tasks: Vec<String>,
    #[serde(default)]
    pub decisions: Vec<String>,
    #[serde(default)]
    pub session_latest_path: Option<String>,
    #[serde(default)]
    pub recovery_class: Option<String>,
    #[serde(default)]
    pub scheduler_state: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub checkpoint: Option<Checkpoint>,
}
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: ALL PASS (existing tests + new test).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src-tauri/src/models.rs dashboard/src-tauri/src/commands/tests.rs
git commit -m "refactor(dashboard): update RunState and Checkpoint to match canonical schema"
```

---

### Task 2: Update Rust models — TaskContract with new fields

**Files:**
- Modify: `dashboard/src-tauri/src/models.rs:44-82` (TaskContract, TaskRouting, TaskScope)
- Modify: `dashboard/src-tauri/src/commands/tests.rs` (TaskContract tests)

- [ ] **Step 1: Write a failing test for new TaskContract fields**

Add to `dashboard/src-tauri/src/commands/tests.rs`:

```rust
#[test]
fn task_contract_with_schema_fields() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "task_contract",
        "artifact_id": "tc-001",
        "producer_type": "orchestration_authority",
        "created_at": "2026-04-06T10:00:00Z",
        "task_id": "task-012",
        "title": "Extend TaskInfo",
        "goal": "Add new fields to TaskInfo",
        "task_kind": "implementation",
        "risk_level": "normal",
        "status": "ready",
        "gate_profile": "implementation_change",
        "vote_round_policy": "auto",
        "eval_commands": ["cargo test", "npm test"],
        "rubric": {
            "dimensions": [
                { "name": "correctness", "threshold": 4 },
                { "name": "completeness", "threshold": 3 }
            ]
        },
        "retry_budget": 3,
        "base_snapshot": "abc123",
        "acceptance_criteria": ["AC1", "AC2"],
        "scope": { "surfaces": ["models.rs"] },
        "routing": {
            "primary_worker_type": "software-engineer",
            "required_reviewer_types": ["design-authority"]
        }
    }"#;

    let tc: TaskContract = serde_json::from_str(json).unwrap();
    assert_eq!(tc.version.as_deref(), Some("1.0"));
    assert_eq!(tc.artifact_type.as_deref(), Some("task_contract"));
    assert_eq!(tc.artifact_id.as_deref(), Some("tc-001"));
    assert_eq!(tc.producer_type.as_deref(), Some("orchestration_authority"));
    assert_eq!(tc.created_at.as_deref(), Some("2026-04-06T10:00:00Z"));
    assert_eq!(tc.gate_profile.as_deref(), Some("implementation_change"));
    assert_eq!(tc.vote_round_policy.as_deref(), Some("auto"));
    assert_eq!(tc.eval_commands.len(), 2);
    let rubric = tc.rubric.unwrap();
    assert_eq!(rubric.dimensions.len(), 2);
    assert_eq!(rubric.dimensions[0].name, "correctness");
    assert_eq!(rubric.dimensions[0].threshold, 4);
    assert_eq!(tc.retry_budget, Some(3));
    assert_eq!(tc.base_snapshot.as_deref(), Some("abc123"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard/src-tauri && cargo test task_contract_with_schema_fields -- --nocapture`
Expected: FAIL — fields don't exist.

- [ ] **Step 3: Add Rubric structs and update TaskContract**

In `dashboard/src-tauri/src/models.rs`, add before TaskContract:

```rust
/// Rubric dimension
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct RubricDimension {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub threshold: u32,
}

/// Rubric block inside a TaskContract
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Rubric {
    #[serde(default)]
    pub dimensions: Vec<RubricDimension>,
}
```

Replace the TaskContract struct:

```rust
/// .geas/missions/{id}/tasks/{tid}/contract.json
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaskContract {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub goal: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub task_kind: Option<String>,
    #[serde(default)]
    pub gate_profile: Option<String>,
    #[serde(default)]
    pub vote_round_policy: Option<String>,
    #[serde(default)]
    pub eval_commands: Vec<String>,
    #[serde(default)]
    pub rubric: Option<Rubric>,
    #[serde(default)]
    pub retry_budget: Option<u32>,
    #[serde(default)]
    pub base_snapshot: Option<String>,
    #[serde(default)]
    pub routing: Option<TaskRouting>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub scope: Option<TaskScope>,
}
```

- [ ] **Step 4: Update test imports**

In `dashboard/src-tauri/src/commands/tests.rs`, update the import line:

```rust
use crate::models::{DebtItem, DebtRegister, MissionSpec, Rubric, RunState, SeverityRollup, TaskContract, TaskScope};
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src-tauri/src/models.rs dashboard/src-tauri/src/commands/tests.rs
git commit -m "refactor(dashboard): update TaskContract with canonical schema fields"
```

---

### Task 3: Update Rust models — MissionSpec (remove legacy, add canonical)

**Files:**
- Modify: `dashboard/src-tauri/src/models.rs:84-196` (MissionSpec, MissionScopeNested, MissionSpecDetail)
- Modify: `dashboard/src-tauri/src/commands/tests.rs` (MissionSpec tests)

- [ ] **Step 1: Write a failing test for canonical MissionSpec**

Add to `dashboard/src-tauri/src/commands/tests.rs`:

```rust
#[test]
fn mission_spec_canonical_fields() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "mission_spec",
        "artifact_id": "ms-001",
        "producer_type": "product_authority",
        "mission_id": "mission-001",
        "created_at": "2026-04-01T08:00:00Z",
        "mission": "Build the dashboard MVP",
        "done_when": "All tasks pass",
        "scope": {
            "in": ["models", "commands"],
            "out": ["CI/CD"]
        },
        "acceptance_criteria": ["AC1"],
        "constraints": ["No breaking changes"],
        "source": "full_intake",
        "domain_profile": "software",
        "mode": "standard",
        "target_user": "developer",
        "affected_surfaces": ["dashboard"],
        "risk_notes": ["Tight deadline"],
        "assumptions": ["Schema is stable"],
        "ambiguities": ["Memory format unclear"]
    }"#;

    let spec: MissionSpec = serde_json::from_str(json).unwrap();
    assert_eq!(spec.version.as_deref(), Some("1.0"));
    assert_eq!(spec.artifact_type.as_deref(), Some("mission_spec"));
    assert_eq!(spec.artifact_id.as_deref(), Some("ms-001"));
    assert_eq!(spec.producer_type.as_deref(), Some("product_authority"));
    assert_eq!(spec.mission_id.as_deref(), Some("mission-001"));
    assert_eq!(spec.mission.as_deref(), Some("Build the dashboard MVP"));
    assert_eq!(spec.source.as_deref(), Some("full_intake"));
    assert_eq!(spec.affected_surfaces.len(), 1);
    assert_eq!(spec.ambiguities.len(), 1);
    let scope = spec.scope.unwrap();
    assert_eq!(scope.scope_in.len(), 2);
    assert_eq!(scope.scope_out.len(), 1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard/src-tauri && cargo test mission_spec_canonical_fields -- --nocapture`
Expected: FAIL.

- [ ] **Step 3: Replace MissionSpec, MissionScopeNested, and MissionSpecDetail**

In `dashboard/src-tauri/src/models.rs`, replace lines 84-196 with:

```rust
/// Scope block inside a MissionSpec (scope.in / scope.out)
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MissionScope {
    #[serde(default, rename = "in")]
    pub scope_in: Vec<String>,
    #[serde(default, rename = "out")]
    pub scope_out: Vec<String>,
}

/// .geas/missions/{id}/spec.json
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MissionSpec {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub mission: Option<String>,
    #[serde(default)]
    pub done_when: Option<String>,
    #[serde(default)]
    pub scope: Option<MissionScope>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub domain_profile: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub target_user: Option<String>,
    #[serde(default)]
    pub affected_surfaces: Vec<String>,
    #[serde(default)]
    pub risk_notes: Vec<String>,
    #[serde(default)]
    pub assumptions: Vec<String>,
    #[serde(default)]
    pub ambiguities: Vec<String>,
    #[serde(default)]
    pub completeness_checklist: Option<serde_json::Value>,
}

/// Detail struct returned to the frontend for mission spec rendering
#[derive(Debug, Clone, Serialize)]
pub struct MissionSpecDetail {
    pub mission_id: String,
    pub mission: Option<String>,
    pub done_when: Option<String>,
    pub scope_in: Vec<String>,
    pub scope_out: Vec<String>,
    pub acceptance_criteria: Vec<String>,
    pub constraints: Vec<String>,
    pub domain_profile: Option<String>,
    pub mode: Option<String>,
    pub target_user: Option<String>,
    pub source: Option<String>,
    pub risk_notes: Vec<String>,
    pub assumptions: Vec<String>,
    pub ambiguities: Vec<String>,
    pub affected_surfaces: Vec<String>,
    pub created_at: Option<String>,
}
```

- [ ] **Step 4: Update get_mission_spec command to remove fallback logic**

In `dashboard/src-tauri/src/commands/mod.rs`, replace the `get_mission_spec` function body (lines 376-404):

```rust
#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_spec(path: String, mission_id: String) -> Result<MissionSpecDetail, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let spec_path = geas.join("missions").join(&mission_id).join("spec.json");
    let spec: MissionSpec = read_json_file(&spec_path)?.unwrap_or_default();

    let scope = spec.scope.unwrap_or_default();

    Ok(MissionSpecDetail {
        mission_id,
        mission: spec.mission,
        done_when: spec.done_when,
        scope_in: scope.scope_in,
        scope_out: scope.scope_out,
        acceptance_criteria: spec.acceptance_criteria,
        constraints: spec.constraints,
        domain_profile: spec.domain_profile,
        mode: spec.mode,
        target_user: spec.target_user,
        source: spec.source,
        risk_notes: spec.risk_notes,
        assumptions: spec.assumptions,
        ambiguities: spec.ambiguities,
        affected_surfaces: spec.affected_surfaces,
        created_at: spec.created_at,
    })
}
```

- [ ] **Step 5: Update get_mission_history to use spec.mission directly**

In `dashboard/src-tauri/src/commands/mod.rs`, in `get_mission_history` (around line 348), change:

```rust
            mission_name: spec.mission_name(),
```

to:

```rust
            mission_name: spec.mission.clone(),
```

- [ ] **Step 6: Update existing MissionSpec tests**

In `dashboard/src-tauri/src/commands/tests.rs`, update the `mission_spec_extra_fields_ignored` test — the `#[serde(deny_unknown_fields)]` is not used, so this test should still pass. Also update `mission_spec_full_json` to verify new shape. Remove any references to `mission_name()` helper:

```rust
#[test]
fn mission_spec_full_json() {
    let json = r#"{
        "mission": "Build the dashboard MVP",
        "created_at": "2026-04-01T08:00:00Z"
    }"#;

    let spec: MissionSpec = serde_json::from_str(json).unwrap();
    assert_eq!(spec.mission.as_deref(), Some("Build the dashboard MVP"));
    assert_eq!(spec.created_at.as_deref(), Some("2026-04-01T08:00:00Z"));
}
```

- [ ] **Step 7: Run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: ALL PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src-tauri/src/models.rs dashboard/src-tauri/src/commands/mod.rs dashboard/src-tauri/src/commands/tests.rs
git commit -m "refactor(dashboard): update MissionSpec to canonical schema, remove legacy fallbacks"
```

---

### Task 4: Update Rust models — DebtRegister, DebtItem, SeverityRollup

**Files:**
- Modify: `dashboard/src-tauri/src/models.rs` (DebtItem, SeverityRollup, DebtRegister)
- Modify: `dashboard/src-tauri/src/commands/tests.rs`

- [ ] **Step 1: Write a failing test for KindRollup and new DebtItem fields**

Add to `dashboard/src-tauri/src/commands/tests.rs`:

```rust
#[test]
fn debt_register_with_kind_rollup() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "debt_register",
        "artifact_id": "dr-001",
        "producer_type": "design_authority",
        "scope": "mission",
        "created_at": "2026-04-06T10:00:00Z",
        "items": [{
            "debt_id": "debt-001",
            "severity": "high",
            "kind": "risk",
            "title": "Missing error handling",
            "description": "Desc",
            "status": "open",
            "owner_type": "software-engineer",
            "target_phase": "polishing"
        }],
        "rollup_by_severity": { "low": 0, "normal": 1, "high": 1, "critical": 0 },
        "rollup_by_kind": {
            "output_quality": 0, "verification_gap": 0, "structural": 0,
            "risk": 1, "process": 0, "documentation": 0, "operations": 0
        }
    }"#;

    let dr: DebtRegister = serde_json::from_str(json).unwrap();
    assert_eq!(dr.version.as_deref(), Some("1.0"));
    assert_eq!(dr.scope.as_deref(), Some("mission"));
    let kind = dr.rollup_by_kind.unwrap();
    assert_eq!(kind.risk, 1);
    assert_eq!(dr.items[0].owner_type.as_deref(), Some("software-engineer"));
    assert_eq!(dr.items[0].target_phase.as_deref(), Some("polishing"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard/src-tauri && cargo test debt_register_with_kind_rollup -- --nocapture`
Expected: FAIL.

- [ ] **Step 3: Update models**

In `dashboard/src-tauri/src/models.rs`:

Remove `alias = "medium"` from SeverityRollup:
```rust
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct SeverityRollup {
    #[serde(default)]
    pub low: u32,
    #[serde(default)]
    pub normal: u32,
    #[serde(default)]
    pub high: u32,
    #[serde(default)]
    pub critical: u32,
}
```

Add KindRollup:
```rust
/// Kind rollup counts
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct KindRollup {
    #[serde(default)]
    pub output_quality: u32,
    #[serde(default)]
    pub verification_gap: u32,
    #[serde(default)]
    pub structural: u32,
    #[serde(default)]
    pub risk: u32,
    #[serde(default)]
    pub process: u32,
    #[serde(default)]
    pub documentation: u32,
    #[serde(default)]
    pub operations: u32,
}
```

Add fields to DebtItem:
```rust
pub struct DebtItem {
    // ... existing fields ...
    #[serde(default)]
    pub owner_type: Option<String>,
    #[serde(default)]
    pub target_phase: Option<String>,
}
```

Update DebtRegister:
```rust
#[derive(Debug, Clone, Default, Deserialize)]
pub struct DebtRegister {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub items: Vec<DebtItem>,
    #[serde(default)]
    pub rollup_by_severity: Option<SeverityRollup>,
    #[serde(default)]
    pub rollup_by_kind: Option<KindRollup>,
}
```

- [ ] **Step 4: Update severity_rollup_medium_alias test**

Remove or update the `severity_rollup_medium_alias` test since we no longer support `medium` alias:

```rust
#[test]
fn severity_rollup_canonical_only() {
    let json = r#"{ "low": 1, "normal": 3, "high": 2, "critical": 0 }"#;
    let sr: SeverityRollup = serde_json::from_str(json).unwrap();
    assert_eq!(sr.low, 1);
    assert_eq!(sr.normal, 3);
    assert_eq!(sr.high, 2);
    assert_eq!(sr.critical, 0);
}
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src-tauri/src/models.rs dashboard/src-tauri/src/commands/tests.rs
git commit -m "refactor(dashboard): update DebtRegister with kind rollup, remove medium alias"
```

---

### Task 5: Add new Rust models — Record, Evidence, HealthCheck, DesignBrief, VoteRound, PhaseReview, GapAssessment, AgentMemory

**Files:**
- Modify: `dashboard/src-tauri/src/models.rs` (add new structs, remove old Memory structs)
- Modify: `dashboard/src-tauri/src/commands/tests.rs` (add deserialization tests)

- [ ] **Step 1: Write failing tests for new models**

Add to `dashboard/src-tauri/src/commands/tests.rs`:

```rust
use crate::models::{Record, Evidence, HealthCheck, DesignBrief, VoteRound, PhaseReview, GapAssessment};

#[test]
fn record_partial_sections() {
    let json = r#"{
        "version": "1.0",
        "task_id": "task-001",
        "self_check": { "confidence": 4, "summary": "Looks good" },
        "gate_result": { "verdict": "pass" }
    }"#;
    let rec: Record = serde_json::from_str(json).unwrap();
    assert_eq!(rec.task_id.as_deref(), Some("task-001"));
    assert!(rec.self_check.is_some());
    assert_eq!(rec.self_check.unwrap().confidence, Some(4));
    assert!(rec.gate_result.is_some());
    assert_eq!(rec.gate_result.unwrap().verdict.as_deref(), Some("pass"));
    assert!(rec.implementation_contract.is_none());
    assert!(rec.verdict.is_none());
}

#[test]
fn evidence_implementer() {
    let json = r#"{
        "version": "1.0",
        "agent": "software-engineer",
        "task_id": "task-001",
        "role": "implementer",
        "summary": "Implemented feature X",
        "created_at": "2026-04-06T10:00:00Z",
        "files_changed": ["src/main.rs", "src/lib.rs"],
        "commit": "abc123"
    }"#;
    let ev: Evidence = serde_json::from_str(json).unwrap();
    assert_eq!(ev.agent.as_deref(), Some("software-engineer"));
    assert_eq!(ev.role.as_deref(), Some("implementer"));
    assert_eq!(ev.files_changed.len(), 2);
    assert_eq!(ev.commit.as_deref(), Some("abc123"));
}

#[test]
fn health_check_with_signals() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "health_check",
        "artifact_id": "hc-001",
        "producer_type": "orchestration_authority",
        "any_triggered": true,
        "trigger_context": "phase_transition",
        "created_at": "2026-04-06T10:00:00Z",
        "signals": [
            { "name": "memory_bloat", "value": 5.0, "threshold": 10.0, "triggered": false },
            { "name": "debt_stagnation", "value": 15.0, "threshold": 10.0, "triggered": true, "detail": "3 items stale", "mandatory_response": "Review debt" }
        ]
    }"#;
    let hc: HealthCheck = serde_json::from_str(json).unwrap();
    assert!(hc.any_triggered);
    assert_eq!(hc.signals.len(), 2);
    assert!(hc.signals[1].triggered);
    assert_eq!(hc.signals[1].mandatory_response.as_deref(), Some("Review debt"));
}

#[test]
fn design_brief_standard() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "design_brief",
        "artifact_id": "db-001",
        "producer_type": "orchestration_authority",
        "mission_id": "mission-001",
        "depth": "standard",
        "status": "approved",
        "chosen_approach": "Bottom-up refactor",
        "non_goals": ["CI changes"],
        "verification_strategy": "Unit tests + integration test",
        "created_at": "2026-04-06T10:00:00Z",
        "architecture_decisions": [
            { "decision": "Use serde", "rationale": "Standard Rust" }
        ]
    }"#;
    let db: DesignBrief = serde_json::from_str(json).unwrap();
    assert_eq!(db.chosen_approach.as_deref(), Some("Bottom-up refactor"));
    assert_eq!(db.depth.as_deref(), Some("standard"));
    assert_eq!(db.architecture_decisions.len(), 1);
}

#[test]
fn vote_round_with_votes() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "vote_round",
        "artifact_id": "vr-001",
        "producer_type": "orchestration_authority",
        "round_type": "proposal_round",
        "task_id": "task-001",
        "participants": ["design-authority", "challenger"],
        "votes": [
            { "voter": "design-authority", "vote": "agree", "rationale": "Looks good" },
            { "voter": "challenger", "vote": "disagree", "rationale": "Missing tests", "severity": "major" }
        ],
        "result": "disagree",
        "quorum_met": true,
        "created_at": "2026-04-06T10:00:00Z"
    }"#;
    let vr: VoteRound = serde_json::from_str(json).unwrap();
    assert_eq!(vr.votes.len(), 2);
    assert_eq!(vr.votes[1].severity.as_deref(), Some("major"));
    assert_eq!(vr.result.as_deref(), Some("disagree"));
}

#[test]
fn gap_assessment_delivery() {
    let json = r#"{
        "version": "1.0",
        "artifact_type": "gap_assessment",
        "artifact_id": "ga-001",
        "producer_type": "product_authority",
        "scope_in_summary": "All features",
        "scope_out_summary": "No CI",
        "fully_delivered": ["Feature A"],
        "partially_delivered": ["Feature B"],
        "not_delivered": [],
        "intentional_cuts": ["Feature C"],
        "unexpected_additions": [],
        "recommended_followups": ["Polish Feature B"],
        "created_at": "2026-04-06T10:00:00Z"
    }"#;
    let ga: GapAssessment = serde_json::from_str(json).unwrap();
    assert_eq!(ga.fully_delivered.len(), 1);
    assert_eq!(ga.intentional_cuts.len(), 1);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard/src-tauri && cargo test record_partial_sections -- --nocapture`
Expected: FAIL — `Record` type doesn't exist.

- [ ] **Step 3: Add all new model structs**

In `dashboard/src-tauri/src/models.rs`, after the DebtRegister section and before the frontend return types section, add:

```rust
// ---------------------------------------------------------------------------
// New artifact models (post-optimization schemas)
// ---------------------------------------------------------------------------

/// record.json section: implementation_contract
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct ImplContract {
    #[serde(default)]
    pub planned_actions: Vec<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub worker: Option<String>,
    #[serde(default)]
    pub edge_cases: Vec<String>,
    #[serde(default)]
    pub non_goals: Vec<String>,
    #[serde(default)]
    pub demo_steps: Vec<String>,
}

/// record.json section: self_check
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct SelfCheck {
    #[serde(default)]
    pub confidence: Option<u32>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub known_risks: Vec<String>,
    #[serde(default)]
    pub untested_paths: Vec<String>,
}

/// record.json sub: tier result
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TierResult {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
}

/// record.json sub: tier results
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TierResults {
    #[serde(default)]
    pub tier_0: Option<TierResult>,
    #[serde(default)]
    pub tier_1: Option<TierResult>,
    #[serde(default)]
    pub tier_2: Option<TierResult>,
}

/// record.json sub: rubric score
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct RubricScore {
    #[serde(default)]
    pub dimension: Option<String>,
    #[serde(default)]
    pub score: Option<f64>,
    #[serde(default)]
    pub threshold: Option<f64>,
    #[serde(default)]
    pub passed: Option<bool>,
    #[serde(default)]
    pub rationale: Option<String>,
}

/// record.json section: gate_result
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct GateResult {
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub tier_results: Option<TierResults>,
    #[serde(default)]
    pub rubric_scores: Vec<RubricScore>,
    #[serde(default)]
    pub blocking_dimensions: Vec<String>,
}

/// record.json section: challenge_review
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct ChallengeReview {
    #[serde(default)]
    pub concerns: Vec<serde_json::Value>,
    #[serde(default)]
    pub blocking: Option<bool>,
    #[serde(default)]
    pub summary: Option<String>,
}

/// record.json section: verdict
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Verdict {
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub rewind_target: Option<String>,
}

/// record.json sub: closure review
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct ClosureReview {
    #[serde(default)]
    pub reviewer_type: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
}

/// record.json section: closure
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Closure {
    #[serde(default)]
    pub change_summary: Option<String>,
    #[serde(default)]
    pub task_summary: Option<String>,
    #[serde(default)]
    pub reviews: Vec<ClosureReview>,
    #[serde(default)]
    pub open_risks: Vec<String>,
    #[serde(default)]
    pub debt_items: Vec<String>,
}

/// record.json section: retrospective
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Retrospective {
    #[serde(default)]
    pub what_went_well: Vec<String>,
    #[serde(default)]
    pub what_broke: Vec<String>,
    #[serde(default)]
    pub what_was_surprising: Vec<String>,
    #[serde(default)]
    pub rule_candidates: Vec<String>,
    #[serde(default)]
    pub memory_candidates: Vec<String>,
    #[serde(default)]
    pub debt_candidates: Vec<String>,
    #[serde(default)]
    pub next_time_guidance: Vec<String>,
}

/// .geas/missions/{mid}/tasks/{tid}/record.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Record {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub implementation_contract: Option<ImplContract>,
    #[serde(default)]
    pub self_check: Option<SelfCheck>,
    #[serde(default)]
    pub gate_result: Option<GateResult>,
    #[serde(default)]
    pub challenge_review: Option<ChallengeReview>,
    #[serde(default)]
    pub verdict: Option<Verdict>,
    #[serde(default)]
    pub closure: Option<Closure>,
    #[serde(default)]
    pub retrospective: Option<Retrospective>,
}

/// Criteria result in evidence (tester role)
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct CriteriaResult {
    #[serde(default)]
    pub criterion: Option<String>,
    #[serde(default)]
    pub passed: Option<bool>,
    #[serde(default)]
    pub details: Option<String>,
}

/// .geas/missions/{mid}/tasks/{tid}/evidence/{agent}.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Evidence {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub files_changed: Vec<String>,
    #[serde(default)]
    pub commit: Option<String>,
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub concerns: Vec<String>,
    #[serde(default)]
    pub blocking: Option<bool>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub criteria_results: Vec<CriteriaResult>,
    #[serde(default)]
    pub rubric_scores: Vec<RubricScore>,
}

/// Health signal inside HealthCheck
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct HealthSignal {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub threshold: Option<f64>,
    #[serde(default)]
    pub triggered: bool,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub mandatory_response: Option<String>,
}

/// .geas/state/health-check.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct HealthCheck {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub signals: Vec<HealthSignal>,
    #[serde(default)]
    pub any_triggered: bool,
    #[serde(default)]
    pub trigger_context: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Alternative inside DesignBrief
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Alternative {
    #[serde(default)]
    pub approach: Option<String>,
    #[serde(default)]
    pub rejected_reason: Option<String>,
}

/// Architecture decision inside DesignBrief
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct ArchDecision {
    #[serde(default)]
    pub decision: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
}

/// Design risk inside DesignBrief
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct DesignRisk {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub mitigation: Option<String>,
}

/// .geas/missions/{mid}/design-brief.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct DesignBrief {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub depth: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub chosen_approach: Option<String>,
    #[serde(default)]
    pub non_goals: Vec<String>,
    #[serde(default)]
    pub verification_strategy: Option<String>,
    #[serde(default)]
    pub alternatives_considered: Vec<Alternative>,
    #[serde(default)]
    pub architecture_decisions: Vec<ArchDecision>,
    #[serde(default)]
    pub risks: Vec<DesignRisk>,
    #[serde(default)]
    pub preserve_list: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Vote inside VoteRound
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Vote {
    #[serde(default)]
    pub voter: Option<String>,
    #[serde(default)]
    pub vote: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
}

/// .geas/missions/{mid}/decisions/*.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct VoteRound {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub round_type: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub participants: Vec<String>,
    #[serde(default)]
    pub votes: Vec<Vote>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub quorum_met: Option<bool>,
    #[serde(default)]
    pub proposal_summary: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// .geas/missions/{mid}/phase-reviews/*.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct PhaseReview {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub mission_phase: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub gate_criteria_met: Vec<String>,
    #[serde(default)]
    pub gate_criteria_unmet: Vec<String>,
    #[serde(default)]
    pub risk_notes: Vec<String>,
    #[serde(default)]
    pub next_phase: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// .geas/missions/{mid}/evolution/gap-assessment.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct GapAssessment {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub artifact_type: Option<String>,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub producer_type: Option<String>,
    #[serde(default)]
    pub scope_in_summary: Option<String>,
    #[serde(default)]
    pub scope_out_summary: Option<String>,
    #[serde(default)]
    pub fully_delivered: Vec<String>,
    #[serde(default)]
    pub partially_delivered: Vec<String>,
    #[serde(default)]
    pub not_delivered: Vec<String>,
    #[serde(default)]
    pub intentional_cuts: Vec<String>,
    #[serde(default)]
    pub unexpected_additions: Vec<String>,
    #[serde(default)]
    pub recommended_followups: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Agent memory (markdown file)
#[derive(Debug, Clone, Serialize)]
pub struct AgentMemory {
    pub agent_name: String,
    pub content: String,
}
```

- [ ] **Step 4: Remove old Memory models**

In `dashboard/src-tauri/src/models.rs`, delete the entire `// Memory models` section: `MemoryMeta`, `MemorySignals`, `MemoryFile`, and the `// Memory frontend return types` section: `MemorySummary`, `MemoryDetail`, `MemorySignalsInfo`.

- [ ] **Step 5: Run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: Compile errors in `commands/mod.rs` referencing removed Memory types — that's expected, we'll fix in the next task. The new model tests should pass if we temporarily comment out the import errors. Instead, let's just verify the models compile:

Run: `cd dashboard/src-tauri && cargo check 2>&1 | head -20`
Expected: Errors only about removed Memory types in commands/mod.rs, not in models.rs.

- [ ] **Step 6: Commit (models only, commands will be fixed next)**

```bash
git add dashboard/src-tauri/src/models.rs dashboard/src-tauri/src/commands/tests.rs
git commit -m "feat(dashboard): add Record, Evidence, HealthCheck, DesignBrief, VoteRound, PhaseReview, GapAssessment models"
```

---

### Task 6: Update Tauri commands — directory-based tasks + new artifact readers

**Files:**
- Modify: `dashboard/src-tauri/src/commands/mod.rs`
- Modify: `dashboard/src-tauri/src/lib.rs`

- [ ] **Step 1: Update imports in commands/mod.rs**

Replace the `use crate::models` import block at the top of `dashboard/src-tauri/src/commands/mod.rs`:

```rust
use crate::models::{
    AgentMemory, DebtInfo, DebtItemInfo, DebtRegister, DesignBrief, Evidence,
    EventEntry, EventsPage, GapAssessment, HealthCheck, KindRollup,
    MissionSpec, MissionSpecDetail, MissionSummary, PhaseReview, ProjectEntry,
    ProjectSummary, Record, RunState, SeverityRollup, TaskContract, TaskInfo,
    VoteRound,
};
```

- [ ] **Step 2: Update count_tasks to use directory-based structure**

Replace the `count_tasks` function:

```rust
/// Count total and completed ("passed") tasks in a tasks directory.
/// New structure: tasks/{tid}/contract.json (directories, not flat files).
fn count_tasks(tasks_dir: &PathBuf) -> Result<(u32, u32), String> {
    if !tasks_dir.is_dir() {
        return Ok((0, 0));
    }

    let entries = fs::read_dir(tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir {}: {e}", tasks_dir.display()))?;

    let mut total: u32 = 0;
    let mut completed: u32 = 0;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let contract_path = path.join("contract.json");
        if let Some(tc) = read_json_file::<TaskContract>(&contract_path)? {
            total += 1;
            if tc.status.as_deref() == Some("passed") {
                completed += 1;
            }
        }
    }

    Ok((total, completed))
}
```

- [ ] **Step 3: Update read_task_files to use directory-based structure**

Replace the `read_task_files` function:

```rust
/// Read all task contract files and convert to TaskInfo.
/// New structure: tasks/{tid}/contract.json
fn read_task_files(tasks_dir: &PathBuf) -> Result<Vec<TaskInfo>, String> {
    if !tasks_dir.is_dir() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir {}: {e}", tasks_dir.display()))?;

    let mut tasks = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let contract_path = path.join("contract.json");
        if let Some(tc) = read_json_file::<TaskContract>(&contract_path)? {
            tasks.push(TaskInfo {
                task_id: tc.task_id.unwrap_or_default(),
                title: tc.title.unwrap_or_default(),
                goal: tc.goal,
                status: tc.status.unwrap_or_else(|| "unknown".to_string()),
                risk_level: tc.risk_level,
                task_kind: tc.task_kind,
                worker_type: tc
                    .routing
                    .as_ref()
                    .and_then(|r| r.primary_worker_type.clone()),
                acceptance_criteria: tc.acceptance_criteria,
                scope_surfaces: tc.scope.map(|s| s.surfaces).unwrap_or_default(),
            });
        }
    }

    Ok(tasks)
}
```

- [ ] **Step 4: Update infer_phase to use directory-based structure**

Replace the `infer_phase` function:

```rust
fn infer_phase(task_total: u32, task_completed: u32, tasks_dir: &Path) -> Result<Option<String>, String> {
    if task_total == 0 {
        return Ok(None);
    }

    if task_completed == task_total {
        return Ok(Some("complete".to_string()));
    }

    if tasks_dir.is_dir() {
        let entries = fs::read_dir(tasks_dir)
            .map_err(|e| format!("Failed to read tasks dir: {e}"))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let contract_path = path.join("contract.json");
            if let Some(tc) = read_json_file::<TaskContract>(&contract_path)? {
                match tc.status.as_deref() {
                    Some("implementing") | Some("reviewed") | Some("integrated") => {
                        return Ok(Some("building".to_string()));
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(None)
}
```

- [ ] **Step 5: Replace memory commands with agent-based markdown reader**

Replace `get_project_memories` and `get_memory_detail` with:

```rust
#[tauri::command(rename_all = "snake_case")]
pub fn get_project_memories(path: String) -> Result<Vec<AgentMemory>, String> {
    let geas = geas_dir(&path)?;
    let agents_dir = geas.join("memory").join("agents");

    if !agents_dir.is_dir() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents dir: {e}"))?;

    let mut results = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let agent_name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let content = fs::read_to_string(&path)
            .unwrap_or_default();

        results.push(AgentMemory {
            agent_name,
            content,
        });
    }

    Ok(results)
}
```

Remove `get_memory_detail` command entirely. Also remove the `collect_memory_summaries` and `find_memory_by_id` helper functions.

- [ ] **Step 6: Add new artifact reading commands**

Add these new commands after the existing data commands:

```rust
#[tauri::command(rename_all = "snake_case")]
pub fn get_task_detail(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<serde_json::Value, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let task_dir = geas
        .join("missions")
        .join(&mission_id)
        .join("tasks")
        .join(&task_id);

    let contract: Option<TaskContract> =
        read_json_file(&task_dir.join("contract.json"))?;
    let record: Option<Record> =
        read_json_file(&task_dir.join("record.json"))?;

    // Read evidence files
    let mut evidence_list: Vec<Evidence> = Vec::new();
    let evidence_dir = task_dir.join("evidence");
    if evidence_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&evidence_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(Some(ev)) = read_json_file::<Evidence>(&p) {
                        evidence_list.push(ev);
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "contract": contract,
        "record": record,
        "evidence": evidence_list,
    }))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_health_check(path: String) -> Result<Option<HealthCheck>, String> {
    let geas = geas_dir(&path)?;
    let hc_path = geas.join("state").join("health-check.json");
    read_json_file(&hc_path)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_design_brief(
    path: String,
    mission_id: String,
) -> Result<Option<DesignBrief>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let brief_path = geas
        .join("missions")
        .join(&mission_id)
        .join("design-brief.json");
    read_json_file(&brief_path)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_vote_rounds(
    path: String,
    mission_id: String,
) -> Result<Vec<VoteRound>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let decisions_dir = geas
        .join("missions")
        .join(&mission_id)
        .join("decisions");

    if !decisions_dir.is_dir() {
        return Ok(vec![]);
    }

    let mut rounds = Vec::new();
    let entries = fs::read_dir(&decisions_dir)
        .map_err(|e| format!("Failed to read decisions dir: {e}"))?;

    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(Some(vr)) = read_json_file::<VoteRound>(&p) {
                rounds.push(vr);
            }
        }
    }

    Ok(rounds)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_phase_reviews(
    path: String,
    mission_id: String,
) -> Result<Vec<PhaseReview>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let reviews_dir = geas
        .join("missions")
        .join(&mission_id)
        .join("phase-reviews");

    if !reviews_dir.is_dir() {
        return Ok(vec![]);
    }

    let mut reviews = Vec::new();
    let entries = fs::read_dir(&reviews_dir)
        .map_err(|e| format!("Failed to read phase-reviews dir: {e}"))?;

    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(Some(pr)) = read_json_file::<PhaseReview>(&p) {
                reviews.push(pr);
            }
        }
    }

    Ok(reviews)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_gap_assessment(
    path: String,
    mission_id: String,
) -> Result<Option<GapAssessment>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let gap_path = geas
        .join("missions")
        .join(&mission_id)
        .join("evolution")
        .join("gap-assessment.json");
    read_json_file(&gap_path)
}
```

- [ ] **Step 7: Update DebtInfo response to include rollup_by_kind**

In `get_project_debt`, update the `DebtInfo` struct and its construction. First update the return type in models.rs:

In `dashboard/src-tauri/src/models.rs`, update `DebtInfo`:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct DebtInfo {
    pub total: u32,
    pub by_severity: SeverityRollup,
    pub by_kind: KindRollup,
    pub items: Vec<DebtItemInfo>,
}
```

Update `DebtItemInfo` to include new fields:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct DebtItemInfo {
    pub debt_id: String,
    pub severity: String,
    pub kind: Option<String>,
    pub title: String,
    pub status: Option<String>,
    pub description: Option<String>,
    pub introduced_by_task_id: Option<String>,
    pub owner_type: Option<String>,
    pub target_phase: Option<String>,
}
```

In `dashboard/src-tauri/src/commands/mod.rs`, update `get_project_debt`:

```rust
    let by_kind = register.rollup_by_kind.unwrap_or_default();

    let items: Vec<DebtItemInfo> = register
        .items
        .into_iter()
        .map(|item| DebtItemInfo {
            debt_id: item.debt_id.unwrap_or_default(),
            severity: item.severity.unwrap_or_else(|| "unknown".to_string()),
            kind: item.kind,
            title: item.title.unwrap_or_default(),
            status: item.status,
            description: item.description,
            introduced_by_task_id: item.introduced_by_task_id,
            owner_type: item.owner_type,
            target_phase: item.target_phase,
        })
        .collect();

    Ok(DebtInfo {
        total,
        by_severity,
        by_kind,
        items,
    })
```

- [ ] **Step 8: Register new commands in lib.rs**

In `dashboard/src-tauri/src/lib.rs`, update the `invoke_handler`:

```rust
        .invoke_handler(tauri::generate_handler![
            commands::get_project_summary,
            commands::get_project_tasks,
            commands::get_project_debt,
            commands::get_mission_history,
            commands::get_mission_spec,
            commands::get_project_rules,
            commands::get_mission_events,
            commands::get_project_memories,
            commands::get_task_detail,
            commands::get_health_check,
            commands::get_design_brief,
            commands::get_vote_rounds,
            commands::get_phase_reviews,
            commands::get_gap_assessment,
            commands::list_projects,
            commands::add_project,
            commands::remove_project,
        ])
```

- [ ] **Step 9: Build and run tests**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture && cargo build`
Expected: ALL PASS, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add dashboard/src-tauri/src/commands/mod.rs dashboard/src-tauri/src/lib.rs dashboard/src-tauri/src/models.rs
git commit -m "feat(dashboard): update commands for directory-based tasks, add new artifact readers"
```

---

### Task 7: Update TypeScript types

**Files:**
- Modify: `dashboard/src/types.ts`
- Modify: `dashboard/src/colors.ts`

- [ ] **Step 1: Rewrite types.ts**

Replace the entire `dashboard/src/types.ts` with the updated types matching Rust return types:

```typescript
export interface ProjectEntry {
  name: string;
  path: string;
}

export interface ProjectSummary {
  name: string;
  path: string;
  mission_name: string | null;
  phase: string | null;
  task_total: number;
  task_completed: number;
  debt_total: number;
  debt_by_severity: SeverityRollup;
  last_activity: string | null;
  status: "ok" | "no_geas" | "error";
  current_task_id: string | null;
  agent_in_flight: string | null;
  pipeline_step: string | null;
  parallel_batch: string[] | null;
  completed_in_batch: string[];
}

export interface SeverityRollup {
  low: number;
  normal: number;
  high: number;
  critical: number;
}

export interface KindRollup {
  output_quality: number;
  verification_gap: number;
  structural: number;
  risk: number;
  process: number;
  documentation: number;
  operations: number;
}

export interface TaskInfo {
  task_id: string;
  title: string;
  goal: string | null;
  status: string;
  risk_level: string | null;
  task_kind: string | null;
  worker_type: string | null;
  acceptance_criteria: string[];
  scope_surfaces: string[];
}

export interface DebtItem {
  debt_id: string;
  severity: string;
  kind: string | null;
  title: string;
  status: string | null;
  description: string | null;
  introduced_by_task_id: string | null;
  owner_type: string | null;
  target_phase: string | null;
}

export interface DebtInfo {
  total: number;
  by_severity: SeverityRollup;
  by_kind: KindRollup;
  items: DebtItem[];
}

export interface MissionSummary {
  mission_id: string;
  mission_name: string | null;
  phase: string | null;
  task_total: number;
  task_completed: number;
  is_active: boolean;
  created_at: string | null;
}

export interface MissionSpecDetail {
  mission_id: string;
  mission: string | null;
  done_when: string | null;
  scope_in: string[];
  scope_out: string[];
  acceptance_criteria: string[];
  constraints: string[];
  domain_profile: string | null;
  mode: string | null;
  target_user: string | null;
  source: string | null;
  risk_notes: string[];
  assumptions: string[];
  ambiguities: string[];
  affected_surfaces: string[];
  created_at: string | null;
}

export interface EventEntry {
  event_type: string;
  timestamp: string;
  task_id?: string;
  mission_id?: string;
  agent?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface EventsPage {
  events: EventEntry[];
  total_count: number;
  page: number;
  page_size: number;
}

// --- New artifact types ---

export interface HealthSignal {
  name: string | null;
  value: number | null;
  threshold: number | null;
  triggered: boolean;
  detail: string | null;
  mandatory_response: string | null;
}

export interface HealthCheck {
  version: string | null;
  artifact_type: string | null;
  signals: HealthSignal[];
  any_triggered: boolean;
  trigger_context: string | null;
  created_at: string | null;
}

export interface ImplContract {
  planned_actions: string[];
  status: string | null;
  worker: string | null;
  edge_cases: string[];
  non_goals: string[];
}

export interface SelfCheck {
  confidence: number | null;
  summary: string | null;
  known_risks: string[];
  untested_paths: string[];
}

export interface RubricScore {
  dimension: string | null;
  score: number | null;
  threshold: number | null;
  passed: boolean | null;
  rationale: string | null;
}

export interface TierResult {
  status: string | null;
  details: string | null;
}

export interface GateResult {
  verdict: string | null;
  tier_results: { tier_0?: TierResult; tier_1?: TierResult; tier_2?: TierResult } | null;
  rubric_scores: RubricScore[];
  blocking_dimensions: string[];
}

export interface ChallengeReview {
  concerns: unknown[];
  blocking: boolean | null;
  summary: string | null;
}

export interface RecordVerdict {
  verdict: string | null;
  rationale: string | null;
  rewind_target: string | null;
}

export interface ClosureReview {
  reviewer_type: string | null;
  status: string | null;
  summary: string | null;
}

export interface Closure {
  change_summary: string | null;
  task_summary: string | null;
  reviews: ClosureReview[];
  open_risks: string[];
  debt_items: string[];
}

export interface RecordRetrospective {
  what_went_well: string[];
  what_broke: string[];
  what_was_surprising: string[];
  rule_candidates: string[];
  memory_candidates: string[];
  debt_candidates: string[];
  next_time_guidance: string[];
}

export interface Record {
  version: string | null;
  task_id: string | null;
  implementation_contract: ImplContract | null;
  self_check: SelfCheck | null;
  gate_result: GateResult | null;
  challenge_review: ChallengeReview | null;
  verdict: RecordVerdict | null;
  closure: Closure | null;
  retrospective: RecordRetrospective | null;
}

export interface Evidence {
  agent: string | null;
  role: string | null;
  summary: string | null;
  created_at: string | null;
  files_changed: string[];
  commit: string | null;
  verdict: string | null;
  concerns: string[];
  blocking: boolean | null;
  rationale: string | null;
  criteria_results: { criterion: string | null; passed: boolean | null; details: string | null }[];
  rubric_scores: RubricScore[];
}

export interface TaskDetail {
  contract: TaskInfo | null;
  record: Record | null;
  evidence: Evidence[];
}

export interface Alternative {
  approach: string | null;
  rejected_reason: string | null;
}

export interface ArchDecision {
  decision: string | null;
  rationale: string | null;
  constraints: string[];
}

export interface DesignRisk {
  description: string | null;
  mitigation: string | null;
}

export interface DesignBrief {
  depth: string | null;
  status: string | null;
  chosen_approach: string | null;
  non_goals: string[];
  verification_strategy: string | null;
  alternatives_considered: Alternative[];
  architecture_decisions: ArchDecision[];
  risks: DesignRisk[];
  created_at: string | null;
}

export interface Vote {
  voter: string | null;
  vote: string | null;
  rationale: string | null;
  severity: string | null;
}

export interface VoteRound {
  round_type: string | null;
  task_id: string | null;
  participants: string[];
  votes: Vote[];
  result: string | null;
  quorum_met: boolean | null;
  proposal_summary: string | null;
  created_at: string | null;
}

export interface PhaseReview {
  mission_phase: string | null;
  status: string | null;
  summary: string | null;
  gate_criteria_met: string[];
  gate_criteria_unmet: string[];
  risk_notes: string[];
  next_phase: string | null;
  created_at: string | null;
}

export interface GapAssessment {
  scope_in_summary: string | null;
  scope_out_summary: string | null;
  fully_delivered: string[];
  partially_delivered: string[];
  not_delivered: string[];
  intentional_cuts: string[];
  unexpected_additions: string[];
  recommended_followups: string[];
  created_at: string | null;
}

export interface AgentMemory {
  agent_name: string;
  content: string;
}
```

- [ ] **Step 2: Update colors.ts — update taskKindColors and simplify memoryTypeColors/memoryStateColors**

In `dashboard/src/colors.ts`, replace `taskKindColors`:

```typescript
export const taskKindColors: Record<string, { bg: string; text: string }> = {
  implementation: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  documentation: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  configuration: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  design: { bg: "rgba(188,140,255,0.15)", text: "#bc8cff" },
  review: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  analysis: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  delivery: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};
```

Replace `memoryTypeColors` and `memoryStateColors` with simpler versions (memory is now just agent markdown):

```typescript
export const memoryTypeColors: Record<string, { bg: string; text: string }> = {
  agent: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
};

export const memoryStateColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  active: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd dashboard && npm run build 2>&1 | head -30`
Expected: Compile errors in components referencing old types (MemorySummary, MemoryDetail). These will be fixed in the component tasks.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/types.ts dashboard/src/colors.ts
git commit -m "refactor(dashboard): update TypeScript types to match canonical schemas"
```

---

### Task 8: Update React components — ProjectDashboard (health-check alert)

**Files:**
- Modify: `dashboard/src/components/ProjectDashboard.tsx`

- [ ] **Step 1: Add health check alert banner**

In `dashboard/src/components/ProjectDashboard.tsx`, add the import for HealthCheck type and invoke:

After the existing imports, ensure `HealthCheck` is imported from types:
```typescript
import type { MissionSummary, ProjectSummary, HealthCheck } from "../types";
```

Add `AlertTriangle` to the lucide-react import.

Add state and fetch for health check in the component:
```typescript
const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
```

In the `load()` function, add `get_health_check` to the parallel fetch:
```typescript
const [missionResult, summaryResult, healthResult] = await Promise.all([
  invoke<MissionSummary[]>("get_mission_history", { path: projectPath }),
  invoke<ProjectSummary>("get_project_summary", { path: projectPath }).catch(() => null),
  invoke<HealthCheck | null>("get_health_check", { path: projectPath }).catch(() => null),
]);
if (!cancelled) {
  setMissions(missionResult);
  setSummary(summaryResult);
  setHealthCheck(healthResult);
}
```

Do the same for the auto-refresh effect.

Add the health alert banner after the Quick Actions section and before the "Currently Working" card:

```tsx
{/* Health Alert Banner */}
{healthCheck?.any_triggered && (
  <div className="bg-status-red/10 border border-status-red/30 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2 mb-2">
      <AlertTriangle size={16} className="text-status-red" />
      <span className="text-xs font-semibold text-status-red uppercase tracking-wide">Health Alert</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {healthCheck.signals
        .filter((s) => s.triggered)
        .map((s) => (
          <div key={s.name} className="bg-bg-surface rounded-md px-3 py-2 border border-border-default">
            <p className="text-xs font-medium text-text-primary">{s.name?.replace(/_/g, " ")}</p>
            {s.detail && <p className="text-[11px] text-text-muted mt-0.5">{s.detail}</p>}
            {s.mandatory_response && (
              <p className="text-[11px] text-status-red mt-0.5">{s.mandatory_response}</p>
            )}
          </div>
        ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: May have errors in other components (MemoryBrowser etc.), but ProjectDashboard should compile.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/ProjectDashboard.tsx
git commit -m "feat(dashboard): add health-check alert banner to ProjectDashboard"
```

---

### Task 9: Update React components — MissionDetailView (design-brief, vote-rounds, phase-reviews, gap-assessment)

**Files:**
- Modify: `dashboard/src/components/MissionDetailView.tsx`

- [ ] **Step 1: Add new artifact types and invoke calls**

This is a significant expansion. Add imports, state, and fetch calls for the 4 new artifact types. Add new Section blocks for each. The full implementation should:

1. Import `DesignBrief`, `VoteRound`, `PhaseReview`, `GapAssessment` from types
2. Add state variables for each
3. Fetch all in parallel with `get_mission_spec`
4. Add Section blocks for each artifact after the existing spec sections

Add these sections before the "Empty content notice" in the existing JSX:

- **Design Brief**: Show chosen_approach, non_goals, verification_strategy, alternatives_considered, architecture_decisions
- **Phase Reviews**: List each review with mission_phase, status, gate_criteria_met/unmet
- **Vote Rounds**: List each round with result, votes summary
- **Gap Assessment**: Show fully_delivered, partially_delivered, not_delivered, intentional_cuts, recommended_followups

The component should gracefully handle null/empty data for each — only show sections that have data.

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep MissionDetailView`
Expected: No errors for this file.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/MissionDetailView.tsx
git commit -m "feat(dashboard): add design-brief, vote-rounds, phase-reviews, gap-assessment to MissionDetailView"
```

---

### Task 10: Update React components — TaskDetailModal (record pipeline + evidence cards)

**Files:**
- Modify: `dashboard/src/components/TaskDetailModal.tsx`

- [ ] **Step 1: Add record pipeline progress and evidence summary**

Expand TaskDetailModal to:

1. Accept `projectPath` and `missionId` as additional props (or fetch task detail on open)
2. On mount, call `get_task_detail` to fetch record + evidence
3. Show a pipeline progress indicator (7 sections: implementation_contract, self_check, gate_result, challenge_review, verdict, closure, retrospective) — each dot/step shows filled if section exists in record
4. Show evidence cards: for each evidence file, show agent name, role badge, verdict badge, summary

The pipeline progress can be a simple horizontal step indicator:

```tsx
const RECORD_SECTIONS = [
  "implementation_contract", "self_check", "gate_result",
  "challenge_review", "verdict", "closure", "retrospective",
] as const;
```

For each section, check if `record?.{section}` is non-null to determine completion.

Evidence cards show: agent, role (colored badge), verdict (if present), summary text.

- [ ] **Step 2: Update KanbanBoard to pass projectPath and missionId to TaskDetailModal**

In `dashboard/src/components/KanbanBoard.tsx`, update the modal rendering to pass the additional props needed for fetching task detail.

- [ ] **Step 3: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/TaskDetailModal.tsx dashboard/src/components/KanbanBoard.tsx
git commit -m "feat(dashboard): add record pipeline and evidence cards to TaskDetailModal"
```

---

### Task 11: Update React components — DebtDetailPanel (rollup_by_kind)

**Files:**
- Modify: `dashboard/src/components/DebtDetailPanel.tsx`

- [ ] **Step 1: Add kind rollup display**

In DebtDetailPanel, after the severity filter pills section, add a "By Kind" breakdown section that shows the `by_kind` rollup from DebtInfo:

```tsx
{/* Kind breakdown */}
{debt.by_kind && (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    <span className="text-xs text-text-muted mr-1">Kind:</span>
    {Object.entries(debt.by_kind)
      .filter(([_, count]) => count > 0)
      .map(([kind, count]) => (
        <span
          key={kind}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-bg-elevated text-text-secondary"
        >
          {count} {kind.replace(/_/g, " ")}
        </span>
      ))}
  </div>
)}
```

Also update the type import to include `KindRollup` if needed, and ensure DebtPanel component (if it shows summary) also handles the new `by_kind` field.

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit 2>&1 | grep DebtDetailPanel`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/DebtDetailPanel.tsx
git commit -m "feat(dashboard): add rollup_by_kind to DebtDetailPanel"
```

---

### Task 12: Update React components — MemoryBrowser (agent markdown viewer)

**Files:**
- Modify: `dashboard/src/components/MemoryBrowser.tsx`

- [ ] **Step 1: Rewrite MemoryBrowser for agent markdown**

Replace the entire MemoryBrowser component. The new version:

1. Calls `get_project_memories` which returns `AgentMemory[]` (agent_name + markdown content)
2. Shows a list of agent names in the sidebar/left
3. Shows the selected agent's markdown content on the right
4. No filters needed (no more type/state/source filters)
5. Remove MemoryCard, MemoryDetailModal sub-components
6. Use a simple two-column layout: agent list | markdown content

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Brain } from "lucide-react";
import type { AgentMemory } from "../types";

interface MemoryBrowserProps {
  projectPath: string;
  onBack: () => void;
}

export default function MemoryBrowser({ projectPath, onBack }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AgentMemory[]>("get_project_memories", { path: projectPath });
      setMemories(result);
      if (result.length > 0 && !selectedAgent) {
        setSelectedAgent(result[0].agent_name);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      if (event.payload.path === projectPath) loadMemories();
    });
    return () => { unlisten.then(fn => fn()); };
  }, [projectPath, loadMemories]);

  const selected = memories.find(m => m.agent_name === selectedAgent);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border-default shrink-0">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary text-sm cursor-pointer transition-colors">
          <ArrowLeft size={16} className="inline" /> Back
        </button>
        <h1 className="text-base md:text-lg font-semibold text-text-primary truncate">Agent Memory</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">Failed to load memories</p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Brain size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
            <span className="text-text-muted text-sm">No agent memory files found</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Agent list */}
          <div className="w-48 border-r border-border-default overflow-y-auto shrink-0">
            {memories.map(m => (
              <button
                key={m.agent_name}
                onClick={() => setSelectedAgent(m.agent_name)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  selectedAgent === m.agent_name
                    ? "bg-bg-elevated text-text-primary font-medium"
                    : "text-text-secondary hover:bg-bg-elevated/50"
                }`}
              >
                {m.agent_name.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="max-w-3xl">
                <h2 className="text-sm font-semibold text-text-primary mb-4">
                  {selected.agent_name}
                </h2>
                <div className="prose prose-sm prose-invert max-w-none text-text-secondary whitespace-pre-wrap text-sm leading-relaxed">
                  {selected.content || "Empty"}
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm">Select an agent</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove unused imports from App.tsx if needed**

Check that `App.tsx` no longer references `MemoryDetail` or `MemorySummary` types.

- [ ] **Step 3: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/MemoryBrowser.tsx
git commit -m "refactor(dashboard): rewrite MemoryBrowser for agent markdown files"
```

---

### Task 13: Final build verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full Rust test suite**

Run: `cd dashboard/src-tauri && cargo test -- --nocapture`
Expected: ALL PASS.

- [ ] **Step 2: Run full frontend build**

Run: `cd dashboard && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run Tauri dev build**

Run: `cd dashboard && npm run tauri build -- --debug 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Clean up any unused imports or dead code**

Check for any compiler warnings:
Run: `cd dashboard/src-tauri && cargo clippy 2>&1 | grep warning`

Fix any warnings found.

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A dashboard/
git commit -m "chore(dashboard): cleanup unused code and fix warnings"
```
