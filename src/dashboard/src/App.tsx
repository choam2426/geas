import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProjectEntry, ProjectSummary } from "./types";
import Sidebar from "./components/Sidebar";
import ProjectDashboard from "./components/ProjectDashboard";
import KanbanBoard from "./components/KanbanBoard";
import MissionHistory from "./components/MissionHistory";
import DebtDetailPanel from "./components/DebtDetailPanel";
import RulesViewer from "./components/RulesViewer";
import TimelineView from "./components/TimelineView";
import MissionDetailView from "./components/MissionDetailView";
import MemoryBrowser from "./components/MemoryBrowser";
import EmptyState from "./components/EmptyState";
import ErrorState from "./components/ErrorState";
import AddProjectDialog from "./components/AddProjectDialog";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ProjectRefreshProvider } from "./contexts/ProjectRefreshContext";
import { useNavigationHistory } from "./hooks/useNavigationHistory";
import type { ToastVariant } from "./components/Toast";

/** Normalize a path for cross-platform comparison:
 *  - Strip Windows extended-length prefix (\\?\)
 *  - Convert backslashes to forward slashes
 *  - Remove trailing slash */
function normalizePath(p: string): string {
  return p.replace(/^\\\\\?\\/, '').replace(/\\/g, '/').replace(/\/$/, '');
}

/** Map toast_type from backend to ToastContext variant */
const TOAST_VARIANT_MAP: Record<string, ToastVariant> = {
  task_started: "info",
  task_completed: "success",
  gate_pass: "success",
  gate_fail: "error",
  phase_changed: "info",
  mission_completed: "success",
};

/** Deduplication window in milliseconds */
const TOAST_DEDUP_WINDOW = 2000;

