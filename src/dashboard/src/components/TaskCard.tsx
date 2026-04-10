import { CheckCircle } from "lucide-react";
import type { TaskInfo } from "../types";
import { riskColors } from "../colors";

interface TaskCardProps {
  task: TaskInfo;
  onClick?: () => void;
  isActive?: boolean;
  isCompletedInBatch?: boolean;
  agentName?: string;
  pipelineStep?: string;
}

export default function TaskCard({ task, onClick, isActive, isCompletedInBatch, agentName, pipelineStep }: TaskCardProps) {
  const title =
    task.title.length > 50 ? task.title.slice(0, 47) + "..." : task.title;

  const risk = task.risk_level
    ? riskColors[task.risk_level] ?? riskColors.normal
    : null;

  const borderClass = isActive
    ? "border-status-green/40"
    : isCompletedInBatch
    ? "border-status-green/20"
    : "border-transparent";

  return (
    <div
      className={`bg-bg-elevated rounded-lg p-2 border hover:border-border-default hover:-translate-y-px hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer ${borderClass}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <p className="text-xs text-text-primary leading-snug mb-1.5">{title}</p>
      {isActive && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot shrink-0" />
          {agentName ? (
            <span className="text-[10px] text-text-secondary truncate">{agentName}</span>
          ) : (
            <span className="text-[10px] text-text-secondary">In progress</span>
          )}
          {pipelineStep && (
            <span className="text-[10px] text-text-muted truncate">{pipelineStep}</span>
          )}
        </div>
      )}
      {isCompletedInBatch && !isActive && (
        <div className="flex items-center gap-1 mb-1.5">
          <CheckCircle size={12} className="text-status-green shrink-0" />
          <span className="text-[10px] text-status-green">Completed in batch</span>
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {task.worker_type && (
          <span className="inline-flex items-center rounded-full bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted">
            {task.worker_type}
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
      </div>
    </div>
  );
}
