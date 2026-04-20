import { useState, useEffect } from "react";
import * as geas from "../lib/geasClient";
import type { MissionSummary, ProjectSummary } from "../types";
import { Archive, Brain, Clock, FileText } from "lucide-react";
import PhaseBadge from "./PhaseBadge";
import ProgressBar from "./ProgressBar";
import { formatDate } from "../utils/dates";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface ProjectDashboardProps {
  projectPath: string;
  projectName: string;
  onViewTasks: (missionId?: string) => void;
  onViewDebt: () => void;
  onViewKanban: (missionId: string) => void;
  onViewMemory?: () => void;
  onViewTimeline?: () => void;
  onViewDetail?: (missionId: string) => void;
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
  onViewMemory,
  onViewTimeline,
  onViewDetail,
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
          geas.getMissionHistory(projectPath),
          geas.getProjectSummary(projectPath).catch(() => null),
        ]);
        if (!cancelled) {
          setMissions(missionResult);
          setSummary(summaryResult);
        }
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
  }, [projectPath]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    (async () => {
      try {
        const [missionResult, summaryResult] = await Promise.all([
          geas.getMissionHistory(projectPath),
          geas.getProjectSummary(projectPath).catch(() => null),
        ]);
        setMissions(missionResult);
        setSummary(summaryResult);
      } catch {
        // ignore
      }
    })();
  }, [refreshKey, projectPath]);

  const activeMission = missions.find((m) => m.is_active) ?? null;
  const totalTasks = missions.reduce((sum, m) => sum + m.task_total, 0);
  const totalDebt = summary?.debt_total ?? 0;
  const lastActivity = summary?.last_activity ?? null;
  const activeTasks = summary?.active_tasks ?? [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 min-w-0">
      <div className="w-full min-w-[320px]">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-text-primary">
            {projectName}
          </h1>
          <p className="text-xs md:text-sm text-text-muted break-all mt-1">
            {projectPath}
          </p>
        </div>

        {(onViewMemory || onViewTimeline) && (
          <div className="mb-6 flex gap-2 flex-wrap">
            {onViewTimeline && (
              <button
                onClick={onViewTimeline}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-bg-surface border border-border-default text-sm text-text-secondary cursor-pointer hover:text-text-primary hover:bg-bg-elevated/50 active:scale-95 transition-all"
              >
                <Clock size={16} />
                Events
              </button>
            )}
            {onViewMemory && (
              <button
                onClick={onViewMemory}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-bg-surface border border-border-default text-sm text-text-secondary cursor-pointer hover:text-text-primary hover:bg-bg-elevated/50 active:scale-95 transition-all"
              >
                <Brain size={16} />
                Memory
              </button>
            )}
          </div>
        )}

        {/* Active task badges (if any) */}
        {activeTasks.length > 0 && (
          <div className="bg-bg-surface rounded-lg p-4 mb-4 border border-border-default border-l-2 border-l-status-green shadow-[0_0_12px_rgba(63,185,80,0.08)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot shrink-0" />
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                {activeTasks.length === 1 ? "Active task" : `${activeTasks.length} active tasks`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeTasks.map((tid) => (
                <span
                  key={tid}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] bg-bg-elevated text-text-primary"
                >
                  {tid}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Active mission card */}
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
                  onClick={() => onViewTasks(activeMission.mission_id)}
                  className="px-4 py-1.5 rounded-md bg-accent text-white text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                >
                  View Tasks
                </button>
                <button
                  onClick={onViewDebt}
                  className="px-4 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-sm cursor-pointer hover:text-text-primary hover:bg-bg-elevated/80 active:scale-95 transition-all"
                >
                  View Debt
                </button>
                {onViewDetail && (
                  <button
                    onClick={() => onViewDetail(activeMission.mission_id)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-sm cursor-pointer hover:text-text-primary hover:bg-bg-elevated/80 active:scale-95 transition-all"
                  >
                    <FileText size={14} />
                    Detail
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">No active mission</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              Total Tasks
            </p>
            <p className="text-2xl font-bold text-text-primary">{totalTasks}</p>
          </div>
          <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              Open Debt
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
                        (mission.task_completed / mission.task_total) * 100,
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
                    } ${
                      mission.task_total > 0 &&
                      mission.task_completed === mission.task_total &&
                      !mission.is_active
                        ? "opacity-60"
                        : ""
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
                      <span className="text-xs text-text-muted">
                        {formatDate(mission.created_at)}
                      </span>
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
