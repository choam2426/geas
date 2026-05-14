import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDebtRecord, runDebtUpdate } from '../src/commands/debt';
import { runInit } from '../src/commands/init';
import { runJudgmentRecord } from '../src/commands/judgment';
import { runMissionCreate, runMissionDesignRecord, runMissionEvidenceRecord, runMissionSpecRecord, runMissionTransition } from '../src/commands/mission';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import { readYaml } from '../src/lib/runtime';
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
  workdir = mkdtempSync(join(tmpdir(), 'geas-debt-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('debt record assigns sequential ids', () => {
  enterAcceptedConsolidatingMission();
  const first = runDebtRecord(debtPayload('First'));
  const second = runDebtRecord(debtPayload('Second'));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const ledger = readDebtLedger();
  assert.equal(ledger.items[0]?.debt_id, 'DEBT-001');
  assert.equal(ledger.items[1]?.debt_id, 'DEBT-002');
});

test('debt record rejects caller supplied debt_id', () => {
  const result = runDebtRecord({ ...debtPayload('Bad'), debt_id: 'DEBT-999' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'debt_id_not_allowed');
});

test('debt update rejects missing debt id', () => {
  enterAcceptedConsolidatingMission();
  const result = runDebtUpdate('DEBT-999', { title: 'Missing' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'debt_not_found');
});

test('debt update applies a partial patch', () => {
  enterAcceptedConsolidatingMission();
  const recorded = runDebtRecord(debtPayload('Patch target'));
  assert.equal(recorded.ok, true);

  const updated = runDebtUpdate('DEBT-001', { title: 'Updated title' });
  assert.equal(updated.ok, true);

  const ledger = readDebtLedger();
  assert.equal(ledger.items[0]?.title, 'Updated title');
  assert.equal(ledger.items[0]?.summary, 'Accepted debt.');
});

test('debt update rejects debt_id changes', () => {
  enterAcceptedConsolidatingMission();
  runDebtRecord(debtPayload('Patch target'));
  const result = runDebtUpdate('DEBT-001', { debt_id: 'DEBT-002' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'debt_id_not_allowed');
});

test('resolved debt requires resolved_by_refs', () => {
  enterAcceptedConsolidatingMission();
  const result = runDebtRecord({ ...debtPayload('Resolved'), status: 'resolved', resolved_by_refs: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'resolved_by_refs_required'));
});

test('debt record fails before mission judgment', () => {
  runMissionCreate();
  const result = runDebtRecord(debtPayload('Too early'));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('debt record fails after mission evidence', () => {
  enterAcceptedConsolidatingMission();
  const closed = runMissionEvidenceRecord(missionEvidence());
  assert.equal(closed.ok, true);

  const result = runDebtRecord(debtPayload('Too late'));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'no_current_mission'));
});

function debtPayload(title: string) {
  return {
    status: 'open',
    title,
    summary: 'Accepted debt.',
    impact: 'Adds follow-up verification cost.',
    source_refs: [`missions/${missionId}/tasks/task-001/task-evidence.md`],
    accepted_in_ref: `missions/${missionId}/user-judgment-result-001.md`,
    revisit_when: ['When touching this area again.'],
    resolved_by_refs: [],
  };
}

function enterAcceptedConsolidatingMission(): void {
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
  runJudgmentRecord('mission-result', missionJudgment());
}

function readDebtLedger() {
  return readYaml<{ items: Array<{ debt_id: string; title: string; summary: string }> }>(join(workdir, '.geas', 'debts.yaml')) ?? { items: [] };
}
