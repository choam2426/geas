/**
 * Envelope field auto-injection for schema-validated artifacts.
 *
 * Injects version, artifact_type, producer_type, and artifact_id
 * into artifact data BEFORE schema validation, so agents don't need
 * to supply const fields manually.
 *
 * No-clobber: only sets a field when it is undefined in the input.
 * enrichTimestamp remains sole owner of created_at/updated_at.
 * Evidence is excluded (trust boundary — metadata from CLI flags).
 */

import { getEnvelopeEntry } from './field-policy';

/**
 * Inject envelope fields into artifact data before validation.
 * Mutates `data` in place. No-clobber: only sets when undefined.
 *
 * @param artifactType - Registry key (e.g. 'task_contract')
 * @param data - The artifact data object (mutated in place)
 * @param context - Optional context with mission_id for ID generation
 * @returns The same data object with envelope fields injected
 */
export function injectEnvelope(
  artifactType: string,
  data: Record<string, unknown>,
  context?: { mission_id?: string },
): Record<string, unknown> {
  const entry = getEnvelopeEntry(artifactType);
  if (!entry) return data;

  if (data.version === undefined) data.version = entry.version;
  if (data.artifact_type === undefined) data.artifact_type = entry.artifact_type;
  if (data.producer_type === undefined) data.producer_type = entry.producer_type;
  if (data.artifact_id === undefined) {
    data.artifact_id = entry.artifact_id_fn(data, context || {});
  }

  return data;
}
