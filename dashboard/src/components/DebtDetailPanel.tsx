import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { DebtInfo, DebtItem } from "../types";
import { severityColors, severityOrder, debtStatusColors } from "../colors";
import DebtDetailModal from "./DebtDetailModal";

interface DebtDetailPanelProps {
  projectPath: string;
  projectName: string;
  missionId?: string | null;
  onBack: () => void;
}

type SeverityFilter = "critical" | "high" | "normal" | "low";
type StatusFilter = "all" | "open" | "resolved";

export default function DebtDetailPanel({
  projectPath,
  projectName,
  missionId,
  onBack,
}: DebtDetailPanelProps) {
  const [debt, setDebt] = useState<DebtInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilters, setSeverityFilters] = useState<Set<SeverityFilter>>(
    new Set()
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!missionId) {
          setDebt({ total: 0, by_severity: { low: 0, normal: 0, high: 0, critical: 0 }, by_kind: { output_quality: 0, verification_gap: 0, structural: 0, risk: 0, process: 0, documentation: 0, operations: 0 }, items: [] });
          setLoading(false);
          return;
        }
        const params = { path: projectPath, mission_id: missionId };
        const result = await invoke<DebtInfo>("get_project_debt", params);
        if (!cancelled) {
          setDebt(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectPath, missionId]);

  function toggleSeverity(sev: SeverityFilter) {
    setSeverityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) {
        next.delete(sev);
      } else {
        next.add(sev);
      }
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    if (!debt) return [];
    let items = debt.items;

    // Severity filter: if any selected, filter to those; if none, show all
    if (severityFilters.size > 0) {
      items = items.filter((item) =>
        severityFilters.has(item.severity as SeverityFilter)
      );
    }

    // Status filter
    if (statusFilter === "open") {
      items = items.filter(
        (item) => !item.status || item.status === "open" || item.status === "accepted"
      );
    } else if (statusFilter === "resolved") {
      items = items.filter(
        (item) => item.status === "resolved" || item.status === "mitigated"
      );
    }

    return items;
  }, [debt, severityFilters, statusFilter]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary text-sm cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} className="inline" /> Back
        </button>
        <h1 className="text-base md:text-lg font-semibold text-text-primary truncate">
          {projectName} — Tech Debt
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 w-20 rounded-full bg-bg-elevated animate-skeleton"
                />
              ))}
            </div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-bg-surface rounded-lg p-4 border border-border-default mb-3"
              >
                <div className="h-4 w-48 rounded bg-bg-elevated animate-skeleton mb-2" />
                <div className="h-3 w-64 rounded bg-bg-elevated animate-skeleton" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load debt data
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : !debt || debt.total === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <ShieldCheck size={40} />
            </div>
            <span className="text-text-muted text-sm">No debt items -- looking clean</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl">
            {/* Severity filter pills */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-text-muted mr-1">Severity:</span>
              {severityOrder.map((sev) => {
                const active = severityFilters.has(sev);
                const colors = severityColors[sev] ?? severityColors.normal;
                const count = debt.by_severity[sev];
                return (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-all duration-150 ${
                      active
                        ? "ring-1 ring-current"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {count} {sev}
                  </button>
                );
              })}
            </div>

            {/* Kind breakdown */}
            {debt.by_kind && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-text-muted mr-1">Kind:</span>
                {Object.entries(debt.by_kind)
                  .filter(([, count]) => (count as number) > 0)
                  .map(([kind, count]) => (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-bg-elevated text-text-secondary"
                    >
                      {(count as number)} {kind.replace(/_/g, " ")}
                    </span>
                  ))}
              </div>
            )}

            {/* Status filter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-text-muted mr-1">Status:</span>
              {(["all", "open", "resolved"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all duration-150 capitalize ${
                    statusFilter === s
                      ? "bg-bg-elevated text-text-primary font-medium"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Item count */}
            <p className="text-xs text-text-muted mb-3">
              {filteredItems.length} of {debt.items.length} items
            </p>

            {/* Item list */}
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No items match the current filters
                </p>
              ) : (
                filteredItems.map((item) => (
                  <DebtItemCard key={item.debt_id} item={item} onClick={() => setSelectedDebt(item)} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDebt && (
        <DebtDetailModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} />
      )}
    </div>
  );
}

function DebtItemCard({ item, onClick }: { item: DebtItem; onClick?: () => void }) {
  const sevColors = severityColors[item.severity] ?? severityColors.normal;
  const stColors = item.status
    ? debtStatusColors[item.status] ?? debtStatusColors.open
    : null;

  return (
    <div
      className="bg-bg-surface rounded-lg p-4 border border-border-default hover:-translate-y-px hover:shadow-md transition-all duration-150 cursor-pointer"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium shrink-0 mt-0.5"
          style={{ backgroundColor: sevColors.bg, color: sevColors.text }}
        >
          {item.severity}
        </span>
        {item.kind && (
          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium shrink-0 mt-0.5 bg-bg-elevated text-text-muted">
            {item.kind}
          </span>
        )}
        {stColors && item.status && (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium shrink-0 mt-0.5"
            style={{ backgroundColor: stColors.bg, color: stColors.text }}
          >
            {item.status}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-text-primary mb-1">
        {item.title}
      </h3>

      {item.description && (
        <p className="text-xs text-text-secondary mb-2 leading-relaxed">
          {item.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        <span>{item.debt_id}</span>
        {item.introduced_by_task_id && (
          <span>from {item.introduced_by_task_id}</span>
        )}
      </div>
    </div>
  );
}
