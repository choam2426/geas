# 07. Memory System Overview

> **기준 문서.**
> 이 문서는 Geas에서 memory의 목적, 범위, 수용 기준, confidence 모델, 행동적 역할을 정의한다.

## 목적

Geas memory는 노트를 축적하는 것이 아니라 미래 행동을 바꾸기 위해 존재한다. Memory 시스템은 저장된 교훈이 미래의 task 실행, review 품질, recovery, scope 제어를 실질적으로 개선할 수 있을 때만 적합한 것으로 인정된다.

핵심 목표:

| 목표 | 설명 |
|---|---|
| 재발 방지 | 동일한 실패의 반복을 차단한다 |
| 성공 재사용 | 검증된 성공 패턴을 새 작업에 적용한다 |
| recovery 가속 | 보존된 맥락을 활용하여 중단 후 안전하게 재개한다 |
| review 개선 | 이력 기반 통찰로 reviewer의 초점을 강화한다 |
| 노이즈 감소 | 선별적 retrieval로 불필요한 context stuffing을 제거한다 |
| 지식 보존 | 운영 지식을 낡은 전승으로 만들지 않고 보존한다 |

## 핵심 원칙

### 1) Memory는 진화한다

어떤 memory item도 처음부터 진실이 아니다. Item은 state를 거치며 진행하고, evidence와 재사용을 통해 내구성을 획득해야 한다. 갓 추출된 교훈은 실무에서 검증되기 전까지 최소한의 권위만 갖는다.

### 2) Memory는 evidence 없이 약해진다

충분한 evidence, 성공적 재사용, review 지원이 없는 memory item을 강한 지침으로 취급해서는 안 된다. 뒷받침하는 evidence가 부재하거나 반박되면 신뢰가 감소한다.

### 3) Memory는 scope를 갖는다

모든 memory item은 적용 범위를 선언해야 한다. Scope는 신뢰성의 일부다. 한 프로젝트 맥락에서 얻은 교훈이 명시적 검증 없이 다른 맥락으로 안전하게 이전되리라는 보장은 없다.

### 4) Memory는 budget 내에서 context에 진입한다

Memory retrieval은 선별적이어야 한다. Packet builder는 양이 아닌 관련성, 출처, 최신성을 기준으로 최적화해야 한다. 관련성이 낮은 memory로 context를 과부하하면 의사결정 품질이 오히려 저하된다.

### 5) Memory는 사용 후 재평가된다

성공적이든 해로웠든, 적용 결과는 confidence와 state 변경에 반영되어야 한다. 좋은 결과를 낳은 memory는 신뢰를 얻고, 해로운 결과를 낳은 memory는 신뢰를 잃는다.

### 6) Memory는 행동 surface에 연결되어야 한다

아무것도 바꾸지 않는 memory item은 비기능적이다. Memory는 다음 surface 중 최소 하나에 영향을 미쳐야 한다:

| 행동 surface | 영향 예시 |
|---|---|
| rules | `.geas/rules.md`의 신규 또는 갱신 항목 |
| packet content | context packet 내 우선 포함 |
| reviewer focus | checklist 항목 추가 또는 review 강조 |
| gate strictness | evidence 임계값 강화 또는 완화 |
| scheduling caution | 위험이 알려진 병렬 조합 회피 |
| recovery heuristics | recovery 의사결정 개선 |

## Memory Layer Model

Memory 시스템은 정보를 논리적 layer로 구성한다. 각 layer는 고유한 시간적·맥락적 목적을 지닌다. 프로젝트가 물리적 store를 더 적게 구현할 수는 있으나, layer 간 의미 구분은 보존해야 한다.

| layer | 주요 용도 | 일반적 수명 |
|---|---|---|
| `session_memory` | 현재 세션의 전술적 연속성 | 단일 세션 |
| `task_focus_memory` | 밀도 높은 task-local carry-forward | 단일 task |
| `mission_memory` | 현재 mission 관련 교훈 | 단일 mission |
| `episodic_memory` | 특정 incident 또는 실행 이력 | 중기 |
| `project_memory` | 내구적인 project 전체 패턴 | 장기 |
| `agent_memory` | 역할별 지침 | 장기 |
| `risk_memory` | 반복적 위험이나 민감한 surface와 연관된 패턴 | 장기 |

