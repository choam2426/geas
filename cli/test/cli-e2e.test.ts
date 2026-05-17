import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let workdir: string;
let tempPayloadCounter = 0;

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
  tempPayloadCounter = 0;
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

  const specInput = tempFixture('mission-spec', 'valid.md');
  assertOk(runCli(['mission', 'spec', 'record', '--from', specInput]));
  assert.equal(existsSync(specInput), false);

  const designText = readFileSync(fixture('mission-design', 'valid.md'), 'utf8');
  assertOk(runCli(['mission', 'design', 'record', '--from', '-'], designText));

  const contractInput = tempFixture('task-contract', 'valid.md');
  assertOk(runCli(['task', 'contract', 'record', '--task', 'task-001', '--from', contractInput]));
  assert.equal(existsSync(contractInput), false);
  assertOk(runCli(['mission', 'transition', '--to', 'building', '--task', 'task-001']));
  assertOk(runCli(['task', 'transition', '--task', 'task-001', '--to', 'implementing']));
  const implementationInput = tempFixture('implementation-evidence', 'valid.md');
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'implementation', '--from', implementationInput]));
  assert.equal(existsSync(implementationInput), false);
  const verificationInput = tempFixture('verification-evidence', 'passed.md');
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'verification', '--from', verificationInput]));
  assert.equal(existsSync(verificationInput), false);
  const reviewInput = tempFixture('review-evidence', 'valid.md');
  assertOk(runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'review', '--from', reviewInput]));
  assert.equal(existsSync(reviewInput), false);
  const taskJudgmentInput = tempFixture('user-judgment', 'task-accepted.md');
  assertOk(runCli(['judgment', 'record', '--target', 'task-result', '--task', 'task-001', '--from', taskJudgmentInput]));
  assert.equal(existsSync(taskJudgmentInput), false);

  const taskEvidenceInput = tempFixture('task-evidence', 'valid.md');
  const taskEvidence = runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'task', '--from', taskEvidenceInput]);
  assert.equal(taskEvidence.status, 0);
  assert.equal(parseJson(taskEvidence.stdout).current?.phase, 'closed');
  assert.equal(existsSync(taskEvidenceInput), false);

  assert.equal(existsSync(join(workdir, '.geas', 'missions', missionId!, 'tasks', 'task-001', 'task-evidence.md')), true);

  const consolidating = runCli(['mission', 'transition', '--to', 'consolidating']);
  assert.equal(consolidating.status, 0);
  assert.equal(parseJson(consolidating.stdout).current?.stage, 'consolidating');

  const missionJudgmentInput = tempFixture('user-judgment', 'mission-accepted.md');
  assertOk(runCli(['judgment', 'record', '--target', 'mission-result', '--from', missionJudgmentInput]));
  assert.equal(existsSync(missionJudgmentInput), false);

  const debtInput = tempPayload('debt-open.yaml', template('runtime', 'debt-open.yaml', missionId!));
  const debt = runCli(['debt', 'record', '--from', debtInput]);
  assert.equal(debt.status, 0);
  assert.equal(parseJson(debt.stdout).writes?.[0]?.path, '.geas/debts.yaml');
  assert.equal(existsSync(debtInput), false);
  const debtUpdateInput = tempPayload('debt-update.yaml', 'title: E2E follow-up updated\n');
  const debtUpdate = runCli(['debt', 'update', '--id', 'DEBT-001', '--from', debtUpdateInput]);
  assert.equal(debtUpdate.status, 0);
  assert.equal(parseJson(debtUpdate.stdout).writes?.[0]?.path, '.geas/debts.yaml');
  assert.equal(existsSync(debtUpdateInput), false);

  const memoryInput = tempPayload('memory-common.yaml', template('runtime', 'memory-common.yaml', missionId!));
  const memory = runCli(['memory', 'record', '--scope', 'common', '--from', memoryInput]);
  assert.equal(memory.status, 0);
  assert.equal(parseJson(memory.stdout).writes?.[0]?.path, '.geas/memory/common.yaml');
  assert.equal(existsSync(memoryInput), false);

  const missionEvidenceInput = tempFixture('mission-evidence', 'valid.md');
  const missionEvidence = runCli(['mission', 'evidence', 'record', '--from', missionEvidenceInput]);
  assert.equal(missionEvidence.status, 0);
  assert.equal(parseJson(missionEvidence.stdout).current?.mission_id, '');
  assert.equal(parseJson(missionEvidence.stdout).current?.stage, '');
  assert.equal(existsSync(missionEvidenceInput), false);

  const finalStatus = runCli(['status']);
  assert.equal(finalStatus.status, 0);
  assert.equal(parseJson(finalStatus.stdout).current?.mission_id, '');
  assert.equal(parseJson(finalStatus.stdout).current?.stage, '');
  assert.equal(existsSync(join(workdir, '.geas', 'missions', missionId!, 'mission-evidence.md')), true);
});

test('CLI process rejects parser failures before writes', () => {
  assertOk(runCli(['init']));
  assertOk(runCli(['mission', 'create']));

  const input = tempFixture('parser', 'missing-frontmatter.md');
  const result = runCli(['mission', 'spec', 'record', '--from', input]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'payload_parse_failed');
  assert.equal(existsSync(input), true);
});

test('CLI process returns JSON for invalid kind flag', () => {
  const input = tempFixture('implementation-evidence', 'valid.md');
  const result = runCli(['task', 'evidence', 'record', '--task', 'task-001', '--kind', 'unknown', '--from', input]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'flag_invalid');
  assert.equal(existsSync(input), true);
});

test('CLI process rejects frontmatter and command flag mismatch', () => {
  assertOk(runCli(['init']));
  assertOk(runCli(['mission', 'create']));
  assertOk(runCli(['mission', 'spec', 'record', '--from', tempFixture('mission-spec', 'valid.md')]));
  assertOk(runCli(['mission', 'design', 'record', '--from', tempFixture('mission-design', 'valid.md')]));

  const input = tempFixture('task-contract', 'wrong-task.md');
  const result = runCli(['task', 'contract', 'record', '--task', 'task-001', '--from', input]);
  assert.equal(result.status, 1);
  assert.equal(parseJson(result.stdout).error?.code, 'frontmatter_mismatch');
  assert.equal(existsSync(input), true);
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

function tempFixture(kind: string, file: string): string {
  const target = nextTempPayloadPath(`${kind}-${file}`);
  copyFileSync(fixture(kind, file), target);
  return target;
}

function tempPayload(file: string, text: string): string {
  const target = nextTempPayloadPath(file);
  writeFileSync(target, text);
  return target;
}

function nextTempPayloadPath(file: string): string {
  const dir = join(workdir, 'inputs');
  mkdirSync(dir, { recursive: true });
  const safeFile = file.replace(/[^a-zA-Z0-9._-]/g, '-');
  return join(dir, `${++tempPayloadCounter}-${safeFile}`);
}

function template(kind: string, file: string, missionId: string): string {
  return readFileSync(fixture(kind, file), 'utf8').replaceAll('__MISSION_ID__', missionId);
}

function assertOk(result: ReturnType<typeof runCli>): void {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(parseJson(result.stdout).ok, true);
}
