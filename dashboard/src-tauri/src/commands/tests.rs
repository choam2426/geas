use std::path::PathBuf;

use crate::commands::{name_from_path, read_json_file};
use crate::models::{Checkpoint, DebtItem, DebtRegister, KindRollup, MissionSpec, Rubric, RunState, SeverityRollup, TaskContract, TaskScope};
use crate::models::{Record, Evidence, HealthCheck, DesignBrief, VoteRound, PhaseReview, GapAssessment};

#[test]
fn name_from_unix_path() {
    assert_eq!(name_from_path("/path/to/my-project"), "my-project");
}

#[test]
fn name_from_windows_path() {
    assert_eq!(name_from_path("C:\\Users\\foo\\bar"), "bar");
}

#[test]
fn read_json_file_missing_returns_none() {
    let path = PathBuf::from("/tmp/definitely_does_not_exist_12345.json");
    let result: Result<Option<RunState>, String> = read_json_file(&path);
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[test]
fn read_json_file_invalid_json_returns_err() {
    let dir = std::env::temp_dir().join("geas_test_invalid_json");
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("bad.json");
    std::fs::write(&path, "{ not valid json }").unwrap();

    let result: Result<Option<RunState>, String> = read_json_file(&path);
    assert!(result.is_err());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn run_state_full_json() {
    let json = r#"{
        "version": "3.0",
        "status": "active",
        "mission_id": "mission-001",
        "mission": "Build dashboard",
        "phase": "building",
        "current_task_id": "task-003",
        "completed_tasks": ["task-001", "task-002"],
        "checkpoint": { "last_updated": "2026-04-06T10:00:00Z" }
    }"#;

    let rs: RunState = serde_json::from_str(json).unwrap();
    assert_eq!(rs.version.as_deref(), Some("3.0"));
    assert_eq!(rs.status.as_deref(), Some("active"));
    assert_eq!(rs.mission_id.as_deref(), Some("mission-001"));
    assert_eq!(rs.phase.as_deref(), Some("building"));
    assert_eq!(rs.completed_tasks.len(), 2);
    assert_eq!(
        rs.checkpoint.as_ref().unwrap().last_updated.as_deref(),
        Some("2026-04-06T10:00:00Z")
    );
}

#[test]
fn run_state_minimal_json() {
    let json = "{}";
    let rs: RunState = serde_json::from_str(json).unwrap();
    assert!(rs.version.is_none());
    assert!(rs.status.is_none());
    assert!(rs.mission_id.is_none());
    assert!(rs.completed_tasks.is_empty());
    assert!(rs.checkpoint.is_none());
}

#[test]
fn run_state_null_mission_id() {
    let json = r#"{ "mission_id": null }"#;
    let rs: RunState = serde_json::from_str(json).unwrap();
    assert!(rs.mission_id.is_none());
}

#[test]
fn task_contract_all_optional_missing() {
    let json = "{}";
    let tc: TaskContract = serde_json::from_str(json).unwrap();
    assert!(tc.task_id.is_none());
    assert!(tc.title.is_none());
    assert!(tc.goal.is_none());
    assert!(tc.status.is_none());
    assert!(tc.risk_level.is_none());
    assert!(tc.task_kind.is_none());
    assert!(tc.routing.is_none());
    assert!(tc.acceptance_criteria.is_empty());
    assert!(tc.scope.is_none());
}

#[test]
fn task_contract_with_acceptance_criteria_and_scope() {
    let json = r#"{
        "task_id": "task-012",
        "title": "Extend TaskInfo",
        "acceptance_criteria": [
            "TaskContract includes acceptance_criteria field",
            "TaskInfo includes scope_surfaces field"
        ],
        "scope": {
            "surfaces": ["models.rs", "commands/mod.rs"]
        }
    }"#;

    let tc: TaskContract = serde_json::from_str(json).unwrap();
    assert_eq!(tc.acceptance_criteria.len(), 2);
    assert_eq!(tc.acceptance_criteria[0], "TaskContract includes acceptance_criteria field");
    let scope = tc.scope.unwrap();
    assert_eq!(scope.surfaces.len(), 2);
    assert_eq!(scope.surfaces[0], "models.rs");
}

#[test]
fn task_contract_empty_acceptance_criteria_and_scope() {
    let json = r#"{
        "task_id": "task-099",
        "acceptance_criteria": [],
        "scope": { "surfaces": [] }
    }"#;

    let tc: TaskContract = serde_json::from_str(json).unwrap();
    assert!(tc.acceptance_criteria.is_empty());
    assert!(tc.scope.unwrap().surfaces.is_empty());
}

#[test]
fn task_scope_defaults() {
    let json = "{}";
    let ts: TaskScope = serde_json::from_str(json).unwrap();
    assert!(ts.surfaces.is_empty());
}

#[test]
fn debt_register_empty_items() {
    let json = r#"{ "items": [] }"#;
    let dr: DebtRegister = serde_json::from_str(json).unwrap();
    assert!(dr.items.is_empty());
    assert!(dr.rollup_by_severity.is_none());
}

#[test]
fn severity_rollup_canonical_only() {
    let json = r#"{ "low": 1, "normal": 3, "high": 2, "critical": 0 }"#;
    let sr: SeverityRollup = serde_json::from_str(json).unwrap();
    assert_eq!(sr.low, 1);
    assert_eq!(sr.normal, 3);
    assert_eq!(sr.high, 2);
    assert_eq!(sr.critical, 0);
}

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

#[test]
fn mission_spec_minimal_json() {
    let json = "{}";
    let spec: MissionSpec = serde_json::from_str(json).unwrap();
    assert!(spec.mission.is_none());
    assert!(spec.created_at.is_none());
}

#[test]
fn mission_spec_extra_fields_ignored() {
    let json = r#"{
        "mission": "Test",
        "domain_profile": "software",
        "objectives": ["a", "b"]
    }"#;
    let spec: MissionSpec = serde_json::from_str(json).unwrap();
    assert_eq!(spec.mission.as_deref(), Some("Test"));
    assert!(spec.created_at.is_none());
}

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

#[test]
fn debt_item_with_introduced_by_task_id() {
    let json = r#"{
        "debt_id": "debt-001",
        "severity": "high",
        "kind": "design",
        "title": "Missing error handling",
        "description": "Several endpoints lack proper error handling",
        "status": "open",
        "introduced_by_task_id": "task-005"
    }"#;

    let item: DebtItem = serde_json::from_str(json).unwrap();
    assert_eq!(item.debt_id.as_deref(), Some("debt-001"));
    assert_eq!(item.description.as_deref(), Some("Several endpoints lack proper error handling"));
    assert_eq!(item.introduced_by_task_id.as_deref(), Some("task-005"));
}

#[test]
fn debt_item_without_new_fields() {
    let json = r#"{
        "debt_id": "debt-002",
        "severity": "low",
        "title": "Legacy naming"
    }"#;

    let item: DebtItem = serde_json::from_str(json).unwrap();
    assert!(item.description.is_none());
    assert!(item.introduced_by_task_id.is_none());
}

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
