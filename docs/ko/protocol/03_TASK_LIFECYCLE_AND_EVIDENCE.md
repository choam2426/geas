# 03. Task Lifecycle and Evidence

> GEAS의 task contract, task 상태 전이, evidence 구조, evidence gate, task-level deliberation, task closure decision, implementation contract, self-check를 정의한다.

## 목적

Task는 mission을 실제 실행 가능한 단위로 자른 최소 계약이다. 이 문서는 task가 무엇으로 시작되고, 어떤 evidence를 쌓아 가며, 어떤 판단을 거쳐 종결되는지 정의한다.

## Task Contract

Task contract는 "이 task가 실제로 무엇을 해야 하고, 언제 종결할 수 있는가"를 고정하는 작업 단위 계약이다. Mission이 상위에서 전체 범위와 완료 기준을 고정한다면, task contract는 그 아래에서 실행 가능한 최소 단위의 목표, routing, acceptance criteria, 의존 관계, 기준점을 담는다. 정규 JSON artifact는 `contract.json`이고, 정확한 구조는 `task-contract.schema.json`이 관리한다.

### task contract가 고정하는 것

| 필드 | 의미 |
|---|---|
| `task_id`, `title`, `goal` | 이 task가 무엇을 하려는지 식별한다 |
| `risk_level` | review 보수성과 closure 판단 엄격도를 조절하는 기본 위험도다 |
| `scope.surfaces` | 이 task가 실제로 건드리는 표면이다 |
| `routing` | primary worker slot과 required reviewer slot을 고정한다 |
| `acceptance_criteria` | task를 종결하기 전에 확인해야 하는 관측 가능한 기준이다 |
| `eval_commands` | 반복 가능한 검증 절차다 |
| `base_snapshot` | 이 task가 시작한 baseline 기준점이다 |
| `dependencies` | 선행해서 `passed`되어야 하는 task들이다 |
| `user_approved` | 사용자가 이 contract를 실행 기준으로 승인했는지 여부다 |
| `status` | 현재 task가 lifecycle 어디에 있는지 나타낸다 |

Task는 `user_approved=true`가 되기 전에는 실행 상태로 들어가서는 안 된다.

## task 분해 규칙

- 하나의 task는 한 번의 closure decision으로 종결할 수 있는 단위여야 한다.
- acceptance criteria는 reviewer가 task 완료를 관측할 수 있을 정도로 구체적이어야 한다.
- `scope.surfaces`는 변경 표면을 숨기지 않아야 한다.
- 한 task 안에 여러 단계의 독립적 승인을 묶지 않는다.
- 새 구조적 분기가 생기면 기존 task 안에 끼워 넣기보다 새 task로 분리한다.

## 상태와 전이

### 주 상태

| 상태 | 의미 |
|---|---|
| `drafted` | 초안이 있고 아직 승인되지 않은 상태 |
| `ready` | 승인되어 실행을 기다리는 상태 |
| `implementing` | Implementer의 작업이 진행 중인 상태 |
| `reviewed` | required reviewer의 evidence가 모두 제출된 상태 |
| `verified` | evidence gate 판정이 끝난 상태 |
| `passed` | closure decision이 `approved`로 끝나 종결된 상태 |

### 보류/종결 상태

| 상태 | 의미 |
|---|---|
| `blocked` | 현재 기준으로 진행할 수 없는 차단 상태 |
| `escalated` | task 수준에서 종결하지 못해 상위 판단으로 넘어간 상태 |
| `cancelled` | 더 이상 이 contract를 진행하지 않기로 확정된 상태 |

### 상태별 활동

각 상태에서 실제로 어떤 작업이 일어나고 어떤 artifact가 생성되는지 정리한다. 구현체는 이보다 세분화된 pipeline step을 자유롭게 둘 수 있지만, 각 상태에서 끝나야 다음으로 넘어갈 수 있는 최소 활동은 다음과 같다.

