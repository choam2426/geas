import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MissionSummary, ProjectSummary } from "../types";
import { Archive } from "lucide-react";
import PhaseBadge from "./PhaseBadge";
import ProgressBar from "./ProgressBar";

interface ProjectDashboardProps {
  projectPath: string;
  projectName: string;
  onViewTasks: (missionId?: string) => void;
  onViewDebt: (missionId?: string) => void;
  onViewKanban: (missionId: string) => void;
}

function formatActivity(timestamp: string | null): string {
  if (!timestamp) return "No activity recorded";

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "No activity recorded";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function ProjectDashboard({
  projectPath,
  projectName,
  onViewTasks,
  onViewDebt,
  onViewKanban,
}: ProjectDashboardProps) {
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [missionResult, summaryResult] = await Promise.all([
          invoke<MissionSummary[]>("get_mission_history", { path: projectPath }),
          invoke<ProjectSummary>("get_project_summary", { path: projectPath }).catch(() => null),
        ]);
        if (!cancelled) {
          setMissions(missionResult);
          setSummary(summaryResult);
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

  const activeMission = missions.find((m) => m.is_active) ?? null;

  const totalTasks = missions.reduce((sum, m) => sum + m.task_total, 0);
  const totalDebt = summary?.debt_total ?? 0;
  const lastActivity = summary?.last_activity ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">
            {projectName}
          </h1>
          <p className="text-xs md:text-sm text-text-muted break-all mt-1">
            {projectPath}
          </p>
        </div>

        {/* Currently Working Card */}
        {summary?.agent_in_flight && (
          <div className="bg-bg-surface rounded-lg p-4 mb-4 border border-border-default border-l-2 border-l-status-green shadow-[0_0_12px_rgba(63,185,80,0.08)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot shrink-0" />
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">Currently working</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              {summary.current_task_id && (
                <span>Task: <span className="text-text-primary font-medium">{summary.current_task_id}</span></span>
              )}
              <span>Agent: <span className="text-text-primary font-medium">{summary.agent_in_flight}</span></span>
              {summary.pipeline_step && (
                <span>Step: <span className="text-text-primary font-medium">{summary.pipeline_step}</span></span>
              )}
            </div>
          </div>
        )}

        {/* Active Mission Card */}
        <div className="bg-bg-surface rounded-lg p-5 mb-6 border border-border-default border-l-2 border-l-accent">
          {activeMission ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {activeMission.mission_name ?? activeMission.mission_id}
                </h2>
                <PhaseBadge phase={activeMission.phase} />
              </div>
              <ProgressBar
                completed={activeMission.task_completed}
                total={activeMission.task_total}
              />
              <div className="flex flex-col md:flex-row gap-2 mt-4">
                <button
                  onClick={() => onViewTasks()}
                  className="px-4 py-1.5 rounded-md bg-accent text-white text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  View Tasks
                </button>
                <button
                  onClick={() => onViewDebt()}
                  className="px-4 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-sm cursor-pointer hover:text-text-primary hover:bg-bg-elevated/80 active:scale-95 transition-all"
                >
                  View Debt
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">No active mission</p>
          )}
        </div>

        {/* Overall Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              Total Tasks
            </p>
            <p className="text-2xl font-bold text-text-primary">{totalTasks}</p>
          </div>
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              Debt Items
            </p>
            <p className="text-2xl font-bold text-text-primary">{totalDebt}</p>
          </div>
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              Last Activity
            </p>
            <p className="text-sm font-medium text-text-primary mt-1">
              {formatActivity(lastActivity)}
            </p>
          </div>
        </div>

        {/* Mission List */}
        <div>
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
            Missions
          </h2>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-bg-surface rounded-lg p-4 border border-border-default"
                >
                  <div className="h-4 w-48 rounded bg-bg-elevated animate-skeleton mb-2" />
                  <div className="h-3 w-32 rounded bg-bg-elevated animate-skeleton" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
              <p className="text-status-red text-sm">Failed to load missions</p>
              <p className="text-text-muted text-xs mt-1">{error}</p>
            </div>
          ) : missions.length === 0 ? (
            <div className="bg-bg-surface rounded-lg p-6 border border-border-default text-center">
              <div className="mb-2 flex justify-center opacity-30">
                <Archive size={32} />
              </div>
              <p className="text-sm text-text-muted">No missions yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {missions.map((mission) => {
                const pct =
                  mission.task_total > 0
                    ? Math.round(
                        (mission.task_completed / mission.task_total) * 100
                      )
                    : 0;

                return (
                  <button
                    key={mission.mission_id}
                    onClick={() => onViewKanban(mission.mission_id)}
                    className={`w-full text-left rounded-lg px-4 py-3 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer hover:bg-bg-elevated/50 ${
                      mission.is_active
                        ? "bg-bg-surface border-l-2 border-l-accent"
                        : "bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {mission.mission_name ?? mission.mission_id}
                      </span>
                      <PhaseBadge phase={mission.phase} size="sm" />
                      {mission.is_active && (
                        <span className="text-[10px] font-medium text-accent bg-accent/15 rounded-full px-1.5 py-0.5 shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-text-muted">
                        {mission.task_completed}/{mission.task_total}
                      </span>
                      {mission.task_total > 0 && (
                        <div className="w-16 h-1 rounded-full bg-bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full bg-status-green transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
