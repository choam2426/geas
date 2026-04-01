# 10. Session Recovery and Resumability

## 목적

긴 세션, compaction, subagent interruption, 비정상 종료가 있어도 **안전한 경계에서 재개**할 수 있어야 한다.

## Recovery Classes

- `post_compact_resume`
- `warm_session_resume`
- `interrupted_subagent_resume`
- `dirty_state_recovery`
- `manual_repair_required`

## Recovery Anchor

최소 anchor:
- `run.json`
- `session-latest.md`
- `task-focus/<task-id>.md`
- latest `recovery-packet.json` (있다면)
- active task artifacts

## Checkpoint Protocol

### write-before-launch
새 subagent / risky step 시작 전 checkpoint 기록

### write-after-step
상태가 실제로 바뀐 뒤 checkpoint 갱신

### two-phase checkpoint
1. intent write — 의도한 state transition을 `run.json`에 기록
2. artifact creation / state transition — 실제 artifact를 생성하고 상태를 변경
3. commit checkpoint — `run.json`의 intent를 완료 상태로 갱신

**phase 2에서 실패 시**: intent write가 존재하지만 commit checkpoint가 없으면, 해당 transition은 미완료로 간주한다. recovery 시 intent write의 내용을 읽어 어떤 transition이 시도됐는지 파악하고, artifact가 실제 생성됐는지 확인한 후 Recovery Decision Table에 따라 처리한다.

### Step-Level Checkpoint (`remaining_steps`)

`run.json`에 `remaining_steps[]` 배열을 유지하여 현재 pipeline 진행 상태를 추적한다.

규칙:
- pipeline 시작 시 전체 step 목록을 `remaining_steps`에 기록한다
- 각 step 완료 시 해당 step을 배열에서 제거한다
- session 재개 시 `remaining_steps[0]`부터 실행한다
- `remaining_steps`가 비어 있으면 pipeline 완료로 간주한다
- step 제거는 해당 step의 artifact가 확인된 후에만 수행한다 (two-phase checkpoint와 동일 원칙)

## Safe Boundary

safe boundary에서만 exact resume를 허용한다. 예:
- task admitted, but implementation not started
- implementation finished and artifact persisted
- integration finished and result artifact persisted
- gate completed and result artifact persisted
- closure packet frozen

unsafe in-flight 상태에서는 replay 또는 rewind가 필요하다.

## Recovery Decision Table

| observed state | artifact completeness | recovery outcome |
|---|---|---|
| task implementing, worktree clean, contract exists | high | `resume_with_revalidation` |
| task implementing, worktree dirty, partial artifacts | medium | `replay_current_step` or `rewind_to_safe_boundary` |
| integrated state claimed but no integration artifact | low | `rewind_to_safe_boundary` |
| verified claimed but gate result missing | low | `rewind_to_safe_boundary` |
| passed claimed but final verdict missing | invalid | hard block |
| multiple tasks in-flight, conflicting states | varies | 각 task를 개별 평가. 가장 보수적인 recovery outcome 적용 |
| run.json 자체가 손상/누락 | none | `manual_repair_required`. `.geas/` 하위 artifact를 순회하여 상태 재구축 |

### Artifact Completeness 분류

recovery decision table에서 사용하는 artifact completeness는 아래 기준으로 결정한다:

| 등급 | 조건 |
|---|---|
| `high` | 현재 task state까지 필요한 모든 artifact가 존재하고 schema validation을 통과함 |
| `medium` | 필요한 artifact의 50% 이상이 존재하고 validation 통과함 |
| `low` | 필요한 artifact의 50% 미만이 존재하거나, 존재하는 artifact 중 validation 실패가 있음 |
| `none` | task 관련 artifact가 하나도 존재하지 않음 |
| `invalid` | artifact 파일은 존재하지만 JSON parse 실패 또는 schema validation 전체 실패 |

