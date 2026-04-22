/**
 * MissionDesignTab — renders `mission-design.md` as authored markdown.
 *
 * Uses the same `react-markdown` stack as the existing rules viewer, scoped
 * to a `.design-markdown` class for typography that matches the console
 * direction (phosphor headings, em-dash bullets, mono code).
 *
 * A sticky sidebar on wide viewports surfaces phase-review verdicts tied to
 * design authority approvals — this gives the reader a "decision log" next
 * to the prose. The sidebar hides on narrow screens and when no reviews
 * exist.
 */

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MissionDetail } from "../types";
import PathBadge from "./PathBadge";

interface Props {
  missionId: string;
  detail: MissionDetail;
}

function verdictClass(v: string | null | undefined): string {
  switch (v) {
    case "approved":
    case "passed":
    case "pass":
      return "text-green";
    case "changes_requested":
      return "text-amber";
    case "blocked":
    case "escalated":
    case "cancelled":
    case "fail":
      return "text-red";
    default:
      return "text-fg-muted";
  }
}

function formatTs(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MissionDesignTab({ missionId, detail }: Props) {
  const md = detail.design_markdown;
  const reviews = detail.phase_reviews?.reviews ?? [];
  const hasSidebar = reviews.length > 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mono text-[13px] text-green">
            mission-design.md
          </h2>
          <span className="font-mono text-[10px] text-fg-dim">
            authored by design-authority
          </span>
        </div>
        <PathBadge
          path={`.geas/missions/${missionId}/mission-design.md`}
        />

        {!md ? (
          <div className="mt-10 text-center">
            <p className="text-[13px] text-fg-muted mb-2">
              design not yet authored
            </p>
            <p className="font-mono text-[11px] text-fg-dim">
              design-authority writes this during the specifying phase
            </p>
          </div>
        ) : (
          <div
            className={
              "mt-6 grid gap-6 " +
              (hasSidebar ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "")
            }
          >
            <article className="design-markdown min-w-0">
              <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
            </article>

            {hasSidebar && (
              <aside className="lg:sticky lg:top-0 self-start">
                <div className="font-mono text-[10px] uppercase tracking-widest text-fg-dim mb-2">
                  decision log
                </div>
                <ol className="space-y-2 font-mono text-[11px]">
                  {reviews
                    .slice()
                    .reverse()
                    .map((r, i) => (
                      <li
                        key={i}
                        className="border-l-2 border-border-muted pl-3 py-1"
                      >
                        <div className="text-fg-dim">
                          {formatTs(r.created_at)}
                        </div>
                        <div className="text-fg">
                          {r.mission_phase ?? "—"}
                          {r.next_phase && (
                            <span className="text-fg-dim"> → {r.next_phase}</span>
                          )}
                        </div>
                        <div className={verdictClass(r.status)}>
                          {r.status ?? "—"}
                        </div>
                        {r.summary && (
                          <div className="mt-1 text-fg-muted text-[11px] whitespace-pre-wrap">
                            {r.summary}
                          </div>
                        )}
                      </li>
                    ))}
                </ol>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
