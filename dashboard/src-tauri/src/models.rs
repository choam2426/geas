use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// .geas/ file models (Deserialize only — read-only access)
// ---------------------------------------------------------------------------

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
    pub parallel_batch: Option<Vec<String>>,
    #[serde(default)]
    pub completed_in_batch: Vec<String>,
}

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
    pub checkpoint: Option<Checkpoint>,
}

/// Routing block inside a TaskContract
#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct TaskRouting {
    #[serde(default)]
    pub primary_worker_type: Option<String>,
    #[serde(default)]
    pub required_reviewer_types: Vec<String>,
}

/// Scope block inside a TaskContract
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaskScope {
    #[serde(default)]
    pub surfaces: Vec<String>,
}

/// .geas/missions/{id}/tasks/*.json
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaskContract {
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
    pub routing: Option<TaskRouting>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub scope: Option<TaskScope>,
}

/// .geas/missions/{id}/spec.json (partial — only fields we need)
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MissionSpec {
    #[serde(default)]
    pub mission: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

/// Single debt item
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct DebtItem {
    #[serde(default)]
    pub debt_id: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub introduced_by_task_id: Option<String>,
}

/// Severity rollup counts
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct SeverityRollup {
    #[serde(default)]
    pub low: u32,
    #[serde(default, alias = "medium")]
    pub normal: u32,
    #[serde(default)]
    pub high: u32,
    #[serde(default)]
    pub critical: u32,
}

/// .geas/missions/{id}/evolution/debt-register.json
#[derive(Debug, Clone, Default, Deserialize)]
pub struct DebtRegister {
    #[serde(default)]
    pub items: Vec<DebtItem>,
    #[serde(default)]
    pub rollup_by_severity: Option<SeverityRollup>,
}


// ---------------------------------------------------------------------------
// Frontend return types (Serialize for Tauri IPC)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct MissionSummary {
    pub mission_id: String,
    pub mission_name: Option<String>,
    pub phase: Option<String>,
    pub task_total: u32,
    pub task_completed: u32,
    pub is_active: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub name: String,
    pub path: String,
    pub mission_name: Option<String>,
    pub phase: Option<String>,
    pub task_total: u32,
    pub task_completed: u32,
    pub debt_total: u32,
    pub debt_by_severity: SeverityRollup,
    pub last_activity: Option<String>,
    pub current_task_id: Option<String>,
    pub agent_in_flight: Option<String>,
    pub pipeline_step: Option<String>,
    pub parallel_batch: Option<Vec<String>>,
    pub completed_in_batch: Vec<String>,
    /// "ok" | "no_geas" | "error"
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskInfo {
    pub task_id: String,
    pub title: String,
    pub goal: Option<String>,
    pub status: String,
    pub risk_level: Option<String>,
    pub task_kind: Option<String>,
    pub worker_type: Option<String>,
    pub acceptance_criteria: Vec<String>,
    pub scope_surfaces: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DebtInfo {
    pub total: u32,
    pub by_severity: SeverityRollup,
    pub items: Vec<DebtItemInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DebtItemInfo {
    pub debt_id: String,
    pub severity: String,
    pub kind: Option<String>,
    pub title: String,
    pub status: Option<String>,
    pub description: Option<String>,
    pub introduced_by_task_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub name: String,
    pub path: String,
}

/// Persisted config stored in app_data_dir/config.json
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub projects: Vec<ProjectEntry>,
}

