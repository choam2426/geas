/**
 * `geas gate` — Evidence Gate run recording (protocol-faithful).
 *
 *   geas gate run --mission <id> --task <id>
 *
 * The gate reads the task's artifacts directly and computes each tier's
 * status itself. Per doc 03 §154 "evidence gate decides whether
 * verification evidence is sufficient": the gate is NOT a raw recorder of
 * caller-supplied tier statuses; it is the component that judges.
 *
 * Tiers (doc 03 §160–170):
 *   Tier 0 — Preflight: required artifacts + required reviewer reviews
 *            submitted. Checks:
 *              - task-state.status == reviewed
 *              - implementation-contract.json present + schema-valid
 *              - self-check.json present + schema-valid
 *              - for each slot in contract.routing.required_reviewers,
 *                at least one evidence/*.{slot}.json file with a
 *                review-kind entry and a valid review verdict exists.
 *   Tier 1 — Verification: read evidence/*.verifier.json files; the
 *            latest verification-kind entry in each file defines that
 *            verifier's outcome. Verdict mapping:
 *              approved  → pass  (but inconsistent criteria_results
 *                                 collapse to error)
 *              changes_requested → fail
 *              blocked   → block
 *            If there is no verifier file, no verification entry, or the
 *            entry is internally inconsistent, Tier 1 is error.
 *            Across multiple verifier files, worst-wins
 *            (error > block > fail > pass).
 *   Tier 2 — Judgment: reviewer verdict aggregation (doc 03 §168–170).
 *              any blocked             → block
 *              any changes_requested   → fail
 *              all approved            → pass
 *              otherwise (missing)     → error
 *
 * Writes to .geas/missions/{mission_id}/tasks/{task_id}/gate-results.json.
 * Each run is appended as an immutable record. Overall verdict is derived
 * from tier statuses (worst-wins; doc 03 §164).
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import {
  atomicWriteJson,
  ensureDir,
  exists,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  evidenceDir,
  findProjectRoot,
  gateResultsPath,
  implementationContractPath,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  selfCheckPath,
  taskContractPath,
  taskStatePath,
  tmpDir,
} from '../lib/paths';
import { validate } from '../lib/schema';

// ── Types ──────────────────────────────────────────────────────────────

type TierStatus = 'pass' | 'fail' | 'block' | 'error' | 'skipped';
type OverallVerdict = 'pass' | 'fail' | 'block' | 'error';

interface TierResult {
  status: TierStatus;
  details: string;
}

interface GateRun {
  gate_run_id: string;
  verdict: OverallVerdict;
  tier_results: {
    tier_0: TierResult;
    tier_1: TierResult;
    tier_2: TierResult;
  };
  created_at: string;
}

interface GateResultsFile {
  mission_id: string;
  task_id: string;
  runs: GateRun[];
  created_at: string;
  updated_at: string;
}

interface EvidenceEntry {
  entry_id: number;
  evidence_kind: 'implementation' | 'review' | 'verification' | 'closure';
  summary?: string;
  verdict?: string;
  criteria_results?: Array<{
    criterion: string;
    passed: boolean;
    details: string;
  }>;
  [k: string]: unknown;
}

interface EvidenceFile {
  mission_id: string;
  task_id: string;
  agent: string;
  slot: string;
  entries: EvidenceEntry[];
  created_at: string;
  updated_at: string;
}

interface TaskStateFile {
  status: string;
  [k: string]: unknown;
}

interface TaskContractFile {
  acceptance_criteria?: string[];
  routing?: {
    primary_worker_type?: string;
    required_reviewers?: string[];
  };
  [k: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(
      err(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
      ),
    );
  }
  return root as string;
}

/**
 * Compute the overall gate verdict from three tier statuses.
 * Per protocol 03 §164: sequential Tier 0 → 1 → 2; any non-pass status
 * becomes the overall verdict. Worst-wins order: error > block > fail > pass.
 * `skipped` is treated as non-blocking (profile-narrowed tier).
 */
function overallFromTiers(
  tier0: TierStatus,
  tier1: TierStatus,
  tier2: TierStatus,
): OverallVerdict {
  for (const s of [tier0, tier1, tier2]) {
    if (s === 'error') return 'error';
    if (s === 'block') return 'block';
    if (s === 'fail') return 'fail';
  }
  return 'pass';
}

