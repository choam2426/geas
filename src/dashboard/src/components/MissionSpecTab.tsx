/**
 * MissionSpecTab — structured renderer for `mission-spec.json`.
 *
 * The spec is frozen once the user approves it, so we label it that way at
 * the top. Everything renders as labeled rows / block sections in monospace,
 * giving the impression of reading the JSON directly but with nicer type
 * cues (strings cyan, booleans amber, nulls dim).
 *
 * Fields missing from the spec render as "—" rather than being hidden, so
 * the reader can always confirm presence/absence at a glance.
 */

import type { MissionDetail, MissionSpec } from "../types";
import PathBadge from "./PathBadge";
import Pill from "./Pill";
import { lookupColor, riskColors } from "../colors";

interface Props {
  missionId: string;
  detail: MissionDetail;
}

export default function MissionSpecTab({ missionId, detail }: Props) {
  const spec = detail.spec;

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-mono text-[13px] text-green">
            mission-spec.json
          </h2>
          <span className="font-mono text-[10px] text-fg-dim">
            {spec?.user_approved ? "frozen · immutable" : "draft"}
          </span>
        </div>
        <PathBadge
          path={`.geas/missions/${missionId}/mission-spec.json`}
        />

        {!spec ? (
          <div className="mt-10 text-center">
            <p className="text-[13px] text-fg-muted mb-2">
              spec not yet frozen
            </p>
            <p className="font-mono text-[11px] text-fg-dim">
              run <span className="text-cyan">geas mission set</span> +{" "}
              <span className="text-cyan">geas mission approve</span>
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <SpecBlock title="identity">
              <SpecRow k="mission_id">
                <Mono value={spec.id ?? missionId} />
              </SpecRow>
              <SpecRow k="name">
                <Scalar value={spec.name} />
              </SpecRow>
              <SpecRow k="mode">
                <Scalar value={spec.mode} />
              </SpecRow>
              <SpecRow k="user_approved">
                <Scalar value={spec.user_approved} />
              </SpecRow>
              <SpecRow k="created_at">
                <Mono value={spec.created_at} />
              </SpecRow>
              <SpecRow k="updated_at">
                <Mono value={spec.updated_at} />
              </SpecRow>
            </SpecBlock>

            {spec.description && (
              <SpecBlock title="description">
                <ProseBody text={spec.description} />
              </SpecBlock>
            )}

            {spec.definition_of_done && (
              <SpecBlock title="definition_of_done">
                <ProseBody text={spec.definition_of_done} />
              </SpecBlock>
            )}

            {spec.scope && (spec.scope.in.length > 0 || spec.scope.out.length > 0) && (
              <SpecBlock title="scope">
                {spec.scope.in.length > 0 && (
                  <div>
                    <div className="font-mono text-[11px] text-green mb-1">
                      in ({spec.scope.in.length})
                    </div>
                    <BulletList items={spec.scope.in} />
                  </div>
                )}
                {spec.scope.out.length > 0 && (
                  <div className="mt-3">
                    <div className="font-mono text-[11px] text-fg-dim mb-1">
                      out ({spec.scope.out.length})
                    </div>
                    <BulletList items={spec.scope.out} muted />
                  </div>
                )}
              </SpecBlock>
            )}

            {spec.acceptance_criteria.length > 0 && (
              <SpecBlock title={`acceptance_criteria (${spec.acceptance_criteria.length})`}>
                <BulletList items={spec.acceptance_criteria} />
              </SpecBlock>
            )}

            {spec.constraints.length > 0 && (
              <SpecBlock title={`constraints (${spec.constraints.length})`}>
                <BulletList items={spec.constraints} />
              </SpecBlock>
            )}

            {spec.affected_surfaces.length > 0 && (
              <SpecBlock
                title={`affected_surfaces (${spec.affected_surfaces.length})`}
              >
                <div className="flex flex-wrap gap-1.5">
                  {spec.affected_surfaces.map((s, i) => (
                    <span
                      key={i}
                      className="font-mono text-[11px] px-1.5 py-[2px] rounded-[3px] bg-bg-2 text-fg-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </SpecBlock>
            )}

            {spec.risks.length > 0 && (
              <SpecBlock title={`risks (${spec.risks.length})`}>
                <ul className="space-y-1.5 text-[12px]">
                  {spec.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Pill color={lookupColor(riskColors, "normal")}>risk</Pill>
                      <span className="text-fg">{r}</span>
                    </li>
                  ))}
                </ul>
              </SpecBlock>
            )}

            <RawFieldsFallback spec={spec} />
          </div>
        )}
      </div>
    </div>
  );
}

function SpecBlock({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border-muted">
        <span className="font-mono text-[11px] text-green">{title}</span>
        {note && (
          <span className="font-mono text-[10px] text-fg-dim">· {note}</span>
        )}
      </div>
      <div className="pl-2">{children}</div>
    </section>
  );
}

function SpecRow({
  k,
  children,
}: {
  k: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-0.5 font-mono text-[12px]">
      <span className="text-fg-dim w-36 flex-shrink-0">{k}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Mono({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined)
    return <span className="text-fg-dim">—</span>;
  return <span className="text-fg">{value}</span>;
}

function Scalar({
  value,
}: {
  value: string | boolean | null | undefined;
}) {
  if (value === null || value === undefined)
    return <span className="text-fg-dim">null</span>;
  if (typeof value === "boolean")
    return <span className="text-amber">{String(value)}</span>;
  return <span className="text-cyan">&quot;{value}&quot;</span>;
}

function ProseBody({ text }: { text: string }) {
  return (
    <p className="text-[13px] text-fg leading-relaxed whitespace-pre-wrap">
      {text}
    </p>
  );
}

function BulletList({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="space-y-0.5 text-[12px]">
      {items.map((x, i) => (
        <li
          key={i}
          className={
            "flex items-start gap-2 " + (muted ? "text-fg-muted" : "text-fg")
          }
        >
          <span className="text-fg-dim select-none">—</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Expose any fields we don't render explicitly so authors can eyeball the
 * whole payload. Helps when the schema expands faster than the UI.
 */
function RawFieldsFallback({ spec }: { spec: MissionSpec }) {
  const known = new Set([
    "id",
    "mode",
    "name",
    "description",
    "definition_of_done",
    "user_approved",
    "scope",
    "acceptance_criteria",
    "constraints",
    "affected_surfaces",
    "risks",
    "created_at",
    "updated_at",
  ]);
  const extra = Object.entries(spec as unknown as Record<string, unknown>)
    .filter(([k]) => !known.has(k))
    .filter(([, v]) => v !== null && v !== undefined);

  if (extra.length === 0) return null;

  return (
    <SpecBlock title={`unrecognized_fields (${extra.length})`} note="from schema">
      <pre className="font-mono text-[11px] text-fg-muted whitespace-pre-wrap">
        {extra
          .map(([k, v]) => `${k}: ${JSON.stringify(v, null, 2)}`)
          .join("\n")}
      </pre>
    </SpecBlock>
  );
}
