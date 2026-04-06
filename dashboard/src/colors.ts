export const severityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  normal: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  high: { bg: "rgba(248,81,73,0.15)", text: "#f85149" },
  critical: { bg: "rgba(248,81,73,0.25)", text: "#f85149" },
};

export const riskColors: Record<string, { bg: string; text: string }> = {
  low: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  normal: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  high: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  critical: { bg: "rgba(248,81,73,0.25)", text: "#f85149" },
};

export const phaseColors: Record<string, { bg: string; text: string }> = {
  specifying: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  building: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  polishing: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  evolving: { bg: "rgba(188,140,255,0.15)", text: "#bc8cff" },
  complete: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};

export const severityOrder = ["critical", "high", "normal", "low"] as const;
