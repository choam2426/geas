import { useState, useEffect, useCallback, useRef } from "react";

export interface NavState {
  view: "dashboard" | "overview" | "kanban" | "history" | "debt";
  selectedPath: string | null;
  selectedMissionId: string | null;
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
