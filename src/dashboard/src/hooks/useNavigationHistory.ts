import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Mission-scoped sub-tab.
 *
 * Only meaningful when `view === "detail"`. When absent the shell defaults
 * to `"overview"`. Kanban and Timeline used to be top-level routes; they
 * are now sub-tabs of the mission detail view so all mission work sits
 * under one breadcrumb ancestor.
 */
export type MissionTab = "overview" | "spec" | "design" | "kanban" | "timeline";

/**
 * View enum.
 *
 * - `dashboard` — project landing (mission list, active + history inline).
 * - `detail`    — mission-scoped view with sub-tabs (missionTab).
 * - `debt`      — project-wide debt ledger.
 * - `memory`    — project-wide memory browser.
 *
 * `kanban` / `timeline` / `history` / `overview` were removed or collapsed
 * into other routes:
 *   - kanban, timeline → sub-tabs of detail
 *   - history          → inline in dashboard
 *   - overview         → sub-tab of detail (default)
 */
export interface NavState {
  view: "dashboard" | "detail" | "debt" | "memory";
  selectedPath: string | null;
  selectedMissionId: string | null;
  missionTab?: MissionTab;
}

export interface NavigationHistory {
  current: NavState;
  canGoBack: boolean;
  canGoForward: boolean;
  navigate: (newState: NavState) => void;
  goBack: () => void;
  goForward: () => void;
  reset: (initialState: NavState) => void;
}

const DEFAULT_STATE: NavState = {
  view: "dashboard",
  selectedPath: null,
  selectedMissionId: null,
};

export function useNavigationHistory(
  initial: NavState = DEFAULT_STATE
): NavigationHistory {
  const [current, setCurrent] = useState<NavState>(initial);
  const backStackRef = useRef<NavState[]>([]);
  const forwardStackRef = useRef<NavState[]>([]);
  const [, forceRender] = useState(0);

  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const navigate = useCallback(
    (newState: NavState) => {
      setCurrent((prev) => {
        backStackRef.current = [...backStackRef.current, prev];
        forwardStackRef.current = [];
        return newState;
      });
      bump();
    },
    [bump]
  );

  const goBack = useCallback(() => {
    const back = backStackRef.current;
    if (back.length === 0) return;
    setCurrent((prev) => {
      const previous = back[back.length - 1];
      backStackRef.current = back.slice(0, -1);
      forwardStackRef.current = [...forwardStackRef.current, prev];
      return previous;
    });
    bump();
  }, [bump]);

  const goForward = useCallback(() => {
    const fwd = forwardStackRef.current;
    if (fwd.length === 0) return;
    setCurrent((prev) => {
      const next = fwd[fwd.length - 1];
      forwardStackRef.current = fwd.slice(0, -1);
      backStackRef.current = [...backStackRef.current, prev];
      return next;
    });
    bump();
  }, [bump]);

  const reset = useCallback(
    (initialState: NavState) => {
      backStackRef.current = [];
      forwardStackRef.current = [];
      setCurrent(initialState);
      bump();
    },
    [bump]
  );

  // Mouse side button listener
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        goForward();
      }
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [goBack, goForward]);

  return {
    current,
    canGoBack: backStackRef.current.length > 0,
    canGoForward: forwardStackRef.current.length > 0,
    navigate,
    goBack,
    goForward,
    reset,
  };
}
