import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ProjectEntry, ProjectSummary } from "./types";
import * as geas from "./lib/geasClient";
import Sidebar from "./components/Sidebar";
import TopBar, { type BreadcrumbCrumb } from "./components/TopBar";
import StatusBar from "./components/StatusBar";
import ProjectDashboard from "./components/ProjectDashboard";
import DebtDetailPanel from "./components/DebtDetailPanel";
import MissionDetailShell from "./components/MissionDetailShell";
import MemoryBrowser from "./components/MemoryBrowser";
import EmptyState from "./components/EmptyState";
import ErrorState from "./components/ErrorState";
import AddProjectDialog from "./components/AddProjectDialog";
import {
  ProjectRefreshProvider,
  useBumpProjectRefresh,
} from "./contexts/ProjectRefreshContext";
import {
  useNavigationHistory,
  type MissionTab,
} from "./hooks/useNavigationHistory";

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
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const bumpProjectRefresh = useBumpProjectRefresh();

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
      // Cascade: force every view subscribed via `useProjectRefresh` to
      // refetch its own data. Without this, hitting the Sidebar refresh
      // button only updates the project list — mission sub-tabs would
      // still show stale data until the next file-watcher event.
      for (const s of summaries) bumpProjectRefresh(s.path);
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
  }, [bumpProjectRefresh]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectedPath = nav.current.selectedPath;
  const view = nav.current.view;
  const selectedMissionId = nav.current.selectedMissionId;
  const missionTab = nav.current.missionTab ?? "overview";
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
        setLastEventAt(new Date());
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

  /**
   * Navigate to a specific mission, defaulting to the overview sub-tab.
   * Callers that want a different tab can pass `tab` explicitly.
   */
  const openMission = useCallback(
    (missionId: string, tab: MissionTab = "overview") => {
      nav.navigate({
        ...nav.current,
        view: "detail",
        selectedMissionId: missionId,
        missionTab: tab,
      });
    },
    [nav],
  );

  const changeMissionTab = useCallback(
    (tab: MissionTab) => {
      if (!selectedMissionId) return;
      nav.navigate({
        ...nav.current,
        view: "detail",
        selectedMissionId,
        missionTab: tab,
      });
    },
    [nav, selectedMissionId],
  );

  /**
   * Build the breadcrumb trail for the TopBar based on the current view.
   * Past-mission names aren't in ProjectSummary (only the active one), so
   * when viewing a non-active mission we fall back to the mission id in mono.
   */
  const crumbs = useMemo<BreadcrumbCrumb[]>(() => {
    if (!selected) return [];

    const gotoDashboard = () =>
      nav.reset({
        view: "dashboard",
        selectedPath: selected.path,
        selectedMissionId: null,
      });

    const base: BreadcrumbCrumb[] = [
      {
        label: selected.name,
        onClick: view === "dashboard" ? undefined : gotoDashboard,
      },
    ];

    if (view === "dashboard") return base;
    if (view === "debt") return [...base, { label: "debt" }];
    if (view === "memory") return [...base, { label: "memory" }];

    // Mission-scoped view (detail). Mission crumb + sub-tab tail.
    const missionLabel =
      selectedMissionId === selected.mission_id && selected.mission_name
        ? selected.mission_name
        : selectedMissionId ?? "mission";
    const isMissionId = selectedMissionId && missionLabel === selectedMissionId;

    const missionCrumb: BreadcrumbCrumb = {
      label: missionLabel,
      mono: !!isMissionId,
      onClick:
        missionTab === "overview"
          ? undefined
          : () => changeMissionTab("overview"),
    };

    const tail: BreadcrumbCrumb[] =
      missionTab === "overview" ? [] : [{ label: missionTab }];

    return [...base, missionCrumb, ...tail];
  }, [selected, view, selectedMissionId, missionTab, nav, changeMissionTab]);

  return (
    <div className="flex flex-col h-screen bg-bg-0 text-fg font-sans overflow-hidden">
      <TopBar crumbs={crumbs} phase={selected?.phase ?? null} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
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
          onAddProject={() => setShowAddDialog(true)}
          onRemoveProject={handleRemoveProject}
          onRefresh={loadProjects}
          loading={loading}
        />

        <main className="flex flex-1 min-w-0 overflow-hidden">
          {backendError && !loading ? (
            <div className="flex flex-1 min-w-0 items-center justify-center animate-fade-in">
              <div className="text-center max-w-md">
                <p className="text-red text-lg font-semibold mb-2">
                  Backend Error
                </p>
                <p className="text-fg-muted text-sm mb-4">{backendError}</p>
                <button
                  onClick={loadProjects}
                  className="px-4 py-1.5 rounded-[4px] bg-bg-2 text-fg border border-border text-sm cursor-pointer hover:bg-bg-1 active:scale-95 transition-all"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : projects.length === 0 && !loading ? (
            <EmptyState onAddProject={() => setShowAddDialog(true)} />
          ) : selected &&
            (selected.status === "no_geas" || selected.status === "error") ? (
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
                  missionId
                    ? openMission(missionId, "kanban")
                    : undefined
                }
                onViewKanban={(missionId) => openMission(missionId, "kanban")}
                onViewDetail={(missionId) => openMission(missionId, "overview")}
                onViewDebt={() =>
                  nav.navigate({
                    ...nav.current,
                    view: "debt",
                    selectedMissionId: null,
                  })
                }
                onViewMemory={() =>
                  nav.navigate({
                    ...nav.current,
                    view: "memory",
                    selectedMissionId: null,
                  })
                }
              />
            </div>
          ) : selected && view === "detail" && selectedMissionId ? (
            <div
              key={`detail-${selected.path}-${selectedMissionId}`}
              className="flex flex-1 min-w-0 animate-fade-in"
            >
              <MissionDetailShell
                projectPath={selected.path}
                projectName={selected.name}
                missionId={selectedMissionId}
                activeTab={missionTab}
                onChangeTab={changeMissionTab}
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
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-fg-dim text-sm">Loading...</span>
            </div>
          ) : null}
        </main>
      </div>

      <StatusBar
        project={selected}
        lastEventAt={lastEventAt}
        memoryCount={null}
      />

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
    <ProjectRefreshProvider>
      <AppInner />
    </ProjectRefreshProvider>
  );
}

export default App;
