# 08. Debt and Gap

> **기준 문서.**
> 이 문서는 약속한 scope와 실제 전달 scope를 일치시키기 위해 사용하는 debt 추적 모델과 gap assessment loop를 정의한다.

## 목적

Debt와 gap 추적은 타협을 가시화하고 scope를 정직하게 만든다. 이 문서는 다음 질문에 답한다:

- 수용된 타협을 어떻게 등록하고, 소유하고, 추적하는가
- 약속한 scope와 실제 전달 scope를 어떻게 비교하는가
- debt 심각도에 따라 어떤 조치가 요구되는가
- gap을 단순히 나열하지 않고 어떻게 분류하는가

## Debt Tracking Model

Debt는 수용된 타협을 명시적으로 기록하는 장부다. 모든 프로젝트는 debt를 축적하며, 프로토콜은 debt가 숨겨지거나 잊히지 않고 가시적으로 관리되도록 요구한다.

### Debt 발생 출처

Debt는 타협이 식별되는 pipeline의 어느 지점에서든 발생할 수 있다:

| 출처 | 예시 |
|---|---|
| worker self-check | "X에 대한 우회 방안을 구현함; 적절한 해결에는 Y가 필요" |
| specialist review | reviewer가 수용되었으나 당장 수정하지 않는 concern을 표시 |
| integration result | integration은 성공하나 알려진 제한 사항 도입 |
| gate finding | evidence gate가 caveat을 달고 통과 |
| final verdict note | Decision Maker가 조건부 수용 |
| retrospective | task 후 회고에서 취한 shortcut 식별 |
| gap assessment | scope 비교에서 전이된 risk 발견 |
| policy override follow-up | override가 향후 remediation 의무 생성 |

### Minimum debt fields

각 debt item은 최소한 아래 필드를 포함해야 한다:

| 필드 | 설명 |
|---|---|
| `debt_id` | 고유 식별자 |
| `severity` | `critical`, `high`, `normal`, `low` |
| `kind` | debt 범주 (아래 참조) |
| `title` | 짧고 읽기 쉬운 요약 |
| `description` | 타협의 상세 설명 |
| `introduced_by_task_id` | 이 debt를 생성한 task |
| `owner_type` | 해결 책임이 있는 slot 또는 팀 |
| `status` | 현재 lifecycle 상태 |
| target timing 또는 phase | 해결 예상 시점 |

Debt kind는 타협의 성격을 분류한다:

| kind | 의미 |
|---|---|
| `output_quality` | 일시적으로 수용된 결과물 품질 문제 |
| `verification_gap` | 누락되거나 불충분한 검증 coverage |
| `structural` | 향후 수정이 필요한 설계 또는 architecture 결정 |
| `risk` | 나중으로 미룬 security, safety, trust concern |
| `process` | 시간 압박 하에 취한 workflow 또는 프로세스 shortcut |
| `documentation` | 누락되거나 오래된 문서 |
| `operations` | 나중으로 미룬 운영 준비 gap |

### Recommended debt statuses

| status | 의미 |
|---|---|
| `open` | 식별되었으나 아직 triage 전 |
| `accepted` | triage 후 실재하는 debt로 인정 |
| `scheduled` | 특정 미래 task 또는 phase에 배정 |
| `resolved` | evidence와 함께 해결 |
| `dropped` | 더 이상 관련 없다고 판단 |

## Debt Action Rules

- `critical` debt는 관련 phase exit 전에 반드시 triage해야 한다
- `high` debt는 근거 없이 delivery readiness를 통과해서는 안 된다
- accepted debt도 소유자와 review 주기를 가져야 한다
- resolved debt는 해결한 task 또는 evidence를 참조해야 한다
- dropped debt는 더 이상 중요하지 않은 이유를 설명해야 한다

팀은 debt를 unknown blocker의 은신처로 사용해서는 안 된다.

## Scheduled-to-Resolved Transition

Debt item이 `resolved`가 되려면:

- 해당 debt를 명시적으로 대상으로 하는 task가 `passed`에 도달하거나
- 동등한 evidence가 원래 concern이 더 이상 유효하지 않음을 증명해야 한다

"아마 수정됨"은 resolution이 아니다.

## Gap Assessment

Gap assessment는 약속한 것과 실제 전달한 것을 비교하여, scope 정직성을 프로토콜의 핵심 관심사로 만든다.

- `scope_in` — 약속한 것
- `scope_out` — 전달하고 입증한 것

### 수행 시점

Gap assessment는 다음 시점에 수행해야 한다:

- phase 경계
- mission 종료
- 의미 있는 re-scope 이후
- lightweight 모드 shortcut 또는 hotfix 작업 이후

### 최소 질문

각 gap assessment는 최소한 다음 질문을 다루어야 한다:

| 질문 | 드러나는 것 |
|---|---|
| 약속했으나 전달하지 못한 것은? | under-delivery 또는 이연된 scope |
| 원래 약속하지 않았으나 전달한 것은? | scope creep 또는 기회적 개선 |
| 위험, 비용, 유지보수성에서 달라진 것은? | 숨겨진 비용 전이 |
| 이제 암시되는 후속 작업은? | 하류 의무 |
| debt, memory, 또는 새 mission input이 되어야 할 것은? | carry-forward 대상 |

## Gap Interpretation Rules

모든 gap이 실패는 아니다. Assessment는 gap을 단순히 나열하지 않고 분류해야 한다.

| 해석 | 의미 |
|---|---|
| **under-delivery** | 약속한 scope 미달 |
| **over-delivery** | 사전 승인 없이 추가 작업 수행 |
| **risk transfer** | 핵심 기능은 전달되었으나 숨겨진 비용이 debt로 이전 |
| **learning gain** | 원래 계획이 잘못되었고, 변경이 현실을 개선했기에 scope가 달라짐 |

## Initiative Evolving Phase

Evolving phase는 mission이 축적한 교훈을 통합하기 위해 존재한다. Mission의 마지막 phase로서, 교훈, debt, gap이 유실되지 않고 처리되도록 보장한다.

일반적인 evolving 작업:

- rules.md 및 agent 노트에 대한 memory 추출
- rules update
- debt rollup
- gap analysis
- mission summary
- carry-forward backlog 구성

Non-trivial 작업에서 evolving phase를 생략해서는 안 된다.

## Evolving Phase Exit Gate

Mission은 아래 조건이 충족될 때까지 정상 종료할 수 없다:

- gap assessment 존재
- retrospective bundle 존재
- debt snapshot 존재
- 승인된 rules 또는 memory 변경이 기록됨
- mission summary 존재

## 핵심 선언

Debt는 타협을 가시화하고, gap assessment는 scope를 정직하게 만든다. 두 메커니즘이 함께 작동하여 프로젝트가 수용한 것과 실제 전달한 것이 명확하게 드러나고, 소유되고, 조용히 잊히지 않고 앞으로 이어지게 한다.
