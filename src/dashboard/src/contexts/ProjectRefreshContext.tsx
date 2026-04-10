import { createContext, useContext, useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

/** Normalize a path for cross-platform comparison:
 *  - Strip Windows extended-length prefix (\\?\)
 *  - Convert backslashes to forward slashes
 *  - Remove trailing slash */
function normalizePath(p: string): string {
  return p.replace(/^\\\\\?\\/, '').replace(/\\/g, '/').replace(/\/$/, '');
}

const ProjectRefreshContext = createContext<Map<string, number>>(new Map());

export function ProjectRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshMap, setRefreshMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const unlisten = listen<{ path: string }>("geas://project-changed", (event) => {
      const p = normalizePath(event.payload.path);
      setRefreshMap(prev => {
        const next = new Map(prev);
        next.set(p, (next.get(p) || 0) + 1);
        return next;
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return (
    <ProjectRefreshContext.Provider value={refreshMap}>
      {children}
    </ProjectRefreshContext.Provider>
  );
}

export function useProjectRefresh(projectPath: string): number {
  const map = useContext(ProjectRefreshContext);
  return map.get(normalizePath(projectPath)) || 0;
}
