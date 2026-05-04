# Task

## 목적

이 문서는 Task의 의미, Task contract, Task lifecycle, self-check, 재작업 흐름을 정의한다.

Task는 Mission을 실제 실행 가능한 단위로 나눈 것이다. Task는 하나의 명확한 계약과 검증 기준을 가져야 한다.

## Task

Task는 최소한 다음 질문에 답해야 한다.

- 이 Task는 Mission의 어떤 부분을 담당하는가?
- 무엇을 바꾸거나 만들어야 하는가?
- 어떤 표면을 건드리는가?
- 어떤 Evidence가 필요한가?
- 무엇은 이 Task에서 하지 않는가?

하나의 Task 안에 서로 다른 수용 판단이 필요한 일이 섞이면 Task를 나누는 것이 좋다.

## Task Contract

Task contract는 Task가 무엇을 해야 하고, 언제 충분한 근거를 갖췄다고 볼 수 있는지 고정한다.

Task contract에는 다음 내용이 들어간다.

|항목|의미|
|---|---|
|목표|이 Task가 달성할 상태|
|Mission과의 관계|이 Task가 Mission의 어떤 부분을 담당하는지|
|범위|변경하거나 작성할 표면|
|산출물|Task가 끝났을 때 남아야 하는 결과|
|acceptance criteria|Task 결과를 판단할 기준|
|검증 방법|어떤 확인이 필요한지|
|하지 않을 일|이번 Task에서 제외하는 것|
|의존 관계|먼저 끝나야 하는 Task나 조건|
|알려진 위험|실행 전 알고 있는 위험|

Task contract는 실행 전에 받아들여져야 한다. 단순한 Task에서는 이 계약이 대화 안의 짧은 합의일 수 있다.

## Task Lifecycle

Task는 다음 흐름을 기본으로 한다.

```text
drafted -> ready -> implementing -> reviewing -> deciding -> passed
```

보류 또는 종결 흐름은 다음과 같다.

```text
blocked / escalated / cancelled
```

이 lifecycle은 Task의 의미 경계를 설명한다. 이후 런타임 모델에서 상태 이름이나 저장 방식은 다시 정할 수 있다.

### drafted

Task contract 초안이 작성되었지만 아직 실행 기준으로 받아들여지지 않은 상태다.

남겨야 할 것은 Task contract 초안과 미결 질문이다.

### ready

Task contract가 받아들여졌고 실행을 기다리는 상태다.

ready 상태에서는 의존 관계와 기준선이 유효한지 확인해야 한다.

### implementing

Implementer가 Task contract에 따라 작업하는 상태다.

남겨야 할 것은 수행한 작업, 중요한 판단, 계약과 달라진 점, self-check다.

### reviewing

Verifier와 Reviewer가 Task 결과를 확인하고 Evidence를 남기는 상태다.

남겨야 할 것은 필요한 Review Evidence, Challenger Evidence, Verification Evidence, 남은 위험이다.

### deciding

Orchestrator가 Task Evidence를 모아 agent 측 verdict 또는 권고를 정리하는 상태다.

이 판단은 User의 수용 판단을 돕는 입력이다. Task가 passed로 표시되어도 Mission 완료나 User 수용이 자동으로 성립하지 않는다.

### passed

Task 기준에서 필요한 작업과 Evidence가 갖춰졌다고 볼 수 있는 상태다.

passed는 Task 수준의 상태다. Mission 수준의 수용 판단을 대체하지 않는다.

### blocked

현재 기준으로 Task를 진행할 수 없는 상태다.

차단 사유, 필요한 입력, 재개 조건을 남겨야 한다.

### escalated

Task 수준에서 판단할 수 없어 Mission 수준이나 User 판단으로 올려야 하는 상태다.

무엇이 Task 범위를 넘어섰는지 남겨야 한다.

### cancelled

Task를 더 진행하지 않기로 한 상태다.

중단 이유와 대체 Task 또는 후속 항목이 있으면 함께 남겨야 한다.

## 실패는 상태가 아니다

검증 실패나 재작업 요청은 최종 상태가 아니다.

검증이 실패하면 이유를 남기고 implementing, reviewing, 또는 contract 갱신으로 돌아간다. 중요한 것은 실패를 숨기지 않고, 어떤 기준으로 다시 진행하는지 남기는 것이다.

## Self-check

Self-check는 Implementer가 자기 작업을 검증 단계로 넘기기 전에 남기는 자기 점검이다.

Self-check에는 다음 내용이 들어간다.

- 실제로 끝냈다고 보는 범위
- 먼저 검토해야 할 지점
- 알려진 위험
- 계획과 달라진 점
- 범위나 기대와 어긋난 신호

Self-check는 review를 대체하지 않는다. reviewer와 User가 어디를 먼저 봐야 하는지 압축해서 넘기는 입력이다.

## 재작업 흐름

재작업이 필요하면 다음 중 적절한 위치로 돌아간다.

|상황|돌아갈 위치|남길 것|
|---|---|---|
|Task 목표가 잘못 잡혔다.|Task contract|무엇을 오해했는지|
|범위나 산출물이 바뀌어야 한다.|Task contract|바뀐 범위와 이유|
|구현이나 작성이 부족하다.|implementing|부족한 부분과 기대 결과|
|검증 방법이 부족하다.|reviewing 또는 Task contract|추가로 확인할 방법|
|Task 범위를 넘어섰다.|escalated|Mission 또는 User 판단이 필요한 이유|
|더 진행하지 않는다.|cancelled|중단 이유와 남은 문제|

재작업은 이전 내용을 지우는 방식으로 처리하지 않는다. 무엇이 부족했고 어떤 기준으로 다시 진행하는지 드러나야 한다.

## Task와 Mission의 관계

Task는 Mission의 일부다. Task Evidence는 Mission 판단의 입력이 된다.

모든 Task가 passed여도 Mission이 자동으로 완료되는 것은 아니다. Mission 수준에서 gap, debt, 미검증 범위, 후속 항목이 남을 수 있다.
