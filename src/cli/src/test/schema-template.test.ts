import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { listSchemas, generateTemplate, listRecordSections } from '../lib/schema-template';

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

  it('task-contract template has required non-envelope fields (stripped by default)', () => {
    const template = generateTemplate('task-contract') as Record<string, unknown>;
    const expectedFields = [
      'title', 'goal',
      'task_kind', 'risk_level', 'gate_profile', 'acceptance_criteria',
      'eval_commands', 'rubric', 'retry_budget', 'scope', 'routing',
      'base_snapshot', 'status',
    ];
    for (const field of expectedFields) {
      assert.ok(field in template, `task-contract template should have field '${field}'`);
    }
    // Envelope fields should be stripped
    assert.ok(!('version' in template), 'version should be stripped');
    assert.ok(!('artifact_type' in template), 'artifact_type should be stripped');
    // CLI-flag fields should be stripped
    assert.ok(!('task_id' in template), 'task_id should be stripped');
  });

  it('task-contract template with stripEnvelope=false has all fields', () => {
    const template = generateTemplate('task-contract', { stripEnvelope: false }) as Record<string, unknown>;
    assert.ok('version' in template, 'should have version when not stripping');
    assert.ok('artifact_type' in template, 'should have artifact_type when not stripping');
    assert.ok('task_id' in template, 'should have task_id when not stripping');
  });

  it('evidence base template has summary (envelope/CLI fields stripped)', () => {
    const template = generateTemplate('evidence') as Record<string, unknown>;
    assert.ok('summary' in template, 'evidence template should have summary');
    // Envelope and CLI-flag fields stripped by default
    assert.ok(!('version' in template), 'version should be stripped');
    assert.ok(!('agent' in template), 'agent should be stripped (CLI flag)');
    assert.ok(!('task_id' in template), 'task_id should be stripped (CLI flag)');
    assert.ok(!('role' in template), 'role should be stripped (CLI flag)');
  });

  it('evidence with stripEnvelope=false has all fields', () => {
    const template = generateTemplate('evidence', { stripEnvelope: false }) as Record<string, unknown>;
    const requiredBase = ['version', 'agent', 'task_id', 'role', 'summary'];
    for (const field of requiredBase) {
      assert.ok(field in template, `evidence template should have base field '${field}'`);
    }
  });

  it('evidence --role implementer adds files_changed', () => {
    const template = generateTemplate('evidence', { role: 'implementer' }) as Record<string, unknown>;
    assert.ok('files_changed' in template, 'implementer evidence should have files_changed');
    // role is stripped since it is a CLI flag field
    assert.ok(!('role' in template), 'role should be stripped (CLI flag)');
  });

  it('evidence --role reviewer adds verdict and concerns', () => {
    const template = generateTemplate('evidence', { role: 'reviewer' }) as Record<string, unknown>;
    assert.ok('verdict' in template, 'reviewer evidence should have verdict');
    assert.ok('concerns' in template, 'reviewer evidence should have concerns');
    // role is stripped since it is a CLI flag field
    assert.ok(!('role' in template), 'role should be stripped (CLI flag)');
  });

  it('record template has no envelope fields by default', () => {
    const template = generateTemplate('record') as Record<string, unknown>;
    assert.ok(!('version' in template), 'version should be stripped');
    assert.ok(!('task_id' in template), 'task_id should be stripped');
  });

  it('record template with stripEnvelope=false has version and task_id', () => {
    const template = generateTemplate('record', { stripEnvelope: false }) as Record<string, unknown>;
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
    // Use stripEnvelope=false to keep producer_type
    const template = generateTemplate('task-contract', { stripEnvelope: false }) as Record<string, unknown>;
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

describe('--strip-envelope behavior', () => {
  it('strips envelope fields by default', () => {
    const template = generateTemplate('task-contract') as Record<string, unknown>;
    for (const field of ['version', 'artifact_type', 'producer_type', 'artifact_id', 'created_at', 'updated_at']) {
      assert.ok(!(field in template), `${field} should be stripped by default`);
    }
  });

  it('strips CLI-flag fields by default', () => {
    const template = generateTemplate('evidence') as Record<string, unknown>;
    for (const field of ['agent', 'task_id', 'role']) {
      assert.ok(!(field in template), `${field} should be stripped by default`);
    }
  });

  it('keeps all fields when stripEnvelope=false', () => {
    const template = generateTemplate('task-contract', { stripEnvelope: false }) as Record<string, unknown>;
    assert.ok('version' in template);
    assert.ok('artifact_type' in template);
    assert.ok('task_id' in template);
  });
});

describe('--section for record sub-schemas', () => {
  it('extracts implementation_contract section', () => {
    const template = generateTemplate('record', { section: 'implementation_contract' }) as Record<string, unknown>;
    assert.ok('planned_actions' in template, 'should have planned_actions');
    assert.ok('non_goals' in template, 'should have non_goals');
    assert.ok('status' in template, 'should have status');
    // Should NOT have envelope fields
    assert.ok(!('version' in template));
    assert.ok(!('task_id' in template));
  });

  it('extracts self_check section', () => {
    const template = generateTemplate('record', { section: 'self_check' }) as Record<string, unknown>;
    assert.ok('confidence' in template, 'should have confidence');
    assert.ok('summary' in template, 'should have summary');
    assert.ok('known_risks' in template, 'should have known_risks');
    assert.ok('untested_paths' in template, 'should have untested_paths');
  });

  it('extracts verdict section', () => {
    const template = generateTemplate('record', { section: 'verdict' }) as Record<string, unknown>;
    assert.ok('verdict' in template, 'should have verdict');
    assert.ok('rationale' in template, 'should have rationale');
  });

  it('throws for invalid section name with valid list', () => {
    assert.throws(
      () => generateTemplate('record', { section: 'nonexistent' }),
      (err: Error) => {
        assert.ok(err.message.includes('Unknown record section'));
        assert.ok(err.message.includes('Valid sections:'));
        assert.ok(err.message.includes('implementation_contract'));
        return true;
      },
    );
  });

  it('throws when --section used with non-record schema', () => {
    assert.throws(
      () => generateTemplate('evidence', { section: 'self_check' }),
      (err: Error) => {
        assert.ok(err.message.includes('only valid for'));
        return true;
      },
    );
  });
});

describe('listRecordSections', () => {
  it('returns valid section names without envelope fields', () => {
    const sections = listRecordSections();
    assert.ok(sections.length > 0, 'should have sections');
    assert.ok(sections.includes('implementation_contract'));
    assert.ok(sections.includes('self_check'));
    assert.ok(sections.includes('gate_result'));
    // Should not include envelope fields
    assert.ok(!sections.includes('version'));
    assert.ok(!sections.includes('task_id'));
    assert.ok(!sections.includes('created_at'));
  });
});

describe('template output is valid JSON', () => {
  it('all templates produce JSON-serializable output', () => {
    const schemas = listSchemas();
    for (const name of schemas) {
      const template = generateTemplate(name);
      const json = JSON.stringify(template);
      const parsed = JSON.parse(json);
      assert.deepStrictEqual(parsed, template, `${name} should round-trip through JSON`);
    }
  });

  it('section templates produce JSON-serializable output', () => {
    const sections = listRecordSections();
    for (const section of sections) {
      const template = generateTemplate('record', { section });
      const json = JSON.stringify(template);
      const parsed = JSON.parse(json);
      assert.deepStrictEqual(parsed, template, `section '${section}' should round-trip through JSON`);
    }
  });
});
