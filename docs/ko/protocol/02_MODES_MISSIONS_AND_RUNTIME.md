# 02. Modes, Missions, and Runtime

> Geas의 mission 객체, 운영 mode, phase 흐름, run state의 의미를 정의한다.

## 목적

미션은 사용자 요청을 실행 가능한 프로토콜 객체로 변환한다. 미션 계층은 구현을 시작하기 전에 다음 질문 전부에 답할 수 있도록 존재한다:

- 어떤 문제를 해결하는가
- 어떤 범위가 약속되었는가
- 작업이 어떤 phase에 있는가
- 어떤 엄격도 수준이 적절한가
- 현재 어떤 작업이 활성, 일시 정지, 완료 상태인가
- 다음 phase로 넘어가기 전에 어떤 evidence가 필요한가

이 질문은 소프트웨어 개발, 연구 조율, 콘텐츠 제작, 데이터 파이프라인 구축 등 작업 유형에 관계없이 동일하게 적용된다.

## 미션

미션은 여러 task를 하나의 사용자 목적 아래에서 묶는 최소 프로토콜 객체다. 정규 기록은 mission spec으로 남기며, 형식과 저장 위치는 각각 `mission-spec.schema.json`과 doc 09를 따른다.

미션은 최소한 다음을 분명히 해야 한다:

- 무엇을 달성하려는지
- 누구를 위한 결과인지
- 언제 미션이 끝났다고 볼 수 있는지
- `scope.in`과 `scope.out`으로 어디까지 맡고 어디까지 제외하는지
- 무엇으로 완료를 판단할지
- 어떤 mode로 이 미션을 다룰지
- 어떤 표면에 영향을 주는지
- 어떤 제약, 가정, 모호성, 리스크가 있는지

해당 사항이 없다고 판단한 항목도 생략하지 말고 드러나게 남겨야 한다.

실제 전달 범위가 `scope.in`, `scope.out`과 어긋나면 gap assessment에 반영하고, 미션 수준 전제가 바뀌면 새 미션으로 다시 시작해야 한다.

프로젝트는 미션 객체에 로컬 오케스트레이션 메타데이터를 추가할 수 있다. 다만 그 구조는 로컬 관례이며 정규 형식의 일부는 아니다.

## 미션 운영 모드

미션 mode는 미션을 어떤 깊이로 운영할지 정하는 기본값이다. mode가 바뀌면 4-phase 순서가 달라지는 것이 아니라, 설계 기록, reviewer 라우팅, evidence 기준, phase 압축 가능 범위의 기본 강도가 달라진다.

| mode | 쓰는 경우 | 기본 기대 |
|---|---|---|
| `lightweight` | 범위가 작고 영향이 제한적이며 되돌리기 쉬운 작업 | 기록과 리뷰는 줄일 수 있지만 필수 phase와 evidence는 그대로 둠 |
| `standard` | 대부분의 일반 작업 | 기본 task 흐름과 통상적인 reviewer 라우팅을 따름 |
| `full_depth` | 영향 범위가 넓거나 불확실성이 크거나 실패 비용이 큰 작업 | mission design을 더 자세히 남기고 리뷰 범위와 evidence 기준을 높게 잡음 |

규칙:

- mode는 운영 깊이를 정하는 값일 뿐이며 doc 00의 기본 불변 규칙을 약화할 수 없다.
- 새로운 아키텍처, 대규모 리팩토링, 보안 민감 변경, 요구사항이 불분명한 작업은 `full_depth`를 기본으로 둔다.
- 어떤 mode를 써야 할지 분명하지 않으면 더 엄격한 쪽으로 정한다.
- 긴급 상황도 별도 예외로 다루지 않고 `lightweight`로 처리한다. 이 경우에도 기본 불변 규칙은 그대로 지킨다.

## 4-Phase 모델

모든 미션은 아래 네 phase를 순서대로 거친다. 작은 미션은 일부 phase를 짧게 거칠 수는 있지만, 필요한 evidence 없이 생략할 수는 없다.

1. `specifying`
2. `building`
3. `polishing`
4. `consolidating`

### Phase 흐름

```text
specifying --[phase gate 1]--> building --[phase gate 2]--> polishing --[phase gate 3]--> consolidating --[phase gate 4]--> complete
```

### Phase gate 원칙

