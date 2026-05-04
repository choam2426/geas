# 작업 운영

## 목적

이 문서는 Geas에서 agent 작업이 사용자 요청에서 수용 판단 가능한 결과로 이동하는 전체 흐름을 얇게 보여준다.

이 문서는 단순한 문서 목록이 아니다. 먼저 Mission과 Task가 어떤 흐름으로 움직이는지, 어느 지점에서 User의 판단이 필요한지, agent가 어떤 근거를 남겨야 하는지 보여준다. 세부 정의와 규칙은 각 문서로 이어진다.

작업 운영은 `docs/definition.md`의 결정을 따른다. Geas는 인간의 수용 판단을 agent verdict, 자동 상태, 도구 실행 결과로 대체하지 않는다. Geas가 줄이려는 것은 수용 판단 자체가 아니라 수용 판단에 드는 비용이다.

## 기본 단위

Geas 작업은 Mission, Task, Evidence, 수용 판단을 중심으로 흐른다.

### Mission

Mission은 User가 agent를 사용해 이루고자 하는 목표를 구체화한 것이다.

Mission은 단순히 큰 작업 이름이 아니다. 왜 필요한지, 어디까지 포함하는지, 어디까지 제외하는지, 어떤 기준으로 판단할지 담아야 한다. User는 Mission을 하나의 목표로 검토하고 수용 판단한다. Mission은 하나의 Task로 끝날 수도 있고 여러 Task로 나뉠 수도 있다.

Mission은 보통 다음 질문에 답할 수 있어야 한다.

- 무엇을 하려는가?
- 왜 하려는가?
- 어디까지 할 것인가?
- 어디까지 하지 않을 것인가?
- 어떤 결과가 나오면 충분한가?
- 어떤 단위나 순서로 판단 가능하게 진행할 것인가?
- 어떤 근거를 보고 수용 판단할 것인가?

이 요소들은 Mission을 무겁게 만들기 위한 형식이 아니다. User가 무엇을 맡겼고, agent가 무엇을 기준으로 실행하며, 나중에 어떤 근거로 수용 판단할지 흐려지지 않게 만드는 최소 구조다.

### Task

Task는 Mission의 일부를 User가 Evidence를 보고 수용 판단할 수 있게 나눈 작업 단위다.

Task는 단순히 할 일을 쪼갠 목록이 아니다. 하나의 Task는 agent가 무엇을 바꾸거나 만들지, 어디까지 다룰지, 어떤 결과를 남길지, 어떤 근거를 제시해야 User가 판단할 수 있을지를 담아야 한다.

Task는 보통 다음 질문에 답할 수 있어야 한다.

- Mission의 어떤 부분을 담당하는가?
- 무엇을 바꾸거나 만들 것인가?
- 어디까지 할 것인가?
- 어디까지 하지 않을 것인가?
- 어떤 결과가 나오면 충분한가?
- 어떤 검증 근거를 남길 것인가?
- 무엇을 확인하지 못할 수 있는가?

좋은 Task는 실행하기 쉬운 단위이기 전에 판단하기 쉬운 단위다. 하나의 Task 안에 서로 다른 수용 판단이 필요한 일이 섞이면 나누는 것이 좋다.

Task는 agent가 완료를 선언하는 단위가 아니다. Task는 User의 수용 판단 비용을 낮추기 위해 Mission을 작고 검토 가능한 단위로 나눈 것이다.

### Evidence

Evidence는 agent가 User의 검토와 수용 판단을 돕기 위해 검증 근거와 미검증 범위를 함께 정리한 근거 자료다.

Evidence는 단순한 작업 요약이 아니다. User가 결과를 다시 처음부터 확인하지 않고도 무엇을 믿을 수 있고, 무엇을 직접 판단해야 하는지 알 수 있게 만드는 자료다.

Evidence에는 다음과 같은 것들이 포함될 수 있다.