"필요한 artifact"는 task의 현재 state에 따라 결정된다 (doc 03 전이 테이블의 각 전이에 필요한 artifact 기준).

### Decision Table 매칭 규칙

- observed state가 여러 행에 해당할 수 있으면, artifact completeness가 가장 낮은 행의 recovery outcome을 적용한다 (보수적 원칙).
- table에 해당하지 않는 상태 조합은 `manual_repair_required`로 처리한다.

## Recovery Packet

필수 필드:
- `recovery_id` — 고유 식별자. 형식: `"recovery-{ISO8601 timestamp}"` (예: `"recovery-2026-04-01T09-30-00Z"`)
- `recovery_class` — 위 5개 Recovery Classes 중 하나의 enum 값 (`post_compact_resume` | `warm_session_resume` | `interrupted_subagent_resume` | `dirty_state_recovery` | `manual_repair_required`)
- `focus_task_id` — 중단 시점에 작업 중이던 task의 ID
- `detected_problem` — 감지된 문제의 구체적 서술
- `last_safe_boundary` — 마지막으로 확인된 safe boundary 상태
- `recommended_action` — 권장 복구 행동. enum: `exact_resume` | `replay_step` | `revalidate` | `rewind` | `manual_repair`
- `required_revalidation` — 재검증이 필요한 항목 목록
- `artifact_refs[]` — 존재가 검증 완료된 artifact 목록. 복구 시점에 실제로 존재하는 artifact만 포함해야 한다

## Worktree Recovery Rules

- worktree exists + dirty: fingerprint 남기고 safe resume 가능 여부 판단
- worktree missing + task implementing: implementation 재실행 또는 manual repair
- passed/cancelled task worktree still exists: cleanup candidate
- paused task + integration branch moved: resume 전 revalidation 필수

## Recovery Safety Rules

1. evidence 없는 claimed state를 믿지 않는다. 모든 claimed state는 해당 artifact의 존재와 내용을 검증한 후에만 수용한다.
2. missing artifact가 있으면 더 앞 단계로 rewinding 한다. rewind 대상 단계는 Recovery Decision Table의 `recovery outcome`을 따른다.
3. unsafe ambiguous 상태에서 `passed`는 절대 유지하지 않는다. 해당 task는 `rewind_to_safe_boundary`로 처리한다.
4. recovery outcome은 반드시 `recovery-packet.json` artifact로 기록한다.
5. **evidence 보존 원칙**: recovery 과정에서 기존 evidence artifact를 삭제하거나 덮어쓸 수 없다. recovery는 새 artifact를 append하거나, recovery 전용 artifact(예: `recovery-packet.json`, `revalidation-record.json`)만 생성할 수 있다.

### Recovery 중 실패 (Nested Recovery)

recovery 절차 자체가 실패하는 경우 (예: recovery-packet.json 기록 중 세션 중단, revalidation 실행 중 오류):

1. **감지**: 다음 세션 시작 시 `recovery-packet.json`의 `recommended_action`이 기록되어 있으나 해당 action의 completion artifact가 없으면 nested failure로 판단한다.
2. **escalation**: nested recovery는 자동 해소를 시도하지 않는다. `recovery_class`를 `manual_repair_required`로 설정하고 `orchestration_authority`에게 상태를 보고한다.
3. **안전 보장**: nested failure 상태에서는 어떤 task도 `implementing` 이상으로 진행할 수 없다. `orchestration_authority`가 수동으로 safe boundary를 확인하고 `recovery-packet.json`을 완성해야 진행 가능하다.

## Recovery → Evolution Feedback

non-trivial recovery(`dirty_state_recovery` 또는 `manual_repair_required`)가 발생할 때마다 recovery incident record를 생성한다.

### recovery incident record
- 저장 위치: `.geas/memory/incidents/`
- 파일명: `incident-{recovery_id}.json`
- 필수 필드: `recovery_id`, `recovery_class`, `focus_task_id`, `root_cause`, `resolution_steps`, `time_to_recover`, `prevention_suggestion`

