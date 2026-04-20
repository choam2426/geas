import { useState, useEffect } from "react";
import { RefreshCw, X, AlertTriangle, AlertCircle, Plus, History, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  onViewHistory?: () => void;
  loading: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function StatusIcon({ status }: { status: ProjectSummary["status"] }) {
  if (status === "no_geas") {
    return (
      <span className="text-status-amber" title="No .geas/ directory">
        <AlertTriangle size={12} />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-status-red" title="Error reading project">
        <AlertCircle size={12} />
      </span>
    );
  }
  return null;
}

export default function Sidebar({
  projects,
  selectedPath,
  onSelect,
  onAddProject,
  onRemoveProject,
  onRefresh,
  onViewHistory,
  loading,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(() => window.innerWidth < 1024);

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
  const toggleCollapse = onToggleCollapse ?? (() => setInternalCollapsed((prev) => !prev));

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
      className={`h-screen flex flex-col bg-bg-surface border-r border-border-default transition-all duration-200 ${
        collapsed ? "w-12 min-w-12" : "w-60 min-w-60"
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between py-3 border-b border-border-default ${collapsed ? "px-2" : "px-4"}`}>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            Geas
          </span>
        )}
        <div className={`flex items-center gap-1.5 ${collapsed ? "mx-auto" : ""}`}>
          {!collapsed && onViewHistory && (
            <button
              onClick={onViewHistory}
              className="text-text-muted hover:text-text-primary text-xs transition-colors duration-150 cursor-pointer"
              title="Mission history"
            >
              <History size={14} />
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`text-text-muted hover:text-text-primary text-xs transition-colors duration-150 cursor-pointer ${
              loading ? "animate-spin" : ""
            }`}
            title="Refresh all"
          >
            {loading ? "..." : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {loading && projects.length === 0 ? (
          /* Loading skeletons */
          <div className="flex flex-col gap-1 px-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex items-center gap-2 py-2.5 rounded-md ${collapsed ? "px-1 justify-center" : "px-3"}`}>
                {collapsed ? (
                  <div className="h-6 w-6 rounded bg-bg-elevated animate-skeleton" />
                ) : (
                  <>
                    <div className="h-3 w-24 rounded bg-bg-elevated animate-skeleton" />
                    <div className="flex-1" />
                    <div className="h-4 w-12 rounded-full bg-bg-elevated animate-skeleton" />
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
              className={`w-full text-left py-2.5 flex items-center transition-all duration-150 cursor-pointer group rounded-r-md ${
                collapsed ? "px-1 justify-center" : "px-3 gap-2"
              } ${
                selectedPath === project.path
                  ? "bg-bg-elevated text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary border-l-2 border-transparent"
              }`}
            >
              {collapsed ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded bg-bg-elevated">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                  {project.phase && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getPhaseColor(project.phase) }}
                      title={project.phase}
                    />
                  )}
                </div>
              ) : (
                <>
                  <StatusIcon status={project.status} />
                  <span className="flex-1 text-sm truncate">{project.name}</span>
                  <PhaseBadge phase={project.phase} size="sm" />
                  <button
                    onClick={(e) => handleRemove(e, project.path, project.name)}
                    className="text-text-muted hover:text-status-red opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-xs cursor-pointer ml-1"
                    aria-label={`Remove ${project.name}`}
                    title="Remove project"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </button>
          ))
        )}
      </nav>

      {/* Add button */}
      <div className={`py-3 border-t border-border-default ${collapsed ? "px-1" : "px-3"}`}>
        <button
          onClick={onAddProject}
          className={`w-full py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all duration-150 cursor-pointer ${
            collapsed ? "flex items-center justify-center px-0" : "px-3 text-left"
          }`}
          title={collapsed ? "Add Project" : undefined}
        >
          <Plus size={14} className={collapsed ? "" : "inline"} />
          {!collapsed && " Add Project"}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className={`py-2 border-t border-border-default ${collapsed ? "px-1" : "px-3"}`}>
        <button
          onClick={toggleCollapse}
          className={`w-full py-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all duration-150 cursor-pointer flex items-center ${
            collapsed ? "justify-center" : "justify-end px-2"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}

/** Map phase to a dot color for collapsed view */
function getPhaseColor(phase: string): string {
  return phaseColors[phase.toLowerCase()]?.text ?? "#656d76";
}
