# Mission

## 목적

이 문서는 Mission의 의미, Mission spec, Mission design, 운영 깊이, Mission 흐름을 정의한다.

Mission은 사용자의 요청을 책임 있게 수행하기 위한 상위 작업 단위다. User가 하나의 결과로 검토하고 수용 판단할 수 있는 목표를 담는다.

## Mission

Mission은 최소한 다음 질문에 답해야 한다.

- 무엇을 이루려는가?
- 왜 필요한가?
- 어디까지 포함하는가?
- 어디까지 제외하는가?
- 어떤 기준으로 결과를 판단할 것인가?
- 어떤 위험이나 제약이 있는가?

Mission은 하나의 Task로 끝날 수도 있고, 여러 Task로 나뉠 수도 있다.

## Mission Spec

Mission spec은 Mission이 무엇을 만족해야 하는지 고정하는 상위 계약이다.

Mission spec에는 다음 내용이 들어간다.

|항목|의미|
|---|---|
|이름 또는 목표|Mission을 식별할 수 있는 짧은 이름이나 목표|
|배경|왜 이 Mission이 필요한지|
|definition of done|Mission이 끝났다고 판단할 상위 기준|
|포함 범위|이번 Mission이 맡는 일|
|제외 범위|이번 Mission에서 하지 않을 일|
|acceptance criteria|결과를 판단할 구체 기준|
|제약|반드시 지켜야 하는 조건|
|시작 위험|시작 시점에 알고 있는 위험|

Mission spec은 User가 이해하고 받아들일 수 있어야 한다.

Mission spec이 받아들여진 뒤 definition of done이나 scope가 바뀌어야 한다면 기존 실행 기준을 조용히 확장하지 않는다. Mission을 갱신할지, 보류할지, 중단할지, 후속 Mission으로 넘길지 판단해야 한다.

## Mission Design

Mission design은 Mission을 어떻게 달성할지 설명하는 설계 기준선이다.

Mission design에는 다음 내용이 들어간다.

|항목|의미|
|---|---|
|Strategy|높은 수준의 접근과 선택 이유|
|Structure|주요 구성, 변경 표면, 통합 방식|
|Task breakdown|Task를 나누는 방식과 이유|
|Verification plan|Mission과 Task를 어떻게 검증할지|
|Key decisions|중요한 설계 결정과 대안|
|Assumptions|설계가 의존하는 전제|
|Unknowns|아직 풀리지 않은 질문과 해소 방법|
|Risks|위험과 완화 또는 수용 근거|
|Failure modes|예상 실패 패턴과 대응|

단순한 Mission에서는 Mission design이 짧을 수 있다. 그러나 위험하거나 긴 Mission에서는 Mission design이 Task 실행의 기준선이 된다.

## 운영 깊이

Mission은 작업의 위험과 규모에 따라 다른 깊이로 운영될 수 있다.

|깊이|쓰는 경우|계약과 설계|검증과 판단|
|---|---|---|---|
|lightweight|작고 위험이 낮은 작업|짧은 Mission spec과 단일 Task|실행 결과와 최소 Evidence|
|standard|일반적인 문서, 코드, 설계 작업|Mission design과 Task contract 명시|Verifier 또는 Reviewer 근거 포함|
|full_depth|위험하거나 장기 영향이 큰 작업|Work Designer, Challenger 관점 명시|독립 검증, 이견, carry-forward까지 정리|

운영 깊이는 판단 깊이를 조절한다. 그러나 User의 최종 수용 판단, Evidence 명시, 계약 없는 실행 금지는 어떤 깊이에서도 유지한다.

## Mission 흐름

Mission은 다음 흐름을 따른다.

```text
specifying -> building -> consolidating
```

이 흐름은 구현 상태 기계를 고정하기 위한 것이 아니라, Mission의 판단 흐름을 설명하기 위한 것이다.

