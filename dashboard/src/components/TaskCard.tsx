import type { TaskInfo } from "../types";
import { riskColors } from "../colors";

interface TaskCardProps {
  task: TaskInfo;
}

export default function TaskCard({ task }: TaskCardProps) {
  const title =
    task.title.length > 80 ? task.title.slice(0, 77) + "..." : task.title;

  const risk = task.risk_level
    ? riskColors[task.risk_level] ?? riskColors.normal
    : null;

  return (
    <div className="bg-bg-elevated rounded-lg p-3 border border-transparent hover:border-border-default hover:-translate-y-px hover:shadow-md transition-all duration-150 cursor-default">
      <p className="text-sm text-text-primary leading-snug mb-2">{title}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.worker_type && (
          <span className="inline-flex items-center rounded-full bg-bg-surface px-2 py-0.5 text-[11px] text-text-muted">
            {task.worker_type}
          </span>
        )}
        {task.risk_level && risk && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: risk.bg, color: risk.text }}
          >
            {task.risk_level}
          </span>
        )}
      </div>
    </div>
  );
}
