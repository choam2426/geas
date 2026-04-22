/**
 * MemoryBrowser — project-wide view of shared + per-agent memory files
 * plus the latest mission's memory changelog.
 *
 * Layout:
 *   - Narrow left rail lists available memory "channels" (shared, each agent,
 *     and an optional "changelog" entry tied to the latest mission).
 *   - Main area renders the selected channel's contents as prose with a
 *     `PathBadge` so the user sees which file they're looking at.
 *
 * We don't perform any indexing / full-text search here; the raw markdown is
 * shown as authored. If that ever changes, treat this as the entry point.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Brain } from "lucide-react";
import * as geas from "../lib/geasClient";
import type {
  AgentMemory,
  AgentMemoryChanges,
  MemoryUpdate,
  MissionSummary,
} from "../types";
import PathBadge from "./PathBadge";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";

interface MemoryBrowserProps {
  projectPath: string;
  onBack: () => void;
}

type TabKey =
  | { kind: "shared" }
  | { kind: "agent"; agent: string }
  | { kind: "changelog" };

function tabKey(t: TabKey): string {
  if (t.kind === "agent") return `agent:${t.agent}`;
  return t.kind;
}

export default function MemoryBrowser({
  projectPath,
  onBack,
}: MemoryBrowserProps) {
  const [shared, setShared] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentMemory[]>([]);
  const [memoryUpdate, setMemoryUpdate] = useState<MemoryUpdate | null>(null);
  const [latestMission, setLatestMission] = useState<MissionSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TabKey>({ kind: "shared" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sharedText, agentMemories, history] = await Promise.all([
        geas.getSharedMemory(projectPath),
        geas.listAgentMemories(projectPath),
        geas.getMissionHistory(projectPath).catch(() => [] as MissionSummary[]),
      ]);
      setShared(sharedText);
      setAgents(agentMemories);

      const latest = history.length > 0 ? history[0] : null;
      setLatestMission(latest);
      if (latest) {
        const mu = await geas
          .getMemoryUpdate(projectPath, latest.mission_id)
          .catch(() => null);
        setMemoryUpdate(mu);
      } else {
        setMemoryUpdate(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    load();
  }, [refreshKey, load]);

  const activePath =
    active.kind === "shared"
      ? ".geas/memory/shared.md"
      : active.kind === "agent"
        ? `.geas/memory/${active.agent}.md`
        : latestMission
          ? `.geas/missions/${latestMission.mission_id}/memory-update.json`
          : ".geas/memory/";

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
          <h1 className="text-[14px] font-semibold text-fg">memory</h1>
          <PathBadge path={activePath} />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-mono text-[11px] text-fg-dim">loading…</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red text-sm mb-1">Failed to load memory</p>
            <p className="font-mono text-[11px] text-fg-dim">{error}</p>
          </div>
        </div>
      ) : !shared && agents.length === 0 && !memoryUpdate ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Brain size={32} className="mx-auto text-fg-dim mb-2 opacity-30" />
            <span className="text-sm text-fg-muted">no memory written yet</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left rail */}
          <aside className="w-52 border-r border-border overflow-y-auto flex-shrink-0 py-2">
            <SectionLabel>shared</SectionLabel>
            <ChannelButton
              label="shared.md"
              active={active.kind === "shared"}
              onClick={() => setActive({ kind: "shared" })}
            />

            {agents.length > 0 && (
              <>
                <SectionLabel>per-agent</SectionLabel>
                {agents.map((a) => (
                  <ChannelButton
                    key={tabKey({ kind: "agent", agent: a.agent_name })}
                    label={`${a.agent_name}.md`}
                    active={
                      active.kind === "agent" && active.agent === a.agent_name
                    }
                    onClick={() =>
                      setActive({ kind: "agent", agent: a.agent_name })
                    }
                  />
                ))}
              </>
            )}

            {memoryUpdate && (
              <>
                <SectionLabel>changelog</SectionLabel>
                <ChannelButton
                  label="memory-update"
                  active={active.kind === "changelog"}
                  onClick={() => setActive({ kind: "changelog" })}
                />
              </>
            )}
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-5">
              {active.kind === "shared" ? (
                <ProsePanel
                  title="shared.md"
                  subtitle="common memory surfaced across all agents"
                  content={shared}
                />
              ) : active.kind === "agent" ? (
                (() => {
                  const found = agents.find(
                    (a) => a.agent_name === active.agent,
                  );
                  return (
                    <ProsePanel
                      title={`${active.agent}.md`}
                      subtitle="agent-local memory"
                      content={found?.content ?? null}
                    />
                  );
                })()
              ) : memoryUpdate ? (
                <div>
                  <h2 className="font-mono text-[13px] text-green mb-1">
                    memory-update.json
                  </h2>
                  <p className="font-mono text-[11px] text-fg-dim mb-5">
                    from mission{" "}
                    {latestMission?.mission_name ?? latestMission?.mission_id ?? "—"}
                  </p>
                  <MemoryChangeList
                    title="shared memory"
                    added={memoryUpdate.shared?.added ?? []}
                    modified={memoryUpdate.shared?.modified ?? []}
                    removed={memoryUpdate.shared?.removed ?? []}
                  />
                  {memoryUpdate.agents.map((ac, i) => (
                    <AgentChanges key={i} changes={ac} />
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[11px] text-fg-dim">no data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 font-mono text-[10px] uppercase tracking-widest text-fg-dim">
      {children}
    </div>
  );
}

function ChannelButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left px-3 py-1.5 font-mono text-[12px] transition-colors cursor-pointer border-l-2 " +
        (active
          ? "bg-bg-2 text-fg border-green"
          : "text-fg-muted hover:text-fg hover:bg-bg-1 border-transparent")
      }
    >
      {label}
    </button>
  );
}

