import type { ProjectSummary } from "../types";
import PhaseBadge from "./PhaseBadge";
import ProgressBar from "./ProgressBar";
import DebtBadge from "./DebtBadge";

interface ProjectOverviewProps {
  project: ProjectSummary;
  onViewTasks?: () => void;
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

export default function ProjectOverview({ project, onViewTasks }: ProjectOverviewProps) {
  const severities = ["critical", "high", "normal", "low"] as const;
  const hasDebt = project.debt_total > 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl">
        {/* Mission heading */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-text-primary">
              {project.mission_name ?? project.name}
            </h1>
            <PhaseBadge phase={project.phase} />
          </div>
          <p className="text-sm text-text-muted">{project.path}</p>
        </div>

        {/* Task progress card */}
        <div className="bg-bg-surface rounded-lg p-5 mb-4 hover:-translate-y-px hover:shadow-md transition-all duration-150">
          <ProgressBar
            completed={project.task_completed}
            total={project.task_total}
          />
        </div>

        {/* View Tasks button */}
        {onViewTasks && (
          <div className="mb-4">
            <button
              onClick={onViewTasks}
              className="px-4 py-1.5 rounded-md bg-accent text-white text-sm cursor-pointer hover:opacity-90 transition-opacity"
            >
              View Tasks
            </button>
          </div>
        )}

        {/* Debt summary card */}
        <div className="bg-bg-surface rounded-lg p-5 mb-4 hover:-translate-y-px hover:shadow-md transition-all duration-150">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-secondary">Tech Debt</span>
            <span className="text-xs text-text-muted">
              {project.debt_total} total
            </span>
          </div>
          {hasDebt ? (
            <div className="flex flex-wrap gap-2">
              {severities.map((sev) => (
                <DebtBadge
                  key={sev}
                  severity={sev}
                  count={project.debt_by_severity[sev]}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No debt recorded</p>
          )}
        </div>

        {/* Last activity */}
        <div className="bg-bg-surface rounded-lg p-5 hover:-translate-y-px hover:shadow-md transition-all duration-150">
          <span className="text-xs text-text-secondary">Last Activity</span>
          <p className="text-sm text-text-primary mt-1">
            {formatActivity(project.last_activity)}
          </p>
        </div>
      </div>
    </div>
  );
}
