import { FolderPlus } from "lucide-react";

interface EmptyStateProps {
  onAddProject: () => void;
}

export default function EmptyState({ onAddProject }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="mb-4 flex justify-center opacity-30">
          <FolderPlus size={48} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          No projects yet
        </h2>
        <p className="text-text-secondary mb-6">
          Add a project to get started. Point to any directory with a{" "}
          <code className="text-text-muted bg-bg-elevated px-1 py-0.5 rounded text-sm">
            .geas/
          </code>{" "}
          folder.
        </p>
        <button
          onClick={onAddProject}
          className="px-4 py-2 rounded-lg bg-status-blue text-white text-sm font-medium hover:opacity-90 transition-opacity duration-150 cursor-pointer"
        >
          Add Project
        </button>
      </div>
    </div>
  );
}
