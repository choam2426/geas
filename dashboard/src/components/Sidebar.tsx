import { invoke } from "@tauri-apps/api/core";
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
      <span className="text-status-amber text-xs" title="No .geas/ directory">
        !
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-status-red text-xs" title="Error reading project">
        X
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
          {loading ? "..." : "\u21BB"}
        </button>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-1">
        {projects.map((project) => (
          <button
            key={project.path}
            onClick={() => onSelect(project.path)}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-all duration-150 cursor-pointer group ${
              selectedPath === project.path
                ? "bg-bg-elevated text-text-primary"
                : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary"
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
              &#x2715;
            </button>
          </button>
        ))}
      </nav>

      {/* Add button */}
      <div className="px-3 py-3 border-t border-border-default">
        <button
          onClick={onAddProject}
          className="w-full px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all duration-150 cursor-pointer text-left"
        >
          + Add Project
        </button>
      </div>
    </aside>
  );
}
