/**
 * ProjectRefreshContext — per-project refresh counter.
 *
 * Two sources bump the counter:
 *   1. `geas://project-changed` events from the Tauri file watcher
 *      (automatic, fires when anything under `.geas/` changes).
 *   2. `bumpProject(path)` called explicitly by UI (e.g. the Sidebar
 *      refresh button), so manual refresh cascades to every view that
 *      subscribes via `useProjectRefresh`.
 *
 * Views call `useProjectRefresh(projectPath)` and gain a number that
 * increments every time either source fires for that project. They treat
 * any change in that number as a signal to re-fetch their own data.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";

/** Strip `\\?\` prefix, convert `\` → `/`, trim trailing slash. */
function normalizePath(p: string): string {
  return p.replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/$/, "");
}

interface ProjectRefreshValue {
  counters: Map<string, number>;
  bumpProject: (projectPath: string) => void;
}

const DEFAULT_VALUE: ProjectRefreshValue = {
  counters: new Map(),
  bumpProject: () => {},
};

const ProjectRefreshContext =
  createContext<ProjectRefreshValue>(DEFAULT_VALUE);

export function ProjectRefreshProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [counters, setCounters] = useState<Map<string, number>>(new Map());

  const bumpProject = useCallback((projectPath: string) => {
    const key = normalizePath(projectPath);
    setCounters((prev) => {
      const next = new Map(prev);
      next.set(key, (next.get(key) ?? 0) + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    const unlisten = listen<{ path: string }>(
      "geas://project-changed",
      (event) => {
        const key = normalizePath(event.payload.path);
        setCounters((prev) => {
          const next = new Map(prev);
          next.set(key, (next.get(key) ?? 0) + 1);
          return next;
        });
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const value = useMemo<ProjectRefreshValue>(
    () => ({ counters, bumpProject }),
    [counters, bumpProject],
  );

  return (
    <ProjectRefreshContext.Provider value={value}>
      {children}
    </ProjectRefreshContext.Provider>
  );
}

export function useProjectRefresh(projectPath: string): number {
  const { counters } = useContext(ProjectRefreshContext);
  return counters.get(normalizePath(projectPath)) ?? 0;
}

/**
 * Returns the bumper. Use from top-level UI to force a cascading refresh
 * of all views subscribed to a particular project's counter — e.g. when
 * the user clicks a manual refresh button.
 */
export function useBumpProjectRefresh(): (projectPath: string) => void {
  return useContext(ProjectRefreshContext).bumpProject;
}
