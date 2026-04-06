import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Archive } from "lucide-react";
import type { MissionSummary } from "../types";
import PhaseBadge from "./PhaseBadge";

interface MissionHistoryProps {
  projectPath: string;
  projectName: string;
  onSelectMission: (missionId: string) => void;
  onBack: () => void;
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MissionHistory({
  projectPath,
  projectName,
  onSelectMission,
  onBack,
}: MissionHistoryProps) {
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<MissionSummary[]>("get_mission_history", {
          path: projectPath,
        });
        if (!cancelled) {
          setMissions(result);
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

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary text-sm cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} className="inline" /> Back
        </button>
        <h1 className="text-base md:text-lg font-semibold text-text-primary truncate">
          {projectName} — Mission History
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-bg-surface rounded-lg p-5 border border-border-default"
              >
                <div className="h-5 w-48 rounded bg-bg-elevated animate-skeleton mb-3" />
                <div className="h-3 w-32 rounded bg-bg-elevated animate-skeleton mb-2" />
                <div className="h-3 w-24 rounded bg-bg-elevated animate-skeleton" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load mission history
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : missions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <Archive size={40} />
            </div>
            <span className="text-text-muted text-sm">No missions yet</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  onClick={() => onSelectMission(mission.mission_id)}
                  className={`text-left bg-bg-surface rounded-lg p-5 border transition-all duration-200 cursor-pointer hover:-translate-y-px hover:shadow-md active:scale-95 ${
                    mission.is_active
                      ? "border-l-2 border-accent border-t-border-default border-r-border-default border-b-border-default"
                      : "border-border-default"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary truncate">
                        {mission.mission_name ?? mission.mission_id}
                      </h3>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {mission.mission_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mission.is_active && (
                        <span className="text-[10px] font-medium text-accent bg-accent/15 rounded-full px-1.5 py-0.5">
                          Active
                        </span>
                      )}
                      <PhaseBadge phase={mission.phase} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-secondary">
                        {mission.task_completed}/{mission.task_total} completed
                      </span>
                      {mission.task_total > 0 && (
                        <div className="w-20 h-1 rounded-full bg-bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full bg-status-green transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {formatDate(mission.created_at)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
