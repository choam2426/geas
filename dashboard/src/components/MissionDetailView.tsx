import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  FileText,
  Check,
  X,
  Target,
  Shield,
  AlertTriangle,
  Lightbulb,
  User,
  Layers,
  Settings,
  Compass,
  GitBranch,
  MessageSquare,
  ClipboardCheck,
  SearchCheck,
  HelpCircle,
  MonitorSmartphone,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  MissionSpecDetail,
  DesignBrief,
  VoteRound,
  PhaseReview,
  GapAssessment,
} from "../types";

/** Normalize a path for cross-platform comparison */
function normalizePath(p: string): string {
  return p
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
}

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

function MetaBadge({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-secondary">
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>
  );
}

export default function MissionDetailView({
  projectPath,
  missionId,
  onBack,
}: MissionDetailViewProps) {
  const [spec, setSpec] = useState<MissionSpecDetail | null>(null);
  const [designBrief, setDesignBrief] = useState<DesignBrief | null>(null);
  const [voteRounds, setVoteRounds] = useState<VoteRound[]>([]);
  const [phaseReviews, setPhaseReviews] = useState<PhaseReview[]>([]);
  const [gapAssessment, setGapAssessment] = useState<GapAssessment | null>(null);
  const [missionSummary, setMissionSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpec = useCallback(async () => {
    try {
      const [specResult, briefResult, votesResult, reviewsResult, gapResult, summaryResult] = await Promise.all([
        invoke<MissionSpecDetail>("get_mission_spec", {
          path: projectPath,
          mission_id: missionId,
        }),
        invoke<DesignBrief | null>("get_design_brief", { path: projectPath, mission_id: missionId }).catch(() => null),
        invoke<VoteRound[]>("get_vote_rounds", { path: projectPath, mission_id: missionId }).catch(() => []),
        invoke<PhaseReview[]>("get_phase_reviews", { path: projectPath, mission_id: missionId }).catch(() => []),
        invoke<GapAssessment | null>("get_gap_assessment", { path: projectPath, mission_id: missionId }).catch(() => null),
        invoke<string | null>("get_mission_summary", { path: projectPath, mission_id: missionId }).catch(() => null),
      ]);
      setSpec(specResult);
      setDesignBrief(briefResult);
      setVoteRounds(votesResult);
      setPhaseReviews(reviewsResult);
      setGapAssessment(gapResult);
      setMissionSummary(summaryResult);
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
    fetchSpec().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchSpec]);

  // Auto-refresh on project changes
  useEffect(() => {
    const unlisten = listen<{ path: string }>(
      "geas://project-changed",
      (event) => {
        if (
          normalizePath(event.payload.path) !== normalizePath(projectPath)
        )
          return;
        setTimeout(() => {
          fetchSpec();
        }, 300);
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [projectPath, fetchSpec]);

  // Loading skeleton
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
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-3 rounded bg-bg-elevated animate-skeleton"
                style={{ width: `${70 - i * 10}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-bg-elevated animate-skeleton" />
                <div className="h-3 w-full rounded bg-bg-elevated animate-skeleton" />
                <div className="h-3 w-3/4 rounded bg-bg-elevated animate-skeleton" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
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
          <h1 className="text-lg font-semibold text-text-primary">
            Mission Detail
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load mission spec
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no spec data at all)
  if (!spec) {
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
          <h1 className="text-lg font-semibold text-text-primary">
            Mission Detail
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText
              size={48}
              className="mx-auto text-text-muted mb-4"
            />
            <p className="text-text-secondary text-sm">
              No spec found for this mission
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasScope = spec.scope_in.length > 0 || spec.scope_out.length > 0;
  const hasRiskNotes = spec.risk_notes.length > 0;
  const hasAssumptions = spec.assumptions.length > 0;
  const hasAmbiguities = spec.ambiguities.length > 0;
  const hasAffectedSurfaces = spec.affected_surfaces.length > 0;

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {/* Header */}
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
          {spec.mission ?? missionId}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            <MetaBadge label="Profile" value={spec.domain_profile} />
            <MetaBadge label="Mode" value={spec.mode} />
            <MetaBadge label="Target user" value={spec.target_user} />
            {spec.created_at && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-elevated text-xs text-text-secondary">
                <span className="text-text-muted">Created:</span>
                <span className="font-medium text-text-primary">
                  {formatDate(spec.created_at)}
                </span>
              </span>
            )}
          </div>

          {/* Mission ID */}
          <div className="text-xs text-text-muted break-all">
            {missionId}
          </div>

          {/* Done When */}
          {spec.done_when && (
            <Section
              icon={<Target size={16} className="text-status-green" />}
              title="Done When"
            >
              <p className="text-sm text-text-secondary">
                {spec.done_when}
              </p>
            </Section>
          )}

          {/* Mission Summary */}
          {missionSummary !== null && (
            <Section
              icon={<FileText size={16} className="text-accent" />}
              title="Mission Summary"
            >
              <div className="rules-markdown">
                <Markdown remarkPlugins={[remarkGfm]}>{missionSummary}</Markdown>
              </div>
            </Section>
          )}

          {/* Scope */}
          {hasScope && (
            <Section
              icon={<Layers size={16} className="text-accent" />}
              title="Scope"
            >
              {spec.scope_in.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    In Scope
                  </h4>
                  <ul className="space-y-1.5">
                    {spec.scope_in.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <Check
                          size={14}
                          className="text-status-green mt-0.5 shrink-0"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {spec.scope_out.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    Out of Scope
                  </h4>
                  <ul className="space-y-1.5">
                    {spec.scope_out.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <X
                          size={14}
                          className="text-status-red mt-0.5 shrink-0"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Acceptance Criteria */}
          {spec.acceptance_criteria.length > 0 && (
            <Section
              icon={
                <Check size={16} className="text-status-green" />
              }
              title="Acceptance Criteria"
            >
              <ol className="space-y-1.5 list-none">
                {spec.acceptance_criteria.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <span className="text-xs font-mono text-text-muted mt-0.5 shrink-0 w-5 text-right">
                      {i + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Constraints */}
          {spec.constraints.length > 0 && (
            <Section
              icon={<Shield size={16} className="text-status-amber" />}
              title="Constraints"
            >
              <ul className="space-y-1.5">
                {spec.constraints.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <Settings
                      size={14}
                      className="text-text-muted mt-0.5 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Risk Notes */}
          {hasRiskNotes && (
            <Section
              icon={
                <AlertTriangle
                  size={16}
                  className="text-status-red"
                />
              }
              title="Risk Notes"
            >
              <ul className="space-y-1.5">
                {spec.risk_notes.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <AlertTriangle
                      size={14}
                      className="text-status-red mt-0.5 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Assumptions */}
          {hasAssumptions && (
            <Section
              icon={
                <Lightbulb size={16} className="text-status-amber" />
              }
              title="Assumptions"
            >
              <ul className="space-y-1.5">
                {spec.assumptions.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <Lightbulb
                      size={14}
                      className="text-status-amber mt-0.5 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Ambiguities */}
          {hasAmbiguities && (
            <Section
              icon={<HelpCircle size={16} className="text-status-amber" />}
              title="Ambiguities"
            >
              <ul className="space-y-1.5">
                {spec.ambiguities.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <HelpCircle
                      size={14}
                      className="text-status-amber mt-0.5 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Affected Surfaces */}
          {hasAffectedSurfaces && (
            <Section
              icon={<MonitorSmartphone size={16} className="text-accent" />}
              title="Affected Surfaces"
            >
              <ul className="space-y-1.5">
                {spec.affected_surfaces.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <MonitorSmartphone
                      size={14}
                      className="text-accent mt-0.5 shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Design Brief */}
          {designBrief && (
            <Section
              icon={<Compass size={16} className="text-accent" />}
              title="Design Brief"
            >
              <div className="space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {designBrief.depth && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-elevated text-text-secondary">
                      {designBrief.depth}
                    </span>
                  )}
                  {designBrief.status && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      designBrief.status === "approved" ? "bg-status-green/10 text-status-green" :
                      designBrief.status === "rejected" ? "bg-status-red/10 text-status-red" :
                      designBrief.status === "reviewing" ? "bg-status-blue/10 text-status-blue" :
                      designBrief.status === "draft" ? "bg-bg-elevated text-text-muted" :
                      "bg-bg-elevated text-text-secondary"
                    }`}>
                      {designBrief.status}
                    </span>
                  )}
                </div>

                {/* Chosen Approach */}
                {designBrief.chosen_approach && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Chosen Approach
                    </h4>
                    <p className="text-sm text-text-secondary">{designBrief.chosen_approach}</p>
                  </div>
                )}

                {/* Non-Goals */}
                {designBrief.non_goals.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Non-Goals
                    </h4>
                    <ul className="space-y-1.5">
                      {designBrief.non_goals.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <X size={14} className="text-status-red mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Verification Strategy */}
                {designBrief.verification_strategy && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Verification Strategy
                    </h4>
                    <p className="text-sm text-text-secondary">{designBrief.verification_strategy}</p>
                  </div>
                )}

                {/* Alternatives Considered */}
                {designBrief.alternatives_considered.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Alternatives Considered
                    </h4>
                    <ul className="space-y-2">
                      {designBrief.alternatives_considered.map((alt, i) => (
                        <li key={i} className="text-sm border-l-2 border-border-default pl-3">
                          {alt.approach && (
                            <p className="text-text-secondary font-medium">{alt.approach}</p>
                          )}
                          {alt.rejected_reason && (
                            <p className="text-text-muted text-xs mt-0.5">Rejected: {alt.rejected_reason}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Architecture Decisions */}
                {designBrief.architecture_decisions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Architecture Decisions
                    </h4>
                    <ul className="space-y-2">
                      {designBrief.architecture_decisions.map((dec, i) => (
                        <li key={i} className="text-sm border-l-2 border-accent/30 pl-3">
                          {dec.decision && (
                            <p className="text-text-secondary font-medium">{dec.decision}</p>
                          )}
                          {dec.rationale && (
                            <p className="text-text-muted text-xs mt-0.5">{dec.rationale}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risks */}
                {designBrief.risks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Risks
                    </h4>
                    <ul className="space-y-2">
                      {designBrief.risks.map((risk, i) => (
                        <li key={i} className="text-sm border-l-2 border-status-red/30 pl-3">
                          {risk.description && (
                            <p className="text-text-secondary">{risk.description}</p>
                          )}
                          {risk.mitigation && (
                            <p className="text-text-muted text-xs mt-0.5">Mitigation: {risk.mitigation}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preserve List */}
                {designBrief.preserve_list?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Preserve List
                    </h4>
                    <ul className="space-y-1.5">
                      {designBrief.preserve_list.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <Shield size={14} className="text-status-blue mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Unresolved Assumptions */}
                {designBrief.unresolved_assumptions?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Unresolved Assumptions
                    </h4>
                    <ul className="space-y-1.5">
                      {designBrief.unresolved_assumptions.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <HelpCircle size={14} className="text-status-yellow mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Design Review */}
                {designBrief.design_review && (
                  <div className="border-l-2 border-accent/30 pl-3">
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Design Review — {designBrief.design_review.reviewer_type}
                    </h4>
                    {designBrief.design_review.summary && (
                      <p className="text-sm text-text-secondary">{designBrief.design_review.summary}</p>
                    )}
                    {designBrief.design_review.additions?.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {designBrief.design_review.additions.map((a, i) => (
                          <li key={i} className="text-xs text-text-muted">+ {a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Rejection History */}
                {designBrief.rejection_history?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Rejection History
                    </h4>
                    <ul className="space-y-2">
                      {designBrief.rejection_history.map((entry, i) => (
                        <li key={i} className="text-sm border-l-2 border-status-red/30 pl-3">
                          <p className="text-text-secondary">{entry.reason}</p>
                          <p className="text-text-muted text-xs mt-0.5">Revision: {entry.revision_summary}</p>
                          {entry.rejected_at && (
                            <p className="text-text-muted text-xs">{entry.rejected_at}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Phase Reviews */}
          {phaseReviews.length > 0 && (
            <Section
              icon={<ClipboardCheck size={16} className="text-status-green" />}
              title="Phase Reviews"
            >
              <div className="space-y-4">
                {phaseReviews.map((review, i) => (
                  <div key={i} className="border-l-2 border-border-default pl-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {review.mission_phase && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-elevated text-text-secondary">
                          {review.mission_phase}
                        </span>
                      )}
                      {review.status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          review.status === "ready_to_exit" ? "bg-status-green/10 text-status-green" :
                          review.status === "ready_to_enter" ? "bg-status-blue/10 text-status-blue" :
                          review.status === "blocked" || review.status === "escalated" ? "bg-status-red/10 text-status-red" :
                          "bg-bg-elevated text-text-secondary"
                        }`}>
                          {review.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    {review.summary && (
                      <p className="text-sm text-text-secondary">{review.summary}</p>
                    )}
                    {review.gate_criteria_met.length > 0 && (
                      <ul className="space-y-1">
                        {review.gate_criteria_met.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-text-secondary">
                            <Check size={14} className="text-status-green mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {review.gate_criteria_unmet.length > 0 && (
                      <ul className="space-y-1">
                        {review.gate_criteria_unmet.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-text-secondary">
                            <X size={14} className="text-status-red mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Vote Rounds */}
          {voteRounds.length > 0 && (
            <Section
              icon={<MessageSquare size={16} className="text-accent" />}
              title="Vote Rounds"
            >
              <div className="space-y-4">
                {voteRounds.map((round, i) => (
                  <div key={i} className="border-l-2 border-border-default pl-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {round.round_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-elevated text-text-secondary">
                          {round.round_type}
                        </span>
                      )}
                      {round.result && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          round.result === "agree" || round.result === "ship" ? "bg-status-green/10 text-status-green" :
                          round.result === "disagree" || round.result === "escalate" ? "bg-status-red/10 text-status-red" :
                          round.result === "iterate" ? "bg-status-amber/10 text-status-amber" :
                          round.result === "inconclusive" ? "bg-bg-elevated text-text-muted" :
                          "bg-bg-elevated text-text-secondary"
                        }`}>
                          {round.result}
                        </span>
                      )}
                      {round.quorum_met === false && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-red/10 text-status-red">
                          quorum not met{round.quorum_failure_count ? ` (${round.quorum_failure_count})` : ""}
                        </span>
                      )}
                    </div>
                    {round.proposal_summary && (
                      <p className="text-sm text-text-secondary">{round.proposal_summary}</p>
                    )}
                    {round.votes.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {round.votes.map((v, j) => (
                          <div key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-text-muted font-medium shrink-0">
                              {v.voter ?? "Unknown"}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0 rounded text-xs font-medium shrink-0 ${
                              v.vote === "agree" || v.vote === "ship" ? "bg-status-green/10 text-status-green" :
                              v.vote === "disagree" || v.vote === "escalate" ? "bg-status-red/10 text-status-red" :
                              v.vote === "iterate" ? "bg-status-amber/10 text-status-amber" :
                              "bg-bg-elevated text-text-secondary"
                            }`}>
                              {v.vote ?? "?"}
                            </span>
                            {v.rationale && (
                              <span className="text-text-muted text-xs">{v.rationale}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Gap Assessment */}
          {gapAssessment && (
            <Section
              icon={<SearchCheck size={16} className="text-status-amber" />}
              title="Gap Assessment"
            >
              <div className="space-y-4">
                {gapAssessment.fully_delivered.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Fully Delivered
                    </h4>
                    <ul className="space-y-1">
                      {gapAssessment.fully_delivered.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <Check size={14} className="text-status-green mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gapAssessment.partially_delivered.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Partially Delivered
                    </h4>
                    <ul className="space-y-1">
                      {gapAssessment.partially_delivered.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <AlertTriangle size={14} className="text-status-amber mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gapAssessment.not_delivered.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Not Delivered
                    </h4>
                    <ul className="space-y-1">
                      {gapAssessment.not_delivered.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <X size={14} className="text-status-red mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gapAssessment.intentional_cuts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Intentional Cuts
                    </h4>
                    <ul className="space-y-1">
                      {gapAssessment.intentional_cuts.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <GitBranch size={14} className="text-text-muted mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {gapAssessment.recommended_followups.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                      Recommended Follow-ups
                    </h4>
                    <ul className="space-y-1">
                      {gapAssessment.recommended_followups.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <Lightbulb size={14} className="text-status-amber mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Empty content notice */}
          {!spec.done_when &&
            !hasScope &&
            spec.acceptance_criteria.length === 0 &&
            spec.constraints.length === 0 &&
            !hasRiskNotes &&
            !hasAssumptions &&
            !hasAmbiguities &&
            !hasAffectedSurfaces &&
            !designBrief &&
            voteRounds.length === 0 &&
            phaseReviews.length === 0 &&
            !gapAssessment && (
              <div className="text-center py-8">
                <User
                  size={40}
                  className="mx-auto text-text-muted mb-3"
                />
                <p className="text-sm text-text-muted">
                  This mission spec has no detailed content yet
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-surface rounded-lg p-4 border border-border-default">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-text-primary">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
