export interface ProjectEntry {
  name: string;
  path: string;
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
  dependencies: string[];
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
  updated_at?: string;
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
  updated_at?: string;
}

export interface EventEntry {
  event_type: string;
  timestamp: string;
  task_id: string | null;
  mission_id: string | null;
  agent: string | null;
  message: string | null;
  data: unknown | null;
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
  updated_at?: string;
}

export interface ImplContract {
  planned_actions: string[];
  status: string | null;
  worker: string | null;
  edge_cases: string[];
  non_goals: string[];
  demo_steps: string[];
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

export interface TaskRecord {
  version: string | null;
  task_id: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  updated_at?: string;
  files_changed: string[];
  commit: string | null;
  verdict: string | null;
  concerns: (string | { severity: string; description: string })[];
  blocking: boolean | null;
  rationale: string | null;
  criteria_results: { criterion: string | null; passed: boolean | null; details: string | null }[];
  rubric_scores: RubricScore[];
}

export interface TaskDetail {
  contract: TaskInfo | null;
  record: TaskRecord | null;
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

export interface DesignReview {
  reviewer_type: string | null;
  summary: string | null;
  additions: string[];
}

export interface RejectionHistoryEntry {
  reason: string | null;
  revision_summary: string | null;
  rejected_at: string | null;
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
  preserve_list: string[];
  unresolved_assumptions: string[];
  design_review: DesignReview | null;
  vote_round_ref: string | null;
  rejection_history: RejectionHistoryEntry[];
  created_at: string | null;
  updated_at?: string;
  approved_at: string | null;
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
  quorum_failure_count: number | null;
  proposal_summary: string | null;
  created_at: string | null;
  updated_at?: string;
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
  updated_at?: string;
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
  updated_at?: string;
}

export interface AgentMemory {
  agent_name: string;
  content: string;
}
