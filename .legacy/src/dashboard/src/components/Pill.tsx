/**
 * Pill — single-line accent label with a subtle translucent background.
 *
 * Used for status / phase / mode / risk badges across the app. Pairs with
 * `colors.ts` token maps — pass the `TokenPair` (or let the caller destructure
 * `bg` + `text`). The component doesn't know about domains; keeping it dumb
 * means the same Pill renders mission phase, task status, or a raw string.
 */

import React from "react";

interface PillProps {
  /** Color tokens from `colors.ts` (usually via `lookupColor`). */
  color: { bg: string; text: string };
  /** Optional monospace rendering for IDs and enum-like values. Defaults to true. */
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function Pill({ color, mono = true, className = "", children }: PillProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-1.5 py-[2px] rounded-[3px] text-[11px] " +
        (mono ? "font-mono " : "") +
        className
      }
      style={{ background: color.bg, color: color.text }}
    >
      {children}
    </span>
  );
}
