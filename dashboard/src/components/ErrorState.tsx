interface ErrorStateProps {
  status: "no_geas" | "error";
  projectName: string;
  projectPath: string;
}

export default function ErrorState({
  status,
  projectName,
  projectPath,
}: ErrorStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">
          {status === "no_geas" ? (
            <span className="text-status-amber">!</span>
          ) : (
            <span className="text-status-red">X</span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {status === "no_geas"
            ? "No .geas/ directory found"
            : "Error reading project"}
        </h2>
        <p className="text-text-secondary mb-2">{projectName}</p>
        <p className="text-text-muted text-sm break-all">{projectPath}</p>
        <p className="text-text-secondary mt-4 text-sm">
          {status === "no_geas"
            ? "This directory does not contain a .geas/ folder. Run geas:setup in the project first."
            : "Could not read project data. Check that the path exists and is accessible."}
        </p>
      </div>
    </div>
  );
}
