# 03. Task Model and Lifecycle

## Task Classification

### `task_kind`
- `code`
- `docs`
- `config`
- `design`
- `audit`
- `release`

### `risk_level`
- `low`
- `normal`
- `high`
- `critical`

### `gate_profile`
- `code_change`
- `artifact_only`
- `closure_ready`

### `vote_round_policy`
- `never`
- `auto`
- `always`

## Core Task Metadata

- `task_id`
- `title`
- `description`
- `task_kind`
- `risk_level`
- `state`
- `base_commit`
- `scope.paths`
- `acceptance_criteria[]`
- `routing.primary_worker_type`
- `routing.required_reviewer_types[]`
- `gate_profile`
- `vote_round_policy`
- `retry_budget`
- `worktree`

## Task States

### Primary
- `drafted`
- `ready`
- `implementing`
- `reviewed`
- `integrated`
- `verified`
- `passed`

### Auxiliary
- `blocked`
- `escalated`
- `cancelled`

## Failure는 state가 아니다
실패는 `FailureRecord`로 남긴다. task는 rewind target으로 되돌아간다.

### FailureRecord 필수 필드
- `task_id`
- `failed_at_state`: 실패가 발생한 시점의 task state
- `failure_reason`: 실패 원인 요약
- `rewind_target`: 되돌아갈 state (`implementing | reviewed | ready | escalated`)
- `timestamp`
- `retry_budget_before`: 실패 시점의 남은 retry_budget
- `retry_budget_after`: rewind 후 남은 retry_budget

## Implementation Contract

코드 작성 전 아래를 최소로 고정한다.
- `plan_summary`
- `touched_paths`
- `non_goals`
- `demo_steps`
- `known_risks`
- `required_checks`

이 contract는 최소한 primary worker와 지정 reviewer가 읽을 수 있어야 하며, `implementing` 진입 전 존재해야 한다.

### Implementation Contract 거부 시
reviewer가 implementation contract에 대해 변경을 요청(`changes_requested`)하면 task는 `ready` 상태에 머무른다. contract를 수정하여 reviewer가 승인할 때까지 `implementing`으로 전환할 수 없다. 3회 연속 거부 시 orchestration_authority는 task를 `escalated`로 전환하거나 task를 재분해해야 한다.

## Worker Self-Check

primary worker는 구현을 끝냈다고 주장하기 전에 반드시 `worker-self-check.json`을 남긴다.

필수 필드:
- `known_risks[]`
- `untested_paths[]`
- `possible_stubs[]`
- `what_to_test_next[]`
- `confidence` (1~5)
- `summary`

목적:
- `qa_engineer`가 어떤 failure path를 먼저 볼지 우선순위 부여
- `architecture_authority`가 `known_risks`를 중심으로 리뷰 초점 설정
- `critical_reviewer`가 worker가 스스로 불안해하는 지점을 압축 파악
- `frontend_engineer` / `backend_engineer`가 해당 영역의 기술적 세부사항을 집중 검토
- evidence gate가 low-confidence threshold adjustment와 stub cap을 적용할 근거 제공

## Debt Emission at Task Level

어떤 task도 리뷰/검증 과정에서 기술 부채를 남길 수 있다. debt는 blocking defect와 다르며, 아래 artifact에 축적될 수 있다.
- `worker-self-check.json`
- `specialist-review.json`
- `integration-result.json`
- `closure-packet.json`
- `debt-register.json`

최소 분류:
- `severity = low | medium | high | critical`
- `kind = code_quality | test_gap | architecture | security | docs | ops | product_gap`

## Transition Table

