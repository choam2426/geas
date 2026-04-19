# 05. Runtime State and Recovery

> Geas의 mission state, task state, 재개 절차와 안전 원칙을 정의한다. Mission phase와 task closure 의미는 각각 doc 02, doc 03이 owner다.

## 목적

Runtime은 실행 중 상태를 담고, 재개는 중단된 실행을 다시 이어 가는 절차다. 이 문서는 계약과 evidence를 다시 만들지 않고도 어디까지 진행되었는지 복원할 수 있게 하는 최소 runtime 규칙을 정의한다.

Runtime 상태는 두 계층의 인덱스로 나뉜다.

- **Mission state** — 한 mission의 runtime 인덱스. mission 디렉토리에 놓인다.
- **Task state** — 한 task의 runtime 인덱스. task 디렉토리에 놓인다.

재개는 별도의 상태 분류나 전용 artifact를 두지 않고, 이 두 인덱스와 실제 artifact를 함께 읽어 중단된 지점을 확인한 뒤 이어 가는 일반 절차로 다룬다. 계층을 분리하면 여러 mission을 병렬로 다룰 수 있고, task 단위 인덱스가 task artifact와 같은 폴더에 모인다.

## Mission State

Mission state의 정규 JSON artifact는 `.geas/missions/{mission_id}/mission-state.json`이고, 정확한 구조는 `mission-state.schema.json`이 관리한다.

Mission state는 source of truth가 아니다. 계약과 evidence를 다시 찾아가게 해 주는 mission 단위 런타임 인덱스다.

### mission state가 담는 것

| 필드 | 의미 |
|---|---|
| `mission_id` | 이 mission의 식별자 (경로와 정합 확인용) |
| `phase` | mission이 어느 phase에 있는지 |
| `active_tasks` | 지금 실행 중인 task ID 목록 (0개: idle, 1개: sequential, N개: parallel batch) |
| `created_at`, `updated_at` | 생성·갱신 시각 |

이미 종결된 task 목록, recovery 유형, 구현체의 scheduler 상태 같은 신호는 mission state에 담지 않는다. 종결 여부는 각 task의 `contract.json` status로 파생하고, 구현체 신호는 프로토콜 관심사가 아니다.

Mission state가 계약이나 evidence와 어긋나면, 권위는 항상 계약과 evidence 쪽에 있다.

## Task State

Task state의 정규 JSON artifact는 `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json`이고, 정확한 구조는 `task-state.schema.json`이 관리한다.

Task state는 이 task의 실행이 지금 어떤 agent로, 어떤 evidence를 기대하며 진행되고 있는지를 담는 task 단위 runtime 인덱스다. Task contract의 `status` 필드(lifecycle state)와는 다르다. `status`는 "이 task가 어느 생애 단계에 있는지"를 가리키고, task state는 "이 task의 실행이 지금 어떤 agent·evidence로 묶여 있는지"를 가리킨다.

### task state가 담는 것

| 필드 | 의미 |
|---|---|
| `agent_in_flight` | 작업 중인 agent (없으면 null) |
| `pending_evidence` | 기대되는 evidence 파일 경로 (예: `evidence/implementer.json`) |
| `retry_count` | 이 task의 검증-수정 반복 횟수 |
| `write_phase` | two-phase 쓰기의 `pending`/`committed` 상태 |
| `created_at`, `updated_at` | 생성·갱신 시각 |

### task state 원칙

- agent spawn 직전이나 lifecycle state 전이 시점에 task state를 갱신한다.
- `write_phase=pending`이면 write가 완전히 끝나지 않았을 수 있다고 가정한다.
- 재개는 task state만으로 복원하지 않고, 실제 artifact의 존재 여부도 함께 확인한다.

## 재개 절차

재개는 다음 순서로 진행한다.

1. `mission-state.json`을 읽어 phase와 active task를 확인한다.
2. 각 active task의 `task-state.json`을 읽어 기대되는 agent와 evidence를 확인한다.
3. 실제 evidence 파일과 contract 상태를 대조하여, 인덱스의 주장이 현재 artifact와 일치하는지 검증한다.
4. 일치하면 표시된 지점에서 이어 가고, 어긋나면 drift 원칙(doc 08)에 따라 artifact 쪽을 신뢰하고 필요한 인덱스를 다시 맞춘다.
5. 자동 해소가 어렵거나 신뢰할 artifact 자체가 흐트러진 경우 task를 escalate 한다.

재개 자체는 별도 artifact를 남기지 않는다. 무엇을 새로 관찰했고 어떤 조치를 취했는지는 이후 task evidence, closure, phase review 같은 정규 artifact에 자연스럽게 남는다.

## 안전 원칙

- `mission-state.json`이나 `task-state.json`이 있다고 해서 해당 상태 주장이 자동으로 유효하지는 않다.
- partial artifact가 있으면 정상 artifact처럼 소비하지 말고 격리 대상으로 본다.
- dirty workspace는 항상 task contract, evidence, task state와 대조해서 읽는다.
- closure나 final verdict 주장에 근거 artifact가 없으면 그대로 진행하지 않는다.
- 어떤 artifact를 신뢰할지 스스로 정할 수 없는 상태에서는 억지로 phase나 task를 전이하지 말고 escalate 한다.
