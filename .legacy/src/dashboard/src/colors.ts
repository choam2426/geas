/**
 * Color tokens used by pills, badges, and other accent-driven UI.
 *
 * Each entry references CSS variables defined in `index.css`. That indirection
 * keeps the Tailwind theme as the single source of truth — if the palette is
 * retuned we update one file, and everything that uses these maps stays in
 * sync. Callers use the `bg` and `text` values directly in inline styles:
 *
 *   <span style={{ background: riskColors.high.bg, color: riskColors.high.text }}>
 *
 * Accent families (all chroma ≈ 0.17 for visual parity):
 *   - green  → active / passing / running
 *   - amber  → reviewing / open debt / warning
 *   - red    → blocked / escalated / critical / failure
 *   - cyan   → info / memory / links
 *   - violet → consolidating / deliberation
 *   - muted  → drafted / cancelled / neutral
 */

type TokenPair = { bg: string; text: string };

const GREEN: TokenPair = { bg: "var(--color-green-surface)", text: "var(--color-green)" };
const AMBER: TokenPair = { bg: "var(--color-amber-surface)", text: "var(--color-amber)" };
const RED: TokenPair = { bg: "var(--color-red-surface)", text: "var(--color-red)" };
const CYAN: TokenPair = { bg: "var(--color-cyan-surface)", text: "var(--color-cyan)" };
const VIOLET: TokenPair = { bg: "var(--color-violet-surface)", text: "var(--color-violet)" };
const MUTED: TokenPair = { bg: "var(--color-muted-surface)", text: "var(--color-fg-muted)" };

export const severityColors: Record<string, TokenPair> = {
  low: MUTED,
  normal: AMBER,
  high: RED,
  critical: RED,
};

export const riskColors: Record<string, TokenPair> = {
  low: MUTED,
  normal: CYAN,
  high: AMBER,
  critical: RED,
};

export const phaseColors: Record<string, TokenPair> = {
  specifying: CYAN,
  building: GREEN,
  polishing: AMBER,
  consolidating: VIOLET,
  consolidated: VIOLET,
  complete: GREEN,
};

export const statusColors: Record<string, TokenPair> = {
  drafted: MUTED,
  ready: CYAN,
  implementing: GREEN,
  reviewing: AMBER,
  deciding: GREEN,
  passed: GREEN,
  blocked: AMBER,
  escalated: RED,
  cancelled: MUTED,
};

export const taskKindColors: Record<string, TokenPair> = {
  implementation: GREEN,
  documentation: MUTED,
  configuration: AMBER,
  design: VIOLET,
  review: CYAN,
  analysis: CYAN,
  delivery: GREEN,
};

export const debtStatusColors: Record<string, TokenPair> = {
  open: AMBER,
  accepted: CYAN,
  scheduled: CYAN,
  resolved: GREEN,
  dropped: MUTED,
  mitigated: MUTED,
};

export const memoryTypeColors: Record<string, TokenPair> = {
  agent: CYAN,
};

export const memoryStateColors: Record<string, TokenPair> = {
  draft: MUTED,
  active: GREEN,
};

export const severityOrder = ["critical", "high", "normal", "low"] as const;

/**
 * Resolve a token pair for an unknown status string, falling back to muted.
 * Components that render free-form status values should use this so unknown
 * values still render without a crash.
 */
export function lookupColor(
  map: Record<string, TokenPair>,
  key: string | null | undefined,
): TokenPair {
  if (!key) return MUTED;
  return map[key] ?? MUTED;
}
