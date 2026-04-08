# 11. Evolution, Debt, and Gap Loop

> **기준 문서.**
> 이 문서는 retrospective loop, debt 모델, gap assessment, mission 간 학습 메커니즘을 정의한다. 이를 통해 Geas는 시간이 지남에 따라 운영 역량을 축적한다.

## 목적

Evolution은 Geas를 단순한 gating workflow 이상으로 만드는 핵심이다. 이 문서는 다음 질문에 답한다:

- task 또는 mission 완료 후 팀이 무엇을 배워야 하는가
- 타협을 어떻게 잊지 않고 추적하는가
- 약속한 scope와 실제 전달 scope를 어떻게 비교하는가
- 유해한 패턴을 어떻게 더 나은 미래 행동으로 전환하는가

## Per-Task Retrospective Loop

모든 `passed` task 이후, 프로젝트는 retrospective 또는 retrospective 기여를 생성해야 한다. Retrospective는 task 수행 중 발생한 일을 기록하여 이후 task가 그 경험을 활용하게 한다.

### Minimum retrospective topics

각 retrospective는 최소한 아래 영역을 다루어야 한다:

| topic | 기록 대상 |
|---|---|
| `what_went_well[]` | 좋은 결과를 낸 실천, 도구, 결정 |
| `what_broke[]` | failure, regression, 예상치 못한 문제 |
| `what_was_surprising[]` | 틀린 것으로 판명된 가정, 예상치 못한 복잡성 |
| `rule_candidates[]` | 반복 문제를 방지할 행동 변화 |
| `memory_candidates[]` | 미래 context를 위해 보존할 가치가 있는 교훈 |
| `debt_candidates[]` | 명시적 추적이 필요한 타협 |
| `next_time_guidance[]` | 다음 유사 task를 위한 구체적 조언 |

Retrospective는 구체적이어야 한다. "더 조심해야 함"은 너무 약하다. "Rate limit 없는 Auth endpoint가 challenge review에서 계속 실패함"이 유용하다.

## Retrospective to Rule Update

Retrospective에서 반복 문제가 드러나면, 해당 패턴을 enforcement 가능한 rule로 변환하는 것을 검토해야 한다.

### Rule candidate가 정당화되는 경우

Rule candidate는 특히 다음 상황에서 정당화된다:

- 동일 failure가 반복될 때
- 동일 reviewer concern이 반복될 때
- 동일 recovery 실수가 반복될 때
- 동일 scope-control drift가 반복될 때
- 명확한 행동 변화가 문제를 방지했을 때

### Rule 승인 요건

Rule은 다음을 갖추어야 한다:

| 요건 | 목적 |
|---|---|
| 뒷받침하는 evidence | 문제가 실재하고 반복됨을 증명 |
| 명확한 행동 영향 | rule로 인해 무엇이 달라지는지 명시 |
| 소유자 | enforcement 책임 주체 |
| 범위 명시 | rule의 적용 대상과 시점 |
| enforcement 계획 | rule을 어떻게 표면화하고 검사할 것인지 |

### Behavior-change requirement

Rule은 그로 인해 무엇이 달라지는지 프로젝트가 설명할 수 있어야 완성된다. 예:

- 더 엄격한 contract checklist
- review checklist 항목 추가
- gate focus 변경
- scheduler caution
- packet-builder pinning

## Agent Memory Feedback Loop

Role 특화 교훈은 agent memory가 되어야 한다. Cross-role 교훈은 project memory 또는 rules가 되어야 한다.

### Role-specific lesson 기준

교훈이 주로 다음과 관련될 때 role-specific이다:

- 해당 slot이 주로 사용하는 tool 또는 technique
- 해당 slot이 주로 생산하는 artifact
- 해당 slot의 반복적 review blind spot
- 해당 slot의 반복적 도메인 특화 성공 패턴

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

## Harmful Reuse Feedback Loop

팀이 이전 가이던스로 인한 반복적 유해 패턴을 발견했을 때:

1. 관련된 memory 또는 rule을 식별한다
2. 필요 시 해당 memory를 review 상태로 전환한다
3. 필요 시 rule을 업데이트한다
4. 부정적 패턴을 명시적으로 기록한다
5. 이후 packet이 잘못된 가이던스를 전파하지 않는지 검증한다

유해한 가이던스를 rollback 없이 계속 재사용하는 시스템은 진화하지 않는 것이다.

## Mission-to-Mission Carry Forward

Evolution output은 다음을 통해 다음 mission에 영향을 미쳐야 한다:

- task template
- rules
- rules.md 및 agent memory
- debt 우선순위
- reviewer focus

Mission 종료는 끝이 아니라 handoff다.

## 핵심 선언

프로토콜은 학습 loop만큼만 강하다. Debt는 타협을 가시화하고, gap assessment는 scope를 정직하게 만들며, retrospective는 반복되는 고통을 더 나은 미래 기본값으로 변환한다.