Phase gate는 phase 사이 전이 조건을 확인하는 경계다. 준비되지 않은 상태에서 다음 phase로 넘어가는 일을 막기 위해 둔다.

- Phase gate는 artifact 존재 여부와 실제 준비 상태를 함께 본다.
- 필수 gate evidence 없이 다음 phase로 넘어가면 프로토콜 위반이다.
- Phase gate는 형식적인 절차가 아니라 실제 통제 지점이다.

## Phase Review

Phase review는 phase별 단일 요약이 아니라, phase 전이 판단마다 남기는 기록이다. 같은 `mission_phase`를 다시 방문하면 해당 phase의 review가 여러 개 생길 수 있으며, 이전 기록을 덮어쓰지 않는다.

Phase review는 최소한 다음을 드러내야 한다:

- 현재 phase에서 어떤 판단이 내려졌는지
- 다음 phase로 넘어갈 수 있는지, 아니면 막혔는지
- 되돌아가거나 재진입해야 한다면 그 이유가 무엇인지
- 실패 이력과 보류 사유가 어떻게 남았는지

Phase gate는 artifact 존재 여부만 보는 것이 아니라, phase review에 남은 전이 판단도 함께 본다. 정확한 필드 구조는 `phase-review.schema.json`과 doc 09를 따른다.

## Phase 상세

### 1) `specifying`

사용자와의 토론을 통해 요청을 구체화하고 mission spec을 작성한 뒤, 이를 바탕으로 `mission-design.md`와 초기 task contract 집합을 순차적으로 확정하는 단계다. 이 단계가 끝나면 미션은 곧바로 building에 들어갈 수 있어야 한다.

- 먼저 mission spec을 작성하고 사용자 승인을 받는다.
- 다음으로 승인된 mission spec을 바탕으로 `mission-design.md`를 작성하고 사용자 승인을 받는다.
- 마지막으로 승인된 mission spec과 `mission-design.md`를 바탕으로 초기 task contract 집합을 만들고 사용자 승인을 받는다.

| 구분 | 내용 |
|---|---|
| **하는 일** | mission spec 작성 및 승인 / 승인된 mission spec을 바탕으로 `mission-design.md` 작성 및 승인 / 승인된 mission spec과 mission design을 바탕으로 초기 task contract 집합 구성 및 승인 / task별 책임과 리뷰 경로 정리 / 남은 모호성을 탐색 task나 보류 판단으로 분리 |
| **산출물** | 승인된 mission spec, 승인된 `mission-design.md`, 승인된 초기 task contract 집합, phase review |
| **종료 조건** | mission spec, `mission-design.md`, 초기 task contract 집합에 대한 사용자 승인이 모두 끝남 / 초기 task contract가 바로 착수 가능한 수준으로 준비됨 / 각 task의 책임과 리뷰 경로가 드러남 / 남은 모호성은 탐색 task나 보류 판단으로 분리됨 |

#### `specifying` mode별 기본 기대

| mode | 기본 기대 |
|---|---|
| `lightweight` | mission spec, mission design, 초기 task contract를 짧고 직접적으로 정리하되 승인 순서는 그대로 지킨다 |
| `standard` | 일반적인 수준의 설계 설명, task 분해, 리뷰 경로를 정리하고 승인 근거를 분명히 남긴다 |
| `full_depth` | 대안, 리스크, 분해 근거, 리뷰 경로를 더 자세히 정리하고 보류 사유와 남은 모호성까지 명시한다. `specifying` 단계에서 Challenger가 mission design과 task 분해를 반드시 검토해야 한다 |

#### `specifying`에서 slot별 주요 작성·승인 책임

| slot | 주로 맡는 것 |
|---|---|
| Orchestrator | 사용자와의 토론을 바탕으로 `spec.json` 초안을 정리하고, 승인된 spec과 mission design을 바탕으로 초기 task contract 집합과 `phase review`를 작성 |
| Design Authority | `mission-design.md`를 작성하거나 보강하고, task 분해와 리뷰 경로의 구조적 타당성을 검토 |
| Decision Maker | `spec.json`, `mission-design.md`, 초기 task contract 집합의 승인 또는 수정 요구를 결정 |
| Challenger | 필요 시 mission design과 task 분해에 대해 반대 근거와 차단 사유를 남김 |

#### `specifying` phase gate에서 확인하는 것

