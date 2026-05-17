# CLI 최소 표면

## Purpose

Geas CLI는 `.geas/`를 직접 조작하는 storage tool이 아니라, runtime artifact 기록과 stage/phase 전이를 원자적으로 guard하는 Workflow Guard다.

CLI는 다음 책임을 가진다.

- runtime artifact를 정해진 위치에 충돌 없이 기록한다.
- 기록과 state pointer 갱신을 하나의 transaction으로 다룬다.
- 명령 인자, payload frontmatter, 현재 runtime state가 서로 맞는지 검증한다.
- stage/phase 전이가 허용된 위치에서만 일어나게 막는다.
- 현재 state와 baseline pointer를 read-only JSON으로 노출한다.

CLI는 다음 책임을 가지지 않는다.

- User 검토나 수용 판단을 대신하지 않는다.
- Evidence 본문 품질, 판단 충분성, debt 의미, follow-up 의미를 평가하지 않는다.
- agent verdict나 recommendation을 User Judgment로 승격하지 않는다.
- caller가 작성해야 하는 `.md` artifact frontmatter를 대신 채우지 않는다.

## Command Surface

초기 CLI 표면은 domain command 스타일로 둔다.

```text
geas status

geas init

geas mission create
geas mission spec record --from <path|->
geas mission design record --from <path|->
geas mission transition --to <stage> [--task <task-id>]

geas task contract record --task <task-id> --from <path|->
geas task transition --to <phase> --task <task-id>

geas task evidence record --task <task-id> --kind implementation --from <path|->
geas task evidence record --task <task-id> --kind verification --from <path|->
geas task evidence record --task <task-id> --kind review --from <path|->
geas task evidence record --task <task-id> --kind challenger --from <path|->
geas task evidence record --task <task-id> --kind task --from <path|->

geas judgment record --target task-result --task <task-id> --from <path|->
geas judgment record --target mission-result --from <path|->

geas debt record --from <path|->
geas debt update --id <debt-id> --from <path|->

geas memory record --scope common --from <path|->
geas memory record --scope role --role <role> --from <path|->

geas mission evidence record --from <path|->
```

## Input Model

`--from <path|->`는 해당 명령이 요구하는 artifact-native payload를 읽는다.

- `.md` artifact 기록 명령은 YAML frontmatter와 Markdown body를 함께 받는다.
- YAML artifact와 ledger 명령은 해당 runtime schema에 맞는 YAML 문서를 받는다.
- `-`는 stdin을 뜻한다.
- 성공한 write 명령은 `--from <path>` 입력 파일을 소비한 것으로 보고 삭제한다.
- 실패한 명령은 payload 수정과 재시도를 위해 `--from <path>` 입력 파일을 보존한다.
- CLI는 payload 내용을 runtime artifact 파일로 복사하거나 정규화해서 기록할 수 있지만, 본문 의미를 새로 작성하지 않는다.

`.md` artifact의 frontmatter는 caller가 작성한다.

- CLI는 `task_id`, `name`, `refs`, `evidence_type`, `judgment_type` 같은 frontmatter 값을 주입하지 않는다.
- `--task`, `--target`, `--kind`, 현재 Mission pointer와 frontmatter 값이 맞는지 검증한다.
- 필수 section 존재 여부는 검증하지만, section 본문의 판단 품질은 검증하지 않는다.

CLI가 배정하는 값은 filename이나 runtime id 충돌을 막기 위한 값으로 제한한다.

- Mission id
- artifact version number
- Evidence number
- User Judgment attempt number
- Debt id

## Structural Guard

모든 기록 명령은 structural guard까지만 수행한다.

- payload 형식이 명령의 artifact-native 형식과 맞아야 한다.
- 필수 frontmatter key와 필수 Markdown section이 있어야 한다.
- enum 값은 runtime schema의 허용 값이어야 한다.
- payload에 적힌 artifact refs, task refs, debt refs는 존재해야 한다.
- 명령 인자와 payload frontmatter가 충돌하면 실패한다.
- 현재 stage/phase에서 허용되지 않는 기록이나 전이는 실패한다.
- 생성될 파일명이나 runtime id가 이미 존재하면 실패한다.

본문의 충분성, 결정의 타당성, 남길 debt의 의미, memory로 남길 가치, follow-up 필요성은 CLI가 판단하지 않는다. 그런 판단은 Evidence와 User Judgment 위에서 인간이 수행한다.

## Status

`geas status`는 read-only 명령이다. 파일을 생성하거나 state pointer를 갱신하지 않는다.

출력은 JSON이며 최소한 다음 정보를 포함한다.

- current run state
- current Mission pointer
- current Task pointer
- current Mission Spec path
- current Mission Design path
- current Task Contract path
- current Task Evidence path
- current Mission Evidence path
- current Task Judgment path
- current Mission Judgment path
- Debt Ledger path
- Memory paths

