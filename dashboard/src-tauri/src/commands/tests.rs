use std::path::PathBuf;

use crate::commands::{name_from_path, read_json_file};
use crate::models::{DebtRegister, RunState, SeverityRollup, TaskContract};

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
