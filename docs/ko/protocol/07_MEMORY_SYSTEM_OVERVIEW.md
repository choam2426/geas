# 07. Memory System Overview

> **기준 문서.**
> 이 문서는 Geas에서 memory의 목적, 범위, 수용 기준, confidence 모델, 행동적 역할을 정의한다.

## 목적

Geas memory는 노트를 축적하기 위한 것이 아니라 미래 행동을 변경하기 위해 존재한다. Memory 시스템은 저장된 교훈이 미래의 task 실행, review 품질, recovery, scope 제어를 실질적으로 개선할 수 있을 때만 준수한 것으로 간주된다.

핵심 목표:

| 목표 | 설명 |
|---|---|
| 재발 방지 | 동일한 실패가 반복되는 것을 차단 |
| 성공 재사용 | 검증된 성공 패턴을 새로운 작업에 적용 |
| recovery 가속 | 보존된 맥락을 활용하여 중단 후 안전하게 재개 |
| review 개선 | 이력 기반 통찰로 reviewer focus 향상 |
| 노이즈 감소 | 선별적 retrieval로 낭비적 context stuffing 제거 |
| 지식 보존 | 운영 지식을 stale lore로 만들지 않고 보존 |

## 핵심 원칙

### 1) Memory는 진화한다

어떤 memory item도 진실로 태어나지 않는다. Item은 state를 거쳐 진행하며, evidence와 재사용을 통해 내구성을 획득해야 한다. 새로 추출된 교훈은 실제로 검증되기 전까지 최소한의 권위만 가진다.

### 2) Memory는 evidence 없이 약해진다

충분한 evidence, 성공적 재사용, review 지원이 없는 memory item은 강한 지침으로 취급해서는 안 된다. 지지하는 evidence가 부재하거나 반박되면 신뢰가 감소한다.

### 3) Memory는 scope를 가진다

모든 memory item은 어디에 적용되는지 선언해야 한다. Scope는 신뢰성의 일부다. 한 프로젝트 맥락에서 학습한 교훈이 명시적 검증 없이 다른 맥락에 안전하게 전이된다는 보장은 없다.

### 4) Memory는 budget 내에서 context에 진입한다

Memory retrieval은 선별적이어야 한다. Packet builder는 양보다 관련성, 출처, 최신성을 기준으로 최적화해야 한다. 관련성이 낮은 memory로 context를 과부하시키면 의사결정 품질이 오히려 저하된다.

### 5) Memory는 사용 후 재평가된다

성공적 또는 해로운 적용은 confidence와 state 변경에 피드백되어야 한다. 적용 후 좋은 결과를 낳은 memory는 신뢰를 획득하고, 해로운 결과를 낳은 memory는 신뢰를 잃는다.

### 6) Memory는 행동 surface에 연결되어야 한다

아무것도 변경하지 않는 memory item은 비기능적이다. Memory는 다음 surface 중 최소 하나에 영향을 미쳐야 한다:

| 행동 surface | 영향 예시 |
|---|---|
| rules | `.geas/rules.md`의 신규 또는 갱신 항목 |
| packet content | context packet에의 우선 포함 |
| reviewer focus | checklist 항목 추가 또는 리뷰 강조 |
| gate strictness | evidence 임계값 강화 또는 완화 |
| scheduling caution | 알려진 위험한 병렬 조합 회피 |
| recovery heuristics | recovery 의사결정 개선 |

## Memory Layer Model

Memory 시스템은 정보를 논리적 layer로 구성한다. 각 layer는 서로 다른 시간적, 맥락적 목적을 가진다. 프로젝트는 더 적은 물리적 store를 구현할 수 있지만, layer 간의 semantic 구분은 보존해야 한다.

