import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ProjectEntry, ProjectSummary } from "./types";
import * as geas from "./lib/geasClient";
import Sidebar from "./components/Sidebar";
import ProjectDashboard from "./components/ProjectDashboard";
import KanbanBoard from "./components/KanbanBoard";
import MissionHistory from "./components/MissionHistory";
import DebtDetailPanel from "./components/DebtDetailPanel";
import TimelineView from "./components/TimelineView";
import MissionDetailView from "./components/MissionDetailView";
import MemoryBrowser from "./components/MemoryBrowser";
import EmptyState from "./components/EmptyState";
import ErrorState from "./components/ErrorState";
import AddProjectDialog from "./components/AddProjectDialog";
import { ToastProvider } from "./contexts/ToastContext";
import { ProjectRefreshProvider } from "./contexts/ProjectRefreshContext";
import { useNavigationHistory } from "./hooks/useNavigationHistory";

/** Normalize a path for cross-platform comparison. */
function normalizePath(p: string): string {
  return p.replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/$/, "");
}

function emptyProjectSummary(entry: ProjectEntry): ProjectSummary {
  return {
    name: entry.name,
    path: entry.path,
    mission_id: null,
    mission_name: null,
    phase: null,
    task_total: 0,
    task_completed: 0,
    active_tasks: [],
    debt_total: 0,
    debt_by_severity: { low: 0, normal: 0, high: 0, critical: 0 },
    last_activity: null,
    status: "error",
  };
}

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
      const entries = await geas.listProjects();
      const summaries = await Promise.all(
        entries.map((entry) =>
          geas
            .getProjectSummary(entry.path)
            .catch(() => emptyProjectSummary(entry)),
        ),
      );
      setProjects(summaries);
      const currentPath = navRef.current.current.selectedPath;
      if (!currentPath || !summaries.some((s) => s.path === currentPath)) {
        const firstPath = summaries.length > 0 ? summaries[0].path : null;
        navRef.current.reset({
          view: "dashboard",
          selectedPath: firstPath,
          selectedMissionId: null,
        });
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setBackendError(String(err));
      setProjects([]);
      navRef.current.reset({
        view: "dashboard",
        selectedPath: null,
        selectedMissionId: null,
      });
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

  // Auto-refresh: subscribe to project-changed events from the file watcher.
  useEffect(() => {
    const unlisten = listen<{ path: string }>(
      "geas://project-changed",
      (event) => {
        const eventNorm = normalizePath(event.payload.path);
        const matching = projectsRef.current.find(
          (p) => normalizePath(p.path) === eventNorm,
        );
        if (!matching) return;
        (async () => {
          try {
            const summary = await geas.getProjectSummary(matching.path);
            setProjects((prev) =>
              prev.map((p) =>
                normalizePath(p.path) === eventNorm ? summary : p,
              ),
            );
          } catch {
            // Silently ignore per-project refresh errors.
          }
        })();
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function handleProjectAdded(_entry: ProjectEntry) {
    setShowAddDialog(false);
    loadProjects();
  }

  function handleRemoveProject(path: string) {
    setProjects((prev) => prev.filter((p) => p.path !== path));
    if (nav.current.selectedPath === path) {
      nav.reset({
        view: "dashboard",
        selectedPath: null,
        selectedMissionId: null,
      });
    }
  }

  const back = () => {
    if (nav.canGoBack) nav.goBack();
    else
      nav.navigate({
        ...nav.current,
        view: "dashboard",
        selectedMissionId: null,
      });
  };

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary font-sans overflow-hidden">
      <Sidebar
        projects={projects}
        selectedPath={selectedPath}
        onSelect={(path) => {
          nav.reset({
            view: "dashboard",
            selectedPath: path,
            selectedMissionId: null,
          });
        }}
        onViewHistory={
          selected
            ? () =>
                nav.navigate({
                  ...nav.current,
                  view: "history",
                  selectedMissionId: null,
                })
            : undefined
        }
        onAddProject={() => setShowAddDialog(true)}
        onRemoveProject={handleRemoveProject}
        onRefresh={loadProjects}
        loading={loading}
      />

      <main className="flex flex-1 min-w-0 overflow-hidden">
        {backendError && !loading ? (
          <div className="flex flex-1 min-w-0 items-center justify-center animate-fade-in">
            <div className="text-center max-w-md">
              <p className="text-status-red text-lg font-semibold mb-2">
                Backend Error
              </p>
              <p className="text-text-secondary text-sm mb-4">{backendError}</p>
              <button
                onClick={loadProjects}
                className="px-4 py-1.5 rounded-md bg-status-blue text-white text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        ) : projects.length === 0 && !loading ? (
          <EmptyState onAddProject={() => setShowAddDialog(true)} />
        ) : selected && (selected.status === "no_geas" || selected.status === "error") ? (
          <div
            key={`error-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <ErrorState
              status={selected.status}
              projectName={selected.name}
              projectPath={selected.path}
            />
          </div>
        ) : selected && view === "dashboard" ? (
          <div
            key={`dashboard-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <ProjectDashboard
              projectPath={selected.path}
              projectName={selected.name}
              onViewTasks={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "kanban",
                  selectedMissionId: missionId ?? null,
                })
              }
              onViewDebt={() =>
                nav.navigate({
                  ...nav.current,
                  view: "debt",
                  selectedMissionId: null,
                })
              }
              onViewKanban={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "kanban",
                  selectedMissionId: missionId,
                })
              }
              onViewMemory={() =>
                nav.navigate({
                  ...nav.current,
                  view: "memory",
                  selectedMissionId: null,
                })
              }
              onViewTimeline={() =>
                nav.navigate({
                  ...nav.current,
                  view: "timeline",
                  selectedMissionId: null,
                })
              }
              onViewDetail={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "detail",
                  selectedMissionId: missionId,
                })
              }
            />
          </div>
        ) : selected && view === "timeline" ? (
          <div
            key={`timeline-${selected.path}-${selectedMissionId ?? ""}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <TimelineView
              projectPath={selected.path}
              missionId={selectedMissionId}
              onBack={back}
            />
          </div>
        ) : selected && view === "detail" && selectedMissionId ? (
          <div
            key={`detail-${selected.path}-${selectedMissionId}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <MissionDetailView
              projectPath={selected.path}
              missionId={selectedMissionId}
              onBack={back}
            />
          </div>
        ) : selected && view === "kanban" ? (
          <div
            key={`kanban-${selected.path}-${selectedMissionId ?? ""}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <KanbanBoard
              projectPath={selected.path}
              projectName={selected.mission_name ?? selected.name}
              missionId={selectedMissionId ?? selected.mission_id ?? null}
              onBack={back}
              activeTasks={selected.active_tasks}
            />
          </div>
        ) : selected && view === "history" ? (
          <div
            key={`history-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <MissionHistory
              projectPath={selected.path}
              projectName={selected.name}
              onSelectMission={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "kanban",
                  selectedMissionId: missionId,
                })
              }
              onViewTimeline={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "timeline",
                  selectedMissionId: missionId,
                })
              }
              onViewDetail={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "detail",
                  selectedMissionId: missionId,
                })
              }
              onBack={back}
            />
          </div>
        ) : selected && view === "debt" ? (
          <div
            key={`debt-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <DebtDetailPanel
              projectPath={selected.path}
              projectName={selected.name}
              onBack={back}
            />
          </div>
        ) : selected && view === "memory" ? (
          <div
            key={`memory-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <MemoryBrowser projectPath={selected.path} onBack={back} />
          </div>
        ) : selected ? (
          <div
            key={`dashboard-fallback-${selected.path}`}
            className="flex flex-1 min-w-0 animate-fade-in"
          >
            <ProjectDashboard
              projectPath={selected.path}
              projectName={selected.name}
              onViewTasks={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "kanban",
                  selectedMissionId: missionId ?? null,
                })
              }
              onViewDebt={() =>
                nav.navigate({
                  ...nav.current,
                  view: "debt",
                  selectedMissionId: null,
                })
              }
              onViewKanban={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "kanban",
                  selectedMissionId: missionId,
                })
              }
              onViewMemory={() =>
                nav.navigate({
                  ...nav.current,
                  view: "memory",
                  selectedMissionId: null,
                })
              }
              onViewTimeline={() =>
                nav.navigate({
                  ...nav.current,
                  view: "timeline",
                  selectedMissionId: null,
                })
              }
              onViewDetail={(missionId) =>
                nav.navigate({
                  ...nav.current,
                  view: "detail",
                  selectedMissionId: missionId,
                })
              }
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
