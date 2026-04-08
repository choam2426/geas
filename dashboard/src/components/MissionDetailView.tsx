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
} from "lucide-react";
import type { MissionSpecDetail } from "../types";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSpec = useCallback(async () => {
    try {
      const result = await invoke<MissionSpecDetail>("get_mission_spec", {
        path: projectPath,
        mission_id: missionId,
      });
      setSpec(result);
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

          {/* Empty content notice */}
          {!spec.done_when &&
            !hasScope &&
            spec.acceptance_criteria.length === 0 &&
            spec.constraints.length === 0 &&
            !hasRiskNotes &&
            !hasAssumptions && (
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