| layer | 주요 용도 | 일반적 수명 |
|---|---|---|
| `session_memory` | 현재 세션의 전술적 연속성 | 단일 세션 |
| `task_focus_memory` | 밀도 있는 task-local carry-forward | 단일 task |
| `mission_memory` | 현재 mission에 관련된 교훈 | 단일 mission |
| `episodic_memory` | 특정 incident 또는 실행의 이력 | 중기 |
| `project_memory` | 내구적 project 전체 패턴 | 장기 |
| `agent_memory` | 역할별 지침 | 장기 |
| `risk_memory` | 반복적 위험 또는 민감한 surface에 연결된 패턴 | 장기 |

## Memory Scope

모든 memory item은 적용 범위와 행동에 얼마나 넓게 영향을 미칠 수 있는지를 제어하는 scope를 선언한다. 넓은 scope일수록 강한 정당화가 필요하다.

| scope | 적용 대상 | 정당화 수준 |
|---|---|---|
| `task` | 단일 task | 최소 -- 직접 관찰이면 충분 |
| `mission` | 현재 mission | 보통 -- 패턴이 task 간에 반복되어야 함 |
| `project` | 전체 project | 강함 -- 패턴이 내구적이고 project 전체에 해당 |
| `agent` | 특정 에이전트 역할 | 강함 -- 역할 특화되고 검증됨 |
| `global` | 모든 project | 매우 강함 -- 드물며 광범위한 evidence 필요 |

규칙:

- `global` scope는 드물어야 한다.
- Memory가 단순히 기억에 남았다는 이유만으로 더 넓은 scope로 승격되어서는 안 된다.

## Memory 수용 기준

모든 관찰이 memory item이 될 자격이 있는 것은 아니다. 수용 기준은 memory 시스템이 노이즈로 채워지는 것을 방지한다.

Memory candidate는 다음 질문 전부에 답할 수 있을 때만 시스템에 진입해야 한다:

| 질문 | 목적 |
|---|---|
| 무엇이 일어났는가? | 사실적 근거를 확립 |
| 어떤 evidence가 이 교훈을 지지하는가? | 근거 없는 주장을 방지 |
| 어떤 surface에 적용되는가? | 실행 가능성을 보장 |
| 미래 행동을 어떻게 변경해야 하는가? | 운영적 가치를 확인 |
| 무엇이 이것을 반증하거나 약화시키는가? | 미래 재평가를 가능하게 함 |

다음에 해당하는 candidate는 거부되거나 약하게 유지되어야 한다:

- 일반적 동기 부여 조언
- artifact에 의해 지지되지 않음
- 최근의 더 강한 evidence에 의해 반박됨
- 운영적 결과가 없는 일회성 스타일 선호

## Confidence Scoring Model

Confidence는 시스템이 memory item에 부여하는 신뢰 수준을 정량화한다. Evidence 수에서 도출되며 재사용 결과에 따라 변동한다.

### 초기 confidence

| evidence 참조 수 | 초기 confidence |
|---|---|
| 1 | `0.4` |
| 2 | `0.6` |
| 3 이상 | `0.8` |

### Modifier

| 이벤트 | confidence 변화 |
|---|---|
| 성공적 재사용 | `+0.1` |
| 실패한 재사용 | `-0.1` |
| 반박 | `-0.2` |

### 범위

Confidence는 `0.0`(최소)에서 `1.0`(최대) 사이로 제한된다.

### 규칙

- Confidence가 `0.3` 미만으로 떨어지면 review가 촉발되어야 한다.
- Confidence만으로 state 또는 freshness 규칙을 무시해서는 안 된다.
- Stale이지만 high-confidence인 memory도 여전히 재평가가 필요하다.

## 최신성과 Review-After

Memory item은 재검토 시점을 알리는 `review_after` 날짜를 가진다. 이 날짜가 지난 memory는 강하게 재사용하기 전에 재검토해야 한다.

| memory 상태 | 기본 review 주기 |
|---|---|
| provisional | promotion date + 90일 |
| stable | promotion date + 180일 |

## Ownership Rules

