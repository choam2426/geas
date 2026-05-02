# 03. Task Lifecycle and Evidence

> Geas의 task contract, task 상태 전이, evidence 구조, evidence gate, task-level deliberation, task closure decision, implementation contract, self-check를 정의한다.

## 목적

Task는 mission을 실제 실행 가능한 단위로 자른 최소 계약이다. 이 문서는 task가 무엇으로 시작되고, 어떤 evidence를 쌓아 가며, 어떤 판단을 거쳐 종결되는지 정의한다.

## Task Contract

Task contract는 "이 task가 실제로 무엇을 해야 하고, 언제 종결할 수 있는가"를 고정하는 작업 단위 계약이다. Mission이 상위에서 전체 범위와 완료 기준을 고정한다면, task contract는 그 아래에서 실행 가능한 최소 단위의 목표, routing, acceptance criteria, 의존 관계, 기준점을 담는다. 정규 JSON artifact는 `contract.json`이고, 정확한 구조는 `task-contract.schema.json`이 관리한다.

### task contract의 필드

| 필드 | 의미 |
|---|---|
| `mission_id` | 경로와 정합 확인용 상위 미션 식별자 |
| `task_id`, `title`, `goal` | 이 task가 무엇을 하려는지 식별한다 |
| `risk_level` | review 보수성과 closure 판단 엄격도를 조절하는 기본 위험도다 |
| `surfaces` | 이 task가 실제로 건드리는 표면이다 |
| `routing` | primary worker type과 required reviewer slot 목록을 고정한다. primary worker slot은 항상 implementer로 implicit이다. reviewer의 concrete type은 mission의 domain profile이 런타임에 해석한다 |
| `acceptance_criteria` | task를 종결하기 전에 확인해야 하는 관측 가능한 기준이다 |
| `verification_plan` | 이 task를 어떻게 검증할지 서술한다. |
| `base_snapshot` | 이 task가 시작한 baseline 기준점이다 |
| `dependencies` | 선행해서 `passed`되어야 하는 task들. 없으면 빈 배열 |
| `supersedes` | 이 task가 대체하는 이전 task id. cancelled된 선행 계약을 이어받을 때 지정. 대체가 아니면 null |
| `approved_by` | 누가 이 contract를 실행 기준으로 승인했는지. `null`(미승인) / `user`(사용자 직접 승인) / `decision-maker`(Decision Maker가 scope 내에서 대행 승인) |

Task contract는 intent와 승인을 담는 agreement 파일이다. Lifecycle 진행 상태(`drafted → ready → ...`)는 contract가 아니라 `task-state.json`에 있다. doc 05 참조.

Task는 `approved_by`가 `null`이 아닌 값이 되기 전에는 실행 상태로 들어가서는 안 된다. 초기 task 집합과 현재 mission scope 밖 task는 반드시 `user` 승인이 필요하다. scope 내 중간 task는 `decision-maker` 승인으로 충분하다.

## task 분해 규칙

- 하나의 task는 한 번의 closure decision으로 종결할 수 있는 단위여야 한다.
- acceptance criteria는 reviewer가 task 완료를 관측할 수 있을 정도로 구체적이어야 한다.
- `surfaces`는 변경 표면을 숨기지 않아야 한다.
- 한 task 안에 여러 단계의 독립적 승인을 묶지 않는다.
- 새 구조적 분기가 생기면 기존 task 안에 끼워 넣기보다 새 task로 분리한다.

## 상태와 전이

Task는 활동이 있는 6 주 상태(`drafted`, `ready`, `implementing`, `reviewing`, `deciding`, `passed`)와 활동이 없는 3 보류/종결 상태(`blocked`, `escalated`, `cancelled`)로 구성된다. 아래에서 각 주 상태는 활동·slot 책임·산출물·진입 조건을 phase처럼 자세히 정리하고, 보류/종결 상태는 활동이 없으므로 짧은 표로만 정리한다. 모든 전이의 조건과 rewind 경로는 맨 아래 전이 표가 정한다.

### `drafted`

**의미**: task contract 초안이 작성되었으나 아직 승인되지 않은 상태.

**생성 시점**: mission의 specifying phase에서 초기 task 집합이 만들어질 때. 또한 building·polishing phase에서 mission scope 내 추가 task가 필요해 새 contract가 생성될 때도 이 상태로 진입한다 (doc 02 참조).