/** Pick the worst tier status across a list (error > block > fail > pass > skipped). */
function worstStatus(statuses: TierStatus[]): TierStatus {
  if (statuses.length === 0) return 'error';
  const order: Record<TierStatus, number> = {
    error: 4,
    block: 3,
    fail: 2,
    pass: 1,
    skipped: 0,
  };
  let worst: TierStatus = 'pass';
  for (const s of statuses) {
    if (order[s] > order[worst]) worst = s;
  }
  return worst;
}

/** List evidence files matching `*.{slot}.json` under the task's evidence/. */
function listEvidenceFilesForSlot(
  root: string,
  missionId: string,
  taskId: string,
  slot: string,
): string[] {
  const dir = evidenceDir(root, missionId, taskId);
  if (!exists(dir)) return [];
  const suffix = `.${slot}.json`;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .map((f) => path.join(dir, f));
}

/** Read an evidence file (tolerates missing/corrupt). */
function readEvidenceFile(filePath: string): EvidenceFile | null {
  return readJsonFile<EvidenceFile>(filePath);
}

/** Return the latest entry of a given kind, or null. */
function latestEntryOfKind(
  file: EvidenceFile | null,
  kind: EvidenceEntry['evidence_kind'],
): EvidenceEntry | null {
  if (!file || !Array.isArray(file.entries)) return null;
  for (let i = file.entries.length - 1; i >= 0; i--) {
    const e = file.entries[i];
    if (e && e.evidence_kind === kind) return e;
  }
  return null;
}

// ── Tier computations ─────────────────────────────────────────────────

function computeTier0(
  root: string,
  missionId: string,
  taskId: string,
  contract: TaskContractFile,
  taskState: TaskStateFile | null,
): TierResult {
  const fails: string[] = [];
  const notes: string[] = [];

  // task-state.status
  if (!taskState) {
    fails.push('task-state.json missing');
  } else if (taskState.status !== 'reviewed') {
    fails.push(
      `task-state.status is '${taskState.status}'; gate requires 'reviewed'`,
    );
  }

  // implementation-contract
  const implPath = implementationContractPath(root, missionId, taskId);
  if (!exists(implPath)) {
    fails.push('implementation-contract.json missing');
  } else {
    const impl = readJsonFile<unknown>(implPath);
    const v = validate('implementation-contract', impl);
    if (!v.ok) {
      fails.push('implementation-contract.json schema-invalid');
    } else {
      notes.push('implementation-contract.json present and valid');
    }
  }

  // self-check
  const scPath = selfCheckPath(root, missionId, taskId);
  if (!exists(scPath)) {
    fails.push('self-check.json missing');
  } else {
    const sc = readJsonFile<unknown>(scPath);
    const v = validate('self-check', sc);
    if (!v.ok) {
      fails.push('self-check.json schema-invalid');
    } else {
      notes.push('self-check.json present and valid');
    }
  }

  // required reviewers: presence of a valid review-kind entry per slot
  const required = Array.isArray(contract.routing?.required_reviewers)
    ? (contract.routing!.required_reviewers as string[])
    : [];
  for (const slot of required) {
    const files = listEvidenceFilesForSlot(root, missionId, taskId, slot);
    if (files.length === 0) {
      fails.push(`reviewer slot '${slot}': no evidence/*.${slot}.json file`);
      continue;
    }
    let sawValidReview = false;
    for (const fp of files) {
      const ef = readEvidenceFile(fp);
      const last = latestEntryOfKind(ef, 'review');
      if (
        last &&
        typeof last.verdict === 'string' &&
        ['approved', 'changes_requested', 'blocked'].includes(last.verdict)
      ) {
        sawValidReview = true;
        notes.push(
          `reviewer '${slot}': ${path.basename(fp)} entry_id=${last.entry_id} verdict=${last.verdict}`,
        );
        break;
      }
    }
    if (!sawValidReview) {
      fails.push(
        `reviewer slot '${slot}': no valid review-kind entry with verdict in {approved, changes_requested, blocked}`,
      );
    }
  }

  if (fails.length > 0) {
    return {
      status: 'fail',
      details: `Tier 0 fail: ${fails.join('; ')}`,
    };
  }
  return {
    status: 'pass',
    details: `Tier 0 pass. ${notes.join('; ')}`,
  };
}

