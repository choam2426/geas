import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectEntry } from "../types";

interface AddProjectDialogProps {
  onClose: () => void;
  onAdded: (entry: ProjectEntry) => void;
}

export default function AddProjectDialog({
  onClose,
  onAdded,
}: AddProjectDialogProps) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = path.trim();
    if (!trimmed) return;

    setError(null);
    setSubmitting(true);
    try {
      const entry = await invoke<ProjectEntry>("add_project", {
        path: trimmed,
      });
      onAdded(entry);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add Project"
        className="bg-bg-surface border border-border-default rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Add Project
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm text-text-secondary mb-1.5">
            Project path
          </label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/path/to/your/project"
            autoFocus
            className="w-full px-3 py-2 rounded-md bg-bg-elevated border border-border-default text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-status-blue transition-colors duration-150"
          />
          {error && (
            <p className="mt-2 text-sm text-status-red">{error}</p>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !path.trim()}
              className="px-4 py-1.5 rounded-md bg-status-blue text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
