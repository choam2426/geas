use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Project registry (AppConfig persisted in app_data_dir/config.json)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub projects: Vec<ProjectEntry>,
}

// ---------------------------------------------------------------------------
// v3 protocol artifacts — mission-level
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MissionScope {
    #[serde(default, rename = "in")]
    pub scope_in: Vec<String>,
    #[serde(default, rename = "out")]
    pub scope_out: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MissionSpec {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub definition_of_done: Option<String>,
    #[serde(default)]
    pub user_approved: Option<bool>,
    #[serde(default)]
    pub scope: Option<MissionScope>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
    #[serde(default)]
    pub affected_surfaces: Vec<String>,
    #[serde(default)]
    pub risks: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MissionState {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub active_tasks: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct PhaseReview {
    #[serde(default)]
    pub mission_phase: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub next_phase: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct PhaseReviewsFile {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub reviews: Vec<PhaseReview>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MissionVerdict {
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub carry_forward: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MissionVerdictsFile {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub verdicts: Vec<MissionVerdict>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct DeliberationVote {
    #[serde(default)]
    pub voter: Option<String>,
    #[serde(default)]
    pub vote: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct Deliberation {
    #[serde(default)]
    pub proposal_summary: Option<String>,
    #[serde(default)]
    pub votes: Vec<DeliberationVote>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct DeliberationsFile {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub entries: Vec<Deliberation>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct Gap {
    #[serde(default)]
    pub mission_id: Option<String>,
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
    pub unexpected_additions: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MemoryUpdateChange {
    #[serde(default)]
    pub memory_id: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub evidence_refs: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MemoryUpdateRemoval {
    #[serde(default)]
    pub memory_id: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct SharedMemoryChanges {
    #[serde(default)]
    pub added: Vec<MemoryUpdateChange>,
    #[serde(default)]
    pub modified: Vec<MemoryUpdateChange>,
    #[serde(default)]
    pub removed: Vec<MemoryUpdateRemoval>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct AgentMemoryChanges {
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub added: Vec<MemoryUpdateChange>,
    #[serde(default)]
    pub modified: Vec<MemoryUpdateChange>,
    #[serde(default)]
    pub removed: Vec<MemoryUpdateRemoval>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct MemoryUpdate {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub shared: Option<SharedMemoryChanges>,
    #[serde(default)]
    pub agents: Vec<AgentMemoryChanges>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

// ---------------------------------------------------------------------------
// v3 protocol artifacts — task-level
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct TaskRouting {
    #[serde(default)]
    pub primary_worker_type: Option<String>,
    #[serde(default)]
    pub required_reviewers: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct TaskContract {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub goal: Option<String>,
    #[serde(default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(default)]
    pub verification_plan: Option<String>,
    #[serde(default)]
    pub approved_by: Option<String>,
    #[serde(default)]
    pub surfaces: Vec<String>,
    #[serde(default)]
    pub routing: Option<TaskRouting>,
    #[serde(default)]
    pub base_snapshot: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub supersedes: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct TaskState {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub active_agent: Option<String>,
    #[serde(default)]
    pub verify_fix_iterations: Option<u32>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct ImplementationContract {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub change_scope: Vec<String>,
    #[serde(default)]
    pub planned_actions: Vec<String>,
    #[serde(default)]
    pub non_goals: Vec<String>,
    #[serde(default)]
    pub alternatives_considered: Vec<String>,
    #[serde(default)]
    pub assumptions: Vec<String>,
    #[serde(default)]
    pub open_questions: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct SelfCheck {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub completed_work: Option<String>,
    #[serde(default)]
    pub reviewer_focus: Vec<String>,
    #[serde(default)]
    pub known_risks: Vec<String>,
    #[serde(default)]
    pub deviations_from_plan: Vec<String>,
    #[serde(default)]
    pub gap_signals: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct TierResult {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct GateTierResults {
    #[serde(default)]
    pub tier_0: Option<TierResult>,
    #[serde(default)]
    pub tier_1: Option<TierResult>,
    #[serde(default)]
    pub tier_2: Option<TierResult>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct GateRun {
    #[serde(default)]
    pub gate_run_id: Option<String>,
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub tier_results: Option<GateTierResults>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct GateResults {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub runs: Vec<GateRun>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct DebtCandidate {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct GapSignal {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct CriterionResult {
    #[serde(default)]
    pub criterion: Option<String>,
    #[serde(default)]
    pub passed: Option<bool>,
    #[serde(default)]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct EvidenceEntry {
    #[serde(default)]
    pub entry_id: Option<u32>,
    #[serde(default)]
    pub evidence_kind: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub artifacts: Vec<String>,
    #[serde(default)]
    pub memory_suggestions: Vec<String>,
    #[serde(default)]
    pub debt_candidates: Vec<DebtCandidate>,
    #[serde(default)]
    pub gap_signals: Vec<GapSignal>,
    #[serde(default)]
    pub revision_ref: Option<u32>,
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub concerns: Vec<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub scope_examined: Option<String>,
    #[serde(default)]
    pub methods_used: Vec<String>,
    #[serde(default)]
    pub scope_excluded: Vec<String>,
    #[serde(default)]
    pub criteria_results: Vec<CriterionResult>,
    #[serde(default)]
    pub what_went_well: Vec<String>,
    #[serde(default)]
    pub what_broke: Vec<String>,
    #[serde(default)]
    pub what_was_surprising: Vec<String>,
    #[serde(default)]
    pub next_time_guidance: Vec<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct EvidenceFile {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub slot: Option<String>,
    #[serde(default)]
    pub entries: Vec<EvidenceEntry>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EvidenceFileMeta {
    pub filename: String,
    pub agent: Option<String>,
    pub slot: Option<String>,
    pub entry_count: usize,
    pub latest_verdict: Option<String>,
    pub latest_kind: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

// ---------------------------------------------------------------------------
// v3 protocol artifacts — project-level (debts)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct DebtRef {
    #[serde(default)]
    pub mission_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct DebtEntry {
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
    pub introduced_by: Option<DebtRef>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub resolved_by: Option<DebtRef>,
    #[serde(default)]
    pub resolution_rationale: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct Debts {
    #[serde(default)]
    pub entries: Vec<DebtEntry>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SeverityRollup {
    pub low: u32,
    pub normal: u32,
    pub high: u32,
    pub critical: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct KindRollup {
    pub output_quality: u32,
    pub verification_gap: u32,
    pub structural: u32,
    pub risk: u32,
    pub process: u32,
    pub documentation: u32,
    pub operations: u32,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEntry {
    #[serde(default)]
    pub event_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub triggered_by: Option<serde_json::Value>,
    #[serde(default)]
    pub prior_event: Option<String>,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EventsPage {
    pub events: Vec<EventEntry>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct AgentMemory {
    pub agent_name: String,
    pub content: String,
}

// ---------------------------------------------------------------------------
// Frontend response aggregates
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
    pub mission_id: Option<String>,
    pub mission_name: Option<String>,
    pub phase: Option<String>,
    pub task_total: u32,
    pub task_completed: u32,
    pub active_tasks: Vec<String>,
    pub debt_total: u32,
    pub debt_by_severity: SeverityRollup,
    pub last_activity: Option<String>,
    /// "ok" | "no_geas" | "error"
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskRow {
    pub task_id: String,
    pub title: String,
    pub goal: Option<String>,
    pub status: String,
    pub risk_level: Option<String>,
    pub primary_worker_type: Option<String>,
    pub required_reviewers: Vec<String>,
    pub active_agent: Option<String>,
    pub verify_fix_iterations: u32,
    pub acceptance_criteria: Vec<String>,
    pub dependencies: Vec<String>,
    pub surfaces: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskDetail {
    pub task_id: String,
    pub contract: Option<TaskContract>,
    pub state: Option<TaskState>,
    pub implementation_contract: Option<ImplementationContract>,
    pub self_check: Option<SelfCheck>,
    pub gate_results: Option<GateResults>,
    pub deliberations: Option<DeliberationsFile>,
    pub evidence_files: Vec<EvidenceFileMeta>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MissionDetail {
    pub mission_id: String,
    pub spec: Option<MissionSpec>,
    pub state: Option<MissionState>,
    pub design_markdown: Option<String>,
    pub phase_reviews: Option<PhaseReviewsFile>,
    pub verdicts: Option<MissionVerdictsFile>,
    pub deliberations: Option<DeliberationsFile>,
    pub gap: Option<Gap>,
    pub memory_update: Option<MemoryUpdate>,
    pub has_candidates: bool,
}
