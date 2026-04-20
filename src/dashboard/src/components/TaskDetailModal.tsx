import { useEffect, useRef, useCallback, useState } from "react";
import { X, FileText, ShieldCheck, AlertTriangle, Target } from "lucide-react";
import * as geas from "../lib/geasClient";
import type {
  EvidenceFile,
  EvidenceFileMeta,
  TaskDetail,
  TaskRow,
} from "../types";
import { riskColors, statusColors } from "../colors";

interface TaskDetailModalProps {
  task: TaskRow;
  projectPath: string;
  missionId: string;
  onClose: () => void;
}

function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="text-sm text-text-secondary">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-text-muted text-sm">None</p>;
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-text-secondary">
          {item}
        </li>
      ))}
    </ul>
  );
}

function verdictColor(verdict?: string | null): string {
  switch (verdict) {
    case "pass":
    case "approved":
      return "text-status-green";
    case "fail":
    case "changes_requested":
      return "text-status-amber";
    case "block":
    case "blocked":
    case "escalated":
      return "text-status-red";
    case "cancelled":
      return "text-text-muted";
    default:
      return "text-text-secondary";
  }
}

export default function TaskDetailModal({
  task,
  projectPath,
  missionId,
  onClose,
}: TaskDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [evidenceSelected, setEvidenceSelected] =
    useState<EvidenceFileMeta | null>(null);
  const [evidenceContent, setEvidenceContent] = useState<EvidenceFile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await geas.getTaskDetail(
          projectPath,
          missionId,
          task.task_id,
        );
        if (!cancelled) setDetail(result);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath, missionId, task.task_id]);

  useEffect(() => {
    if (!evidenceSelected) {
      setEvidenceContent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const content = await geas.readEvidenceFile(
          projectPath,
          missionId,
          task.task_id,
          evidenceSelected.filename,
        );
        if (!cancelled) setEvidenceContent(content);
      } catch {
        if (!cancelled) setEvidenceContent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceSelected, projectPath, missionId, task.task_id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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

  const risk = task.risk_level
    ? riskColors[task.risk_level] ?? riskColors.normal
    : null;
  const statusColor = statusColors[task.status] ?? statusColors.drafted;

  const gateResults = detail?.gate_results;
  const latestGateRun =
    gateResults && gateResults.runs.length > 0
      ? gateResults.runs[gateResults.runs.length - 1]
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
        aria-label={`Task: ${task.title}`}
        className="bg-bg-surface border border-border-default rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border-default sticky top-0 bg-bg-surface z-10">
          <div className="min-w-0">
            <p className="text-xs text-text-muted mb-1">{task.task_id}</p>
            <h2 className="text-lg font-semibold text-text-primary">
              {task.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
              >
                {task.status}
              </span>
              {task.risk_level && risk && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: risk.bg, color: risk.text }}
                >
                  risk: {task.risk_level}
                </span>
              )}
              {task.primary_worker_type && (
                <span className="inline-flex items-center rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-secondary">
                  {task.primary_worker_type}
                </span>
              )}
              {task.active_agent && (
                <span className="inline-flex items-center rounded-full bg-status-green/15 text-status-green px-2.5 py-0.5 text-xs">
                  active: {task.active_agent}
                </span>
              )}
              {task.verify_fix_iterations > 0 && (
                <span className="inline-flex items-center rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-secondary">
                  iter: {task.verify_fix_iterations}
                </span>
              )}
            </div>
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
          {task.goal && (
            <Section title="Goal" icon={<Target size={12} />}>
              <p className="whitespace-pre-wrap">{task.goal}</p>
            </Section>
          )}

          <Section title="Acceptance Criteria">
            <BulletList items={task.acceptance_criteria} />
          </Section>

          {task.required_reviewers.length > 0 && (
            <Section title="Required Reviewers">
              <div className="flex flex-wrap gap-2">
                {task.required_reviewers.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {task.surfaces.length > 0 && (
            <Section title="Surfaces">
              <div className="flex flex-wrap gap-2">
                {task.surfaces.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {task.dependencies.length > 0 && (
            <Section title="Dependencies">
              <div className="flex flex-wrap gap-2">
                {task.dependencies.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {loading ? (
            <div className="text-text-muted text-sm">Loading artifacts...</div>
          ) : detail ? (
            <>
              {detail.contract?.verification_plan && (
                <Section title="Verification Plan" icon={<ShieldCheck size={12} />}>
                  <p className="whitespace-pre-wrap">
                    {detail.contract.verification_plan}
                  </p>
                </Section>
              )}

              {detail.implementation_contract && (
                <Section title="Implementation Contract" icon={<FileText size={12} />}>
                  <div className="space-y-3">
                    {detail.implementation_contract.summary && (
                      <p className="whitespace-pre-wrap">
                        {detail.implementation_contract.summary}
                      </p>
                    )}
                    {detail.implementation_contract.rationale && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Rationale</p>
                        <p className="whitespace-pre-wrap">
                          {detail.implementation_contract.rationale}
                        </p>
                      </div>
                    )}
                    {detail.implementation_contract.planned_actions.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Planned actions</p>
                        <BulletList
                          items={detail.implementation_contract.planned_actions}
                        />
                      </div>
                    )}
                    {detail.implementation_contract.change_scope.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Change scope</p>
                        <BulletList
                          items={detail.implementation_contract.change_scope}
                        />
                      </div>
                    )}
                    {detail.implementation_contract.non_goals.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Non-goals</p>
                        <BulletList items={detail.implementation_contract.non_goals} />
                      </div>
                    )}
                    {detail.implementation_contract.open_questions.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Open questions</p>
                        <BulletList
                          items={detail.implementation_contract.open_questions}
                        />
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {detail.self_check && (
                <Section title="Self-check">
                  <div className="space-y-3">
                    {detail.self_check.completed_work && (
                      <p className="whitespace-pre-wrap">
                        {detail.self_check.completed_work}
                      </p>
                    )}
                    {detail.self_check.reviewer_focus.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Reviewer focus</p>
                        <BulletList items={detail.self_check.reviewer_focus} />
                      </div>
                    )}
                    {detail.self_check.known_risks.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Known risks</p>
                        <BulletList items={detail.self_check.known_risks} />
                      </div>
                    )}
                    {detail.self_check.deviations_from_plan.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Deviations</p>
                        <BulletList items={detail.self_check.deviations_from_plan} />
                      </div>
                    )}
                    {detail.self_check.gap_signals.length > 0 && (
                      <div>
                        <p className="text-xs text-text-muted mb-1">Gap signals</p>
                        <BulletList items={detail.self_check.gap_signals} />
                      </div>
                    )}
                  </div>
                </Section>
              )}

              <Section
                title="Evidence Gate Status"
                icon={<AlertTriangle size={12} />}
              >
                {latestGateRun ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">
                        Latest gate run:
                      </span>
                      <span
                        className={`text-xs font-medium ${verdictColor(latestGateRun.verdict)}`}
                      >
                        {latestGateRun.verdict ?? "unknown"}
                      </span>
                      <span className="text-xs text-text-muted">
                        ({latestGateRun.gate_run_id ?? "gate"})
                      </span>
                    </div>
                    {latestGateRun.tier_results && (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {(["tier_0", "tier_1", "tier_2"] as const).map((t) => {
                          const tier = latestGateRun.tier_results?.[t] ?? null;
                          if (!tier) {
                            return (
                              <div
                                key={t}
                                className="bg-bg-elevated rounded p-2"
                              >
                                <p className="text-text-muted">{t}</p>
                                <p className="text-text-muted">(no data)</p>
                              </div>
                            );
                          }
                          return (
                            <div key={t} className="bg-bg-elevated rounded p-2">
                              <p className="text-text-muted">{t}</p>
                              <p className={verdictColor(tier.status)}>
                                {tier.status ?? "—"}
                              </p>
                              {tier.details && (
                                <p
                                  className="text-text-muted truncate"
                                  title={tier.details ?? undefined}
                                >
                                  {tier.details}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-text-muted">
                      {gateResults?.runs.length ?? 0} total gate run(s)
                    </p>
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">Gate has not been run.</p>
                )}
              </Section>

              <Section title="Evidence Files">
                {detail.evidence_files.length === 0 ? (
                  <p className="text-text-muted text-sm">
                    No evidence files produced yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.evidence_files.map((f) => (
                      <button
                        key={f.filename}
                        onClick={() => setEvidenceSelected(f)}
                        className="w-full text-left bg-bg-elevated rounded p-2 hover:bg-bg-elevated/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-text-primary font-medium truncate">
                            {f.filename}
                          </span>
                          <span className="text-[10px] text-text-muted shrink-0">
                            {f.entry_count} entr
                            {f.entry_count === 1 ? "y" : "ies"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                          {f.slot && <span>slot: {f.slot}</span>}
                          {f.latest_kind && <span>kind: {f.latest_kind}</span>}
                          {f.latest_verdict && (
                            <span className={verdictColor(f.latest_verdict)}>
                              {f.latest_verdict}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {task.required_reviewers.length > 0 && (
                  <div className="mt-3 text-xs">
                    <p className="text-text-muted mb-1">
                      Required reviewer coverage:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {task.required_reviewers.map((slot) => {
                        const has = detail.evidence_files.some(
                          (f) => f.slot === slot,
                        );
                        return (
                          <span
                            key={slot}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                              has
                                ? "bg-status-green/15 text-status-green"
                                : "bg-status-amber/15 text-status-amber"
                            }`}
                          >
                            {has ? "✓" : "•"} {slot}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Section>

              {evidenceSelected && evidenceContent && (
                <Section title={`Evidence: ${evidenceSelected.filename}`}>
                  <div className="space-y-3">
                    {evidenceContent.entries.map((entry, i) => (
                      <div
                        key={i}
                        className="bg-bg-elevated rounded p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-muted">
                            #{entry.entry_id ?? i + 1}
                          </span>
                          <span className="text-text-secondary">
                            {entry.evidence_kind}
                          </span>
                          {entry.verdict && (
                            <span className={verdictColor(entry.verdict)}>
                              {entry.verdict}
                            </span>
                          )}
                        </div>
                        {entry.summary && (
                          <p className="text-text-primary whitespace-pre-wrap">
                            {entry.summary}
                          </p>
                        )}
                        {entry.rationale && (
                          <p className="text-text-secondary whitespace-pre-wrap">
                            {entry.rationale}
                          </p>
                        )}
                        {entry.concerns.length > 0 && (
                          <div>
                            <p className="text-text-muted">Concerns:</p>
                            <ul className="list-disc list-inside">
                              {entry.concerns.map((c, j) => (
                                <li key={j}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <p className="text-text-muted text-sm">
              Could not load task artifacts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
