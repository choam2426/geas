# 03. Task Lifecycle and Evidence

> GEAS의 task contract, task 상태 전이, evidence 구조, evidence gate, task-level deliberation, closure packet, task closure decision, implementation contract, self-check를 정의한다.

## 목적

Task는 mission을 실제 실행 가능한 단위로 자른 최소 계약이다. 이 문서는 task가 무엇으로 시작되고, 어떤 evidence를 쌓아 가며, 어떤 판단을 거쳐 닫히는지 정의한다.

## Task Contract

Task contract의 정규 JSON artifact는 `contract.json`이고, 정확한 구조는 `task-contract.schema.json`이 관리한다.

### task contract가 붙드는 것

| 필드 | 의미 |
|---|---|
| `task_id`, `title`, `goal` | 이 task가 무엇을 하려는지 식별한다 |
| `risk_level` | review 보수성과 closure 판단 엄격도를 조절하는 기본 위험도다 |
| `scope.surfaces` | 이 task가 실제로 건드리는 표면이다 |
| `routing` | primary worker slot과 required reviewer slot을 고정한다 |
| `acceptance_criteria` | task를 닫기 전에 확인해야 하는 관측 가능한 기준이다 |
| `eval_commands` | 반복 가능한 검증 절차다 |
| `rubric` | review와 gate에서 볼 평가 차원과 최소 기준이다 |
| `base_snapshot` | 이 task가 시작한 baseline 기준점이다 |
| `dependencies` | 선행해서 `passed`되어야 하는 task들이다 |
| `user_approved` | 사용자가 이 contract를 실행 기준으로 승인했는지 여부다 |
| `status` | 현재 task가 lifecycle 어디에 있는지 나타낸다 |

현재 schema에는 `retry_budget`도 남아 있다. 이 값은 구현체의 재시도 제어를 위한 보조 필드로 읽고, 프로토콜은 여기에 별도 절차 의미를 부여하지 않는다.

Task는 `user_approved=true`가 되기 전에는 실행 상태로 들어가서는 안 된다.

## task 분해 규칙

- 하나의 task는 한 번의 closure decision으로 닫을 수 있는 단위여야 한다.
- acceptance criteria는 reviewer가 task 완료를 관측할 수 있을 정도로 구체적이어야 한다.
- `scope.surfaces`는 변경 표면을 숨기지 않아야 한다.
- 한 task 안에 여러 단계의 독립적 승인을 몰아넣지 않는다.
- 새 구조적 분기가 생기면 기존 task 안에 우겨 넣기보다 새 task contract로 분리한다.

## 상태와 전이

### 주 상태

| 상태 | 의미 |
|---|---|
| `drafted` | 작성되었지만 아직 실행 기준으로 잠기지 않음 |
| `ready` | 승인되어 실행 대기 중 |
| `implementing` | primary worker가 작업 중 |
| `reviewed` | required reviewer의 review가 모였음 |
| `verified` | evidence gate가 검증 통과 또는 차단 여부를 판정했음 |
| `passed` | task closure decision이 `approved`로 끝나 task가 닫힘 |

### 보류/종결 상태

| 상태 | 의미 |
|---|---|
| `blocked` | 현재 기준으로 진행할 수 없는 차단 상태 |
| `escalated` | task 수준에서 닫지 못해 상위 판단으로 넘김 |
| `cancelled` | 더 이상 이 contract를 진행하지 않기로 확정함 |

### 실패는 상태가 아니다

검증 실패나 `changes_requested`는 별도 상태가 아니다. gate가 `fail`을 내리거나 closure decision이 `changes_requested`를 내리면, Orchestrator가 이유에 맞는 작업 상태로 되돌린다.

### 전이 표

| 현재 상태 | 다음 상태 | 조건 |
|---|---|---|
| `drafted` | `ready` | 사용자 승인과 phase gate를 통과함 |
| `ready` | `implementing` | 의존 task가 `passed`이고 baseline이 유효함 |
| `implementing` | `reviewed` | 구현과 self-check가 끝나고 required reviewer review가 모임 |
| `reviewed` | `verified` | evidence gate가 완료됨 |
| `verified` | `passed` | Orchestrator가 task closure decision `approved`를 남김 |
| `implementing`, `reviewed`, `verified` | `blocked` | 현재 기준으로 진행 불가한 차단 사유가 확정됨 |
| `blocked`, `verified` | `escalated` | task 단위 판단을 넘는 문제로 상향 이관함 |
| `drafted`, `ready`, `implementing`, `reviewed`, `blocked` | `cancelled` | 미션 범위 변경이나 대체 task 발생 등으로 중단이 확정됨 |

