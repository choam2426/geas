# CLI 최소 표면

## 목적

이 문서는 Geas CLI의 최소 표면을 정의한다.

Geas CLI는 Orchestrator와 agent role이 Geas runtime artifact를 운영 흐름에 맞게 기록하고, 허용된 Mission stage와 Task phase 전이를 원자적으로 수행하게 하는 비대화형 runtime control surface다.

CLI의 직접 사용자는 Orchestrator와 agent role이다. User의 검토와 수용 판단은 Orchestrator와의 상호작용을 통해 이루어지며, 그 결과는 User Judgment artifact로 기록된다.

CLI는 `.geas/` runtime storage를 직접 다루는 얇은 도구다. CLI는 artifact의 위치, 이름, 번호, schema, 참조, 진행 pointer, 전이 조건을 관리해 agent가 운영 흐름 밖으로 벗어나지 않고 기록을 남기게 한다.

CLI는 운영 흐름을 보존하기 위한 구조적 조건을 확인하고, 다음 agent가 이어갈 수 있는 구조화된 실행 결과를 반환한다.

## 기본 관점

CLI의 중심 책임은 기록과 전이다.

기록은 Mission 기준선, Task contract, Evidence, User Judgment, Memory를 runtime artifact로 남기는 일이다.

전이는 현재 runtime 상태에서 다음 Mission stage나 Task phase로 이동할 수 있는 구조적 조건을 확인하고, 조건이 충족되면 `run-state.yaml`이나 `task-state.yaml`을 함께 갱신하는 일이다.

CLI 명령은 typed transaction으로 동작한다. 하나의 명령은 필요한 runtime context를 읽고, 입력 payload를 schema에 맞게 확인하고, 참조와 전이 조건을 확인하고, 관련 artifact와 state pointer를 함께 갱신한다.

쓰기 명령은 관련 artifact와 state pointer를 하나의 성공 단위로 다룬다. 명령이 성공하면 갱신된 runtime 상태와 다음에 이어갈 수 있는 구조화된 결과를 반환한다.

명령이 실행 조건을 충족하지 못하면 runtime을 기존 상태로 유지하고, 실패 출력에 막힌 구조적 조건과 다음 조치 후보를 담는다.

## 최소 명령 표면

초기 CLI 표면은 다음 명령으로 시작한다.

```text
geas init

geas mission create
geas mission spec record --from -
geas mission design record --from -
geas mission transition --to <stage> [--task <task-id>]

geas task contract record --task <task-id> --from -
geas task transition --to <phase> --task <task-id>

geas task evidence record --task <task-id> --kind implementation --from -
geas task evidence record --task <task-id> --kind verification --from -
geas task evidence record --task <task-id> --kind review --from -
geas task evidence record --task <task-id> --kind challenger --from -
geas task evidence record --task <task-id> --kind task --from -

geas mission evidence record --from -

geas judgment record --target task-result --task <task-id> --from -
geas judgment record --target mission-result --from -

geas memory record --scope common --from -
geas memory record --scope role --role <role> --from -
```

Mission 기준선은 `mission spec record`, `mission design record`, `task contract record`로 나누어 기록한다. 이 명령들이 기록하는 Mission Spec, Mission Design, Task Contract는 runtime에서 versioned 기준선 artifact로 남는다.

기준선 draft는 runtime artifact가 아니다. Orchestrator와 agent role은 User와 합의된 기준선을 CLI 기록 명령으로 runtime에 남긴다.

Task Evidence는 `task evidence record --kind task`로 기록한다. Mission Evidence는 `mission evidence record`로 기록한다. runtime에는 각각 `task-evidence.yaml`, `mission-evidence.yaml`로 저장된다.

## 공통 명령 동작

runtime을 갱신하는 명령은 먼저 현재 `.geas/` runtime context를 읽는다.

각 명령은 자기 책임 범위 안에서 schema, enum 값, 필수 key, artifact 참조, 현재 Mission id, 현재 Task id, 현재 stage 또는 phase를 확인한다.

쓰기 명령은 실행 전 guard와 실행 후 guard를 가진다. 실행 전 guard는 현재 runtime 상태와 입력 payload가 명령을 수행할 조건을 갖추었는지 확인한다. 실행 후 guard는 갱신된 runtime 상태가 schema와 참조 규칙을 만족하는지 확인한다.

