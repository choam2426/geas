/**
 * Field Policy Registry — single source of truth for field classification.
 *
 * Every field in every schema type is classified by how it enters an artifact:
 * - system:      auto-injected by CLI (version, artifact_type, timestamps, etc.)
 * - derived:     computed from other fields (artifact_id, rollup aggregates)
 * - defaulted:   has a default value but can be overridden
 * - input:       user/agent-supplied content
 * - append_only: managed by CLI append commands, not directly settable
 * - guarded:     set from CLI flags at trust boundary, not from stdin JSON
 */

import { SCHEMAS } from './schemas-embedded';

/* ── Types ─────────────────────────────────────────────────────────── */

export type FieldClass =
  | 'system'
  | 'derived'
  | 'defaulted'
  | 'input'
  | 'append_only'
  | 'guarded';

export interface FieldPolicy {
  class: FieldClass;
  /** Default value for system/defaulted fields. */
  inject?: unknown;
  /** ID generation function for derived artifact_id fields. */
  id_fn?: (
    data: Record<string, unknown>,
    context: { mission_id?: string },
  ) => string;
}

/* ── Envelope entry (replaces ENVELOPE_REGISTRY) ───────────────────── */

export interface EnvelopeEntry {
  version: string;
  artifact_type: string;
  producer_type: string;
  artifact_id_fn: (
    data: Record<string, unknown>,
    context: { mission_id?: string },
  ) => string;
}

/* ── Field Policies for all 15 schema types ────────────────────────── */

/**
 * Maps schema name (hyphen-case, matching SCHEMAS keys) to per-field policies.
 * Only covers fields that exist in the schema's `properties`.
 * Envelope fields (version, artifact_type, producer_type, artifact_id) are NOT
 * in schema properties — they are injected outside the schema. For schemas that
 * receive envelope injection, the envelope metadata is stored as inject/id_fn
 * on a synthetic `_envelope` key (not a real schema property).
 */
