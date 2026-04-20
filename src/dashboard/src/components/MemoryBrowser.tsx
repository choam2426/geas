import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Brain, FileText } from "lucide-react";
import * as geas from "../lib/geasClient";
import type {
  AgentMemory,
  AgentMemoryChanges,
  MemoryUpdate,
  MissionSummary,
} from "../types";
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

      // Latest mission (for memory-update changelog)
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
          Memory
        </h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">
              Failed to load memory
            </p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : !shared && agents.length === 0 && !memoryUpdate ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Brain size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
            <span className="text-text-muted text-sm">No memory written yet</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="w-56 border-r border-border-default overflow-y-auto shrink-0">
            <TabButton
              label="shared"
              icon={<FileText size={12} />}
              active={active.kind === "shared"}
              onClick={() => setActive({ kind: "shared" })}
            />
            {agents.map((a) => (
              <TabButton
                key={tabKey({ kind: "agent", agent: a.agent_name })}
                label={a.agent_name.replace(/-/g, " ")}
                active={active.kind === "agent" && active.agent === a.agent_name}
                onClick={() => setActive({ kind: "agent", agent: a.agent_name })}
              />
            ))}
            {memoryUpdate && (
              <TabButton
                label={`changelog${latestMission ? " · latest" : ""}`}
                active={active.kind === "changelog"}
                onClick={() => setActive({ kind: "changelog" })}
              />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {active.kind === "shared" ? (
              <div className="max-w-3xl">
                <h2 className="text-sm font-semibold text-text-primary mb-4">
                  shared.md
                </h2>
                <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {shared || "Empty"}
                </div>
              </div>
            ) : active.kind === "agent" ? (
              (() => {
                const found = agents.find((a) => a.agent_name === active.agent);
                return (
                  <div className="max-w-3xl">
                    <h2 className="text-sm font-semibold text-text-primary mb-4">
                      {active.agent}.md
                    </h2>
                    <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {found?.content || "Empty"}
                    </div>
                  </div>
                );
              })()
            ) : memoryUpdate ? (
              <div className="max-w-3xl">
                <h2 className="text-sm font-semibold text-text-primary mb-1">
                  Memory changelog
                </h2>
                <p className="text-xs text-text-muted mb-4">
                  From mission{" "}
                  {latestMission?.mission_name ?? latestMission?.mission_id ?? "—"}
                </p>
                <MemoryChangeList
                  title="Shared memory"
                  added={memoryUpdate.shared?.added ?? []}
                  modified={memoryUpdate.shared?.modified ?? []}
                  removed={memoryUpdate.shared?.removed ?? []}
                />
                {memoryUpdate.agents.map((ac, i) => (
                  <AgentChanges key={i} changes={ac} />
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-2 ${
        active
          ? "bg-bg-elevated text-text-primary font-medium"
          : "text-text-secondary hover:bg-bg-elevated/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MemoryChangeList({
  title,
  added,
  modified,
  removed,
}: {
  title: string;
  added: { memory_id: string | null; reason: string | null; evidence_refs: string[] }[];
  modified: { memory_id: string | null; reason: string | null; evidence_refs: string[] }[];
  removed: { memory_id: string | null; reason: string | null }[];
}) {
  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return null;
  }
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
        {title}
      </h3>
      {added.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-status-green mb-1">Added</p>
          {added.map((e, i) => (
            <div
              key={i}
              className="bg-bg-elevated rounded p-2 mb-1 text-xs"
            >
              <p className="text-text-primary">{e.memory_id}</p>
              {e.reason && <p className="text-text-muted">{e.reason}</p>}
            </div>
          ))}
        </div>
      )}
      {modified.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-status-amber mb-1">Modified</p>
          {modified.map((e, i) => (
            <div
              key={i}
              className="bg-bg-elevated rounded p-2 mb-1 text-xs"
            >
              <p className="text-text-primary">{e.memory_id}</p>
              {e.reason && <p className="text-text-muted">{e.reason}</p>}
            </div>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-status-red mb-1">Removed</p>
          {removed.map((e, i) => (
            <div
              key={i}
              className="bg-bg-elevated rounded p-2 mb-1 text-xs"
            >
              <p className="text-text-primary">{e.memory_id}</p>
              {e.reason && <p className="text-text-muted">{e.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentChanges({ changes }: { changes: AgentMemoryChanges }) {
  return (
    <MemoryChangeList
      title={`Agent: ${changes.agent ?? "—"}`}
      added={changes.added}
      modified={changes.modified}
      removed={changes.removed}
    />
  );
}
