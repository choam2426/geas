import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Brain } from "lucide-react";
import { useProjectRefresh } from "../contexts/ProjectRefreshContext";
import type { AgentMemory } from "../types";

interface MemoryBrowserProps {
  projectPath: string;
  onBack: () => void;
}

export default function MemoryBrowser({ projectPath, onBack }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<AgentMemory[]>("get_project_memories", { path: projectPath });
      setMemories(result);
      if (result.length > 0 && !selectedAgent) {
        setSelectedAgent(result[0].agent_name);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  // Auto-refresh: react to centralized project-changed events
  const refreshKey = useProjectRefresh(projectPath);
  useEffect(() => {
    if (refreshKey === 0) return;
    loadMemories();
  }, [refreshKey, loadMemories]);

  const selected = memories.find(m => m.agent_name === selectedAgent);

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
          Agent Memory
        </h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-status-red text-sm mb-2">Failed to load memories</p>
            <p className="text-text-muted text-xs">{error}</p>
          </div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Brain size={40} className="mx-auto text-text-muted mb-3 opacity-30" />
            <span className="text-text-muted text-sm">No agent memory files found</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Agent list */}
          <div className="w-48 border-r border-border-default overflow-y-auto shrink-0">
            {memories.map(m => (
              <button
                key={m.agent_name}
                onClick={() => setSelectedAgent(m.agent_name)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  selectedAgent === m.agent_name
                    ? "bg-bg-elevated text-text-primary font-medium"
                    : "text-text-secondary hover:bg-bg-elevated/50"
                }`}
              >
                {m.agent_name.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="max-w-3xl">
                <h2 className="text-sm font-semibold text-text-primary mb-4">
                  {selected.agent_name}
                </h2>
                <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {selected.content || "Empty"}
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm">Select an agent</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
