/**
 * StatusBar — 24-px chrome at the bottom of the window.
 *
 * Only shows information the app can honestly produce:
 *   - left: "watching .geas/" + timestamp of the last file-watcher event,
 *     which is a real Tauri event we already subscribe to in App.tsx
 *   - right: counts pulled from ProjectSummary (missions / debt / memory)
 *
 * No keyboard shortcut hints, no fake agent heartbeat, no ⌘K.
 * If the project has never emitted an event, the left side says "idle" and
 * sits silent — honest to the actual state.
 */

import type { ProjectSummary } from "../types";

interface StatusBarProps {
  /** Currently selected project, if any. */
  project: ProjectSummary | null;
  /** Timestamp of the most recent `geas://project-changed` event. */
  lastEventAt: Date | null;
  /** Memory entry count for the current project, if known. null = not loaded. */
  memoryCount: number | null;
}

function formatLocalTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function StatusBar({
  project,
  lastEventAt,
  memoryCount,
}: StatusBarProps) {
  return (
    <footer className="h-6 flex items-center px-3 gap-3 bg-bg-1 border-t border-border flex-shrink-0 font-mono text-[10px] text-fg-dim">
      {/* Left: watch status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {project ? (
          <>
            <span className="text-green">●</span>
            <span>watching</span>
            <span className="text-fg-muted truncate">{project.path}/.geas</span>
            {lastEventAt && (
              <>
                <span>·</span>
                <span>last event {formatLocalTime(lastEventAt)}</span>
              </>
            )}
          </>
        ) : (
          <span>idle</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Right: project stats */}
      {project && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {project.task_total > 0 && (
            <span>
              tasks {project.task_completed}/{project.task_total}
            </span>
          )}
          {project.debt_total > 0 && (
            <span>
              debt{" "}
              <span className="text-amber">{project.debt_total}</span>
            </span>
          )}
          {memoryCount !== null && memoryCount > 0 && (
            <span>memory {memoryCount}</span>
          )}
        </div>
      )}
    </footer>
  );
}
