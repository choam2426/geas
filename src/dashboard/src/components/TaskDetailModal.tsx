/**
 * TaskDetailModal — everything we can honestly show about a single task.
 *
 * Sections (in order):
 *   - header: id, title, status/risk/agent pills, path badge
 *   - contract: goal, acceptance criteria, surfaces, deps, reviewers
 *   - implementation_contract: change_scope, planned_actions, non_goals,
 *                              alternatives, assumptions, open_questions
 *   - self-check (latest entry; label as "latest of N" when >1)
 *   - gate result: tier 0/1/2 verdicts + latest overall verdict
 *   - evidence timeline: per-slot files with drill-down into entries
 *   - deliberations (if present)
 *
 * The modal supports a **deps stack**: clicking a dependency id pushes the
 * current task onto an internal stack and opens the dep's modal in place;
 * ESC / the back button pops. The outer `onClose` is only called when the
 * stack is empty.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import * as geas from "../lib/geasClient";
import type {
  EvidenceFile,
  EvidenceFileMeta,
  TaskDetail,
  TaskRow,
} from "../types";
import {
  lookupColor,
  riskColors,
  statusColors,
} from "../colors";
import Pill from "./Pill";
import PathBadge from "./PathBadge";

interface TaskDetailModalProps {
  task: TaskRow;
  projectPath: string;
  missionId: string;
  onClose: () => void;
}

export default function TaskDetailModal({
  task: initialTask,
  projectPath,
  missionId,
  onClose,
}: TaskDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Deps navigation stack.
   *
   * The *current* task is always `stack[stack.length - 1]`. Clicking a dep
   * pushes a new `TaskRow`-compatible shell; the real `TaskDetail` is
   * re-fetched whenever the top changes. `goBack` pops; when the stack
   * becomes empty the modal closes via `onClose`.
   */
  const [stack, setStack] = useState<TaskRow[]>([initialTask]);
  const task = stack[stack.length - 1];

  const pushTask = useCallback((t: TaskRow) => {
    setStack((s) => [...s, t]);
  }, []);

  const popTask = useCallback(() => {
    setStack((s) => (s.length <= 1 ? s : s.slice(0, -1)));
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // ESC: pop the stack, or close if already at the root.
      if (stack.length > 1) popTask();
      else onClose();
    },
    [onClose, popTask, stack.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
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
        aria-label={`Task: ${task.title}`}
        className="bg-bg-1 border border-border rounded-[4px] w-full max-w-3xl max-h-[86vh] overflow-y-auto shadow-2xl animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Header
          task={task}
          projectPath={projectPath}
          missionId={missionId}
          canGoBack={stack.length > 1}
          onBack={popTask}
          onClose={onClose}
        />

        <Body
          key={task.task_id}
          task={task}
          projectPath={projectPath}
          missionId={missionId}
          onOpenDep={(depId) => {
            // Lightweight shell — Body fetches the full contract/state.
            const shell: TaskRow = {
              task_id: depId,
              title: depId,
              goal: null,
              status: "drafted",
              risk_level: null,
              primary_worker_type: null,
              required_reviewers: [],
              active_agent: null,
              verify_fix_iterations: 0,
              acceptance_criteria: [],
              dependencies: [],
              surfaces: [],
            };
            pushTask(shell);
          }}
        />
      </div>
    </div>
  );
}

// -- Header ------------------------------------------------------------------

function Header({
  task,
  projectPath: _projectPath,
  missionId,
  canGoBack,
  onBack,
  onClose,
}: {
  task: TaskRow;
  projectPath: string;
  missionId: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-border sticky top-0 bg-bg-1 z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {canGoBack && (
              <button
                onClick={onBack}
                className="font-mono text-[11px] text-fg-muted hover:text-fg flex items-center gap-1 cursor-pointer"
                title="Back to previous task"
              >
                <ArrowLeft size={11} />
                back
              </button>
            )}
            <span className="font-mono text-[11px] text-fg-dim">
              {task.task_id}
            </span>
          </div>
          <h2 className="text-[15px] font-semibold text-fg">
            {task.title || task.task_id}
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <Pill color={lookupColor(statusColors, task.status)}>
              {task.status}
            </Pill>
            {task.risk_level && (
              <Pill color={lookupColor(riskColors, task.risk_level)}>
                risk · {task.risk_level}
              </Pill>
            )}
            {task.primary_worker_type && (
              <span className="font-mono text-[11px] text-fg-muted">
                {task.primary_worker_type}
              </span>
            )}
            {task.active_agent && (
              <span className="font-mono text-[11px] text-green">
                ● {task.active_agent}
              </span>
            )}
            {task.verify_fix_iterations > 0 && (
              <span className="font-mono text-[11px] text-fg-dim">
                iter {task.verify_fix_iterations}
              </span>
            )}
          </div>
          <div className="mt-2">
            <PathBadge
              path={`.geas/missions/${missionId}/tasks/${task.task_id}/`}
            />
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
    </div>
  );
}

