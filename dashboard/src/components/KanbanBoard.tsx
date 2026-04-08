import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Ban, AlertTriangle, XCircle, Pause, ClipboardList } from "lucide-react";
import type { TaskInfo, DebtInfo } from "../types";
import TaskCard from "./TaskCard";
import TaskDetailModal from "./TaskDetailModal";
import DebtPanel from "./DebtPanel";

/** Normalize a path for cross-platform comparison */
function normalizePath(p: string): string {
  return p.replace(/^\\\\\?\\/, '').replace(/\\/g, '/').replace(/\/$/, '');
}

const COLUMNS = [
  { key: "drafted", label: "Drafted", color: "#656d76" },
  { key: "ready", label: "Ready", color: "#58a6ff" },
  { key: "implementing", label: "Implementing", color: "#3fb950" },
  { key: "reviewed", label: "Reviewed", color: "#d29922" },
  { key: "integrated", label: "Integrated", color: "#58a6ff" },
  { key: "verified", label: "Verified", color: "#3fb950" },
  { key: "passed", label: "Passed", color: "#56d364" },
] as const;

const AUXILIARY_STATES = [
  { key: "blocked", label: "Blocked", color: "#d29922", icon: Ban },
  { key: "escalated", label: "Escalated", color: "#f85149", icon: AlertTriangle },
  { key: "cancelled", label: "Cancelled", color: "#656d76", icon: XCircle },
  { key: "paused", label: "Paused", color: "#58a6ff", icon: Pause },
] as const;

interface KanbanBoardProps {
  projectPath: string;
  projectName: string;
  missionId?: string | null;
  onBack: () => void;
  currentTaskId?: string | null;
  agentInFlight?: string | null;
  pipelineStep?: string | null;
  parallelBatch?: string[] | null;
  completedInBatch?: string[];
}

function isTaskActive(
  taskId: string,
  currentTaskId?: string | null,
  parallelBatch?: string[] | null,
): boolean {
  if (parallelBatch && parallelBatch.length > 0) {
    return parallelBatch.includes(taskId);
  }
  return !!currentTaskId && taskId === currentTaskId;
}

function isTaskCompletedInBatch(
  taskId: string,
  completedInBatch?: string[],
): boolean {
  return completedInBatch?.includes(taskId) ?? false;
}

