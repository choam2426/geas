const phaseColors: Record<string, { bg: string; text: string }> = {
  specifying: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  building: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  polishing: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  evolving: { bg: "rgba(188,140,255,0.15)", text: "#bc8cff" },
  complete: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};

interface PhaseBadgeProps {
  phase: string | null;
  size?: "sm" | "md";
}

export default function PhaseBadge({ phase, size = "md" }: PhaseBadgeProps) {
  if (!phase) return null;

  const colors = phaseColors[phase.toLowerCase()] ?? {
    bg: "rgba(139,148,158,0.15)",
    text: "#8b949e",
  };

  const sizeClasses =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium capitalize ${sizeClasses}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {phase}
    </span>
  );
}
