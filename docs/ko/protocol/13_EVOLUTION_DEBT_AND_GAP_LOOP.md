# 13. Evolution, Debt, and Gap Loop

> **기준 문서.**
> 이 문서는 retrospective loop, debt 모델, gap assessment, mission 간 학습 메커니즘을 정의하며, 이를 통해 Geas가 시간이 지남에 따라 운영 역량을 축적하게 한다.

## 목적

Evolution은 Geas를 단순한 gating workflow 이상으로 만드는 핵심이다. 이 문서는 아래 질문에 답한다:

- task 또는 mission 이후 팀이 무엇을 배워야 하는가
- 타협이 잊히지 않고 어떻게 추적되는가
- 약속한 scope와 전달된 scope의 차이를 어떻게 비교하는가
- 유해한 패턴이 어떻게 더 나은 미래 행동으로 변환되는가

## Per-Task Retrospective Loop

모든 `passed` task 이후, 프로젝트는 retrospective 또는 retrospective 기여를 생성해야 한다. Retrospective는 task 중 발생한 것을 포착하여 이후 task가 그 경험으로부터 혜택을 받게 한다.

### Minimum retrospective topics

각 retrospective는 최소한 아래 영역을 다루어야 한다:

| topic | 포착 대상 |
|---|---|
| `what_went_well[]` | 좋은 결과를 낸 실천, 도구, 결정 |
| `what_broke[]` | failure, regression, 예상치 못한 문제 |
| `what_was_surprising[]` | 틀린 것으로 판명된 가정, 예상치 못한 복잡성 |
| `rule_candidates[]` | 반복 문제를 방지할 행동 변화 |
| `memory_candidates[]` | 미래 context를 위해 보존할 가치가 있는 교훈 |
| `debt_candidates[]` | 명시적 추적이 필요한 타협 |
| `next_time_guidance[]` | 다음 유사 task를 위한 구체적 조언 |

Retrospective는 구체적이어야 한다. "더 조심해야 함"은 너무 약하다. "Rate limit 없는 Auth endpoint가 challenge review에서 계속 실패함"은 유용하다.

## Retrospective to Rule Update

Retrospective에서 반복 문제가 발견되면, 프로젝트는 해당 패턴을 enforcement 가능한 rule로 변환하는 것을 고려해야 한다.

### When a rule candidate is justified

Rule candidate는 특히 아래 경우에 정당화된다:

- 동일 failure가 반복될 때
- 동일 reviewer concern이 반복될 때
- 동일 recovery 실수가 반복될 때
- 동일 scope-control drift가 반복될 때
- 명확한 behavior change가 문제를 방지했을 때

### Rule approval expectations

Rule은 아래를 갖추어야 한다:

| 요건 | 목적 |
|---|---|
| 뒷받침하는 evidence | 문제가 실재하고 반복됨을 증명 |
| 명확한 behavior 영향 | rule로 인해 무엇이 변하는지 명시 |
| 소유자 | enforcement에 책임 있는 주체 |
| 범위 명시 | rule이 어디에, 언제 적용되는지 |
| enforcement 계획 | rule이 어떻게 표면화되거나 검사되는지 |

### Behavior-change requirement

Rule은 그것으로 인해 무엇이 변할지 프로젝트가 설명할 수 있을 때까지 완성되지 않는다. 예:

- 더 엄격한 contract checklist
- review checklist 추가
- gate focus 변경
- scheduler caution
- packet-builder pinning

## Agent Memory Feedback Loop

Role 특화 교훈은 agent memory가 되어야 한다. Cross-role 교훈은 project memory 또는 rules가 되어야 한다.

### Role-specific lesson criteria

교훈이 주로 아래와 관련될 때 role-specific이다:

- 해당 slot이 주로 사용하는 tool 또는 technique
- 해당 slot이 주로 생산하는 artifact
- 해당 slot의 반복적 review blind spot
- 해당 slot의 반복적 도메인 특화 성공 패턴

## Debt Tracking Model

Debt는 수용된 타협의 명시적 장부다. 모든 프로젝트는 debt를 축적하며, 프로토콜은 debt가 숨기거나 잊히지 않고 가시적이며, 소유되고, 추적되도록 요구한다.

### Debt sources

Debt는 타협이 식별되는 pipeline의 어느 지점에서든 발생할 수 있다:

| 출처 | 예시 |
|---|---|
| worker self-check | "X에 대한 우회 방안을 구현함; 적절한 해결책은 Y가 필요" |
| specialist review | reviewer가 수용되었으나 지금 수정하지 않는 concern을 표시 |
| integration result | integration은 성공하나 알려진 제한 사항이 도입됨 |
| gate finding | evidence gate가 noted caveat과 함께 통과 |
| final verdict note | Decision Maker가 조건부로 수용 |
| retrospective | task 후 회고에서 취한 shortcut 식별 |
| gap assessment | scope 비교에서 전이된 risk 발견 |
| policy override follow-up | override가 향후 remediation 의무를 생성 |

### Minimum debt fields

각 debt item은 최소한 아래 필드를 포함해야 한다:

| 필드 | 설명 |
|---|---|
| `debt_id` | 고유 식별자 |
| `severity` | `critical`, `high`, `normal`, `low` |
| `kind` | debt 범주 (아래 참조) |
| `title` | 짧은 사람이 읽을 수 있는 요약 |
| `description` | 타협의 상세 설명 |
| `introduced_by_task_id` | 이 debt를 생성한 task |
| `owner_type` | 해결 책임이 있는 slot 또는 팀 |
| `status` | 현재 lifecycle 상태 |
| target timing 또는 phase | 해결이 예상되는 시점 |

