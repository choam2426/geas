# 04. Baseline, Workspace, Scheduler, Parallelism

> **기준 문서.**
> Baseline 유효성, staleness 처리, workspace 생명주기, lock, 스케줄러 목표, 안전한 병렬 처리 규칙을 정의한다.

## 목적

병렬 처리는 evidence 무결성을 해치지 않을 때에만 가치가 있다. 이 문서의 목적은 다음을 방지하는 것이다:

- stale baseline 위에서의 구현
- 숨겨진 통합 충돌
- 너무 늦게 발견되는 작업 간 겹침
- 안전하지 않은 동시 통합
- 관리되지 않은 workspace로 인한 복구 모호성

## Baseline

Baseline은 task가 마지막으로 검증된 공유 작업 상태의 스냅샷이다 (doc 03의 `base_snapshot` 참조). 모든 승인된 task는 해당 시점에 유효했던 통합 baseline을 가리키는 `base_snapshot`을 반드시 포함해야 한다.

소프트웨어에서는 보통 Git 커밋이다. 다른 도메인에서는 문서 버전, 데이터셋 체크포인트, 또는 재현 가능한 상태 참조가 될 수 있다.

### Baseline 규칙

1. `base_snapshot`은 task가 `ready`에 진입하는 시점의 통합 baseline 이전이거나 동일 시점이어야 한다.
2. 실제로 확인하지 않은 baseline에 대해 최신이라고 주장할 수 없다.
3. baseline 변경으로 task가 stale해지면 통합 전에 반드시 재검증해야 한다.

### Baseline 최신성 분류

| 분류 | 의미 |
|---|---|
| `fresh` | task baseline이 진행하기에 충분히 최신이다 |
| `stale` | baseline 변경이 가정을 무효화할 수 있다. 재검증 필요 |
| `diverged` | 직접적 충돌 또는 호환 불가능한 baseline 변경이 감지되었다 |
| `unknown` | baseline을 신뢰할 수 있게 확인할 수 없다 |

`diverged`와 `unknown`은 해소될 때까지 통합을 차단한다.

## Staleness 규칙

### 착수 전

Task가 `implementing`에 진입하기 전에 baseline이 여전히 유효한지 확인해야 한다. 유효하지 않으면 새 baseline에 맞춰 재검증하거나 재작업해야 한다.

### 구현 중

Baseline 변경만으로 즉시 중단을 강제하지는 않는다. 다만:

- task가 stale해졌을 수 있음을 표면화해야 한다
- 스케줄러는 리스크가 동일하면 더 최신인 task를 우선해야 한다
- 통합 전에 반드시 재조정해야 한다

### 통합 전

Task가 통합 레인에 진입하기 전에:

- 현재 통합 baseline을 task의 `base_snapshot`과 비교해야 한다
- stale이면 재검증을 수행해야 한다
- 표면적 충돌뿐 아니라 의미적 변동도 고려해야 한다

Semantic drift는 표면적 충돌과 다르다:

- **표면적 충돌**: 같은 영역을 직접 수정하여 물리적으로 충돌하는 경우
- **semantic drift**: 수정 영역은 다르지만, 가정이나 동작이 바뀌어 task의 전제가 깨지는 경우 (예: API 응답 형식이 바뀌었는데 해당 API를 호출하는 task가 이를 모름)

## 재검증 절차

재검증은 stale task를 여전히 안전하게 통합할 수 있는지 판정하는 과정이다. 프로토콜을 따르는 재검증 흐름은 다음과 같다:

1. 현재 통합 baseline을 가져온다
2. task의 `base_snapshot`과 비교한다
3. 변경된 표면에 겹침이나 인터페이스 변동이 있는지 검토한다
4. 결과를 판정한다:

| 결과 | 의미 |
|---|---|
| 그대로 진행 | 유의미한 겹침 없음 |
| 경미한 재조정 | baseline 변경에 맞추는 소규모 조정 필요 |
| 대폭 재작업 | 큰 겹침이나 인터페이스 변경으로 상당한 수정 필요 |
| `ready`로 상태 복원 | task 가정이 무효화되어 재계획 필요 |

재검증 결과는 artifact로 기록해야 한다.

## Workspace

Workspace는 task 실행을 위한 격리된 실행 환경이다 (doc 00 용어집 참조). 소프트웨어에서는 보통 Git worktree이고, 다른 도메인에서는 샌드박스 환경, 전용 작업 디렉토리 등이 될 수 있다.

### Workspace 규칙

- 활성 구현 task당 주 workspace 하나
- workspace와 `task_id` 간 명확한 매핑
- 명시적으로 동기화하지 않는 한 다른 활성 작업과 격리
- task 완료 또는 취소 시 정리 방식이 정해져 있어야 한다

Workspace는 일회성 실행 환경으로 취급한다. 정본은 검증된 baseline과 런타임 artifact이다.

