# 05. Runtime State and Recovery

> GEAS의 mission state, task state, recovery class, recovery packet, recovery safety 규칙을 정의한다. Mission phase와 task closure 의미는 각각 doc 02, doc 03이 owner다.

## 목적

Runtime은 실행 중 상태를 담고, recovery는 중단된 실행을 다시 안전하게 이어 붙이는 절차다. 이 문서는 계약과 evidence를 다시 만들지 않고도 어디까지 진행되었는지 복원할 수 있게 하는 최소 runtime 규칙을 정의한다.

Runtime 상태는 두 계층의 인덱스로 나뉜다.

- **Mission state** — 한 mission의 runtime 인덱스. mission 디렉토리에 놓인다.
- **Task state** — 한 task의 runtime 인덱스. task 디렉토리에 놓인다.

Recovery는 별도의 상태 분류가 아니라, 이 인덱스와 실제 artifact를 같이 읽어 중단된 실행을 이어 갈 때 파생되는 개념이다. 계층을 분리하면 여러 mission을 병렬로 다룰 수 있고, task 단위 인덱스가 task artifact와 같은 폴더에 모인다.

## Mission State

Mission state의 정규 JSON artifact는 `.geas/missions/{mission_id}/mission-state.json`이고, 정확한 구조는 `mission-state.schema.json`이 관리한다.

Mission state는 source of truth가 아니다. 계약과 evidence를 다시 찾아가게 해 주는 mission 단위 런타임 인덱스다.

### mission state가 담는 것

| 필드 | 의미 |
|---|---|
| `status` | 이 mission의 session 진행 상태 |
| `mission_id`, `mission` | 어떤 mission을 실행 중인지 |
| `phase` | mission이 어느 phase에 있는지 |
| `current_task_id` | 지금 active한 task가 무엇인지 |
| `completed_tasks` | 이 mission에서 이미 종결된 task들 |
| `recovery_class` | 최근 recovery가 어떤 유형이었는지 |
| `scheduler_state` | 실행기가 active/idle/paused 중 어떤 상태인지 |
| `parallel_batch`, `completed_in_batch` | mission 내 현재 병렬 배치 구성과 진행 상황 |

Mission state가 계약이나 evidence와 어긋나면, 권위는 항상 계약과 evidence 쪽에 있다.

## Task State

Task state의 정규 JSON artifact는 `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json`이고, 정확한 구조는 `task-state.schema.json`이 관리한다.

Task state는 이 task의 실행이 어느 단계에서, 어떤 agent로, 어떤 evidence를 기대하며 진행되고 있는지를 담는 task 단위 runtime 인덱스다. Task contract의 `status` 필드(lifecycle state)와는 다르다. `status`는 "이 task가 어느 생애 단계에 있는지"를 가리키고, task state는 "이 task의 실행이 지금 어디를 지나고 있는지"를 가리킨다.

### task state가 담는 것

| 필드 | 의미 |
|---|---|
| `pipeline_step` | 현재 어느 처리 단계에 있었는지 |
| `agent_in_flight` | 작업 중이던 agent가 누구였는지 |
| `pending_evidence` | 아직 받아야 하는 evidence가 무엇이었는지 |
| `retry_count` | 이 task의 검증-수정 반복 횟수 |
| `remaining_steps` | 남은 runtime step 목록 |
| `last_updated` | 마지막 갱신 시각 |
| `checkpoint_phase` | two-phase 쓰기의 `pending`/`committed` 상태 |

### task state 원칙

- agent spawn 직전이나 주요 step 경계에서 task state를 갱신한다.
- `checkpoint_phase=pending`이면 write가 완전히 끝나지 않았을 수 있다고 가정한다.
- recovery는 task state만으로 복원하지 않고, 실제 artifact의 존재 여부도 함께 확인한다.

## Recovery Class

Recovery class는 중단 종류를 분류하는 상위 라벨이다.

| recovery class | 의미 |
|---|---|
| `post_compact_resume` | 요약만 남은 상태에서 재개 |
| `warm_session_resume` | 동일 mission을 비교적 깨끗한 상태로 재개 |
| `interrupted_subagent_resume` | 하위 agent 실행 중 중단 후 재개 |
| `dirty_state_recovery` | workspace나 artifact 상태가 섞인 상태에서 복구 |
| `manual_repair_required` | 자동 복구로 넘길 수 없는 상태 |

## Recovery Anchor

Recovery는 다음 순서로 anchor를 잡는다.

1. 승인된 contract와 실제 evidence
2. `record.json`의 현재 구조화 섹션
3. `mission-state.json`과 `task-state.json`
4. 사람 읽기용 요약이나 부가 메모

상위 anchor와 하위 anchor가 충돌하면, 더 구조적이고 더 canonical한 쪽을 따른다.

## Recovery Packet

Recovery packet은 "무슨 문제가 감지되었고 다음에 무엇을 해야 하는가"를 명시하는 복구용 artifact다. 정확한 구조는 `recovery-packet.schema.json`이 관리한다.

| 필드 | 의미 |
|---|---|
| `recovery_id` | recovery 시도를 식별하는 id |
| `recovery_class` | 어떤 복구 유형인지 |
| `focus_task_id` | 복구 판단의 중심이 되는 task |
| `detected_problem` | 무엇이 잘못되었는지 |
| `recommended_action` | 다음에 어떤 복구 조치를 해야 하는지 |
| `artifacts_found` | 확인된 artifact |
| `artifacts_missing` | 기대했지만 없는 artifact |

## Recovery 안전 규칙

- `mission-state.json`이나 `task-state.json`이 있다고 해서 해당 상태 주장이 자동으로 유효하지는 않다.
- partial artifact가 있으면 정상 artifact처럼 소비하지 말고 격리 대상으로 본다.
- dirty workspace는 항상 task contract, evidence, task state와 대조해서 읽는다.
- closure나 final verdict 주장에 근거 artifact가 없으면 그대로 진행하지 않는다.

## Manual Repair Required

다음 경우는 자동 복구보다 수동 판단을 우선한다.

- 어떤 task가 어떤 workspace 변경을 만들었는지 설명이 되지 않을 때
- task state와 실제 artifact가 여러 군데서 동시에 충돌할 때
- partial artifact가 많아 정상/비정상을 기계적으로 가를 수 없을 때
- recovery packet이 추천한 조치 자체가 상위 계약과 어긋날 때

이 상태에서는 억지로 phase나 task를 전이하지 말고, 어떤 artifact를 신뢰할지부터 다시 정해야 한다.
