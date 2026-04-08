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
  debt_by_severity: {
    low: number;
    normal: number;
    high: number;
    critical: number;
  };
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
}

export interface DebtItem {
  debt_id: string;
  severity: string;
  kind: string | null;
  title: string;
  status: string | null;
  description: string | null;
  introduced_by_task_id: string | null;
}

export interface DebtInfo {
  total: number;
  by_severity: { low: number; normal: number; high: number; critical: number };
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

export interface MemorySummary {
  memory_id: string;
  memory_type: string;
  state: string;
  title: string;
  summary: string;
  scope: string;
  tags: string[];
  created_at?: string;
  source_dir: string;
}

export interface MemoryDetail {
  memory_id: string;
  memory_type: string;
  state: string;
  title: string;
  summary: string;
  scope: string;
  body: string[];
  tags: string[];
  evidence_refs: string[];
  signals?: {
    evidence_count: number;
    reuse_count: number;
    confidence: number;
  };
  review_after?: string;
  supersedes: string[];
  superseded_by?: string;
  created_at?: string;
  updated_at?: string;
  source_dir: string;
}