| 상태 | 이 상태에서 수행되는 작업 | 이 상태에서 생성되는 주요 artifact |
|---|---|---|
| `drafted` | Design Authority가 task contract 초안을 작성한다 | `contract.json` (미승인) |
| `ready` | baseline 유효성과 의존 task 상태를 재확인하며 실행을 대기한다 | — |
| `implementing` | Implementer가 implementation contract를 작성하고 구현한 뒤 self-check를 남긴다. Required reviewer도 이 상태 동안 각자의 evidence를 제출한다 | `implementation-contract.json`, `self-check.json`, task에 해당하는 `evidence/{agent}.json` 집합 |
| `reviewed` | evidence gate가 pass/fail/block/error를 판정한다 | `gate-results/{gate_run_id}.json` |
| `verified` | Orchestrator가 task closure decision을 내린다 | closure `evidence/orchestrator.json` |
| `passed` | consolidating phase가 이 task의 signal을 읽는다 | — |

보류 상태(`blocked`, `escalated`, `cancelled`)는 작업이 더 이상 진행되지 않는 상태이므로 별도의 활동을 포함하지 않는다. 해당 상태로의 진입 조건은 전이 표가 정한다.

### 실패는 상태가 아니다

검증 실패나 `changes_requested`는 별도 상태가 아니다. gate가 `fail`을 내리거나 closure decision이 `changes_requested`를 내리면, Orchestrator가 이유에 맞는 작업 상태로 되돌린다.

### 전이 표

| 현재 상태 | 다음 상태 | 조건 |
|---|---|---|
| `drafted` | `ready` | 사용자 승인과 phase gate를 통과함 |
| `ready` | `implementing` | 의존 task가 `passed`이고 baseline이 유효함 |
| `implementing` | `reviewed` | 구현과 self-check가 끝나고 required reviewer review가 제출됨 |
| `reviewed` | `verified` | evidence gate가 완료됨 |
| `verified` | `passed` | Orchestrator가 task closure decision `approved`를 남김 |
| `implementing`, `reviewed`, `verified` | `blocked` | 현재 기준으로 진행 불가한 차단 사유가 확정됨 |
| `blocked`, `verified` | `escalated` | task 단위 판단을 넘는 문제로 상향 이관함 |
| `drafted`, `ready`, `implementing`, `reviewed`, `blocked` | `cancelled` | 미션 범위 변경이나 대체 task 발생 등으로 중단이 확정됨 |

Task를 되돌릴 때 어느 상태로 복원할지는 고정 표보다 Orchestrator의 판단을 따른다. 다만 되감기 이유와 복원 근거는 closure decision이나 관련 evidence에 남아야 한다.

## Evidence

Evidence는 task에 대한 역할별 작업/판단 기록이다. GEAS에서 evidence는 task 단위 artifact이며, 정확한 구조는 `evidence_kind`별 schema(`evidence-implementation.schema.json`, `evidence-review.schema.json`, `evidence-verification.schema.json`, `evidence-challenge.schema.json`, `evidence-closure.schema.json`)가 각각 관리한다.

### 공통 필드

대부분의 evidence는 다음 필드를 공유한다.

| 필드 | 의미 |
|---|---|
| `agent` | 이 기록을 남긴 concrete agent 또는 type |
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
| `closure` | Orchestrator | `verdict`, `rationale` |

`verdict`는 모든 evidence에 공통으로 붙지 않는다. 현재 schema 기준으로 `review`, `verification`, `challenge`, `closure` evidence에만 붙는다.

### slot과 evidence의 연결

- `implementer`는 보통 `implementation` evidence를 남긴다.
- `verifier`는 독립 검증 결과를 `verification` evidence로 남긴다.
- `risk-assessor`, `operator`, `communicator`는 보통 `review` evidence를 남긴다.
- `challenger`는 `challenge` evidence를 남긴다.
- `orchestrator`는 task closure decision을 `closure` evidence로 남긴다.

Slot이 곧 evidence kind는 아니다. 어떤 slot이 어떤 판단을 수행했는지에 따라 evidence kind를 고른다.

## Evidence Gate

Evidence gate는 "이 task를 종결할 수 있을 만큼 검증 근거가 충분한가"를 판정하는 단계다. 매 gate run은 독립 artifact로 남기며 정확한 구조는 `gate-result.schema.json`이 관리한다. 재실행이 있으면 이전 run을 덮어쓰지 않고 새 gate run artifact를 추가해 이력을 보존한다. `.geas/` 트리에서의 정확한 경로는 doc 08이 관리한다.

