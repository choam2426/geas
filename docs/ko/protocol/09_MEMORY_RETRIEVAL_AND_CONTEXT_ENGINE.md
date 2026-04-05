# 09. Memory Retrieval and Context Engine

> **기준 문서.**
> 이 문서는 Geas가 memory를 검색하고, context packet을 조립하며, 부실하거나 적대적인 context로부터 보호하고, 제한된 context 예산 하에서 출처(provenance)를 보존하는 방법을 정의한다.

## 목적

retrieval 및 context 엔진은 **가장 많은** context가 아니라 **적절한** context를 전달하기 위해 존재한다. 좋은 context engineering -- 의사결정 품질을 극대화하기 위해 정보를 선택, 정렬, 제시하는 규율 -- 이 이 문서의 핵심 관심사이다. 모델을 압도하거나 부실한 가정을 가져오지 않으면서 에이전트가 중요한 것을 기억하도록 도와야 한다.

## Context Engineering

Context engineering은 각 에이전트 상호작용을 위한 정보 환경을 의도적으로 구성하는 실천이다. 사용 가능한 모든 정보를 프롬프트에 채워 넣는 대신, context engineering은 다음을 묻는다: 이 에이전트가 지금 무엇을 알아야 하는가, 어떤 순서로, 어떤 신뢰 수준으로?

retrieval 및 context 엔진은 Geas에서 context engineering이 구현되는 주요 메커니즘이다. 이 문서의 모든 설계 선택 -- 우선순위 band, scoring, 예산, 부실 규칙 -- 은 최적의 context 조립이라는 목표에 기여한다.

## Threat Model

context 엔진은 의사결정 품질에 대한 다음 위협을 고려해야 한다:

| 위협 | 설명 |
|---|---|
| 부실 memory | 한때 유효했으나 현재 상황을 더 이상 반영하지 않는 교훈 |
| 모순 memory | 상충하는 지침을 제공하는 다수의 memory 항목 |
| 저가치 context 비대화 | 핵심 정보에 대한 주의를 희석하는 과도한 context |
| 오해를 유발하는 저장소 텍스트 | 부정확하거나 오래된 주장을 담은 저장소 콘텐츠 |
| 오래된 요약 | 실질적 변경 이전에 작성된 세션 또는 task 요약 |
| 적대적 도구 출력 | 오해를 유발하는 정보나 prompt injection을 포함한 도구 출력 |
| 우발적 prompt injection | 노트, 문서, memory 텍스트에 내장된 지시사항 |
| Contract 충돌 memory | 현재 task의 명시적 제약과 모순되는 memory |
| positional attention decay | LLM이 긴 context의 중간에 위치한 정보를 시작과 끝 부분에 비해 과소평가할 수 있음 |

## Retrieval Inputs

context 조립 요청은 memory 항목을 선택하고 채점할 때 다음 입력을 고려해야 한다:

- 현재 mission phase
- 현재 task 메타데이터
- 영향받는 경로 또는 surface
- Reviewer 슬롯 또는 worker 슬롯
- 현재 미션 모드
- 최근 실패 또는 debt
- 마지막 safe boundary 또는 recovery context
- 관련 규칙
- 관련 memory 항목

## Retrieval Priority Bands

context는 네 개의 우선순위 band로 구성된다. 예산이 제한될 때 상위 band가 하위 band를 희생하여 보존된다. 이 순서는 context 엔진의 가장 중요한 구조적 보장이다.

| Band | 이름 | 내용 |
|---|---|---|
| **L0** | Pinned invariants | 기본 안전/무결성 규칙, 현재 task acceptance criteria, 현재 승인된 implementation contract, 명시적 phase 제약, 활성 정책 오버라이드 또는 위험 제어 |
| **L1** | Task-local packet | Worker self-check, 최근 specialist review, 현재 실패 또는 debt 노트, task-focus 요약 |
| **L2** | Applicable memory | Scope, 관련성, freshness, confidence로 선택된 재사용 가능한 교훈 |
| **L3** | Drill-down references | 심층 조사가 필요할 때 요청에 따라 가져오는 낮은 우선순위 보조 context |

## Memory Packet Structure

memory packet은 모델이 신뢰를 추론하게 강요하지 않고 다음 정보를 명시해야 한다:

| 요소 | 용도 |
|---|---|
| 포함 항목 | 이 packet에 어떤 memory 항목이 포함되었는지 |
| 선택 근거 | 각 항목이 선택된 이유 |
| 항목 state | 각 항목의 현재 lifecycle state |
| 뒷받침 evidence | 각 항목을 뒷받침하는 evidence |
| 모순 여부 | 알려진 모순이 존재하는지 |
| 조립 시점 | packet이 조립된 시간 |

## Retrieval Scoring Heuristic