쓰기 명령은 관련 artifact와 state pointer를 하나의 transaction으로 다룬다. Task Evidence 기록이 다음 phase로 이어지는 경우 Evidence 파일과 `task-state.yaml` 갱신은 하나의 성공 단위가 된다.

쓰기 명령은 실행 조건을 충족하지 못하면 runtime을 기존 상태로 유지하고, 실패 출력에 막힌 guard를 담는다.

CLI는 runtime에서 파생되는 identifier와 파일명을 할당한다. Mission id와 Evidence 번호는 CLI가 생성한다. Task id는 Task Contract 기록 시 `--task <task-id>`로 지정된 값을 기준으로 한다.

CLI가 현재 Mission 기준선을 읽을 때는 가장 큰 번호의 `mission-spec-NNN.yaml`과 `mission-design-NNN.yaml`을 사용한다. CLI가 현재 Task 실행 기준선을 읽을 때는 가장 큰 번호의 `task-contract-NNN.yaml`을 사용한다.

CLI가 User Judgment를 읽을 때는 판단 대상 scope에서 가장 큰 번호의 `user-judgment-result-NNN.yaml`을 current User Judgment로 사용한다. CLI guard에서 수용된 User Judgment는 current User Judgment의 `decision`이 `accepted` 또는 `accepted_with_limits`인 경우를 뜻한다.

명령은 필요한 경우 기대 상태를 입력으로 받을 수 있다. 기대 Mission stage, Task phase, current Task가 실제 runtime 상태와 다르면 state conflict로 실패한다.

초기 공통 기대 상태 옵션은 `--expect-stage`, `--expect-phase`, `--expect-task`다.

## 입력과 출력

CLI는 비대화형으로 동작한다. runtime에 기록할 payload는 파일 또는 stdin으로 받는다.

기록 명령은 `--from <path|->`로 YAML payload를 받는다.

일반적인 agent workflow에서는 임시 payload 파일을 만들고 그 경로를 `--from <path>`로 전달한다. `--from -`는 stdin 입력이 필요한 adapter나 자동화에서 사용한다.

입력 payload 파일은 runtime artifact가 아니다. CLI는 입력 payload를 검증한 뒤 runtime schema와 storage 규칙에 따라 정식 artifact 경로에 기록한다.

출력은 agent가 이어서 사용할 수 있는 구조화된 결과를 기본으로 한다. 초기 구현의 stdout 출력은 JSON result object로 둔다. diagnostic log가 필요하면 stderr를 사용한다.

성공 출력은 적어도 다음 정보를 포함한다.

- 실행한 command
- 현재 runtime 위치
- 생성하거나 갱신한 artifact 경로
- state pointer 변경 내역

실패 출력은 적어도 다음 정보를 포함한다.

- 실패 code
- 실패한 guard
- 관련 artifact 경로
- 현재 runtime 위치
- write가 수행되지 않았다는 사실

출력은 runtime 사실과 guard 결과를 담는다. 출력은 다음 명령 문자열이나 운영 판단 prose를 담지 않는다.

예시는 다음과 같다.

```json
{
  "ok": false,
  "command": "mission transition",
  "current": {
    "mission_id": "20260507-a1b2c3",
    "stage": "specifying",
    "task_id": "",
    "phase": ""
  },
  "writes": [],
  "error": {
    "code": "transition_blocked",
    "guards": [
      {
        "code": "current_task_contract_required",
        "path": ".geas/missions/20260507-a1b2c3/tasks/task-001/task-contract-001.yaml",
        "status": "missing"
      }
    ]
  }
}
```

## 명령별 책임

### init

`geas init`은 현재 project에 `.geas/` runtime storage를 만든다.

이 명령은 다음을 만든다.

- `.geas/run-state.yaml`
- `.geas/memory/common.yaml`
- `.geas/memory/roles/` 아래 기본 role memory 파일
- `.geas/missions/`

`init`은 Mission을 시작하지 않는다. 초기 `run-state.yaml`은 `current_mission_id: ""`, `current_stage: ""`, `current_task_id: ""`로 시작한다.

### mission create

`geas mission create`는 새 Mission id와 Mission directory를 만든다.

이 명령은 현재 `run-state.yaml`의 `current_mission_id`가 비어 있을 때 실행한다. 새 Mission directory를 만들고, `run-state.yaml`을 `current_mission_id: <mission-id>`, `current_stage: "specifying"`, `current_task_id: ""`로 갱신한다.

