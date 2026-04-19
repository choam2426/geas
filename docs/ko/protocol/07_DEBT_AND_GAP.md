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

Debt register의 정규 JSON artifact는 `debt-register.json`이고, exact 구조는 `debt-register.schema.json`이 관리한다.

Debt register는 최소한 다음을 붙든다.

- debt의 `scope`
- 각 debt item의 `severity`, `kind`, `title`, `description`
- 현재 `status`
- 필요하면 `introduced_by_task_id`, `owner_type`, `target_phase`

### debt를 올리는 기준

- 지금 닫더라도 다음 phase나 다음 mission에서 다시 다뤄야 한다.
- 품질, 구조, 위험, 운영, 문서, 검증 공백 중 하나로 설명된다.
- 단순한 취향 차이가 아니라 실제 비용을 만든다.

## Gap Assessment

Gap assessment의 정규 JSON artifact는 `gap-assessment.json`이고, exact 구조는 `gap-assessment.schema.json`이 관리한다.

Gap assessment는 scope와 delivery 사이의 차이를 정리한다.

| 필드 | 의미 |
|---|---|
| `scope_in_summary` | 하기로 한 일의 요약 |
| `scope_out_summary` | 하지 않기로 한 일의 요약 |
| `fully_delivered` | 그대로 전달된 항목 |
| `partially_delivered` | 일부만 전달된 항목 |
| `not_delivered` | 전달되지 않은 항목 |
| `intentional_cuts` | 의도적으로 잘라 낸 항목 |
| `unexpected_additions` | 계획에 없었지만 추가된 항목 |
| `recommended_followups` | 다음 작업 제안 |

## 입력과 확정의 구분

Task evidence는 debt candidate와 gap signal을 남길 수 있다. 하지만 그것이 곧 공식 debt register나 공식 gap assessment는 아니다.

- task는 신호를 올린다
- mission 종결 단계가 공식 항목으로 채택할지 판단한다
- final verdict는 공식 debt register와 gap assessment를 기준으로 읽는다

## Final Verdict와의 연결

Mission final verdict는 debt와 gap을 함께 본다.

- 큰 debt가 남아도 승인할 수는 있다. 다만 왜 수용하는지 설명되어야 한다.
- gap이 남아 있는데 승인한다면, 그것이 intentional cut인지 미전달인지 분명해야 한다.
- 다음 작업으로 넘길 follow-up은 gap assessment와 debt register 어느 쪽에서 왔는지 드러나야 한다.

Debt와 gap을 정리하지 않은 채 final verdict로 넘어가면, 승인 의미가 흐려진다.