// -- Body --------------------------------------------------------------------

function Body({
  task,
  projectPath,
  missionId,
  onOpenDep,
}: {
  task: TaskRow;
  projectPath: string;
  missionId: string;
  onOpenDep: (depId: string) => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidenceSelected, setEvidenceSelected] =
    useState<EvidenceFileMeta | null>(null);
  const [evidenceContent, setEvidenceContent] = useState<EvidenceFile | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEvidenceSelected(null);
    setEvidenceContent(null);
    (async () => {
      try {
        const result = await geas.getTaskDetail(
          projectPath,
          missionId,
          task.task_id,
        );
        if (!cancelled) setDetail(result);
      } catch {
        if (!cancelled) setDetail(null);
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

  // Merge displayed fields: prefer live detail.contract values over the
  // TaskRow shell we pushed when navigating via a dep click.
  const contract = detail?.contract;
  const goal = contract?.goal ?? task.goal;
  const acceptance = contract?.acceptance_criteria ?? task.acceptance_criteria;
  const surfaces = contract?.surfaces ?? task.surfaces;
  const deps = contract?.dependencies ?? task.dependencies;
  const reviewers = contract?.routing?.required_reviewers ?? task.required_reviewers;

  const gate = detail?.gate_results;
  const latestGate =
    gate && gate.runs.length > 0 ? gate.runs[gate.runs.length - 1] : null;

  const latestSelfCheck =
    detail?.self_check && detail.self_check.entries.length > 0
      ? detail.self_check.entries[detail.self_check.entries.length - 1]
      : null;
  const selfCheckCount = detail?.self_check?.entries.length ?? 0;

  return (
    <div className="p-5 space-y-6">
      {/* Goal */}
      {goal && (
        <Section title="goal">
          <p className="text-[13px] text-fg whitespace-pre-wrap">{goal}</p>
        </Section>
      )}

      {/* Acceptance criteria */}
      {acceptance.length > 0 && (
        <Section title={`acceptance_criteria (${acceptance.length})`}>
          <AcceptanceList items={acceptance} detail={detail} />
        </Section>
      )}

      {/* Surfaces + reviewers + deps */}
      {(surfaces.length > 0 || reviewers.length > 0 || deps.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {surfaces.length > 0 && (
            <MiniSection title={`surfaces (${surfaces.length})`}>
              <TokenStack items={surfaces} />
            </MiniSection>
          )}
          {reviewers.length > 0 && (
            <MiniSection title={`reviewers (${reviewers.length})`}>
              <TokenStack items={reviewers} />
            </MiniSection>
          )}
          {deps.length > 0 && (
            <MiniSection title={`dependencies (${deps.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {deps.map((d) => (
                  <button
                    key={d}
                    onClick={() => onOpenDep(d)}
                    className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-cyan hover:bg-bg-2/70 cursor-pointer transition-colors"
                    title={`Open ${d}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </MiniSection>
          )}
        </div>
      )}

      {loading ? (
        <div className="font-mono text-[11px] text-fg-dim">loading artifacts…</div>
      ) : !detail ? (
        <div className="font-mono text-[11px] text-fg-dim">
          could not load task artifacts
        </div>
      ) : (
        <>
          {/* Implementation contract */}
          {detail.implementation_contract && (
            <Section title="implementation_contract">
              <ImplContractView ic={detail.implementation_contract} />
            </Section>
          )}

          {/* Self-check */}
          {latestSelfCheck && (
            <Section
              title={
                selfCheckCount > 1
                  ? `self-check · latest of ${selfCheckCount}`
                  : "self-check"
              }
            >
              <SelfCheckView entry={latestSelfCheck} />
            </Section>
          )}

          {/* Gate result */}
          <Section title="gate_result">
            {latestGate ? (
              <GateView
                run={latestGate}
                totalRuns={gate?.runs.length ?? 0}
              />
            ) : (
              <p className="font-mono text-[11px] text-fg-dim">
                gate has not been run
              </p>
            )}
          </Section>

          {/* Evidence files */}
          <Section
            title={`evidence (${detail.evidence_files.length})`}
          >
            <EvidenceTimeline
              files={detail.evidence_files}
              selected={evidenceSelected}
              onSelect={setEvidenceSelected}
              reviewers={reviewers}
            />
            {evidenceSelected && evidenceContent && (
              <div className="mt-4 border-t border-border-muted pt-3">
                <EvidenceDetail content={evidenceContent} />
              </div>
            )}
          </Section>

          {/* Deliberations */}
          {detail.deliberations &&
            detail.deliberations.entries.length > 0 && (
              <Section
                title={`deliberations (${detail.deliberations.entries.length})`}
              >
                <DeliberationsView
                  entries={detail.deliberations.entries}
                />
              </Section>
            )}
        </>
      )}
    </div>
  );
}

// -- Sections ----------------------------------------------------------------

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

function MiniSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function TokenStack({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <span
          key={i}
          className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg-muted"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function AcceptanceList({
  items,
  detail,
}: {
  items: string[];
  detail: TaskDetail | null;
}) {
  // Merge criterion results from the latest verification evidence entry
  // (if any) so we can mark items as ✓ / ✗.
  const resultByCriterion = new Map<string, boolean | null>();
  const evidenceFiles = detail?.evidence_files ?? [];
  void evidenceFiles;
  // Granular criterion results live inside individual evidence entries; we
  // don't have them at meta level without fetching. Leave merge to the
  // evidence panel for now and show criteria as a flat list here.

  return (
    <ul className="space-y-1 text-[12px]">
      {items.map((c, i) => {
        const hit = resultByCriterion.get(c);
        const marker =
          hit === true ? "✓" : hit === false ? "✗" : "·";
        const markerCls =
          hit === true
            ? "text-green"
            : hit === false
              ? "text-red"
              : "text-fg-dim";
        return (
          <li key={i} className="flex items-start gap-2 text-fg">
            <span className={"font-mono " + markerCls}>{marker}</span>
            <span>{c}</span>
          </li>
        );
      })}
    </ul>
  );
}

// -- Implementation contract view --------------------------------------------

function ImplContractView({
  ic,
}: {
  ic: NonNullable<TaskDetail["implementation_contract"]>;
}) {
  const blocks: { key: string; label: string; items: string[] }[] = [
    { key: "change_scope", label: "change_scope", items: ic.change_scope },
    {
      key: "planned_actions",
      label: "planned_actions",
      items: ic.planned_actions,
    },
    { key: "non_goals", label: "non_goals", items: ic.non_goals },
    {
      key: "alternatives_considered",
      label: "alternatives_considered",
      items: ic.alternatives_considered,
    },
    { key: "assumptions", label: "assumptions", items: ic.assumptions },
    { key: "open_questions", label: "open_questions", items: ic.open_questions },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="space-y-3">
      {ic.summary && (
        <p className="text-[13px] text-fg whitespace-pre-wrap">{ic.summary}</p>
      )}
      {ic.rationale && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1">
            rationale
          </div>
          <p className="text-[12px] text-fg-muted whitespace-pre-wrap">
            {ic.rationale}
          </p>
        </div>
      )}
      {blocks.map((b) => (
        <div key={b.key}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1">
            {b.label} ({b.items.length})
          </div>
          <ul className="text-[12px] text-fg space-y-0.5 pl-3">
            {b.items.map((x, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-fg-dim">—</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// -- Self-check view ---------------------------------------------------------

function SelfCheckView({
  entry,
}: {
  entry: NonNullable<TaskDetail["self_check"]>["entries"][number];
}) {
  const blocks: { label: string; items: string[] }[] = [
    { label: "reviewer_focus", items: entry.reviewer_focus },
    { label: "known_risks", items: entry.known_risks },
    { label: "deviations_from_plan", items: entry.deviations_from_plan },
    { label: "gap_signals", items: entry.gap_signals },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="space-y-3">
      {entry.completed_work && (
        <p className="text-[13px] text-fg whitespace-pre-wrap">
          {entry.completed_work}
        </p>
      )}
      {blocks.map((b) => (
        <div key={b.label}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1">
            {b.label} ({b.items.length})
          </div>
          <ul className="text-[12px] text-fg space-y-0.5 pl-3">
            {b.items.map((x, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-fg-dim">—</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {entry.revision_ref !== null && entry.revision_ref !== undefined && (
        <p className="font-mono text-[10px] text-fg-dim">
          revision_ref → entry #{entry.revision_ref}
        </p>
      )}
    </div>
  );
}

// -- Gate view ---------------------------------------------------------------

function GateView({
  run,
  totalRuns,
}: {
  run: NonNullable<TaskDetail["gate_results"]>["runs"][number];
  totalRuns: number;
}) {
  const tiers: {
    key: "tier_0" | "tier_1" | "tier_2";
    label: string;
  }[] = [
    { key: "tier_0", label: "tier 0" },
    { key: "tier_1", label: "tier 1" },
    { key: "tier_2", label: "tier 2" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="text-fg-dim">verdict</span>
        <span className={verdictClass(run.verdict)}>
          {run.verdict ?? "—"}
        </span>
        {run.gate_run_id && (
          <span className="text-fg-dim">· {run.gate_run_id}</span>
        )}
        <span className="text-fg-dim ml-auto">
          {totalRuns} run{totalRuns === 1 ? "" : "s"} total
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((t) => {
          const tier = run.tier_results?.[t.key] ?? null;
          return (
            <div
              key={t.key}
              className="bg-bg-2 px-2 py-1.5 rounded-[3px] font-mono text-[11px]"
            >
              <div className="text-fg-dim">{t.label}</div>
              {tier ? (
                <>
                  <div className={verdictClass(tier.status)}>
                    {tier.status ?? "—"}
                  </div>
                  {tier.details && (
                    <div
                      className="text-fg-dim truncate"
                      title={tier.details ?? undefined}
                    >
                      {tier.details}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-fg-dim">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Evidence ----------------------------------------------------------------

function EvidenceTimeline({
  files,
  selected,
  onSelect,
  reviewers,
}: {
  files: EvidenceFileMeta[];
  selected: EvidenceFileMeta | null;
  onSelect: (f: EvidenceFileMeta) => void;
  reviewers: string[];
}) {
  if (files.length === 0) {
    return (
      <p className="font-mono text-[11px] text-fg-dim">
        no evidence files yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((f) => {
        const isActive = selected?.filename === f.filename;
        return (
          <button
            key={f.filename}
            onClick={() => onSelect(f)}
            className={
              "w-full text-left px-2 py-1.5 rounded-[3px] cursor-pointer transition-colors border-l-2 " +
              (isActive
                ? "bg-bg-2 border-green"
                : "bg-transparent border-transparent hover:bg-bg-2/60")
            }
          >
            <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className="text-fg truncate">{f.filename}</span>
              <span className="text-fg-dim flex-shrink-0">
                {f.entry_count} entr{f.entry_count === 1 ? "y" : "ies"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-fg-dim">
              {f.slot && <span>slot · {f.slot}</span>}
              {f.latest_kind && <span>kind · {f.latest_kind}</span>}
              {f.latest_verdict && (
                <span className={verdictClass(f.latest_verdict)}>
                  {f.latest_verdict}
                </span>
              )}
            </div>
          </button>
        );
      })}

      {reviewers.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border-muted">
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1.5">
            required reviewer coverage
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reviewers.map((slot) => {
              const has = files.some((f) => f.slot === slot);
              return (
                <span
                  key={slot}
                  className={
                    "font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] " +
                    (has
                      ? "bg-[var(--color-green-surface)] text-green"
                      : "bg-[var(--color-amber-surface)] text-amber")
                  }
                >
                  {has ? "✓" : "·"} {slot}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceDetail({ content }: { content: EvidenceFile }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim">
        entries ({content.entries.length})
      </div>
      {content.entries.map((entry, i) => (
        <div
          key={i}
          className="bg-bg-2 px-3 py-2 rounded-[3px] text-[12px] space-y-1"
        >
          <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
            <span className="text-fg-dim">#{entry.entry_id ?? i + 1}</span>
            <span className="text-fg">{entry.evidence_kind ?? "—"}</span>
            {entry.verdict && (
              <span className={verdictClass(entry.verdict)}>
                {entry.verdict}
              </span>
            )}
          </div>
          {entry.summary && (
            <p className="text-fg whitespace-pre-wrap">{entry.summary}</p>
          )}
          {entry.rationale && (
            <p className="text-fg-muted whitespace-pre-wrap">
              {entry.rationale}
            </p>
          )}
          {entry.concerns.length > 0 && (
            <div>
              <div className="font-mono text-[10px] text-fg-dim">concerns</div>
              <ul className="pl-3 text-fg">
                {entry.concerns.map((c, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="text-fg-dim">—</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// -- Deliberations -----------------------------------------------------------

function DeliberationsView({
  entries,
}: {
  entries: NonNullable<TaskDetail["deliberations"]>["entries"];
}) {
  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div
          key={i}
          className="bg-bg-2 px-3 py-2 rounded-[3px] font-mono text-[11px] space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg">{e.proposal_summary ?? "—"}</span>
            <span className={verdictClass(e.result)}>{e.result ?? "—"}</span>
          </div>
          <ul className="space-y-0.5 pl-2">
            {e.votes.map((v, j) => (
              <li key={j} className="flex items-start gap-2">
                <span className="text-fg-muted">{v.voter ?? "—"}</span>
                <span className={verdictClass(v.vote)}>{v.vote ?? "—"}</span>
                {v.rationale && (
                  <span className="text-fg-dim truncate">· {v.rationale}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// -- Utilities ---------------------------------------------------------------

function verdictClass(v: string | null | undefined): string {
  switch (v) {
    case "pass":
    case "approved":
    case "passed":
      return "text-green";
    case "fail":
    case "changes_requested":
      return "text-amber";
    case "block":
    case "blocked":
    case "escalated":
      return "text-red";
    case "cancelled":
      return "text-fg-dim";
    default:
      return "text-fg-muted";
  }
}
