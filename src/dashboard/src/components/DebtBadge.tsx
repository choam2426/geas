import { severityColors } from "../colors";

interface DebtBadgeProps {
  severity: string;
  count: number;
}

export default function DebtBadge({ severity, count }: DebtBadgeProps) {
  if (count === 0) return null;

  const colors = severityColors[severity] ?? severityColors.low;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        severity === "critical" ? "font-bold" : ""
      }`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {count} {severity}
    </span>
  );
}
