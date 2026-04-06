import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, X, AlertTriangle, AlertCircle, Plus } from "lucide-react";
import type { ProjectSummary } from "../types";
import PhaseBadge from "./PhaseBadge";

interface SidebarProps {
  projects: ProjectSummary[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onAddProject: () => void;
  onRemoveProject: (path: string) => void;
  onRefresh: () => void;
  loading: boolean;
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
  loading,
}: SidebarProps) {
  function handleRemove(e: React.MouseEvent, path: string, name: string) {
    e.stopPropagation();
    if (window.confirm(`Remove "${name}" from the dashboard?`)) {
      invoke("remove_project", { path })
        .then(() => onRemoveProject(path))
        .catch((err) => console.error("Failed to remove project:", err));
    }
  }

  return (
    <aside className="w-60 min-w-60 h-screen flex flex-col bg-bg-surface border-r border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-sm font-semibold text-text-primary tracking-tight">
          Geas
        </span>
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

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {loading && projects.length === 0 ? (
          /* Loading skeletons */
          <div className="flex flex-col gap-1 px-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-md">
                <div className="h-3 w-24 rounded bg-bg-elevated animate-skeleton" />
                <div className="flex-1" />
                <div className="h-4 w-12 rounded-full bg-bg-elevated animate-skeleton" />
              </div>
            ))}
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.path}
              onClick={() => onSelect(project.path)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all duration-150 cursor-pointer group rounded-r-md ${
                selectedPath === project.path
                  ? "bg-bg-elevated text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary border-l-2 border-transparent"
              }`}
            >
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
            </button>
          ))
        )}
      </nav>

      {/* Add button */}
      <div className="px-3 py-3 border-t border-border-default">
        <button
          onClick={onAddProject}
          className="w-full px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all duration-150 cursor-pointer text-left"
        >
          <Plus size={14} className="inline" /> Add Project
        </button>
      </div>
    </aside>
  );
}