이 명령은 다음을 확인한다.

- `run-state.yaml`의 `current_mission_id`가 `""`다.
- `run-state.yaml`의 `current_stage`가 `""`다.
- `run-state.yaml`의 `current_task_id`가 `""`다.
- 같은 Mission id directory가 없다.

Mission이 생성되면 현재 stage는 `specifying`이다.

### mission spec record

`geas mission spec record --from <path|->`는 현재 Mission의 Mission Spec 기준선을 기록한다.

이 명령은 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission directory가 존재한다.
- 현재 Mission stage가 `specifying`이다.
- Mission Spec schema가 맞다.
- 다음 `mission-spec-NNN.yaml` 파일명이 충돌하지 않는다.

조건이 충족되면 다음 번호의 `mission-spec-NNN.yaml`을 기록한다.

Mission Spec 갱신 이유와 영향은 이후 Evidence, User Judgment, Mission Evidence에서 드러난다.

### mission design record

`geas mission design record --from <path|->`는 현재 Mission의 Mission Design 기준선을 기록한다.

이 명령은 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `specifying`이다.
- 현재 Mission Spec이 존재한다.
- Mission Design schema가 맞다.
- 다음 `mission-design-NNN.yaml` 파일명이 충돌하지 않는다.

조건이 충족되면 다음 번호의 `mission-design-NNN.yaml`을 기록한다.

Task Contract는 `task contract record`가 기록하고, 이때 Task directory를 materialize한다. 대상 Task의 `task-state.yaml`이 없으면 이 명령은 Task State를 `phase: unstarted`로 생성한다.

### task contract record

`geas task contract record --task <task-id> --from <path|->`는 Task Contract 기준선을 기록한다.

이 명령은 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `specifying` 또는 `building`이다.
- 현재 Mission Design이 존재한다.
- Task Contract의 dependency가 기록된 Task Contract를 가리킨다.
- Task Contract dependency가 순환하지 않는다.
- 현재 Mission stage가 `building`이면 지정한 Task id가 `run-state.yaml`의 `current_task_id`와 일치한다.
- 현재 Mission stage가 `building`이면 대상 Task phase가 `awaiting_user_judgment`이고 current Task result User Judgment의 `decision`이 `revise`다.
- Task Contract schema가 맞다.
- 다음 `task-contract-NNN.yaml` 파일명이 충돌하지 않는다.

조건이 충족되면 다음 번호의 `task-contract-NNN.yaml`을 기록한다. 대상 Task의 `task-state.yaml`이 없으면 `phase: unstarted`로 생성한다. 갱신 이유와 영향은 Task 실행 중 Evidence나 종료 요약에 남긴다.

### task evidence record

`geas task evidence record --task <task-id> --kind <kind> --from -`는 Task scope Evidence artifact를 기록한다.

`kind`는 다음 값 중 하나다.

- `implementation`
- `verification`
- `review`
- `challenger`
- `task`

`implementation`, `verification`, `review`, `challenger` Evidence는 numbered artifact로 append한다. `task`는 Task Evidence를 `task-evidence.yaml`로 기록한다.

이 명령은 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `building`이다.
- 지정한 Task id가 `run-state.yaml`의 `current_task_id`와 일치한다.
- 대상 Task의 현재 Task Contract가 존재한다.
- 대상 Task의 `task-state.yaml`이 존재한다.
- Evidence kind가 현재 Task phase와 대응한다.
- payload schema가 Evidence kind와 맞다.
- `verification`, `review`, `challenger` Evidence의 `verdict` 값이 허용 값이다.
- numbered Evidence는 다음 파일명이 충돌하지 않는다.
- `task` Evidence는 `task-evidence.yaml` 파일명이 충돌하지 않는다.

Task role Evidence는 현재 Task phase와 대응하는 kind일 때 기록한다.

|현재 phase|기록 kind|조건|기록 성공 후 phase|
|---|---|---|---|
|`implementing`|`implementation`|항상|`verifying`|
|`verifying`|`verification`|`verdict: passed`|`reviewing`|
|`verifying`|`verification`|`verdict: changes_requested` 또는 `escalated`|`awaiting_user_judgment`|
|`reviewing`|`review`|항상|`awaiting_user_judgment`|
|`challenging`|`challenger`|항상|`awaiting_user_judgment`|
|`awaiting_user_judgment`|`task`|Task result User Judgment 수용|`closed`|

