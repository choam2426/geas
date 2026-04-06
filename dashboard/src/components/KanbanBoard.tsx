import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TaskInfo, DebtInfo } from "../types";
import TaskCard from "./TaskCard";
import DebtPanel from "./DebtPanel";

const COLUMNS = [
  { key: "drafted", label: "Drafted", color: "#656d76" },
  { key: "ready", label: "Ready", color: "#58a6ff" },
  { key: "implementing", label: "Implementing", color: "#3fb950" },
  { key: "reviewed", label: "Reviewed", color: "#d29922" },
  { key: "integrated", label: "Integrated", color: "#58a6ff" },
  { key: "verified", label: "Verified", color: "#3fb950" },
  { key: "passed", label: "Passed", color: "#56d364" },
] as const;

interface KanbanBoardProps {
  projectPath: string;
  projectName: string;
  onBack: () => void;
}

export default function KanbanBoard({
  projectPath,
  projectName,
  onBack,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [debt, setDebt] = useState<DebtInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [taskResult, debtResult] = await Promise.all([
          invoke<TaskInfo[]>("get_project_tasks", { path: projectPath }),
          invoke<DebtInfo>("get_project_debt", { path: projectPath }).catch(
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
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const tasksByStatus = new Map<string, TaskInfo[]>();
  for (const col of COLUMNS) {
    tasksByStatus.set(col.key, []);
  }
  for (const task of tasks) {
    const bucket = tasksByStatus.get(task.status);
    if (bucket) {
      bucket.push(task);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary text-sm cursor-pointer transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-lg font-semibold text-text-primary truncate">
          {projectName}
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-text-muted text-sm">Loading tasks...</span>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load tasks
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-text-muted text-sm">
            No tasks in this mission
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Kanban columns */}
          <div className="flex gap-3 p-4 overflow-x-auto min-h-0">
            {COLUMNS.map((col) => {
              const colTasks = tasksByStatus.get(col.key) ?? [];
              return (
                <div
                  key={col.key}
                  className="flex flex-col bg-bg-surface rounded-lg min-w-[200px] w-[200px] shrink-0"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
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
                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 overflow-y-auto">
                    {colTasks.map((task) => (
                      <TaskCard key={task.task_id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Debt panel */}
          {debt && (
            <div className="px-4 pb-4">
              <DebtPanel debt={debt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
