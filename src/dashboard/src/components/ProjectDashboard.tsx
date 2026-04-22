import { useEffect, useMemo, useState } from "react";
import { Archive, AlertTriangle, Brain, ChevronDown, ChevronRight } from "lucide-react";
import * as geas from "../lib/geasClient";
import type { MissionSummary, ProjectSummary } from "../types";
import PhaseBadge from "./PhaseBadge";
import PathBadge from "./PathBadge";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

/**
 * Dashboard (project landing) — the post-reorg top-level view for a
 * project. Combines two responsibilities that used to be split across
 * `ProjectDashboard` (active mission summary) and `MissionHistory`
 * (standalone history list):
 *
 *   ACTIVE   — missions with is_active = true, rendered as a large card
 *   HISTORY  — completed / escalated / cancelled missions in a tight list,
 *              with resolved-state items collapsed by default
 *
 * Clicking a mission row navigates to the mission-detail view via
 * `onViewDetail`, which in turn opens the mission-scoped sub-tabs.
 *
 * Project-wide rollups (debt, memory) are surfaced as small action links
 * in the project header row; the StatusBar carries running totals.
 */

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

/** True when the mission is terminal in the "resolved / done" sense. */
function isResolved(m: MissionSummary): boolean {
  if (m.is_active) return false;
  // Heuristic — phase 'consolidated' | 'complete' means the mission is
  // wrapped up. Other terminal states (escalated / cancelled) stay visible.
  const ph = (m.phase ?? "").toLowerCase();
  return ph === "consolidated" || ph === "complete";
}

function MissionCard({
  mission,
  onClick,
  variant,
}: {
  mission: MissionSummary;
  onClick: () => void;
  variant: "active" | "past";
}) {
  const pct =
    mission.task_total > 0
      ? Math.round((mission.task_completed / mission.task_total) * 100)
      : 0;

  // ASCII-style progress bar — matches the console direction.
  const barWidth = variant === "active" ? 28 : 18;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  return (
    <button
      onClick={onClick}
      className={
        "group w-full text-left transition-colors cursor-pointer border-l-2 " +
        (variant === "active"
          ? "bg-bg-1 border-green hover:bg-bg-2 px-5 py-4"
          : "bg-transparent border-transparent hover:bg-bg-1 hover:border-border px-5 py-3")
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* id line */}
          <div className="font-mono text-[11px] text-fg-dim mb-1 flex items-center gap-2">
            <span>{mission.mission_id}</span>
            {mission.is_active && (
              <span className="text-green">● active</span>
            )}
          </div>
          {/* name */}
          <div
            className={
              (variant === "active"
                ? "text-[15px] font-medium "
                : "text-[13px] ") + "text-fg truncate"
            }
          >
            {mission.mission_name ?? mission.mission_id}
          </div>
          {/* meta row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[11px] text-fg-muted">
            <PhaseBadge phase={mission.phase} size="sm" />
            <span>
              {mission.task_completed}/{mission.task_total} passed
            </span>
          </div>
          {/* progress bar */}
          {mission.task_total > 0 && (
            <div className="mt-2 font-mono text-[11px] text-fg-dim flex items-center gap-2">
              <span className="text-green">{bar}</span>
              <span>{pct}%</span>
            </div>
          )}
        </div>
        <ChevronRight
          size={14}
          className="text-fg-dim group-hover:text-fg-muted flex-shrink-0 mt-1"
        />
      </div>
    </button>
  );
}

