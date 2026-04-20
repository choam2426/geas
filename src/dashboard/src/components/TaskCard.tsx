import type { TaskRow } from "../types";
import { riskColors } from "../colors";

interface TaskCardProps {
  task: TaskRow;
  onClick?: () => void;
  isActive?: boolean;
}

export default function TaskCard({ task, onClick, isActive }: TaskCardProps) {
  const title =
    task.title.length > 50 ? task.title.slice(0, 47) + "..." : task.title;

  const risk = task.risk_level
    ? riskColors[task.risk_level] ?? riskColors.normal
    : null;

  const borderClass = isActive
    ? "border-status-green/40"
    : "border-transparent";

  return (
    <div
      className={`bg-bg-elevated rounded-lg p-2 border hover:border-border-default hover:-translate-y-px hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer ${borderClass}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <p className="text-xs text-text-primary leading-snug mb-1.5">{title}</p>
      {isActive && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot shrink-0" />
          {task.active_agent ? (
            <span className="text-[10px] text-text-secondary truncate">
              {task.active_agent}
            </span>
          ) : (
            <span className="text-[10px] text-text-secondary">In progress</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {task.primary_worker_type && (
          <span className="inline-flex items-center rounded-full bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted">
            {task.primary_worker_type}
          </span>
        )}
        {task.risk_level && risk && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: risk.bg, color: risk.text }}
          >
            {task.risk_level}
          </span>
        )}
        {task.verify_fix_iterations > 0 && (
          <span className="inline-flex items-center rounded-full bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted">
            iter {task.verify_fix_iterations}
          </span>
        )}
      </div>
    </div>
  );
}