function ProsePanel({
  title,
  subtitle,
  content,
}: {
  title: string;
  subtitle?: string;
  content: string | null;
}) {
  return (
    <>
      <h2 className="font-mono text-[13px] text-green mb-1">{title}</h2>
      {subtitle && (
        <p className="font-mono text-[11px] text-fg-dim mb-5">{subtitle}</p>
      )}
      <div className="text-[13px] text-fg whitespace-pre-wrap leading-relaxed">
        {content && content.trim().length > 0 ? (
          content
        ) : (
          <span className="text-fg-dim italic">empty</span>
        )}
      </div>
    </>
  );
}

function MemoryChangeList({
  title,
  added,
  modified,
  removed,
}: {
  title: string;
  added: {
    memory_id: string | null;
    reason: string | null;
    evidence_refs: string[];
  }[];
  modified: {
    memory_id: string | null;
    reason: string | null;
    evidence_refs: string[];
  }[];
  removed: { memory_id: string | null; reason: string | null }[];
}) {
  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return null;
  }
  return (
    <div className="mb-6">
      <div className="font-mono text-[11px] text-green mb-2 pb-1 border-b border-border-muted">
        {title}
      </div>
      <ChangeGroup label="added" items={added} cls="text-green" />
      <ChangeGroup label="modified" items={modified} cls="text-amber" />
      <ChangeGroup label="removed" items={removed} cls="text-red" />
    </div>
  );
}

function ChangeGroup({
  label,
  items,
  cls,
}: {
  label: string;
  items: { memory_id: string | null; reason: string | null }[];
  cls: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className={"font-mono text-[10px] uppercase tracking-widest mb-1 " + cls}>
        {label} ({items.length})
      </div>
      <div className="space-y-1">
        {items.map((e, i) => (
          <div key={i} className="bg-bg-1 px-2.5 py-1.5 rounded-[3px]">
            <div className="font-mono text-[11px] text-fg">
              {e.memory_id ?? "—"}
            </div>
            {e.reason && (
              <div className="text-[12px] text-fg-muted">{e.reason}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentChanges({ changes }: { changes: AgentMemoryChanges }) {
  return (
    <MemoryChangeList
      title={`agent · ${changes.agent ?? "—"}`}
      added={changes.added}
      modified={changes.modified}
      removed={changes.removed}
    />
  );
}
