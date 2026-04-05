# 09. Memory Retrieval and Context Engine

> **기준 문서.**
> 이 문서는 Geas가 memory를 검색하고, context packet을 조립하며, 부실하거나 적대적인 context를 방어하고, 제한된 context budget 하에서 출처(provenance)를 보존하는 방법을 정의한다.

## 목적

Retrieval 및 context 엔진은 **가장 많은** context가 아니라 **적절한** context를 전달하기 위해 존재한다. 좋은 context engineering -- 의사결정 품질을 극대화하도록 정보를 선택, 정렬, 제시하는 규율 -- 이 이 문서의 핵심이다. 모델을 압도하거나 부실한 가정을 끌어들이지 않으면서, 에이전트가 중요한 것을 기억하도록 도와야 한다.

## Context Engineering

Context engineering은 각 에이전트 상호작용의 정보 환경을 의도적으로 구성하는 실천이다. 가용한 모든 정보를 프롬프트에 쏟아 넣는 대신, context engineering은 이렇게 묻는다: 이 에이전트가 지금 무엇을 알아야 하는가, 어떤 순서로, 어떤 신뢰 수준으로?

Retrieval 및 context 엔진은 Geas에서 context engineering이 구현되는 주요 메커니즘이다. 이 문서의 모든 설계 선택 -- 우선순위 band, scoring, budget, staleness 규칙 -- 은 최적의 context 조립이라는 목표를 위한 것이다.

## Threat Model

Context 엔진은 의사결정 품질을 위협하는 다음 요소를 고려해야 한다:

| 위협 | 설명 |
|---|---|
| 부실 memory | 한때 유효했으나 현재 상황을 더 이상 반영하지 않는 교훈 |
| 모순 memory | 상충하는 지침을 제공하는 복수의 memory item |
| 저가치 context 비대화 | 핵심 정보에 대한 주의를 희석하는 과도한 context |
| 오해를 유발하는 저장소 텍스트 | 부정확하거나 오래된 주장이 담긴 저장소 콘텐츠 |
| 오래된 요약 | 실질적 변경 이전에 작성된 세션 또는 task 요약 |
| 적대적 도구 출력 | 오해를 유발하는 정보나 prompt injection을 포함한 도구 출력 |
| 우발적 prompt injection | 노트, 문서, memory 텍스트에 내장된 지시사항 |
| Contract 충돌 memory | 현재 task의 명시적 제약과 모순되는 memory |
| Positional attention decay | LLM이 긴 context 중간에 위치한 정보를 시작·끝 부분에 비해 과소평가할 수 있음 |

## Retrieval Inputs

Context 조립 요청 시 memory item을 선택하고 채점할 때 다음 입력을 고려해야 한다:

- 현재 mission phase
- 현재 task 메타데이터
- 영향받는 경로 또는 surface
- Reviewer 슬롯 또는 worker 슬롯
- 현재 mission mode
- 최근 실패 또는 debt
- 마지막 safe boundary 또는 recovery context
- 관련 규칙
- 관련 memory 항목

## Retrieval Priority Bands

Context는 네 개의 우선순위 band로 구성된다. Budget이 제한되면 상위 band를 보존하고 하위 band를 희생한다. 이 순서가 context 엔진의 가장 중요한 구조적 보장이다.

| Band | 이름 | 내용 |
|---|---|---|
| **L0** | Pinned invariants | 기본 안전/무결성 규칙, 현재 task acceptance criteria, 현재 승인된 implementation contract, 명시적 phase 제약, 활성 정책 오버라이드 또는 위험 제어 |
| **L1** | Task-local packet | Worker self-check, 최근 specialist review, 현재 실패 또는 debt 노트, task-focus 요약 |
| **L2** | Applicable memory | Scope, 관련성, freshness, confidence로 선택된 재사용 가능한 교훈 |
| **L3** | Drill-down references | 심층 조사가 필요할 때 요청에 따라 가져오는 낮은 우선순위 보조 context |

## Memory Packet Structure

Memory packet은 모델이 신뢰 수준을 추론하게 만들지 말고 다음 정보를 명시해야 한다:

| 요소 | 용도 |
|---|---|
| 포함 항목 | 이 packet에 포함된 memory item 목록 |
| 선택 근거 | 각 item이 선택된 이유 |
| Item state | 각 item의 현재 lifecycle state |
| 뒷받침 evidence | 각 item을 뒷받침하는 evidence |
| 모순 여부 | 알려진 모순의 존재 여부 |
| 조립 시점 | packet이 조립된 시간 |

## Retrieval Scoring Heuristic

프로젝트가 다른 공식을 구현할 수 있으나, retrieval 엔진은 최소한 다음 scoring 차원을 고려해야 한다. 동작이 이해 가능하고 감사 가능하다면 단순한 heuristic도 무방하다.