경로는 caller가 바로 `read_first`나 후속 명령 입력에 사용할 수 있는 runtime path로 반환한다.

## Init

`geas init`은 현재 repository에 `.geas/` runtime directory를 만든다.

초기화 시 생성되는 파일은 다음과 같다.

- empty run state
- empty Debt Ledger
- empty common Memory
- role Memory directory
- missions directory

이미 초기화된 repository에서 다시 실행하면 기존 runtime data를 덮어쓰지 않고 현재 상태를 보고한다.

## Mission Commands

### mission create

`geas mission create`는 새 Mission id를 배정하고 current Mission pointer를 만든다.

새 Mission은 runtime state에서 Mission Spec을 기다리는 상태로 시작한다. Mission id는 CLI가 배정하며 caller가 payload로 제공하지 않는다.

### mission spec record

`geas mission spec record --from <path|->`는 Mission Spec `.md` artifact를 기록한다.

Guard 조건은 다음과 같다.

- current Mission이 존재해야 한다.
- 현재 stage가 Mission Spec 기록을 받을 수 있는 위치여야 한다.
- payload는 Mission Spec 형식의 YAML frontmatter와 Markdown body여야 한다.
- `name` frontmatter가 있어야 한다.
- refs가 있으면 모두 존재해야 한다.
- 다음 `mission-spec-NNN.md` 파일명이 충돌하지 않아야 한다.

기록 후 current Mission Spec pointer는 새 파일을 가리킨다.

### mission design record

`geas mission design record --from <path|->`는 Mission Design `.md` artifact를 기록한다.

Guard 조건은 다음과 같다.

- current Mission이 존재해야 한다.
- current Mission Spec이 있어야 한다.
- payload는 Mission Design 형식의 YAML frontmatter와 Markdown body여야 한다.
- `name` frontmatter는 current Mission Spec의 `name`과 맞아야 한다.
- refs가 있으면 모두 존재해야 한다.
- 다음 `mission-design-NNN.md` 파일명이 충돌하지 않아야 한다.

기록 후 current Mission Design pointer는 새 파일을 가리킨다.

### mission transition

`geas mission transition --to <stage> [--task <task-id>]`는 명시적 선택이 필요한 Mission stage 이동을 수행한다.

자동으로 다음 위치가 명확한 기록은 record 명령이 state pointer를 함께 갱신한다. 반대로 재작업, 분기, 다음 Task 선택처럼 선택이 필요한 이동은 transition 명령으로 처리한다.

Mission transition은 다음을 검증한다.

- 요청한 stage가 runtime schema의 stage enum에 포함되어야 한다.
- 현재 stage에서 요청 stage로 이동할 수 있어야 한다.
- `--task`가 필요한 stage에서는 해당 Task Contract가 존재해야 한다.
- building stage로 이동할 때는 대상 Task의 dependency가 닫혀 있어야 한다.
- consolidating stage로 이동할 때는 current Mission에서 Task Contract가 기록된 Task들이 필요한 Task Evidence와 User Judgment를 갖고 있어야 한다.

## Task Commands

### task contract record

`geas task contract record --task <task-id> --from <path|->`는 Task Contract `.md` artifact를 기록한다.

Guard 조건은 다음과 같다.

- current Mission과 current Mission Design이 있어야 한다.
- `--task`는 current Mission 안에서 충돌하지 않는 task id여야 한다.
- Task id, dependency, Task별 scope와 mission coverage는 Task Contract 기록으로 확정하며, CLI는 Mission Design에서 Task membership을 추론하지 않는다.
- payload frontmatter의 `task_id`는 `--task`와 같아야 한다.
- payload frontmatter의 `name`은 같은 Task의 기존 최신 Contract가 있으면 그 `name`과 맞아야 한다.
- dependency refs가 있으면 존재하는 Task를 가리켜야 하며 cycle을 만들지 않아야 한다.
- 다음 `task-contract-NNN.md` 파일명이 충돌하지 않아야 한다.

해당 Task의 state가 없으면 CLI는 unstarted Task State를 만든다. 이미 실행 중인 Task의 Contract를 새로 기록하려면 현재 phase가 재작업 가능한 위치여야 한다.

### task transition

`geas task transition --to <phase> --task <task-id>`는 명시적 선택이 필요한 Task phase 이동을 수행한다.

Task transition은 다음을 검증한다.

- `--task`가 current Mission 안에서 Task State와 current Task Contract를 가진 Task여야 한다.
- 요청한 phase가 runtime schema의 phase enum에 포함되어야 한다.
- 현재 phase에서 요청 phase로 이동할 수 있어야 한다.
- implementing으로 이동할 때는 current Task Contract가 있어야 한다.
- dependency가 닫히지 않은 Task는 implementing으로 이동할 수 없다.

