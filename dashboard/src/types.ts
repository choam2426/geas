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