| 차원 | 설명 |
|---|---|
| Scope match | Memory의 선언된 scope가 현재 context와 얼마나 일치하는지 |
| Path overlap | Memory가 같은 surface나 인터페이스에 적용되는지 |
| Role match | Memory가 해당 에이전트 슬롯과 관련되는지 |
| Mission-phase 관련성 | Memory가 현재 phase에 적용되는지 |
| Recency / freshness | Memory가 생성, review, 또는 재확인된 시점이 얼마나 최근인지 |
| Confidence | Memory의 신뢰 점수 |
| Contradiction penalty | 알려진 모순이 있는 item에 대한 감점 |
| Harmful-reuse penalty | 부정적 적용 이력이 기록된 item에 대한 감점 |

## Scope Match Calculation

권장 해석:

- 정확한 task 또는 mission 일치가 project 일치보다, project 일치가 global 일치보다 높은 점수를 받는다.

넓은 scope가 좁고 현재적인 context를 밀어내서는 안 된다. Global 교훈은 task-specific 교훈에 비해 정밀한 관련성이 낮을 가능성이 높다.

## Path Overlap Calculation

동일한 surface나 인접 인터페이스에 연결된 memory item은 같은 넓은 도메인에만 연결된 것보다 높은 점수를 받아야 한다. 예를 들어, 특정 API 엔드포인트에 대한 교훈은 해당 엔드포인트를 수정하는 task에서 일반적인 API 설계 교훈보다 관련성이 높다.

## Freshness Calculation

Packet builder는 다음에 해당하는 item을 할인해야 한다:

- 재확인 없이 `review_after`를 경과한 것
- 최근 모순이 발생한 것
- 더 새로운 item으로 superseded된 것
- 더 이상 존재하지 않거나 실질적으로 변경된 경로나 surface에 연결된 것

## Slot-Specific Budgets

에이전트 슬롯마다 필요한 context 프로파일이 다르다. 프로젝트는 이 차이를 반영하는 대략적 budget을 설정해야 한다.

| 소비자 슬롯 | 일반적 budget 우선순위 |
|---|---|
| Orchestrator | 넓은 계획 context, phase 제약, recovery 상태 |
| Specialist reviewer | 역할 관련 memory와 task-local evidence에 집중 |
| Decision Maker | Closure 스토리, 미해결 위험, scope 대 가치, debt 및 gap context |

정확한 토큰 budget은 구현에 따라 다르지만, 순서 규율은 구현과 무관하다. Budget이 빠듯하면 각 슬롯의 최하위 우선순위 콘텐츠부터 제거한다.

## Context Assembly Algorithm

프로토콜을 준수하는 packet builder는 다음 조립 순서를 따라야 한다:

1. L0 invariant 로드 (budget 압박에도 제거 불가)
2. 현재 task-local context 로드 (L1)
3. Candidate memory를 retrieval 차원에 따라 채점
4. 명시적 요청이 없는 한 stale, superseded, 또는 under-review item 제외
5. Budget 내에서 최고 가치의 applicable memory 포함 (L2)

Budget이 허용하면, packet builder는 높은 우선순위 항목(L0, L1)을 조립된 context의 시작과 끝에 배치해야 한다. 긴 context의 중간에만 배치된 정보는 모델의 주의를 덜 받을 수 있다.

6. Retrieval 메타데이터 또는 출처 요약 첨부
7. Packet이 이후 결정에 영향을 미칠 경우 runtime state에 packet 참조 저장

### Memory state retrieval 적격성

모든 memory state가 context packet 검색 대상이 되는 것은 아니다.

| state | 적격 | 근거 |
|---|---|---|
| `provisional` | 예 | 최근 승격됨, 사용 가능 |
| `stable` | 예 | 재사용을 통해 검증됨 |
| `canonical` | 예 | 최고 confidence |
| `candidate` | 아니오 | 미승격, 미검증 |
| `under_review` | 아니오 | 신뢰 일시 중단 |
| `superseded` | 아니오 | 더 새로운 item으로 대체됨 |
| `decayed` | 아니오 | confidence가 임계값 이하로 저하됨 |
| `archived` | 아니오 | 이력 보존용이며 활성 사용 대상 아님 |

Retrieval 엔진은 조사나 감사 목적으로 명시적 요청이 있을 때 제외 state item을 포함할 수 있으나, 표준 context 조립에는 포함해서는 안 된다.

### Agent memory 주입

에이전트를 위한 context packet 조립 시, `.geas/memory/agents/{agent_type}.md`가 존재하면 그 내용을 포함해야 한다. L2 (applicable memory) 우선순위로 주입된다.