자동으로 다음 위치가 명확한 evidence 기록은 transition 명령 없이 state pointer를 갱신한다.

## Evidence Commands

### task evidence record

`geas task evidence record --task <task-id> --kind <kind> --from <path|->`는 Task-scoped evidence `.md` artifact를 기록한다.

공통 Guard 조건은 다음과 같다.

- current Mission과 대상 Task State가 있어야 한다.
- 대상 Task의 current Task Contract가 있어야 한다.
- payload는 요청 kind에 맞는 `.md` artifact 형식이어야 한다.
- payload frontmatter의 `task_id`는 `--task`와 같아야 한다.
- payload frontmatter의 `evidence_type`은 `--kind`와 같아야 한다.
- payload refs는 존재하는 artifact를 가리켜야 한다.
- 현재 phase에서 해당 kind 기록이 허용되어야 한다.
- 생성될 evidence 파일명이 충돌하지 않아야 한다.

kind별 파일은 다음처럼 기록한다.

- `implementation`: `implementation-evidence-NNN.md`
- `verification`: `verification-evidence-NNN.md`
- `review`: `review-evidence-NNN.md`
- `challenger`: `challenger-evidence-NNN.md`
- `task`: `task-evidence.md`

Task Evidence는 accepted 또는 accepted_with_limits Task result User Judgment 이후에만 기록할 수 있다. Task Evidence는 여러 시도 기록이 아니라 해당 Task의 current result baseline이다.

### evidence-driven phase updates

흐름상 다음 위치가 명확한 기록은 evidence record 명령이 Task State를 함께 갱신한다.

- Implementation Evidence 기록 후 phase는 `verifying`이 된다.
- Verification Evidence의 verdict가 `passed`이면 phase는 `reviewing`이 된다.
- Verification Evidence의 verdict가 `changes_requested` 또는 `escalated`이면 phase는 `awaiting_user_judgment`가 된다.
- Review Evidence 기록 후 phase는 `awaiting_user_judgment`가 된다.
- Challenger Evidence 기록 후 phase는 `awaiting_user_judgment`가 된다.
- accepted 또는 accepted_with_limits Task Judgment 이후 Task Evidence를 기록하면 phase는 `closed`가 된다.

rework, skip, pause처럼 선택이 필요한 이동은 `geas task transition`으로 처리한다.

### mission evidence record

`geas mission evidence record --from <path|->`는 Mission Evidence `.md` artifact를 기록한다.

Guard 조건은 다음과 같다.

- current Mission stage가 `consolidating`이어야 한다.
- Mission result User Judgment가 `accepted` 또는 `accepted_with_limits`여야 한다.
- Mission Evidence가 아직 기록되지 않았어야 한다.
- payload는 Mission Evidence 형식의 YAML frontmatter와 Markdown body여야 한다.
- payload refs는 존재하는 artifact나 Debt item을 가리켜야 한다.
- `mission-evidence.md` 파일명이 충돌하지 않아야 한다.

기록 후 CLI는 `run-state.yaml`을 empty state로 정리한다. Mission Evidence는 Debt Ledger와 Memory 반영 이후의 최종 제출 근거다. CLI는 Mission Evidence가 모든 debt와 memory 후보를 의미적으로 빠짐없이 반영했는지 판단하지 않는다.

## Judgment Commands

### judgment record

`geas judgment record --target <target> --from <path|->`는 User Judgment `.md` artifact를 기록한다.

Task result 판단은 Task id가 필요하다.

```text
geas judgment record --target task-result --task <task-id> --from <path|->
```

Mission result 판단은 current Mission을 대상으로 한다.

```text
geas judgment record --target mission-result --from <path|->
```

Guard 조건은 다음과 같다.

- payload는 User Judgment 형식의 YAML frontmatter와 Markdown body여야 한다.
- payload frontmatter의 `judgment_type`은 `--target`과 같아야 한다.
- Task target에서는 payload frontmatter의 `task_id`가 `--task`와 같아야 한다.
- 판단 대상 Evidence가 현재 runtime pointer와 맞아야 한다.
- decision enum은 runtime schema의 허용 값이어야 한다.
- 다음 `user-judgment-result-NNN.md` 파일명이 충돌하지 않아야 한다.

기록 후 current User Judgment pointer는 새 파일을 가리킨다. 판단 결과에 따라 다음 자동 이동이 명확하지 않은 경우에는 transition 명령이 다음 위치를 선택한다.

## Debt Commands

### debt record

`geas debt record --from <path|->`는 단일 debt item YAML 문서를 받아 `.geas/debts.yaml`에 append한다.

Guard 조건은 다음과 같다.

