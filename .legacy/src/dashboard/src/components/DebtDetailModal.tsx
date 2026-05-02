/**
 * DebtDetailModal — full view of a single DebtEntry.
 *
 * Restyled to match the console direction: monospace ids, phosphor section
 * headers, compact pills, path sticker for the debt ledger file.
 */

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DebtEntry } from "../types";
import {
  debtStatusColors,
  lookupColor,
  severityColors,
} from "../colors";
import Pill from "./Pill";
import PathBadge from "./PathBadge";

interface DebtDetailModalProps {
  debt: DebtEntry;
  onClose: () => void;
}

export default function DebtDetailModal({
  debt,
  onClose,
}: DebtDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const closeBtn = dialogRef.current?.querySelector<HTMLElement>("button");
    closeBtn?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Debt: ${debt.title}`}
        className="bg-bg-1 border border-border rounded-[4px] w-full max-w-xl max-h-[82vh] overflow-y-auto shadow-2xl animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border sticky top-0 bg-bg-1 z-10">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] text-fg-dim mb-1">
              {debt.debt_id}
            </div>
            <h2 className="text-[15px] font-semibold text-fg">
              {debt.title ?? "(untitled)"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill color={lookupColor(severityColors, debt.severity)}>
                {debt.severity ?? "—"}
              </Pill>
              {debt.kind && (
                <span className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg-muted">
                  {debt.kind.replace(/_/g, " ")}
                </span>
              )}
              {debt.status && (
                <Pill color={lookupColor(debtStatusColors, debt.status)}>
                  {debt.status}
                </Pill>
              )}
            </div>
            <div className="mt-2">
              <PathBadge path=".geas/debt.json" />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-fg-dim hover:text-fg transition-colors cursor-pointer p-1"
            aria-label="Close"
            title="ESC to close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Section title="description">
            <p className="text-[13px] text-fg whitespace-pre-wrap break-words">
              {debt.description ?? (
                <span className="text-fg-dim italic">no description</span>
              )}
            </p>
          </Section>

          <Section title="introduced_by">
            {debt.introduced_by ? (
              <RefBlock
                mission={debt.introduced_by.mission_id}
                task={debt.introduced_by.task_id}
              />
            ) : (
              <p className="font-mono text-[11px] text-fg-dim">unknown</p>
            )}
          </Section>

          {debt.resolved_by && (
            <Section title="resolved_by">
              <RefBlock
                mission={debt.resolved_by.mission_id}
                task={debt.resolved_by.task_id}
              />
              {debt.resolution_rationale && (
                <p className="text-[12px] text-fg-muted mt-2 whitespace-pre-wrap">
                  {debt.resolution_rationale}
                </p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border-muted">
        <span className="font-mono text-[11px] text-green">{title}</span>
      </div>
      <div className="pl-1">{children}</div>
    </section>
  );
}

function RefBlock({
  mission,
  task,
}: {
  mission: string | null;
  task: string | null;
}) {
  if (!mission && !task) {
    return <p className="font-mono text-[11px] text-fg-dim">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
      {mission && (
        <span className="px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg">
          mission · {mission}
        </span>
      )}
      {task && (
        <span className="px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg">
          task · {task}
        </span>
      )}
    </div>
  );
}
