import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Ban,
  AlertTriangle,
  XCircle,
  ClipboardList,
} from "lucide-react";
import * as geas from "../lib/geasClient";
import type { TaskRow } from "../types";
import TaskCard from "./TaskCard";
import TaskDetailModal from "./TaskDetailModal";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

const COLUMNS = [
  { key: "drafted", label: "Drafted", color: "#656d76" },
  { key: "ready", label: "Ready", color: "#58a6ff" },
  { key: "implementing", label: "Implementing", color: "#3fb950" },
  { key: "reviewing", label: "Reviewing", color: "#d29922" },
  { key: "deciding", label: "Deciding", color: "#56d364" },
  { key: "passed", label: "Passed", color: "#56d364" },
] as const;

const AUXILIARY_STATES = [
  { key: "blocked", label: "Blocked", color: "#d29922", icon: Ban },
  { key: "escalated", label: "Escalated", color: "#f85149", icon: AlertTriangle },
  { key: "cancelled", label: "Cancelled", color: "#656d76", icon: XCircle },
] as const;

interface KanbanBoardProps {
  projectPath: string;
  projectName: string;
  missionId?: string | null;
  onBack?: () => void;
  activeTasks?: string[];
  /**
   * When true, the component skips rendering its own header (the outer shell
   * is providing one). Default false preserves the standalone-page behavior.
   */
  embedded?: boolean;
}

export default function KanbanBoard({
  projectPath,
  projectName,
  missionId,
  onBack,
  activeTasks,
  embedded = false,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!missionId) {
          setTasks([]);
          setLoading(false);
          return;
        }
        const taskResult = await geas.listTasks(projectPath, missionId);
        if (!cancelled) setTasks(taskResult);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectPath, missionId]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0 || !missionId) return;
    (async () => {
      try {
        const taskResult = await geas.listTasks(projectPath, missionId);
        setTasks(taskResult);
      } catch {
        // ignore
      }
    })();
  }, [refreshKey, projectPath, missionId]);

  const tasksByStatus = new Map<string, TaskRow[]>();
  for (const col of COLUMNS) tasksByStatus.set(col.key, []);
  const auxiliaryTasks = new Map<string, TaskRow[]>();
  for (const aux of AUXILIARY_STATES) auxiliaryTasks.set(aux.key, []);
  for (const task of tasks) {
    const primary = tasksByStatus.get(task.status);
    if (primary) {
      primary.push(task);
    } else {
      auxiliaryTasks.get(task.status)?.push(task);
    }
  }
  const totalAuxiliary = Array.from(auxiliaryTasks.values()).reduce(
    (s, a) => s + a.length,
    0,
  );

  const activeSet = new Set(activeTasks ?? []);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {!embedded && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="text-fg-muted hover:text-fg text-sm cursor-pointer transition-colors active:scale-95"
            >
              <ArrowLeft size={16} className="inline" /> Back
            </button>
          )}
          <h1 className="text-base md:text-lg font-semibold text-fg truncate">
            {projectName}
          </h1>
        </div>
      )}

      {loading ? (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))`,
              minWidth: `${COLUMNS.length * 130 + (COLUMNS.length - 1) * 8}px`,
            }}
          >
            {COLUMNS.map((_, i) => (
              <div
                key={i}
                className="flex flex-col bg-bg-surface rounded-lg min-w-0"
              >
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
            <div className="mb-3 flex justify-center opacity-30">
              <ClipboardList size={40} />
            </div>
            <span className="text-text-muted text-sm">
              No tasks in this mission
            </span>
          </div>
        </div>
      ) : (
        /*
         * Two-region layout:
         *   - top: flex-row of columns, each column scrolls its own task
         *     list vertically. The row itself is wrapped in an
         *     overflow-x-auto band so the board scrolls horizontally on
         *     narrow viewports.
         *   - bottom: auxiliary-state summary, natural height, always
         *     visible below the columns (doesn't scroll with tasks).
         */
        <>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-4 pt-4">
            <div
              className="flex gap-2 h-full"
              style={{
                minWidth: `${COLUMNS.length * 130 + (COLUMNS.length - 1) * 8}px`,
              }}
            >
              {COLUMNS.map((col) => {
                const colTasks = tasksByStatus.get(col.key) ?? [];
                return (
                  <div
                    key={col.key}
                    className="flex-1 min-w-[130px] flex flex-col bg-bg-surface rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default flex-shrink-0">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: colTasks.length > 0 ? col.color : "#656d76",
                        }}
                      >
                        {col.label}
                      </span>
                      <span
                        className="text-[11px] rounded-full px-1.5 py-0.5"
                        style={{
                          backgroundColor:
                            colTasks.length > 0
                              ? col.color + "20"
                              : "rgba(101,109,118,0.15)",
                          color: colTasks.length > 0 ? col.color : "#656d76",
                        }}
                      >
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-1.5">
                      {colTasks.map((task) => {
                        const isActive = activeSet.has(task.task_id);
                        return (
                          <TaskCard
                            key={task.task_id}
                            task={task}
                            onClick={() => setSelectedTask(task)}
                            isActive={isActive}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalAuxiliary > 0 && (
            <div className="flex-shrink-0 px-4 pb-3 pt-2">
              <div className="bg-bg-surface rounded-lg p-3">
                <span className="text-xs text-text-muted">
                  {totalAuxiliary} task{totalAuxiliary !== 1 ? "s" : ""} in
                  auxiliary states
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTask(task);
                          }
                        }}
                        style={{ backgroundColor: aux.color + "18", color: aux.color }}
                      >
                        <Icon size={12} />
                        <span className="truncate max-w-[180px]">
                          {task.title}
                        </span>
                        <span
                          className="font-medium ml-0.5 opacity-70"
                          style={{ fontSize: "10px" }}
                        >
                          {aux.label}
                        </span>
                      </span>
                    ));
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedTask && missionId && (
        <TaskDetailModal
          task={selectedTask}
          projectPath={projectPath}
          missionId={missionId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