- current Mission stage가 `consolidating`이어야 한다.
- Mission result User Judgment가 `accepted` 또는 `accepted_with_limits`여야 한다.
- Mission Evidence가 아직 기록되지 않았어야 한다.
- 입력 payload에는 `debt_id`가 없어야 한다.
- CLI가 다음 `DEBT-NNN` id를 배정한 뒤 전체 debt item schema가 유효해야 한다.
- payload refs는 존재하는 artifact나 User Judgment를 가리켜야 한다.

Debt는 Mission에 종속된 artifact가 아니라 project-level ledger 항목이다. Mission Evidence는 필요한 경우 Debt Ledger item id를 참조한다.

### debt update

`geas debt update --id <debt-id> --from <path|->`는 기존 Debt item에 partial YAML patch를 적용한다.

Guard 조건은 다음과 같다.

- current Mission stage가 `consolidating`이어야 한다.
- Mission result User Judgment가 `accepted` 또는 `accepted_with_limits`여야 한다.
- Mission Evidence가 아직 기록되지 않았어야 한다.
- `--id`가 Debt Ledger에 존재해야 한다.
- patch는 `debt_id`를 변경할 수 없다.
- patch merge 후 전체 debt item schema가 유효해야 한다.
- merge 결과가 `status: resolved`이면 `resolved_by_refs`가 비어 있으면 안 된다.
- patch refs는 존재하는 artifact나 User Judgment를 가리켜야 한다.

CLI는 debt를 남길 가치가 있는지, 해결되었다는 판단이 충분한지 평가하지 않는다. CLI는 schema와 refs, timing만 guard한다.

## Memory Commands

`geas memory record --scope <scope> --from <path|->`는 Memory YAML 문서를 기록한다.

Common Memory는 다음 명령으로 기록한다.

```text
geas memory record --scope common --from <path|->
```

Role Memory는 다음 명령으로 기록한다.

```text
geas memory record --scope role --role <role> --from <path|->
```

Guard 조건은 다음과 같다.

- current Mission stage가 `consolidating`이어야 한다.
- Mission result User Judgment가 `accepted` 또는 `accepted_with_limits`여야 한다.
- Mission Evidence가 아직 기록되지 않았어야 한다.
- `--scope role`에서는 `--role`이 있어야 한다.
- payload는 Memory item schema에 맞아야 한다.
- payload refs는 존재하는 artifact나 User Judgment를 가리켜야 한다.

Memory 기록은 Mission result User Judgment 이후, Mission Evidence 기록 전에 수행한다. CLI는 어떤 내용을 장기 memory로 남길 가치가 있는지 판단하지 않는다.

## Transaction Semantics

기록 명령은 artifact write와 state pointer update를 하나의 transaction으로 다룬다.

CLI는 기록 전에 다음을 확인한다.

- 현재 runtime state를 읽는다.
- 예상 stage/phase 조건을 확인한다.
- 입력 payload를 artifact-native 형식으로 parse한다.
- schema, refs, enum, filename/id 충돌을 확인한다.

CLI는 기록 중 다음을 보장한다.

- artifact 파일과 state pointer가 서로 다른 결과로 갈라지지 않는다.
- 실패 시 부분 기록을 남기지 않는다.
- 같은 filename이나 id를 두 번 배정하지 않는다.
- 성공 결과에는 생성 또는 갱신된 runtime path와 갱신된 state pointer를 반환한다.

명령은 사람이 읽는 설명 대신 기계가 읽을 수 있는 성공/실패 정보를 반환한다. 실패 응답은 최소한 실패 code, 실패 reason, 관련 path나 field를 포함한다.

## Baseline Paths

current baseline은 `.md` artifact를 기준으로 읽는다.

- `mission-spec-NNN.md`
- `mission-design-NNN.md`
- `task-contract-NNN.md`
- `user-judgment-result-NNN.md`
- `task-evidence.md`
- `mission-evidence.md`

Run State, Task State, Debt Ledger, Memory는 YAML runtime data로 유지한다. CLI는 readable artifact와 runtime data의 형식을 섞지 않는다.

## Boundary

CLI는 runtime의 구조적 일관성을 지키는 guard다. CLI가 할 수 있는 판단은 “이 입력이 현재 위치에서 기록 가능한가”까지다.

CLI가 하지 않는 일은 다음과 같다.

- Mission Spec, Mission Design, Task Contract의 내용 품질 판단
- Evidence의 검증 충분성 판단
- Review나 Challenger finding의 타당성 판단
- User Judgment 작성 또는 대체
- Debt와 Memory의 의미 판단
- agent verdict를 인간의 수용 판단으로 해석
- runtime 외부 문서나 구현 파일 수정

이 경계 때문에 CLI 명령은 작고 예측 가능해야 한다. 복잡한 판단은 artifact와 Evidence로 남기고, 인간의 검토와 수용 판단이 다음 흐름을 결정한다.
