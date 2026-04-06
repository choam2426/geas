const severityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  normal: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  high: { bg: "rgba(248,81,73,0.15)", text: "#f85149" },
  critical: { bg: "rgba(248,81,73,0.25)", text: "#f85149" },
};

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