Verification Evidence의 verdict가 `changes_requested` 또는 `escalated`이면 CLI는 다음 phase를 `awaiting_user_judgment`로 둔다. 재작업, review 진행, 기준선 갱신은 Orchestrator와 User의 판단 이후 `judgment record`와 `task transition`으로 다룬다.

`task` Evidence는 현재 Task phase가 `awaiting_user_judgment`이고, Task result User Judgment decision이 `accepted` 또는 `accepted_with_limits`일 때 기록할 수 있다.

`task` Evidence 기록이 성공하면 Task State phase를 `closed`로 갱신한다. `closed`는 Task Evidence까지 기록된 Task 흐름의 terminal pointer다.

### mission evidence record

`geas mission evidence record --from <path|->`는 Mission Evidence를 기록한다.

이 명령은 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `consolidating`이다.
- Mission result User Judgment decision이 `accepted` 또는 `accepted_with_limits`다.
- Mission Evidence schema가 맞다.
- `mission-evidence.yaml` 파일명이 충돌하지 않는다.

Mission Evidence 기록이 성공하면 `run-state.yaml`을 `current_mission_id: ""`, `current_stage: ""`, `current_task_id: ""`로 갱신한다. 이는 Mission Evidence까지 기록된 Mission 흐름의 current pointer 정리다.

### judgment record

`geas judgment record`는 User Judgment를 기록한다.

target은 다음 값 중 하나다.

- `task-result`
- `mission-result`

`task-result` judgment는 지정한 Task 결과에 대한 User 수용 판단을 기록한다.

`mission-result` judgment는 Mission 결과에 대한 User 수용 판단을 기록한다.

`task-result` judgment는 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `building`이다.
- 대상 Task가 `current_task_id`와 같다.
- 대상 Task phase가 `awaiting_user_judgment`다.
- User Judgment schema가 맞다.
- User Judgment의 decision 값이 허용된 값이다.
- 다음 `user-judgment-result-NNN.yaml` 파일명이 충돌하지 않는다.

조건이 충족되면 대상 Task directory에 다음 번호의 `user-judgment-result-NNN.yaml`을 기록한다.

`mission-result` judgment는 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `consolidating`이다.
- User Judgment schema가 맞다.
- User Judgment의 decision 값이 허용된 값이다.
- 다음 `user-judgment-result-NNN.yaml` 파일명이 충돌하지 않는다.

조건이 충족되면 Mission root에 다음 번호의 `user-judgment-result-NNN.yaml`을 기록한다.

`judgment record`는 User Judgment artifact를 남긴다. Task phase와 Mission stage 갱신은 Evidence 기록 명령이나 transition 명령이 수행한다.

### mission transition

`geas mission transition --to <stage> [--task <task-id>]`는 Mission stage 전이를 수행한다.

Mission stage 값은 다음 중 하나다.

```text
specifying
building
consolidating
```

`mission transition`은 현재 runtime 상태에서 전이 가능한 구조적 조건을 확인하고, 조건이 충족될 때 `run-state.yaml`을 갱신한다.

허용되는 Mission stage 전이는 다음과 같다.

|from stage|to stage|쓰는 경우|
|---|---|---|
|`specifying`|`building`|합의된 Mission 기준선으로 첫 Task에 진입할 때|
|`building`|`building`|같은 Mission 안에서 다음 Task로 current Task를 옮길 때|
|`building`|`consolidating`|대상 Task들이 수용되어 Mission 정리로 이동할 때|
|`building`|`specifying`|Task 판단 중 Mission 기준선 재검토가 필요할 때|
|`consolidating`|`building`|추가 Task나 Task Contract 갱신이 필요할 때|
|`consolidating`|`specifying`|Mission 기준선 갱신이 필요할 때|

`building` 진입은 다음 조건을 요구한다.

- `--task <task-id>`가 지정되어 있다.
- 현재 Mission Spec이 존재한다.
- 현재 Mission Design이 존재한다.
- 진입할 Task의 현재 Task Contract가 존재한다.
- 진입할 Task의 dependency Task들이 Task Evidence와 수용된 Task result User Judgment를 가진다.
- 현재 Mission stage가 `specifying` 또는 `consolidating`이면 `current_task_id`가 `""`다.
- 현재 Mission stage가 `building`이고 다른 Task로 이동하면 기존 current Task phase가 `closed`다.