각 memory 카테고리에는 정확성과 관련성에 책임을 지는 일반적 owner가 있다. Ownership은 일방적 진실을 의미하지 않으며, 누가 소유하든 promotion 규칙은 동일하게 적용된다.

| memory 카테고리 | 일반적 owner |
|---|---|
| project 전체 전달 패턴 | domain 보증을 받은 Orchestrator |
| 설계 선례 | Design Authority |
| 품질 교훈 | Quality Specialist |
| 보안 패턴 | Risk Specialist |
| 문서 / 운영 교훈 | Communication Specialist |
| cross-role process 규칙 | Orchestrator / process owner |

## Behavior-Change Surfaces

Memory는 다음 surface 중 하나 이상에 영향을 미쳐야 한다. 이 surface 중 어느 것도 변경되지 않으면, 해당 memory는 운영적이기보다 보관적일 가능성이 높다.

| surface | memory의 영향 방식 |
|---|---|
| `.geas/rules.md` | 신규 규칙 또는 기존 규칙 갱신 |
| packet-builder 우선순위 지정 | 관련 context에 대한 높은 relevance 점수 |
| reviewer checklist | 리뷰 항목 추가 또는 강조 |
| task admission caution | 알려진 위험 task 패턴 플래그 |
| gate 또는 readiness focus | evidence 임계값 조정 |
| recovery heuristics | recovery 경로 선택 개선 |
| debt triage focus | 과거 패턴 기반 우선순위 조정 |

## Privacy와 Sensitivity Rules

Memory는 shadow secrets store가 되어서는 안 된다. Memory 시스템은 운영 교훈을 저장하는 것이지 민감한 데이터를 저장하는 것이 아니다.

구현은 다음의 저장을 피해야 한다:

- raw secret
- credential
- 불필요한 개인 데이터
- 운영적으로 필요한 것 이상의 보안 민감 exploit 세부사항
- vendor가 금지하거나 policy가 금지하는 보유 콘텐츠

민감한 운영 교훈은 가능한 경우 추상화해야 한다. 민감한 세부사항 없이 행동 지침만 유지하는 것이 바람직하다.

## 반박과 Harmful Reuse

반박은 memory item의 주장된 행동이 더 이상 유효하지 않을 수 있다는 evidence다. Harmful reuse는 memory를 적용함으로써 결과가 악화되는 것이다. 둘 다 해소 없는 공존이 아닌 명시적 처리가 필요하다.

규칙:

- 반박은 반드시 기록되어야 한다.
- 반복적인 harmful reuse는 memory를 `under_review`로 이동시켜야 한다.
- Superseded 또는 under-review memory는 고정된 지침으로 취급되어서는 안 된다.
- 반박 관계에 있는 stable memory는 해소 없이 공존하지 말고 명시적 review를 촉발해야 한다.

## Failure Mode와 Recovery

Memory 시스템은 자체 failure mode를 안정적으로 처리해야 한다. 각 failure mode에는 정의된 recovery 경로가 있다.

| failure mode | recovery 동작 |
|---|---|
| 누락되거나 손상된 index | 가능한 경우 canonical entry와 log에서 재구축; 결과 confidence를 보수적으로 표시 |
| packet이 존재하지 않는 memory를 참조 | packet을 stale로 취급하고 재생성 |
| confidence가 0에 도달 | item을 archived 처리하거나 추가 사용 전 명시적 review 요구 |
| 반박 관계의 stable memory가 공존 | 문서화된 우선 관계가 없는 한 둘 다 review로 이동 |
| 필요한 authority 부재 | promotion 연기 가능; 인가 없이 강한 memory가 되지 않고 candidate 또는 provisional 상태 유지 |

## 핵심 선언

Geas에서 memory는 거버넌스가 적용되는 피드백 메커니즘이다. Evidence를 통해 신뢰를 획득하고, 반박을 통해 신뢰를 잃으며, 미래 작업을 계속 개선할 때만 존속한다.
