/**
 * TopBar — thin chrome above the main content area.
 *
 * Three zones (left / center / right):
 *   - Left:   logo + direction label. Always visible.
 *   - Center: breadcrumb reflecting the current navigation position
 *             (project › mission › sub-tab). Crumbs are clickable for jump-back.
 *   - Right:  current mission's phase pill (when applicable).
 *
 * Intentionally honest: no fake shell paths, no ⌘K. What you see reflects
 * real state that the rest of the app already holds.
 */

import { ChevronRight } from "lucide-react";
import PhaseBadge from "./PhaseBadge";

export interface BreadcrumbCrumb {
  /** Display label. */
  label: string;
  /** Optional click handler — when omitted, the crumb is non-interactive. */
  onClick?: () => void;
  /** When true, render in monospace (ids, paths). */
  mono?: boolean;
}

interface TopBarProps {
  crumbs: BreadcrumbCrumb[];
  phase?: string | null;
}

export default function TopBar({ crumbs, phase }: TopBarProps) {
  return (
    <header className="h-10 flex items-center px-3 gap-3 bg-bg-1 border-b border-border flex-shrink-0">
      {/* Logo + direction */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-[13px] text-green font-semibold">
          ▲ geas
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim">
          direction · console
        </span>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {crumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight
                size={12}
                className="text-fg-dim flex-shrink-0"
                strokeWidth={1.5}
              />
            )}
            {crumb.onClick ? (
              <button
                onClick={crumb.onClick}
                className={
                  "truncate text-fg-muted hover:text-fg transition-colors cursor-pointer " +
                  (crumb.mono ? "font-mono text-[12px]" : "text-[13px]")
                }
              >
                {crumb.label}
              </button>
            ) : (
              <span
                className={
                  "truncate text-fg " +
                  (crumb.mono ? "font-mono text-[12px]" : "text-[13px]")
                }
              >
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Phase pill */}
      {phase && (
        <div className="flex-shrink-0">
          <PhaseBadge phase={phase} size="sm" />
        </div>
      )}
    </header>
  );
}
