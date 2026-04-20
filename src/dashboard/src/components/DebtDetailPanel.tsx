import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import * as geas from "../lib/geasClient";
import type { DebtEntry } from "../types";
import { severityColors, severityOrder, debtStatusColors } from "../colors";
import DebtDetailModal from "./DebtDetailModal";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface DebtDetailPanelProps {
  projectPath: string;
  projectName: string;
  onBack: () => void;
}

type SeverityFilter = "critical" | "high" | "normal" | "low";
type StatusFilter = "all" | "open" | "resolved" | "dropped";

export default function DebtDetailPanel({
  projectPath,
  projectName,
  onBack,
}: DebtDetailPanelProps) {
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilters, setSeverityFilters] = useState<Set<SeverityFilter>>(
    new Set(),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [selectedDebt, setSelectedDebt] = useState<DebtEntry | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const debts = await geas.getDebts(projectPath);
      setEntries(debts?.entries ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function toggleSeverity(sev: SeverityFilter) {
    setSeverityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  const bySeverity = useMemo(() => {
    const counts = { low: 0, normal: 0, high: 0, critical: 0 };
    for (const e of entries) {
      if (e.status !== "open") continue;
      const s = e.severity as keyof typeof counts;
      if (s in counts) counts[s] += 1;
    }
    return counts;
  }, [entries]);

  const byKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (e.status !== "open") continue;
      if (!e.kind) continue;
      map[e.kind] = (map[e.kind] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  const filteredItems = useMemo(() => {
    let items = entries;
    if (severityFilters.size > 0) {
      items = items.filter((e) =>
        severityFilters.has(e.severity as SeverityFilter),
      );
    }
    if (statusFilter !== "all") {
      items = items.filter((e) => e.status === statusFilter);
    }
    return items;
  }, [entries, severityFilters, statusFilter]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
            <p className="text-status-red text-sm mb-2">Failed to load debts</p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <ShieldCheck size={40} />
            </div>
            <span className="text-text-muted text-sm">
              No debts registered yet
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-text-muted mr-1">Severity:</span>
              {severityOrder.map((sev) => {
                const active = severityFilters.has(sev);
                const colors = severityColors[sev] ?? severityColors.normal;
                const count = bySeverity[sev as keyof typeof bySeverity];
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

            {Object.keys(byKind).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-text-muted mr-1">Kind:</span>
                {Object.entries(byKind).map(([kind, count]) => (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-bg-elevated text-text-secondary"
                  >
                    {count} {kind.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-text-muted mr-1">Status:</span>
              {(["all", "open", "resolved", "dropped"] as StatusFilter[]).map(
                (s) => (
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
                ),
              )}
            </div>

            <p className="text-xs text-text-muted mb-3">
              {filteredItems.length} of {entries.length} items
            </p>

            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No items match the current filters
                </p>
              ) : (
                filteredItems.map((item) => (
                  <DebtItemCard
                    key={item.debt_id}
                    item={item}
                    onClick={() => setSelectedDebt(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          onClose={() => setSelectedDebt(null)}
        />
      )}
    </div>
  );
}

function DebtItemCard({
  item,
  onClick,
}: {
  item: DebtEntry;
  onClick?: () => void;
}) {
  const sevColors =
    severityColors[item.severity ?? ""] ?? severityColors.normal;
  const stColors = item.status
    ? debtStatusColors[item.status] ?? debtStatusColors.open
    : null;

  return (
    <div
      className="bg-bg-surface rounded-lg p-4 border border-border-default hover:-translate-y-px hover:shadow-md transition-all duration-150 cursor-pointer"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium shrink-0 mt-0.5"
          style={{ backgroundColor: sevColors.bg, color: sevColors.text }}
        >
          {item.severity ?? "unknown"}
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
        {item.title ?? "(untitled)"}
      </h3>

      {item.description && (
        <p className="text-xs text-text-secondary mb-2 leading-relaxed">
          {item.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
        <span>{item.debt_id}</span>
        {item.introduced_by?.task_id && (
          <span>from {item.introduced_by.task_id}</span>
        )}
        {item.introduced_by?.mission_id && (
          <span className="truncate max-w-[200px]">
            mission {item.introduced_by.mission_id}
          </span>
        )}
        {item.resolved_by?.task_id && (
          <span>resolved by {item.resolved_by.task_id}</span>
        )}
      </div>
    </div>
  );
}
