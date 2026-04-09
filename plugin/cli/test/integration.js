#!/usr/bin/env node
/**
 * E2E Integration Test for Geas CLI (v4)
 *
 * Exercises a complete mission lifecycle: create mission, update state,
 * log events, acquire/release locks, create tasks, transition status,
 * record evidence, add debt, generate health check, and clear checkpoints.
 *
 * v4 changes: record.json, evidence add, tasks/{tid}/contract.json,
 *   simplified memory (agent-note), packet create.
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

  // v4: simplified directory structure
  const dirs = [
    'state',
    'memory/agents',
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
      name: 'task create (v4: tasks/{tid}/contract.json)',
      fn: () => {
        const data = JSON.stringify(TASK_CONTRACT).replace(/"/g, '\\"');
        return runWithCwd(
          `task create --mission ${MISSION_ID} --data "${data}"`,
          tmpDir,
        );
      },
      validate: (r) => {
        if (r.task_id !== 'task-001' || r.artifact_type !== 'task_contract') return false;
        // Verify subdirectories were created
        const taskDir = path.join(tmpDir, '.geas', 'missions', MISSION_ID, 'tasks', 'task-001');
        return fs.existsSync(path.join(taskDir, 'contract.json'))
          && fs.existsSync(path.join(taskDir, 'evidence'))
          && fs.existsSync(path.join(taskDir, 'packets'));
      },
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
      name: 'create implementation contract via record add (for ready->implementing guard)',
      fn: () => {
        // v4: ready->implementing guard requires record.json:implementation_contract section with status "approved"
        const sectionData = JSON.stringify({
          planned_actions: ['Implement feature'],
          non_goals: ['Out-of-scope refactoring'],
          status: 'approved',
        }).replace(/"/g, '\\"');
        return runWithCwd(
          `task record add --mission ${MISSION_ID} --task task-001 --section implementation_contract --data "${sectionData}"`,
          tmpDir,
        );
      },
      validate: (r) => r.section === 'implementation_contract' && r.action === 'added',
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
      name: 'evidence add (v4: role-based)',
      fn: () =>
        runWithCwd(
          `evidence add --mission ${MISSION_ID} --task task-001 --agent test-agent --role implementer --set "summary=Test implementation" --set "files_changed[0]=src/test.ts"`,
          tmpDir,
        ),
      validate: (r) =>
        r.task_id === 'task-001' && r.agent === 'test-agent' && r.role === 'implementer',
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

function defineCwdTests(mainDir) {
  const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geas-cwd-test-'));

  return {
    worktreeDir,
    tests: [
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
      {
        name: '[cwd] evidence read WITHOUT --cwd fails from worktree',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" evidence read --mission ${MISSION_ID} --task task-001`,
              { cwd: worktreeDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { failed_as_expected: false };
          } catch {
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
              { cwd: worktreeDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
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
              { cwd: worktreeDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
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
// Phase 7: Transition and Phase Guards (v4: record.json-based)
// ---------------------------------------------------------------------------

function defineGuardTests(tmpDir) {
  const GUARD_MISSION = 'guard-test-mission';

  /** Helper: write a task contract.json directly (bypass CLI validation for negative tests). */
  function writeTaskContract(taskId, overrides) {
    const base = {
      version: '1.0',
      artifact_type: 'task_contract',
      artifact_id: `task-contract-${taskId}`,
      producer_type: 'orchestration_authority',
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      task_id: taskId,
      title: 'Guard test task',
      goal: 'Test transition guard',
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
      routing: { primary_worker_type: 'software_engineer', required_reviewer_types: ['design_authority'] },
      status: 'drafted',
      ...overrides,
    };
    const taskDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', taskId);
    fs.mkdirSync(path.join(taskDir, 'evidence'), { recursive: true });
    fs.mkdirSync(path.join(taskDir, 'packets'), { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'contract.json'), JSON.stringify(base, null, 2));
    return taskDir;
  }

  /** Helper: write record.json for a task. */
  function writeRecord(taskId, sections) {
    const taskDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', taskId);
    const record = { version: '1.0', task_id: taskId, ...sections };
    fs.writeFileSync(path.join(taskDir, 'record.json'), JSON.stringify(record, null, 2));
  }

  /** Helper: write evidence file for a task. */
  function writeEvidence(taskId, agent, data) {
    const evidenceDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION, 'tasks', taskId, 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, `${agent}.json`), JSON.stringify(data, null, 2));
  }

  return {
    setup: () => {
      runWithCwd(`mission create --id ${GUARD_MISSION}`, tmpDir);
      const missionDir = path.join(tmpDir, '.geas', 'missions', GUARD_MISSION);
      fs.mkdirSync(path.join(missionDir, 'tasks'), { recursive: true });
      fs.mkdirSync(path.join(missionDir, 'phase-reviews'), { recursive: true });
      fs.mkdirSync(path.join(missionDir, 'evolution'), { recursive: true });
    },
    tests: [
      // ── drafted -> ready (negative): missing risk_level ──
      {
        name: '[guard] drafted->ready negative: missing risk_level blocks transition',
        fn: () => {
          writeTaskContract('guard-neg-01', {
            risk_level: undefined,
            gate_profile: undefined,
            vote_round_policy: undefined,
            base_snapshot: undefined,
            rubric: undefined,
          });
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-01 --to ready`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return { blocked: true, exit_code: err.status, has_missing_artifacts: stderr.includes('missing_artifacts') };
          }
        },
        validate: (r) => r.blocked === true && r.exit_code === 1 && r.has_missing_artifacts === true,
      },

      // ── drafted -> ready (positive) ──
      {
        name: '[guard] drafted->ready positive: complete task transitions successfully',
        fn: () => {
          const completeTask = { ...TASK_CONTRACT, task_id: 'guard-pos-01' };
          const data = JSON.stringify(completeTask).replace(/"/g, '\\"');
          runWithCwd(`task create --mission ${GUARD_MISSION} --data "${data}"`, tmpDir);
          return runWithCwd(`task transition --mission ${GUARD_MISSION} --id guard-pos-01 --to ready`, tmpDir);
        },
        validate: (r) => r.previous_status === 'drafted' && r.status === 'ready',
      },

      // ── implementing -> reviewed (negative): missing self_check ──
      {
        name: '[guard] implementing->reviewed negative: missing self_check blocks transition',
        fn: () => {
          writeTaskContract('guard-neg-02', { status: 'implementing' });
          // No record.json, no evidence — should block
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-02 --to reviewed`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return { blocked: true, exit_code: err.status, has_missing_artifacts: stderr.includes('missing_artifacts') };
          }
        },
        validate: (r) => r.blocked === true && r.exit_code === 1 && r.has_missing_artifacts === true,
      },

      // ── verified -> passed (negative): missing closure artifacts ──
      {
        name: '[guard] verified->passed negative: missing closure artifacts blocks transition',
        fn: () => {
          writeTaskContract('guard-neg-03', { status: 'verified' });
          // No record.json sections — should block
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${GUARD_MISSION} --id guard-neg-03 --to passed`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { blocked: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return { blocked: true, exit_code: err.status, has_missing_artifacts: stderr.includes('missing_artifacts') };
          }
        },
        validate: (r) => r.blocked === true && r.exit_code === 1 && r.has_missing_artifacts === true,
      },

      // ── verified -> passed (positive): all record.json sections present ──
      {
        name: '[guard] verified->passed positive: all record sections allow transition',
        fn: () => {
          const taskId = 'guard-pos-02';
          writeTaskContract(taskId, { status: 'verified' });
          writeRecord(taskId, {
            verdict: { verdict: 'pass', rationale: 'All good' },
            gate_result: { verdict: 'pass', tier: 1 },
            closure: { change_summary: 'Done', reviews: [{ reviewer: 'tester', outcome: 'approved' }], open_risks: [], debt_items: [] },
            retrospective: { what_went_well: ['Tests pass'], what_broke: [] },
          });
          // Satisfy required_reviewer_types: ['design_authority'] from contract
          writeEvidence(taskId, 'design-authority', { role: 'reviewer', summary: 'Approved', verdict: 'pass' });
          return runWithCwd(
            `task transition --mission ${GUARD_MISSION} --id ${taskId} --to passed`,
            tmpDir,
          );
        },
        validate: (r) => r.previous_status === 'verified' && r.status === 'passed',
      },

      // ── Phase guard: building -> polishing (negative) ──
      {
        name: '[guard] building->polishing negative: task in implementing blocks phase transition',
        fn: () => {
          writeTaskContract('phase-neg-01', { status: 'implementing' });
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
            return { blocked: true, exit_code: err.status, has_unmet_criteria: stderr.includes('unmet_criteria') };
          }
        },
        validate: (r) => r.blocked === true && r.exit_code === 1 && r.has_unmet_criteria === true,
      },

      // ── Phase guard: evolving -> complete (negative) ──
      {
        name: '[guard] evolving->complete negative: schema rejects next_phase "complete"',
        fn: () => {
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
            return { blocked: true, exit_code: err.status, has_error: stderr.includes('VALIDATION_ERROR') || stderr.includes('unmet_criteria') };
          }
        },
        validate: (r) => r.blocked === true && r.exit_code === 1 && r.has_error === true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Phase 8: Record, Evidence, Packet, Memory (v4)
// ---------------------------------------------------------------------------

function defineV4Tests(tmpDir) {
  const V4_MISSION = 'v4-test-mission';

  return {
    setup: () => {
      runWithCwd(`mission create --id ${V4_MISSION}`, tmpDir);
      runWithCwd(`state update --field mission_id --value ${V4_MISSION}`, tmpDir);

      // Create a task for record/evidence tests
      const task = { ...TASK_CONTRACT, task_id: 'v4-task-001' };
      const data = JSON.stringify(task).replace(/"/g, '\\"');
      runWithCwd(`task create --mission ${V4_MISSION} --data "${data}"`, tmpDir);
    },
    tests: [
      // ── record add: --set ──
      {
        name: '[v4] record add with --set',
        fn: () =>
          runWithCwd(
            `task record add --mission ${V4_MISSION} --task v4-task-001 --section self_check --set confidence=4 --set "summary=All tests pass" --set "known_risks=[]" --set "untested_paths=[]"`,
            tmpDir,
          ),
        validate: (r) => r.section === 'self_check' && r.action === 'added',
      },

      // ── record get: specific section ──
      {
        name: '[v4] record get section',
        fn: () =>
          runWithCwd(
            `task record get --mission ${V4_MISSION} --task v4-task-001 --section self_check`,
            tmpDir,
          ),
        validate: (r) =>
          r.section === 'self_check' &&
          r.data.confidence === 4 &&
          r.data.summary === 'All tests pass',
      },

      // ── record add: --data (overwrite) ──
      {
        name: '[v4] record add with --data (overwrite existing section)',
        fn: () => {
          const sectionData = JSON.stringify({
            confidence: 5,
            summary: 'Updated after fix',
            known_risks: ['None'],
            untested_paths: ['Edge case handling'],
          }).replace(/"/g, '\\"');
          return runWithCwd(
            `task record add --mission ${V4_MISSION} --task v4-task-001 --section self_check --data "${sectionData}"`,
            tmpDir,
          );
        },
        validate: (r) => r.section === 'self_check' && r.action === 'added',
      },

      // ── record get: verify overwrite ──
      {
        name: '[v4] record get verifies overwrite',
        fn: () =>
          runWithCwd(
            `task record get --mission ${V4_MISSION} --task v4-task-001 --section self_check`,
            tmpDir,
          ),
        validate: (r) =>
          r.data.confidence === 5 && r.data.summary === 'Updated after fix',
      },

      // ── record add: gate_result section ──
      {
        name: '[v4] record add gate_result section',
        fn: () => {
          const data = JSON.stringify({
            verdict: 'pass',
            tier_results: { tier_0: { status: 'pass' }, tier_1: { status: 'pass' }, tier_2: { status: 'pass' } },
          }).replace(/"/g, '\\"');
          return runWithCwd(
            `task record add --mission ${V4_MISSION} --task v4-task-001 --section gate_result --data "${data}"`,
            tmpDir,
          );
        },
        validate: (r) => r.section === 'gate_result',
      },

      // ── record get: full record ──
      {
        name: '[v4] record get full record',
        fn: () =>
          runWithCwd(
            `task record get --mission ${V4_MISSION} --task v4-task-001`,
            tmpDir,
          ),
        validate: (r) =>
          r.version === '1.0' &&
          r.task_id === 'v4-task-001' &&
          r.self_check != null &&
          r.gate_result != null,
      },

      // ── record add: invalid section name ──
      {
        name: '[v4] record add rejects invalid section name',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task record add --mission ${V4_MISSION} --task v4-task-001 --section bad_name --set foo=bar`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── evidence add: implementer ──
      {
        name: '[v4] evidence add implementer role',
        fn: () =>
          runWithCwd(
            `evidence add --mission ${V4_MISSION} --task v4-task-001 --agent software-engineer --role implementer --set "summary=Implemented feature" --set "files_changed[0]=src/feature.ts"`,
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'software-engineer' && r.role === 'implementer',
      },

      // ── evidence add: reviewer ──
      {
        name: '[v4] evidence add reviewer role',
        fn: () => {
          const data = JSON.stringify({
            summary: 'Code looks good',
            verdict: 'approved',
            concerns: [],
          }).replace(/"/g, '\\"');
          return runWithCwd(
            `evidence add --mission ${V4_MISSION} --task v4-task-001 --agent design-authority --role reviewer --data "${data}"`,
            tmpDir,
          );
        },
        validate: (r) =>
          r.agent === 'design-authority' && r.role === 'reviewer',
      },

      // ── evidence add: missing required fields for role ──
      {
        name: '[v4] evidence add rejects missing role-specific fields',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" evidence add --mission ${V4_MISSION} --task v4-task-001 --agent qa-engineer --role tester --set "summary=Tested"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            return { rejected: true, has_validation: stderr.includes('VALIDATION_ERROR') };
          }
        },
        validate: (r) => r.rejected === true && r.has_validation === true,
      },

      // ── evidence read ──
      {
        name: '[v4] evidence read all agents',
        fn: () =>
          runWithCwd(
            `evidence read --mission ${V4_MISSION} --task v4-task-001`,
            tmpDir,
          ),
        validate: (r) =>
          r.agents.length === 2 &&
          r.agents.includes('software-engineer') &&
          r.agents.includes('design-authority'),
      },

      // ── packet create ──
      {
        name: '[v4] packet create',
        fn: () =>
          runWithCwd(
            `packet create --mission ${V4_MISSION} --task v4-task-001 --agent software-engineer --content "# Task Briefing\n\nImplement the feature."`,
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'software-engineer' && r.task_id === 'v4-task-001',
      },

      // ── packet read ──
      {
        name: '[v4] packet read',
        fn: () =>
          runWithCwd(
            `packet read --mission ${V4_MISSION} --task v4-task-001 --agent software-engineer`,
            tmpDir,
          ),
        validate: (r) =>
          r.content.includes('Task Briefing') && r.agent === 'software-engineer',
      },

      // ── memory agent-note: create ──
      {
        name: '[v4] memory agent-note create',
        fn: () =>
          runWithCwd(
            'memory agent-note --agent software-engineer --add "FTS5 requires try-catch for malformed queries"',
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'software-engineer' && r.action === 'appended',
      },

      // ── memory agent-note: append ──
      {
        name: '[v4] memory agent-note append',
        fn: () =>
          runWithCwd(
            'memory agent-note --agent software-engineer --add "Always check subtree depth on category moves"',
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'software-engineer' && r.action === 'appended',
      },

      // ── memory read: agent ──
      {
        name: '[v4] memory read agent notes',
        fn: () =>
          runWithCwd(
            'memory read --agent software-engineer',
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'software-engineer' &&
          r.content.includes('FTS5') &&
          r.content.includes('subtree depth'),
      },

      // ── memory read: non-existent agent returns null ──
      {
        name: '[v4] memory read non-existent agent',
        fn: () =>
          runWithCwd(
            'memory read --agent non-existent-agent',
            tmpDir,
          ),
        validate: (r) =>
          r.agent === 'non-existent-agent' && r.content === null,
      },

      // ── C5: path traversal rejection ──
      {
        name: '[security] evidence add rejects path traversal in task ID',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" evidence add --mission ${V4_MISSION} --task "../escape" --agent test --role implementer --set "summary=hack" --set "files_changed[0]=x"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── S3: invalid agent name rejection ──
      {
        name: '[security] evidence add rejects invalid agent name',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" evidence add --mission ${V4_MISSION} --task v4-task-001 --agent "bad.name" --role implementer --set "summary=test" --set "files_changed[0]=x"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── I1: evidence add rejects non-existent task ──
      {
        name: '[security] evidence add rejects non-existent task',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" evidence add --mission ${V4_MISSION} --task nonexistent-task --agent test --role implementer --set "summary=test" --set "files_changed[0]=x"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── C2: phase write rejects ready_to_exit without next_phase ──
      {
        name: '[v4] phase write rejects ready_to_exit without next_phase',
        fn: () => {
          // First ensure the mission directory exists for phase writes
          const missionDir = path.join(tmpDir, '.geas', 'missions', V4_MISSION);
          fs.mkdirSync(path.join(missionDir, 'phase-reviews'), { recursive: true });

          const phaseReview = JSON.stringify({
            version: '1.0',
            artifact_type: 'phase_review',
            artifact_id: 'pr-bad',
            producer_type: 'orchestration_authority',
            mission_phase: 'evolving',
            status: 'ready_to_exit',
            summary: 'Missing next_phase',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          }).replace(/"/g, '\\"');
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" phase write --mission ${V4_MISSION} --data "${phaseReview}"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── I5: phase write + read-latest ──
      {
        name: '[v4] phase write creates timestamped file',
        fn: () => {
          // Use ready_to_enter (no next_phase) to avoid triggering the phase
          // transition guard, which requires all tasks to be passed/cancelled.
          const phaseReview = JSON.stringify({
            version: '1.0',
            artifact_type: 'phase_review',
            artifact_id: 'pr-building-001',
            producer_type: 'orchestration_authority',
            mission_phase: 'building',
            status: 'ready_to_enter',
            summary: 'Building phase entered',
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          }).replace(/"/g, '\\"');
          return runWithCwd(
            `phase write --mission ${V4_MISSION} --data "${phaseReview}"`,
            tmpDir,
          );
        },
        validate: (r) => r.ok === true && r.phase === 'building',
      },
      {
        name: '[v4] phase read-latest returns most recent review',
        fn: () =>
          runWithCwd(
            `phase read-latest --mission ${V4_MISSION} --phase building`,
            tmpDir,
          ),
        validate: (r) =>
          r.phase === 'building' &&
          r.data != null &&
          r.data.status === 'ready_to_enter',
      },
      {
        name: '[v4] phase read-latest returns error for missing phase',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" phase read-latest --mission ${V4_MISSION} --phase specifying`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── I4: evolution rules-update ──
      {
        name: '[v4] evolution rules-update writes artifact',
        fn: () => {
          const data = JSON.stringify({
            version: '1.0',
            artifact_type: 'rules_update',
            artifact_id: 'ru-001',
            producer_type: 'design_authority',
            status: 'none',
            reason: 'No rules changes needed',
            evidence_refs: [],
            applies_to: [],
            created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          }).replace(/"/g, '\\"');
          return runWithCwd(
            `evolution rules-update --mission ${V4_MISSION} --data "${data}"`,
            tmpDir,
          );
        },
        validate: (r) => r.artifact_type === 'rules_update',
      },

      // ── S2: --set coercion preserves zero-padded strings ──
      {
        name: '[v4] --set preserves zero-padded string "001"',
        fn: () => {
          // Write with zero-padded value
          runWithCwd(
            `task record add --mission ${V4_MISSION} --task v4-task-001 --section self_check --set "confidence=4" --set "summary=coercion test" --set "known_risks[0]=001" --set "untested_paths[0]=none"`,
            tmpDir,
          );
          // Read back
          return runWithCwd(
            `task record get --mission ${V4_MISSION} --task v4-task-001 --section self_check`,
            tmpDir,
          );
        },
        validate: (r) =>
          r.data.confidence === 4 &&
          r.data.known_risks[0] === '001',
      },

      // ── task.ts path traversal rejection ──
      {
        name: '[security] task create rejects path traversal in mission ID',
        fn: () => {
          try {
            const data = JSON.stringify({
              version: '1.0', artifact_type: 'task_contract', artifact_id: 'tc-bad',
              producer_type: 'orchestration_authority', created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
              task_id: 'bad-task', title: 'Bad', goal: 'Bad', task_kind: 'implementation',
              risk_level: 'low', gate_profile: 'implementation_change', vote_round_policy: 'never',
              acceptance_criteria: ['x'], eval_commands: [], rubric: { dimensions: [{ name: 'core_interaction', threshold: 3 }] },
              retry_budget: 3, scope: { surfaces: ['src/'] }, routing: { primary_worker_type: 'software_engineer', required_reviewer_types: ['design_authority'] },
              base_snapshot: 'abc123', status: 'drafted'
            }).replace(/"/g, '\\"');
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task create --mission "../escape" --data "${data}"`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── task transition path traversal ──
      {
        name: '[security] task transition rejects path traversal in task ID',
        fn: () => {
          try {
            execSync(
              `node "${CLI}" --cwd "${tmpDir}" task transition --mission ${V4_MISSION} --id "../escape" --to ready`,
              { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
            );
            return { rejected: false };
          } catch {
            return { rejected: true };
          }
        },
        validate: (r) => r.rejected === true,
      },

      // ── prototype pollution defense ──
      {
        name: '[security] --set blocks __proto__ key',
        fn: () => {
          // Write with __proto__ key - should be silently ignored
          runWithCwd(
            `task record add --mission ${V4_MISSION} --task v4-task-001 --section self_check --set "confidence=4" --set "summary=proto test" --set "__proto__=polluted" --set "known_risks[0]=none" --set "untested_paths[0]=none"`,
            tmpDir,
          );
          // Read back and verify __proto__ was not injected
          const result = runWithCwd(
            `task record get --mission ${V4_MISSION} --task v4-task-001 --section self_check`,
            tmpDir,
          );
          return result;
        },
        validate: (r) =>
          r.data.confidence === 4 &&
          !Object.prototype.hasOwnProperty.call(r.data || {}, '__proto__'),
      },

      // ── mission auto-resolution ──
      {
        name: '[v4] task record add auto-resolves mission from run.json',
        fn: () =>
          runWithCwd(
            'task record add --task v4-task-001 --section retrospective --set "what_went_well[0]=Auto-resolution works" --set "what_broke[0]=Nothing"',
            tmpDir,
          ),
        validate: (r) => r.section === 'retrospective' && r.mission_id === V4_MISSION,
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
  console.log('=== Geas CLI E2E Integration Test (v4) ===\n');

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

  function runTestList(testList, label) {
    if (label) console.log(`\n--- ${label} ---\n`);
    for (const test of testList) {
      try {
        const result = test.fn();
        if (result === undefined || result === null) {
          throw new Error('Command returned null/undefined (not valid JSON)');
        }
        if (test.validate && !test.validate(result)) {
          throw new Error(`Validation failed. Got: ${JSON.stringify(result).slice(0, 200)}`);
        }
        console.log(`  PASS  ${test.name}`);
        passed++;
      } catch (err) {
        const msg = err.stderr ? err.stderr.toString().trim() : err.message;
        console.log(`  FAIL  ${test.name}: ${msg.slice(0, 200)}`);
        failed++;
        failures.push({ name: test.name, error: msg.slice(0, 500) });
      }
    }
  }

  // Phase 1-4: Core lifecycle
  runTestList(tests);

  // Phase 5: --cwd support
  const cwdTestSuite = defineCwdTests(tmpDir);
  runTestList(cwdTestSuite.tests, 'Phase 5: --cwd support');

  // Phase 7: Transition and Phase Guards
  const guardTestSuite = defineGuardTests(tmpDir);
  guardTestSuite.setup();
  runTestList(guardTestSuite.tests, 'Phase 7: Transition and Phase Guards');

  // Phase 8: v4 features (record, evidence, packet, memory)
  const v4TestSuite = defineV4Tests(tmpDir);
  v4TestSuite.setup();
  runTestList(v4TestSuite.tests, 'Phase 8: v4 Features (record, evidence, packet, memory)');

  const totalTests = tests.length + cwdTestSuite.tests.length + guardTestSuite.tests.length + v4TestSuite.tests.length;

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
