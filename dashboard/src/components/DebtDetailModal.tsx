import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DebtItem } from "../types";
import { severityColors } from "../colors";

interface DebtDetailModalProps {
  debt: DebtItem;
  onClose: () => void;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  open: { bg: "rgba(248,81,73,0.15)", text: "#f85149" },
  accepted: { bg: "rgba(210,153,34,0.15)", text: "#d29922" },
  scheduled: { bg: "rgba(88,166,255,0.15)", text: "#58a6ff" },
  resolved: { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  dropped: { bg: "rgba(101,109,118,0.15)", text: "#656d76" },
};

export default function DebtDetailModal({ debt, onClose }: DebtDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sevColor = severityColors[debt.severity] ?? severityColors.low;
  const statColor = debt.status ? (statusStyles[debt.status] ?? statusStyles.open) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Debt: ${debt.title}`}
        className="bg-bg-surface border border-border-default rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border-default">
          <div>
            <p className="text-xs text-text-muted mb-1">{debt.debt_id}</p>
            <h2 className="text-lg font-semibold text-text-primary">{debt.title}</h2>
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
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: sevColor.bg, color: sevColor.text }}
            >
              {debt.severity}
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

          {/* Description */}
          <div>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Description</h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">
              {debt.description || "No description provided"}
            </p>
          </div>

          {/* Introduced by */}
          <div>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Introduced by</h3>
            {debt.introduced_by_task_id ? (
              <span className="inline-flex items-center rounded-md bg-bg-elevated px-2.5 py-1 text-xs text-text-primary">
                {debt.introduced_by_task_id}
              </span>
            ) : (
              <p className="text-sm text-text-muted">Unknown</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
