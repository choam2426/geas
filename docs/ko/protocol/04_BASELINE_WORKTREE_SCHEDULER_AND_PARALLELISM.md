# 04. Baseline, Worktree, Scheduler, and Parallelism

## Baseline Rules

- `run.json`은 live HEAD를 저장하지 않는다.
- task는 `base_commit`을 가진다.
- 현재 기준은 `tip(integration_branch)`를 Git에서 읽는다.

## Staleness Rules

### 시작 전
`task.base_commit != tip(integration_branch)` 이면 반드시 revalidation.

### Revalidation 절차
revalidation은 아래 단계를 순서대로 수행한다:
1. `base_commit`과 `tip(integration_branch)` 사이의 diff를 계산한다.
2. diff가 task의 `scope.paths`와 겹치는지 확인한다.
3. 겹치지 않으면 `base_commit`을 현재 tip으로 갱신하고 task를 계속 진행한다.
4. 겹치면 통합 전 staleness 분류 (아래)를 적용하여 `clean_sync | review_sync | replan_required | blocking_conflict` 중 하나로 판단한다.
5. 판단 결과를 task metadata에 `revalidation_result`로 기록한다.

### 구현 중
upstream 이동만으로 즉시 중단하지 않는다. drift는 기록만 하고 integration에서 정산한다.

### 통합 전
`base_commit`과 current tip 차이를 보고 아래 중 하나로 분류한다.

| 분류 | 조건 | 필요 행동 |
|---|---|---|
| `clean_sync` | tip과 base_commit 사이에 task의 scope.paths와 겹치는 변경이 없음 | fast-forward merge 또는 trivial rebase 후 통합 진행 |
| `review_sync` | scope.paths와 겹치는 변경이 있으나 충돌이 자동 해소 가능 | merge 후 변경된 영역에 대해 specialist re-review 필요 |
| `replan_required` | scope.paths와 겹치는 변경이 있고 자동 해소 불가하지만, task 목적 자체는 유효 | task를 `ready`로 rewind하고 implementation contract를 갱신 |
| `blocking_conflict` | upstream 변경이 task의 전제 조건(API contract, schema, dependency)을 무효화 | task를 `blocked` 또는 `escalated`로 전환 |

## Worktree Rules

각 task는 독립 worktree를 가진다.
- `worktree.branch`
- `worktree.path`
- `fork_point = base_commit`

worktree는 task 종료 전까지 task-local 진실원천이다. 통합 전에는 integration branch에 직접 커밋하지 않는다.

## Lock Model

lock 상태는 `.geas/state/locks.json`에 저장한다.

### Lock Lifecycle

| 단계 | 규칙 |
|---|---|
| **획득** | `path_lock`, `interface_lock`, `resource_lock`는 worktree 생성 전에 획득한다. `integration_lock`은 integration 시작 전에 획득한다. |
| **해제** | task 완료(passed/failed/cancelled) 시 해당 task의 모든 lock을 해제한다. session 종료 시 cleanup 단계에서 해당 session의 잔여 lock을 모두 해제한다. |
| **orphan 감지** | session 시작 시와 recovery 후에 orphan lock 감지를 실행한다. 소유 session이 존재하지 않는 lock은 orphan으로 분류하고 자동 해제한다. |
| **timeout** | lock은 자동 timeout이 없다(session-scoped). |
| **deadlock** | 두 task가 서로 충돌하는 lock을 보유하면 `manual_repair_required` 상태로 전환한다. 자동 해결을 시도하지 않는다. |

### `path_lock`
경로 수준 변경 충돌 방지

### `interface_lock`
공개 contract/API/schema 수준 충돌 방지

### `resource_lock`
port, service, migration target, fixture 등 자원 충돌 방지

### `integration_lock`
integration lane는 single-flight로 직렬화

### Lock 획득 순서

deadlock을 방지하기 위해, 하나의 task가 여러 lock을 필요로 할 때 아래 순서로 획득한다:

1. `path_lock` (파일/디렉토리 경로)
2. `interface_lock` (API/schema 계약)
3. `resource_lock` (공유 자원)
4. `integration_lock` (통합 브랜치)

규칙:
- 상위 순서의 lock을 보유한 상태에서만 하위 순서의 lock을 요청할 수 있다.
- 하위 순서의 lock을 보유한 상태에서 상위 순서의 lock을 요청하면 → 모든 lock을 해제하고 순서대로 다시 획득한다.
- lock 획득에 실패하면 (다른 task가 보유 중) 해당 task는 대기한다. 대기 시간이 session 내에서 해소되지 않으면 `manual_repair_required`로 분류한다.

## Scheduler Goals

- high risk drift 최소화
- safe parallelism 최대화
- serialized integration 유지
- hotfix 선점 허용

## Safe Parallel Conditions

아래를 모두 만족하면 병렬 구현 가능하다.
- path lock 비충돌
- interface lock 비충돌
- shared mutable resource 비경합 (shared mutable resource 정의: integration branch, `.geas/state/run.json`, `.geas/rules.md`, 프로젝트 공유 설정 파일. worktree 내부의 task-local 파일은 해당하지 않는다)
- 둘 다 `delivery` mode 내 independent task
- 둘 다 speculative가 아니거나 speculative budget 이내 (동시에 실행 가능한 speculative task는 최대 1개)

## Unsafe Parallel Combinations

- 같은 API contract를 양쪽이 수정
- auth / payment / migration / release 관련 shared path 동시 수정
- 동일 shared fixture와 env를 변경
- 동일 docs+code contract를 양쪽이 동시에 재정의

