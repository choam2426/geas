import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, Code2, Palette, TestTube, Shield, Package, Settings } from "lucide-react";
import type { EventsPage, EventEntry } from "../types";

interface TimelineViewProps {
  projectPath: string;
  missionId?: string | null;
  onBack: () => void;
}

const AGENT_CONFIG: Record<string, { icon: typeof Code2; color: string; bg: string }> = {
  "software-engineer": { icon: Code2, color: "text-status-blue", bg: "bg-status-blue/15" },
  "design-authority": { icon: Palette, color: "text-purple-400", bg: "bg-purple-400/15" },
  "qa-engineer": { icon: TestTube, color: "text-status-green", bg: "bg-status-green/15" },
  "challenger": { icon: Shield, color: "text-status-red", bg: "bg-status-red/15" },
  "product-authority": { icon: Package, color: "text-status-amber", bg: "bg-status-amber/15" },
  "orchestration-authority": { icon: Settings, color: "text-text-muted", bg: "bg-text-muted/15" },
};

const EVENT_COLORS: Record<string, string> = {
  task_started: "bg-status-blue/20 text-status-blue",
  task_resolved: "bg-status-green/20 text-status-green",
  step_complete: "bg-bg-elevated text-text-secondary",
  gate_result: "bg-status-amber/20 text-status-amber",
  phase_complete: "bg-purple-400/20 text-purple-400",
  mission_started: "bg-status-blue/20 text-status-blue",
  task_compiled: "bg-bg-elevated text-text-secondary",
  implementation_contract: "bg-bg-elevated text-text-secondary",
  vote_round: "bg-status-amber/20 text-status-amber",
};

const PAGE_SIZE = 50;

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function AgentBadge({ agent }: { agent: string }) {
  const config = AGENT_CONFIG[agent] ?? { icon: Settings, color: "text-text-muted", bg: "bg-bg-elevated" };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bg} ${config.color}`}>
      <Icon size={12} />
      {agent}
    </span>
  );
}

export default function TimelineView({ projectPath, missionId, onBack }: TimelineViewProps) {
  const [data, setData] = useState<EventsPage | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await invoke<EventsPage>("get_mission_events", {
        path: projectPath,
        mission_id: missionId ?? null,
        event_type: null,
        page: p,
        page_size: PAGE_SIZE,
      });
      setData(result);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setData({ events: [], total_count: 0, page: p, page_size: PAGE_SIZE });
    } finally {
      setLoading(false);
    }
  }, [projectPath, missionId]);

  useEffect(() => {
    fetchEvents(0);
    setPage(0);
  }, [fetchEvents]);

  // Auto-refresh when project files change (ledger is now watched)
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      if (event.payload.path === projectPath) {
        fetchEvents(pageRef.current);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [projectPath, fetchEvents]);

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
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </button>
        <Clock size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">
          {missionId ? `Timeline — ${missionId}` : "Project Timeline"}
        </h1>
        {data && (
          <span className="text-xs text-text-muted ml-auto">{data.total_count} events</span>
        )}
      </div>

      {/* Timeline */}
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
              <EventRow key={`${event.timestamp}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
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
  const eventColor = EVENT_COLORS[event.event_type] ?? "bg-bg-elevated text-text-secondary";

  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-bg-elevated/50 transition-colors group">
      {/* Timeline dot */}
      <div className="w-2 h-2 rounded-full bg-border-default mt-2 shrink-0 group-hover:bg-accent transition-colors" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventColor}`}>
            {event.event_type}
          </span>
          {event.task_id && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-bg-elevated text-text-secondary">
              {event.task_id}
            </span>
          )}
          {event.agent && <AgentBadge agent={event.agent} />}
        </div>
        {event.message && (
          <p className="text-sm text-text-secondary mt-0.5">{event.message}</p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-text-muted shrink-0 mt-0.5">
        {formatTimestamp(event.timestamp)}
      </span>
    </div>
  );
}
