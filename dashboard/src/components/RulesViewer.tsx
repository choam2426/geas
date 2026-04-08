import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, BookOpen } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RulesViewerProps {
  projectPath: string;
  onBack: () => void;
}

export default function RulesViewer({ projectPath, onBack }: RulesViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    invoke<string>("get_project_rules", { path: projectPath })
      .then((result) => {
        if (!cancelled) {
          setContent(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [projectPath]);

  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-default shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </button>
        <BookOpen size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">Project Rules</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 bg-bg-elevated rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-status-red text-sm">{error}</p>
          </div>
        ) : !content ? (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-text-muted mb-4" />
            <p className="text-text-secondary text-sm">No rules.md found for this project</p>
          </div>
        ) : (
          <div className="rules-markdown max-w-3xl">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