Debt kind는 타협의 성격을 분류한다:

| kind | 의미 |
|---|---|
| `output_quality` | 일시적으로 수용된 결과물의 품질 문제 |
| `verification_gap` | 누락되거나 불충분한 검증 coverage |
| `structural` | 향후 수정이 필요한 설계 또는 architecture 결정 |
| `risk` | 나중으로 미룬 알려진 security, safety, trust concern |
| `process` | 시간 압박 하에 취한 workflow 또는 프로세스 shortcut |
| `documentation` | 누락되거나 오래된 문서 |
| `operations` | 나중으로 미룬 운영 준비 gap |

### Recommended debt statuses

| status | 의미 |
|---|---|
| `open` | 식별되었으나 아직 triage되지 않음 |
| `accepted` | triage되어 실재하는 debt로 인정됨 |
| `scheduled` | 특정 미래 task 또는 phase에 배정됨 |
| `resolved` | evidence와 함께 해결됨 |
| `dropped` | 더 이상 관련 없는 것으로 판단됨 |

## Debt Action Rules

- `critical` debt는 관련 phase exit 전에 반드시 triage되어야 한다
- `high` debt는 근거 없이 delivery readiness를 통과해서는 안 된다
- accepted debt도 소유자와 review cadence를 가져야 한다
- resolved debt는 해결한 task 또는 evidence를 참조해야 한다
- dropped debt는 더 이상 중요하지 않은 이유를 설명해야 한다

팀은 debt를 unknown blocker의 은신처로 사용해서는 안 된다.

## Scheduled-to-Resolved Transition

Debt item은 아래 경우에만 `resolved`가 된다:

- 해당 debt를 명시적으로 대상으로 하는 task가 `passed`에 도달했을 때
- 또는 동등한 evidence가 원래 concern이 더 이상 유효하지 않음을 증명할 때

"아마 수정됨"은 resolution이 아니다.

## Gap Assessment

Gap assessment는 약속된 것과 실제 전달된 것을 비교하여, scope 정직성을 프로토콜의 핵심 관심사로 만든다.

- `scope_in` — 약속된 것
- `scope_out` — 전달되고 입증된 것

### When to perform it

Gap assessment는 아래 시점에 수행되어야 한다:

- phase 경계에서
- mission 종료 시
- 의미 있는 re-scope 이후
- lightweight 모드 shortcut 또는 hotfix 작업 이후

### Minimum questions

각 gap assessment는 최소한 아래 질문을 다루어야 한다:

| 질문 | 드러나는 것 |
|---|---|
| 약속했으나 전달되지 않은 것은 무엇인가? | under-delivery 또는 이연된 scope |
| 전달되었으나 원래 약속하지 않은 것은 무엇인가? | scope creep 또는 기회적 개선 |
| 위험, 비용, 유지보수성에서 무엇이 변했는가? | 숨겨진 비용 전이 |
| 어떤 미래 작업이 이제 암시되는가? | 하류 의무 |
| 무엇이 debt, memory, 또는 새 mission input이 되어야 하는가? | carry-forward 행동 |

## Gap Interpretation Rules

모든 gap이 실패는 아니다. Assessment는 gap을 단순 나열이 아니라 분류해야 한다.

| 해석 | 의미 |
|---|---|
| **under-delivery** | 약속한 scope 미달 |
| **over-delivery** | 사전 승인 없이 추가 작업 수행 |
| **risk transfer** | 핵심 기능은 전달되었으나 숨겨진 비용이 debt로 이전 |
| **learning gain** | 원래 계획이 잘못되었고 변경이 현실을 개선했기 때문에 scope가 변경됨 |

## Initiative Evolving Phase

Evolving phase는 mission이 배운 것을 통합하기 위해 존재한다. Mission의 마지막 phase로서, 교훈, debt, gap이 유실되지 않고 처리되도록 보장한다.

일반적인 evolving 작업은 아래를 포함한다:

- memory promotion 및 review
- rules update
- debt rollup
- gap analysis
- mission summary
- carry-forward backlog 구성

Evolving phase는 non-trivial 작업에서 생략되어서는 안 된다.

## Evolving Phase Exit Gate

Mission은 아래 조건이 충족될 때까지 깔끔하게 종료되어서는 안 된다:

- gap assessment 존재
- retrospective bundle 존재
- debt snapshot 존재
- 승인된 rules 또는 memory 변경이 기록됨
- mission summary 존재

## Harmful Reuse Feedback Loop

팀이 이전 가이던스로 인한 반복적 유해 패턴을 발견했을 때:

1. 관련된 memory 또는 rule을 식별한다
2. 필요 시 memory를 review로 이동한다
3. 필요 시 rule을 업데이트한다
4. 부정적 패턴을 명시적으로 기록한다
5. 미래 packet이 잘못된 가이던스 전파를 중단하는지 검증한다

유해한 가이던스를 rollback 없이 계속 재사용하는 시스템은 진화하고 있는 것이 아니다.

## Mission-to-Mission Carry Forward

Evolution output은 아래를 통해 다음 mission에 영향을 미쳐야 한다:

- task template
- rules
- memory packet
- debt 우선순위
- reviewer focus

Mission 종료는 따라서 끝이 아니다; handoff다.

## Key Statement

프로토콜은 학습 loop만큼만 강하다. Debt는 타협을 가시화하고, gap assessment는 scope를 정직하게 만들며, retrospective는 반복되는 고통을 더 나은 미래 기본값으로 변환한다.
