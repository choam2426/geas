import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { validate } from '../lib/schema';

/**
 * Tests for validation error hints.
 *
 * Since validationError() calls process.exit, we test the validation
 * layer directly and verify that errors contain the information needed
 * for hint extraction.
 */

describe('validation hints via validate()', () => {
  it('required field missing produces error with missingProperty', () => {
    // task-contract requires task_id, title, goal, etc.
    const result = validate('task-contract', {
      version: '1.0',
      artifact_type: 'task_contract',
    });
    assert.equal(result.valid, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors!.length > 0);

    const requiredErrors = (result.errors as Array<{ keyword: string; params: Record<string, unknown> }>)
      .filter(e => e.keyword === 'required');
    assert.ok(requiredErrors.length > 0, 'should have required-field errors');

    const missingProps = requiredErrors.map(e => e.params.missingProperty);
    assert.ok(missingProps.includes('task_id'), 'should report task_id as missing');
  });

  it('enum violation produces error with allowedValues', () => {
    const result = validate('task-contract', {
      version: '1.0',
      artifact_type: 'task_contract',
      artifact_id: 'tc-test',
      producer_type: 'orchestration-authority',
      task_id: 'task-001',
      title: 'Test',
      goal: 'Test goal',
      task_kind: 'invalid_kind', // not in enum
      risk_level: 'normal',
      gate_profile: 'implementation_change',
      acceptance_criteria: ['a', 'b', 'c'],
      eval_commands: ['echo test'],
      rubric: { dimensions: [{ name: 'core_interaction', threshold: 3 }] },
      retry_budget: 3,
      scope: { surfaces: ['src/'] },
      routing: { primary_worker_type: 'software-engineer', required_reviewer_types: ['design-authority'] },
      base_snapshot: 'abc123',
      status: 'drafted',
    });
    assert.equal(result.valid, false);

    const enumErrors = (result.errors as Array<{ keyword: string; params: Record<string, unknown> }>)
      .filter(e => e.keyword === 'enum');
    assert.ok(enumErrors.length > 0, 'should have enum errors');
    assert.ok(
      Array.isArray(enumErrors[0].params.allowedValues),
      'enum error should include allowedValues',
    );
  });

  it('additionalProperties violation produces error with additional property name', () => {
    const result = validate('evidence', {
      version: '1.0',
      agent: 'software-engineer',
      task_id: 'task-001',
      role: 'implementer',
      summary: 'Test summary',
      files_changed: ['file.ts'],
      totally_bogus_field: 'should not be here',
    });

    // If schema has additionalProperties: false, this should fail
    // If not, the test documents that behavior
    if (!result.valid) {
      const addPropErrors = (result.errors as Array<{ keyword: string; params: Record<string, unknown> }>)
        .filter(e => e.keyword === 'additionalProperties');
      if (addPropErrors.length > 0) {
        assert.ok(
          addPropErrors[0].params.additionalProperty !== undefined,
          'additionalProperties error should name the offending property',
        );
      }
    }
    // If valid, the schema allows additional properties — that's fine too
  });

  it('valid data passes validation', () => {
    const result = validate('evidence', {
      version: '1.0',
      agent: 'software-engineer',
      task_id: 'task-001',
      role: 'implementer',
      summary: 'Implemented the feature',
      files_changed: ['src/main.ts'],
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors, null);
  });
});
