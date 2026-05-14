import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let workdir: string;

const cliRoot = join(__dirname, '..');
const tsxCli = join(cliRoot, 'node_modules', 'tsx', 'dist', 'cli.cjs');
const mainTs = join(cliRoot, 'src', 'main.ts');
const fixturesRoot = join(__dirname, 'fixtures', 'artifacts');

type JsonResult = {
  ok: boolean;
  current?: {
    mission_id?: string;
    stage?: string;
    task_id?: string;
    phase?: string;
  };
  error?: {
    code?: string;
    guards?: Array<{ code: string }>;
  };
  paths?: {
    current_mission?: {
      mission_spec?: string;
      mission_design?: string;
    };
  };
  writes?: Array<{ path: string; type: string }>;
};

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'geas-cli-e2e-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

test('CLI process records a mission lifecycle through mission evidence', () => {
  const init = runCli(['init']);
  assert.equal(init.status, 0);
  assert.equal(parseJson(init.stdout).ok, true);

  const status = runCli(['status']);
  assert.equal(status.status, 0);
  assert.equal(parseJson(status.stdout).paths?.current_mission?.mission_spec, '');

  const created = runCli(['mission', 'create']);
  assert.equal(created.status, 0);
  const missionId = parseJson(created.stdout).current?.mission_id;
  assert.match(missionId ?? '', /^\d{8}-[a-z0-9]{6}$/);

  assertOk(runCli(['mission', 'spec', 'record', '--from', fixture('mission-spec', 'valid.md')]));

  const designText = readFileSync(fixture('mission-design', 'valid.md'), 'utf8');
  assertOk(runCli(['mission', 'design', 'record', '--from', '-'], designText));

  assertOk(runCli(['task', 'contract', 'record', '--task', 'task-001', '--from', fixture('task-contract', 'valid.md')]));
  assertOk(runCli(['mission', 'transition', '--to', 'building', '--task', 'task-001']));
  assertOk(runCli(['task', 'transition', '--task', 'task-001', '--to', 'implementing']));
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'implementation', '--from', fixture('implementation-evidence', 'valid.md')]));
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'verification', '--from', fixture('verification-evidence', 'passed.md')]));
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'review', '--from', fixture('review-evidence', 'valid.md')]));
  assertOk(runCli(['judgment', 'record', '--target', 'task-result', '--task', 'task-001', '--from', fixture('user-judgment', 'task-accepted.md')]));

  const taskEvidence = runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'task', '--from', fixture('task-evidence', 'valid.md')]);
  assert.equal(taskEvidence.status, 0);
  assert.equal(parseJson(taskEvidence.stdout).current?.phase, 'closed');

  assert.equal(existsSync(join(workdir, '.geas', 'missions', missionId!, 'tasks', 'task-001', 'task-evidence.md')), true);

  const consolidating = runCli(['mission', 'transition', '--to', 'consolidating']);
  assert.equal(consolidating.status, 0);
  assert.equal(parseJson(consolidating.stdout).current?.stage, 'consolidating');

  assertOk(runCli(['judgment', 'record', '--target', 'mission-result', '--from', fixture('user-judgment', 'mission-accepted.md')]));

  const debt = runCli(['debt', 'record', '--from', '-'], template('runtime', 'debt-open.yaml', missionId!));
  assert.equal(debt.status, 0);
  assert.equal(parseJson(debt.stdout).writes?.[0]?.path, '.geas/debts.yaml');

  const memory = runCli(['memory', 'record', '--scope', 'common', '--from', '-'], template('runtime', 'memory-common.yaml', missionId!));
  assert.equal(memory.status, 0);
  assert.equal(parseJson(memory.stdout).writes?.[0]?.path, '.geas/memory/common.yaml');

  const missionEvidence = runCli(['mission', 'evidence', 'record', '--from', fixture('mission-evidence', 'valid.md')]);
  assert.equal(missionEvidence.status, 0);
  assert.equal(parseJson(missionEvidence.stdout).current?.mission_id, '');
  assert.equal(parseJson(missionEvidence.stdout).current?.stage, '');

  const finalStatus = runCli(['status']);
  assert.equal(finalStatus.status, 0);
  assert.equal(parseJson(finalStatus.stdout).current?.mission_id, '');
  assert.equal(parseJson(finalStatus.stdout).current?.stage, '');
  assert.equal(existsSync(join(workdir, '.geas', 'missions', missionId!, 'mission-evidence.md')), true);
});

test('CLI process rejects parser failures before writes', () => {
  assertOk(runCli(['init']));
  assertOk(runCli(['mission', 'create']));

  const result = runCli(['mission', 'spec', 'record', '--from', fixture('parser', 'missing-frontmatter.md')]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'payload_parse_failed');
});

test('CLI process returns JSON for invalid kind flag', () => {
  const result = runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'unknown', '--from', fixture('implementation-evidence', 'valid.md')]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'flag_invalid');
});

test('CLI process rejects frontmatter and command flag mismatch', () => {
  assertOk(runCli(['init']));
  assertOk(runCli(['mission', 'create']));
  assertOk(runCli(['mission', 'spec', 'record', '--from', fixture('mission-spec', 'valid.md')]));
  assertOk(runCli(['mission', 'design', 'record', '--from', fixture('mission-design', 'valid.md')]));

  const result = runCli(['task', 'contract', 'record', '--task', 'task-001', '--from', fixture('task-contract', 'wrong-task.md')]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'frontmatter_mismatch');
});

function runCli(args: string[], input?: string) {
  return spawnSync(process.execPath, [tsxCli, mainTs, ...args], {
    cwd: workdir,
    encoding: 'utf8',
    input,
  });
}

function parseJson(stdout: string): JsonResult {
  return JSON.parse(stdout) as JsonResult;
}

function fixture(kind: string, file: string): string {
  return join(fixturesRoot, kind, file);
}

function template(kind: string, file: string, missionId: string): string {
  return readFileSync(fixture(kind, file), 'utf8').replaceAll('__MISSION_ID__', missionId);
}

function assertOk(result: ReturnType<typeof runCli>): void {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(parseJson(result.stdout).ok, true);
}