- `spec.json`이 존재하고 `user_approved=true`여야 한다.
- `mission-design.md`가 존재하고, 승인된 mission spec을 바탕으로 작성되어 사용자 승인 상태여야 한다.
- 초기 task contract 집합이 존재하고, 승인된 mission spec과 `mission-design.md`를 바탕으로 작성되어 각 contract의 `user_approved=true`여야 한다.
- 각 task의 책임과 기본 리뷰 경로가 드러나 있어야 한다.
- 남은 모호성은 방치하지 않고 탐색 task나 보류 판단으로 분리되어 있어야 한다.
- phase review는 `building`으로 넘어가도 된다는 판단을 남겨야 한다.

#### `specifying` phase gate 통과 시 작업

- 승인된 초기 task contract의 `status`를 `drafted`에서 `ready`로 바꾼다.

### 2) `building`

미션의 핵심 가치를 실제 산출물로 만드는 단계다. 승인된 task contract를 기준으로 구현, 리뷰, 검증, 종결을 진행한다. Task가 `ready`에서 `passed`까지 전체 생명주기를 거치는 주요 phase다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 핵심 가치 경로 구현 / task를 반복적으로 종결 / 의도를 검증된 변경으로 전환 |
| **산출물** | task별: implementation contract, worker self-check, specialist review, gate result, closure packet, challenge review (high/critical), task closure decision, retrospective · phase 수준: gap assessment, debt register, phase review |
| **종료 조건** | building에서 다룬 task가 모두 종결됨 / 미해결 blocking 충돌 없음 / critical debt가 없거나 공식적으로 에스컬레이션됨 / 숨은 scope 확장이 드러나고 평가됨 |

#### `building` mode별 기본 기대

| mode | 기본 기대 |
|---|---|
| `lightweight` | 핵심 task를 빠르게 닫되 필수 evidence와 task closure decision은 생략하지 않는다 |
| `standard` | 각 task를 기본 생명주기대로 진행하고 필요한 review와 verification evidence를 남긴다 |
| `full_depth` | 리뷰 범위와 재검증을 더 넓게 적용하고, `high`·`critical` task는 Challenger 검토를 포함한다 |

#### `building`에서 slot별 주요 작성 책임

| slot | 주로 맡는 것 |
|---|---|
| Orchestrator | `ready` task의 순서 조정, 의존성·충돌·재시도 관리, closure packet을 바탕으로 task closure decision을 남기고 task 종결 상태를 모아 `phase review`를 작성 |
| Implementer | 구현을 수행하고 `record.json`의 implementation contract를 준비하며 `self-check.json`과 implementation evidence를 남김 |
| Design Authority | implementation contract를 승인하고 구조적 타당성에 대한 review evidence를 남김 |
| Verifier | acceptance criteria와 eval 결과를 바탕으로 verification evidence를 남김 |
| Risk Assessor / Operator / Communicator | task 표면에 따라 필요한 review evidence를 남김 |
| Challenger | `high`·`critical` task 또는 해소되지 않은 쟁점에 대해 challenge evidence를 남김 |

#### `building` phase gate에서 확인하는 것

- building에서 다룬 task가 모두 `passed` 또는 `cancelled`로 정리되어 있어야 한다.
- 각 task에 필요한 implementation, review, verification evidence가 빠지지 않아야 한다.
- `high`·`critical` task는 필요한 challenge review가 남아 있어야 한다.
- building 단계에서 드러난 gap과 debt가 가시화되어 있어야 한다.
- 숨은 scope 확장과 미해결 충돌이 방치되지 않아야 한다.
- phase review는 `polishing`으로 넘어가도 된다는 판단을 남겨야 한다.

#### `building` phase gate 통과 시 작업

- building 단계에서 종결된 task의 상태를 그대로 확정한다.
- polishing에서 검토할 전달 표면과 필수 specialist review 범위를 확정한다.
- building 단계의 gap assessment와 debt register를 다음 phase 기준선으로 넘긴다.

### 3) `polishing`

