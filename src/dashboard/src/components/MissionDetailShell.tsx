/**
 * MissionDetailShell — the per-mission container that hosts five sub-tabs:
 *
 *   overview | spec | design | kanban | timeline
 *
 * The shell owns:
 *   - Mission hero (id, name, phase/mode pills, progress, DoD, path sticker)
 *   - The sub-tab bar
 *   - Loading / error shell state
 *   - The fetched MissionDetail payload (overview/spec/design share it;
 *     kanban and timeline fetch their own data)
 *
 * The parent (App.tsx) controls the active tab via the NavState.missionTab
 * field and receives `onChangeTab` calls. This keeps the browser back/forward
 * stack in sync with tab transitions.
 */

import { useCallback, useEffect, useState } from "react";
import * as geas from "../lib/geasClient";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";
import type { MissionDetail, MissionSummary } from "../types";
import PathBadge from "./PathBadge";
import PhaseBadge from "./PhaseBadge";
import Pill from "./Pill";
import { lookupColor, phaseColors } from "../colors";
import KanbanBoard from "./KanbanBoard";
import TimelineView from "./TimelineView";
import MissionOverviewTab from "./MissionOverviewTab";
import MissionSpecTab from "./MissionSpecTab";
import MissionDesignTab from "./MissionDesignTab";
import type { MissionTab } from "../hooks/useNavigationHistory";

interface MissionDetailShellProps {
  projectPath: string;
  projectName: string;
  missionId: string;
  activeTab: MissionTab;
  onChangeTab: (tab: MissionTab) => void;
  onBack: () => void;
}

const TABS: { key: MissionTab; label: string }[] = [
  { key: "overview", label: "overview" },
  { key: "spec", label: "spec" },
  { key: "design", label: "design" },
  { key: "kanban", label: "kanban" },
  { key: "timeline", label: "timeline" },
];

export default function MissionDetailShell({
  projectPath,
  projectName,
  missionId,
  activeTab,
  onChangeTab,
  onBack,
}: MissionDetailShellProps) {
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [d, history] = await Promise.all([
        geas.getMissionDetail(projectPath, missionId),
        geas.getMissionHistory(projectPath).catch(() => []),
      ]);
      setDetail(d);
      setSummary(history.find((m) => m.mission_id === missionId) ?? null);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath, missionId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAll();
  }, [fetchAll]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    fetchAll();
  }, [refreshKey, fetchAll]);

  // Loading shell
  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-3 w-40 rounded bg-bg-2 animate-skeleton mb-2" />
          <div className="h-5 w-72 rounded bg-bg-2 animate-skeleton" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-[11px] text-fg-dim">loading…</span>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red text-sm mb-2">Failed to load mission</p>
            {error && (
              <p className="font-mono text-[11px] text-fg-dim">{error}</p>
            )}
            <button
              onClick={onBack}
              className="mt-3 text-[12px] text-fg-muted hover:text-fg cursor-pointer"
            >
              ← back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <MissionHero detail={detail} summary={summary} />
      <SubTabBar active={activeTab} onChange={onChangeTab} />

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "overview" && (
          <MissionOverviewTab
            projectPath={projectPath}
            missionId={missionId}
            detail={detail}
          />
        )}
        {activeTab === "spec" && (
          <MissionSpecTab missionId={missionId} detail={detail} />
        )}
        {activeTab === "design" && (
          <MissionDesignTab missionId={missionId} detail={detail} />
        )}
        {activeTab === "kanban" && (
          <KanbanBoard
            projectPath={projectPath}
            projectName={projectName}
            missionId={missionId}
            embedded
          />
        )}
        {activeTab === "timeline" && (
          <TimelineView
            projectPath={projectPath}
            missionId={missionId}
            embedded
          />
        )}
      </div>
    </div>
  );
}

/**
 * MissionHero — fixed header block above the sub-tab bar.
 *
 * Shows everything a human needs to orient themselves in the mission without
 * needing to switch tabs: id, name, phase, mode, progress bar, DoD excerpt,
 * and the on-disk path for the mission directory.
 */
function MissionHero({
  detail,
  summary,
}: {
  detail: MissionDetail;
  summary: MissionSummary | null;
}) {
  const spec = detail.spec;
  const state = detail.state;

  const passed = summary?.task_completed ?? 0;
  const total = summary?.task_total ?? 0;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const barWidth = 28;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  const phaseLabel = state?.phase ?? spec?.mode ?? null;

  return (
    <div className="px-6 pt-4 pb-3 border-b border-border bg-bg-1">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-fg-dim mb-1">
            {detail.mission_id}
          </div>
          <h1 className="text-[16px] font-semibold text-fg truncate">
            {spec?.name ?? detail.mission_id}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {phaseLabel && <PhaseBadge phase={phaseLabel} size="sm" />}
            {spec?.mode && (
              <Pill color={lookupColor(phaseColors, "specifying")}>
                mode · {spec.mode}
              </Pill>
            )}
            {spec?.user_approved === true && (
              <span className="font-mono text-[10px] text-green">
                ● approved
              </span>
            )}
            {spec?.user_approved === false && (
              <span className="font-mono text-[10px] text-amber">
                ○ awaiting approval
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="flex-shrink-0 text-right">
            <div className="font-mono text-[11px] text-fg-dim mb-1">
              {passed}/{total} passed
            </div>
            <div className="font-mono text-[12px] flex items-center gap-2">
              <span className="text-green">{bar}</span>
              <span className="text-fg-muted">{pct}%</span>
            </div>
          </div>
        )}
      </div>

      {spec?.definition_of_done && (
        <div className="mt-3 text-[12px] text-fg-muted line-clamp-2">
          <span className="font-mono text-[11px] text-fg-dim">
            definition_of_done:{" "}
          </span>
          {spec.definition_of_done}
        </div>
      )}

      <div className="mt-2">
        <PathBadge path={`.geas/missions/${detail.mission_id}/`} />
      </div>
    </div>
  );
}

function SubTabBar({
  active,
  onChange,
}: {
  active: MissionTab;
  onChange: (tab: MissionTab) => void;
}) {
  return (
    <nav className="flex items-center gap-0 px-6 border-b border-border bg-bg-0 flex-shrink-0">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={
              "font-mono text-[12px] px-3 py-2 cursor-pointer transition-colors border-b-2 -mb-px " +
              (isActive
                ? "text-fg border-green"
                : "text-fg-muted hover:text-fg border-transparent")
            }
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