| from | to | required artifact / condition |
|---|---|---|
| drafted | ready | task compiled, baseline valid (base_commit이 integration branch HEAD의 ancestor이거나 HEAD와 동일) |
| ready | implementing | implementation contract approved, worktree prepared |
| implementing | reviewed | worker self-check exists + required specialist review set exists (routing algorithm은 doc 01 참조) |
| reviewed | integrated | integration result created |
| integrated | verified | gate result pass or block-resolved |
| verified | passed | closure packet complete + final verdict pass |
| any active | blocked | capability/resource/lock issue |
| any active | escalated | explicit escalation or unresolved conflict |
| any active | cancelled | orchestration_authority 또는 product_authority의 명시적 취소 결정. 취소 사유를 task metadata에 기록 |
| blocked | ready | blocking 원인 해소 후 revalidation 통과 |
| escalated | ready | escalation 해소 후 orchestration_authority가 re-entry 결정 |
| verified | implementing | gate fail + verify-fix loop. retry_budget 1 차감 |
| integrated | reviewed | integration failure. revalidation 필요 |
| verified | ready | final verdict `iterate` (rewind target = ready). retry_budget 미차감, iterate 3회 누적 시 escalated |
| verified | implementing | final verdict `iterate` (rewind target = implementing). retry_budget 미차감 |
| blocked | cancelled | orchestration_authority 또는 product_authority의 명시적 취소 결정 |
| escalated | cancelled | orchestration_authority 또는 product_authority의 명시적 취소 결정 |

Final verdict `iterate`의 유효한 rewind target은 `ready`, `implementing`, `reviewed` 중 하나다. `drafted`나 `integrated`로는 rewind할 수 없다.

`blocked`와 `escalated`는 "active" 상태에 포함된다. 따라서 `blocked` → `cancelled`과 `escalated` → `cancelled` 전이가 가능하다.

## Transition Invariants

1. `implementing` 전에 `implementation-contract.json`이 있어야 한다.
2. `reviewed` 전에 `worker-self-check.json`과 required specialist review가 모두 존재해야 한다.
3. `integrated` 전에 integration lane를 통과해야 한다.
4. `verified` 전에 gate 결과가 있어야 한다.
5. `passed` 전에 closure packet과 final verdict가 있어야 한다.

## Default Rewind Rules

- implementation failure → `implementing`
- integration failure → `reviewed`
- invalidated assumptions → `ready`
- unresolved major conflict → `escalated`

## retry_budget 소진 규칙

`retry_budget`은 verify-fix loop에서 재시도 가능 횟수를 제한한다.

### 초기값 (gate_profile별)

| gate_profile | 초기 retry_budget |
|---|---|
| `code_change` | 3 |
| `artifact_only` | 3 |
| `closure_ready` | 2 |

risk_level이 `high`이면 초기값에서 -1, `critical`이면 -1 (최소값은 1).

### 소진 규칙

1. gate 결과가 `fail`일 때 verify-fix iteration을 1회 수행하면 `retry_budget`을 1 차감한다.
2. `retry_budget`이 0에 도달하면 추가 verify-fix iteration은 금지된다.
3. `retry_budget == 0`이면 아래 중 하나를 수행해야 한다:
   - `escalated` 상태로 전환하여 forge-review 요청
   - product_authority에게 product-decision 요청 (scope 축소, 기준 완화 등)
   - task를 pivot하여 새 task로 분리

### 예외

orchestration_authority가 명시적 근거와 함께 retry_budget을 1 추가 부여할 수 있다. 이 경우 해당 근거를 task metadata에 `budget_extension_reason`으로 기록해야 한다. 추가 부여는 task당 최대 1회이다.

## Worker Self-Check confidence와 Gate Strictness 연동

worker-self-check.json의 `confidence` 값이 gate 검증 엄격도에 영향을 준다. 상세한 적용 규칙은 doc 05 "Low Confidence Threshold Adjustment" 섹션을 참조한다.

요약:
- `confidence` 3~5: 조정 없음 (기본 threshold 적용)
- `confidence` 1~2: **모든** rubric dimension의 threshold를 +1 상향

worker-self-check.json의 `confidence`는 단일 scalar (1-5)이므로, threshold 조정은 전체 dimension에 일괄 적용된다. 향후 per-dimension confidence가 schema에 추가되면 해당 dimension에만 적용하도록 확장할 수 있다.