`building`에서 만든 결과를 실제 전달 직전 수준으로 다듬는 단계다. 이 단계에서는 새 기능을 붙이기보다, 실제로 넘길 산출물이 문서, 운영 준비, 사용자 대면 표현, 잔여 리스크 기준에서 서로 어긋나지 않는지 점검한다. 다만 polishing 중 새 task가 필요하다고 드러나면 그 작업을 감추지 말고 task를 만든 뒤 `building`으로 돌아가야 한다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 전달 표면 기준 최종 점검 / 문서·운영 준비·사용자 대면 표현이 실제 전달물과 맞는지 확인 / 잔여 리스크와 전달 제외 범위 재확인 / 전달 직전 발견 이슈를 수정, 새 task 생성 후 `building` 재진입, debt·gap 처리, 에스컬레이션 중 하나로 정리 |
| **산출물** | 전달 표면별 specialist review evidence, 갱신된 debt register, 갱신된 gap assessment, phase review |
| **종료 조건** | 전달 표면에 필요한 specialist review가 끝남 / 남은 `high`·`critical` 이슈가 수정·다음 단계로 넘김·에스컬레이션 중 하나로 정리됨 / 실제 전달물과 문서·운영 준비·사용자 대면 표현이 서로 어긋나지 않음 |

#### `polishing` mode별 기본 기대

| mode | 기본 기대 |
|---|---|
| `lightweight` | 실제 전달 표면에 직접 닿는 문서, 운영 준비, 안내만 짧게 점검하되 필요한 specialist review는 빼지 않는다 |
| `standard` | 전달 표면별 필수 review를 완료하고, polishing에서 발견된 실제 작업은 새 task로 올려 `building`에서 처리한다 |
| `full_depth` | 각 전달 표면에 대해 specialist review를 따로 남기고, 남은 `high`·`critical` 전달 리스크에는 Challenger 검토를 붙인다. polishing에서 새 작업이 드러나면 반드시 새 task와 재진입 근거를 남긴다 |

#### `polishing`에서 slot별 주요 작성 책임

| slot | 주로 맡는 것 |
|---|---|
| Orchestrator | 전달 표면과 필수 specialist review 범위를 고정하고, polishing 중 새 작업이 드러나면 task를 만들고 `building` 재진입을 기록하며, review 결과를 모아 `phase review`, gap assessment, debt register 갱신에 반영 |
| Verifier | 전달 직전 상태에서 필요한 재검증과 회귀 확인을 맡고 verification evidence를 보강 |
| Risk Assessor | 잔여 리스크, 정책 저촉 가능성, 신뢰 경계를 다시 점검하고 review evidence를 남김 |
| Operator | 인계 절차, 운영 준비, 복구 가능성, 롤백 가능성을 점검하고 review evidence를 남김 |
| Communicator | 문서, 안내 문안, 사용자 대면 표현이 실제 전달물과 맞는지 검토하고 review evidence를 남김 |
| Design Authority | polishing 과정의 수정이 인터페이스, 경계, 계약 구조를 건드리면 review evidence를 남김 |
| Challenger | 남은 `high`·`critical` 전달 리스크나 감춰진 타협에 대해 challenge evidence를 남김 |

#### `polishing` phase gate에서 확인하는 것

- 전달 표면별로 요구된 specialist review evidence가 모두 남아 있어야 한다.
- 실제 전달물과 문서, 운영 준비, 사용자 안내가 서로 어긋나지 않아야 한다.
- 남은 `high`·`critical` 이슈는 수정, debt 등록, gap 분류, 에스컬레이션 중 하나로 정리되어 있어야 한다.
- `blocked` 또는 `escalated` 판단이 "나중에 보자" 식으로 묻혀 있지 않아야 한다.
- polishing 과정에서 새 task가 필요하다고 드러났다면 그 task가 생성되어 `building` 재진입으로 처리되어야 하며, `consolidating`으로 넘겨서는 안 된다.
- polishing 과정에서 생긴 추가 변경이 있다면 필요한 task와 evidence를 거쳤어야 한다.
- phase review는 `consolidating`으로 넘어가도 된다는 판단을 남겨야 한다.

#### `polishing` phase gate 통과 시 작업

- 전달 표면별 review 완료 상태를 현재 미션 기준선으로 확정한다.
- 남은 debt, gap, escalation 항목을 `consolidating`에서 다룰 입력으로 넘긴다.

### 4) `consolidating`
	
미션을 마무리하면서 남길 것과 넘길 것을 정리하는 단계다. 미션의 마지막 phase이며, 드러난 교훈과 남은 debt·gap, 다음 작업으로 넘길 항목을 빠짐없이 정리하고 mission final verdict 판단 근거를 모은다.
	
