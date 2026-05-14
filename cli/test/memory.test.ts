import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runJudgmentRecord } from '../src/commands/judgment';
import { runMissionCreate, runMissionDesignRecord, runMissionEvidenceRecord, runMissionSpecRecord, runMissionTransition } from '../src/commands/mission';
import { runMemoryRecord } from '../src/commands/memory';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import {
  implementationEvidence,
  missionDesign,
  missionEvidence,
  missionJudgment,
  missionSpec,
  reviewEvidence,
  taskContract,
  taskEvidence,
  taskJudgment,
  verificationEvidence,
} from './helpers/artifacts';

let workdir: string;
let originalCwd: string;
let missionId: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-memory-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('memory record fails when not in consolidating', () => {
  runMissionCreate();
  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('memory record rejects invalid role name', () => {
  runMissionCreate();
  const r = runMemoryRecord('role', 'unknown-role', { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'role_invalid'));
});

test('memory record rejects schema-invalid payload', () => {
  const r = runMemoryRecord('common', undefined, { guideline: 'g' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'schema_invalid');
});

test('memory record rejects invalid scope', () => {
  const r = runMemoryRecord('unknown', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'scope_invalid');
});

test('memory record accepts project-level source refs', () => {
  enterAcceptedConsolidatingMission();
  const ref = `missions/${missionId}/tasks/task-001/task-evidence.md`;
  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [ref] });
  assert.equal(r.ok, true);
});

test('memory record accepts role scope with valid role', () => {
  enterAcceptedConsolidatingMission();
  const ref = `missions/${missionId}/tasks/task-001/task-evidence.md`;
  const r = runMemoryRecord('role', 'reviewer', { guideline: 'g', applies_when: [], source_refs: [ref] });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.writes[0]?.path, '.geas/memory/roles/reviewer.yaml');
});

test('memory record rejects mission-relative source refs', () => {
  enterAcceptedConsolidatingMission();
  const r = runMemoryRecord('common', undefined, {
    guideline: 'g',
    applies_when: [],
    source_refs: ['tasks/task-001/task-evidence.md'],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'source_ref_missing'));
});

test('memory record fails before mission judgment in consolidating', () => {
  enterConsolidatingMissionWithoutMissionJudgment();
  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'mission_judgment_not_accepted'));
});

test('memory record fails after mission evidence', () => {
  enterAcceptedConsolidatingMission();
  const closed = runMissionEvidenceRecord(missionEvidence());
  assert.equal(closed.ok, true);

  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'no_current_mission'));
});

test('memory record rejects role scope without role', () => {
  enterAcceptedConsolidatingMission();
  const r = runMemoryRecord('role', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'role_required'));
});

test('memory record rejects missing source ref', () => {
  enterAcceptedConsolidatingMission();
  const r = runMemoryRecord('common', undefined, {
    guideline: 'g',
    applies_when: [],
    source_refs: [`missions/${missionId}/missing.md`],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'source_ref_missing'));
});

test('memory record rejects stale yaml readable artifact refs', () => {
  enterAcceptedConsolidatingMission();
  const r = runMemoryRecord('common', undefined, {
    guideline: 'g',
    applies_when: [],
    source_refs: [`missions/${missionId}/tasks/task-001/task-evidence.yaml`],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'source_ref_stale_yaml_artifact'));
});

function enterAcceptedConsolidatingMission(): void {
  enterConsolidatingMissionWithoutMissionJudgment();
  runJudgmentRecord('mission-result', missionJudgment());
}

function enterConsolidatingMissionWithoutMissionJudgment(): void {
  const created = runMissionCreate();
  if (!created.ok) throw new Error('mission create failed');
  missionId = created.current.mission_id;
  runMissionSpecRecord(missionSpec());
  runMissionDesignRecord(missionDesign());
  runTaskContractRecord('task-001', taskContract());
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
  runTaskEvidenceRecord('task-001', 'implementation', implementationEvidence());
  runTaskEvidenceRecord('task-001', 'verification', verificationEvidence('passed'));
  runTaskEvidenceRecord('task-001', 'review', reviewEvidence());
  runJudgmentRecord('task-result', taskJudgment(), 'task-001');
  runTaskEvidenceRecord('task-001', 'task', taskEvidence());
  runMissionTransition('consolidating');
}
