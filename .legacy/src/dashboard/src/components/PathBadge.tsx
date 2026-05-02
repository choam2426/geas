/**
 * PathBadge — small monospace label that surfaces the filesystem location
 * of the data a panel is rendering.
 *
 * The console direction treats `.geas/` as first-class: every panel advertises
 * the artifact it is showing (`mission-spec.json`, `tasks/{id}/self-check.json`,
 * etc.) so the UI reads like a live filesystem inspector.
 *
 * Click-to-copy is included because the badges are also useful when a user
 * wants to open a file directly from their editor.
 */

import { useState } from "react";

interface PathBadgeProps {
  path: string;
  /** When true, render as a single-line row (default). When false, inline. */
  block?: boolean;
  /** Optional label rendered before the path (e.g. "source"). */
  label?: string;
}

export default function PathBadge({ path, block = false, label }: PathBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable in certain Tauri permission configurations.
      // Silent failure is acceptable — the path is still visible on screen.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        "group inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-dim hover:text-fg-muted transition-colors cursor-pointer " +
        (block ? "block w-full text-left" : "")
      }
      title="click to copy"
    >
      {label && <span className="text-fg-dim">{label}:</span>}
      <span className="truncate">{path}</span>
      <span
        className={
          "text-[10px] uppercase tracking-wider transition-opacity " +
          (copied ? "text-green opacity-100" : "opacity-0 group-hover:opacity-60")
        }
      >
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
