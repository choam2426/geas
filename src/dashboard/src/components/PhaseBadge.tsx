import { lookupColor, phaseColors } from "../colors";
import Pill from "./Pill";

interface PhaseBadgeProps {
  phase: string | null;
  size?: "sm" | "md";
}

export default function PhaseBadge({ phase, size = "md" }: PhaseBadgeProps) {
  if (!phase) return null;
  const colors = lookupColor(phaseColors, phase.toLowerCase());
  return (
    <Pill
      color={colors}
      className={size === "sm" ? "text-[10px]" : ""}
    >
      {phase}
    </Pill>
  );
}
