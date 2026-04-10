import { useState } from "react";
import type { DebtInfo, DebtItem } from "../types";
import { severityColors, severityOrder } from "../colors";
import DebtBadge from "./DebtBadge";
import DebtDetailModal from "./DebtDetailModal";

interface DebtPanelProps {
  debt: DebtInfo;
}

export default function DebtPanel({ debt }: DebtPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  if (debt.total === 0) {
    return (
      <div className="bg-bg-surface rounded-lg p-4 mt-4">
        <span className="text-sm text-text-muted">No debt recorded</span>
      </div>
    );
  }

  const visibleItems = expanded ? debt.items : debt.items.slice(0, 5);

  return (
    <div className="bg-bg-surface rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">Tech Debt</span>
        <span className="text-xs text-text-muted">{debt.total} total</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {severityOrder.map((sev) => (
          <DebtBadge key={sev} severity={sev} count={debt.by_severity[sev]} />
        ))}
      </div>

      <div className="space-y-1.5">
        {visibleItems.map((item) => {
          const colors = severityColors[item.severity] ?? severityColors.normal;
          return (
            <div
              key={item.debt_id}
              className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-bg-elevated/50 rounded px-1 -mx-1 transition-colors"
              onClick={() => setSelectedDebt(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDebt(item); } }}
            >
              <span
                className="inline-flex items-center rounded-full px-1.5 py-0.5 font-medium shrink-0"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {item.severity}
              </span>
              <span className="text-text-secondary truncate">{item.title}</span>
              {item.kind && (
                <span className="text-text-muted shrink-0">{item.kind}</span>
              )}
            </div>
          );
        })}
      </div>

      {debt.items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-accent hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : `Show ${debt.items.length - 5} more`}
        </button>
      )}

      {selectedDebt && (
        <DebtDetailModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} />
      )}
    </div>
  );
}