예시: worker-self-check.json의 `confidence`가 2이면 모든 dimension의 threshold가 +1 상향된다 (`core_interaction` 3→4, `feature_completeness` 4→5, 등).

이 조정의 목적은 worker 자신이 불확실하다고 표명한 구현에 대해 더 높은 검증 기준을 적용하는 것이다.

## 대표적인 Task 흐름 예시

### Example 1: Standard code task (happy path)

`task_kind = code`, `risk_level = normal`, `gate_profile = code_change`, `retry_budget = 3`인 일반적인 코드 task의 전체 흐름이다.

**1. `drafted` → `ready`**
- **산출물**: `task-contract.json` (`.geas/tasks/{task_id}/task-contract.json`)
- **수행자**: `task_compiler` (orchestration_authority 지시 하에)
- **조건**: task contract가 컴파일 완료되고, `base_commit`이 `tip(integration_branch)`의 ancestor이거나 동일해야 한다. `acceptance_criteria[]`, `routing`, `gate_profile`이 모두 확정되어야 한다.

**2. `ready` → `implementing`**
- **산출물**: `implementation-contract.json` (`.geas/tasks/{task_id}/implementation-contract.json`)
- **수행자**: primary worker (routing.primary_worker_type에 해당하는 agent)
- **조건**: implementation contract가 작성되고 지정 reviewer가 읽을 수 있는 상태여야 한다. worktree가 `worktree.path`에 준비 완료되어야 한다. 필요한 path_lock / interface_lock이 획득된 상태여야 한다.

**3. `implementing` (구현 작업 수행)**
- **산출물**: 코드 변경사항 (worktree 내 커밋), `worker-self-check.json` (`.geas/tasks/{task_id}/worker-self-check.json`)
- **수행자**: primary worker
- **조건**: worker가 구현을 완료하고, `worker-self-check.json`의 `confidence`, `known_risks[]`, `untested_paths[]` 등 필수 필드를 모두 작성해야 한다.

**4. `implementing` → `reviewed`**
- **산출물**: `specialist-review.json` (`.geas/tasks/{task_id}/specialist-review.json`, reviewer type별로 각각 생성)
- **수행자**: `routing.required_reviewer_types[]`에 지정된 specialist agents (예: `architecture_authority`, `qa_engineer`)
- **조건**: `worker-self-check.json`이 존재하고, 모든 required specialist review가 완료되어야 한다. 각 review에 blocking defect가 없거나, 있었다면 해결 완료 상태여야 한다.

**5. `reviewed` → `integrated`**
- **산출물**: `integration-result.json` (`.geas/tasks/{task_id}/integration-result.json`)
- **수행자**: orchestration_authority (integration lane 관리)
- **조건**: `integration_lock`을 획득하고, worktree의 변경사항을 integration branch에 병합한다. staleness 분류가 `clean_sync` 또는 `review_sync`여야 한다 (`replan_required`나 `blocking_conflict`이면 rewind). integration-result.json에 merge commit hash, conflict 유무, drift 정보를 기록한다.

**6. `integrated` → `verified`**
- **산출물**: `gate-result.json` (`.geas/tasks/{task_id}/gate-result.json`)
- **수행자**: evidence gate (3-tier 검증: mechanical → semantic+rubric → product)
- **조건**: gate 결과가 `pass`여야 한다. 이 예시에서는 모든 tier를 통과하여 `verdict = pass`가 기록된다.

**7. `verified` → `passed`**
- **산출물**: `closure-packet.json` (`.geas/tasks/{task_id}/closure-packet.json`)
- **수행자**: orchestration_authority
- **조건**: closure packet이 완성되어야 한다. final verdict가 `pass`이고, 모든 acceptance criteria가 충족되었음이 기록된다. debt가 있다면 `debt-register.json`에 등록된다. task의 모든 lock이 해제되고, worktree는 cleanup candidate로 전환된다.

