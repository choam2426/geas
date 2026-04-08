import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProjectEntry, ProjectSummary } from "./types";
import Sidebar from "./components/Sidebar";
import ProjectDashboard from "./components/ProjectDashboard";
import KanbanBoard from "./components/KanbanBoard";
import MissionHistory from "./components/MissionHistory";
import DebtDetailPanel from "./components/DebtDetailPanel";
import EmptyState from "./components/EmptyState";
import ErrorState from "./components/ErrorState";
import AddProjectDialog from "./components/AddProjectDialog";
import { useNavigationHistory } from "./hooks/useNavigationHistory";

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const nav = useNavigationHistory();
  const navRef = useRef(nav);
  navRef.current = nav;
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

  // Auto-refresh: subscribe to file watcher events
  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", async (event) => {
      const changedPath = event.payload.path;
      try {
        const summary = await invoke<ProjectSummary>("get_project_summary", { path: changedPath });
        setProjects(prev => prev.map(p => p.path === changedPath ? summary : p));
      } catch {
        // Ignore errors from individual project refresh
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

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

  const selectedPath = nav.current.selectedPath;
  const view = nav.current.view;
  const selectedMissionId = nav.current.selectedMissionId;
  const selected = projects.find((p) => p.path === selectedPath) ?? null;

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

export default App;