**이 상태의 활동**:

1. Design Authority가 task contract 초안 작성 (`goal`, `acceptance_criteria`, `surfaces`, `routing`, `verification_plan` 등)
2. 승인 주체가 contract를 검토한 뒤 `approved_by` 설정

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| Design Authority | task contract 초안 작성 |
| User | 초기 task 집합 또는 mission scope 밖 task 승인 |
| Decision Maker | mission scope 내 중간 task 승인 |

**산출물**: `contract.json` (미승인).

**다음 상태 진입 조건**: `approved_by`가 `null`이 아니고 phase gate를 통과함 → `ready`.

### `ready`

**의미**: 승인되어 dispatch를 기다리는 대기 상태.

**이 상태의 활동**:

- 활동 없음. Orchestrator가 의존 task의 `passed` 여부와 baseline 유효성을 주기적으로 확인하고, 조건이 충족되면 dispatch한다.

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| Orchestrator | baseline·의존 task 상태 재확인, dispatch 가능 시 전이 |

**산출물**: —.

**다음 상태 진입 조건**: 의존 task가 `passed`이고 baseline이 유효함 → `implementing`.

### `implementing`

**의미**: Implementer가 implementation contract를 작성하고 구현한 뒤 self-check를 남기는 상태.

**이 상태의 활동**:

1. Implementer가 implementation contract 작성 (`change_scope`, `planned_actions`, `non_goals`, `alternatives_considered`, `assumptions`, `open_questions`)
2. Implementer가 실제 구현 수행
3. Implementer가 implementation evidence entry append (수행 작업 요약, 관찰한 artifacts)
4. Implementer가 self-check 기록 (`completed_work`, `reviewer_focus`, `known_risks`, `deviations_from_plan`, `gap_signals`)

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| Implementer | implementation contract, 구현, implementation evidence, self-check |

**Verify-fix 재진입**: `reviewing`에서 gate verdict `fail`로 되돌아온 경우도 같은 상태다. 차이는 두 가지 — (1) prior reviewer/verifier concerns를 implementation contract에 반영(amend)하고, (2) 새 implementation evidence entry의 `revision_ref`로 이전 entry를 가리킨다. 그 외 활동 순서는 동일하며, 새 self-check가 제출되면 다시 `reviewing`으로 전이한다.

**산출물**: `implementation-contract.json`, `self-check.json`, implementation evidence entry.

**다음 상태 진입 조건**: self-check가 제출됨 → `reviewing`.

### `reviewing`

**의미**: Required reviewer와 verifier가 각자의 evidence를 제출하고 Orchestrator가 evidence gate를 돌리는 상태.

**이 상태의 활동**:

1. Required reviewer slot이 각자의 lens에서 review evidence 제출 (`verdict`, `concerns`, `scope_examined`, `methods_used`, `scope_excluded`)
2. Verifier가 contract의 `verification_plan`을 독립 실행한 뒤 verification evidence 제출 (모든 acceptance criterion을 `criteria_results`로 매핑)
3. 필요 시 task-level deliberation: reviewer verdict가 충돌하거나 challenger의 block 주장이 나오면 Orchestrator가 소집
4. Orchestrator가 evidence gate run 실행 → Tier 0/1/2 판정

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| Required reviewer | 자기 lens에서 review evidence 제출 |
| Verifier | `verification_plan` 실행, verification evidence 제출 |
| Challenger | 필요 시 review evidence로 block 주장, task-level deliberation voter |
| Orchestrator | evidence gate run 실행, 필요 시 task-level deliberation 소집 |

**산출물**: review evidence 집합, verification evidence, `gate-results.json`에 새 gate run 추가.

**다음 상태 진입 조건**:

- gate verdict `pass` → `deciding`
- gate verdict `fail` → `implementing`으로 rewind (verify-fix 루프; reviewer/verifier concerns를 반영해 재작업한 뒤 다시 `reviewing`으로 올라온다)
- gate verdict `block` → `blocked`
- gate verdict `error` → 원인 수정 후 gate 재실행

### `deciding`

**의미**: Orchestrator가 task closure decision을 작성 중인 상태.

