interface ProgressBarProps {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-secondary">Task Progress</span>
        <span className="text-xs text-text-secondary">
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-status-green transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