`building` 진입이 성공하면 `run-state.yaml`을 `current_stage: building`, `current_task_id: <task-id>`로 갱신한다.

`consolidating` 진입은 다음 조건을 요구한다.

- 기록된 Task Contract의 대상 Task들이 Task Evidence를 가진다.
- 기록된 Task Contract의 대상 Task들이 수용된 Task result User Judgment를 가진다.

`consolidating` 진입이 성공하면 `run-state.yaml`을 `current_stage: consolidating`, `current_task_id: ""`로 갱신한다.

`specifying` 진입은 Mission 기준선 갱신이 필요할 때 사용한다. 전이 이유와 요청된 조치는 User Judgment, Evidence, 또는 이후 기록되는 새 Mission 기준선에 남긴다.

`specifying` 진입이 성공하면 `run-state.yaml`을 `current_stage: specifying`, `current_task_id: ""`로 갱신한다.

`mission transition`은 Mission stage와 current Task pointer를 갱신한다. Task phase 갱신은 `task transition` 또는 Task Evidence 기록 명령이 수행한다.

### task transition

`geas task transition --to <phase> --task <task-id>`는 Task phase 전이를 수행한다.

Task phase 값은 다음 중 하나다.

```text
unstarted
implementing
verifying
reviewing
challenging
awaiting_user_judgment
closed
```

`task transition`은 Evidence 기록으로 처리되지 않는 명시적 Task phase 전이를 수행한다. 현재 runtime 상태에서 전이 가능한 구조적 조건을 확인하고, 조건이 충족될 때 대상 Task의 `task-state.yaml`을 갱신한다.

Task 실행을 시작할 때 `task transition --to implementing`은 `unstarted` Task를 `implementing`으로 전이한다.

`task transition`은 다음 공통 조건을 요구한다.

- 현재 Mission stage가 `building`이다.
- 대상 Task가 `run-state.yaml`의 `current_task_id`와 같다.
- 대상 Task의 현재 Task Contract가 존재한다.
- 대상 Task의 dependency Task들이 Task Evidence와 수용된 Task result User Judgment를 가진다.

정상 Task 흐름의 phase 전진은 Task Evidence 기록 명령이 수행한다.

|기록 명령|기록 성공 후 phase|
|---|---|
|`task evidence record --kind implementation`|`verifying`|
|`task evidence record --kind verification` with `verdict: passed`|`reviewing`|
|`task evidence record --kind verification` with `verdict: changes_requested` 또는 `escalated`|`awaiting_user_judgment`|
|`task evidence record --kind review`|`awaiting_user_judgment`|
|`task evidence record --kind challenger`|`awaiting_user_judgment`|
|`task evidence record --kind task`|`closed`|

`task transition`은 User Judgment나 Orchestrator 분기 이후 Task를 어디서 이어갈지 정할 때 사용한다.

허용되는 명시적 Task phase 전이는 다음과 같다.

|from phase|to phase|쓰는 경우|
|---|---|---|
|`unstarted`|`implementing`|Task를 처음 시작할 때|
|`awaiting_user_judgment`|`implementing`|current User Judgment가 `revise`인 뒤 재작업으로 이어갈 때|
|`awaiting_user_judgment`|`verifying`|current User Judgment가 `revise`인 뒤 구현 변경 없이 재검증으로 이어갈 때|
|`awaiting_user_judgment`|`reviewing`|current User Judgment가 `revise`인 뒤 추가 review로 이어갈 때|
|`reviewing`|`challenging`|User 수용 판단 전에 Challenger를 추가할 때|
|`awaiting_user_judgment`|`challenging`|User 수용 판단 전에 Challenger가 뒤늦게 필요해졌을 때|
|`verifying`|`awaiting_user_judgment`|Verification Evidence가 이미 있고 pointer를 User 수용 판단 대기로 맞출 때|
|`reviewing`|`awaiting_user_judgment`|Review Evidence가 이미 있고 pointer를 User 수용 판단 대기로 맞출 때|
|`challenging`|`awaiting_user_judgment`|Challenger Evidence가 이미 있고 pointer를 User 수용 판단 대기로 맞출 때|