function computeTier1(
  root: string,
  missionId: string,
  taskId: string,
): TierResult {
  const verifierFiles = listEvidenceFilesForSlot(
    root,
    missionId,
    taskId,
    'verifier',
  );
  if (verifierFiles.length === 0) {
    return {
      status: 'error',
      details:
        'Tier 1 error: no evidence/*.verifier.json file found. Verifier must append a verification-kind entry before the gate runs.',
    };
  }

  const perFile: Array<{
    file: string;
    status: TierStatus;
    note: string;
  }> = [];

  for (const fp of verifierFiles) {
    const ef = readEvidenceFile(fp);
    const last = latestEntryOfKind(ef, 'verification');
    const base = path.basename(fp);
    if (!last) {
      perFile.push({
        file: fp,
        status: 'error',
        note: `${base}: no verification-kind entry`,
      });
      continue;
    }
    const verdict = last.verdict;
    const criteria = Array.isArray(last.criteria_results)
      ? last.criteria_results
      : [];

    // Consistency: verdict=approved requires all criteria_results.passed=true
    if (verdict === 'approved' && criteria.some((c) => c.passed !== true)) {
      const failedCount = criteria.filter((c) => c.passed !== true).length;
      perFile.push({
        file: fp,
        status: 'error',
        note: `${base}: verdict=approved but ${failedCount}/${criteria.length} criteria have passed=false (internal contradiction)`,
      });
      continue;
    }

    let status: TierStatus;
    if (verdict === 'approved') status = 'pass';
    else if (verdict === 'changes_requested') status = 'fail';
    else if (verdict === 'blocked') status = 'block';
    else {
      perFile.push({
        file: fp,
        status: 'error',
        note: `${base}: entry_id=${last.entry_id} has no recognized verdict`,
      });
      continue;
    }

    const passedCount = criteria.filter((c) => c.passed === true).length;
    perFile.push({
      file: fp,
      status,
      note: `${base}: entry_id=${last.entry_id} verdict=${verdict} criteria=${passedCount}/${criteria.length}`,
    });
  }

  const status = worstStatus(perFile.map((p) => p.status));
  const details = `Tier 1 ${status}: ${perFile.map((p) => p.note).join('; ')}`;
  return { status, details };
}

function computeTier2(
  root: string,
  missionId: string,
  taskId: string,
  contract: TaskContractFile,
): TierResult {
  const required = Array.isArray(contract.routing?.required_reviewers)
    ? (contract.routing!.required_reviewers as string[])
    : [];

  if (required.length === 0) {
    return {
      status: 'pass',
      details: 'Tier 2 pass: no required reviewers declared in contract.',
    };
  }

  const verdicts: Array<{ slot: string; verdict: string | null; file: string | null }> = [];
  for (const slot of required) {
    const files = listEvidenceFilesForSlot(root, missionId, taskId, slot);
    let picked: { verdict: string; file: string } | null = null;
    for (const fp of files) {
      const ef = readEvidenceFile(fp);
      const last = latestEntryOfKind(ef, 'review');
      if (
        last &&
        typeof last.verdict === 'string' &&
        ['approved', 'changes_requested', 'blocked'].includes(last.verdict)
      ) {
        picked = { verdict: last.verdict, file: path.basename(fp) };
        break;
      }
    }
    verdicts.push({
      slot,
      verdict: picked ? picked.verdict : null,
      file: picked ? picked.file : null,
    });
  }

  // Aggregate: any blocked → block; any changes_requested → fail;
  // all approved → pass; any missing → error.
  const missing = verdicts.filter((v) => v.verdict === null);
  if (missing.length > 0) {
    return {
      status: 'error',
      details: `Tier 2 error: missing reviewer verdicts for ${missing.map((v) => v.slot).join(', ')}.`,
    };
  }
  const anyBlocked = verdicts.some((v) => v.verdict === 'blocked');
  if (anyBlocked) {
    return {
      status: 'block',
      details: `Tier 2 block: ${verdicts
        .map((v) => `${v.slot}=${v.verdict}`)
        .join(', ')}`,
    };
  }
  const anyChanges = verdicts.some((v) => v.verdict === 'changes_requested');
  if (anyChanges) {
    return {
      status: 'fail',
      details: `Tier 2 fail: ${verdicts
        .map((v) => `${v.slot}=${v.verdict}`)
        .join(', ')}`,
    };
  }
  return {
    status: 'pass',
    details: `Tier 2 pass: ${verdicts
      .map((v) => `${v.slot}=approved (${v.file})`)
      .join(', ')}`,
  };
}