### 학습 루프
1. `process_lead`는 retrospective에서 해당 세션의 recovery incident를 검토한다.
2. 동일한 `recovery_class`가 **2회 이상** 발생하면, 해당 패턴은 rule candidate로 자동 등록된다.
3. rule candidate는 doc 14의 Retrospective → Rule Update 프로세스를 따라 승인·적용된다.
4. 승인된 rule은 해당 recovery class의 재발을 예방하는 checkpoint 또는 hook으로 구현된다.

## Recovery Scenarios

### Scenario 1: Gate 실행 중 session이 중단된 경우

**상황 설명:**
- task `T-042`가 `verifying` 상태에 있다.
- evidence gate 3-tier 검증 중 tier 1 (mechanical check)은 통과하여 `gate-result.json`에 `tier1.verdict = pass`가 기록된 상태이다.
- tier 2 (semantic+rubric) 실행 중 session이 비정상 종료되었다.
- `.geas/tasks/T-042/gate-result.json`에는 `tier1` 결과만 존재하고, `tier2` 필드는 `in_progress` 또는 부재.

**Recovery class:** `interrupted_subagent_resume`

**Recovery 절차:**

1. **상태 감지**: session 재시작 시 `run.json`에서 `T-042`의 상태가 `verifying`임을 확인한다. `gate-result.json`을 읽어 tier1은 완료, tier2는 미완료임을 감지한다.
2. **safe boundary 판단**: tier 1 완료는 safe boundary에 해당한다 (artifact가 persist된 상태). tier 2는 unsafe in-flight 상태이다.
3. **recovery packet 생성**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T14-30-00Z",
     "recovery_class": "interrupted_subagent_resume",
     "focus_task_id": "T-042",
     "detected_problem": "gate tier 2 (semantic+rubric) 실행 중 session 중단. tier1 pass 완료, tier2 미완료.",
     "last_safe_boundary": "gate tier 1 completed",
     "recommended_action": "replay_step",
     "required_revalidation": ["gate_tier2", "gate_tier3"],
     "artifact_refs": [
       ".geas/tasks/T-042/gate-result.json",
       ".geas/tasks/T-042/integration-result.json",
       ".geas/tasks/T-042/worker-self-check.json"
     ]
   }
   ```
4. **실행**: tier 2를 처음부터 재실행한다 (idempotent — 동일 입력에 대해 동일 결과). tier 1 결과는 보존된다 (evidence 보존 원칙). tier 2 결과가 나오면 closure packet 조립 → critical reviewer challenge → final verdict 순서로 진행한다.
5. **완료**: gate 전체 결과가 확정되면 정상 흐름으로 복귀한다.

### Scenario 2: Integration 완료 후 verdict 생성 전 session이 crash된 경우

**상황 설명:**
- task `T-078`이 `integrating` 상태에 있다.
- `.geas/tasks/T-078/integration-result.json`이 존재하며, merge commit hash와 `status = success`가 기록되어 있다.
- 그러나 `closure-packet.json`은 아직 생성되지 않았고, `gate-result.json`도 이 integration 이후의 gate 실행 기록이 없다.
- `integration_lock`이 `T-078`에 의해 보유된 채 session이 종료되었다.

**Recovery class:** `warm_session_resume`

**Recovery 절차:**

1. **상태 감지**: session 재시작 시 `run.json`에서 `T-078`의 상태가 `integrating`임을 확인한다. `integration-result.json`이 존재하고 `status = success`이므로 integration 자체는 완료된 것으로 판단한다.
2. **orphan lock 정리**: `.geas/state/locks.json`에서 `T-078`이 보유한 `integration_lock`을 감지한다. 소유 session이 종료되었으므로 orphan lock으로 분류하여 해제한다.
3. **safe boundary 판단**: integration 완료 + result artifact persist는 safe boundary에 해당한다.
4. **recovery packet 생성**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T16-45-00Z",
     "recovery_class": "warm_session_resume",
     "focus_task_id": "T-078",
     "detected_problem": "integration 완료(integration-result.json 존재, status=success) 후 gate 실행 및 closure packet 생성 전 session crash.",
     "last_safe_boundary": "integration completed and result persisted",
     "recommended_action": "exact_resume",
     "required_revalidation": [],
     "artifact_refs": [
       ".geas/tasks/T-078/integration-result.json",
       ".geas/tasks/T-078/specialist-review.json",
       ".geas/tasks/T-078/worker-self-check.json",
       ".geas/tasks/T-078/implementation-contract.json"
     ]
   }
   ```