Agent memory는 retrieval heuristic으로 점수를 매기지 않는다 — 해당 에이전트 타입에 대해 무조건 포함된다. Orchestrator가 검수한 역할별 지침이기 때문이다. Agent memory 파일은 일반적으로 작으므로 budget 압박 시에도 보존해야 한다.

## Packet Versioning

Context packet은 다음의 실질적 변경보다 이전에 생성되었는지 판단할 수 있도록 암시적 또는 명시적으로 버전을 관리해야 한다:

- Task contract
- Workspace baseline
- Review 상태
- Memory 상태
- Policy override

## Packet Staleness Rules

다음 중 어느 하나라도 packet 생성 이후 발생하면 해당 packet은 stale로 처리해야 한다:

| 조건 | 무효화 이유 |
|---|---|
| Task contract 수정 | Acceptance criteria나 제약이 변경되었을 수 있음 |
| Workspace baseline의 실질적 변경 | 작업 상태가 더 이상 packet의 가정과 일치하지 않음 |
| 필수 review가 추가되거나 변경됨 | 새 review 요건에 다른 context가 필요할 수 있음 |
| 참조된 memory가 superseded 또는 under review로 전환 | Packet이 더 이상 신뢰되지 않는 지침을 포함하게 됨 |
| Mission phase가 우선순위에 영향을 주는 방식으로 변경 | 우선순위 band를 재조정해야 할 수 있음 |
| Recovery 이벤트가 이전 가정을 무효화 | 이전 context가 무효 상태에 기반할 수 있음 |

## Stale Packet Regeneration Rules

Packet이 stale이 되면:

- 다음 주요 소비자가 packet을 재생성해야 한다
- 런타임은 재생성 발생 사실을 기록해야 한다
- Stale packet은 final verdict 제출에 재사용해서는 안 된다

## Summaries

사람이 읽을 수 있는 요약은 방향 파악에 중요하지만, 정규(canonical) 현재 artifact보다 신뢰 수준이 낮다.

권장 요약:

| 요약 | 용도 |
|---|---|
| `session-latest.md` | 복구 및 방향 파악을 위한 현재 세션 상태 |
| `task-focus/<task-id>.md` | 상호작용 간 밀도 높은 task-local carry-forward |
| `mission-summary.md` | Phase 전환을 위한 mission 수준 개요 |

요약은 방향 파악을 돕는 것이다. 정규 artifact를 대체해서는 안 된다.

## Injection and Trust Hygiene

저장소 콘텐츠, 이전 요약, memory 텍스트, 도구 출력은 분류 전까지 모두 **신뢰할 수 없는 입력**이다. 이 원칙은 안전한 context engineering의 근본이다.

Context 엔진은 다음 위생 규칙을 적용해야 한다:

| 규칙 | 근거 |
|---|---|
| Memory가 현재 task의 명시적 제약을 무시해서는 안 된다 | 현재 contract가 과거 교훈보다 우선한다 |
| 감사되지 않은 산문보다 artifact 기반 사실을 우선한다 | 검증된 evidence가 서술적 주장보다 신뢰할 수 있다 |
| 인용된 비신뢰 콘텐츠를 시스템 지침과 격리한다 | 사용자 제공 텍스트의 우발적 승격을 방지한다 |
| 저장소 파일의 지시사항은 정책이 승격하지 않는 한 데이터로 취급한다 | 저장소 콘텐츠에 prompt injection 시도가 있을 수 있다 |
| 자신감 있게 표현되었다는 이유만으로 memory item을 승격하지 않는다 | 표현의 confidence가 evidentiary strength과 동일하지 않다 |

## Anti-Forgetting Guarantee

프로토콜을 준수하는 구현은 관련 시점에서 다음이 활성 context에서 사라지지 않도록 보장해야 한다:

- 현재 acceptance criteria
- 현재 contract 및 non-goal
- 현재 blocker
- 현재 알려진 위험
- 현재 활성 정책 제약
- 출하에 중요한 현재 debt 또는 scope 주의사항

이 항목들은 L0 (pinned invariants)에 속하며 모든 budget 압축에서도 반드시 생존해야 한다.

## Relationship to Budget

Budget이 빠듯할 때, 시스템은 현재 task invariant를 제거하기 전에 낮은 우선순위 memory부터 제거해야 한다. 우선순위 band 순서(L0 > L1 > L2 > L3)가 지배 규칙이다. Band 내에서는 scoring이 어떤 item이 생존할지 결정한다.

## 핵심 선언

좋은 context engineering은 프롬프트에 더 많은 텍스트를 쏟아 넣는 것이 아니다. 출처를 보존하고, 현재 contract를 보호하며, 다음 결정을 실제로 개선할 수 있는 context만 로드하는 것이다.
