use std::path::PathBuf;

use crate::commands::{name_from_path, read_json_file};
use crate::models::{Checkpoint, DebtItem, DebtRegister, MissionSpec, RunState, SeverityRollup, TaskContract, TaskScope};

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
fn severity_rollup_medium_alias() {
    let json = r#"{ "low": 1, "medium": 3, "high": 2, "critical": 0 }"#;
    let sr: SeverityRollup = serde_json::from_str(json).unwrap();
    assert_eq!(sr.low, 1);
    assert_eq!(sr.normal, 3);
    assert_eq!(sr.high, 2);
    assert_eq!(sr.critical, 0);
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