export default function KanbanBoard({
  projectPath,
  projectName,
  missionId,
  onBack,
  currentTaskId,
  agentInFlight,
  pipelineStep,
  parallelBatch,
  completedInBatch,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [debt, setDebt] = useState<DebtInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!missionId) {
          setTasks([]);
          setDebt({ total: 0, by_severity: { low: 0, normal: 0, high: 0, critical: 0 }, items: [] });
          setLoading(false);
          return;
        }
        const taskParams = { path: projectPath, mission_id: missionId };
        const debtParams = { path: projectPath, mission_id: missionId };
        const [taskResult, debtResult] = await Promise.all([
          invoke<TaskInfo[]>("get_project_tasks", taskParams),
          invoke<DebtInfo>("get_project_debt", debtParams).catch(
            (): DebtInfo => ({
              total: 0,
              by_severity: { low: 0, normal: 0, high: 0, critical: 0 },
              items: [],
            })
          ),
        ]);
        if (!cancelled) {
          setTasks(taskResult);
          setDebt(debtResult);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectPath, missionId]);

  // Auto-refresh: subscribe to file watcher events
  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      if (normalizePath(event.payload.path) !== normalizePath(projectPath)) return;
      if (!missionId) return;
      setTimeout(async () => {
        try {
          const [taskResult, debtResult] = await Promise.all([
            invoke<TaskInfo[]>("get_project_tasks", { path: projectPath, mission_id: missionId }),
            invoke<DebtInfo>("get_project_debt", { path: projectPath, mission_id: missionId }).catch(
              (): DebtInfo => ({ total: 0, by_severity: { low: 0, normal: 0, high: 0, critical: 0 }, items: [] })
            ),
          ]);
          setTasks(taskResult);
          setDebt(debtResult);
        } catch {
          // Ignore refresh errors — keep existing data visible
        }
      }, 300);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [projectPath, missionId]);

  const tasksByStatus = new Map<string, TaskInfo[]>();
  for (const col of COLUMNS) tasksByStatus.set(col.key, []);
  const auxiliaryTasks = new Map<string, TaskInfo[]>();
  for (const aux of AUXILIARY_STATES) auxiliaryTasks.set(aux.key, []);
  for (const task of tasks) {
    const primary = tasksByStatus.get(task.status);
    if (primary) { primary.push(task); }
    else { auxiliaryTasks.get(task.status)?.push(task); }
  }
  const totalAuxiliary = Array.from(auxiliaryTasks.values()).reduce((s, a) => s + a.length, 0);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary text-sm cursor-pointer transition-colors active:scale-95"
        >
          <ArrowLeft size={16} className="inline" /> Back
        </button>
        <h1 className="text-base md:text-lg font-semibold text-text-primary truncate">
          {projectName}
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))`, minWidth: `${COLUMNS.length * 130 + (COLUMNS.length - 1) * 8}px` }}>
            {COLUMNS.map((_, i) => (
              <div key={i} className="flex flex-col bg-bg-surface rounded-lg min-w-0">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
                  <div className="h-3 w-16 rounded bg-bg-elevated animate-skeleton" />
                  <div className="h-4 w-6 rounded-full bg-bg-elevated animate-skeleton" />
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: Math.max(1, 3 - i) }).map((_, j) => (
                    <div key={j} className="bg-bg-elevated rounded-lg p-3">
                      <div className="h-3 w-full rounded bg-bg-primary/50 animate-skeleton mb-2" />
                      <div className="h-3 w-2/3 rounded bg-bg-primary/50 animate-skeleton" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">Failed to load tasks</p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30"><ClipboardList size={40} /></div>
            <span className="text-text-muted text-sm">No tasks in this mission</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          {/* Grid container — shrinks with parent, has a CSS min-width floor */}
          {/* min-width: COLUMNS * 130px + gaps. Ensures readable columns before scroll. */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))`, minWidth: `${COLUMNS.length * 130 + (COLUMNS.length - 1) * 8}px` }}>
            {COLUMNS.map((col) => {
              const colTasks = tasksByStatus.get(col.key) ?? [];
              return (
                <div key={col.key} className="flex flex-col bg-bg-surface rounded-lg min-w-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
                    <span className="text-xs font-medium" style={{ color: colTasks.length > 0 ? col.color : "#656d76" }}>
                      {col.label}
                    </span>
                    <span
                      className="text-[11px] rounded-full px-1.5 py-0.5"
                      style={{
                        backgroundColor: colTasks.length > 0 ? col.color + "20" : "rgba(101,109,118,0.15)",
                        color: colTasks.length > 0 ? col.color : "#656d76",
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {/* Cards — grow naturally, no overflow */}
                  <div className="flex flex-col gap-1.5 p-1.5">
                    {colTasks.map((task) => {
                      const active = isTaskActive(task.task_id, currentTaskId, parallelBatch);
                      const batchDone = isTaskCompletedInBatch(task.task_id, completedInBatch);
                      return (
                        <TaskCard
                          key={task.task_id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                          isActive={active && !batchDone}
                          isCompletedInBatch={batchDone}
                          agentName={!parallelBatch && task.task_id === currentTaskId ? (agentInFlight ?? undefined) : undefined}
                          pipelineStep={!parallelBatch && task.task_id === currentTaskId ? (pipelineStep ?? undefined) : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auxiliary states */}
          {totalAuxiliary > 0 && (
            <div className="pb-3 pt-2">
              <div className="bg-bg-surface rounded-lg p-3">
                <span className="text-xs text-text-muted">
                  {totalAuxiliary} task{totalAuxiliary !== 1 ? "s" : ""} in auxiliary states
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {AUXILIARY_STATES.map((aux) => {
                    const items = auxiliaryTasks.get(aux.key) ?? [];
                    if (items.length === 0) return null;
                    const Icon = aux.icon;
                    return items.map((task) => (
                      <span
                        key={task.task_id}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs cursor-pointer hover:opacity-80 transition-opacity duration-150"
                        onClick={() => setSelectedTask(task)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedTask(task); } }}
                        style={{ backgroundColor: aux.color + "18", color: aux.color }}
                      >
                        <Icon size={12} />
                        <span className="truncate max-w-[180px]">{task.title}</span>
                        <span className="font-medium ml-0.5 opacity-70" style={{ fontSize: "10px" }}>{aux.label}</span>
                      </span>
                    ));
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Debt panel */}
          {debt && (
            <div className="pb-4">
              <DebtPanel debt={debt} />
            </div>
          )}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
