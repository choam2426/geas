/**
 * DebtDetailPanel — project-wide debt ledger.
 *
 * Layout: compact filter row at the top (severity + kind + status), then a
 * list of debt rows sorted by severity then by debt_id. Clicking a row opens
 * the existing DebtDetailModal for the full entry.
 *
 * Filter semantics:
 *   - severity chips multi-select (toggle each to include/exclude).
 *     Empty set = "any severity".
 *   - status is single-select; defaults to "open" so the panel opens on
 *     the actionable slice.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import * as geas from "../lib/geasClient";
import type { DebtEntry } from "../types";
import {
  debtStatusColors,
  lookupColor,
  severityColors,
  severityOrder,
} from "../colors";
import DebtDetailModal from "./DebtDetailModal";
import Pill from "./Pill";
import PathBadge from "./PathBadge";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface DebtDetailPanelProps {
  projectPath: string;
  projectName: string;
  onBack: () => void;
}

type SeverityFilter = "critical" | "high" | "normal" | "low";
type StatusFilter = "all" | "open" | "resolved" | "dropped";

const STATUS_TABS: StatusFilter[] = ["open", "resolved", "dropped", "all"];

const SEVERITY_SORT: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

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
  const [selected, setSelected] = useState<DebtEntry | null>(null);

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
    load();
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
    const counts: Record<string, number> = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0,
    };
    for (const e of entries) {
      if (e.status !== "open") continue;
      const s = e.severity ?? "";
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
    // Stable sort: severity rank → debt_id.
    return items.slice().sort((a, b) => {
      const rankA = SEVERITY_SORT[a.severity ?? ""] ?? 9;
      const rankB = SEVERITY_SORT[b.severity ?? ""] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return (a.debt_id ?? "").localeCompare(b.debt_id ?? "");
    });
  }, [entries, severityFilters, statusFilter]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="text-fg-muted hover:text-fg text-sm cursor-pointer transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          <span className="font-mono text-[12px]">back</span>
        </button>
        <div className="min-w-0">
          <h1 className="text-[14px] font-semibold text-fg truncate">
            {projectName} — tech debt
          </h1>
          <PathBadge path=".geas/debt.json" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-4xl space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-bg-1 px-4 py-3 border-l-2 border-border"
              >
                <div className="h-3 w-32 rounded bg-bg-2 animate-skeleton mb-2" />
                <div className="h-4 w-64 rounded bg-bg-2 animate-skeleton mb-2" />
                <div className="h-3 w-40 rounded bg-bg-2 animate-skeleton" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red text-sm mb-1">Failed to load debts</p>
            <p className="font-mono text-[11px] text-fg-dim">{error}</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <AlertTriangle size={32} />
            </div>
            <p className="text-sm text-fg-muted">no debts registered</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-4">
            {/* Status tabs */}
            <div className="flex items-center gap-0 mb-3 border-b border-border-muted">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={
                    "font-mono text-[12px] px-3 py-1.5 cursor-pointer transition-colors border-b-2 -mb-px " +
                    (statusFilter === s
                      ? "text-fg border-green"
                      : "text-fg-muted hover:text-fg border-transparent")
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Severity chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mr-1">
                severity
              </span>
              {severityOrder.map((sev) => {
                const active = severityFilters.has(sev);
                const colors = lookupColor(severityColors, sev);
                const count = bySeverity[sev] ?? 0;
                return (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={
                      "font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] cursor-pointer transition-all " +
                      (active ? "ring-1 ring-current" : "opacity-60 hover:opacity-100")
                    }
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {count} {sev}
                  </button>
                );
              })}
            </div>

            {/* Kind counts (informational, not a filter) */}
            {Object.keys(byKind).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mr-1">
                  kind
                </span>
                {Object.entries(byKind).map(([kind, count]) => (
                  <span
                    key={kind}
                    className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg-muted"
                  >
                    {count} {kind.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            <p className="font-mono text-[10px] text-fg-dim mb-3">
              {filteredItems.length} of {entries.length} items
            </p>

            {/* Rows */}
            <div className="flex flex-col divide-y divide-border-muted">
              {filteredItems.length === 0 ? (
                <p className="text-[12px] text-fg-muted py-6 text-center font-mono">
                  no items match the current filters
                </p>
              ) : (
                filteredItems.map((item) => (
                  <DebtRow
                    key={item.debt_id}
                    item={item}
                    onClick={() => setSelected(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <DebtDetailModal
          debt={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DebtRow({
  item,
  onClick,
}: {
  item: DebtEntry;
  onClick: () => void;
}) {
  const resolved = item.status !== "open";

  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-3 py-2.5 hover:bg-bg-1 transition-colors cursor-pointer " +
        (resolved ? "opacity-60" : "")
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Pill color={lookupColor(severityColors, item.severity)}>
              {item.severity ?? "—"}
            </Pill>
            {item.kind && (
              <span className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg-muted">
                {item.kind.replace(/_/g, " ")}
              </span>
            )}
            {item.status && (
              <Pill color={lookupColor(debtStatusColors, item.status)}>
                {item.status}
              </Pill>
            )}
            <span className="font-mono text-[10px] text-fg-dim ml-auto">
              {item.debt_id}
            </span>
          </div>
          <div className="text-[13px] text-fg truncate">
            {item.title ?? "(untitled)"}
          </div>
          {item.description && (
            <div className="text-[12px] text-fg-muted mt-1 line-clamp-2">
              {item.description}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-fg-dim flex-wrap">
            {item.introduced_by?.task_id && (
              <span>from {item.introduced_by.task_id}</span>
            )}
            {item.introduced_by?.mission_id && (
              <span className="truncate max-w-[280px]">
                mission {item.introduced_by.mission_id}
              </span>
            )}
            {item.resolved_by?.task_id && (
              <span>resolved by {item.resolved_by.task_id}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
