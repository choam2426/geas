import { invoke } from "@tauri-apps/api/core";
import type {
  AgentMemory,
  Debts,
  DeliberationsFile,
  EventsPage,
  EvidenceFile,
  EvidenceFileMeta,
  Gap,
  GateResults,
  ImplementationContract,
  MemoryUpdate,
  MissionDetail,
  MissionSummary,
  MissionVerdictsFile,
  PhaseReviewsFile,
  ProjectEntry,
  ProjectSummary,
  SelfCheck,
  TaskDetail,
  TaskRow,
} from "../types";

// Typed wrapper over Tauri invoke. All v3 artifact reads go through here.

// ---------- Project registry ----------
export const listProjects = () => invoke<ProjectEntry[]>("list_projects");
export const addProject = (path: string) =>
  invoke<ProjectEntry>("add_project", { path });
export const removeProject = (path: string) =>
  invoke<void>("remove_project", { path });

// ---------- Project-level reads ----------
export const getProjectSummary = (path: string) =>
  invoke<ProjectSummary>("get_project_summary", { path });

export const getDebts = (path: string) =>
  invoke<Debts | null>("get_debts", { path });

export const getEvents = (args: {
  path: string;
  mission_id?: string | null;
  task_id?: string | null;
  kind?: string | null;
  actor?: string | null;
  page: number;
  page_size: number;
}) =>
  invoke<EventsPage>("get_events", {
    path: args.path,
    mission_id: args.mission_id ?? null,
    task_id: args.task_id ?? null,
    kind: args.kind ?? null,
    actor: args.actor ?? null,
    page: args.page,
    page_size: args.page_size,
  });

// ---------- Mission-level ----------
export const getMissionHistory = (path: string) =>
  invoke<MissionSummary[]>("get_mission_history", { path });

export const getMissionDetail = (path: string, mission_id: string) =>
  invoke<MissionDetail>("get_mission_detail", { path, mission_id });

export const getMissionDesign = (path: string, mission_id: string) =>
  invoke<string | null>("get_mission_design", { path, mission_id });

export const getPhaseReviews = (path: string, mission_id: string) =>
  invoke<PhaseReviewsFile | null>("get_phase_reviews", { path, mission_id });

export const getMissionVerdicts = (path: string, mission_id: string) =>
  invoke<MissionVerdictsFile | null>("get_mission_verdicts", { path, mission_id });

export const getMissionDeliberations = (path: string, mission_id: string) =>
  invoke<DeliberationsFile | null>("get_mission_deliberations", { path, mission_id });

export const getGap = (path: string, mission_id: string) =>
  invoke<Gap | null>("get_gap", { path, mission_id });

export const getMemoryUpdate = (path: string, mission_id: string) =>
  invoke<MemoryUpdate | null>("get_memory_update", { path, mission_id });

export const getCandidates = (path: string, mission_id: string) =>
  invoke<unknown | null>("get_candidates", { path, mission_id });

// ---------- Task-level ----------
export const listTasks = (path: string, mission_id: string) =>
  invoke<TaskRow[]>("list_tasks", { path, mission_id });

export const getTaskDetail = (
  path: string,
  mission_id: string,
  task_id: string,
) => invoke<TaskDetail>("get_task_detail", { path, mission_id, task_id });

export const listEvidenceFiles = (
  path: string,
  mission_id: string,
  task_id: string,
) =>
  invoke<EvidenceFileMeta[]>("list_evidence_files", {
    path,
    mission_id,
    task_id,
  });

export const readEvidenceFile = (
  path: string,
  mission_id: string,
  task_id: string,
  filename: string,
) =>
  invoke<EvidenceFile | null>("read_evidence_file", {
    path,
    mission_id,
    task_id,
    filename,
  });

export const getSelfCheck = (
  path: string,
  mission_id: string,
  task_id: string,
) => invoke<SelfCheck | null>("get_self_check", { path, mission_id, task_id });

export const getGateResults = (
  path: string,
  mission_id: string,
  task_id: string,
) =>
  invoke<GateResults | null>("get_gate_results", {
    path,
    mission_id,
    task_id,
  });

export const getImplementationContract = (
  path: string,
  mission_id: string,
  task_id: string,
) =>
  invoke<ImplementationContract | null>("get_implementation_contract", {
    path,
    mission_id,
    task_id,
  });

export const getTaskDeliberations = (
  path: string,
  mission_id: string,
  task_id: string,
) =>
  invoke<DeliberationsFile | null>("get_task_deliberations", {
    path,
    mission_id,
    task_id,
  });

// ---------- Memory ----------
export const getSharedMemory = (path: string) =>
  invoke<string | null>("get_shared_memory", { path });

export const listAgentMemories = (path: string) =>
  invoke<AgentMemory[]>("list_agent_memories", { path });

export const getAgentMemory = (path: string, agent: string) =>
  invoke<string | null>("get_agent_memory", { path, agent });
