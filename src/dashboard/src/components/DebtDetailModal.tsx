import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import type { DebtEntry } from "../types";
import { severityColors, debtStatusColors } from "../colors";

interface DebtDetailModalProps {
  debt: DebtEntry;
  onClose: () => void;
}

export default function DebtDetailModal({ debt, onClose }: DebtDetailModalProps) {
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

  const sevColor =
    severityColors[debt.severity ?? ""] ?? severityColors.low;
  const statColor = debt.status
    ? debtStatusColors[debt.status] ?? debtStatusColors.open
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Debt: ${debt.title}`}
        className="bg-bg-surface border border-border-default rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border-default">
          <div>
            <p className="text-xs text-text-muted mb-1">{debt.debt_id}</p>
            <h2 className="text-lg font-semibold text-text-primary">
              {debt.title ?? "(untitled)"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: sevColor.bg, color: sevColor.text }}
            >
              {debt.severity ?? "unknown"}
            </span>
            {debt.kind && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-bg-elevated text-text-secondary">
                {debt.kind}
              </span>
            )}
            {debt.status && statColor && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ backgroundColor: statColor.bg, color: statColor.text }}
              >
                {debt.status}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Description
            </h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
              {debt.description ?? "No description"}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Introduced by
            </h3>
            {debt.introduced_by ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {debt.introduced_by.mission_id && (
                  <span className="inline-flex items-center rounded-md bg-bg-elevated px-2.5 py-1 text-text-primary">
                    mission: {debt.introduced_by.mission_id}
                  </span>
                )}
                {debt.introduced_by.task_id && (
                  <span className="inline-flex items-center rounded-md bg-bg-elevated px-2.5 py-1 text-text-primary">
                    task: {debt.introduced_by.task_id}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Unknown</p>
            )}
          </div>

          {debt.resolved_by && (
            <div>
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Resolved by
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {debt.resolved_by.mission_id && (
                  <span className="inline-flex items-center rounded-md bg-bg-elevated px-2.5 py-1 text-text-primary">
                    mission: {debt.resolved_by.mission_id}
                  </span>
                )}
                {debt.resolved_by.task_id && (
                  <span className="inline-flex items-center rounded-md bg-bg-elevated px-2.5 py-1 text-text-primary">
                    task: {debt.resolved_by.task_id}
                  </span>
                )}
              </div>
              {debt.resolution_rationale && (
                <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
                  {debt.resolution_rationale}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
