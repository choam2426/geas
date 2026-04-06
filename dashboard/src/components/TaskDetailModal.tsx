import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import type { TaskInfo } from "../types";
import { riskColors, statusColors, taskKindColors } from "../colors";

interface TaskDetailModalProps {
  task: TaskInfo;
  onClose: () => void;
}

function Badge({
  label,
  bg,
  text,
}: {
  label: string;
  bg: string;
  text: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

export default function TaskDetailModal({
  task,
  onClose,
}: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    // Focus the close button on mount
    const closeBtn = modalRef.current?.querySelector<HTMLElement>("button");
    closeBtn?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const status = statusColors[task.status] ?? statusColors.drafted;
  const risk = task.risk_level
    ? riskColors[task.risk_level] ?? riskColors.normal
    : null;
  const kind = task.task_kind
    ? taskKindColors[task.task_kind] ?? { bg: "rgba(139,148,158,0.15)", text: "#8b949e" }
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="bg-bg-surface border border-border-default rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              {task.title}
            </h2>
            <p className="text-xs text-text-muted mt-1">{task.task_id}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors duration-150 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status badges row */}
        <div className="flex items-center gap-2 flex-wrap px-5 pt-3">
          <Badge label={task.status} bg={status.bg} text={status.text} />
          {risk && (
            <Badge
              label={`risk: ${task.risk_level}`}
              bg={risk.bg}
              text={risk.text}
            />
          )}
          {kind && (
            <Badge label={task.task_kind!} bg={kind.bg} text={kind.text} />
          )}
          {task.worker_type && (
            <Badge
              label={task.worker_type}
              bg="rgba(139,148,158,0.15)"
              text="#8b949e"
            />
          )}
        </div>

        {/* Goal */}
        {task.goal && (
          <div className="px-5 pt-4">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              Goal
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {task.goal}
            </p>
          </div>
        )}

        {/* Acceptance Criteria */}
        <div className="px-5 pt-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
            Acceptance Criteria
          </h3>
          {task.acceptance_criteria.length > 0 ? (
            <ol className="list-decimal list-inside space-y-1">
              {task.acceptance_criteria.map((criterion, i) => (
                <li
                  key={i}
                  className="text-sm text-text-secondary leading-relaxed"
                >
                  {criterion}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-muted italic">
              No acceptance criteria defined
            </p>
          )}
        </div>

        {/* Scope Surfaces */}
        <div className="px-5 pt-4 pb-5">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
            Scope Surfaces
          </h3>
          {task.scope_surfaces.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {task.scope_surfaces.map((surface, i) => (
                <span
                  key={i}
                  className="inline-flex bg-bg-elevated rounded-md px-2 py-1 text-xs text-text-secondary"
                >
                  {surface}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted italic">No scope defined</p>
          )}
        </div>
      </div>
    </div>
  );
}