Task를 되돌릴 때 어느 상태로 복원할지는 고정 표보다 Orchestrator의 판단을 따른다. 다만 되감기 이유와 복원 근거는 closure decision이나 관련 evidence에 남아야 한다.

## Evidence

Evidence는 task에 대한 역할별 판단 기록이다. GEAS에서 evidence는 task owner artifact이며, exact schema는 `evidence.schema.json`과 하위 evidence schema가 관리한다.

### 공통 의미

대부분의 evidence는 다음 의미를 공유한다.

| 필드 | 의미 |
|---|---|
| `agent` | 이 기록을 남긴 구체 agent 또는 type |
| `task_id` | 어떤 task에 대한 기록인지 |
| `evidence_kind` | 어떤 종류의 evidence인지 |
| `summary` | 핵심 판단 요약 |
| `artifacts` | 판단 근거로 본 파일, 출력, 결과물 |
| `memory_suggestions` | doc 06으로 넘길 memory 후보 |
| `debt_candidates` | doc 07로 넘길 debt 후보 |
| `gap_signals` | doc 07로 넘길 gap 신호 |
| `revision_ref` | 재작업이나 후속 revision과의 연결 고리 |

### evidence kind

| `evidence_kind` | 주된 생산자 | 특히 읽어야 하는 필드 |
|---|---|---|
| `implementation` | Implementer | `summary`, `artifacts` |
| `review` | specialist reviewer | `verdict`, `concerns` |
| `verification` | Verifier | `verdict`, `criteria_results` |
| `challenge` | Challenger | `verdict`, `rationale` |
| `decision` | Orchestrator | `verdict`, `rationale` |

`verdict`는 모든 evidence에 공통으로 붙지 않는다. 현재 schema 기준으로 `review`, `verification`, `challenge`, `decision` evidence에만 붙는다.

### slot과 evidence의 연결

- `implementer`는 보통 `implementation` evidence를 남긴다.
- `verifier`는 독립 검증 결과를 `verification` evidence로 남긴다.
- `risk-assessor`, `operator`, `communicator`는 보통 `review` evidence를 남긴다.
- `challenger`는 `challenge` evidence를 남긴다.
- `orchestrator`는 task closure decision을 `decision` evidence로 남긴다.

Slot이 곧 evidence kind는 아니다. 어떤 slot이 어떤 판단을 수행했는지에 따라 evidence kind를 고른다.

## Evidence Gate

Evidence gate는 "이 task를 닫을 수 있을 만큼 검증 근거가 충분한가"를 판정하는 단계다. 현재 gate 결과의 정규 저장 위치는 `record.json`의 `gate_result` 섹션이며, exact path는 doc 08이 관리한다.

### Tier

| tier | 의미 |
|---|---|
| Tier 0 | 필수 artifact와 필수 reviewer가 있는지 보는 사전 점검 |
| Tier 1 | `eval_commands`나 반복 가능한 절차를 통한 기계적 검증 |
| Tier 2 | contract, rubric, review verdict를 함께 읽는 판단 검증 |

### gate verdict

| verdict | 의미 |
|---|---|
| `pass` | closure 판단으로 넘어갈 수 있음 |
| `fail` | 재작업은 필요하지만 차단 사안은 아님 |
| `block` | 현 상태로는 닫을 수 없는 차단 사안이 있음 |
| `error` | gate 자체가 성립하지 않았거나 검증 실행이 무효였음 |

`fail`은 재작업 신호고, `block`은 차단 신호다. 둘 다 `passed`로 바로 이어질 수 없다.

### rubric

Rubric은 "무엇을 얼마나 잘해야 통과로 볼지"를 수치화한 기준이다. 정확한 차원과 threshold는 task contract가 가진다. Gate는 이 rubric을 근거로 부족한 차원을 드러낼 수 있지만, task를 닫는 마지막 판단 자체는 아니다.

## Task-level Deliberation

Task-level deliberation은 review, verification, challenge 사이의 충돌을 명시적으로 풀어야 할 때 남기는 심의 기록이다. 현재 저장은 `vote-round.schema.json` 기반 record를 쓰지만, 의미 owner는 이 문서다.

