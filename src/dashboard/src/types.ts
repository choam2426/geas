// -----------------------------------------------------------------------------
// v3 dashboard types — mirror src-tauri/src/models.rs
// -----------------------------------------------------------------------------

// Project registry
export interface ProjectEntry {
  name: string;
  path: string;
}

// Severity / kind rollups
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

// Mission-level
export interface MissionScope {
  in: string[];
  out: string[];
}

export interface MissionSpec {
  id: string | null;
  mode: string | null;
  name: string | null;
  description: string | null;
  definition_of_done: string | null;
  user_approved: boolean | null;
  scope: MissionScope | null;
  acceptance_criteria: string[];
  constraints: string[];
  affected_surfaces: string[];
  risks: string[];
  created_at: string | null;
  updated_at: string | null;
}

export type MissionPhase =
  | "specifying"
  | "building"
  | "polishing"
  | "consolidating"
  | "complete";

export interface MissionState {
  mission_id: string | null;
  phase: MissionPhase | string | null;
  active_tasks: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface PhaseReview {
  mission_phase: string | null;
  status: string | null;
  summary: string | null;
  next_phase: string | null;
  created_at: string | null;
}

export interface PhaseReviewsFile {
  mission_id: string | null;
  reviews: PhaseReview[];
  created_at: string | null;
  updated_at: string | null;
}

export interface MissionVerdict {
  verdict: string | null;
  rationale: string | null;
  carry_forward: string[];
  created_at: string | null;
}

export interface MissionVerdictsFile {
  mission_id: string | null;
  verdicts: MissionVerdict[];
  created_at: string | null;
  updated_at: string | null;
}

export interface DeliberationVote {
  voter: string | null;
  vote: string | null;
  rationale: string | null;
}

export interface Deliberation {
  proposal_summary: string | null;
  votes: DeliberationVote[];
  result: string | null;
  created_at: string | null;
}

export interface DeliberationsFile {
  mission_id: string | null;
  level: string | null;
  task_id: string | null;
  entries: Deliberation[];
  created_at: string | null;
  updated_at: string | null;
}

export interface Gap {
  mission_id: string | null;
  scope_in_summary: string | null;
  scope_out_summary: string | null;
  fully_delivered: string[];
  partially_delivered: string[];
  not_delivered: string[];
  unexpected_additions: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface MemoryUpdateChange {
  memory_id: string | null;
  reason: string | null;
  evidence_refs: string[];
}

export interface MemoryUpdateRemoval {
  memory_id: string | null;
  reason: string | null;
}

export interface SharedMemoryChanges {
  added: MemoryUpdateChange[];
  modified: MemoryUpdateChange[];
  removed: MemoryUpdateRemoval[];
}

export interface AgentMemoryChanges {
  agent: string | null;
  added: MemoryUpdateChange[];
  modified: MemoryUpdateChange[];
  removed: MemoryUpdateRemoval[];
}

export interface MemoryUpdate {
  mission_id: string | null;
  shared: SharedMemoryChanges | null;
  agents: AgentMemoryChanges[];
  created_at: string | null;
  updated_at: string | null;
}

// Task-level
export interface TaskRouting {
  primary_worker_type: string | null;
  required_reviewers: string[];
}

export interface TaskContract {
  mission_id: string | null;
  task_id: string | null;
  title: string | null;
  goal: string | null;
  risk_level: string | null;
  acceptance_criteria: string[];
  verification_plan: string | null;
  approved_by: string | null;
  surfaces: string[];
  routing: TaskRouting | null;
  base_snapshot: string | null;
  dependencies: string[];
  supersedes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TaskStatus =
  | "drafted"
  | "ready"
  | "implementing"
  | "reviewed"
  | "verified"
  | "passed"
  | "blocked"
  | "escalated"
  | "cancelled";

export interface TaskState {
  mission_id: string | null;
  task_id: string | null;
  status: TaskStatus | string | null;
  active_agent: string | null;
  verify_fix_iterations: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ImplementationContract {
  mission_id: string | null;
  task_id: string | null;
  summary: string | null;
  rationale: string | null;
  change_scope: string[];
  planned_actions: string[];
  non_goals: string[];
  alternatives_considered: string[];
  assumptions: string[];
  open_questions: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface SelfCheck {
  mission_id: string | null;
  task_id: string | null;
  completed_work: string | null;
  reviewer_focus: string[];
  known_risks: string[];
  deviations_from_plan: string[];
  gap_signals: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TierResult {
  status: string | null;
  details: string | null;
}

export interface GateTierResults {
  tier_0: TierResult | null;
  tier_1: TierResult | null;
  tier_2: TierResult | null;
}

export interface GateRun {
  gate_run_id: string | null;
  verdict: string | null;
  tier_results: GateTierResults | null;
  created_at: string | null;
}

export interface GateResults {
  mission_id: string | null;
  task_id: string | null;
  runs: GateRun[];
  created_at: string | null;
  updated_at: string | null;
}

export interface DebtCandidate {
  title: string | null;
  kind: string | null;
  severity: string | null;
  summary: string | null;
}

export interface GapSignal {
  kind: string | null;
  summary: string | null;
}

export interface CriterionResult {
  criterion: string | null;
  passed: boolean | null;
  details: string | null;
}

export type EvidenceKind =
  | "implementation"
  | "review"
  | "verification"
  | "closure";

export interface EvidenceEntry {
  entry_id: number | null;
  evidence_kind: EvidenceKind | string | null;
  summary: string | null;
  artifacts: string[];
  memory_suggestions: string[];
  debt_candidates: DebtCandidate[];
  gap_signals: GapSignal[];
  revision_ref: number | null;
  verdict: string | null;
  concerns: string[];
  rationale: string | null;
  scope_examined: string | null;
  methods_used: string[];
  scope_excluded: string[];
  criteria_results: CriterionResult[];
  what_went_well: string[];
  what_broke: string[];
  what_was_surprising: string[];
  next_time_guidance: string[];
  created_at: string | null;
}

export interface EvidenceFile {
  mission_id: string | null;
  task_id: string | null;
  agent: string | null;
  slot: string | null;
  entries: EvidenceEntry[];
  created_at: string | null;
  updated_at: string | null;
}

export interface EvidenceFileMeta {
  filename: string;
  agent: string | null;
  slot: string | null;
  entry_count: number;
  latest_verdict: string | null;
  latest_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Project-level debts
export interface DebtRef {
  mission_id: string | null;
  task_id: string | null;
}

export interface DebtEntry {
  debt_id: string | null;
  severity: string | null;
  kind: string | null;
  title: string | null;
  description: string | null;
  introduced_by: DebtRef | null;
  status: string | null;
  resolved_by: DebtRef | null;
  resolution_rationale: string | null;
}

export interface Debts {
  entries: DebtEntry[];
  created_at: string | null;
  updated_at: string | null;
}

// Events
export interface EventEntry {
  event_id: string | null;
  kind: string | null;
  actor: string | null;
  triggered_by: unknown | null;
  prior_event: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface EventsPage {
  events: EventEntry[];
  total_count: number;
  page: number;
  page_size: number;
}

// Memory
export interface AgentMemory {
  agent_name: string;
  content: string;
}

// Frontend response aggregates
export interface MissionSummary {
  mission_id: string;
  mission_name: string | null;
  phase: string | null;
  task_total: number;
  task_completed: number;
  is_active: boolean;
  created_at: string | null;
}

export interface ProjectSummary {
  name: string;
  path: string;
  mission_id: string | null;
  mission_name: string | null;
  phase: string | null;
  task_total: number;
  task_completed: number;
  active_tasks: string[];
  debt_total: number;
  debt_by_severity: SeverityRollup;
  last_activity: string | null;
  status: "ok" | "no_geas" | "error";
}

export interface TaskRow {
  task_id: string;
  title: string;
  goal: string | null;
  status: string;
  risk_level: string | null;
  primary_worker_type: string | null;
  required_reviewers: string[];
  active_agent: string | null;
  verify_fix_iterations: number;
  acceptance_criteria: string[];
  dependencies: string[];
  surfaces: string[];
}

export interface TaskDetail {
  task_id: string;
  contract: TaskContract | null;
  state: TaskState | null;
  implementation_contract: ImplementationContract | null;
  self_check: SelfCheck | null;
  gate_results: GateResults | null;
  deliberations: DeliberationsFile | null;
  evidence_files: EvidenceFileMeta[];
}

export interface MissionDetail {
  mission_id: string;
  spec: MissionSpec | null;
  state: MissionState | null;
  design_markdown: string | null;
  phase_reviews: PhaseReviewsFile | null;
  verdicts: MissionVerdictsFile | null;
  deliberations: DeliberationsFile | null;
  gap: Gap | null;
  memory_update: MemoryUpdate | null;
  has_candidates: boolean;
}
