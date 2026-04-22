import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";
import * as geas from "../lib/geasClient";
import type { EventsPage, EventEntry } from "../types";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface TimelineViewProps {
  projectPath: string;
  missionId?: string | null;
  onBack?: () => void;
  /** Hides the internal header when hosted by a parent shell. */
  embedded?: boolean;
}

const PAGE_SIZE = 50;

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  try {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return ts;
  }
}

function actorClass(actor: string | null | undefined): string {
  if (!actor) return "bg-bg-elevated text-text-secondary";
  if (actor === "cli:auto") return "bg-purple-400/20 text-purple-400";
  if (actor === "user") return "bg-status-blue/20 text-status-blue";
  if (actor === "orchestrator") return "bg-status-amber/20 text-status-amber";
  if (actor === "decision-maker") return "bg-status-green/20 text-status-green";
  return "bg-bg-elevated text-text-secondary";
}

export default function TimelineView({
  projectPath,
  missionId,
  onBack,
  embedded = false,
}: TimelineViewProps) {
  const [data, setData] = useState<EventsPage | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const result = await geas.getEvents({
          path: projectPath,
          mission_id: missionId ?? null,
          page: p,
          page_size: PAGE_SIZE,
        });
        setData(result);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setData({
          events: [],
          total_count: 0,
          page: p,
          page_size: PAGE_SIZE,
        });
      } finally {
        setLoading(false);
      }
    },
    [projectPath, missionId],
  );

  useEffect(() => {
    fetchEvents(0);
    setPage(0);
  }, [fetchEvents]);

  const pageRef = useRef(page);
  pageRef.current = page;
  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    fetchEvents(pageRef.current);
  }, [refreshKey, fetchEvents]);

  const totalPages = data ? Math.ceil(data.total_count / PAGE_SIZE) : 0;

  function handlePrev() {
    if (page > 0) {
      const newPage = page - 1;
      setPage(newPage);
      fetchEvents(newPage);
    }
  }

  function handleNext() {
    if (page < totalPages - 1) {
      const newPage = page + 1;
      setPage(newPage);
      fetchEvents(newPage);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {!embedded && (
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-bg-2 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="text-fg-muted" />
          </button>
        )}
        <Clock size={20} className="text-green" />
        <h1 className="text-lg font-semibold text-fg">
          {missionId ? `Events — ${missionId}` : "Project events"}
        </h1>
        {data && (
          <span className="text-xs text-fg-muted ml-auto">
            {data.total_count} events
          </span>
        )}
      </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading && !data ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-bg-elevated mt-2 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-bg-elevated rounded w-24" />
                  <div className="h-4 bg-bg-elevated rounded w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.events.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto text-text-muted mb-4" />
            <p className="text-text-secondary text-sm">No events found</p>
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl">
            {data.events.map((event, i) => (
              <EventRow
                key={`${event.event_id ?? event.created_at}-${i}`}
                event={event}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-border-default shrink-0">
          <button
            onClick={handlePrev}
            disabled={page === 0}
            className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-text-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: EventEntry }) {
  const payload = event.payload ?? {};
  const taskId = typeof payload["task_id"] === "string" ? (payload["task_id"] as string) : null;
  const missionId =
    typeof payload["mission_id"] === "string" ? (payload["mission_id"] as string) : null;
  const summary =
    typeof payload["summary"] === "string"
      ? (payload["summary"] as string)
      : typeof payload["message"] === "string"
        ? (payload["message"] as string)
        : null;

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-bg-elevated/50 transition-colors group">
      <div className="w-2 h-2 rounded-full bg-border-default mt-2 shrink-0 group-hover:bg-accent transition-colors" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-bg-elevated text-text-secondary">
            {event.kind ?? "(unknown)"}
          </span>
          {event.actor && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${actorClass(event.actor)}`}
            >
              {event.actor === "cli:auto" && <Bot size={10} />}
              {event.actor}
            </span>
          )}
          {taskId && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-bg-elevated text-text-secondary">
              {taskId}
            </span>
          )}
          {missionId && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-bg-elevated/50 text-text-muted truncate max-w-[200px]">
              {missionId}
            </span>
          )}
        </div>
        {summary && (
          <p className="text-sm text-text-secondary mt-0.5">{summary}</p>
        )}
        {event.event_id && (
          <p className="text-[10px] text-text-muted mt-0.5">{event.event_id}</p>
        )}
      </div>
      <span className="text-xs text-text-muted shrink-0 mt-0.5">
        {formatTimestamp(event.created_at)}
      </span>
    </div>
  );
}