Task-level deliberation은 보통 다음 때 열린다.

- required reviewer 사이의 verdict가 충돌할 때
- challenge가 block을 주장했는데 closure decision으로 바로 정리하기 어려울 때
- 재작업 범위나 rewind target에 대한 구조적 판단이 필요할 때

Mission-level deliberation과 mission final verdict는 doc 02가 owner다.

## Closure Packet

Closure packet은 task를 닫기 위해 읽어야 하는 evidence 묶음이다. 아직 standalone schema는 없고, 현행 저장 방식에서는 `record.json`의 `closure` 섹션과 관련 evidence 파일을 함께 읽어 조립한다.

Closure packet은 최소한 다음을 포함해야 한다.

- implementation contract와 self-check
- required reviewer evidence
- verification evidence 또는 이에 준하는 검증 근거
- gate result
- 필요 시 challenge evidence
- change summary와 open risk 요약

필수 reviewer evidence가 비어 있거나 gate가 unresolved 상태면 closure packet은 불완전하다.

## Task Closure Decision

Task closure decision은 task를 닫을 수 있는지에 대한 공식 판단이다. 이 판단은 Orchestrator만 내릴 수 있다.

- `decision` evidence가 판단과 근거를 남긴다.
- 현행 저장 방식에서는 `record.json`의 `verdict` 섹션이 task 수준 종결 상태를 함께 붙든다.

### verdict

| verdict | 의미 |
|---|---|
| `approved` | task를 지금 닫아도 됨 |
| `changes_requested` | 근거는 모였지만 지금 닫기엔 부족해 재작업이 필요함 |
| `escalated` | task 단위에서 닫지 못해 상위 판단으로 넘김 |

`approved`는 gate 통과만으로 자동 발생하지 않는다. Orchestrator가 closure packet을 읽고 명시적으로 남겨야 한다.

## 구현 계약

Implementation contract의 정규 artifact는 `implementation-contract.json`이다. 이 문서는 작업 전 계획과 범위를 붙든다.

| 필드 | 의미 |
|---|---|
| `summary` | 이번 task에서 실제로 무엇을 바꾸려는지 |
| `rationale` | 왜 이 접근이 필요한지 |
| `change_scope` | 실제로 수정할 표면 |
| `planned_actions` | reviewer가 따라 읽을 수 있는 실행 단계 |
| `non_goals` | 이번 task에서 하지 않을 일 |

구현 방향이 materially 바뀌면, 작업을 계속 밀어붙이기 전에 implementation contract를 먼저 갱신해야 한다.

## Worker Self-Check

Worker self-check의 정규 artifact는 `self-check.json`이다. 구현이 끝난 뒤 independent review 전에 남긴다.

| 필드 | 의미 |
|---|---|
| `completed_work` | worker가 실제로 끝냈다고 보는 범위 |
| `reviewer_focus` | reviewer가 먼저 봐야 한다고 worker가 판단한 지점 |
| `known_risks` | 구현 후에도 남아 있는 우려 |

Self-check는 review를 대신하지 않는다. reviewer가 어디를 먼저 볼지 압축해서 넘기는 입력이다.

## Task-level retrospective input

Task는 자체적으로 rules나 debt register를 확정하지 않는다. 대신 evidence와 record를 통해 다음 입력을 남긴다.

- `memory_suggestions`
- `debt_candidates`
- `gap_signals`
- 필요하면 `record.json.retrospective`

이 입력은 doc 06과 doc 07이 받아서 mission 수준에서 정리한다.

## Debt와 Gap 신호

Task에서 남기는 debt와 gap은 후보 또는 신호다. 공식 debt register와 gap assessment는 doc 07이 owner다. Task evidence는 "이 문제가 있었다"를 드러내고, 미션 종결 단계가 "어떻게 처리할지"를 확정한다.

## 취소 규칙

Task는 다음 경우 `cancelled`가 될 수 있다.

- 상위 미션 범위가 바뀌어 더 이상 이 contract가 필요 없을 때
- 더 적절한 새 task contract가 기존 contract를 대체했을 때
- block 사유가 해소 불가능해 현재 contract를 유지할 실익이 없을 때

취소는 조용히 사라지는 것이 아니라, 왜 취소했는지와 어떤 contract나 판단이 이를 대체하는지 남겨야 한다.