### Agent memory 메커니즘

Agent memory는 에이전트별 마크다운 파일(`.geas/memory/agents/{agent_type}.md`)로 구현된다:

- **읽기**: 에이전트 호출 시 context packet에 포함
- **쓰기**: Orchestrator가 회고 단계에서 specialist review, challenge review, worker self-check의 memory_suggestions를 바탕으로 작성
- **형식**: 자유 형식 마크다운, 갱신 시 전체 재작성
- **범위**: 프로젝트 전체에 걸쳐 mission과 session을 넘어 지속

Agent memory는 Geas에서 가장 단순한 memory 메커니즘이다. 에이전트가 작업 전에 읽고, Orchestrator가 유용한 것을 파악한 후 갱신하는 평범한 파일이다.

## Memory Scope

모든 memory item은 적용 범위와 행동에 영향을 미치는 폭을 제어하는 scope를 선언한다. 넓은 scope일수록 더 강한 정당화가 필요하다.

| scope | 적용 대상 | 정당화 수준 |
|---|---|---|
| `task` | 단일 task | 최소 -- 직접 관찰이면 충분 |
| `mission` | 현재 mission | 보통 -- task 간에 패턴이 반복되어야 함 |
| `project` | 전체 project | 강함 -- 내구적이고 project 전체에 해당하는 패턴 |
| `agent` | 특정 에이전트 역할 | 강함 -- 역할에 특화되고 검증됨 |
| `global` | 모든 project | 매우 강함 -- 드물며 광범위한 evidence 필요 |

규칙:

- `global` scope는 드물어야 한다.
- 단순히 인상적이었다는 이유만으로 memory를 더 넓은 scope로 승격해서는 안 된다.

## Memory 수용 기준

모든 관찰이 memory item이 될 자격을 갖는 것은 아니다. 수용 기준은 memory 시스템이 노이즈로 채워지는 것을 방지한다.

Memory candidate는 다음 질문 전부에 답할 수 있을 때만 시스템에 진입해야 한다:

| 질문 | 목적 |
|---|---|
| 무엇이 일어났는가? | 사실적 근거 확립 |
| 어떤 evidence가 이 교훈을 뒷받침하는가? | 근거 없는 주장 방지 |
| 어떤 surface에 적용되는가? | 실행 가능성 보장 |
| 미래 행동을 어떻게 바꿔야 하는가? | 운영적 가치 확인 |
| 무엇이 이것을 반증하거나 약화시킬 수 있는가? | 향후 재평가 가능성 확보 |

다음에 해당하는 candidate는 거부하거나 약하게 유지해야 한다:

- 일반적인 동기 부여 조언
- artifact로 뒷받침되지 않는 것
- 최근의 더 강한 evidence에 의해 반박된 것
- 운영적 결과가 없는 일회성 스타일 선호

## Confidence Scoring Model

Confidence는 시스템이 memory item에 부여하는 신뢰 수준을 수치화한다. Evidence 수에서 산출되며 재사용 결과에 따라 변동한다.

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

- Confidence가 `0.3` 미만으로 떨어지면 review를 촉발해야 한다.
- Confidence만으로 state나 freshness 규칙을 무시해서는 안 된다.
- Stale이지만 high-confidence인 memory도 재평가가 필요하다.

## 최신성과 Review-After

Memory item은 재검토 시점을 나타내는 `review_after` 날짜를 갖는다. 이 날짜가 지난 memory는 적극적으로 재사용하기 전에 재검토해야 한다.

| memory 상태 | 기본 review 주기 |
|---|---|
| provisional | promotion date + 90일 |
| stable | promotion date + 180일 |

## Ownership Rules

