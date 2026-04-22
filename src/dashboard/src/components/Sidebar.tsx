import { useState, useEffect } from "react";
import {
  RefreshCw,
  X,
  AlertTriangle,
  AlertCircle,
  Plus,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import * as geas from "../lib/geasClient";
import type { ProjectSummary } from "../types";
import { phaseColors } from "../colors";
import PhaseBadge from "./PhaseBadge";

interface SidebarProps {
  projects: ProjectSummary[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAddProject: () => void;
  onRemoveProject: (path: string) => void;
  onRefresh: () => void;
  loading: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function StatusIcon({ status }: { status: ProjectSummary["status"] }) {
  if (status === "no_geas") {
    return (
      <span className="text-amber" title="No .geas/ directory">
        <AlertTriangle size={12} />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-red" title="Error reading project">
        <AlertCircle size={12} />
      </span>
    );
  }
  return null;
}

/**
 * Sidebar — project navigator.
 *
 * Console-style: monospace section headers, phosphor-green left bar on the
 * selected project, path rendered underneath the name so the user always sees
 * where the data is coming from. Collapsed mode shrinks to a 48-px strip with
 * just an initial + phase dot.
 *
 * Mission history used to be accessed via a `History` button here; that button
 * was removed because the Dashboard view now absorbs history inline (active +
 * past missions in one list).
 */
export default function Sidebar({
  projects,
  selectedPath,
  onSelect,
  onAddProject,
  onRemoveProject,
  onRefresh,
  loading,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(
    () => window.innerWidth < 1024,
  );

  // Sync with window resize for initial default
  useEffect(() => {
    function handleResize() {
      if (controlledCollapsed === undefined) {
        setInternalCollapsed(window.innerWidth < 1024);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [controlledCollapsed]);

  const collapsed = controlledCollapsed ?? internalCollapsed;
  const toggleCollapse =
    onToggleCollapse ?? (() => setInternalCollapsed((prev) => !prev));

  function handleRemove(e: React.MouseEvent, path: string, name: string) {
    e.stopPropagation();
    if (window.confirm(`Remove "${name}" from the dashboard?`)) {
      geas
        .removeProject(path)
        .then(() => onRemoveProject(path))
        .catch((err) => console.error("Failed to remove project:", err));
    }
  }

  return (
    <aside
      className={`h-screen flex flex-col bg-bg-1 border-r border-border transition-all duration-200 ${
        collapsed ? "w-12 min-w-12" : "w-60 min-w-60"
      }`}
    >
      {/* Section header */}
      <div
        className={`flex items-center justify-between py-2 border-b border-border ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        {!collapsed && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim">
            projects
          </span>
        )}
        <div className={`flex items-center gap-1 ${collapsed ? "mx-auto" : ""}`}>
          {!collapsed && (
            <button
              onClick={onAddProject}
              className="text-fg-dim hover:text-fg transition-colors cursor-pointer p-0.5"
              title="Add project"
            >
              <Plus size={13} />
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`text-fg-dim hover:text-fg transition-colors cursor-pointer p-0.5 ${
              loading ? "animate-spin" : ""
            }`}
            title="Refresh all"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-1">
        {loading && projects.length === 0 ? (
          /* Loading skeletons */
          <div className="flex flex-col gap-1 px-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex items-center gap-2 py-2 ${
                  collapsed ? "px-1 justify-center" : "px-2"
                }`}
              >
                {collapsed ? (
                  <div className="h-5 w-5 rounded-[3px] bg-bg-2 animate-skeleton" />
                ) : (
                  <>
                    <div className="h-2.5 w-24 rounded bg-bg-2 animate-skeleton" />
                    <div className="flex-1" />
                    <div className="h-3 w-10 rounded bg-bg-2 animate-skeleton" />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.path}
              onClick={() => onSelect(project.path)}
              title={collapsed ? project.name : undefined}
              className={`w-full text-left flex items-start transition-colors cursor-pointer group ${
                collapsed ? "px-1 py-2 justify-center" : "px-3 py-2 gap-2"
              } ${
                selectedPath === project.path
                  ? "bg-bg-2 text-fg border-l-2 border-green"
                  : "text-fg-muted hover:bg-bg-2/60 hover:text-fg border-l-2 border-transparent"
              }`}
            >
              {collapsed ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-[3px] bg-bg-2">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                  {project.phase && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: dotColor(project.phase) }}
                      title={project.phase}
                    />
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-shrink-0 pt-0.5">
                    <StatusIcon status={project.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] truncate flex-1">
                        {project.name}
                      </span>
                      <PhaseBadge phase={project.phase} size="sm" />
                    </div>
                    <div className="font-mono text-[10px] text-fg-dim truncate mt-0.5">
                      {project.path}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemove(e, project.path, project.name)}
                    className="text-fg-dim hover:text-red opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0 p-0.5"
                    aria-label={`Remove ${project.name}`}
                    title="Remove project"
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </button>
          ))
        )}
      </nav>

      {/* Collapse toggle */}
      <div
        className={`py-1.5 border-t border-border ${
          collapsed ? "px-1" : "px-2"
        }`}
      >
        <button
          onClick={toggleCollapse}
          className={`w-full py-1 text-fg-dim hover:text-fg transition-colors cursor-pointer flex items-center ${
            collapsed ? "justify-center" : "justify-end px-1"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </div>
    </aside>
  );
}

/** Map phase to a dot color for the collapsed view. */
function dotColor(phase: string): string {
  const entry = phaseColors[phase.toLowerCase()];
  if (!entry) return "var(--color-fg-dim)";
  return entry.text;
}
