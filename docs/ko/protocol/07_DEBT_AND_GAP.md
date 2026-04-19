# 07. Debt and Gap

> GEAS의 debts와 gap artifact를 정의한다. Task에서 올라오는 debt/gap 입력은 doc 03이 owner이고, 공식 누적과 미션 수준 판단은 이 문서가 owner다.

## 목적

Debt와 gap은 비슷해 보여도 다르다. 둘을 분리해서 기록하고 final verdict에 연결하는 방식이 이 문서의 내용이다.

| 개념 | 질문 | 예 |
|---|---|---|
| debt | 무엇을 감수하고 남겨 두는가 | "auth 모듈 리팩터는 이번 mission에서 하지 않고 다음으로 넘긴다" |
| gap | 무엇을 못 했거나 덜 했거나 다르게 했는가 | "spec에 있던 X 기능 중 Y만 전달됐다" |

두 방향의 혼동을 막아야 한다. 전달 부족을 debt로 포장하지도, 수용한 debt를 미전달로 처리하지도 않는다.

## Debts

정규 JSON artifact는 `.geas/missions/{mission_id}/consolidation/debts.json`이고, 정확한 구조는 `debts.schema.json`이 관리한다. Consolidating phase에서 Orchestrator가 작성한다. 모든 task의 evidence에 남은 `debt_candidates`와 이전 mission에서 넘어온 open debt를 함께 보고 공식 등록 여부를 판단한다.

이 목록은 이번 mission의 consolidating phase가 공식 등록한 debt 항목을 담는다. 이전 mission에서 open 상태로 넘어온 carry-forward debt도 여기에 포함될 수 있다. 각 item은 다음을 담는다.

- `debt_id` — 안정적 식별자
- `severity` — low/normal/high/critical
- `kind` — schema enum 중 하나
- `title`, `description`
- `status` — open/resolved/dropped
- 필요하면 `introduced_by_task_id`, `target_phase`

### debt를 올리는 기준

- 지금 종결하더라도 다음 phase나 다음 mission에서 다시 다뤄야 한다.
- `kind` 중 하나로 분명히 설명된다 (단순 "개선하고 싶음"은 debt가 아니다).
- 단순한 취향 차이가 아니라 실제 비용을 만든다.

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