export const FIELD_POLICIES: Record<string, Record<string, FieldPolicy>> = {
  /* ── Protocol schemas (10) ─────────────────────────────────────── */

  'task-contract': {
    task_id: { class: 'input' },
    title: { class: 'input' },
    goal: { class: 'input' },
    task_kind: { class: 'input' },
    risk_level: { class: 'input' },
    gate_profile: { class: 'input' },
    vote_round_policy: { class: 'input' },
    acceptance_criteria: { class: 'input' },
    eval_commands: { class: 'input' },
    rubric: { class: 'input' },
    retry_budget: { class: 'input' },
    scope: { class: 'input' },
    routing: { class: 'input' },
    base_snapshot: { class: 'input' },
    dependencies: { class: 'input' },
    status: { class: 'defaulted', inject: 'drafted' },
    // Envelope metadata (not schema properties, used by getEnvelopeEntry)
    _envelope: {
      class: 'system',
      inject: {
        version: '1.0',
        artifact_type: 'task_contract',
        producer_type: 'orchestration-authority',
      },
      id_fn: (data: Record<string, unknown>) =>
        `tc-${data.task_id || 'unknown'}`,
    },
  },

  'mission-spec': {
    mission_id: { class: 'input' },
    domain_profile: { class: 'input' },
    mode: { class: 'input' },
    mission: { class: 'input' },
    done_when: { class: 'input' },
    target_user: { class: 'input' },
    scope: { class: 'input' },
    acceptance_criteria: { class: 'input' },
    constraints: { class: 'input' },
    affected_surfaces: { class: 'input' },
    risk_notes: { class: 'input' },
    assumptions: { class: 'input' },
    ambiguities: { class: 'input' },
    _envelope: {
      class: 'system',
      inject: {
        version: '1.0',
        artifact_type: 'mission_spec',
        producer_type: 'orchestration-authority',
      },
      id_fn: (
        _data: Record<string, unknown>,
        context: { mission_id?: string },
      ) => `spec-${context.mission_id || 'unknown'}`,
    },
  },

  'design-brief': {
    mission_id: { class: 'input' },
    depth: { class: 'input' },
    status: { class: 'input' },
    chosen_approach: { class: 'input' },
    non_goals: { class: 'input' },
    verification_strategy: { class: 'input' },
    alternatives_considered: { class: 'input' },
    architecture_decisions: { class: 'input' },
    risks: { class: 'input' },
    preserve_list: { class: 'input' },
    unresolved_assumptions: { class: 'input' },
    design_review: { class: 'input' },
    _envelope: {
      class: 'system',
      inject: {
        version: '1.0',
        artifact_type: 'design_brief',
        producer_type: 'orchestration-authority',
      },
      id_fn: (
        _data: Record<string, unknown>,
        context: { mission_id?: string },
      ) => `brief-${context.mission_id || 'unknown'}`,
    },
  },

  'evidence': {
    // Trust boundary: these come from CLI flags, not stdin
    agent: { class: 'guarded' },
    task_id: { class: 'guarded' },
    role: { class: 'guarded' },
    // Content fields
    summary: { class: 'input' },
    artifact_refs: { class: 'input' },
    revision_ref: { class: 'input' },
    verdict: { class: 'input' },
    concerns: { class: 'input' },
    blocking: { class: 'input' },
    rationale: { class: 'input' },
    criteria_results: { class: 'input' },
    rubric_scores: { class: 'input' },
    // No _envelope: evidence has no envelope injection
  },

  'phase-review': {
    mission_phase: { class: 'input' },
    status: { class: 'input' },
    summary: { class: 'input' },
    next_phase: { class: 'input' },
    _envelope: {
      class: 'system',
      inject: {
        version: '1.0',
        artifact_type: 'phase_review',
        producer_type: 'orchestration-authority',
      },
      id_fn: (data: Record<string, unknown>) => {
        const phase = (data.mission_phase as string) || 'unknown';
        const ts = new Date()
          .toISOString()
          .replace(/\.\d{3}Z$/, 'Z')
          .replace(/:/g, '-');
        return `phase-${phase}-${ts}`;
      },
    },
  },

  'record': {
    task_id: { class: 'guarded' },
    implementation_contract: { class: 'append_only' },
    self_check: { class: 'append_only' },
    gate_result: { class: 'append_only' },
    challenge_review: { class: 'append_only' },
    verdict: { class: 'append_only' },
    closure: { class: 'append_only' },
    retrospective: { class: 'append_only' },
  },

  'gap-assessment': {
    scope_in_summary: { class: 'input' },
    scope_out_summary: { class: 'input' },
    fully_delivered: { class: 'input' },
    partially_delivered: { class: 'input' },
    not_delivered: { class: 'input' },
    intentional_cuts: { class: 'input' },
    unexpected_additions: { class: 'input' },
    recommended_followups: { class: 'input' },
  },

  'health-check': {
    signals: { class: 'input' },
    any_triggered: { class: 'input' },
    trigger_context: { class: 'input' },
  },

  'recovery-packet': {
    recovery_id: { class: 'input' },
    recovery_class: { class: 'input' },
    focus_task_id: { class: 'input' },
    detected_problem: { class: 'input' },
    recommended_action: { class: 'input' },
    artifacts_found: { class: 'input' },
    artifacts_missing: { class: 'input' },
  },

  'rules-update': {
    // producer_type is a schema property for rules-update (input, not system)
    producer_type: { class: 'input' },
    status: { class: 'input' },
    affected_rule_ids: { class: 'input' },
    reason: { class: 'input' },
    evidence_refs: { class: 'input' },
    applies_to: { class: 'input' },
  },

  /* ── Runtime-only schemas (5) ──────────────────────────────────── */

  'debt-register': {
    scope: { class: 'input' },
    items: { class: 'append_only' },
    rollup_by_severity: { class: 'derived' },
    rollup_by_kind: { class: 'derived' },
    created_at: { class: 'system' },
    updated_at: { class: 'system' },
  },

  'lock-manifest': {
    locks: { class: 'append_only' },
  },

  'policy-override': {
    overrides: { class: 'input' },
  },

  'run-state': {
    status: { class: 'input' },
    mission_id: { class: 'input' },
    mission: { class: 'input' },
    phase: { class: 'input' },
    current_task_id: { class: 'input' },
    completed_tasks: { class: 'input' },
    decisions: { class: 'input' },
    session_latest_path: { class: 'input' },
    recovery_class: { class: 'input' },
    scheduler_state: { class: 'input' },
    checkpoint: { class: 'input' },
    created_at: { class: 'system' },
    updated_at: { class: 'system' },
  },

  'vote-round': {
    round_type: { class: 'input' },
    task_id: { class: 'input' },
    proposal_summary: { class: 'input' },
    participants: { class: 'input' },
    votes: { class: 'input' },
    result: { class: 'input' },
    quorum_met: { class: 'input' },
    quorum_failure_count: { class: 'input' },
    created_at: { class: 'system' },
    updated_at: { class: 'system' },
  },
};