`implementing`, `verifying`, `reviewing`, `challenging`으로 돌아가는 전이는 current User Judgment의 `decision`이 `revise`일 때 허용한다. Task Contract 갱신은 별도 phase가 아니라 `revise` 판단 이후 `task contract record`로 처리한다. `requested_actions`는 Orchestrator가 User와 합의한 다음 조치를 이해하기 위한 판단 맥락이며, CLI는 그 문장 의미를 해석하지 않는다.

`awaiting_user_judgment` 진입은 다음 조건을 요구한다.

- Task 결과에 대한 판단 입력으로 사용할 Evidence가 존재한다.
- 필수로 기록하지 못한 Evidence나 미검증 범위가 있으면 그 사실이 관련 Evidence에 드러나 있다.

`closed`는 `task transition`으로 직접 진입하지 않는다. `closed`는 수용된 Task result User Judgment 이후 `task evidence record --kind task`가 성공했을 때 도달하는 terminal pointer다.

`task transition`은 대상 Task의 `task-state.yaml`만 갱신한다. `run-state.yaml`의 current Task pointer는 `mission transition --to building --task <task-id>`가 정한다.

### memory record

`geas memory record --scope common --from -`는 Common Memory에 항목을 추가한다.

`geas memory record --scope role --role <role> --from -`는 Role Memory에 항목을 추가한다.

`memory record`는 다음을 확인한다.

- `current_mission_id`가 비어 있지 않다.
- 현재 Mission stage가 `consolidating`이다.
- Mission result User Judgment decision이 `accepted` 또는 `accepted_with_limits`다.
- Memory payload schema가 맞다.
- Memory 항목의 `source_refs`가 이미 존재하는 runtime artifact를 가리킨다.
- `--scope role`이면 `--role <role>`이 지정되어 있고, 허용된 role이다.

조건이 충족되면 `--scope common`은 `.geas/memory/common.yaml`의 `items`에 항목을 추가하고, `--scope role`은 `.geas/memory/roles/<role>.yaml`의 `items`에 항목을 추가한다.

Memory 항목은 Evidence, Task Evidence, User Judgment 같은 이미 존재하는 runtime artifact를 source ref로 가진다. 현재 Mission의 Mission Evidence는 Memory 반영 이후 기록된다.

Memory는 Mission 수용 판단 이후, Mission Evidence 기록 전에 반영한다.

`memory record`는 `run-state.yaml`이나 `task-state.yaml`을 갱신하지 않는다.

## 구현 대상

Geas CLI reference implementation은 TypeScript/Node로 작성하고, 배포 시에는 esbuild로 단일 JavaScript entrypoint로 bundle한다.

사용자는 TypeScript source를 직접 실행하지 않고, 빌드된 `geas` entrypoint를 실행한다.

이 방식은 agent tooling과 npm 생태계에 맞는 배포 편의성을 유지하면서도 runtime dependency 설치 비용을 줄인다.

## 책임 경계

CLI는 runtime artifact의 구조, 저장 위치, 파일명, 번호, 참조, stage, phase 전이 조건을 관리한다.

CLI는 `run-state.yaml`과 `task-state.yaml`을 수동으로 set하는 명령을 제공하지 않는다. state pointer는 guarded transition이나 기록 transaction의 결과로만 갱신한다.

CLI는 Evidence 품질을 판단하지 않는다.

CLI는 User의 검토를 대신하지 않는다.

CLI는 User의 수용 판단을 대신하지 않는다.

CLI는 agent verdict를 User Judgment로 승격하지 않는다.

CLI는 role을 수행하지 않는다. `verify`, `review`, `challenge`는 role의 행위이며 CLI 명령의 동사가 아니다. CLI는 그 행위의 결과를 Evidence로 기록한다.

CLI는 완료를 선언하지 않는다. `complete`, `finish`, `close`, `approve`, `accept`, `pass`, `certify` 같은 명령 이름은 초기 표면에 두지 않는다.

CLI는 agent client, plugin, dashboard, role invocation을 포함하지 않는다.

CLI는 별도 `validate` 명령을 제공하지 않는다. 구조적 validation은 모든 명령의 실행 전후 조건으로 포함한다.

Payload schema와 작성 예시는 문서나 skill에서 제공한다. CLI 초기 표면은 payload scaffold 또는 template 생성 명령을 포함하지 않는다.