| 구분 | 내용 |
|---|---|
| **하는 일** | rules·memory에 반영할 사항 정리 / 최종 debt·gap 정리 / 다음 작업으로 넘길 항목 정리 / mission final verdict 판단 근거 정리 |
| **산출물** | gap assessment, rules update, debt register (최종), phase review |
| **종료 조건** | gap assessment가 최종 상태로 정리됨 / rules·memory 조치가 기록되거나 없다고 명시됨 / 최종 debt 현황이 확정됨 / 다음 작업으로 넘길 항목이 정리됨 / mission final verdict를 내릴 판단 근거가 충분히 모임 |

#### `consolidating` mode별 기본 기대

| mode | 기본 기대 |
|---|---|
| `lightweight` | 짧게 정리하더라도 gap, debt, rules·memory 반영 여부, 다음 작업으로 넘길 항목은 빠뜨리지 않는다 |
| `standard` | 미션에서 드러난 교훈과 남은 문제를 다음 작업이 바로 이어받을 수 있게 정리한다 |
| `full_depth` | debt, gap, 다음 작업으로 넘길 항목, rules·memory 조치 근거를 더 분명히 남기고 mission final verdict에 필요한 반대 의견과 보류 사유까지 정리한다 |

#### `consolidating`에서 slot별 주요 작성 책임

| slot | 주로 맡는 것 |
|---|---|
| Orchestrator | retrospective, gap, debt, memory 제안을 모아 `phase review`를 작성하고 다음 작업으로 넘길 항목을 정리 |
| Decision Maker | gap assessment, debt register, 마지막 phase review를 바탕으로 mission final verdict 판단을 내리거나 보류·에스컬레이션 사유를 남김 |
| Design Authority | 구조적 debt, 설계 교훈, 다음 미션에서 주의할 설계 쟁점을 검토 |
| Challenger | 종결 단계에서 빠지기 쉬운 반대 의견, 남은 리스크, 과도한 낙관을 드러냄 |

#### `consolidating` phase gate에서 확인하는 것

- 최종 gap assessment가 존재해야 한다.
- 최종 debt register가 존재하거나, 남길 debt가 없다고 명시되어야 한다.
- rules update와 memory 반영 조치가 기록되거나, 반영할 항목이 없다고 명시되어야 한다.
- 다음 작업으로 넘길 항목이 다음 미션 입력, debt, 또는 명시적 제외로 정리되어야 한다.
- mission final verdict를 내리기에 필요한 판단 근거와 보류 사유가 phase review에 드러나 있어야 한다.

#### `consolidating` phase gate 통과 시 작업

- 미션 종료에 필요한 판단 근거를 현재 기준선으로 확정한다.
- 다음 미션이나 후속 작업에 넘길 항목, debt, rules·memory 조치를 고정한다.

## Run State

Run state는 현재 미션의 진행 상태와 재개 기준을 붙드는 상태 기록이다. 지금 어디까지 왔는지, 무엇이 진행 중인지, 중단되면 어디서 다시 이어야 하는지를 한곳에서 보여준다. 정규 artifact는 `.geas/state/run-state.json`이고, 형식은 `run-state.schema.json`을 따른다. 이 섹션은 필드 목록이 아니라 run state가 맡는 역할만 정리한다.

Run state에는 최소한 다음이 드러나야 한다:

- 지금 어떤 mission을 수행 중인지
- 미션 전체 상태가 무엇인지
- 현재 phase와 scheduler 상태가 무엇인지
- 지금 진행 중인 task와 이미 정리된 task가 무엇인지
- 최근 recovery 판단이 무엇이었는지
- 다음 복구나 재개 판단에 필요한 checkpoint가 무엇인지

Run state는 evidence, review, phase review를 대신하지 않는다. 판단과 결과는 각 canonical artifact에 남기고, run state는 현재 실행 상태와 재개 기준만 붙든다.

### Checkpoint가 남겨야 하는 것

checkpoint는 중단 뒤 재개 판단에 바로 쓸 수 있는 복구 기준선이다. 정확한 필드 구조는 `run-state.schema.json`이 관리하며, 여기서는 다음 의미가 빠지지 않아야 한다:

- 현재 pipeline 단계와 작업 중인 agent
- 아직 회수되지 않은 evidence 기대치
- 현재 단계의 retry 상태와 남은 단계
- 병렬 batch가 있다면 그 대상과 완료 현황
- checkpoint가 기록 중인지, 확정되었는지
- checkpoint를 마지막으로 언제 어떤 상태로 확정했는지
