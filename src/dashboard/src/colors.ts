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
  consolidating: { bg: "rgba(188,140,255,0.15)", text: "#bc8cff" },
  complete: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};

export const statusColors: Record<string, { bg: string; text: string }> = {
  drafted: { bg: "rgba(101,109,118,0.15)", text: "#656d76" },
  ready: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  implementing: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  reviewed: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  verified: { bg: "rgba(86,211,100,0.15)", text: "#56d364" },
  passed: { bg: "rgba(86,211,100,0.25)", text: "#56d364" },
  blocked: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  escalated: { bg: "rgba(248,81,73,0.15)", text: "#f85149" },
  cancelled: { bg: "rgba(101,109,118,0.15)", text: "#656d76" },
};

export const taskKindColors: Record<string, { bg: string; text: string }> = {
  implementation: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  documentation: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  configuration: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  design: { bg: "rgba(188,140,255,0.15)", text: "#bc8cff" },
  review: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  analysis: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  delivery: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};

export const debtStatusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  accepted: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  scheduled: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  resolved: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  dropped: { bg: "rgba(101,109,118,0.15)", text: "#656d76" },
  mitigated: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
};

export const memoryTypeColors: Record<string, { bg: string; text: string }> = {
  agent: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
};

export const memoryStateColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "rgba(139,148,158,0.15)", text: "#8b949e" },
  active: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
};

export const severityOrder = ["critical", "high", "normal", "low"] as const;