function AppInner() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const nav = useNavigationHistory();
  const navRef = useRef(nav);
  navRef.current = nav;
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      setBackendError(null);
      const entries = await invoke<ProjectEntry[]>("list_projects");
      const summaries = await Promise.all(
        entries.map((entry) =>
          invoke<ProjectSummary>("get_project_summary", {
            path: entry.path,
          }).catch(
            (): ProjectSummary => ({
              name: entry.name,
              path: entry.path,
              mission_name: null,
              phase: null,
              task_total: 0,
              task_completed: 0,
              debt_total: 0,
              debt_by_severity: { low: 0, normal: 0, high: 0, critical: 0 },
              last_activity: null,
              status: "error",
              current_task_id: null,
              agent_in_flight: null,
              pipeline_step: null,
              parallel_batch: null,
              completed_in_batch: [],
            })
          )
        )
      );
      setProjects(summaries);
      // Preserve selection if valid, else select first
      const currentPath = navRef.current.current.selectedPath;
      if (!currentPath || !summaries.some((s) => s.path === currentPath)) {
        const firstPath = summaries.length > 0 ? summaries[0].path : null;
        navRef.current.reset({ view: "dashboard", selectedPath: firstPath, selectedMissionId: null });
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setBackendError(String(err));
      setProjects([]);
      navRef.current.reset({ view: "dashboard", selectedPath: null, selectedMissionId: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectedPath = nav.current.selectedPath;
  const view = nav.current.view;
  const selectedMissionId = nav.current.selectedMissionId;
  const selected = projects.find((p) => p.path === selectedPath) ?? null;

  // Auto-refresh: subscribe directly to project-changed events so the sidebar
  // updates any project that changes, not just the selected one. We avoid
  // routing through useProjectRefresh here because the sidebar needs to react
  // to *all* projects, and staging through selectedPath meant background
  // projects' phase never refreshed.
  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      const eventNorm = normalizePath(event.payload.path);
      const matching = projectsRef.current.find(p => normalizePath(p.path) === eventNorm);
      if (!matching) return;
      (async () => {
        try {
          const summary = await invoke<ProjectSummary>("get_project_summary", { path: matching.path });
          setProjects(prev => prev.map(p => normalizePath(p.path) === eventNorm ? summary : p));
        } catch {
          // Ignore errors from individual project refresh
        }
      })();
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Toast notifications from backend event classification
  const { addToast } = useToast();
  const lastToastRef = useRef<{ key: string; ts: number }>({ key: "", ts: 0 });

  useEffect(() => {
    const unlisten = listen<{ toast_type: string; title: string; message: string }>(
      "geas://toast",
      (event) => {
        const { toast_type, title, message } = event.payload;
        const variant = TOAST_VARIANT_MAP[toast_type] ?? "info";

        // Deduplication: suppress if same toast_type+title within 2s
        const dedupKey = `${toast_type}:${title}`;
        const now = Date.now();
        if (
          lastToastRef.current.key === dedupKey &&
          now - lastToastRef.current.ts < TOAST_DEDUP_WINDOW
        ) {
          return;
        }
        lastToastRef.current = { key: dedupKey, ts: now };

        addToast({ variant, title, message });
      }
    );
    return () => { unlisten.then(fn => fn()); };
  }, [addToast]);

  function handleProjectAdded(_entry: ProjectEntry) {
    setShowAddDialog(false);
    loadProjects();
  }

  function handleRemoveProject(path: string) {
    setProjects((prev) => prev.filter((p) => p.path !== path));
    if (nav.current.selectedPath === path) {
      nav.reset({ view: "dashboard", selectedPath: null, selectedMissionId: null });
    }
  }

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary font-sans overflow-hidden">
      <Sidebar
        projects={projects}
        selectedPath={selectedPath}
        onSelect={(path) => { nav.reset({ view: "dashboard", selectedPath: path, selectedMissionId: null }); }}
        onViewHistory={selected ? () => nav.navigate({ ...nav.current, view: "history", selectedMissionId: null }) : undefined}
        onAddProject={() => setShowAddDialog(true)}
        onRemoveProject={handleRemoveProject}
        onRefresh={loadProjects}
        loading={loading}
      />

      <main className="flex flex-1 min-w-0 overflow-hidden">
        {backendError && !loading ? (
          <div className="flex flex-1 min-w-0 items-center justify-center animate-fade-in">
            <div className="text-center max-w-md">
              <p className="text-status-red text-lg font-semibold mb-2">Backend Error</p>
              <p className="text-text-secondary text-sm mb-4">{backendError}</p>
              <button onClick={loadProjects} className="px-4 py-1.5 rounded-md bg-status-blue text-white text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all">Retry</button>
            </div>
          </div>
        ) : projects.length === 0 && !loading ? (
          <EmptyState onAddProject={() => setShowAddDialog(true)} />
        ) : selected && (selected.status === "no_geas" || selected.status === "error") ? (
          <div key={`error-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <ErrorState
              status={selected.status}
              projectName={selected.name}
              projectPath={selected.path}
            />
          </div>
        ) : selected && view === "dashboard" ? (
          <div key={`dashboard-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <ProjectDashboard
              projectPath={selected.path}
              projectName={selected.name}
              onViewTasks={(missionId) => {
                nav.navigate({ ...nav.current, view: "kanban", selectedMissionId: missionId ?? null });
              }}
              onViewDebt={(missionId) => {
                nav.navigate({ ...nav.current, view: "debt", selectedMissionId: missionId ?? null });
              }}
              onViewKanban={(missionId) => {
                nav.navigate({ ...nav.current, view: "kanban", selectedMissionId: missionId });
              }}
              onViewMemory={() => {
                nav.navigate({ ...nav.current, view: "memory", selectedMissionId: null });
              }}
              onViewRules={() => {
                nav.navigate({ ...nav.current, view: "rules", selectedMissionId: null });
              }}
              onViewTimeline={() => {
                nav.navigate({ ...nav.current, view: "timeline", selectedMissionId: null });
              }}
              onViewDetail={(missionId) => {
                nav.navigate({ ...nav.current, view: "detail", selectedMissionId: missionId });
              }}
            />
          </div>
        ) : selected && view === "rules" ? (
          <div key={`rules-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <RulesViewer
              projectPath={selected.path}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected && view === "timeline" ? (
          <div key={`timeline-${selected.path}-${selectedMissionId ?? ""}`} className="flex flex-1 min-w-0 animate-fade-in">
            <TimelineView
              projectPath={selected.path}
              missionId={selectedMissionId}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected && view === "detail" && selectedMissionId ? (
          <div key={`detail-${selected.path}-${selectedMissionId}`} className="flex flex-1 min-w-0 animate-fade-in">
            <MissionDetailView
              projectPath={selected.path}
              missionId={selectedMissionId}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected && view === "kanban" ? (
          <div key={`kanban-${selected.path}-${selectedMissionId ?? ""}`} className="flex flex-1 min-w-0 animate-fade-in">
            <KanbanBoard
              projectPath={selected.path}
              projectName={selected.mission_name ?? selected.name}
              missionId={selectedMissionId}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
              currentTaskId={selected.current_task_id}
              agentInFlight={selected.agent_in_flight}
              pipelineStep={selected.pipeline_step}
              parallelBatch={selected.parallel_batch}
              completedInBatch={selected.completed_in_batch}
            />
          </div>
        ) : selected && view === "history" ? (
          <div key={`history-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <MissionHistory
              projectPath={selected.path}
              projectName={selected.name}
              onSelectMission={(missionId) => {
                nav.navigate({ ...nav.current, view: "kanban", selectedMissionId: missionId });
              }}
              onViewTimeline={(missionId) => {
                nav.navigate({ ...nav.current, view: "timeline", selectedMissionId: missionId });
              }}
              onViewDetail={(missionId) => {
                nav.navigate({ ...nav.current, view: "detail", selectedMissionId: missionId });
              }}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected && view === "debt" ? (
          <div key={`debt-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <DebtDetailPanel
              projectPath={selected.path}
              projectName={selected.mission_name ?? selected.name}
              missionId={selectedMissionId}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected && view === "memory" ? (
          <div key={`memory-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <MemoryBrowser
              projectPath={selected.path}
              onBack={() => {
                if (nav.canGoBack) {
                  nav.goBack();
                } else {
                  nav.navigate({ ...nav.current, view: "dashboard", selectedMissionId: null });
                }
              }}
            />
          </div>
        ) : selected ? (
          <div key={`dashboard-fallback-${selected.path}`} className="flex flex-1 min-w-0 animate-fade-in">
            <ProjectDashboard
              projectPath={selected.path}
              projectName={selected.name}
              onViewTasks={(missionId) => {
                nav.navigate({ ...nav.current, view: "kanban", selectedMissionId: missionId ?? null });
              }}
              onViewDebt={(missionId) => {
                nav.navigate({ ...nav.current, view: "debt", selectedMissionId: missionId ?? null });
              }}
              onViewKanban={(missionId) => {
                nav.navigate({ ...nav.current, view: "kanban", selectedMissionId: missionId });
              }}
              onViewMemory={() => {
                nav.navigate({ ...nav.current, view: "memory", selectedMissionId: null });
              }}
              onViewRules={() => {
                nav.navigate({ ...nav.current, view: "rules", selectedMissionId: null });
              }}
              onViewTimeline={() => {
                nav.navigate({ ...nav.current, view: "timeline", selectedMissionId: null });
              }}
              onViewDetail={(missionId) => {
                nav.navigate({ ...nav.current, view: "detail", selectedMissionId: missionId });
              }}
            />
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-text-muted text-sm">Loading...</span>
          </div>
        ) : null}
      </main>

      {showAddDialog && (
        <AddProjectDialog
          onClose={() => setShowAddDialog(false)}
          onAdded={handleProjectAdded}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <ProjectRefreshProvider>
        <AppInner />
      </ProjectRefreshProvider>
    </ToastProvider>
  );
}

export default App;
