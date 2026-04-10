import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { listSchemas, generateTemplate } from '../lib/schema-template';

describe('listSchemas', () => {
  it('returns all 15 schema types', () => {
    const schemas = listSchemas();
    assert.equal(schemas.length, 15);
  });

  it('returns sorted list', () => {
    const schemas = listSchemas();
    const sorted = [...schemas].sort();
    assert.deepStrictEqual(schemas, sorted);
  });
});

describe('generateTemplate', () => {
  it('produces an object for every schema type', () => {
    const schemas = listSchemas();
    for (const name of schemas) {
      const template = generateTemplate(name);
      assert.equal(typeof template, 'object', `${name} should produce an object`);
      assert.notEqual(template, null, `${name} should not be null`);
    }
  });

  it('task-contract template has all required fields', () => {
    const template = generateTemplate('task-contract') as Record<string, unknown>;
    const expectedFields = [
      'version', 'artifact_type', 'task_id', 'title', 'goal',
      'task_kind', 'risk_level', 'gate_profile', 'acceptance_criteria',
      'eval_commands', 'rubric', 'retry_budget', 'scope', 'routing',
      'base_snapshot', 'status',
    ];
    for (const field of expectedFields) {
      assert.ok(field in template, `task-contract template should have field '${field}'`);
    }
  });

  it('evidence base template has 5 required fields', () => {
    const template = generateTemplate('evidence') as Record<string, unknown>;
    const requiredBase = ['version', 'agent', 'task_id', 'role', 'summary'];
    for (const field of requiredBase) {
      assert.ok(field in template, `evidence template should have base field '${field}'`);
    }
  });

  it('evidence --role implementer adds files_changed', () => {
    const template = generateTemplate('evidence', { role: 'implementer' }) as Record<string, unknown>;
    assert.ok('files_changed' in template, 'implementer evidence should have files_changed');
    assert.equal(template.role, 'implementer');
  });

  it('evidence --role reviewer adds verdict and concerns', () => {
    const template = generateTemplate('evidence', { role: 'reviewer' }) as Record<string, unknown>;
    assert.ok('verdict' in template, 'reviewer evidence should have verdict');
    assert.ok('concerns' in template, 'reviewer evidence should have concerns');
    assert.equal(template.role, 'reviewer');
  });

  it('record template has version and task_id', () => {
    const template = generateTemplate('record') as Record<string, unknown>;
    assert.ok('version' in template, 'record template should have version');
    assert.ok('task_id' in template, 'record template should have task_id');
  });

  it('throws error for unknown schema with available types', () => {
    assert.throws(
      () => generateTemplate('nonexistent-schema'),
      (err: Error) => {
        assert.ok(err.message.includes('Unknown schema type'));
        assert.ok(err.message.includes('Available:'));
        assert.ok(err.message.includes('task-contract'));
        return true;
      },
    );
  });

  it('$ref resolution produces string values, not $ref objects', () => {
    const template = generateTemplate('task-contract') as Record<string, unknown>;
    // producer_type comes from a $ref to _defs.schema.json
    // It should be a resolved string value, not a { $ref: ... } object
    assert.notEqual(typeof template.producer_type, 'object',
      'producer_type should be resolved from $ref, not remain as object');
    if (template.producer_type !== undefined) {
      assert.equal(typeof template.producer_type, 'string',
        'producer_type should be a string after $ref resolution');
    }
  });
});