### 런타임 상태와 workspace

런타임 상태 디렉토리(예: `.geas/`)는 버전 관리 대상이 아니므로 workspace에 포함되지 않는다. Git worktree 등으로 workspace를 생성해도 런타임 상태 디렉토리는 복제되지 않는다. workspace 안에서 상대경로로 런타임 상태에 접근하면 존재하지 않는 경로를 참조하게 된다.

1. Orchestrator는 에이전트를 생성하기 전에 프로젝트 루트를 절대경로로 해석하여 전달해야 한다(MUST).
2. workspace에서 실행되는 에이전트는 메인 프로젝트의 런타임 상태 디렉토리 절대경로를 사용해야 한다(MUST).
3. workspace 에이전트는 공유 상태 파일(lock, run state, event ledger 등)에 직접 기록할 수 없다(MUST NOT). task 범위 경로(`evidence/{task-id}/` 등)에만 기록할 수 있다.
4. workspace 에이전트가 런타임 상태에 접근하는 CLI 도구를 실행할 때는 `--cwd` 옵션(또는 해당 도구의 동등한 메커니즘)으로 프로젝트 루트를 전달해야 한다(MUST).

이 규칙들은 workspace 격리가 런타임 상태 접근을 방해하지 않도록 보장하고, 동시 실행 환경에서 공유 상태의 일관성을 유지한다.

### Workspace 생명주기

| 단계 | 내용 |
|---|---|
| **prepare** | 유효한 baseline에서 workspace 생성 |
| **execute** | 구현 및 로컬 검토 |
| **review-ready** | worker self-check 작성 후 리뷰에 전달 |
| **reconcile** | 필요시 현재 baseline과 재조정 |
| **integrate** | 직렬화된 통합 레인 진입 |
| **close or archive** | 상태에 따라 정리 또는 복구용 보존 |

손상되었거나 외부에서 변경된 workspace는 보수적으로 처리한다. 아래 엣지 케이스 참조.

## Lock 모델

Lock은 동시 task 간의 안전하지 않은 겹침을 방지하는 조율 장치다. 전면 통제가 아니라 조율을 위한 메커니즘이다.

| lock 유형 | 목적 | 예시 |
|---|---|---|
| `path_lock` | 직접적 경로나 표면 겹침 | 같은 파일, 문서 섹션, 데이터 테이블을 두 task가 편집 |
| `interface_lock` | 공유 계약, schema, 추상화 겹침 | 같은 API, 이벤트 형식, 공유 인터페이스를 두 task가 변경 |
| `resource_lock` | 공유 가변 자원 | 로컬 포트, 픽스처, 외부 샌드박스, 부족한 도구 용량 |
| `integration_lock` | baseline 변경을 위한 전역 직렬화 레인 | 한 번에 하나의 task만 통합 가능 |

### Lock 생명주기

| 단계 | 규칙 |
|---|---|
| acquire | 획득 사실이 런타임 상태에 표시되어야 한다 |
| hold | lock 활성 상태. 범위가 겹치는 다른 task는 차단된다 |
| renew or downgrade | 범위가 좁아지면 lock을 축소할 수 있다 |
| release | task 완료, 취소, 또는 명시적 park 시 반드시 해제한다 |

방치된 lock은 보수적으로 만료되거나 복구 시 정리해야 한다. Integration lock은 경쟁하는 task 간에 공유할 수 없다.

### Lock 획득 순서

교착을 방지하기 위한 권장 획득 순서:

1. `resource_lock`
2. `interface_lock`
3. `path_lock`
4. `integration_lock`

프로젝트가 다른 순서를 채택할 수 있지만, 문서화하고 일관되게 적용해야 한다.

## 스케줄러

스케줄러는 어떤 ready task를 어떤 순서로 실행할지 결정한다. 아래 목표를 우선순위 순으로 최적화한다:

| 우선순위 | 목표 |
|---|---|
| 1 | evidence 무결성과 baseline 정확성 |
| 2 | 안전하지 않은 작업 겹침 회피 |
| 3 | 차단 해소 task를 의존 task보다 먼저 완료 |
| 4 | 리스크를 고려한 처리량 |
| 5 | ready task 간 공정성 |
| 6 | 예방 가능한 drift로 인한 재작업 최소화 |

### 동시성 한도

프로젝트는 risk level별 동시성 한도를 정의해야 한다:

| risk_level | 권장 동시성 |
|---|---|
| `critical` | 명시적으로 독립이 증명되지 않는 한 하나씩 |
| `high` | 강한 lock 확인을 동반한 제한적 병렬 |
| `normal` | 범위가 독립적이면 병렬 |
| `low` | lock 충돌이 없으면 기본적으로 병렬 |

Critical task가 "독립이 증명되었다"고 판단하려면 다음을 모두 충족해야 한다:

- `scope.paths`가 겹치지 않는다
- lock 충돌이 없다
- 한 task의 산출물이 다른 task의 입력이 아니다
- Design Authority가 독립성을 확인했다

리뷰 불가능하거나 복구 불가능한 수준까지 동시성을 높여서는 안 된다.

## 안전한 병렬 조건

다음을 모두 충족하면 task를 병렬 실행할 수 있다:

- lock 충돌이 없다
- 통합 레인 소유권이 겹치지 않는다
- 수용 기준을 독립적으로 리뷰할 수 있다
- 필수 리뷰어 세트가 각각을 의미 있게 검토할 수 있다
- 하나의 task를 복구해도 다른 task가 손상되지 않는다

## 안전하지 않은 병렬 조합

다음 중 하나라도 해당하면 병렬 실행을 차단해야 한다:

- `path_lock` 겹침
- `interface_lock` 겹침
- 직렬화 없는 공유 마이그레이션이나 전달 artifact
- 리스크 민감 표면에 걸친 결합된 변경
- 한 task의 산출물이 다른 task의 필수 baseline
- 두 task가 곧 통합 레인을 필요로 하며 충돌 가능성이 높은 경우

## 선행 착수

의존하는 형제 task가 완료되기 전에 가정을 세우고 먼저 착수할 수 있는 조건:

- 가정이 명시적으로 기록되어 있다
- 가정이 틀리면 깔끔하게 이전 상태로 복원할 수 있다
- 인터페이스 리스크가 낮거나 강하게 제한되어 있다
- 선택된 미션 모드가 선행 착수를 허용한다

선행 착수를 미해소 설계 이견을 숨기는 데 사용해서는 안 된다.

## Pause, Park, Preemption

| 동작 | 의미 | lock 처리 |
|---|---|---|
| **pause** | 일시적으로 스케줄에서 제외. workspace와 artifact 유지 | lock 유지 |
| **park** | 의도적으로 활성 스케줄에서 제거 | 대부분의 lock 해제 |
| **preempt** | Orchestrator가 더 높은 우선순위 사안을 위해 task를 중단 | 보수적 재개를 위한 체크포인트 기록 |

Orchestrator는 다음 상황에서 task를 preempt할 수 있다:

- 더 높은 우선순위의 차단 요소 등장
- 복구 작업의 긴급성 증가
- 최신성이나 무결성 문제로 계속 실행하는 것이 부적절한 경우

Preemption checkpoint에 포함해야 하는 항목:

- 현재 task 상태와 진행 단계
- workspace 변경 사항 요약
- 마지막으로 완료된 artifact
- 남은 작업 항목
- 알려진 리스크나 차단 사안

## 통합 레인

통합은 공유 baseline을 변경하므로 반드시 직렬화해야 한다. 동등한 무결성을 보장하는 별도 메커니즘이 없는 한 이 원칙은 우회할 수 없다.

| 규칙 | 설명 |
|---|---|
| 독점 소유 | 한 번에 하나의 task만 레인을 소유한다 |
| 가시성 | 레인 소유 상태가 런타임에 표시되어야 한다 |
| 재조정 | 통합 전 최신 baseline과 재조정해야 한다 |
| 기록 | 통합 결과를 성공·실패와 무관하게 기록해야 한다 |

## 엣지 케이스

### 모든 task가 paused

- 런타임 단계가 `idle`이 될 수 있다
- 현재 차단 사유를 기록해야 한다
- 재개 시 최신성 확인을 반드시 수행해야 한다

### 동시 통합 요청

- 스케줄러가 하나를 결정적으로 선택해야 한다
- 선택되지 않은 task는 레인을 획득할 때까지 `reviewed` 상태에 머문다
- 선택된 task가 공유 표면을 변경하면 나머지 task의 재검증이 필요할 수 있다

### 손상되거나 삭제된 workspace

- 아무 일 없던 것처럼 계속 진행할 수 없다
- 가능하면 체크포인트에서 복구한다
- 불가능하면 안전한 baseline에서 workspace를 재구축하고 마지막 안전 지점부터 재실행한다
- 손실이 사소하지 않으면 진화 리뷰를 위해 사건을 기록한다

### 단일 task 세션

Lock 시스템이 대부분 조용하겠지만 baseline과 통합 규칙은 여전히 적용된다.

## 추적 이벤트

프로토콜을 따르는 런타임은 다음을 재구성할 수 있어야 한다:

- 각 task가 언제 lock을 획득하고 해제했는지
- 어떤 task가 통합 레인을 소유했는지
- task가 언제 stale이 되었는지
- 재검증이 언제 발생했고 무엇을 결정했는지
- task가 왜 pause, park, preempt 되었는지

## 핵심 선언

Geas에서 병렬 처리는 항상 통합 무결성에 종속된다. 안전한 속도는 허용하지만, 추적할 수 없는 속도는 허용하지 않는다.