**이 상태의 활동**:

1. Orchestrator가 implementation contract, self-check, review evidence, verification evidence, 최신 gate result, 필요 시 task-level deliberation을 종합 검토
2. Orchestrator가 closure evidence 작성 — `verdict`, `rationale`, 회고 4필드(`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`)

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| Orchestrator | 모든 task artifact 종합, closure evidence 작성 |

**산출물**: closure evidence (`evidence/orchestrator.orchestrator.json`).

**다음 상태 진입 조건**:

- closure verdict `approved` → `passed`
- closure verdict `changes_requested` → Orchestrator 판단에 따라 `ready` / `implementing` / `reviewing` 중 하나로 복원
- closure verdict `escalated` → `escalated`
- closure verdict `cancelled` → `cancelled`

### `passed`

**의미**: task가 종결된 상태.

**이 상태의 활동**:

- task 수준에서는 활동 없음. Mission의 consolidating phase에서 이 task의 evidence가 담은 `memory_suggestions`·`debt_candidates`·`gap_signals`이 mission 수준으로 집계된다 (doc 02 consolidating 참조).

**Slot별 책임**:

| Slot | 맡는 일 |
|---|---|
| (종결) | 이 상태에서는 task 수준 활동 없음 |

**산출물**: —.

**다음 상태 진입 조건**: 정상 경로에서는 종결 상태이므로 더 이상 전이하지 않는다. 외부 사유로 `cancelled`로 전이하는 예외만 아래 전이 표에 정의되어 있다.

### 보류/종결 상태

| 상태 | 의미 |
|---|---|
| `blocked` | 현재 기준으로 진행할 수 없는 차단 상태 |
| `escalated` | task 수준에서 종결하지 못해 상위 판단으로 넘어간 상태 |
| `cancelled` | 더 이상 이 contract를 진행하지 않기로 확정된 상태 |

세 상태 모두 task 수준의 활동이 일어나지 않는다. 진입과 복귀 경로는 아래 전이 표를 따른다.

### 실패는 상태가 아니다

검증 실패나 `changes_requested`는 별도 상태가 아니다. gate가 `fail`을 내리거나 closure decision이 `changes_requested`를 내리면, Orchestrator가 이유에 맞는 작업 상태로 되돌린다.

### 전이 표

| 현재 상태 | 다음 상태 | 조건 |
|---|---|---|
| `drafted` | `ready` | `approved_by`가 `null`이 아니고 phase gate를 통과함 |
| `ready` | `implementing` | 의존 task가 `passed`이고 baseline이 유효함 |
| `implementing` | `reviewing` | self-check가 제출됨 |
| `reviewing` | `deciding` | evidence gate run의 verdict가 `pass` |
| `deciding` | `passed` | Orchestrator가 task closure decision `approved`를 남김 |
| `implementing`, `reviewing`, `deciding` | `blocked` | 현재 기준으로 진행 불가한 차단 사유가 확정됨 |
| `blocked` | `ready`, `implementing`, `reviewing` | 차단 사유가 해소되어 작업을 재개함 |
| `blocked`, `deciding` | `escalated` | task 단위 판단을 넘는 문제로 상향 이관함 |
| `escalated` | `passed` | 상위 판단이 `approved` (`deciding`에서 escalate된 경우에 한함) |
| `escalated` | `ready`, `implementing`, `reviewing` | 상위 판단이 `changes_requested`이며 Orchestrator가 해당 상태로 복원함 |
| `drafted`, `ready`, `implementing`, `reviewing`, `deciding`, `blocked`, `escalated` | `cancelled` | 미션 범위 변경, 대체 task 발생, 또는 상위 판단으로 중단이 확정됨 (`deciding`에서의 취소는 외부 사유에 한함) |

Task를 되돌릴 때 어느 상태로 복원할지는 고정 표보다 Orchestrator의 판단을 따른다. 다만 되감기 이유와 복원 근거는 closure decision이나 관련 evidence에 남아야 한다.

## Evidence

