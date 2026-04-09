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
    #[serde(default)]
    pub pending_evidence: Vec<String>,
    #[serde(default)]
    pub retry_count: Option<u32>,
    #[serde(default)]
    pub remaining_steps: Vec<String>,
    #[serde(default)]
    pub checkpoint_phase: Option<String>,
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

/// Routing block inside a TaskContract
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct TaskRouting {
    #[serde(default)]
    pub primary_worker_type: Option<String>,
    #[serde(default)]
    pub required_reviewer_types: Vec<String>,
}

/// Scope block inside a TaskContract
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TaskScope {
    #[serde(default)]
    pub surfaces: Vec<String>,
}

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

/// .geas/missions/{id}/tasks/{tid}/contract.json
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
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
    #[serde(default)]
    pub owner_type: Option<String>,
    #[serde(default)]
    pub target_phase: Option<String>,
}

/// Severity rollup counts
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

/// .geas/missions/{id}/evolution/debt-register.json
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

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TierResult {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct TierResults {
    #[serde(default)]
    pub tier_0: Option<TierResult>,
    #[serde(default)]
    pub tier_1: Option<TierResult>,
    #[serde(default)]
    pub tier_2: Option<TierResult>,
}

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

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Alternative {
    #[serde(default)]
    pub approach: Option<String>,
    #[serde(default)]
    pub rejected_reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct ArchDecision {
    #[serde(default)]
    pub decision: Option<String>,
    #[serde(default)]
    pub rationale: Option<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
}

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