5. **실행**: task 상태를 `integrated`로 전환하고, evidence gate 실행부터 정확히 재개한다 (exact_resume). integration을 재실행하지 않는다 — `integration-result.json`이 이미 존재하므로.
6. **완료**: gate → closure packet → passed의 정상 흐름을 이어간다.

### Scenario 3: Uncommitted 변경이 있는 dirty worktree

**상황 설명:**
- task `T-115`가 `implementing` 상태에 있다.
- worktree (`worktree.path = .geas/worktrees/T-115`)에 uncommitted 변경사항이 있다: 3개 파일 수정, 1개 파일 신규 추가.
- `worker-self-check.json`은 아직 생성되지 않았다. `worker-evidence.json`도 없다.
- session이 비정상 종료되었다.

**Recovery class:** `dirty_state_recovery`

**Recovery 절차:**

1. **상태 감지**: session 재시작 시 `run.json`에서 `T-115`의 상태가 `implementing`임을 확인한다. worktree 경로를 확인하여 dirty 상태(uncommitted changes)를 감지한다.
2. **fingerprint 생성**: worktree의 현재 상태를 fingerprint한다. 변경된 파일 목록, diff 크기, 마지막 커밋 hash를 기록한다.
   ```
   fingerprint:
     last_commit: a1b2c3d
     dirty_files: ["src/api/handler.ts", "src/api/validator.ts", "src/api/types.ts", "src/api/errors.ts (new)"]
     diff_lines: +187 / -23
     worktree_exists: true
   ```
3. **recovery packet 생성**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T20-15-00Z",
     "recovery_class": "dirty_state_recovery",
     "focus_task_id": "T-115",
     "detected_problem": "worktree dirty — 4 files with uncommitted changes, no worker-self-check.json, no worker-evidence.json. 구현 진행 중 session 비정상 종료.",
     "last_safe_boundary": "implementation started, implementation-contract.json exists",
     "recommended_action": "revalidate",
     "required_revalidation": ["worktree_integrity", "implementation_progress"],
     "artifact_refs": [
       ".geas/tasks/T-115/implementation-contract.json",
       ".geas/tasks/T-115/task-contract.json"
     ]
   }
   ```
4. **orchestration_authority에게 diff 제시**: fingerprint와 함께 전체 diff를 orchestration_authority에게 보여주고, 아래 두 선택지를 제시한다:
   - **commit-and-continue**: 현재 변경사항을 worktree에 커밋하고, `implementing` 상태를 유지하여 구현을 이어간다. `implementation-contract.json`의 `touched_paths`와 현재 변경 파일을 대조하여 scope 이탈 여부를 확인한다.
   - **rewind**: uncommitted 변경을 폐기하고 마지막 커밋(`a1b2c3d`)으로 되돌린 뒤, `implementing` 상태에서 구현을 재시작한다. 변경사항은 recovery packet에 diff로 보존되므로 참고 자료로 활용 가능하다.
5. **결정 후**: 선택된 action을 실행하고, recovery outcome을 `recovery-packet.json`에 기록한다. `dirty_state_recovery` 발생 자체를 `.geas/memory/incidents/incident-recovery-2026-04-01T20-15-00Z.json`에 incident record로 남긴다.
