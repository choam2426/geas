#!/usr/bin/env node
/**
 * E2E Integration Test for Geas CLI
 *
 * Exercises a complete mission lifecycle: create mission, update state,
 * log events, acquire/release locks, create tasks, transition status,
 * record evidence, add debt, generate health check, and clear checkpoints.
 *
 * Usage: node plugin/cli/test/integration.js
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLI = path.resolve(__dirname, '..', 'index.js');
const MISSION_ID = 'test-mission-001';

/** Create a fresh temp directory with the required .geas/ structure. */
function createTempDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'geas-integration-'));
  const geas = path.join(tmp, '.geas');

  const dirs = [
    'state',
    'state/task-focus',
    'ledger',
    'summaries',
    'memory/_project',
    'memory/agents',
    'memory/candidates',
    'memory/entries',
    'memory/logs',
    'memory/retro',
    'memory/incidents',
    'recovery',
  ];

  for (const d of dirs) {
    fs.mkdirSync(path.join(geas, d), { recursive: true });
  }

  // Seed run.json so state commands work
  const runState = {
    version: '1.0',
    status: 'initialized',
    mission: null,
    mission_id: null,
    phase: null,
    current_task_id: null,
    completed_tasks: [],
    decisions: [],
    checkpoint: null,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  fs.writeFileSync(
    path.join(geas, 'state', 'run.json'),
    JSON.stringify(runState, null, 2),
  );

  // Seed empty memory-index.json
  const memoryIndex = {
    version: '1.0',
    artifact_type: 'memory_index',
    artifact_id: 'memory-index',
    producer_type: 'orchestration_authority',
    entries: [],
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  fs.writeFileSync(
    path.join(geas, 'state', 'memory-index.json'),
    JSON.stringify(memoryIndex, null, 2),
  );

  return tmp;
}

/** Run a CLI command in the given cwd and return parsed JSON. Throws on non-zero exit. */
function run(cmd, cwd) {
  const fullCmd = `node "${CLI}" ${cmd}`;
  const stdout = execSync(fullCmd, {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout.trim());
}

/**
 * Run a CLI command that uses --cwd for directory isolation.
 * Some commands (state, mission, event, lock) respect --cwd.
 */
function runWithCwd(cmd, cwd) {
  return run(`--cwd "${cwd}" ${cmd}`, cwd);
}

// ---------------------------------------------------------------------------
// Minimal task contract JSON that passes schema validation
// ---------------------------------------------------------------------------

const TASK_CONTRACT = {
  version: '1.0',
  artifact_type: 'task_contract',
  artifact_id: 'task-contract-task-001',
  producer_type: 'orchestration_authority',
  created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  task_id: 'task-001',
  title: 'Integration test task',
  goal: 'Verify CLI end-to-end workflow',
  task_kind: 'implementation',
  risk_level: 'low',
  gate_profile: 'implementation_change',
  vote_round_policy: 'never',
  acceptance_criteria: ['Test passes'],
  eval_commands: ['echo ok'],
  rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
  retry_budget: 3,
  scope: { surfaces: ['test/'] },
  routing: {
    primary_worker_type: 'software_engineer',
    required_reviewer_types: ['design_authority'],
  },
  base_snapshot: 'abc123',
  status: 'drafted',
};

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

/**
 * Each test is { name, fn }.
 * fn(tmpDir) must return the parsed JSON result (or throw).
 */
function defineTests(tmpDir) {
  return [
    {
      name: 'mission create',
      fn: () => runWithCwd(`mission create --id ${MISSION_ID}`, tmpDir),
      validate: (r) => r.created != null && Array.isArray(r.subdirectories),
    },
    {
      name: 'state update mission_id',
      fn: () =>
        runWithCwd(
          `state update --field mission_id --value ${MISSION_ID}`,
          tmpDir,
        ),
      validate: (r) => r.updated === 'mission_id',
    },
    {
      name: 'state update phase',
      fn: () =>
        runWithCwd('state update --field phase --value building', tmpDir),
      validate: (r) => r.updated === 'phase' && r.value === 'building',
    },
    {
      name: 'state checkpoint set',
      fn: () =>
        runWithCwd(
          'state checkpoint set --step implementation --agent software-engineer',
          tmpDir,
        ),
      validate: (r) =>
        r.checkpoint != null &&
        r.checkpoint.pipeline_step === 'implementation',
    },
    {
      name: 'event log',
      fn: () =>
        runWithCwd(
          'event log --type task_started --task task-001',
          tmpDir,
        ),
      validate: (r) =>
        r.appended === true && r.event.event_type === 'task_started',
    },
    {
      name: 'lock acquire',
      fn: () =>
        runWithCwd(
          'lock acquire --task task-001 --type path --targets "src/foo.ts"',
          tmpDir,
        ),
      validate: (r) =>
        r.acquired === true && r.lock.task_id === 'task-001',
    },
    {
      name: 'task create',
      fn: () => {
        const data = JSON.stringify(TASK_CONTRACT).replace(/"/g, '\\"');
        return runWithCwd(
          `task create --mission ${MISSION_ID} --data "${data}"`,
          tmpDir,
        );
      },
      validate: (r) =>
        r.task_id === 'task-001' && r.artifact_type === 'task_contract',
    },
    {
      name: 'task transition (drafted -> ready)',
      fn: () =>
        runWithCwd(
          `task transition --mission ${MISSION_ID} --id task-001 --to ready`,
          tmpDir,
        ),
      validate: (r) =>
        r.previous_status === 'drafted' && r.status === 'ready',
    },
    {
      name: 'create implementation contract stub (for ready->implementing guard)',
      fn: () => {
        // The ready->implementing guard requires contracts/{taskId}.json with status "approved"
        const contractDir = path.join(tmpDir, '.geas', 'missions', MISSION_ID, 'contracts');
        fs.mkdirSync(contractDir, { recursive: true });
        const contract = {
          version: '1.0',
          artifact_type: 'implementation_contract',
          artifact_id: 'impl-contract-task-001',
          task_id: 'task-001',
          status: 'approved',
          created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        };
        fs.writeFileSync(
          path.join(contractDir, 'task-001.json'),
          JSON.stringify(contract, null, 2),
        );
        return { created: true, path: path.join(contractDir, 'task-001.json') };
      },
      validate: (r) => r.created === true,
    },
    {
      name: 'task transition (ready -> implementing)',
      fn: () =>
        runWithCwd(
          `task transition --mission ${MISSION_ID} --id task-001 --to implementing`,
          tmpDir,
        ),
      validate: (r) =>
        r.previous_status === 'ready' && r.status === 'implementing',
    },
    {
      name: 'evidence record',
      fn: () =>
        run(
          `evidence record --mission ${MISSION_ID} --task task-001 --agent test-agent --data "{\\"test\\":true}"`,
          tmpDir,
        ),
      validate: (r) =>
        r.task_id === 'task-001' && r.agent === 'test-agent',
    },
    {
      name: 'debt add',
      fn: () =>
        run(
          `debt add --mission ${MISSION_ID} --title "test debt" --severity low --kind output_quality --task task-001 --owner software_engineer`,
          tmpDir,
        ),
      validate: (r) => r.added === true && r.debt_id === 'DEBT-001',
    },
    {
      name: 'lock release',
      fn: () =>
        runWithCwd('lock release --task task-001', tmpDir),
      validate: (r) => r.released === 1 && r.task_id === 'task-001',
    },
    {
      name: 'health generate',
      fn: () => run('health generate', tmpDir),
      validate: (r) =>
        r.ok === true && Array.isArray(r.signals) && r.signals.length === 8,
    },
    {
      name: 'state checkpoint clear',
      fn: () =>
        runWithCwd('state checkpoint clear', tmpDir),
      validate: (r) =>
        r.checkpoint != null && r.checkpoint.pipeline_step === null,
    },
    {
      name: 'state read (verify final state)',
      fn: () => runWithCwd('state read', tmpDir),
      validate: (r) =>
        r.mission_id === MISSION_ID && r.phase === 'building',
    },
    {
      name: 'task list',
      fn: () =>
        runWithCwd(
          `task list --mission ${MISSION_ID}`,
          tmpDir,
        ),
      validate: (r) =>
        Array.isArray(r) && r.length === 1 && r[0].task_id === 'task-001',
    },
    {
      name: 'lock list (empty after release)',
      fn: () => runWithCwd('lock list', tmpDir),
      validate: (r) => r.count === 0,
    },
    {
      name: 'debt list',
      fn: () =>
        run(`debt list --mission ${MISSION_ID}`, tmpDir),
      validate: (r) =>
        r.total === 1 && r.items[0].debt_id === 'DEBT-001',
    },
    {
      name: 'updated_at injected on existing file update',
      fn: () => {
        // run.json already exists; updating it should inject updated_at
        // Use a neutral field update so we don't change phase (used by later tests)
        runWithCwd('state update --field status --value active', tmpDir);
        const runJson = JSON.parse(
          fs.readFileSync(
            path.join(tmpDir, '.geas', 'state', 'run.json'),
            'utf-8',
          ),
        );
        return runJson;
      },
      validate: (r) =>
        typeof r.updated_at === 'string' &&
        /^\d{4}-\d{2}-\d{2}T/.test(r.updated_at) &&
        typeof r.created_at === 'string',
    },
    {
      name: 'JSONL timestamp auto-injected on event log',
      fn: () => {
        // Log a fresh event and read the last line of the events JSONL
        runWithCwd(
          'event log --type timestamp_test --task task-001',
          tmpDir,
        );
        const eventsPath = path.join(tmpDir, '.geas', 'state', 'events.jsonl');
        const lines = fs
          .readFileSync(eventsPath, 'utf-8')
          .trim()
          .split('\n');
        const last = JSON.parse(lines[lines.length - 1]);
        return last;
      },
      validate: (r) =>
        typeof r.timestamp === 'string' &&
        /^\d{4}-\d{2}-\d{2}T/.test(r.timestamp),
    },
  ];
}

// ---------------------------------------------------------------------------
// Phase 5: --cwd support (directory isolation tests)
// ---------------------------------------------------------------------------

/**
 * Test that --cwd allows running commands from a directory that does NOT
 * contain .geas/, pointing to a directory that DOES contain .geas/.
 *
 * Also verifies that running WITHOUT --cwd from the separate directory
 * correctly fails (because there is no .geas/ there).
 */
function defineCwdTests(mainDir) {
  // Create a separate temp directory with NO .geas/ structure
  const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geas-cwd-test-'));

  return {
    worktreeDir,
    tests: [
      // --- Positive tests: --cwd should resolve to mainDir ---
      {
        name: '[cwd] evidence read with --cwd (from worktree)',
        fn: () => {
          const fullCmd = `node "${CLI}" --cwd "${mainDir}" evidence read --mission ${MISSION_ID} --task task-001`;
          const stdout = execSync(fullCmd, {
            cwd: worktreeDir,
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return JSON.parse(stdout.trim());
        },
        validate: (r) =>
          r.mission_id === MISSION_ID &&
          r.task_id === 'task-001' &&
          Array.isArray(r.agents),
      },
      {
        name: '[cwd] debt list with --cwd (from worktree)',
        fn: () => {
          const fullCmd = `node "${CLI}" --cwd "${mainDir}" debt list --mission ${MISSION_ID}`;
          const stdout = execSync(fullCmd, {
            cwd: worktreeDir,
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return JSON.parse(stdout.trim());
        },
        validate: (r) =>
          r.mission_id === MISSION_ID &&
          r.total === 1 &&
          r.items[0].debt_id === 'DEBT-001',
      },
      {
        name: '[cwd] state read with --cwd (from worktree)',
        fn: () => {
          const fullCmd = `node "${CLI}" --cwd "${mainDir}" state read`;
          const stdout = execSync(fullCmd, {
            cwd: worktreeDir,
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return JSON.parse(stdout.trim());
        },
        validate: (r) =>
          r.mission_id === MISSION_ID && r.phase === 'building',
      },

      // --- Negative tests: WITHOUT --cwd should fail from worktree ---
      {
        name: '[cwd] evidence read WITHOUT --cwd fails from worktree',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" evidence read --mission ${MISSION_ID} --task task-001`,
              {
                cwd: worktreeDir,
                encoding: 'utf-8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
              },
            );
            // If it did not throw, check if the output is an error response
            return { failed_as_expected: false };
          } catch {
            // Command failed (non-zero exit) — this is expected
            return { failed_as_expected: true };
          }
        },
        validate: (r) => r.failed_as_expected === true,
      },
      {
        name: '[cwd] debt list WITHOUT --cwd fails from worktree',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" debt list --mission ${MISSION_ID}`,
              {
                cwd: worktreeDir,
                encoding: 'utf-8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
              },
            );
            return { failed_as_expected: false };
          } catch {
            return { failed_as_expected: true };
          }
        },
        validate: (r) => r.failed_as_expected === true,
      },
      {
        name: '[cwd] state read WITHOUT --cwd fails from worktree',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" state read`,
              {
                cwd: worktreeDir,
                encoding: 'utf-8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe'],
              },
            );
            return { failed_as_expected: false };
          } catch {
            return { failed_as_expected: true };
          }
        },
        validate: (r) => r.failed_as_expected === true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 7: Transition and Phase Guards
// ---------------------------------------------------------------------------

/**
 * Tests for transition guards (artifact-existence checks) and phase guards
 * (gate criteria checks). Each guard has positive and negative test pairs.
 */
function defineGuardTests(tmpDir) {
  // Use a separate mission so guard tests don't interfere with Phase 1-5 state
  const GUARD_MISSION = 'guard-test-mission';

  return {
    setup: () => {
      // Create mission via CLI first, then ensure extra subdirectories exist
      runWithCwd(`mission create --id ${GUARD_MISSION}`, tmpDir);
      const missionDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION);
      const dirs = ['tasks', 'contracts', 'evidence', 'phase-reviews', 'evolution'];
      for (const d of dirs) {
        fs.mkdirSync(path.join(missionDir, d), { recursive: true });
      }
    },
    tests: [
      // ── Transition guard: drafted -> ready (negative) ──
      {
        name: '[guard] drafted->ready negative: missing risk_level blocks transition',
        fn: () => {
          // Create a task with missing metadata (no risk_level, no rubric, etc.)
          const incompleteTask = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: 'task-contract-guard-neg-01',
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: 'guard-neg-01',
            title: 'Incomplete task',
            goal: 'Missing metadata fields',
            task_kind: 'implementation',
            // risk_level intentionally omitted
            // gate_profile intentionally omitted
            // vote_round_policy intentionally omitted
            // base_snapshot intentionally omitted
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            // rubric intentionally omitted
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'drafted',
          };

          // Write task file directly (bypassing schema validation so we can test the guard)
          const taskPath = path.join(
            tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', 'guard-neg-01.json',
          );
          fs.writeFileSync(taskPath, JSON.stringify(incompleteTask, null, 2));

          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-01 --to ready`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return {
              blocked: true,
              exit_code: err.status,
              has_missing_artifacts: stderr.includes('missing_artifacts'),
            };
          }
        },
        validate: (r) =>
          r.blocked === true &&
          r.exit_code === 1 &&
          r.has_missing_artifacts === true,
      },

      // ── Transition guard: drafted -> ready (positive) ──
      {
        name: '[guard] drafted->ready positive: complete task transitions successfully',
        fn: () => {
          const completeTask = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: 'task-contract-guard-pos-01',
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: 'guard-pos-01',
            title: 'Complete task',
            goal: 'All metadata present',
            task_kind: 'implementation',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            base_snapshot: 'abc123',
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'drafted',
          };
          const data = JSON.stringify(completeTask).replace(/"/g, '\\"');
          runWithCwd(
            `task create --mission ${GUARD_MISSION} --data "${data}"`,
            tmpDir,
          );
          return runWithCwd(
            `task transition --mission ${GUARD_MISSION} --id guard-pos-01 --to ready`,
            tmpDir,
          );
        },
        validate: (r) =>
          r.previous_status === 'drafted' && r.status === 'ready',
      },

      // ── Transition guard: implementing -> reviewed (negative) ──
      {
        name: '[guard] implementing->reviewed negative: missing worker-self-check blocks transition',
        fn: () => {
          // Create a task already in implementing state (write directly)
          const task = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: 'task-contract-guard-neg-02',
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: 'guard-neg-02',
            title: 'Task without self-check',
            goal: 'Missing worker-self-check',
            task_kind: 'implementation',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            base_snapshot: 'abc123',
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'implementing',
          };
          const taskPath = path.join(
            tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', 'guard-neg-02.json',
          );
          fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));

          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-02 --to reviewed`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return {
              blocked: true,
              exit_code: err.status,
              has_missing_artifacts: stderr.includes('missing_artifacts'),
            };
          }
        },
        validate: (r) =>
          r.blocked === true &&
          r.exit_code === 1 &&
          r.has_missing_artifacts === true,
      },

      // ── Transition guard: verified -> passed (negative) ──
      {
        name: '[guard] verified->passed negative: missing closure artifacts blocks transition',
        fn: () => {
          // Create a task in verified state without closure-packet/final-verdict/retrospective
          const task = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: 'task-contract-guard-neg-03',
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: 'guard-neg-03',
            title: 'Task without closure artifacts',
            goal: 'Missing closure-packet, final-verdict, retrospective',
            task_kind: 'implementation',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            base_snapshot: 'abc123',
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'verified',
          };
          const taskPath = path.join(
            tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', 'guard-neg-03.json',
          );
          fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));

          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-03 --to passed`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return {
              blocked: true,
              exit_code: err.status,
              has_missing_artifacts: stderr.includes('missing_artifacts'),
            };
          }
        },
        validate: (r) =>
          r.blocked === true &&
          r.exit_code === 1 &&
          r.has_missing_artifacts === true,
      },

      // ── Transition guard: verified -> passed (positive) ──
      {
        name: '[guard] verified->passed positive: all closure artifacts present allows transition',
        fn: () => {
          const taskId = 'guard-pos-02';
          const missionDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION);

          // Create the task contract in verified state
          const task = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: `task-contract-${taskId}`,
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: taskId,
            title: 'Task with all closure artifacts',
            goal: 'Closure artifacts present',
            task_kind: 'implementation',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            base_snapshot: 'abc123',
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'verified',
          };
          fs.writeFileSync(
            path.join(missionDir, 'tasks', `${taskId}.json`),
            JSON.stringify(task, null, 2),
          );

          // Create the task subdirectory with required closure artifacts
          const taskDir = path.join(missionDir, 'tasks', taskId);
          fs.mkdirSync(taskDir, { recursive: true });

          fs.writeFileSync(
            path.join(taskDir, 'closure-packet.json'),
            JSON.stringify({ artifact_type: 'closure_packet', task_id: taskId }),
          );
          fs.writeFileSync(
            path.join(taskDir, 'final-verdict.json'),
            JSON.stringify({ artifact_type: 'final_verdict', task_id: taskId, verdict: 'pass' }),
          );
          fs.writeFileSync(
            path.join(taskDir, 'retrospective.json'),
            JSON.stringify({ artifact_type: 'retrospective', task_id: taskId }),
          );
          // challenge-review.json not required for risk_level "low"

          return runWithCwd(
            `task transition --mission ${GUARD_MISSION} --id ${taskId} --to passed`,
            tmpDir,
          );
        },
        validate: (r) =>
          r.previous_status === 'verified' && r.status === 'passed',
      },

      // ── Phase guard: building -> polishing (negative) ──
      {
        name: '[guard] building->polishing negative: task in implementing blocks phase transition',
        fn: () => {
          // Ensure there is a task in "implementing" state
          const task = {
            version: '1.0',
            artifact_type: 'task_contract',
            artifact_id: 'task-contract-phase-neg-01',
            producer_type: 'orchestration_authority',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            task_id: 'phase-neg-01',
            title: 'Task still implementing',
            goal: 'Block building->polishing',
            task_kind: 'implementation',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            base_snapshot: 'abc123',
            acceptance_criteria: ['Test'],
            eval_commands: ['echo ok'],
            rubric: { dimensions: [{ name: 'completeness', threshold: 3 }] },
            retry_budget: 3,
            scope: { surfaces: ['test/'] },
            routing: {
              primary_worker_type: 'software_engineer',
              required_reviewer_types: ['design_authority'],
            },
            status: 'implementing',
          };
          fs.writeFileSync(
            path.join(tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', 'phase-neg-01.json'),
            JSON.stringify(task, null, 2),
          );

          // Write a phase review with building -> polishing
          const phaseReview = {
            version: '1.0',
            artifact_type: 'phase_review',
            artifact_id: 'phase-review-build-polish',
            producer_type: 'orchestration_authority',
            mission_phase: 'building',
            status: 'ready_to_exit',
            summary: 'Attempting building to polishing',
            next_phase: 'polishing',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          };
          const data = JSON.stringify(phaseReview).replace(/"/g, '\\"');

          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" phase write --mission ${GUARD_MISSION} --data "${data}"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return {
              blocked: true,
              exit_code: err.status,
              has_unmet_criteria: stderr.includes('unmet_criteria'),
            };
          }
        },
        validate: (r) =>
          r.blocked === true &&
          r.exit_code === 1 &&
          r.has_unmet_criteria === true,
      },

      // ── Phase guard: evolving -> complete (negative) ──
      {
        name: '[guard] evolving->complete negative: schema rejects next_phase "complete"',
        fn: () => {
          // The phase-review schema does not allow next_phase: "complete",
          // so this tests that the schema validation catches it before the guard.
          const phaseReview = {
            version: '1.0',
            artifact_type: 'phase_review',
            artifact_id: 'phase-review-evolve-complete',
            producer_type: 'orchestration_authority',
            mission_phase: 'evolving',
            status: 'ready_to_exit',
            summary: 'Attempting evolving to complete',
            next_phase: 'complete',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          };
          const data = JSON.stringify(phaseReview).replace(/"/g, '\\"');

          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" phase write --mission ${GUARD_MISSION} --data "${data}"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return {
              blocked: true,
              exit_code: err.status,
              // Schema validation error or phase guard error - either way it's blocked
              has_error: stderr.includes('VALIDATION_ERROR') || stderr.includes('unmet_criteria'),
            };
          }
        },
        validate: (r) =>
          r.blocked === true &&
          r.exit_code === 1 &&
          r.has_error === true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Performance benchmark
// ---------------------------------------------------------------------------

function runBenchmark(tmpDir) {
  console.log('\n--- Performance Benchmark ---');
  console.log('Each command run 5 times; reporting median.\n');

  const benchCmds = [
    { label: 'state read', cmd: 'state read', useCwd: true },
    { label: 'event log', cmd: 'event log --type bench', useCwd: true },
    { label: 'lock list', cmd: 'lock list', useCwd: true },
    { label: 'task list', cmd: `task list --mission ${MISSION_ID}`, useCwd: true },
    { label: 'debt list', cmd: `debt list --mission ${MISSION_ID}`, useCwd: false },
    { label: 'health generate', cmd: 'health generate', useCwd: false },
  ];

  const RUNS = 5;
  let allUnder200 = true;

  for (const { label, cmd, useCwd } of benchCmds) {
    const times = [];
    for (let i = 0; i < RUNS; i++) {
      const start = Date.now();
      try {
        if (useCwd) {
          runWithCwd(cmd, tmpDir);
        } else {
          run(cmd, tmpDir);
        }
      } catch {
        // Some commands may write to stderr on missing data; that is acceptable
      }
      times.push(Date.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const pass = median < 200;
    if (!pass) allUnder200 = false;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  ${label}: ${median}ms (median of [${times.join(', ')}])`,
    );
  }

  console.log(
    allUnder200
      ? '\nBenchmark: ALL commands under 200ms'
      : '\nBenchmark: SOME commands exceeded 200ms',
  );

  return allUnder200;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== Geas CLI E2E Integration Test ===\n');

  // Verify CLI is built
  if (!fs.existsSync(path.resolve(__dirname, '..', 'dist', 'main.js'))) {
    console.error('ERROR: CLI not built. Run: cd plugin/cli && npm run build');
    process.exit(2);
  }

  let tmpDir;
  try {
    tmpDir = createTempDir();
    console.log(`Temp directory: ${tmpDir}\n`);
  } catch (err) {
    console.error('ERROR: Failed to create temp directory:', err.message);
    process.exit(2);
  }

  const tests = defineTests(tmpDir);
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    try {
      const result = test.fn();

      // All commands must return parseable JSON (already parsed by run())
      if (result === undefined || result === null) {
        throw new Error('Command returned null/undefined (not valid JSON)');
      }

      // Run custom validation if provided
      if (test.validate && !test.validate(result)) {
        throw new Error(
          `Validation failed. Got: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }

      console.log(`  PASS  ${test.name}`);
      passed++;
    } catch (err) {
      const msg = err.stderr
        ? err.stderr.toString().trim()
        : err.message;
      console.log(`  FAIL  ${test.name}: ${msg.slice(0, 200)}`);
      failed++;
      failures.push({ name: test.name, error: msg.slice(0, 500) });
    }
  }

  // Phase 5: --cwd support tests
  console.log('\n--- Phase 5: --cwd support ---\n');
  const cwdTestSuite = defineCwdTests(tmpDir);

  for (const test of cwdTestSuite.tests) {
    try {
      const result = test.fn();

      if (result === undefined || result === null) {
        throw new Error('Command returned null/undefined (not valid JSON)');
      }

      if (test.validate && !test.validate(result)) {
        throw new Error(
          `Validation failed. Got: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }

      console.log(`  PASS  ${test.name}`);
      passed++;
    } catch (err) {
      const msg = err.stderr
        ? err.stderr.toString().trim()
        : err.message;
      console.log(`  FAIL  ${test.name}: ${msg.slice(0, 200)}`);
      failed++;
      failures.push({ name: test.name, error: msg.slice(0, 500) });
    }
  }

  // Phase 7: Transition and Phase Guards
  console.log('\n--- Phase 7: Transition and Phase Guards ---\n');
  const guardTestSuite = defineGuardTests(tmpDir);
  guardTestSuite.setup();

  for (const test of guardTestSuite.tests) {
    try {
      const result = test.fn();

      if (result === undefined || result === null) {
        throw new Error('Command returned null/undefined (not valid JSON)');
      }

      if (test.validate && !test.validate(result)) {
        throw new Error(
          `Validation failed. Got: ${JSON.stringify(result).slice(0, 200)}`,
        );
      }

      console.log(`  PASS  ${test.name}`);
      passed++;
    } catch (err) {
      const msg = err.stderr
        ? err.stderr.toString().trim()
        : err.message;
      console.log(`  FAIL  ${test.name}: ${msg.slice(0, 200)}`);
      failed++;
      failures.push({ name: test.name, error: msg.slice(0, 500) });
    }
  }

  const totalTests = tests.length + cwdTestSuite.tests.length + guardTestSuite.tests.length;

  // Run performance benchmark
  const benchOk = runBenchmark(tmpDir);

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`\nCleaned up: ${tmpDir}`);
  } catch {
    console.log(`\nWARNING: Could not clean up ${tmpDir}`);
  }
  try {
    fs.rmSync(cwdTestSuite.worktreeDir, { recursive: true, force: true });
    console.log(`Cleaned up worktree: ${cwdTestSuite.worktreeDir}`);
  } catch {
    console.log(`\nWARNING: Could not clean up ${cwdTestSuite.worktreeDir}`);
  }

  // Summary
  console.log(`\n=== Summary: ${passed}/${totalTests} tests passed ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }
  if (!benchOk) {
    console.log('WARNING: Benchmark threshold exceeded (200ms)');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
