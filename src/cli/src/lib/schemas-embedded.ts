/**
 * Embedded JSON Schema registry.
 *
 * esbuild inlines these JSON imports at bundle time.
 * At runtime there are no filesystem reads for schemas.
 */

import _defs from '../../../../docs/protocol/schemas/_defs.schema.json';
import debtRegister from '../../../../docs/protocol/schemas/debt-register.schema.json';
import designBrief from '../../../../docs/protocol/schemas/design-brief.schema.json';
import evidence from '../../../../docs/protocol/schemas/evidence.schema.json';
import gapAssessment from '../../../../docs/protocol/schemas/gap-assessment.schema.json';
import healthCheck from '../../../../docs/protocol/schemas/health-check.schema.json';
import lockManifest from '../../../../docs/protocol/schemas/lock-manifest.schema.json';
import missionSpec from '../../../../docs/protocol/schemas/mission-spec.schema.json';
import phaseReview from '../../../../docs/protocol/schemas/phase-review.schema.json';
import policyOverride from '../../../../docs/protocol/schemas/policy-override.schema.json';
import record from '../../../../docs/protocol/schemas/record.schema.json';
import recoveryPacket from '../../../../docs/protocol/schemas/recovery-packet.schema.json';
import rulesUpdate from '../../../../docs/protocol/schemas/rules-update.schema.json';
import runState from '../../../../docs/protocol/schemas/run-state.schema.json';
import taskContract from '../../../../docs/protocol/schemas/task-contract.schema.json';
import voteRound from '../../../../docs/protocol/schemas/vote-round.schema.json';

export const DEFS_SCHEMA = _defs;

export const SCHEMAS: Record<string, unknown> = {
  'debt-register': debtRegister,
  'design-brief': designBrief,
  'evidence': evidence,
  'gap-assessment': gapAssessment,
  'health-check': healthCheck,
  'lock-manifest': lockManifest,
  'mission-spec': missionSpec,
  'phase-review': phaseReview,
  'policy-override': policyOverride,
  'record': record,
  'recovery-packet': recoveryPacket,
  'rules-update': rulesUpdate,
  'run-state': runState,
  'task-contract': taskContract,
  'vote-round': voteRound,
};