- 작업 내용: 무엇을 바꾸거나 만들었는지
- 테스트 결과: 어떤 테스트나 실행 확인을 했는지
- 리뷰 결과: 어떤 관점에서 검토했고 무엇을 발견했는지
- 챌린지 결과: 어떤 낙관, 모호함, 숨은 위험을 드러냈는지
- 실행 출력: 명령, 도구, 화면, 로그에서 어떤 결과를 확인했는지
- 기준 대응: 결과가 Mission이나 Task의 판단 기준과 어떻게 대응하는지
- 미검증 범위: 무엇을 확인하지 못했는지
- 남은 위험: User가 수용할지 판단해야 하는 위험은 무엇인지

Evidence는 보통 다음 질문에 답할 수 있어야 한다.

- 무엇을 했는가?
- 무엇을 확인했는가?
- 무엇을 확인하지 못했는가?
- 어떤 결과가 나왔는가?
- 결과가 Mission이나 Task의 판단 기준과 어떻게 대응하는가?
- User가 판단해야 할 남은 위험은 무엇인가?

Evidence는 완료 선언이 아니다. Evidence는 User가 검토하고 수용 판단할 수 있게 만드는 근거 자료다.

### 수용 판단

수용 판단은 User가 Evidence를 검토한 뒤 내리는 결정이다.

수용 판단은 Mission과 Task의 기준선을 받아들이는 판단에서 시작한다. User는 Mission spec이 자신의 목표와 맞는지, 초기 Task 목록과 초기 Task contract가 Mission을 판단 가능하게 나누고 있는지 확인하고 받아들이거나 수정한다.

작업 결과에 대한 수용 판단은 Evidence를 바탕으로 한다. Task 수용 판단은 해당 Task를 받아들일지, 재작업할지, 보류할지, 중단할지 결정한다. Mission 수용 판단은 수용된 Task들을 전체 목표와 다시 대조한 뒤 Mission을 완료로 받아들일지 판단한다.

## 전체 흐름

Geas의 작업 흐름은 User의 요청을 Mission 기준선으로 구체화하고, Task 단위로 실행과 수용 판단을 반복한 뒤, Mission 전체의 수용 판단으로 묶는다.

Orchestrator는 이 흐름 전체에서 Mission 기준선, Task 진행, Evidence 정리, User 수용 판단 요청을 조율한다.

```text
User request
  -> specifying
  -> building
  -> consolidating
  -> Mission 수용 판단
```

### specifying

specifying은 User의 요청을 Mission 기준선과 Task 계약으로 구체화하는 단계다.

Orchestrator는 User 요청을 Mission 기준선으로 구체화하고, Mission spec, Mission design, 초기 Task contract가 이어지도록 조율한다.

이 단계에서는 Mission spec, Mission design, 초기 Task contract 순서로 기준선을 만든다.

- Mission spec은 User가 agent로 수행하려는 작업을 기획하는 기준선이다. 무엇을 이루려는지, 왜 필요한지, 어디까지 포함하거나 제외하는지, 어떤 결과를 충분하다고 볼지 고정한다.
- Mission design은 Mission spec을 실행 가능한 작업 계획으로 바꾸는 기준선이다. 수용 판단 비용을 낮추기 위한 Task 분해의 구조와 이유, 진행 순서, 의존 관계, Mission 전체의 검증 전략을 설명한다.
- Task contract는 개별 Task의 실행 계약이다. 해당 Task가 맡는 Mission의 일부, 수행 범위, 산출물, 수용 기준, 남겨야 할 구체적 Evidence를 고정한다.

User는 Mission spec이 자신의 목표와 맞는지, 초기 Task 목록과 초기 Task contract가 Mission을 판단 가능하게 나누고 있는지 확인하고 받아들이거나 수정한다.

### building

building은 승인된 Task contract를 실행 기준으로 삼아 Task를 수행하는 단계다.

이 단계에서 agent는 Task contract를 바탕으로 더 세밀한 execution plan을 세운 뒤 작업하고, Implementation Evidence, review, verification을 거쳐 Task별 Evidence를 남긴다. 필요한 경우 다음 Task contract를 구체화하거나 갱신한다.

building의 중심은 Task 수용 루프다.

```text
Task contract
  -> execution plan
  -> implementation
  -> Implementation Evidence
  -> review / verification
  -> Evidence
  -> Task 수용 판단
```

execution plan은 접근 순서, 세부 작업 단계, 예상 위험, 자체 점검 포인트를 정리한다. Task의 범위, 산출물, 수용 기준, Evidence 요구가 바뀌면 execution plan이 아니라 Task contract를 갱신한다.

