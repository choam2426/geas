/**
 * Tests for the dry-run utility (dryRunGuard + dryRunParseError).
 *
 * These are unit tests that mock process.stdout.write and process.exit
 * to capture output and exit codes without actually terminating.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';

// We need to intercept process.exit and process.stdout.write
// since dryRunGuard calls them directly.

describe('dryRunGuard', () => {
  let originalExit: typeof process.exit;
  let originalStdoutWrite: typeof process.stdout.write;
  let capturedOutput: string;
  let capturedExitCode: number | undefined;

  beforeEach(() => {
    capturedOutput = '';
    capturedExitCode = undefined;
    originalExit = process.exit;
    originalStdoutWrite = process.stdout.write;

    // Mock process.exit to capture exit code and throw to prevent further execution
    process.exit = ((code?: number) => {
      capturedExitCode = code ?? 0;
      throw new Error(`EXIT_${code}`);
    }) as typeof process.exit;

    // Mock process.stdout.write to capture output
    process.stdout.write = ((chunk: string | Uint8Array) => {
      capturedOutput += typeof chunk === 'string' ? chunk : chunk.toString();
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
  });

  it('returns immediately when dryRun is false (noop)', async () => {
    const { dryRunGuard } = await import('../lib/dry-run');
    // Should not throw, not exit, not write output
    dryRunGuard(false, { foo: 'bar' }, 'task-contract');
    assert.equal(capturedOutput, '');
    assert.equal(capturedExitCode, undefined);
  });

  it('outputs valid result for correct schema data', async () => {
    const { dryRunGuard } = await import('../lib/dry-run');

    // Build a minimal valid task-contract payload (all required fields)
    // Envelope fields (version, artifact_type, producer_type, artifact_id)
    // are NOT schema properties — they are injected externally.
    const validData = {
      task_id: 'task-001',
      title: 'Test task',
      goal: 'Test goal',
      task_kind: 'implementation',
      risk_level: 'low',
      gate_profile: 'implementation_change',
      acceptance_criteria: ['AC1'],
      status: 'drafted',
      vote_round_policy: 'never',
      eval_commands: [],
      rubric: { dimensions: [{ name: 'correctness', threshold: 1 }] },
      retry_budget: 3,
      scope: { surfaces: [] },
      routing: { primary_worker_slot: 'implementer', required_reviewer_slots: ['quality'] },
      base_snapshot: '',
    };

    try {
      dryRunGuard(true, validData, 'task-contract');
    } catch (e: unknown) {
      // Expected: process.exit throws
    }

    const parsed = JSON.parse(capturedOutput.trim());
    assert.equal(parsed.dry_run, true);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.schema, 'task-contract');
    assert.equal(capturedExitCode, 0);
  });

  it('outputs invalid result with errors for bad schema data', async () => {
    const { dryRunGuard } = await import('../lib/dry-run');

    // Missing required fields
    const invalidData = { summary: 'incomplete' };

    try {
      dryRunGuard(true, invalidData, 'task-contract');
    } catch (e: unknown) {
      // Expected: process.exit throws
    }

    const parsed = JSON.parse(capturedOutput.trim());
    assert.equal(parsed.dry_run, true);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.schema, 'task-contract');
    assert.ok(Array.isArray(parsed.errors));
    assert.ok(parsed.errors.length > 0);
    assert.equal(capturedExitCode, 1);
  });

  it('handles null schema (no-schema mode) for decision write', async () => {
    const { dryRunGuard } = await import('../lib/dry-run');

    try {
      dryRunGuard(true, { decision_id: 'd1', outcome: 'approved' }, null);
    } catch (e: unknown) {
      // Expected: process.exit throws
    }

    const parsed = JSON.parse(capturedOutput.trim());
    assert.equal(parsed.dry_run, true);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.schema, null);
    assert.equal(parsed.note, 'no schema validation for this command');
    assert.equal(capturedExitCode, 0);
  });
});

describe('dryRunParseError', () => {
  let originalExit: typeof process.exit;
  let originalStdoutWrite: typeof process.stdout.write;
  let capturedOutput: string;
  let capturedExitCode: number | undefined;

  beforeEach(() => {
    capturedOutput = '';
    capturedExitCode = undefined;
    originalExit = process.exit;
    originalStdoutWrite = process.stdout.write;

    process.exit = ((code?: number) => {
      capturedExitCode = code ?? 0;
      throw new Error(`EXIT_${code}`);
    }) as typeof process.exit;

    process.stdout.write = ((chunk: string | Uint8Array) => {
      capturedOutput += typeof chunk === 'string' ? chunk : chunk.toString();
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
  });

  it('outputs structured parse error and exits 1', async () => {
    const { dryRunParseError } = await import('../lib/dry-run');

    try {
      dryRunParseError('Invalid JSON on stdin: Unexpected token');
    } catch (e: unknown) {
      // Expected: process.exit throws
    }

    const parsed = JSON.parse(capturedOutput.trim());
    assert.equal(parsed.dry_run, true);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.error, 'Invalid JSON on stdin: Unexpected token');
    assert.equal(capturedExitCode, 1);
  });
});