### Tier

| tier | 의미 |
|---|---|
| Tier 0 | 필수 artifact와 필수 reviewer의 review가 제출되었는지 보는 사전 점검 |
| Tier 1 | `eval_commands`나 반복 가능한 절차를 통한 기계적 검증 |
| Tier 2 | contract와 review verdict를 함께 읽는 판단 검증 |

Gate는 Tier 0 → Tier 1 → Tier 2 순서로 진행하며, 어느 Tier에서든 fail/block/error가 나오면 해당 verdict가 곧 전체 gate verdict가 된다.

### gate verdict

| verdict | 의미 |
|---|---|
| `pass` | closure 판단으로 넘어갈 수 있음 |
| `fail` | 재작업은 필요하지만 차단 사유는 아님 |
| `block` | 현 상태로는 종결할 수 없는 차단 사유가 있음 |
| `error` | gate 자체가 성립하지 않았거나 검증 실행이 무효였음 |

`fail`은 재작업 신호고, `block`은 차단 신호다. 둘 다 `passed`로 바로 이어질 수 없다.

## Task-level Deliberation

Task-level deliberation은 review, verification, challenge 사이의 충돌을 명시적으로 풀어야 할 때 남기는 심의 기록이다. 정확한 구조는 `deliberation.schema.json`이 관리한다. 같은 schema가 mission-level deliberation에도 쓰이며, level은 저장 경로로 구분한다.

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
| `summary` | 이 task에서 실제로 무엇을 바꾸려 하는지를 한 문장으로 담는다 |
| `rationale` | 이 접근을 택한 이유와 배경 |
| `change_scope` | 이번 구현이 실제로 수정하거나 추가할 표면 |
| `planned_actions` | reviewer가 구현 흐름을 따라갈 수 있도록 정리한 실행 단계 |
| `non_goals` | 이번 task에서는 다루지 않기로 한 범위 |

구현 방향이 실질적으로 바뀌면, 작업을 계속 밀어붙이기 전에 implementation contract를 먼저 갱신해야 reviewer가 변경된 의도를 따라갈 수 있다.

## Implementer Self-Check

Implementer self-check는 해당 task에 할당된 `implementer`가 구현을 마친 뒤, independent review로 넘기기 전에 남기는 자기 점검 기록이다. 정규 artifact는 `self-check.json`이고, 정확한 구조는 `self-check.schema.json`이 관리한다.

| 필드 | 의미 |
|---|---|
| `completed_work` | `implementer`가 실제로 끝냈다고 보는 범위 |
| `reviewer_focus` | reviewer가 먼저 봐야 한다고 `implementer`가 판단한 지점 |
| `known_risks` | 구현 이후에도 남아 있는 우려 |

Self-check는 review를 대신하지 않는다. reviewer가 어디부터 볼지 압축해서 넘기는 입력이다.

## Task-level Retrospective Signals

Task는 자체적으로 memory, debts, gap을 확정하지 않는다. Task evidence는 "이 문제가 있었다"를 드러내는 신호만 남기고, "어떻게 처리할지"는 consolidating phase가 확정한다. 공식 memory는 doc 06이, 공식 debts와 gap은 doc 07이 owner다.

Task가 남기는 신호는 다음과 같다.

- `memory_suggestions` — learning 후보 (doc 06이 받음)
- `debt_candidates` — 기술 부채 후보 (doc 07이 받음)
- `gap_signals` — 범위/기대 차이 신호 (doc 07이 받음)
- 필요 시 `record.json`의 retrospective 섹션

## 취소 규칙

Task는 다음 경우 `cancelled`가 될 수 있다.

- 상위 미션 범위가 바뀌어 더 이상 이 contract가 필요 없을 때
- 더 적절한 새 task contract가 기존 contract를 대체했을 때
- block 사유가 해소 불가능해 현재 contract를 유지할 실익이 없을 때

취소는 `closure` evidence에 verdict `cancelled`로 남기며, `rationale`에 왜 취소했는지를 담고, 대체 contract가 있다면 `superseded_by`로 해당 task를 참조한다. 취소는 조용히 사라지지 않고 근거와 대체 관계가 명시돼야 한다.