```
drafted ──[task-contract.json]──→ ready
  ──[implementation-contract.json]──→ implementing
  ──[worker-self-check.json + specialist-review.json]──→ reviewed
  ──[integration-result.json]──→ integrated
  ──[gate-result.json (pass)]──→ verified
  ──[closure-packet.json]──→ passed ✓
```

### Example 2: Task that fails gate and uses retry budget

`task_kind = code`, `risk_level = normal`, `gate_profile = code_change`, 초기 `retry_budget = 3`인 task가 evidence gate에서 두 번 실패한 뒤 통과하는 흐름이다. `integrated` 이후부터의 흐름을 상세히 보여준다.

**1. 첫 번째 gate 실행 (retry_budget = 3)**
- **상태**: `integrated` → gate 실행
- **산출물**: `gate-result.json` — `verdict = fail`, tier 2 (semantic+rubric) 에서 rubric score가 threshold 미달
- **실패 내용**: `acceptance_criteria[2]` ("에러 응답이 표준 포맷을 따를 것")에 대한 rubric score가 2/5로 threshold(3) 미달. `gate-result.json`의 `failures[]`에 구체적 위반 사항 기록.
- **결과**: verify-fix loop 진입. `retry_budget` 3 → **2**로 차감.

**2. Verify-fix iteration 1 (retry_budget = 2)**
- **상태**: `verified(fail)` → rewind to `implementing` (Default Rewind Rules: implementation failure → `implementing`)
- **수행자**: primary worker가 `gate-result.json`의 `failures[]`를 참조하여 수정
- **산출물**:
  - 코드 수정 커밋 (worktree 내)
  - `worker-self-check.json` 갱신 (`confidence` 조정, `known_risks[]`에 이전 실패 반영)
  - 필요시 specialist re-review → `specialist-review.json` 갱신
  - re-integration → `integration-result.json` 갱신
- **gate 재실행**: `gate-result.json` — `verdict = fail`, 이번에는 tier 1 (mechanical) 통과했으나 tier 2에서 rubric score 2/5 (다른 criterion에서 실패)
- **결과**: `retry_budget` 2 → **1**로 차감.

**3. Verify-fix iteration 2 (retry_budget = 1)**
- **상태**: 다시 `implementing`으로 rewind
- **수행자**: primary worker가 두 번째 `gate-result.json`의 `failures[]`를 참조하여 수정
- **산출물**:
  - 코드 수정 커밋
  - `worker-self-check.json` 갱신
  - re-review → re-integration
- **gate 재실행**: `gate-result.json` — `verdict = pass`, 모든 tier 통과
- **결과**: 검증 통과. `retry_budget`은 1로 남아 있음 (pass이므로 추가 차감 없음).

**4. 이후 흐름**
- `verified(pass)` → `closure-packet.json` 작성 → `passed`
- closure packet에는 retry 이력이 기록된다: 총 2회의 verify-fix iteration, 각 iteration의 실패 사유와 수정 내용.

```
integrated ──[gate fail, rubric 미달]──→ verified(fail)
  ──retry_budget: 3→2──→ implementing (rewind)
  ──[fix + re-review + re-integrate]──→ integrated
  ──[gate fail, 다른 criterion 미달]──→ verified(fail)
  ──retry_budget: 2→1──→ implementing (rewind)
  ──[fix + re-review + re-integrate]──→ integrated
  ──[gate pass]──→ verified(pass)
  ──[closure-packet.json]──→ passed ✓
```

**만약 iteration 2에서도 실패했다면 (retry_budget = 0):**
- 추가 verify-fix iteration은 금지된다.
- 아래 중 하나를 선택해야 한다:
  1. `escalated` 상태로 전환하여 forge-review 요청
  2. `product_authority`에게 scope 축소 또는 기준 완화 요청
  3. task를 pivot하여 새 task로 분리
- orchestration_authority가 명시적 근거를 제시하면 `budget_extension_reason`과 함께 1회 추가 부여 가능 (task당 최대 1회).
