import type { TaskRow } from "../types";
import { lookupColor, riskColors } from "../colors";
import Pill from "./Pill";

/**
 * TaskCard — compact row rendered inside a KanbanBoard column.
 *
 * Sizing is driven by the column width (flex-1) rather than hard-coded, so
 * the card grows on wide screens and clamps gracefully on narrow ones.
 * The title uses `line-clamp-2` (2 lines max) instead of a character slice
 * so we respect the actual rendered width, not an assumed fixed one.
 */

interface TaskCardProps {
  task: TaskRow;
  onClick?: () => void;
  isActive?: boolean;
}

export default function TaskCard({ task, onClick, isActive }: TaskCardProps) {
  const risk = task.risk_level
    ? lookupColor(riskColors, task.risk_level)
    : null;

  return (
    <div
      className={
        "bg-bg-2 rounded-[4px] p-2 border cursor-pointer transition-colors " +
        (isActive
          ? "border-green/50"
          : "border-transparent hover:border-border")
      }
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
      {/* Task id — mono, muted, small */}
      <div className="font-mono text-[10px] text-fg-dim mb-0.5 truncate">
        {task.task_id}
      </div>

      {/* Title — natural wrap, 2-line clamp */}
      <p
        className="text-[12px] text-fg leading-snug mb-1.5"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {task.title}
      </p>

      {/* Active indicator */}
      {isActive && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot shrink-0" />
          <span className="font-mono text-[10px] text-green truncate min-w-0">
            {task.active_agent ?? "in progress"}
          </span>
        </div>
      )}

      {/* Meta pills — wrap naturally */}
      <div className="flex items-center gap-1 flex-wrap">
        {task.primary_worker_type && (
          <span className="font-mono text-[10px] px-1 py-[1px] rounded-[3px] bg-bg-1 text-fg-muted truncate max-w-full">
            {task.primary_worker_type}
          </span>
        )}
        {task.risk_level && risk && (
          <Pill color={risk}>{task.risk_level}</Pill>
        )}
        {task.verify_fix_iterations > 0 && (
          <span className="font-mono text-[10px] px-1 py-[1px] rounded-[3px] bg-bg-1 text-fg-muted">
            iter {task.verify_fix_iterations}
          </span>
        )}
      </div>
    </div>
  );
}
