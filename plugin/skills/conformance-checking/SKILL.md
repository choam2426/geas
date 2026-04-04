---
name: conformance-checking
description: Meta-verification suite — 18 scenarios that verify existing Phases 1-5 enforcement mechanisms (hooks, skill directives) are correctly wired and functioning.
user-invocable: true
---

# Conformance Checking

**Purpose:** This skill is a meta-verification layer. It does not implement new behavior — it checks that existing hooks and skill directives from Phases 1-5 are working as intended. Run this when you want confidence that the Geas enforcement machinery is intact.

**Invocation:** `/geas:conformance-checking`

**Output:** `.geas/state/conformance-report.json` — timestamp, total, passed, failed, results array.

## How to Run

Execute each scenario's verification script in sequence. Collect results. Write the conformance report. Print a summary to conversation.

```bash
mkdir -p .geas/state
```

---

## Category 1: State Integrity (SI)

These scenarios verify that task state transitions are guarded by the required artifacts.

### SI-1 — Implementation Contract Required Before Implementing

**Checks:** Hook or skill directive that blocks `ready -> implementing` unless `.geas/missions/{mission_id}/contracts/{task-id}.json` exists with status "approved".

```bash
#!/usr/bin/env bash
# SI-1: Every task in status "implementing" must have an approved implementation contract
RESULT="PASS"
DETAIL=""
for task_file in .geas/missions/*/tasks/*.json; do
  [[ -f "$task_file" ]] || continue
  mission_dir=$(echo "$task_file" | sed 's|/tasks/[^/]*$||')
  status=$(python3 -c "import json,sys; d=json.load(open('$task_file')); print(d.get('status',''))" 2>/dev/null)
  if [[ "$status" == "implementing" ]]; then
    task_id=$(python3 -c "import json,sys; d=json.load(open('$task_file')); print(d.get('task_id',''))" 2>/dev/null)
    contract="${mission_dir}/contracts/${task_id}.json"
    if [[ ! -f "$contract" ]]; then
      RESULT="FAIL"
      DETAIL="${DETAIL} Missing contract for ${task_id}."
    else
      contract_status=$(python3 -c "import json; print(json.load(open('$contract')).get('status',''))" 2>/dev/null)
      if [[ "$contract_status" != "approved" ]]; then
        RESULT="FAIL"
        DETAIL="${DETAIL} Contract for ${task_id} has status '${contract_status}', expected 'approved'."
      fi
    fi
  fi
done
echo "SI-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** All tasks with status "implementing" have a corresponding `.geas/missions/{mission_id}/contracts/{task-id}.json` with `status = "approved"`. If no "implementing" tasks exist, reports PASS (nothing to violate).

---

### SI-2 — Worker Self-Check Required Before Reviewed

**Checks:** Hook or skill directive that blocks `implementing -> reviewed` unless `.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json` exists.

```bash
#!/usr/bin/env bash
# SI-2: Every task in status "reviewed" must have a worker-self-check.json
RESULT="PASS"
DETAIL=""
for task_file in .geas/missions/*/tasks/*.json; do
  [[ -f "$task_file" ]] || continue
  mission_dir=$(echo "$task_file" | sed 's|/tasks/[^/]*$||')
  status=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('status',''))" 2>/dev/null)
  if [[ "$status" == "reviewed" ]]; then
    task_id=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('task_id',''))" 2>/dev/null)
    self_check="${mission_dir}/tasks/${task_id}/worker-self-check.json"
    if [[ ! -f "$self_check" ]]; then
      RESULT="FAIL"
      DETAIL="${DETAIL} Missing worker-self-check for ${task_id}."
    fi
  fi
done
echo "SI-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** All tasks with status "reviewed" have a corresponding `.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json`. If no "reviewed" tasks exist, reports PASS.

---

### SI-3 — Final Verdict Required Before Passed

**Checks:** Hook or skill directive that blocks `verified -> passed` unless `.geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json` exists.

```bash
#!/usr/bin/env bash
# SI-3: Every task in status "passed" must have a final-verdict.json
RESULT="PASS"
DETAIL=""
for task_file in .geas/missions/*/tasks/*.json; do
  [[ -f "$task_file" ]] || continue
  mission_dir=$(echo "$task_file" | sed 's|/tasks/[^/]*$||')
  status=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('status',''))" 2>/dev/null)
  if [[ "$status" == "passed" ]]; then
    task_id=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('task_id',''))" 2>/dev/null)
    verdict_file="${mission_dir}/tasks/${task_id}/final-verdict.json"
    if [[ ! -f "$verdict_file" ]]; then
      RESULT="FAIL"
      DETAIL="${DETAIL} Missing final-verdict for ${task_id}."
    fi
  fi
done
echo "SI-3: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** All tasks with status "passed" have a corresponding `.geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json`. If no "passed" tasks exist, reports PASS.

---

## Category 2: Drift / Revalidation (DR)

These scenarios verify that staleness detection and revalidation logic are wired correctly.

### DR-1 — Stale-Start-Check Hook Registered

**Checks:** `plugin/hooks/scripts/stale-start-check.sh` exists and is registered in `plugin/hooks/hooks.json` under a `PostToolUse` event.

```bash
#!/usr/bin/env bash
# DR-1: stale-start-check.sh must exist and be registered in hooks.json
RESULT="PASS"
DETAIL=""
SCRIPT="plugin/hooks/scripts/stale-start-check.sh"
HOOKS="plugin/hooks/hooks.json"

if [[ ! -f "$SCRIPT" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${SCRIPT} does not exist."
fi

if [[ ! -f "$HOOKS" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${HOOKS} does not exist."
else
  if ! grep -q "stale-start-check.sh" "$HOOKS"; then
    RESULT="FAIL"
    DETAIL="${DETAIL} stale-start-check.sh not found in hooks.json."
  fi
fi
echo "DR-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** Both the script file exists and the string "stale-start-check.sh" appears in `plugin/hooks/hooks.json`.

---

### DR-2 — Revalidation Logic in Orchestrating Pipeline

**Checks:** `orchestrating/references/pipeline.md` contains a "Baseline Check" section (or keyword), confirming revalidation logic is present in the execution pipeline.

```bash
#!/usr/bin/env bash
# DR-2: orchestrating pipeline must contain "Baseline Check" revalidation logic
RESULT="PASS"
DETAIL=""

SKILL="plugin/skills/orchestrating/references/pipeline.md"
if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
elif ! grep -qi "Baseline Check" "$SKILL"; then
  RESULT="FAIL"
  DETAIL=" 'Baseline Check' not found in ${SKILL}."
fi
echo "DR-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/skills/orchestrating/references/pipeline.md` contains the text "Baseline Check" (case-insensitive).

---

## Category 3: Parallelism / Locking (PL)

These scenarios verify that lock conflict prevention scripts are present and registered.

### PL-1 — Lock Conflict Check Hook Registered

**Checks:** `plugin/hooks/scripts/lock-conflict-check.sh` exists and is registered in `plugin/hooks/hooks.json`.

```bash
#!/usr/bin/env bash
# PL-1: lock-conflict-check.sh must exist and be registered in hooks.json
RESULT="PASS"
DETAIL=""
SCRIPT="plugin/hooks/scripts/lock-conflict-check.sh"
HOOKS="plugin/hooks/hooks.json"

if [[ ! -f "$SCRIPT" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${SCRIPT} does not exist."
fi

if [[ ! -f "$HOOKS" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${HOOKS} does not exist."
else
  if ! grep -q "lock-conflict-check.sh" "$HOOKS"; then
    RESULT="FAIL"
    DETAIL="${DETAIL} lock-conflict-check.sh not found in hooks.json."
  fi
fi
echo "PL-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** Both the script file exists and "lock-conflict-check.sh" appears in `plugin/hooks/hooks.json`.

---

### PL-2 — Integration Lane Check Hook Registered

**Checks:** `plugin/hooks/scripts/integration-lane-check.sh` exists and is registered in `plugin/hooks/hooks.json`.

```bash
#!/usr/bin/env bash
# PL-2: integration-lane-check.sh must exist and be registered in hooks.json
RESULT="PASS"
DETAIL=""
SCRIPT="plugin/hooks/scripts/integration-lane-check.sh"
HOOKS="plugin/hooks/hooks.json"

if [[ ! -f "$SCRIPT" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${SCRIPT} does not exist."
fi

if [[ ! -f "$HOOKS" ]]; then
  RESULT="FAIL"
  DETAIL="${DETAIL} ${HOOKS} does not exist."
else
  if ! grep -q "integration-lane-check.sh" "$HOOKS"; then
    RESULT="FAIL"
    DETAIL="${DETAIL} integration-lane-check.sh not found in hooks.json."
  fi
fi
echo "PL-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** Both the script file exists and "integration-lane-check.sh" appears in `plugin/hooks/hooks.json`.

---

## Category 4: Gate / Rubric (GR)

These scenarios verify that the evidence gate implements the required threshold adjustment and stub cap logic from the protocol.

### GR-1 — Low-Confidence Threshold Adjustment Logic Present

**Checks:** `evidence-gate/SKILL.md` contains logic for adjusting gate thresholds when worker self-check `confidence <= 2`.

```bash
#!/usr/bin/env bash
# GR-1: evidence-gate/SKILL.md must contain "confidence <= 2" threshold adjustment logic
RESULT="PASS"
DETAIL=""
GATE="plugin/skills/evidence-gate/SKILL.md"

if [[ ! -f "$GATE" ]]; then
  RESULT="FAIL"
  DETAIL=" ${GATE} does not exist."
else
  if ! grep -q "confidence <= 2" "$GATE"; then
    RESULT="FAIL"
    DETAIL=" 'confidence <= 2' threshold adjustment not found in evidence-gate/SKILL.md."
  fi
fi
echo "GR-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** The text "confidence <= 2" appears in `plugin/skills/evidence-gate/SKILL.md`, indicating that the low-confidence threshold adjustment logic is documented and enforced.

---

### GR-2 — Stub Cap Table Present in Evidence Gate

**Checks:** `evidence-gate/SKILL.md` contains a stub cap table with `risk_level` thresholds (critical/high/normal/low), confirming the stub cap verification from doc 12 is implemented.

```bash
#!/usr/bin/env bash
# GR-2: evidence-gate/SKILL.md must contain stub cap table with risk_level thresholds
RESULT="PASS"
DETAIL=""
GATE="plugin/skills/evidence-gate/SKILL.md"

if [[ ! -f "$GATE" ]]; then
  RESULT="FAIL"
  DETAIL=" ${GATE} does not exist."
else
  # Check for stub cap concept and at least one risk_level reference
  if ! grep -qi "stub cap" "$GATE" && ! grep -qi "possible_stubs" "$GATE"; then
    RESULT="FAIL"
    DETAIL=" Stub cap logic not found in evidence-gate/SKILL.md."
  elif ! grep -q "risk_level" "$GATE"; then
    RESULT="FAIL"
    DETAIL=" risk_level thresholds not found in evidence-gate/SKILL.md."
  fi
fi
echo "GR-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/skills/evidence-gate/SKILL.md` references stub cap logic (via "stub cap" or "possible_stubs") AND contains "risk_level" threshold references.

---

## Category 5: Memory Evolving (ME)

These scenarios verify that memory lifecycle enforcement scripts and rollback logic are in place.

### ME-1 — Memory Promotion Gate Script Present

**Checks:** `plugin/hooks/scripts/memory-promotion-gate.sh` exists and checks low-quality incident promotion conditions (evidence_refs count, gate score, task status).

```bash
#!/usr/bin/env bash
# ME-1: memory-promotion-gate.sh must exist and contain promotion condition checks
RESULT="PASS"
DETAIL=""
SCRIPT="plugin/hooks/scripts/memory-promotion-gate.sh"

if [[ ! -f "$SCRIPT" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SCRIPT} does not exist."
else
  # Check that the script references evidence quality conditions
  if ! grep -q "evidence_refs" "$SCRIPT" && ! grep -qi "low.quality" "$SCRIPT" && ! grep -qi "promotion" "$SCRIPT"; then
    RESULT="FAIL"
    DETAIL=" memory-promotion-gate.sh does not appear to check promotion conditions (evidence_refs/low-quality/promotion not found)."
  fi
fi
echo "ME-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/hooks/scripts/memory-promotion-gate.sh` exists and contains references to promotion condition logic (evidence_refs, quality checks, or promotion keywords).

---

### ME-2 — Memory Superseded Warning Script Present

**Checks:** `plugin/hooks/scripts/memory-superseded-warning.sh` exists and detects superseded memory entries (state = "superseded") in context packets.

```bash
#!/usr/bin/env bash
# ME-2: memory-superseded-warning.sh must exist and reference superseded state detection
RESULT="PASS"
DETAIL=""
SCRIPT="plugin/hooks/scripts/memory-superseded-warning.sh"

if [[ ! -f "$SCRIPT" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SCRIPT} does not exist."
else
  if ! grep -q "superseded" "$SCRIPT"; then
    RESULT="FAIL"
    DETAIL=" memory-superseded-warning.sh does not reference 'superseded' state detection."
  fi
fi
echo "ME-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/hooks/scripts/memory-superseded-warning.sh` exists and contains the word "superseded".

---

### ME-3 — Harmful Reuse Rollback in Memorizing Skill

**Checks:** `memorizing/SKILL.md` contains the harmful reuse rollback logic: when `failed_reuses >= 2`, the memory must transition to `under_review`.

```bash
#!/usr/bin/env bash
# ME-3: memorizing/SKILL.md must contain harmful reuse rollback (failed_reuses >= 2 → under_review)
RESULT="PASS"
DETAIL=""
SKILL="plugin/skills/memorizing/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
else
  HAS_FAILED_REUSES=$(grep -c "failed_reuses" "$SKILL" 2>/dev/null || echo 0)
  HAS_UNDER_REVIEW=$(grep -c "under_review" "$SKILL" 2>/dev/null || echo 0)
  if [[ "$HAS_FAILED_REUSES" -eq 0 ]] || [[ "$HAS_UNDER_REVIEW" -eq 0 ]]; then
    RESULT="FAIL"
    DETAIL=" memorizing/SKILL.md missing 'failed_reuses' (found: ${HAS_FAILED_REUSES}) or 'under_review' (found: ${HAS_UNDER_REVIEW}) — harmful reuse rollback may be absent."
  fi
fi
echo "ME-3: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/skills/memorizing/SKILL.md` contains both "failed_reuses" and "under_review", indicating the harmful reuse rollback procedure is documented.

---

## Category 6: Evolving Loop (EL)

These scenarios verify that evolving phase exit gates, debt tracking, and rules update steps are present in the orchestrating skill.

### EL-1 — Retrospective Required for Passed Tasks

**Checks:** For each task with status "passed" in `.geas/missions/{mission_id}/tasks/`, verify that `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` exists.

```bash
#!/usr/bin/env bash
# EL-1: Every task in status "passed" must have a retrospective.json
RESULT="PASS"
DETAIL=""
for task_file in .geas/missions/*/tasks/*.json; do
  [[ -f "$task_file" ]] || continue
  mission_dir=$(echo "$task_file" | sed 's|/tasks/[^/]*$||')
  status=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('status',''))" 2>/dev/null)
  if [[ "$status" == "passed" ]]; then
    task_id=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('task_id',''))" 2>/dev/null)
    retro="${mission_dir}/tasks/${task_id}/retrospective.json"
    if [[ ! -f "$retro" ]]; then
      RESULT="FAIL"
      DETAIL="${DETAIL} Missing retrospective for ${task_id}."
    fi
  fi
done
echo "EL-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** All tasks with status "passed" have a corresponding `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json`. If no "passed" tasks exist, reports PASS.

---

### EL-2 — Evolving Exit Gate Requires Gap Assessment

**Checks:** `orchestrating/references/evolving.md` contains a reference to `gap-assessment.json` as a prerequisite for closing the Evolving phase.

```bash
#!/usr/bin/env bash
# EL-2: orchestrating/references/evolving.md must require gap-assessment.json before closing evolving phase
RESULT="PASS"
DETAIL=""
SKILL="plugin/skills/orchestrating/references/evolving.md"

if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
else
  if ! grep -q "gap-assessment" "$SKILL"; then
    RESULT="FAIL"
    DETAIL=" 'gap-assessment' not found in orchestrating/references/evolving.md — evolving exit gate may be missing."
  fi
fi
echo "EL-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** The string "gap-assessment" appears in `plugin/skills/orchestrating/references/evolving.md`.

---

### EL-3 — Phase Close Requires Debt Register

**Checks:** `orchestrating/references/evolving.md` contains a reference to `debt-register.json` as required when closing the polishing or evolving phase.

```bash
#!/usr/bin/env bash
# EL-3: orchestrating/references/evolving.md must require debt-register.json for phase close
RESULT="PASS"
DETAIL=""
SKILL="plugin/skills/orchestrating/references/evolving.md"

if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
else
  if ! grep -q "debt-register" "$SKILL"; then
    RESULT="FAIL"
    DETAIL=" 'debt-register' not found in orchestrating/references/evolving.md — phase close debt gate may be missing."
  fi
fi
echo "EL-3: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** The string "debt-register" appears in `plugin/skills/orchestrating/references/evolving.md`.

---

### EL-4 — Rules Update Approval Step Present

**Checks:** `orchestrating/references/evolving.md` contains a Rules Update Approval step (or equivalent), confirming that rules.md changes require product_authority sign-off before taking effect.

```bash
#!/usr/bin/env bash
# EL-4: orchestrating/references/evolving.md must contain a Rules Update Approval step
RESULT="PASS"
DETAIL=""
SKILL="plugin/skills/orchestrating/references/evolving.md"

if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
else
  HAS_RULES_APPROVAL=$(grep -ci "rules.*update.*approv\|approv.*rules.*update\|4\.2\.5\|rules update approval" "$SKILL" 2>/dev/null || echo 0)
  if [[ "$HAS_RULES_APPROVAL" -eq 0 ]]; then
    RESULT="FAIL"
    DETAIL=" Rules Update Approval step not found in orchestrating/references/evolving.md (checked for 'rules update approval', '4.2.5')."
  fi
fi
echo "EL-4: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/skills/orchestrating/references/evolving.md` contains a Rules Update Approval step, identified by "rules update approval" (case-insensitive) or "4.2.5".

---

## Category 7: Recovery (RC)

These scenarios verify that gate result artifacts and recovery decision logic are present and enforced.

### RC-1 — Gate Result Required for Verified Tasks

**Checks:** For each task with status "verified" in `.geas/missions/{mission_id}/tasks/`, verify that `.geas/missions/{mission_id}/tasks/{task-id}/gate-result.json` exists. A verified claim without a gate result triggers a rewind.

```bash
#!/usr/bin/env bash
# RC-1: Every task in status "verified" must have a gate-result.json
RESULT="PASS"
DETAIL=""
for task_file in .geas/missions/*/tasks/*.json; do
  [[ -f "$task_file" ]] || continue
  mission_dir=$(echo "$task_file" | sed 's|/tasks/[^/]*$||')
  status=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('status',''))" 2>/dev/null)
  if [[ "$status" == "verified" ]]; then
    task_id=$(python3 -c "import json; d=json.load(open('$task_file')); print(d.get('task_id',''))" 2>/dev/null)
    gate_result="${mission_dir}/tasks/${task_id}/gate-result.json"
    if [[ ! -f "$gate_result" ]]; then
      RESULT="FAIL"
      DETAIL="${DETAIL} Missing gate-result for verified task ${task_id} — rewind required."
    fi
  fi
done
echo "RC-1: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** All tasks with status "verified" have a corresponding `.geas/missions/{mission_id}/tasks/{task-id}/gate-result.json`. If no "verified" tasks exist, reports PASS.

---

### RC-2 — Recovery Decision Table in Orchestrating Skill

**Checks:** `orchestrating/SKILL.md` contains a recovery decision table with `dirty_state_recovery` handling, confirming the doc 10 recovery logic is present.

```bash
#!/usr/bin/env bash
# RC-2: orchestrating/SKILL.md must contain recovery decision table with dirty_state_recovery
RESULT="PASS"
DETAIL=""
SKILL="plugin/skills/orchestrating/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  RESULT="FAIL"
  DETAIL=" ${SKILL} does not exist."
else
  HAS_RECOVERY_TABLE=$(grep -ci "recovery.*decision\|dirty.state.recovery\|recovery_class" "$SKILL" 2>/dev/null || echo 0)
  if [[ "$HAS_RECOVERY_TABLE" -eq 0 ]]; then
    RESULT="FAIL"
    DETAIL=" Recovery decision table not found in orchestrating/SKILL.md (checked for 'recovery decision', 'dirty_state_recovery', 'recovery_class')."
  fi
fi
echo "RC-2: ${RESULT}${DETAIL:+ —$DETAIL}"
```

**Pass condition:** `plugin/skills/orchestrating/SKILL.md` contains recovery decision table language ("recovery decision", "dirty_state_recovery", or "recovery_class").

---

## Execution and Output

Run all 18 scenarios in order. Collect the output of each script. Parse PASS/FAIL from the first token after the scenario ID.

Write the conformance report:

```python
#!/usr/bin/env python3
import json
from datetime import datetime, timezone

# results is a list of dicts populated from the scenario outputs above
# Each dict: {"id": "SI-1", "name": "...", "result": "PASS"|"FAIL"|"SKIP", "detail": "..."}

results = []  # Populated during execution above

passed = sum(1 for r in results if r["result"] == "PASS")
failed = sum(1 for r in results if r["result"] == "FAIL")
skipped = sum(1 for r in results if r["result"] == "SKIP")

report = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "total": len(results),
    "passed": passed,
    "failed": failed,
    "skipped": skipped,
    "results": results
}

import os
os.makedirs(".geas/state", exist_ok=True)
with open(".geas/state/conformance-report.json", "w") as f:
    json.dump(report, f, indent=2)

print(f"\nConformance Report: {passed}/{len(results)} passed, {failed} failed, {skipped} skipped")
if failed > 0:
    print("FAILED scenarios:")
    for r in results:
        if r["result"] == "FAIL":
            print(f"  {r['id']} {r['name']}: {r.get('detail', '')}")
```

### Output location

`.geas/state/conformance-report.json`

```json
{
  "timestamp": "<ISO 8601>",
  "total": 18,
  "passed": 16,
  "failed": 2,
  "skipped": 0,
  "results": [
    {
      "id": "SI-1",
      "name": "Implementation Contract Required Before Implementing",
      "result": "PASS",
      "detail": ""
    },
    {
      "id": "GR-1",
      "name": "Low-Confidence Threshold Adjustment Logic Present",
      "result": "FAIL",
      "detail": "'confidence <= 2' threshold adjustment not found in evidence-gate/SKILL.md."
    }
  ]
}
```

### When to run

- After any Phase migration change to verify nothing regressed
- At the start of a Phase 6 refinement session
- On-demand via `/geas:conformance-checking` when enforcement behavior is in question
- Before marking a phase as complete in CLAUDE.md