export default function ProjectDashboard({
  projectPath,
  projectName,
  onViewDebt,
  onViewMemory,
  onViewDetail,
  onViewKanban,
}: ProjectDashboardProps) {
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

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
        // ignore — keep the prior view
      }
    })();
  }, [refreshKey, projectPath]);

  const { active, nonResolvedPast, resolvedPast } = useMemo(() => {
    const activeMissions: MissionSummary[] = [];
    const nonResolved: MissionSummary[] = [];
    const resolved: MissionSummary[] = [];
    for (const m of missions) {
      if (m.is_active) activeMissions.push(m);
      else if (isResolved(m)) resolved.push(m);
      else nonResolved.push(m);
    }
    return {
      active: activeMissions,
      nonResolvedPast: nonResolved,
      resolvedPast: resolved,
    };
  }, [missions]);

  const goToMission = (missionId: string) => {
    if (onViewDetail) onViewDetail(missionId);
    else onViewKanban(missionId);
  };

  return (
    <div className="flex-1 overflow-auto min-w-0">
      <div className="mx-auto max-w-5xl px-6 py-5">
        {/* Project header */}
        <div className="mb-6 pb-4 border-b border-border">
          <h1 className="text-[18px] font-semibold text-fg">{projectName}</h1>
          <PathBadge path={projectPath} />

          <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-fg-muted">
            <span>
              {missions.length} mission{missions.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={onViewDebt}
              className="flex items-center gap-1 text-fg-muted hover:text-amber cursor-pointer transition-colors"
              title="Project debt ledger"
            >
              <AlertTriangle size={11} />
              debt {summary?.debt_total ?? 0}
            </button>
            {onViewMemory && (
              <button
                onClick={onViewMemory}
                className="flex items-center gap-1 text-fg-muted hover:text-cyan cursor-pointer transition-colors"
                title="Project memory browser"
              >
                <Brain size={11} />
                memory
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-bg-1 px-5 py-4 border-l-2 border-border"
              >
                <div className="h-3 w-32 rounded bg-bg-2 animate-skeleton mb-2" />
                <div className="h-4 w-64 rounded bg-bg-2 animate-skeleton mb-2" />
                <div className="h-3 w-24 rounded bg-bg-2 animate-skeleton" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-bg-1 px-5 py-4 border-l-2 border-red">
            <p className="text-red text-sm">Failed to load missions</p>
            <p className="font-mono text-[11px] text-fg-dim mt-1">{error}</p>
          </div>
        ) : missions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <Archive size={36} />
            </div>
            <p className="text-sm text-fg-muted">No missions yet</p>
            <p className="font-mono text-[11px] text-fg-dim mt-2">
              run <span className="text-cyan">geas mission set</span> to spawn one
            </p>
          </div>
        ) : (
          <>
            {/* ACTIVE */}
            {active.length > 0 && (
              <section className="mb-8">
                <SectionHeader
                  label="active"
                  count={active.length}
                  countLabel={active.length === 1 ? "mission" : "missions"}
                />
                <div className="flex flex-col gap-2">
                  {active.map((m) => (
                    <MissionCard
                      key={m.mission_id}
                      mission={m}
                      onClick={() => goToMission(m.mission_id)}
                      variant="active"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* HISTORY — non-resolved first (escalated, cancelled, other terminals) */}
            {(nonResolvedPast.length > 0 || resolvedPast.length > 0) && (
              <section>
                <SectionHeader
                  label="history"
                  count={nonResolvedPast.length + resolvedPast.length}
                  countLabel={
                    nonResolvedPast.length + resolvedPast.length === 1
                      ? "mission"
                      : "missions"
                  }
                />
                <div className="flex flex-col">
                  {nonResolvedPast.map((m) => (
                    <MissionCard
                      key={m.mission_id}
                      mission={m}
                      onClick={() => goToMission(m.mission_id)}
                      variant="past"
                    />
                  ))}
                </div>

                {resolvedPast.length > 0 && (
                  <div className={nonResolvedPast.length > 0 ? "mt-3" : ""}>
                    <button
                      onClick={() => setShowResolved((v) => !v)}
                      className="w-full font-mono text-[11px] text-fg-dim hover:text-fg-muted flex items-center gap-1.5 py-2 cursor-pointer transition-colors"
                    >
                      {showResolved ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      <span>
                        resolved ({resolvedPast.length})
                        {showResolved ? "" : " — click to expand"}
                      </span>
                    </button>
                    {showResolved && (
                      <div className="flex flex-col opacity-75">
                        {resolvedPast.map((m) => (
                          <MissionCard
                            key={m.mission_id}
                            mission={m}
                            onClick={() => goToMission(m.mission_id)}
                            variant="past"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  countLabel,
}: {
  label: string;
  count: number;
  countLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim">
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
      <span className="font-mono text-[11px] text-fg-dim">
        {count} {countLabel}
      </span>
    </div>
  );
}
