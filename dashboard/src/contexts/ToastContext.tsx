import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Toast from "../components/Toast";
import type { ToastVariant, ToastData } from "../components/Toast";

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (input: ToastInput) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((input: ToastInput): string => {
    const id = crypto.randomUUID();
    const toast: ToastData = {
      id,
      variant: input.variant,
      message: input.message,
      title: input.title,
      duration: input.duration ?? DEFAULT_DURATION,
    };

    setToasts((prev) => {
      const next = [...prev, toast];
      // Enforce max visible limit — remove oldest when exceeded
      if (next.length > MAX_VISIBLE_TOASTS) {
        return next.slice(next.length - MAX_VISIBLE_TOASTS);
      }
      return next;
    });

    return id;
  }, []);

  const contextValue = useMemo(
    () => ({ addToast, removeToast }),
    [addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div
          className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none"
          aria-live="polite"
          aria-label="Notifications"
        >
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
