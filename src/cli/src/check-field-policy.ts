/**
 * Build-time sync check — validates that FIELD_POLICIES covers every
 * field in every embedded schema, and vice versa.
 *
 * Called as part of `npm run build` to catch schema drift early.
 * Exit code 0 = pass, 1 = mismatch found.
 */

import { validateFieldPolicySync } from './lib/field-policy';

try {
  validateFieldPolicySync();
  console.log('[field-policy] Sync check passed.');
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
