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

/// Nested scope block used in older spec.json files (scope.in / scope.out)
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MissionScopeNested {
    #[serde(default, rename = "in")]
    pub scope_in: Option<Vec<String>>,
    #[serde(default, rename = "out")]
    pub scope_out: Option<Vec<String>>,
    #[serde(default)]
    pub constraints: Option<Vec<String>>,
}

/// .geas/missions/{id}/spec.json
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MissionSpec {
    #[serde(default)]
    pub mission: Option<String>,
    /// Older specs may use "title" instead of "mission"
    #[serde(default)]
    pub title: Option<String>,
    /// Older specs may use "statement" instead of "mission"
    #[serde(default)]
    pub statement: Option<String>,
    #[serde(default)]
    pub done_when: Option<String>,
    /// Flat scope fields (newer format)
    #[serde(default)]
    pub scope_in: Option<Vec<String>>,
    #[serde(default)]
    pub scope_out: Option<Vec<String>>,
    /// Nested scope block (older format: scope.in / scope.out)
    #[serde(default)]
    pub scope: Option<MissionScopeNested>,
    #[serde(default)]
    pub acceptance_criteria: Option<Vec<String>>,
    #[serde(default)]
    pub constraints: Option<Vec<String>>,
    #[serde(default)]
    pub domain_profile: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub target_user: Option<String>,
    #[serde(default)]
    pub risk_notes: Option<Vec<String>>,
    /// Older specs may use "risks" instead of "risk_notes"
    #[serde(default)]
    pub risks: Option<Vec<String>>,
    #[serde(default)]
    pub assumptions: Option<Vec<String>>,
    #[serde(default)]
    pub created_at: Option<String>,
}

impl MissionSpec {
    /// Return the mission name, checking mission -> title -> statement fallback chain
    pub fn mission_name(&self) -> Option<String> {
        self.mission
            .clone()
            .or_else(|| self.title.clone())
            .or_else(|| self.statement.clone())
    }

    /// Return scope_in, merging flat and nested formats
    pub fn resolved_scope_in(&self) -> Vec<String> {
        self.scope_in
            .clone()
            .or_else(|| self.scope.as_ref().and_then(|s| s.scope_in.clone()))
            .unwrap_or_default()
    }

    /// Return scope_out, merging flat and nested formats
    pub fn resolved_scope_out(&self) -> Vec<String> {
        self.scope_out
            .clone()
            .or_else(|| self.scope.as_ref().and_then(|s| s.scope_out.clone()))
            .unwrap_or_default()
    }

    /// Return constraints, merging flat and nested formats
    pub fn resolved_constraints(&self) -> Vec<String> {
        self.constraints
            .clone()
            .or_else(|| self.scope.as_ref().and_then(|s| s.constraints.clone()))
            .unwrap_or_default()
    }

    /// Return risk_notes, falling back to "risks"
    pub fn resolved_risk_notes(&self) -> Vec<String> {
        self.risk_notes
            .clone()
            .or_else(|| self.risks.clone())
            .unwrap_or_default()
    }
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
    pub risk_notes: Vec<String>,
    pub assumptions: Vec<String>,
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

// ---------------------------------------------------------------------------
// Memory file models (Deserialize only — read-only access)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event models (for events.jsonl parsing)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEntry {
    #[serde(default, alias = "event")]
    pub event_type: String,
    #[serde(default)]
    pub timestamp: String,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EventsPage {
    pub events: Vec<EventEntry>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
}

// ---------------------------------------------------------------------------
// Memory models
// ---------------------------------------------------------------------------

/// Meta block inside a memory JSON file
#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct MemoryMeta {
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
    pub updated_at: Option<String>,
}

/// Signals block inside a memory JSON file
#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct MemorySignals {
    #[serde(default)]
    pub evidence_count: Option<u32>,
    #[serde(default)]
    pub reuse_count: Option<u32>,
    #[serde(default)]
    pub successful_reuses: Option<u32>,
    #[serde(default)]
    pub failed_reuses: Option<u32>,
    #[serde(default)]
    pub contradiction_count: Option<u32>,
    #[serde(default)]
    pub confidence: Option<f64>,
}

/// .geas/memory/{entries,candidates}/**/*.json
#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct MemoryFile {
    #[serde(default)]
    pub meta: Option<MemoryMeta>,
    #[serde(default)]
    pub memory_id: Option<String>,
    #[serde(default)]
    pub memory_type: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub evidence_refs: Option<Vec<String>>,
    #[serde(default)]
    pub signals: Option<MemorySignals>,
    #[serde(default)]
    pub review_after: Option<String>,
    #[serde(default)]
    pub supersedes: Option<Vec<String>>,
    #[serde(default)]
    pub superseded_by: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub body: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// Memory frontend return types (Serialize for Tauri IPC)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct MemorySummary {
    pub memory_id: String,
    pub memory_type: String,
    pub state: String,
    pub title: String,
    pub summary: String,
    pub scope: String,
    pub tags: Vec<String>,
    pub created_at: Option<String>,
    pub source_dir: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemoryDetail {
    pub memory_id: String,
    pub memory_type: String,
    pub state: String,
    pub title: String,
    pub summary: String,
    pub scope: String,
    pub body: Vec<String>,
    pub tags: Vec<String>,
    pub evidence_refs: Vec<String>,
    pub signals: Option<MemorySignalsInfo>,
    pub review_after: Option<String>,
    pub supersedes: Vec<String>,
    pub superseded_by: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub source_dir: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemorySignalsInfo {
    pub evidence_count: u32,
    pub reuse_count: u32,
    pub confidence: f64,
}