// ── Command registration ──────────────────────────────────────────────

function registerGateRun(cmd: Command): void {
  cmd
    .command('run')
    .description(
      'Record an evidence gate run. Reads task artifacts directly and computes tier statuses itself — no stdin payload.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }

      const root = needProjectRoot();
      if (!exists(missionSpecPath(root, opts.mission))) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission}`,
          ),
        );
      }
      const contractPath = taskContractPath(root, opts.mission, opts.task);
      if (!exists(contractPath)) {
        emit(
          err('missing_artifact', `task contract not found for ${opts.task}`),
        );
      }

      const contract = readJsonFile<TaskContractFile>(contractPath);
      if (!contract) {
        emit(
          err(
            'missing_artifact',
            `task contract unreadable for ${opts.task}`,
          ),
        );
      }
      const taskState = readJsonFile<TaskStateFile>(
        taskStatePath(root, opts.mission, opts.task),
      );

      const tier0 = computeTier0(
        root,
        opts.mission,
        opts.task,
        contract as TaskContractFile,
        taskState,
      );
      const tier1 = computeTier1(root, opts.mission, opts.task);
      const tier2 = computeTier2(
        root,
        opts.mission,
        opts.task,
        contract as TaskContractFile,
      );

      const overall = overallFromTiers(tier0.status, tier1.status, tier2.status);

      const filePath = gateResultsPath(root, opts.mission, opts.task);
      const existing = readJsonFile<GateResultsFile>(filePath);
      const nextRunN =
        existing && Array.isArray(existing.runs) ? existing.runs.length + 1 : 1;
      const gateRunId = `gate-${nextRunN}`;
      const ts = nowUtc();

      const run: GateRun = {
        gate_run_id: gateRunId,
        verdict: overall,
        tier_results: {
          tier_0: tier0,
          tier_1: tier1,
          tier_2: tier2,
        },
        created_at: ts,
      };

      const merged: GateResultsFile = {
        mission_id: opts.mission,
        task_id: opts.task,
        runs:
          existing && Array.isArray(existing.runs)
            ? [...existing.runs, run]
            : [run],
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };

      const v = validate('gate-results', merged);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'gate-results schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(filePath));
      atomicWriteJson(filePath, merged, tmpDir(root));

      recordEvent(root, {
        kind: 'gate_run_recorded',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(path.relative(root, filePath)),
          gate_run_id: gateRunId,
          verdict: overall,
        },
      });

      // Suggested next transition per CLI.md §14.5.
      const suggested: {
        verdict: string;
        target_state: string | null;
        command: string | null;
      } = {
        verdict: overall,
        target_state: null,
        command: null,
      };
      if (overall === 'pass') {
        suggested.target_state = 'verified';
        suggested.command = `geas task transition --mission ${opts.mission} --task ${opts.task} --to verified`;
      } else if (overall === 'block') {
        suggested.target_state = 'blocked';
        suggested.command = `geas task transition --mission ${opts.mission} --task ${opts.task} --to blocked`;
      }

      emit(
        ok({
          path: slashPath(filePath),
          ids: {
            mission_id: opts.mission,
            task_id: opts.task,
            gate_run_id: gateRunId,
          },
          verdict: overall,
          tier_results: run.tier_results,
          suggested_next_transition: suggested,
          runs_count: merged.runs.length,
        }),
      );
    });
}

export function registerGateCommands(program: Command): void {
  const g = program
    .command('gate')
    .description('Evidence gate run recording (gate-results.json).');
  registerGateRun(g);
}
