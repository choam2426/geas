# 07. Debt and Gap

> GEAS의 debt register와 gap assessment를 정의한다. Task에서 올라오는 debt/gap 입력은 doc 03이 owner고, 공식 누적과 미션 수준 판단은 이 문서가 owner다.

## 목적

Debt와 gap은 비슷해 보여도 다르다. Debt는 남겨 두기로 한 부담이고, gap은 약속한 범위와 실제 전달 사이의 차이다. 이 문서는 둘을 분리해서 기록하고 final verdict에 연결하는 방식을 다룬다.

## Debt와 Gap의 차이

| 개념 | 질문 |
|---|---|
| debt | 무엇을 감수하고 남겨 두는가 |
| gap | 무엇을 못 했거나 덜 했거나 다르게 했는가 |

둘을 섞으면 final verdict가 흐려진다. 전달 부족을 debt처럼 포장해서는 안 되고, 의도적으로 수용한 debt를 미전달처럼 처리해서도 안 된다.

## Debt Register

Debt register의 정규 JSON artifact는 `debt-register.json`이고, 정확한 구조는 `debt-register.schema.json`이 관리한다.

Debt register는 mission-level 누적 목록이다. 각 debt item은 다음을 담는다.

- `debt_id` — 안정적 식별자
- `severity` (low/normal/high/critical)
- `kind` (output_quality/verification_gap/structural/risk/process/documentation/operations)
- `title`, `description`
- `status` (open/resolved/dropped)
- 필요하면 `introduced_by_task_id`, `target_phase`

### debt를 올리는 기준

- 지금 종결하더라도 다음 phase나 다음 mission에서 다시 다뤄야 한다.
- 품질, 구조, 위험, 운영, 문서, 검증 공백 중 하나로 설명된다.
- 단순한 취향 차이가 아니라 실제 비용을 만든다.

## Gap Assessment

Gap assessment의 정규 JSON artifact는 `gap-assessment.json`이고, 정확한 구조는 `gap-assessment.schema.json`이 관리한다.

Gap assessment는 scope와 delivery 사이의 차이를 정리한다. Scope 요약은 mission spec 원문이 아니라 "실행 후 실제로 반영된 scope"를 서술한다. 실행 중 scope가 drift했다면 그 drift가 여기 드러난다.

| 필드 | 의미 |
|---|---|
| `scope_in_summary` | 실제로 범위에 들어온 일의 요약 |
| `scope_out_summary` | 실제로 범위 밖으로 남긴 일의 요약 |
| `fully_delivered` | 그대로 전달된 항목 |
| `partially_delivered` | 일부만 전달된 항목 |
| `not_delivered` | 전달되지 않은 항목 |
| `intentional_cuts` | 의도적으로 잘라 낸 항목 |
| `unexpected_additions` | 계획에 없었지만 추가된 항목 |

후속 작업 제안은 gap assessment가 아니라 debt register가 owner다. gap에서 발견된 미전달 항목 중 이어 가야 할 것은 debt 항목으로 등록한다.

## 입력과 확정의 구분

Task evidence는 debt candidate와 gap signal을 남길 수 있다. 하지만 그것이 곧 공식 debt register나 공식 gap assessment는 아니다.

- task는 신호를 올린다
- consolidating phase가 공식 항목으로 채택할지 판단한다
- final verdict는 공식 debt register와 gap assessment를 기준으로 읽는다

## Final Verdict와의 연결

Mission final verdict는 debt와 gap을 함께 본다.

- 큰 debt가 남아도 승인할 수는 있다. 다만 왜 수용하는지 설명되어야 한다.
- gap이 남아 있는데 승인한다면, 그것이 intentional cut인지 미전달인지 분명해야 한다.
- 다음 작업으로 넘길 follow-up은 debt register에 등록되어 있어야 한다. gap assessment의 미전달 항목도 이어 갈 만큼의 가치가 있다면 debt 항목으로 승격해야 한다.

Debt와 gap을 정리하지 않은 채 final verdict로 넘어가면, 승인 의미가 흐려진다.
