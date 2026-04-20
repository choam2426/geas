# 07. Debt and Gap

> Geas의 debts와 gap artifact를 정의한다. Task에서 올라오는 debt/gap 입력은 doc 03이 owner이고, 공식 누적과 미션 수준 판단은 이 문서가 owner다.

## 목적

Debt와 gap은 비슷해 보여도 다르다. 둘을 분리해서 기록하고 final verdict에 연결하는 방식이 이 문서의 내용이다.

| 개념 | 질문 | 예 |
|---|---|---|
| debt | 무엇을 감수하고 남겨 두는가 | "auth 모듈 리팩터는 이번 mission에서 하지 않고 다음으로 넘긴다" |
| gap | 무엇을 못 했거나 덜 했거나 다르게 했는가 | "spec에 있던 X 기능 중 Y만 전달됐다" |

두 방향의 혼동을 막아야 한다. 전달 부족을 debt로 포장하지도, 수용한 debt를 미전달로 처리하지도 않는다.

## Debts

정규 JSON artifact는 `.geas/debts.json`이고, 정확한 구조는 `debts.schema.json`이 관리한다. Debts는 **프로젝트 레벨 ledger**다. 특정 mission에 속하지 않고 프로젝트 생애 전반에 걸쳐 유지되며, 각 entry가 자기 origin mission과 resolution mission을 스스로 참조한다.

Orchestrator는 consolidating phase에서 이 ledger를 갱신한다 — 이번 mission의 task evidence에 남은 `debt_candidates`를 검토해 신규 debt를 register하고, 이번 mission에서 해소하거나 버린 기존 open debt의 status를 update한다. Ledger 자체는 consolidating 밖에서도 읽을 수 있다. "프로젝트에 지금 어떤 open debt이 있는가"는 이 파일 한 번 조회로 답한다.

각 entry는 다음 필드를 고정한다.

| 필드 | 의미 |
|---|---|
| `debt_id` | 안정적 식별자 (`^debt-[0-9]{3}$`) |
| `severity` | low / normal / high / critical |
| `kind` | schema enum 중 하나 |
| `title`, `description` | 사람이 읽는 제목과 서술 |
| `status` | open / resolved / dropped |
| `introduced_by` | `{mission_id, task_id}` — 이 debt가 처음 관측된 mission과 task |
| `resolved_by` | `{mission_id, task_id}` — status를 resolved나 dropped로 바꾼 시점의 mission과 task. status가 open이면 null |
| `resolution_rationale` | status 변경의 근거 서술. 해결 근거가 된 task, evidence, 맥락을 담는다. status가 open이면 null |

### debt를 올리는 기준

- 지금 종결하더라도 다음 phase나 다음 mission에서 다시 다뤄야 한다.
- `kind` 중 하나로 분명히 설명된다 (단순 "개선하고 싶음"은 debt가 아니다).
- 단순한 취향 차이가 아니라 실제 비용을 만든다.

### status 전환 규칙

- 신규 debt는 `debt register`로 `status: open`으로 ledger에 append한다.
- Mission이 어떤 open debt을 해소했다고 판단하면 `status: resolved`, 더 이상 debt로 다룰 가치가 없다고 판단하면 `status: dropped`로 `debt update-status`를 호출하고 `resolved_by`와 `resolution_rationale`을 채운다.
- Ledger 자체는 단일 파일이므로 한 debt의 상태 이력은 그 entry의 현재 status로만 표현된다. 과거 상태 변천 기록이 필요하면 `events.jsonl`에서 해당 `debt_id`를 조회한다.

## Gap

정규 JSON artifact는 `.geas/missions/{mission_id}/consolidation/gap.json`이고, 정확한 구조는 `gap.schema.json`이 관리한다. Consolidating phase에서 Design Authority가 scope closure 판단의 산출물로 작성한다.

Gap은 scope와 delivery 사이의 차이를 정리한다. Scope 요약은 mission spec 원문이 아니라 "실행 후 실제로 반영된 scope"를 서술한다. 실행 중 scope가 drift했다면 그 drift가 여기 드러난다.

| 필드 | 의미 |
|---|---|
| `scope_in_summary` | 실제로 범위에 들어온 일의 요약 |
| `scope_out_summary` | 실제로 범위 밖으로 남긴 일의 요약 |
| `fully_delivered` | 그대로 전달된 항목 |
| `partially_delivered` | 일부만 전달된 항목 |
| `not_delivered` | 전달되지 않은 항목. 의도적 cut 여부는 항목 서술에 인라인으로 표시한다 (예: "X (의도적 cut: 시간 부족)") |
| `unexpected_additions` | 계획에 없었지만 추가된 항목 |

### debt와 gap의 관계

gap은 실행 후 관찰된 scope 대 delivery 차이를 정리하는 기록이고, debt는 그 중 미래 작업으로 이어가기로 결정한 항목을 공식 등록하는 기록이다. 같은 현상이 gap과 debt에 동시에 나타날 수 있다. gap은 "무엇이 일어났는가"를, debt는 "무엇을 이어갈 것인가"를 답한다.

debt kind `verification_gap`은 검증 자체를 완료하지 못한 공백을 의미하며, scope 안에 있었지만 검증 절차를 끝내지 못한 경우 등록한다. gap의 `partially_delivered`는 scope 중 일부만 달성된 항목을 가리키며 검증 완료 여부와는 무관하다. 한 항목이 "일부만 전달됐고 그마저도 검증을 못 했다"면 gap의 `partially_delivered`와 debt의 `verification_gap`에 각각 기록된다.

## 입력과 확정의 구분

Task evidence는 debt candidate와 gap signal을 남길 수 있다. 하지만 그것이 곧 공식 debts나 gap artifact는 아니다.

- 각 task의 evidence를 쓰는 agent가 신호를 올린다
- consolidating phase가 공식 항목으로 채택할지 판단한다
- final verdict는 공식 debts와 gap을 기준으로 읽는다

## Final Verdict와의 연결

Mission final verdict는 debt와 gap을 함께 본다.

- 큰 debt가 남아도 승인할 수는 있다. 다만 왜 수용하는지 설명되어야 한다.
- gap이 남아 있는데 승인한다면, 그것이 intentional cut인지 미전달인지 분명해야 한다.
- 다음 작업으로 넘길 follow-up은 debts가 owner다. gap의 미전달 항목 중 이어 갈 만큼의 가치가 있다면 debt 항목으로 승격한다.

Debt와 gap을 정리하지 않은 채 final verdict로 넘어가면, 승인 의미가 흐려진다.