/* ── Underscore-to-hyphen mapping for envelope lookup ──────────────── */

const UNDERSCORE_TO_HYPHEN: Record<string, string> = {
  task_contract: 'task-contract',
  mission_spec: 'mission-spec',
  design_brief: 'design-brief',
  phase_review: 'phase-review',
};

/**
 * Normalize a schema/artifact key to the hyphen-case used in FIELD_POLICIES.
 */
function normalizeKey(key: string): string {
  return UNDERSCORE_TO_HYPHEN[key] || key;
}

/* ── Helper functions ──────────────────────────────────────────────── */

/**
 * Returns fields classified as system or derived for a given schema.
 * These are auto-managed by the CLI and should not be user-supplied.
 */
export function getEnvelopeFields(schemaName: string): Set<string> {
  const policies = FIELD_POLICIES[normalizeKey(schemaName)];
  if (!policies) return new Set();
  const result = new Set<string>();
  for (const [field, policy] of Object.entries(policies)) {
    if (field === '_envelope') continue;
    if (policy.class === 'system' || policy.class === 'derived') {
      result.add(field);
    }
  }
  return result;
}

/**
 * Returns fields classified as guarded (set from CLI flags).
 */
export function getCliFlagFields(schemaName: string): Set<string> {
  const policies = FIELD_POLICIES[normalizeKey(schemaName)];
  if (!policies) return new Set();
  const result = new Set<string>();
  for (const [field, policy] of Object.entries(policies)) {
    if (field === '_envelope') continue;
    if (policy.class === 'guarded') {
      result.add(field);
    }
  }
  return result;
}

/**
 * Returns the set of fields that should be stripped from templates.
 * Union of system + derived + guarded fields.
 */
export function getStrippableFields(schemaName: string): Set<string> {
  const envelope = getEnvelopeFields(schemaName);
  const cliFlags = getCliFlagFields(schemaName);
  return new Set([...envelope, ...cliFlags]);
}

/**
 * Construct an EnvelopeEntry from FIELD_POLICIES for the given artifact type.
 * Accepts underscore keys (task_contract) or hyphen keys (task-contract).
 *
 * Returns undefined for schemas that do not receive envelope injection
 * (evidence, record, gap-assessment, etc.).
 */
export function getEnvelopeEntry(
  artifactType: string,
): EnvelopeEntry | undefined {
  const key = normalizeKey(artifactType);
  const policies = FIELD_POLICIES[key];
  if (!policies) return undefined;

  const envelopeMeta = policies._envelope;
  if (!envelopeMeta) return undefined;

  const injectData = envelopeMeta.inject as {
    version: string;
    artifact_type: string;
    producer_type: string;
  };

  return {
    version: injectData.version,
    artifact_type: injectData.artifact_type,
    producer_type: injectData.producer_type,
    artifact_id_fn: envelopeMeta.id_fn!,
  };
}

/* ── Build-time sync check ─────────────────────────────────────────── */

/**
 * Validates that every property in every embedded schema has a
 * corresponding entry in FIELD_POLICIES. Throws on mismatch.
 *
 * Call this during build/test to catch schema drift.
 */
export function validateFieldPolicySync(): void {
  const errors: string[] = [];

  for (const schemaName of Object.keys(SCHEMAS)) {
    const schema = SCHEMAS[schemaName] as {
      properties?: Record<string, unknown>;
    };
    if (!schema?.properties) continue;

    const policies = FIELD_POLICIES[schemaName];
    if (!policies) {
      errors.push(`Schema '${schemaName}' has no FIELD_POLICIES entry`);
      continue;
    }

    const schemaFields = Object.keys(schema.properties);
    const policyFields = new Set(
      Object.keys(policies).filter((k) => k !== '_envelope'),
    );

    // Check schema fields have policy entries
    for (const field of schemaFields) {
      if (!policyFields.has(field)) {
        errors.push(
          `Schema '${schemaName}' field '${field}' missing from FIELD_POLICIES`,
        );
      }
    }

    // Check policy entries have schema fields (no stale entries)
    for (const field of policyFields) {
      if (!(field in schema.properties)) {
        errors.push(
          `FIELD_POLICIES '${schemaName}' has field '${field}' not in schema`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Field policy sync check failed:\n  ${errors.join('\n  ')}`,
    );
  }
}
