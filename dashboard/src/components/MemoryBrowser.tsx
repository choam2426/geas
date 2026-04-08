import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Brain, X } from "lucide-react";
import type { MemorySummary, MemoryDetail } from "../types";
import { memoryTypeColors, memoryStateColors } from "../colors";

interface MemoryBrowserProps {
  projectPath: string;
  onBack: () => void;
}

const MEMORY_TYPES = [
  "project_rule",
  "agent_rule",
  "decision_precedent",
  "failure_lesson",
  "security_pattern",
  "performance_tip",
  "test_strategy",
  "integration_pattern",
  "ux_pattern",
  "architecture_precedent",
  "process_improvement",
  "risk_pattern",
] as const;

const MEMORY_STATES = [
  "candidate",
  "provisional",
  "stable",
  "canonical",
  "under_review",
  "decayed",
  "superseded",
  "archived",
  "rejected",
] as const;

type SourceFilter = "all" | "entries" | "candidates";

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export default function MemoryBrowser({
  projectPath,
  onBack,
}: MemoryBrowserProps) {
  const [memories, setMemories] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selectedDetail, setSelectedDetail] = useState<MemoryDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<MemorySummary[]>("get_project_memories", {
        path: projectPath,
      });
      setMemories(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  // Auto-refresh when project files change (memory dir is now watched)
  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      if (event.payload.path === projectPath) {
        loadMemories();
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [projectPath, loadMemories]);

  const filteredMemories = useMemo(() => {
    let items = memories;

    if (typeFilter !== "all") {
      items = items.filter((m) => m.memory_type === typeFilter);
    }
    if (stateFilter !== "all") {
      items = items.filter((m) => m.state === stateFilter);
    }
    if (sourceFilter !== "all") {
      items = items.filter((m) => m.source_dir === sourceFilter);
    }

    return items;
  }, [memories, typeFilter, stateFilter, sourceFilter]);

  async function openDetail(memoryId: string) {
    setDetailLoading(true);
    try {
      const detail = await invoke<MemoryDetail>("get_memory_detail", {
        path: projectPath,
        memory_id: memoryId,
      });
      setSelectedDetail(detail);
    } catch (err) {
      console.error("Failed to load memory detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

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
          Memory Browser
        </h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-7 w-24 rounded-md bg-bg-elevated animate-skeleton"
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
              Failed to load memories
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 flex justify-center opacity-30">
              <Brain size={40} />
            </div>
            <span className="text-text-muted text-sm">No memories found</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-3xl">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Type filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-bg-elevated text-text-primary text-xs rounded-md px-2 py-1 border border-border-default cursor-pointer"
                >
                  <option value="all">All types</option>
                  {MEMORY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatLabel(t)}
                    </option>
                  ))}
                </select>
              </div>

              {/* State filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">State:</span>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="bg-bg-elevated text-text-primary text-xs rounded-md px-2 py-1 border border-border-default cursor-pointer"
                >
                  <option value="all">All states</option>
                  {MEMORY_STATES.map((s) => (
                    <option key={s} value={s}>
                      {formatLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Source:</span>
                {(["all", "entries", "candidates"] as SourceFilter[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setSourceFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all duration-150 capitalize ${
                        sourceFilter === s
                          ? "bg-bg-elevated text-text-primary font-medium"
                          : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
                      }`}
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Result count */}
            <p className="text-xs text-text-muted mb-3">
              {filteredMemories.length} of {memories.length} memories
            </p>

            {/* Memory list */}
            <div className="space-y-2">
              {filteredMemories.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No memories match the current filters
                </p>
              ) : (
                filteredMemories.map((mem) => (
                  <MemoryCard
                    key={mem.memory_id}
                    memory={mem}
                    onClick={() => openDetail(mem.memory_id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {(selectedDetail || detailLoading) && (
        <MemoryDetailModal
          detail={selectedDetail}
          loading={detailLoading}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}

function MemoryCard({
  memory,
  onClick,
}: {
  memory: MemorySummary;
  onClick: () => void;
}) {
  const typeColors =
    memoryTypeColors[memory.memory_type] ?? memoryTypeColors.project_rule;
  const stateColors =
    memoryStateColors[memory.state] ?? memoryStateColors.candidate;

  return (
    <div
      className="bg-bg-surface rounded-lg p-4 border border-border-default hover:-translate-y-px hover:shadow-md transition-all duration-150 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: typeColors.bg, color: typeColors.text }}
        >
          {formatLabel(memory.memory_type)}
        </span>
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: stateColors.bg, color: stateColors.text }}
        >
          {formatLabel(memory.state)}
        </span>
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium bg-bg-elevated text-text-muted">
          {memory.scope}
        </span>
        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium bg-bg-elevated text-text-muted">
          {memory.source_dir}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-text-primary mb-1">
        {memory.title || memory.memory_id}
      </h3>

      {/* Summary */}
      {memory.summary && (
        <p className="text-xs text-text-secondary mb-2 leading-relaxed line-clamp-2">
          {memory.summary}
        </p>
      )}

      {/* Tags */}
      {memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {memory.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-bg-elevated text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryDetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: MemoryDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-surface rounded-lg border border-border-default shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default shrink-0">
          <h2 className="text-base font-semibold text-text-primary truncate">
            {loading ? "Loading..." : detail?.title || detail?.memory_id || "Memory Detail"}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary cursor-pointer transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-48 rounded bg-bg-elevated animate-skeleton" />
              <div className="h-3 w-full rounded bg-bg-elevated animate-skeleton" />
              <div className="h-3 w-3/4 rounded bg-bg-elevated animate-skeleton" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  colors={
                    memoryTypeColors[detail.memory_type] ??
                    memoryTypeColors.project_rule
                  }
                  label={formatLabel(detail.memory_type)}
                />
                <Badge
                  colors={
                    memoryStateColors[detail.state] ??
                    memoryStateColors.candidate
                  }
                  label={formatLabel(detail.state)}
                />
                <Badge
                  colors={{ bg: "rgba(139,148,158,0.15)", text: "#8b949e" }}
                  label={detail.scope}
                />
                <Badge
                  colors={{ bg: "rgba(139,148,158,0.15)", text: "#8b949e" }}
                  label={detail.source_dir}
                />
              </div>

              {/* Summary */}
              {detail.summary && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Summary
                  </h4>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {detail.summary}
                  </p>
                </div>
              )}

              {/* Body */}
              {detail.body.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Body
                  </h4>
                  <div className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                    {detail.body.join("\n")}
                  </div>
                </div>
              )}

              {/* Signals */}
              {detail.signals && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                    Signals
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-bg-elevated rounded-md p-3 text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {detail.signals.evidence_count}
                      </p>
                      <p className="text-[11px] text-text-muted">Evidence</p>
                    </div>
                    <div className="bg-bg-elevated rounded-md p-3 text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {detail.signals.reuse_count}
                      </p>
                      <p className="text-[11px] text-text-muted">Reuses</p>
                    </div>
                    <div className="bg-bg-elevated rounded-md p-3 text-center">
                      <p className="text-lg font-bold text-text-primary">
                        {Math.round(detail.signals.confidence * 100)}%
                      </p>
                      <p className="text-[11px] text-text-muted">Confidence</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {detail.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence refs */}
              {detail.evidence_refs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Evidence References
                  </h4>
                  <ul className="list-disc list-inside text-sm text-text-secondary space-y-0.5">
                    {detail.evidence_refs.map((ref, i) => (
                      <li key={i} className="break-all">
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supersedes / Superseded by */}
              {detail.supersedes.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Supersedes
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detail.supersedes.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-secondary"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detail.superseded_by && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Superseded By
                  </h4>
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-secondary">
                    {detail.superseded_by}
                  </span>
                </div>
              )}

              {/* Review after */}
              {detail.review_after && (
                <div>
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                    Review After
                  </h4>
                  <p className="text-sm text-text-primary">
                    {detail.review_after}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-[11px] text-text-muted pt-2 border-t border-border-default">
                <span>ID: {detail.memory_id}</span>
                {detail.created_at && (
                  <span>Created: {detail.created_at}</span>
                )}
                {detail.updated_at && (
                  <span>Updated: {detail.updated_at}</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Badge({
  colors,
  label,
}: {
  colors: { bg: string; text: string };
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}