Evidence는 task에 대한 역할별 작업/판단 기록이다. Geas에서 evidence는 task 단위 artifact이며, 정확한 구조는 `evidence.schema.json` 단일 스키마가 관리한다. 한 agent가 한 task에서 특정 slot을 맡아 남기는 evidence는 `evidence/{agent}.{slot}.json` 한 파일에 모이고, 각 기록은 파일 안의 `entries` 배열에 append-only로 쌓인다. 한 concrete agent가 같은 task에서 여러 slot을 겸임하면 slot별로 파일이 나뉜다 (예: 동일 `security-engineer`가 `risk-assessor`와 `operator`를 모두 맡으면 `evidence/security-engineer.risk-assessor.json`과 `evidence/security-engineer.operator.json` 두 파일). 각 entry의 `evidence_kind` 필드가 구체 kind를 결정하고, kind별 추가 필수 필드와 `verdict` enum은 스키마 내 `allOf` 조건으로 적용된다.

### agent-slot 독립성 규칙

한 task 안에서 agent와 slot의 조합에 다음 불변조건이 걸린다.

- **Implementer는 exclusive**: 한 task의 `implementer` slot을 맡은 concrete agent는 같은 task에서 다른 slot(verifier, reviewer, challenger 등)을 맡을 수 없다. 자기 작업을 자기가 검증·리뷰하면 독립성이 깨진다.
- **Reviewer·verifier·challenger 겸임은 허용**: 같은 concrete agent가 한 task에서 여러 reviewer slot 또는 reviewer + verifier를 겸임할 수 있다. 이 경우 같은 전문성이 서로 다른 관점 질문(위험 vs 운영 vs 문서화 등)에 답하는 구조이며, 각 slot별로 별도 evidence 파일을 남긴다.
- 서로 다른 task에서는 동일 concrete agent가 어떤 slot 조합으로든 재배정될 수 있다 (task 경계에서 역할 전환).

### 파일 구조

evidence 파일 최상위는 `mission_id`, `task_id`, `agent`, `slot`, `entries`, `created_at`, `updated_at`을 담는다. 재작업이나 후속 revision은 기존 entry를 덮어쓰지 않고 새 entry를 `entries`에 추가하며, 필요하면 `revision_ref`로 같은 파일 안의 이전 entry를 가리킨다.

### entry 공통 필드

모든 entry는 다음 필드를 공유한다. 배열형 필드는 없으면 빈 배열로 명시한다.

| 필드 | 의미 |
|---|---|
| `entry_id` | 같은 파일 안에서 1부터 단조증가하는 정수 id |
| `evidence_kind` | 어떤 종류의 entry인지 |
| `summary` | 핵심 판단 요약 |
| `artifacts` | 판단 근거로 본 파일, 출력, 결과물 |
| `memory_suggestions` | doc 06으로 넘길 memory 후보 |
| `debt_candidates` | doc 07로 넘길 debt 후보 |
| `gap_signals` | doc 07로 넘길 gap 신호 |
| `revision_ref` | 같은 파일 안의 이전 entry `entry_id`. 신규이거나 revision이 아니면 null |
| `created_at` | 이 entry가 작성된 시각 |

### evidence kind별 추가 필드

| `evidence_kind` | 주된 생산자 | 추가 required 필드 | `verdict` enum |
|---|---|---|---|
| `implementation` | Implementer | (없음) | — |
| `review` | specialist reviewer 또는 challenger | `verdict`, `concerns`, `rationale`, `scope_examined`, `methods_used`, `scope_excluded` | approved / changes_requested / blocked |
| `verification` | Verifier | `review`의 모든 추가 필드 + `criteria_results` | approved / changes_requested / blocked |
| `closure` | Orchestrator | `verdict`, `rationale`, `what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance` | approved / changes_requested / escalated / cancelled |

`verdict`는 `implementation` evidence에는 붙지 않는다. `closure` verdict가 `changes_requested`이면 Orchestrator가 task를 어느 상태(`ready`/`implementing`/`reviewing`)로 복원할지는 후속 task 전이로 드러나고 rationale에 그 의도를 기록한다. `escalated` 상태에서 벗어나는 closure를 남길 때는 rationale에 escalate 진입 시점의 원 상태(주로 `deciding` 또는 `blocked`)를 함께 명시해 이후 전이 타당성을 추적 가능하게 한다. Task가 대체 계약으로 이어질 때는 새 task contract의 `supersedes` 필드가 이 task를 가리킨다. Challenger의 이의 제기는 `review` kind로 남기며, challenger인 것은 `agent` 필드로 식별한다. `closure` verdict가 `escalated`나 `cancelled`일 때는 작업 자체가 완료된 게 아니므로 회고 4필드(`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`)는 빈 배열로 남겨도 된다.