building 중 새 정보가 기존 Mission spec, Mission design, Task contract, acceptance criteria, 하지 않을 일, 검증 방법을 바꾸면 specifying으로 돌아간다. 이때 기존 Evidence와 판단 맥락은 버리지 않고 새 계약의 입력으로 삼는다.

### specifying

목적은 사용자 요청을 승인 가능한 Mission 기준선으로 바꾸는 것이다.

주요 활동은 다음과 같다.

- Orchestrator가 User 요청을 Mission 목표로 구체화한다.
- Mission spec 초안을 작성한다.
- 필요한 경우 Work Designer가 Mission design을 작성한다.
- 필요한 경우 Task breakdown과 초기 Task contract를 만든다.
- User가 Mission spec과 필요한 설계를 받아들이거나 수정한다.

남겨야 할 것은 Mission spec, 필요한 Mission design, 필요한 Task contract다.

### building

목적은 승인된 Task contract에 따라 작업을 수행하고, 각 Task에 대해 User가 수용 판단할 수 있도록 Evidence를 쌓는 것이다.

주요 활동은 다음과 같다.

- Orchestrator가 Task 순서와 의존 관계를 조율한다.
- Implementer가 Task를 수행하고 self-check를 남긴다.
- Verifier와 Reviewer가 필요한 Evidence를 남긴다.
- Orchestrator가 Evidence를 판단 가능한 상태로 모은다.
- User가 각 Task의 Evidence를 검토하고 수용 판단한다.
- 재작업이 필요하면 building 안에서 반복한다.
- 계약 변경이 필요하면 specifying으로 돌아간다.

남겨야 할 것은 Task 결과, self-check, 필요한 Review Evidence, Challenger Evidence, Verification Evidence다.

### consolidating

목적은 수용된 Task들을 Mission 목표와 대조하고, User가 Mission 전체를 수용 판단할 수 있는 상태로 만드는 것이다.

주요 활동은 다음과 같다.

- Mission spec과 Mission design을 기준으로 Task 결과를 대조한다.
- 남은 부족분을 추가 Task, gap, debt, follow-up, no action 중 하나로 분류한다.
- 추가 Task가 필요하면 building으로 돌아간다.
- Mission scope나 definition of done이 바뀌어야 하면 specifying으로 돌아간다.
- Task Evidence, self-check, review, verification 결과를 종합한다.
- Orchestrator가 agent 측 verdict 또는 권고를 정리한다.
- User가 Mission의 Evidence를 검토하고 수용 판단을 내린다.
- memory 후보, debt 후보, gap, 후속 항목을 정리한다.

남겨야 할 것은 Mission 결과 요약, Mission Evidence, agent 측 권고, User의 수용 판단, 회고 항목이다.

consolidating은 다음 네 활동을 반드시 포함한다.

|활동|의미|
|---|---|
|reconcile|Mission spec과 Mission design을 Task 결과와 대조한다.|
|classify|부족분을 추가 Task, gap, debt, follow-up, no action으로 분류한다.|
|decide|agent 측 권고와 User의 수용 판단을 정리한다.|
|reflect|다음 Mission에 넘길 memory 후보와 개선점을 정리한다.|

Mission은 User의 수용 판단이 남고, 필요한 회고와 후속 항목이 정리되었을 때 complete로 볼 수 있다. complete는 agent의 선언만으로 성립하지 않는다.

## Mission 판단

모든 Task가 수용된 상태가 되어도 Mission이 자동으로 완료되는 것은 아니다.

Mission 수준에서는 다음이 남을 수 있다.

- 전체 목표와 Task 결과 사이의 gap
- User가 받아들인 미검증 범위
- 후속 Mission으로 넘겨야 할 항목
- 현재 Mission에서 더 진행하지 않기로 한 debt
- 반복 가능한 교훈

따라서 Mission의 최종 판단은 Evidence와 User의 수용 판단 위에 성립한다.
