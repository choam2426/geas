import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  FileText,
  Target,
  Compass,
  Shield,
  AlertTriangle,
  Layers,
  GitBranch,
  CheckCircle,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as geas from "../lib/geasClient";
import type {
  DebtCandidate,
  DebtEntry,
  Debts,
  Gap,
  GapSignal,
  MissionDetail,
  MissionVerdict,
  PhaseReview,
} from "../types";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface MissionDetailViewProps {
  projectPath: string;
  missionId: string;
  onBack: () => void;
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-secondary">
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="text-text-muted text-sm">None</p>;
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
    case "passed":
    case "approved":
      return "text-status-green";
    case "changes_requested":
      return "text-status-amber";
    case "blocked":
    case "escalated":
    case "cancelled":
      return "text-status-red";
    default:
      return "text-text-secondary";
  }
}

export default function MissionDetailView({
  projectPath,
  missionId,
  onBack,
}: MissionDetailViewProps) {
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [candidates, setCandidates] = useState<unknown | null>(null);
  const [debts, setDebts] = useState<Debts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [d, c, allDebts] = await Promise.all([
        geas.getMissionDetail(projectPath, missionId),
        geas.getCandidates(projectPath, missionId).catch(() => null),
        geas.getDebts(projectPath).catch(() => null),
      ]);
      setDetail(d);
      setCandidates(c);
      setDebts(allDebts);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath, missionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAll().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    fetchAll();
  }, [refreshKey, fetchAll]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="text-text-secondary" />
          </button>
          <div className="h-5 w-48 rounded bg-bg-elevated animate-skeleton" />
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="h-4 w-64 rounded bg-bg-elevated animate-skeleton" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3 rounded bg-bg-elevated animate-skeleton"
              style={{ width: `${70 - i * 10}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="text-text-secondary" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load mission
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const spec = detail.spec;
  const state = detail.state;
  const latestVerdict: MissionVerdict | null =
    detail.verdicts && detail.verdicts.verdicts.length > 0
      ? detail.verdicts.verdicts[detail.verdicts.verdicts.length - 1]
      : null;

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </button>
        <FileText size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-text-primary truncate">
          {spec?.name ?? detail.mission_id}
        </h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <p className="text-xs text-text-muted mb-4">{detail.mission_id}</p>

          <div className="flex flex-wrap gap-2 mb-6">
            <MetaBadge label="mode" value={spec?.mode ?? null} />
            <MetaBadge label="phase" value={state?.phase ?? null} />
            <MetaBadge
              label="approved"
              value={
                spec?.user_approved === null || spec?.user_approved === undefined
                  ? null
                  : spec.user_approved
                    ? "yes"
                    : "no"
              }
            />
            <MetaBadge label="created" value={formatDate(spec?.created_at ?? null)} />
          </div>

          {latestVerdict && (
            <Section title="Final Verdict" icon={<CheckCircle size={12} />}>
              <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
                <p className={`text-sm font-semibold ${verdictColor(latestVerdict.verdict)}`}>
                  {latestVerdict.verdict}
                </p>
                {latestVerdict.rationale && (
                  <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">
                    {latestVerdict.rationale}
                  </p>
                )}
                {latestVerdict.carry_forward.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-text-muted mb-1">Carry forward</p>
                    <BulletList items={latestVerdict.carry_forward} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {spec?.description && (
            <Section title="Description" icon={<Target size={12} />}>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {spec.description}
              </p>
            </Section>
          )}

          {spec?.definition_of_done && (
            <Section title="Definition of Done" icon={<CheckCircle size={12} />}>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {spec.definition_of_done}
              </p>
            </Section>
          )}

          {(spec?.scope?.in?.length ?? 0) + (spec?.scope?.out?.length ?? 0) > 0 && (
            <Section title="Scope" icon={<Compass size={12} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-bg-surface rounded p-3 border border-border-default">
                  <p className="text-xs text-text-muted mb-2">In scope</p>
                  <BulletList items={spec?.scope?.in ?? []} />
                </div>
                <div className="bg-bg-surface rounded p-3 border border-border-default">
                  <p className="text-xs text-text-muted mb-2">Out of scope</p>
                  <BulletList items={spec?.scope?.out ?? []} />
                </div>
              </div>
            </Section>
          )}

          {(spec?.acceptance_criteria ?? []).length > 0 && (
            <Section title="Acceptance Criteria" icon={<ClipboardCheck size={12} />}>
              <BulletList items={spec?.acceptance_criteria ?? []} />
            </Section>
          )}

          {(spec?.constraints ?? []).length > 0 && (
            <Section title="Constraints" icon={<Shield size={12} />}>
              <BulletList items={spec?.constraints ?? []} />
            </Section>
          )}

          {(spec?.affected_surfaces ?? []).length > 0 && (
            <Section title="Affected Surfaces" icon={<Layers size={12} />}>
              <div className="flex flex-wrap gap-2">
                {(spec?.affected_surfaces ?? []).map((s, i) => (
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

          {(spec?.risks ?? []).length > 0 && (
            <Section title="Risks" icon={<AlertTriangle size={12} />}>
              <BulletList items={spec?.risks ?? []} />
            </Section>
          )}

          {detail.design_markdown && (
            <Section title="Mission Design" icon={<FileText size={12} />}>
              <div className="prose prose-invert text-sm max-w-none bg-bg-surface rounded-lg p-4 border border-border-default">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {detail.design_markdown}
                </Markdown>
              </div>
            </Section>
          )}

          <PhaseReviewHistory reviews={detail.phase_reviews?.reviews ?? []} />

          {detail.deliberations?.entries &&
            detail.deliberations.entries.length > 0 && (
              <Section
                title="Mission Deliberations"
                icon={<GitBranch size={12} />}
              >
                <div className="space-y-3">
                  {detail.deliberations.entries.map((e, i) => (
                    <div
                      key={i}
                      className="bg-bg-surface rounded-lg p-3 border border-border-default"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm text-text-primary">
                          {e.proposal_summary ?? "(no summary)"}
                        </p>
                        <span
                          className={`text-xs font-medium ${verdictColor(e.result)}`}
                        >
                          {e.result ?? "—"}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mb-2">
                        {formatDate(e.created_at)}
                      </p>
                      <div className="space-y-1">
                        {e.votes.map((v, j) => (
                          <div key={j} className="text-xs">
                            <span className="text-text-secondary font-medium">
                              {v.voter}
                            </span>
                            <span className={`ml-2 ${verdictColor(v.vote)}`}>
                              {v.vote}
                            </span>
                            {v.rationale && (
                              <p className="text-text-muted pl-2">{v.rationale}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

          <GapSignalsView gap={detail.gap} />

          <ConsolidationPacketView
            candidates={candidates}
            gap={detail.gap}
            promotedDebts={
              debts?.entries.filter(
                (d) => d.introduced_by?.mission_id === detail.mission_id,
              ) ?? []
            }
          />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Phase review history view (DASHBOARD 3.4)
// -----------------------------------------------------------------------------

function PhaseReviewHistory({ reviews }: { reviews: PhaseReview[] }) {
  return (
    <Section title="Phase Review History" icon={<GitBranch size={12} />}>
      {reviews.length === 0 ? (
        <p className="text-text-muted text-sm">No phase reviews recorded</p>
      ) : (
        <div className="space-y-2">
          {reviews
            .slice()
            .reverse()
            .map((r, i) => (
              <div
                key={i}
                className="bg-bg-surface rounded-lg p-3 border border-border-default"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary font-medium capitalize">
                      {r.mission_phase ?? "—"}
                    </span>
                    {r.next_phase && (
                      <>
                        <ArrowLeft
                          size={12}
                          className="text-text-muted rotate-180"
                        />
                        <span className="text-sm text-text-secondary capitalize">
                          {r.next_phase}
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${verdictColor(r.status)}`}>
                    {r.status ?? "—"}
                  </span>
                </div>
                {r.summary && (
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">
                    {r.summary}
                  </p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  {formatDate(r.created_at)}
                </p>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Gap signals summary view (DASHBOARD 3.6)
// -----------------------------------------------------------------------------

function GapSignalsView({ gap }: { gap: Gap | null }) {
  return (
    <Section title="Gap" icon={<AlertTriangle size={12} />}>
      {!gap ? (
        <p className="text-text-muted text-sm">
          Mission has not entered consolidating phase yet (or no gap recorded)
        </p>
      ) : (
        <div className="space-y-3">
          {gap.scope_in_summary && (
            <div>
              <p className="text-xs text-text-muted mb-1">In-scope summary</p>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {gap.scope_in_summary}
              </p>
            </div>
          )}
          {gap.scope_out_summary && (
            <div>
              <p className="text-xs text-text-muted mb-1">Out-of-scope summary</p>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {gap.scope_out_summary}
              </p>
            </div>
          )}
          {gap.fully_delivered.length > 0 && (
            <div className="bg-status-green/10 rounded p-3">
              <p className="text-xs text-status-green mb-1 font-medium">
                Fully delivered ({gap.fully_delivered.length})
              </p>
              <BulletList items={gap.fully_delivered} />
            </div>
          )}
          {gap.partially_delivered.length > 0 && (
            <div className="bg-status-amber/10 rounded p-3">
              <p className="text-xs text-status-amber mb-1 font-medium">
                Partially delivered ({gap.partially_delivered.length})
              </p>
              <BulletList items={gap.partially_delivered} />
            </div>
          )}
          {gap.not_delivered.length > 0 && (
            <div className="bg-status-red/10 rounded p-3">
              <p className="text-xs text-status-red mb-1 font-medium">
                Not delivered ({gap.not_delivered.length})
              </p>
              <BulletList items={gap.not_delivered} />
            </div>
          )}
          {gap.unexpected_additions.length > 0 && (
            <div className="bg-bg-elevated rounded p-3">
              <p className="text-xs text-text-secondary mb-1 font-medium">
                Unexpected additions ({gap.unexpected_additions.length})
              </p>
              <BulletList items={gap.unexpected_additions} />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Consolidation packet view (DASHBOARD 3.9)
// -----------------------------------------------------------------------------

interface CandidatesShape {
  debt_candidates?: DebtCandidate[];
  memory_suggestions?: string[];
  gap_signals?: GapSignal[];
}

function ConsolidationPacketView({
  candidates,
  gap,
  promotedDebts,
}: {
  candidates: unknown | null;
  gap: Gap | null;
  promotedDebts: DebtEntry[];
}) {
  const c: CandidatesShape = (candidates as CandidatesShape) ?? {};
  if (!candidates) {
    return (
      <Section title="Consolidation Packet">
        <p className="text-text-muted text-sm">
          Scaffold has not been run for this mission
        </p>
      </Section>
    );
  }

  const debtCandidates = c.debt_candidates ?? [];
  const memorySuggestions = c.memory_suggestions ?? [];
  const gapSignalCandidates = c.gap_signals ?? [];

  const promotedSet = new Set(
    promotedDebts
      .map((d) => d.title ?? "")
      .filter((t) => t.length > 0)
      .map((t) => t.toLowerCase()),
  );

  return (
    <Section title="Consolidation Packet" icon={<ClipboardCheck size={12} />}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-text-muted mb-2">
            Debt candidates ({debtCandidates.length})
          </p>
          {debtCandidates.length === 0 ? (
            <p className="text-sm text-text-muted">None</p>
          ) : (
            <div className="space-y-1">
              {debtCandidates.map((dc, i) => {
                const promoted = promotedSet.has((dc.title ?? "").toLowerCase());
                return (
                  <div
                    key={i}
                    className="bg-bg-surface rounded p-2 border border-border-default flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {dc.title ?? "(untitled)"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {dc.severity} · {dc.kind}
                      </p>
                    </div>
                    <span
                      className={`text-xs shrink-0 ${
                        promoted ? "text-status-green" : "text-text-muted"
                      }`}
                    >
                      {promoted ? "promoted" : "pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-text-muted mb-2">
            Memory suggestions ({memorySuggestions.length})
          </p>
          <BulletList items={memorySuggestions} />
        </div>

        <div>
          <p className="text-xs text-text-muted mb-2">
            Gap signals ({gapSignalCandidates.length})
          </p>
          {gapSignalCandidates.length === 0 ? (
            <p className="text-sm text-text-muted">None</p>
          ) : (
            <div className="space-y-1">
              {gapSignalCandidates.map((g, i) => {
                const inGap = gap
                  ? (gap.fully_delivered.includes(g.summary ?? "") ||
                      gap.partially_delivered.includes(g.summary ?? "") ||
                      gap.not_delivered.includes(g.summary ?? "") ||
                      gap.unexpected_additions.includes(g.summary ?? ""))
                  : false;
                return (
                  <div
                    key={i}
                    className="bg-bg-surface rounded p-2 border border-border-default flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {g.summary ?? "(untitled)"}
                      </p>
                      <p className="text-xs text-text-muted">{g.kind}</p>
                    </div>
                    <span
                      className={`text-xs shrink-0 ${
                        inGap ? "text-status-green" : "text-text-muted"
                      }`}
                    >
                      {inGap ? "promoted" : "pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

// Satisfy unused-variable checks when list is empty
void XCircle;