`scope_examined`, `methods_used`, `scope_excluded`는 review와 verification이 "무엇을 어떻게 검토/검증했고 무엇을 제외했는지"를 자세히 남기는 필드다. 빈 관찰이 없더라도 각 필드를 비워 두지 않고 의미 있는 내용을 기록한다 (`scope_excluded`만 없으면 빈 배열 허용).

### slot과 evidence의 연결

- `implementer`는 보통 `implementation` evidence를 남긴다.
- `verifier`는 독립 검증 결과를 `verification` evidence로 남긴다.
- `risk-assessor`, `operator`, `communicator`는 보통 `review` evidence를 남긴다.
- `challenger`는 `review` evidence를 남기며, agent 필드로 challenger임을 드러낸다.
- `orchestrator`는 task closure decision을 `closure` evidence로 남긴다.

Slot이 곧 evidence kind는 아니다. 어떤 slot이 어떤 판단을 수행했는지에 따라 evidence kind를 고른다.

## Evidence Gate

Evidence gate는 "이 task를 종결할 수 있을 만큼 검증 근거가 충분한가"를 판정하는 단계다. 한 task의 모든 gate run은 단일 파일(`gate-results.json`)의 `runs` 배열에 시간 순으로 append되며 정확한 구조는 `gate-results.schema.json`이 관리한다. 재실행이 있으면 이전 run을 덮어쓰지 않고 새 gate run object가 배열에 추가돼 이력을 보존한다.

### Tier

| tier | 의미 |
|---|---|
| Tier 0 | 필수 artifact와 필수 reviewer의 review가 제출되었는지 보는 사전 점검 |
| Tier 1 | `verification_plan`이 명시한 반복 가능한 절차를 따른 객관적 검증 (자동 실행이든 고정된 수동 절차든 누가 수행해도 같은 결과가 나오는 검증) |
| Tier 2 | contract와 review verdict를 함께 읽는 판단 검증 |

Gate는 Tier 0 → Tier 1 → Tier 2 순서로 진행하며, 어느 Tier에서든 fail/block/error가 나오면 해당 verdict가 곧 전체 gate verdict가 된다.

Tier 2에서는 reviewer verdict를 집계한다. 기본 규칙은 다음과 같다.

- `blocked`가 하나라도 있으면 Tier 2 결과는 `block`.
- `blocked`는 없고 `changes_requested`가 있으면 Tier 2 결과는 `fail`.
- 모두 `approved`이면 Tier 2 결과는 `pass`.

여러 verdict가 서로 양립하기 어려운 근거 위에 있다고 Orchestrator가 판단하면 집계를 수행하기 전에 task-level deliberation을 소집하고, deliberation 결과를 반영해 Tier 2를 판정한다.

### gate verdict

| verdict | 의미 |
|---|---|
| `pass` | closure 판단으로 넘어갈 수 있음 |
| `fail` | 재작업은 필요하지만 차단 사유는 아님 |
| `block` | 현 상태로는 종결할 수 없는 차단 사유가 있음 |
| `error` | gate 자체가 성립하지 않았거나 검증 실행이 무효였음 |

`fail`은 재작업 신호고, `block`은 차단 신호다. 둘 다 `passed`로 바로 이어질 수 없다.

## Task-level Deliberation

Task-level deliberation은 review, verification, challenge 사이의 충돌을 명시적으로 풀어야 할 때 남기는 심의 기록이다. 정확한 구조는 `deliberation.schema.json`이 관리하며, 같은 schema가 mission-level deliberation에도 쓰인다. 한 task의 모든 심의는 `deliberations.json` 단일 파일의 `entries` 배열에 시간 순으로 append된다. 파일 최상위의 `level` 필드가 `task`로 고정되고 `task_id`도 함께 기록된다.

Deliberation entry는 voter들의 vote와 최종 `result`가 모두 확정된 상태로만 append한다. 진행 중인 심의 상태는 artifact에 남기지 않는다. 이 규약은 mission-level deliberation과 동일하며 append-only 불변성을 유지하기 위한 것이다.

