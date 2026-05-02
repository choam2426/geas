/**
 * Envelope-field map for `geas schema template`.
 *
 * For each registered (schema, op) pair the CLI knows about, lists the
 * fields the CLI authoritatively injects / strips from a caller's
 * payload. `schema template` uses this map to produce a
 * `you_must_fill` document (agent-facing fields) and a
 * `cli_will_inject` list (CLI-owned fields).
 *
 * Envelope fields live either on the top-level artifact file or on the
 * per-entry body of an append-only log. The shape here reflects what
 * the actual command in src/cli/src/commands/* does, NOT a theoretical
 * ideal — so tests exercise the real contract callers rely on.
 *
 * Per-entry append fields (entry_id, gate_run_id, debt_id) live inside
 * each entry the agent supplies; file-level fields (mission_id,
 * created_at, updated_at) are outer envelope. The template treats both
 * alike and strips them from the shape the caller fills.
 */

export interface EnvelopeSpec {
  /** Schema name as stored in SCHEMAS. */
  schema: string;
  /** Operation keyword (create, set, append, update, draft, register, update-status, run). */
  op: string;
  /** Fields the CLI injects / owns; agent never supplies these. */
  envelope: readonly string[];
  /** Human-friendly hint describing the op. */
  hint?: string;
}

/**
 * Registered envelope specs. Keep in sync with the actual commands
 * (grep for "delete entry." or "payload.xxx = opts.xxx" patterns).
 */
export const ENVELOPE_SPECS: readonly EnvelopeSpec[] = [
  {
    schema: 'mission-spec',
    op: 'create',
    envelope: ['id', 'user_approved', 'created_at', 'updated_at'],
    hint: 'geas mission create — CLI assigns id, forces user_approved=false, stamps timestamps.',
  },
  {
    schema: 'mission-state',
    op: 'update',
    envelope: ['mission_id', 'updated_at'],
    hint: 'geas mission-state update --phase — CLI sets phase transition and refreshes updated_at.',
  },
  {
    schema: 'task-contract',
    op: 'draft',
    envelope: ['mission_id', 'task_id', 'created_at', 'updated_at'],
    hint: 'geas task draft — CLI assigns task_id, injects mission_id + timestamps.',
  },
  {
    schema: 'task-state',
    op: 'update',
    envelope: ['mission_id', 'task_id', 'updated_at'],
    hint: 'geas task transition / state task-set — CLI refreshes updated_at on state change.',
  },
  {
    schema: 'evidence',
    op: 'append',
    envelope: ['entry_id', 'created_at'],
    hint: 'geas evidence append — CLI assigns per-entry entry_id (monotonic) and created_at. Agent fills evidence_kind and kind-specific fields.',
  },
  {
    schema: 'self-check',
    op: 'append',
    envelope: ['mission_id', 'task_id', 'entry_id', 'created_at', 'updated_at'],
    hint: 'geas self-check append — CLI assigns per-entry entry_id (monotonic) and created_at; file-level mission_id / task_id / updated_at are maintained by the CLI. Agent fills content fields of the entry.',
  },
  {
    schema: 'deliberation',
    op: 'append',
    envelope: ['created_at'],
    hint: 'geas deliberation append — CLI stamps per-entry created_at. Agent fills proposal_summary / votes / result.',
  },
  {
    schema: 'gate-results',
    op: 'run',
    envelope: ['gate_run_id', 'created_at'],
    hint: 'geas gate run — CLI assigns gate_run_id (monotonic) and created_at on each run.',
  },
  {
    schema: 'phase-reviews',
    op: 'append',
    envelope: ['created_at'],
    hint: 'geas phase-review append — CLI stamps per-entry created_at.',
  },
  {
    schema: 'mission-verdicts',
    op: 'append',
    envelope: ['created_at'],
    hint: 'geas mission-verdict append — CLI stamps per-entry created_at.',
  },
  {
    schema: 'implementation-contract',
    op: 'set',
    envelope: ['mission_id', 'task_id', 'created_at', 'updated_at'],
    hint: 'geas impl-contract set — CLI injects mission_id / task_id / timestamps. Full-replace.',
  },
  {
    schema: 'memory-update',
    op: 'set',
    envelope: ['mission_id', 'created_at', 'updated_at'],
    hint: 'geas memory-update set — CLI injects mission_id / timestamps. Full-replace.',
  },
  {
    schema: 'gap',
    op: 'set',
    envelope: ['mission_id', 'created_at', 'updated_at'],
    hint: 'geas gap set — CLI injects mission_id / timestamps. Full-replace.',
  },
  {
    schema: 'debts',
    op: 'register',
    envelope: ['debt_id', 'status', 'resolved_by', 'resolution_rationale'],
    hint: 'geas debt register — CLI assigns debt_id (monotonic), forces status=open, resolved_by=null, resolution_rationale=null.',
  },
  {
    schema: 'debts',
    op: 'update-status',
    envelope: [],
    hint: 'geas debt update-status --debt — only status, resolved_by, resolution_rationale are accepted; the CLI rejects everything else.',
  },
];

export function findSpec(
  schema: string,
  op: string,
): EnvelopeSpec | undefined {
  return ENVELOPE_SPECS.find((s) => s.schema === schema && s.op === op);
}

export function supportedOpsForSchema(schema: string): string[] {
  return ENVELOPE_SPECS.filter((s) => s.schema === schema).map((s) => s.op);
}

export function supportedSchemas(): string[] {
  const seen = new Set<string>();
  for (const s of ENVELOPE_SPECS) seen.add(s.schema);
  return [...seen].sort();
}