프로젝트는 다른 공식을 구현할 수 있지만, retrieval 엔진은 최소한 다음 scoring 차원을 고려해야 한다. 동작이 이해 가능하고 감사 가능한 한 단순한 heuristic을 사용할 수 있다.

| 차원 | 설명 |
|---|---|
| Scope match | memory의 선언된 scope가 현재 context와 얼마나 잘 일치하는지 |
| Path overlap | memory가 같은 surface나 인터페이스에 적용되는지 |
| Role match | memory가 소비하는 에이전트 슬롯에 관련되는지 |
| Mission-phase 관련성 | memory가 현재 phase에 적용되는지 |
| Recency / freshness | memory가 생성, review, 또는 재확인된 시점이 얼마나 최근인지 |
| Confidence | memory의 신뢰 점수 |
| Contradiction penalty | 알려진 모순이 있는 항목에 대한 감점 |
| Harmful-reuse penalty | 기록된 부정적 적용 결과가 있는 항목에 대한 감점 |

## Scope Match Calculation

권장 해석:

- 정확한 task 또는 mission 일치가 project 일치보다, project 일치가 global 일치보다 높은 점수를 받는다.

넓은 scope가 좁고 현재의 context를 밀어내서는 안 된다. global 교훈은 task-specific 교훈보다 정확한 관련성이 낮을 가능성이 높다.

## Path Overlap Calculation

동일한 surface나 인접 인터페이스에 연결된 memory 항목은 같은 넓은 도메인에만 연결된 것보다 높은 점수를 받아야 한다. 예를 들어, 특정 API 엔드포인트에 대한 교훈은 해당 엔드포인트를 수정하는 task에 일반적인 API 설계 교훈보다 더 관련성이 높다.

## Freshness Calculation

packet 빌더는 다음 항목에 할인을 적용해야 한다:

- 재확인 없이 `review_after`를 경과한 것
- 최근 모순이 발생한 것
- 더 새로운 항목으로 superseded된 것
- 더 이상 존재하지 않거나 실질적으로 변경된 경로나 surface에 연결된 것

## Slot-Specific Budgets

에이전트 슬롯마다 필요한 context 프로파일이 다르다. 프로젝트는 이 차이를 반영하는 대략적인 예산을 설정해야 한다.

| 소비자 슬롯 | 일반적 예산 우선순위 |
|---|---|
| Orchestrator | 넓은 계획 context, phase 제약, recovery 상태 |
| Specialist reviewer | 좁은 역할 관련 memory와 task-local evidence |
| Decision Maker | Closure 스토리, 미해결 위험, scope 대 가치, debt 및 gap context |

정확한 토큰 예산은 구현에 따라 다르지만, 순서 규율은 구현에 좌우되지 않는다. 예산이 빠듯할 때 각 슬롯의 가장 낮은 우선순위 콘텐츠가 먼저 제거된다.

## Context Assembly Algorithm

프로토콜을 준수하는 packet 빌더는 다음 조립 순서를 따라야 한다:

1. L0 invariant 로드 (예산 압박에도 제거하지 않음)
2. 현재 task-local context 로드 (L1)
3. Candidate memory를 retrieval 차원에 따라 채점
4. 명시적 요청이 없는 한 부실, superseded, 또는 under-review 항목 제외
5. 예산 내에서 최고 가치의 적용 가능한 memory 포함 (L2)

예산이 허용하면, packet 빌더는 높은 우선순위 항목(L0, L1)을 조립된 context의 시작과 끝에 배치해야 한다. 긴 context의 중간에만 배치된 정보는 모델의 주의를 덜 받을 수 있다.

6. Retrieval 메타데이터 또는 출처 요약 첨부
7. Packet이 이후 결정에 영향을 미칠 경우 runtime state에 packet 참조 저장

### Memory state retrieval 적격성

모든 memory state가 context packet으로 검색될 수 있는 것은 아니다.

| state | 적격 | 근거 |
|---|---|---|
| `provisional` | 예 | 최근 승격됨, 사용 가능 |
| `stable` | 예 | 재사용을 통해 검증됨 |
| `canonical` | 예 | 최고 신뢰도 |
| `candidate` | 아니오 | 아직 승격되지 않음; 미검증 |
| `under_review` | 아니오 | 신뢰 일시 중단 |
| `superseded` | 아니오 | 더 새로운 항목으로 대체됨 |
| `decayed` | 아니오 | confidence가 임계값 이하로 저하됨 |
| `archived` | 아니오 | 이력 보존용이며 활성 사용 대상 아님 |

retrieval 엔진은 조사나 감사를 위해 명시적으로 요청된 경우 제외 state 항목을 포함할 수 있지만, 표준 context 조립에는 포함해서는 안 된다.

### Agent memory 주입

에이전트를 위한 context packet을 조립할 때, `.geas/memory/agents/{agent_type}.md`가 존재하면 그 내용을 포함해야 한다. L2 (applicable memory) 우선순위로 주입된다.