Task-level deliberation은 보통 다음 때 열린다.

- required reviewer 사이의 verdict가 충돌할 때
- challenge가 block을 주장했는데 closure decision으로 바로 정리하기 어려울 때
- 재작업 범위나 rewind target에 대한 구조적 판단이 필요할 때

Mission-level deliberation과 mission final verdict는 doc 02가 owner다.

## Task Closure Decision

Task closure decision은 task를 종결할 수 있는지에 대한 공식 판단이다. 이 판단은 Orchestrator만 내릴 수 있으며, `closure` evidence가 판단과 근거를 남긴다.

### 판단 시 읽어야 하는 artifact

Task closure decision을 내리려면 Orchestrator가 최소한 다음 artifact들을 조립해서 읽어야 한다.

- implementation contract와 self-check
- required reviewer evidence
- verification evidence 또는 이에 준하는 검증 근거
- 최신 gate result
- 필요 시 challenge evidence

필수 reviewer evidence가 비어 있거나 gate가 unresolved 상태면 판단 근거가 불완전하다.

change summary나 open risk 같은 종결 시점 판단 요약은 `closure` evidence(`summary`, `debt_candidates`, `gap_signals` 등)에 담는다.

### verdict

| verdict | 의미 |
|---|---|
| `approved` | task를 지금 종결해도 됨 |
| `changes_requested` | 근거는 모였지만 지금 종결하기엔 부족해 재작업이 필요함 |
| `escalated` | task 단위에서 종결하지 못해 상위 판단으로 넘김 |
| `cancelled` | task를 더 이상 진행하지 않고 폐기함 |

`approved`는 gate 통과만으로 자동 발생하지 않는다. Orchestrator가 필요한 artifact들을 읽고 명시적으로 남겨야 한다.

## Implementation Contract

Implementation contract는 승인된 task contract를 어떻게 실행할지 미리 고정하는 내부 계획이다. 해당 task에 할당된 `implementer`가 작성하며, task contract가 "무엇을 해야 하고 어떻게 검증될지"를 담는 외부 계약이라면, implementation contract는 그 범위 안에서 "어떤 접근으로, 어떤 단계를 밟아 구현할지, 무엇은 하지 않을지"를 reviewer와 합의 가능한 형태로 담는다. 정규 artifact는 `implementation-contract.json`이고, 정확한 구조는 `implementation-contract.schema.json`이 관리한다.

| 필드 | 의미 |
|---|---|
| `mission_id`, `task_id` | 경로와 정합 확인용 식별자 |
| `summary` | 이 task에서 실제로 무엇을 바꾸려 하는지를 한 문장으로 담는다 |
| `rationale` | 이 접근을 택한 이유와 배경 |
| `change_scope` | 이번 구현이 실제로 수정하거나 추가할 표면 |
| `planned_actions` | reviewer가 구현 흐름을 따라갈 수 있도록 정리한 실행 단계 |
| `non_goals` | 이번 task에서는 다루지 않기로 한 범위. 없으면 빈 배열 |
| `alternatives_considered` | 고려했다가 버린 접근과 그 이유. 없으면 빈 배열 |
| `assumptions` | 이 계획이 유효하려면 참이어야 하는 전제. 없으면 빈 배열 |
| `open_questions` | implementer가 진행 전·중에 풀어야 할 미결 질문. 없으면 빈 배열 |

구현 방향이 실질적으로 바뀌면, 작업을 계속 밀어붙이기 전에 implementation contract를 먼저 갱신해야 reviewer가 변경된 의도를 따라갈 수 있다.

## Implementer Self-Check

Implementer self-check는 해당 task에 할당된 `implementer`가 각 구현 pass를 마친 뒤 independent review로 넘기기 전에 남기는 append-only 자기 점검 로그다. 정규 artifact는 `self-check.json`이며 정확한 구조는 `self-check.schema.json`이 관리한다. Envelope은 evidence 파일과 동일한 형태를 따른다 — task 하나에 파일 하나, 안에는 implementer pass별 self-check entry가 순서대로 쌓인다.

### 파일 envelope의 필드