## Speculative Execution

허용:
- `risk_level = low`인 task에 한정한다.
- dependency task가 `reviewed` 이상 상태이고, 해당 task의 worker self-check confidence가 4 이상일 때
- docs/update, tests-only, adapter layer와 같이 risk가 낮은 경우
- 동시에 실행 가능한 speculative task는 최대 1개이다.

금지:
- `risk_level`이 `normal`, `high`, 또는 `critical`인 task
- public API, migration, auth/security, deploy/release, high risk refactor

speculative task는 integration 직전 반드시 non-speculative baseline 위에서 재검토한다. 선행 task가 실패하면 speculative 결과는 폐기한다.

## Pause / Park / Preemption

`paused`와 `parked`는 별도 task state가 아니라 scheduler의 **실행 플래그**이다. task의 state (doc 03 참조)는 변경되지 않으며, scheduler가 해당 task의 진행을 일시 중지한다.

- `paused`: 짧은 중단, resume 시 추가 baseline check만 필요. 단, `base_commit`이 `tip(integration_branch)`보다 10 commits 이상 뒤처지면(설정 가능, 기본값 10) resume 전에 revalidation을 수행한다.
- `parked`: 더 긴 보류, resume 전에 revalidation 필수. parking 사유를 `run.json`에 기록해야 한다.
- hotfix는 일반 task를 선점할 수 있으나, preemption record를 남겨야 한다. preemption record에는 선점된 task_id, 선점 사유, 선점 시점의 task state를 기록한다.

## Edge Cases

### 1. 모든 task가 paused 상태일 때

모든 active task가 `paused` 또는 `parked` 상태이고 실행 중인 task가 없는 경우, scheduler는 **idle 상태**로 진입한다.

- **동작**: scheduler는 새로운 task 투입, 외부 입력(human stakeholder 지시), 또는 기존 task에 대한 resume signal을 대기한다.
- **자동 행동 없음**: idle 상태에서 scheduler가 임의로 task를 resume하거나 새 task를 생성하지 않는다.
- **기록**: `run.json`의 `scheduler_state`를 `idle`로 갱신하고, idle 진입 시각을 기록한다.
- **재개 조건**: orchestration_authority의 명시적 resume 지시, 새 task 투입, 또는 외부 stakeholder input이 발생하면 idle에서 빠져나온다.

### 2. 두 task가 동시에 integration_lock을 요청할 때

`integration_lock`은 single-flight이므로 동시에 두 task가 보유할 수 없다.

- **동작**: 먼저 lock을 획득한 task가 integration을 진행하고, 두 번째 task는 대기한다.
- **timeout**: 기본적으로 lock은 session-scoped이며 자동 timeout이 없다. 설정 가능한 timeout period를 지정할 수 있으나, 기본값은 session 종료까지이다.
- **대기 중 동작**: 두 번째 task는 `integration_lock` 대기 상태로 기록되며, 다른 단계(예: 추가 review)는 진행할 수 없다. integration은 반드시 직렬화된다.
- **deadlock 상황**: 두 task가 서로 충돌하는 lock을 보유한 채 교착 상태에 빠지면 `manual_repair_required` 상태로 전환한다. 자동 해결을 시도하지 않으며, orchestration_authority 또는 human operator가 개입하여 하나의 lock을 해제하거나 task를 rewind해야 한다.
- **기록**: `.geas/state/locks.json`에 대기 시작 시각과 대기 중인 task_id를 기록한다.

### 3. Worktree가 외부에서 손상/삭제된 경우

task에 할당된 worktree가 외부 요인(수동 삭제, 파일 시스템 오류, 다른 도구의 간섭)으로 손상되거나 사라진 경우의 처리이다.

- **감지**: 다음 worktree 접근 시 fingerprint mismatch가 발생한다. worktree 경로가 존재하지 않거나, 존재하더라도 예상 branch/commit과 불일치하면 감지된다.
- **recovery class**: `dirty_state_recovery`로 분류한다.
- **worktree 삭제된 경우**: `worktree.path`가 존재하지 않으면, task 상태가 `implementing`이라면 implementation 재실행 또는 `manual_repair_required`로 전환한다 (doc 10 Worktree Recovery Rules 참조).
- **worktree 손상된 경우**: 경로는 존재하나 fingerprint가 불일치하면, diff를 생성하여 orchestration_authority에게 제시한다. orchestration_authority가 commit-and-continue 또는 rewind를 결정한다.
- **산출물**: `recovery-packet.json`을 생성하여 `.geas/recovery/`에 저장한다. `detected_problem`에 fingerprint mismatch 상세 내용, `recommended_action`에 판단 결과를 기록한다.

### 4. Single-task session에서의 동작

session에 task가 하나만 있는 경우에도 parallelism 규칙은 동일하게 적용된다.

- **이유**: future-proofing. session 도중 추가 task가 투입될 수 있고, 규칙의 일관성을 유지하기 위함이다.
- **lock 획득**: single task라도 `path_lock`, `interface_lock`, `integration_lock` 등을 정상적으로 획득하고 해제한다. 경합이 없으므로 즉시 획득된다.
- **scheduler overhead**: 경합 판단, 대기열 관리 등이 사실상 no-op이므로 overhead는 최소화된다. scheduler는 단일 task의 상태 전이만 추적한다.
- **speculative execution**: single task에서는 speculative execution 판단이 불필요하다 (선행 task가 없으므로).
- **safe parallel conditions**: 검증 자체는 수행하되, 비교 대상이 없으므로 항상 통과한다.