각 memory 카테고리에는 정확성과 관련성에 책임을 지는 owner가 있다. Ownership이 일방적 진실을 의미하지는 않으며, 누가 소유하든 promotion 규칙은 동일하게 적용된다.

| memory 카테고리 | 일반적 owner |
|---|---|
| project 전체 전달 패턴 | domain 보증을 받은 Orchestrator |
| 설계 선례 | Design Authority |
| 품질 교훈 | Quality Specialist |
| 보안 패턴 | Risk Specialist |
| 문서 / 운영 교훈 | Communication Specialist |
| cross-role process 규칙 | Orchestrator / process owner |

## Behavior-Change Surfaces

Memory는 다음 surface 중 하나 이상에 영향을 미쳐야 한다. 어느 surface도 바뀌지 않으면 해당 memory는 운영적이라기보다 보관적일 가능성이 높다.

| surface | memory가 영향을 미치는 방식 |
|---|---|
| `.geas/rules.md` | 신규 규칙 또는 기존 규칙 갱신 |
| packet-builder 우선순위 | 관련 context에 대한 높은 relevance 점수 |
| reviewer checklist | review 항목 추가 또는 강조 |
| task admission caution | 위험이 알려진 task 패턴 플래그 |
| gate 또는 readiness focus | evidence 임계값 조정 |
| recovery heuristics | recovery 경로 선택 개선 |
| debt triage focus | 과거 패턴 기반 우선순위 조정 |

## Privacy와 Sensitivity Rules

Memory가 shadow secrets store가 되어서는 안 된다. Memory 시스템은 운영 교훈을 저장하는 것이지 민감한 데이터를 저장하는 것이 아니다.

구현 시 다음의 저장을 피해야 한다:

- raw secret
- credential
- 불필요한 개인 데이터
- 운영에 필요한 수준을 넘는 보안 민감 exploit 세부사항
- vendor나 policy가 금지하는 보유 콘텐츠

민감한 운영 교훈은 가능한 한 추상화해야 한다. 민감한 세부사항 없이 행동 지침만 유지하는 것이 바람직하다.

## 반박과 Harmful Reuse

반박(contradiction)은 memory item이 주장하는 행동이 더 이상 유효하지 않을 수 있음을 보여주는 evidence다. Harmful reuse는 memory를 적용했을 때 결과가 오히려 악화되는 현상이다. 두 경우 모두 해소 없는 공존이 아니라 명시적 처리가 필요하다.

규칙:

- 반박은 반드시 기록해야 한다.
- 반복적인 harmful reuse가 발생하면 해당 memory를 `under_review`로 이동해야 한다.
- Superseded 또는 under-review memory를 고정 지침으로 취급해서는 안 된다.
- 반박 관계에 있는 stable memory는 해소 없이 공존하지 말고 명시적 review를 촉발해야 한다.

## Failure Mode와 Recovery

Memory 시스템은 자체 failure mode를 안정적으로 처리해야 한다. 각 failure mode에는 정의된 recovery 경로가 있다.

| failure mode | recovery 동작 |
|---|---|
| 누락되거나 손상된 index | 가능한 경우 canonical entry와 log에서 재구축하고, 결과 confidence를 보수적으로 표시한다 |
| packet이 존재하지 않는 memory를 참조 | packet을 stale로 취급하고 재생성한다 |
| confidence가 0에 도달 | item을 archived 처리하거나 추가 사용 전 명시적 review를 요구한다 |
| 반박 관계의 stable memory가 공존 | 문서화된 우선 관계가 없는 한 둘 다 review로 이동한다 |
| 필요한 authority 부재 | promotion을 연기할 수 있다. 인가 없이 강한 memory가 되지 않고 candidate 또는 provisional 상태를 유지한다 |

## 핵심 선언

Geas에서 memory는 거버넌스가 적용되는 피드백 메커니즘이다. Evidence를 통해 신뢰를 획득하고, 반박을 통해 신뢰를 잃으며, 미래 작업을 지속적으로 개선할 때만 존속한다.
