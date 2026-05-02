/**
 * MissionOverviewTab — operational summary for a mission.
 *
 * This is the default sub-tab. It exposes everything the user needs to answer
 * "what's happening right now?" without pivoting to another view:
 *   - Task roster (status groupings, click to open task modal)
 *   - Recent events (last 20, link to the full timeline tab)
 *   - Debts introduced by this mission (top 5, link to debt view)
 *   - Final verdict / phase reviews / gap signals
 *
 * The content is split into a left/right grid on wide screens; on narrow
 * viewports the right column stacks below the left.
 *
 * We deliberately do NOT synthesize an "active agents" panel: we only have
 * snapshot event data, no live agent-state signal, and pretending to show
 * realtime activity would be misleading.
 */

import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as geas from "../lib/geasClient";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";
import type {
  Debts,
  EventEntry,
  MissionDetail,
  TaskRow,
} from "../types";
import Pill from "./Pill";
import {
  debtStatusColors,
  lookupColor,
  severityColors,
  statusColors,
} from "../colors";

/**
 * `cli:auto` is the CLI's bookkeeping actor (envelope events written by the
 * CLI itself, not a human or agent). We keep the event visible — the `kind`
 * is informative — but suppress the actor label so it doesn't read as a
 * distinct identity in the UI, and we exclude it from the agent-activity
 * roll-up where "actor = agent identity" is the implied meaning.
 */
const HIDDEN_ACTORS = new Set(["cli:auto"]);

function displayActor(actor: string | null | undefined): string | null {
  if (!actor) return null;
  if (HIDDEN_ACTORS.has(actor)) return null;
  return actor;
}

interface Props {
  projectPath: string;
  missionId: string;
  detail: MissionDetail;
}

// Group tasks roughly by their lifecycle stage.
const STATUS_GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "active", label: "active", statuses: ["implementing", "reviewing"] },
  { key: "pending", label: "pending", statuses: ["drafted", "ready"] },
  { key: "deciding", label: "deciding", statuses: ["deciding"] },
  { key: "passed", label: "passed", statuses: ["passed"] },
  {
    key: "stuck",
    label: "stuck",
    statuses: ["blocked", "escalated", "cancelled"],
  },
];