Agent memory는 retrieval heuristic으로 점수를 매기지 않는다 — 해당 에이전트 타입에 대해 무조건 포함된다. Orchestrator가 검수한 역할별 지침이기 때문이다. Agent memory 파일은 일반적으로 작으므로 budget 압박 시에도 보존해야 한다.

## Packet Versioning

context packet은 시스템이 packet이 다음의 실질적 변경보다 이전인지 판단할 수 있도록 암시적 또는 명시적으로 버전을 관리해야 한다:

- Task contract
- Workspace baseline
- Review 상태
- Memory 상태
- Policy override

## Packet Staleness Rules

다음 중 어느 하나라도 packet 생성 이후 발생하면 packet은 부실(stale)로 처리해야 한다:

| 조건 | 무효화 이유 |
|---|---|
| Task contract 수정됨 | Acceptance criteria나 제약이 변경됐을 수 있음 |
| Workspace baseline이 실질적으로 변경됨 | 작업 상태가 더 이상 packet 가정과 일치하지 않음 |
| 필수 review가 추가되거나 변경됨 | 새 review 요건에 다른 context가 필요할 수 있음 |
| 참조된 memory가 superseded 또는 under review가 됨 | Packet이 더 이상 신뢰되지 않는 지침을 포함 |
| Mission phase가 우선순위에 영향을 주는 방식으로 변경됨 | 우선순위 band를 재조정해야 할 수 있음 |
| Recovery 이벤트가 이전 가정을 무효화함 | 이전 context가 유효하지 않은 상태에 기반할 수 있음 |

## Stale Packet Regeneration Rules

packet이 부실해지면:

- 다음 주요 소비자가 packet을 재생성해야 한다
- 런타임은 재생성이 발생했음을 기록해야 한다
- 부실 packet은 final verdict 제출에 재사용해서는 안 된다

## Summaries

사람이 읽을 수 있는 요약은 방향 설정에 중요하지만, 정규(canonical) 현재 artifact보다 신뢰 수준이 낮다.

| 요약 | 용도 |
|---|---|
| `session-latest.md` | 복구 및 방향 설정을 위한 현재 세션 상태 |
| `task-focus/<task-id>.md` | 상호작용 간 밀도 높은 task 로컬 carry-forward |
| `mission-summary.md` | Phase 전환을 위한 mission 수준 개요 |

요약은 방향 설정을 도와야 한다. 정규 artifact를 무시해서는 안 된다.

## Injection and Trust Hygiene

저장소 콘텐츠, 이전 요약, memory 텍스트, 도구 출력은 분류되기 전까지 모두 **신뢰할 수 없는 입력**이다. 이 원칙은 안전한 context engineering의 근본이다.

context 엔진은 다음 위생 규칙을 적용해야 한다:

| 규칙 | 근거 |
|---|---|
| Memory가 명시적 현재 task 제약을 무시하지 않아야 함 | 현재 contract가 과거 교훈보다 우선 |
| 감사되지 않은 산문보다 artifact 기반 사실을 선호 | 검증된 evidence가 서술적 주장보다 더 신뢰할 수 있음 |
| 인용된 신뢰할 수 없는 콘텐츠를 시스템 지침과 격리 | 사용자 제공 텍스트의 우발적 승격 방지 |
| 저장소 파일의 지시사항을 정책이 승격하지 않는 한 데이터로 취급 | 저장소 콘텐츠에 prompt injection 시도가 있을 수 있음 |
| 자신 있게 표현되었다는 이유로 memory 항목을 승격하지 않음 | 표현의 confidence가 evidentiary strength과 같지 않음 |

## Anti-Forgetting Guarantee

프로토콜을 준수하는 구현은 관련 시 다음이 활성 context에서 사라질 수 없음을 보장해야 한다:

- 현재 acceptance criteria
- 현재 contract 및 non-goal
- 현재 blocker
- 현재 알려진 위험
- 현재 활성 정책 제약
- 출하에 중요한 현재 debt 또는 scope 주의사항

이 항목들은 L0 (pinned invariants)에 속하며 모든 예산 압축에서도 생존해야 한다.

## Relationship to Budget

예산이 빠듯할 때, 시스템은 현재 task invariant를 제거하기 전에 낮은 우선순위 memory를 먼저 제거해야 한다. 우선순위 band 순서 (L0 > L1 > L2 > L3)가 지배 규칙이다. band 내에서는 scoring이 어떤 항목이 생존할지 결정한다.

## 핵심 문장

좋은 context engineering은 프롬프트에 더 많은 텍스트를 채워 넣는 것이 아니다. 출처를 보존하고, 현재 contract를 보호하며, 다음 결정을 실제로 개선할 수 있는 context만 로드하는 것이다.
