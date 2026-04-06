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
