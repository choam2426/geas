import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  message: string;
  title?: string;
  duration: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; borderColor: string; iconColor: string; bgColor: string }
> = {
  success: {
    icon: CheckCircle2,
    borderColor: "border-l-status-green",
    iconColor: "text-status-green",
    bgColor: "bg-status-green/10",
  },
  error: {
    icon: XCircle,
    borderColor: "border-l-status-red",
    iconColor: "text-status-red",
    bgColor: "bg-status-red/10",
  },
  info: {
    icon: Info,
    borderColor: "border-l-status-blue",
    iconColor: "text-status-blue",
    bgColor: "bg-status-blue/10",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-l-status-amber",
    iconColor: "text-status-amber",
    bgColor: "bg-status-amber/10",
  },
};

const progressBarColor: Record<ToastVariant, string> = {
  success: "bg-status-green",
  error: "bg-status-red",
  info: "bg-status-blue",
  warning: "bg-status-amber",
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressStarted, setProgressStarted] = useState(false);

  const startDismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  }, [isExiting, onDismiss, toast.id]);

  // Auto-dismiss timer
  useEffect(() => {
    timerRef.current = setTimeout(startDismiss, toast.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.duration, startDismiss]);

  // Start progress bar animation after mount (needs a frame delay for transition to work)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setProgressStarted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  return (
    <div
      className={`
        ${config.bgColor} ${config.borderColor}
        bg-bg-elevated border border-border-default rounded-lg shadow-lg
        p-3 pr-8 min-w-[320px] max-w-[420px] relative overflow-hidden
        border-l-4 pointer-events-auto
        ${isExiting ? "animate-toast-out" : "animate-toast-in"}
      `}
      role="alert"
    >
      <div className="flex gap-2.5 items-start">
        <Icon size={18} className={`${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="text-text-primary text-sm font-semibold mb-0.5">
              {toast.title}
            </p>
          )}
          <p className="text-text-secondary text-sm leading-snug">
            {toast.message}
          </p>
        </div>
      </div>

      <button
        onClick={startDismiss}
        className="absolute top-2 right-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5">
        <div
          className={`h-full ${progressBarColor[toast.variant]} transition-all linear`}
          style={{
            width: progressStarted ? "0%" : "100%",
            transitionDuration: `${toast.duration}ms`,
          }}
        />
      </div>
    </div>
  );
}