building에서는 역할별 책임이 구분된다.

- Implementer는 execution plan을 세우고 Task를 수행하며 Implementation Evidence를 남긴다.
- Reviewer는 Task 결과를 검토하고 Review Evidence를 남긴다.
- Challenger는 devil's advocate 관점에서 기준선이나 결과를 압박해 보고 Challenger Evidence를 남긴다.
- Verifier는 Task의 수용 기준과 검증 방법을 확인하고 Verification Evidence를 남긴다.
- Orchestrator는 Task Evidence를 모아 User가 수용 판단할 수 있는 형태로 정리한다.

User는 Task Evidence를 보고 Task를 받아들일지, 재작업할지, 보류할지, 중단할지 판단한다. agent 측 verdict나 권고는 이 결정을 돕는 근거 자료다.

building 안에서 다음 Task contract를 구체화하거나 개별 Task contract를 갱신할 수 있다. 갱신된 Task contract는 User가 다시 받아들이거나 수정한다.

Mission spec이나 Mission design이 수정되어야 하면 specifying으로 돌아간다.

specifying으로 돌아갈 때 기존 Evidence와 판단 맥락은 새 기준선을 정하는 근거가 된다. 계약은 갱신되지만 근거는 보존된다.

### consolidating

consolidating은 수용된 Task들을 Mission 기준선과 대조하고, Mission 전체를 수용 판단할 수 있게 정리하는 단계다.

Orchestrator는 Task 결과와 Evidence를 Mission spec과 Mission design에 대조한다. 남은 항목은 추가 Task, gap, debt, follow-up, no action으로 분류하고, agent 측 권고와 회고 항목으로 정리한다.

추가 Task나 Task contract 갱신이 필요하면 building으로 돌아간다. Mission spec이나 Mission design이 수정되어야 하면 specifying으로 돌아간다. 기존 Evidence와 판단 맥락은 돌아간 단계의 기준선을 갱신하는 근거가 된다.

모든 Task가 수용된 상태는 Mission 수용 판단을 위한 근거 중 하나다. Mission 수준에서는 전체 목표와 Task 결과 사이의 gap, Evidence에 드러난 미검증 범위, 후속 Mission으로 넘길 항목, 현재 Mission에서 더 진행하지 않기로 한 debt, 반복 가능한 교훈이 남을 수 있다.

User는 consolidating에서 정리된 근거를 바탕으로 Mission을 완료로 받아들일지, 추가 Task를 요청할지, 보류하거나 중단할지 판단한다.

## 판단 경계

작업 운영에서 검증, 검토, 수용 판단은 섞이지 않는다.

- 검증은 agent 쪽 행위다. 테스트 실행, 리뷰, 실행 출력 확인, 변경 내역 제시, 미검증 범위 드러내기가 여기에 속한다.
- Evidence는 agent가 남기는 근거 자료다. Evidence에는 검증 근거와 미검증 범위가 함께 들어간다.
- 검토는 User 쪽 행위다. User가 Evidence를 읽고 필요한 경우 직접 확인하는 일이다.
- 수용 판단은 User 쪽 결정이다. 완료로 받아들일지, 재작업할지, 보류할지, 중단할지 결정한다.

역할 경계와 작업 연속성의 세부 기준은 문서 구성에서 연결한다.

## 문서 구성

|문서|책임|
|---|---|
|[roles.md](./roles.md)|User와 agent 역할의 책임 경계를 정의한다.|
|[mission.md](./mission.md)|Mission, Mission spec, Mission design, 운영 깊이, Mission 흐름을 정의한다.|
|[task.md](./task.md)|Task, Task contract, Task lifecycle, self-check, 재작업 흐름을 정의한다.|
|[evidence.md](./evidence.md)|Evidence, 검증 근거, 미검증 범위, review, verification, verdict 입력을 정의한다.|
|[continuity.md](./continuity.md)|중단된 작업을 이어 가기 위한 연속성 원칙과 상태 신뢰 경계를 정의한다.|
|[reflection.md](./reflection.md)|회고, memory 후보, debt 후보, gap, 후속 항목을 정의한다.|