| 필드 | 의미 |
|---|---|
| `mission_id`, `task_id` | 경로와 정합 확인용 식별자 |
| `entries` | 시간 순 self-check entry의 append-only 배열. 최소 1 entry |
| `created_at` | 파일 최초 작성 시각 |
| `updated_at` | 마지막 entry append 시각 |

### Entry의 필드

| 필드 | 의미 |
|---|---|
| `entry_id` | 파일 안에서 1부터 단조증가하는 정수 id |
| `completed_work` | 이번 pass에서 `implementer`가 실제로 끝냈다고 보는 범위 |
| `reviewer_focus` | 이번 pass 기준 reviewer가 먼저 봐야 한다고 `implementer`가 판단한 지점. 없으면 빈 배열 |
| `known_risks` | 이번 pass 이후에도 남아 있는 forward-looking 우려. 없으면 빈 배열 |
| `deviations_from_plan` | 이번 pass에서 implementation-contract `planned_actions`와 실제 실행이 다른 부분. 계획대로 갔으면 빈 배열 |
| `gap_signals` | 이번 pass에서 발견한 범위/기대 차이 조기 신호. closure evidence와 mission gap으로 이어진다. 없으면 빈 배열 |
| `revision_ref` | 직전 self-check entry의 `entry_id`. verify-fix 재진입 시 이전 pass를 가리키도록 설정. 첫 entry(또는 revision이 아닌 entry)는 `null` |
| `created_at` | 이 entry가 append된 시각 |

### Iteration 모델

첫 번째 implementer pass는 `entry_id: 1` + `revision_ref: null`로 append한다. Verify-fix 재진입은 새 entry를 append하며 `revision_ref`로 직전 `entry_id`를 가리킨다. 이 방식으로 이전 pass의 self-check 내용은 덮이지 않고 보존되어 iteration 기록이 남는다. Reviewer는 latest entry를 읽어 현재 `reviewer_focus`를 파악하며, 이전 entry는 pass 사이에 implementer의 자기 판단이 어떻게 바뀌었는지 추적하는 용도로 계속 접근 가능하다.

Self-check는 review를 대신하지 않는다. reviewer가 어디부터 볼지 압축해서 넘기는 입력이다.

## Task-level Retrospective Signals

Task는 자체적으로 memory, debts, gap을 확정하지 않는다. Task evidence는 "이 문제가 있었다"를 드러내는 신호만 남기고, "어떻게 처리할지"는 consolidating phase가 확정한다. 공식 memory는 doc 06이, 공식 debts와 gap은 doc 07이 owner다.

Task가 남기는 신호는 다음과 같다.

- `memory_suggestions` (evidence 공통 필드) — learning 후보 (doc 06이 받음)
- `debt_candidates` (evidence 공통 필드) — 기술 부채 후보 (doc 07이 받음)
- `gap_signals` (evidence 공통 필드) — 범위/기대 차이 신호 (doc 07이 받음)
- closure evidence의 회고 필드 (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`) — Orchestrator가 task 종결 시점에 self-check, 각 evidence, gate 결과, deliberation을 종합해 기록

`self-check.json`의 `gap_signals`는 implementer가 구현 중 빠르게 남기는 **원시 문자열 flag**다. Evidence의 구조화된 `gap_signals`(`kind` + `summary`)와 shape이 다르며, 직접 consolidation 입력으로 승격되지 않는다. Orchestrator가 closure evidence를 작성할 때 self-check의 flag 중 의미 있는 것을 **구조화된 형태로 closure evidence에 재기록**하고, 그 결과가 consolidation candidates 집계의 대상이 된다. 즉 consolidation의 자동 집계는 evidence 쪽 필드만 훑는다.

## 취소 규칙

Task는 다음 경우 `cancelled`가 될 수 있다.

- 상위 미션 범위가 바뀌어 더 이상 이 contract가 필요 없을 때
- 더 적절한 새 task contract가 기존 contract를 대체했을 때
- block 사유가 해소 불가능해 현재 contract를 유지할 실익이 없을 때

취소는 `closure` evidence에 verdict `cancelled`로 남기며 `rationale`에 왜 취소했는지를 담는다. 대체 계약이 있다면 새 task contract의 `supersedes` 필드가 이 task를 참조한다. 취소는 조용히 사라지지 않고 근거와 대체 관계가 명시돼야 한다.