function formatTsShort(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

export default function MissionOverviewTab({
  projectPath,
  missionId,
  detail,
}: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [debts, setDebts] = useState<Debts | null>(null);

  /**
   * Unified loader used by both the initial mount effect and the file-watch
   * refresh effect. Keeping a single function avoids divergence — earlier
   * an older split version refetched tasks + events on refresh but forgot
   * debts, so "debt introduced" counts went stale until the view was
   * remounted.
   */
  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    const [ts, ev, db] = await Promise.all([
      geas.listTasks(projectPath, missionId).catch(() => [] as TaskRow[]),
      geas
        .getEvents({
          path: projectPath,
          mission_id: missionId,
          page: 0,
          page_size: 20,
        })
        .catch(() => null),
      geas.getDebts(projectPath).catch(() => null),
    ]);
    if (signal?.cancelled) return;
    setTasks(ts);
    setEvents(ev?.events ?? []);
    setDebts(db);
  }, [projectPath, missionId]);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    load();
  }, [refreshKey, load]);

  const missionDebts =
    debts?.entries.filter((d) => d.introduced_by?.mission_id === missionId) ??
    [];

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-0 min-h-full">
        {/* LEFT column — tasks */}
        <div className="px-6 py-5 border-r border-border">
          <SectionHeader label="tasks" count={tasks.length} />
          {tasks.length === 0 ? (
            <p className="text-[12px] text-fg-dim font-mono">
              no tasks in this mission
            </p>
          ) : (
            <div className="space-y-4">
              {STATUS_GROUPS.map((g) => {
                const rows = tasks.filter((t) =>
                  g.statuses.includes(t.status ?? ""),
                );
                if (rows.length === 0) return null;
                return (
                  <div key={g.key}>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1.5">
                      {g.label} ({rows.length})
                    </div>
                    <div className="flex flex-col divide-y divide-border-muted">
                      {rows.map((t) => (
                        <TaskRowLine key={t.task_id} task={t} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Any unknown statuses */}
              {renderOrphanStatuses(tasks)}
            </div>
          )}

          {/* Final verdict */}
          {detail.verdicts &&
            detail.verdicts.verdicts.length > 0 &&
            (() => {
              const v =
                detail.verdicts!.verdicts[detail.verdicts!.verdicts.length - 1];
              return (
                <div className="mt-8">
                  <SectionHeader label="final verdict" />
                  <div className="bg-bg-1 border-l-2 border-border px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={
                          "font-mono text-[12px] " +
                          verdictClass(v.verdict)
                        }
                      >
                        {v.verdict ?? "—"}
                      </span>
                      <span className="font-mono text-[10px] text-fg-dim">
                        {formatTsShort(v.created_at)}
                      </span>
                    </div>
                    {v.rationale && (
                      <div className="design-markdown text-[12px] mt-1">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {v.rationale}
                        </Markdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Phase reviews */}
          {detail.phase_reviews &&
            detail.phase_reviews.reviews.length > 0 && (
              <div className="mt-8">
                <SectionHeader
                  label="phase reviews"
                  count={detail.phase_reviews.reviews.length}
                />
                <div className="flex flex-col divide-y divide-border-muted">
                  {detail.phase_reviews.reviews
                    .slice()
                    .reverse()
                    .map((r, i) => (
                      <div
                        key={i}
                        className="py-2 font-mono text-[11px] flex items-center gap-3"
                      >
                        <span className="text-fg-dim">
                          {formatTsShort(r.created_at)}
                        </span>
                        <span className="text-fg">
                          {r.mission_phase ?? "—"}
                          {r.next_phase && (
                            <span className="text-fg-dim"> → {r.next_phase}</span>
                          )}
                        </span>
                        <span className={verdictClass(r.status)}>
                          {r.status ?? "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

          {/* Gap */}
          {detail.gap && <GapSummary gap={detail.gap} />}
        </div>

        {/* RIGHT column — activity / debt / memory */}
        <div className="px-6 py-5 space-y-6">
          {/* Recent events */}
          <div>
            <SectionHeader
              label="recent events"
              count={events.length}
            />
            {events.length === 0 ? (
              <p className="text-[12px] text-fg-dim font-mono">
                no events yet
              </p>
            ) : (
              <ul className="font-mono text-[11px] space-y-1">
                {events.slice(0, 10).map((e, i) => {
                  const actor = displayActor(e.actor);
                  return (
                    <li
                      key={e.event_id ?? i}
                      className="flex items-start gap-2 py-0.5"
                    >
                      <span className="text-fg-dim flex-shrink-0 w-14">
                        {formatTsShort(e.created_at)}
                      </span>
                      {actor && (
                        <span className="text-green flex-shrink-0">
                          {actor}
                        </span>
                      )}
                      <span className="text-fg-muted truncate">
                        {e.kind ?? "event"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Mission debts */}
          <div>
            <SectionHeader
              label="debt introduced"
              count={missionDebts.length}
            />
            {missionDebts.length === 0 ? (
              <p className="text-[12px] text-fg-dim font-mono">none</p>
            ) : (
              <ul className="space-y-2">
                {missionDebts.slice(0, 5).map((d) => (
                  <li
                    key={d.debt_id ?? d.title ?? ""}
                    className="text-[12px]"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Pill color={lookupColor(severityColors, d.severity)}>
                        {d.severity ?? "—"}
                      </Pill>
                      <Pill color={lookupColor(debtStatusColors, d.status)}>
                        {d.status ?? "—"}
                      </Pill>
                    </div>
                    <div className="text-fg truncate">{d.title ?? "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Memory promotions */}
          {detail.memory_update && (
            <div>
              <SectionHeader label="memory update" />
              <p className="font-mono text-[11px] text-fg-dim">
                shared +
                {detail.memory_update.shared
                  ? detail.memory_update.shared.added.length
                  : 0}{" "}
                · agents {detail.memory_update.agents.length}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-dim">
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
      {count !== undefined && (
        <span className="font-mono text-[11px] text-fg-dim">{count}</span>
      )}
    </div>
  );
}

function TaskRowLine({ task }: { task: TaskRow }) {
  return (
    <div className="py-1.5 flex items-center gap-3 text-[12px]">
      <span className="font-mono text-fg-dim w-20 flex-shrink-0 truncate">
        {task.task_id}
      </span>
      <Pill color={lookupColor(statusColors, task.status)}>
        {task.status ?? "—"}
      </Pill>
      <span className="text-fg truncate flex-1">
        {task.title || task.goal || "(untitled)"}
      </span>
      {task.active_agent && (
        <span className="font-mono text-[10px] text-green flex-shrink-0">
          {task.active_agent}
        </span>
      )}
    </div>
  );
}

function renderOrphanStatuses(tasks: TaskRow[]) {
  const known = new Set(STATUS_GROUPS.flatMap((g) => g.statuses));
  const orphans = tasks.filter((t) => !known.has(t.status ?? ""));
  if (orphans.length === 0) return null;
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-1.5">
        other ({orphans.length})
      </div>
      <div className="flex flex-col divide-y divide-border-muted">
        {orphans.map((t) => (
          <TaskRowLine key={t.task_id} task={t} />
        ))}
      </div>
    </div>
  );
}

function GapSummary({ gap }: { gap: NonNullable<MissionDetail["gap"]> }) {
  const blocks: { label: string; items: string[]; color: string }[] = [
    {
      label: "fully delivered",
      items: gap.fully_delivered,
      color: "text-green",
    },
    {
      label: "partially delivered",
      items: gap.partially_delivered,
      color: "text-amber",
    },
    { label: "not delivered", items: gap.not_delivered, color: "text-red" },
    {
      label: "unexpected",
      items: gap.unexpected_additions,
      color: "text-cyan",
    },
  ].filter((b) => b.items.length > 0);

  if (blocks.length === 0) return null;

  return (
    <div className="mt-8">
      <SectionHeader label="gap" />
      <div className="flex flex-col gap-3">
        {blocks.map((b) => (
          <div key={b.label}>
            <div
              className={
                "font-mono text-[10px] uppercase tracking-widest mb-1 " + b.color
              }
            >
              {b.label} ({b.items.length})
            </div>
            <ul className="list-none text-[12px] text-fg-muted pl-3 space-y-0.5">
              {b.items.map((it, i) => (
                <li key={i} className="before:content-['—'] before:mr-2 before:text-fg-dim">
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Helpers ------------------------------------------------------------------

function verdictClass(v: string | null | undefined): string {
  switch (v) {
    case "passed":
    case "approved":
    case "pass":
      return "text-green";
    case "changes_requested":
      return "text-amber";
    case "blocked":
    case "escalated":
    case "cancelled":
    case "fail":
      return "text-red";
    default:
      return "text-fg-muted";
  }
}
