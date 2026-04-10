import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { injectEnvelope } from '../lib/envelope';

describe('injectEnvelope', () => {
  it('injects all envelope fields when missing', () => {
    const data: Record<string, unknown> = { task_id: 'task-001' };
    const result = injectEnvelope('task_contract', data);

    assert.equal(result.version, '1.0');
    assert.equal(result.artifact_type, 'task_contract');
    assert.equal(result.producer_type, 'orchestration-authority');
    assert.equal(result.artifact_id, 'tc-task-001');
  });

  it('no-clobber: preserves explicit values', () => {
    const data: Record<string, unknown> = {
      task_id: 'task-001',
      version: '2.0',
      artifact_type: 'custom_type',
      producer_type: 'custom-producer',
      artifact_id: 'custom-id',
    };
    const result = injectEnvelope('task_contract', data);

    assert.equal(result.version, '2.0');
    assert.equal(result.artifact_type, 'custom_type');
    assert.equal(result.producer_type, 'custom-producer');
    assert.equal(result.artifact_id, 'custom-id');
  });

  it('artifact_id generation per type', () => {
    // task_contract: tc-{task_id}
    const tc = injectEnvelope('task_contract', { task_id: 'task-042' });
    assert.equal(tc.artifact_id, 'tc-task-042');

    // mission_spec: spec-{mission_id}
    const spec = injectEnvelope('mission_spec', {}, { mission_id: 'mission-123' });
    assert.equal(spec.artifact_id, 'spec-mission-123');

    // design_brief: brief-{mission_id}
    const brief = injectEnvelope('design_brief', {}, { mission_id: 'mission-456' });
    assert.equal(brief.artifact_id, 'brief-mission-456');

    // phase_review: phase-{mission_phase}-{timestamp}
    const phase = injectEnvelope('phase_review', { mission_phase: 'building' });
    assert.ok(
      (phase.artifact_id as string).startsWith('phase-building-'),
      `phase artifact_id should start with 'phase-building-', got '${phase.artifact_id}'`,
    );
  });

  it('unknown artifact type returns data unchanged', () => {
    const data: Record<string, unknown> = { foo: 'bar' };
    const result = injectEnvelope('nonexistent_type', data);

    assert.deepStrictEqual(result, { foo: 'bar' });
    assert.equal((result as Record<string, unknown>).version, undefined);
    assert.equal((result as Record<string, unknown>).artifact_type, undefined);
  });
});
