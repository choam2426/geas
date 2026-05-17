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

좋은 Task는 실행하기 쉬운 단위이기 전에 판단하기 쉬운 단위다. 하나의 Task는 User가 그 Task의 산출물과 Evidence만 보고 완료 수용, 재작업, 보류, 중단을 비교할 수 있는 크기와 경계를 가져야 한다. 하나의 Task 안에 서로 다른 수용 판단이 필요한 일이 섞이면 나누는 것이 좋다.

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

수용 판단은 Mission과 Task의 기준선을 받아들이는 판단에서 시작한다. User는 Mission spec이 자신의 목표와 맞는지, Mission design이 이해 가능한 진행 계획인지 확인한다.

초기 Task contract는 판단 가능한 Task 구조와 실행 기준으로 충분한지 확인하고 받아들이거나 수정한다.

기준선 합의는 별도 User Judgment artifact로 남기지 않는다. runtime에 남은 versioned Mission Spec, Mission Design, Task Contract는 User와 합의된 기준선이다.

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

### 단계별 운영 요약

|단계|입력|출력|진행 조건|멈추거나 돌아가는 조건|
|---|---|---|---|---|
|specifying|User 요청, 기존 runtime 상태, 관련 문서와 작업 맥락|합의된 Mission spec, Mission design, 필요한 Pre-build Design Surface 결정, 초기 Task contract|세 기준선이 각각 User에게 받아들여지고, 필요한 구현 전 결정이 Task contract에 반영되어 기록된다.|목표, 범위, 수용 기준, 판단 책임, 검증 경로, 구현 전 결정이 불명확하다.|
|building|수용된 Task contract, Run State, Task State, 관련 Evidence와 Memory|role별 Evidence, Task User Judgment, Task Evidence|Task 결과가 User 판단으로 닫히고 Task Evidence가 남는다.|재작업, Task contract 갱신, Mission 기준선 재검토, 보류, 중단이 필요하다.|
|consolidating|수용된 Task Evidence, 필요한 role별 Evidence, Mission 기준선|Mission 수용 판단 입력, gap, debt, follow-up 후보|Mission 전체를 User가 판단할 수 있을 만큼 근거와 남은 항목이 정리된다.|추가 Task, Task contract 갱신, Mission 기준선 갱신이 필요하다.|
|Mission 수용 판단|Mission 수용 판단 입력, Evidence, 남은 gap, debt, follow-up 후보|Mission User Judgment, Memory 반영, Mission Evidence|User가 Mission 결과를 수용하거나 한계를 알고 수용한다.|User가 재작업, 보류, 중단, 기준선 재검토를 판단한다.|

### User 판단 지점

User 판단은 기준선 합의와 결과 수용 판단으로 나뉜다.

- Mission Spec 합의: User의 목표, 배경, 범위, 제외 범위, 수용 기준이 맞는지 확인한다.
- Mission Design 합의: 접근 전략, 계획 outline, 판단 지점, 가정과 위험이 이해 가능한 계획인지 확인한다.
- Pre-build Design Surface 결정: Markdown 설명만으로 Task Contract 결정을 판단하기 어려운 경우 HTML, diagram, prototype, comparison 같은 임시 표면을 보고 선택한다.
- 초기 Task Contract 합의: Task 분리, 의존 관계, 개별 Task의 실행 범위, 산출물, 수용 기준, verification checks, review focus가 충분한지 확인한다.
- Task 결과 수용 판단: Task 결과와 Evidence를 보고 완료 수용, 재작업, 보류, 중단을 판단한다.
- Mission 결과 수용 판단: 수용된 Task들을 Mission 기준선과 다시 대조해 Mission을 닫을지 판단한다.

Mission Spec, Mission Design, 초기 Task Contract 합의와 그 사이의 Pre-build Design Surface 결정은 기준선 합의 흐름에 속한다. 이 합의는 Task나 Mission 결과에 대한 User Judgment artifact가 아니다. Task 결과와 Mission 결과에 대한 수용 판단은 Evidence를 검토한 뒤 별도 User Judgment로 남긴다.

### 단순 작업 축약 기준

단순한 작업에서도 Mission, Task, Evidence, User Judgment의 책임 경계는 유지한다. 다만 기준선과 Evidence의 길이는 작업 위험과 판단 비용에 맞게 짧게 쓸 수 있다.

단순 작업에서 축약할 수 있는 것은 설명의 양이다. 다음 항목은 생략하지 않는다.

- 무엇을 할지
- 어디까지 하지 않을지
- 어떤 기준이면 충분한지
- 어떤 검증 근거를 남길지
- 무엇을 확인하지 못했는지
- User가 어디서 수용 판단할지

### specifying

specifying은 User의 요청을 Mission 기준선과 Task 계약으로 구체화하는 단계다.

Orchestrator는 User 요청을 Mission 기준선으로 구체화하고, Mission spec, Mission design, 필요한 Pre-build Design Surface 결정, 초기 Task contract가 이어지도록 조율한다.

이 단계에서는 Mission spec, Mission design, 필요한 Pre-build Design Surface 결정, 초기 Task contract 순서로 기준선에 합의하고 남긴다.

- Mission spec은 User가 agent로 수행하려는 작업을 기획하는 기준선이다. 무엇을 이루려는지, 왜 필요한지, 어디까지 포함하거나 제외하는지, 어떤 결과를 충분하다고 볼지 고정한다.
- Mission design은 Mission spec을 사용자가 보기 좋은 진행 계획으로 바꾸는 기준선이다. 수용 판단 비용을 낮추기 위한 접근 전략, 핵심 개념, scope, 계획 outline, 판단 지점, 가정, 위험, 변경 trigger를 설명한다.
- Pre-build Design Surface는 Task contract를 쓰기 전에 User가 구현 전 결정을 낮은 비용으로 내리게 하는 임시 판단 표면이다. HTML, diagram, prototype, comparison을 사용할 수 있지만 runtime 정본이나 Evidence가 아니며, 선택된 결정만 Task contract에 반영한다.
- Task contract는 Task 분리와 개별 Task의 실행 계약이다. Task id, 의존 관계, 해당 Task가 맡는 Mission의 일부, 수행 범위, 산출물, 수용 기준, verification checks, review focus를 고정한다.

Task 분리와 dependency는 Task contract의 책임이다. Mission design과 Pre-build Design Surface는 Task graph의 정본이 아니다.

User는 Mission spec이 자신의 목표와 맞는지, Mission design이 이해 가능한 진행 계획인지, 필요한 구현 전 결정이 충분히 드러났는지, 초기 Task contract가 실행 기준으로 충분한지 확인하고 받아들이거나 수정한다. 합의된 기준선은 runtime에서 versioned Mission Spec, Mission Design, Task Contract로 남긴다.

### building

building은 승인된 Task contract를 실행 기준으로 삼아 Task를 수행하는 단계다.

Run State는 현재 Task를 찾고, Task State는 Task 내부의 현재 phase를 찾는다.

이 단계에서 agent는 Task contract를 바탕으로 더 세밀한 execution plan을 세운 뒤 작업하고, Implementation Evidence, Verification Evidence, Review Evidence를 남긴다. 필요한 경우 다음 Task contract를 구체화하거나 갱신한다.

building의 중심은 Task 수용 루프다.

```text
Task contract
  -> execution plan
  -> implementation
  -> Implementation Evidence
  -> verification
  -> review
  -> 수용 판단 입력
  -> Task 수용 판단
  -> Task Evidence(종료 시)
```

execution plan은 접근 순서, 세부 작업 단계, 예상 위험, 자체 점검 포인트를 정리한다. Task의 범위, 산출물, 수용 기준, Evidence 초점이 바뀌면 execution plan이 아니라 Task contract를 갱신한다.

building에서는 역할별 책임이 구분된다.

- Implementer는 execution plan을 세우고 Task를 수행하며 Implementation Evidence를 남긴다.
- Reviewer는 Task 결과를 점검·평가하고 Review Evidence를 남긴다.
- Challenger는 devil's advocate 관점에서 Task 결과와 Evidence를 압박해 보고 Challenger Evidence를 남긴다.
- Verifier는 Task의 acceptance criteria와 verification checks를 확인하고 Verification Evidence를 남긴다.
- Orchestrator는 산출물, 각 role이 남긴 Evidence, Task contract를 대조해 User가 수용 판단할 수 있는 입력을 구성한다.

User는 산출물과 Evidence를 보고 Task를 받아들일지, 재작업할지, 보류할지, 중단할지 판단한다. agent 측 verdict나 권고는 이 결정을 돕는 근거 자료다. Task가 종료되면 Orchestrator는 Task Evidence를 종료 요약으로 남긴다.

runtime에서 재작업, Task contract 갱신, 추가 Task, Mission 기준선 재검토, 폐기는 `User Judgment.decision: revise`와 `requested_actions`로 표현한다.

building 안에서 다음 Task contract를 구체화하거나 개별 Task contract를 갱신할 수 있다. 갱신된 Task contract는 새 `task-contract-NNN.yaml`로 남기고, User가 다시 받아들이거나 수정한다.

Mission 진행 방식, 주요 scope framing, 판단 지점, 가정, 위험, 변경 trigger가 바뀌면 Mission design을 갱신한다. Task 추가, 삭제, dependency, Task별 Mission coverage, 실행 범위, 산출물, 수용 기준, verification checks, review focus, 위험 수준이 바뀌면 Task contract를 갱신한다.

Mission spec이나 Mission design이 수정되어야 하면 specifying으로 돌아간다.

specifying으로 돌아갈 때 기존 Evidence와 판단 맥락은 새 versioned 기준선을 정하는 근거가 된다. 계약은 갱신되지만 근거는 보존된다.

### consolidating

consolidating은 수용된 Task들을 Mission 기준선과 대조하고, Mission 전체를 수용 판단할 수 있게 정리하는 단계다.

Orchestrator는 Task 결과와 Evidence를 Mission spec과 Mission design에 대조한다. gap, debt, follow-up 후보를 정리하고, 추가 Task나 기준선 갱신이 필요한지 확인한다.

추가 Task나 Task contract 갱신이 필요하면 building으로 돌아간다. Mission spec이나 Mission design이 수정되어야 하면 specifying으로 돌아간다. 기존 Evidence와 판단 맥락은 돌아간 단계의 새 versioned 기준선을 정하는 근거가 된다.

모든 Task가 수용된 상태는 Mission 수용 판단을 위한 근거 중 하나다. Mission 수준에서는 전체 목표와 Task 결과 사이의 gap, Evidence에 드러난 미검증 범위, follow-up 후보, 현재 Mission에서 더 진행하지 않을 debt가 남을 수 있다. 반복 가능한 교훈은 Mission 수용 판단 이후 회고에서 memory 후보로 정리한다.

User는 consolidating에서 정리된 근거를 바탕으로 Mission을 완료로 받아들일지, 추가 Task를 요청할지, 보류하거나 중단할지 판단한다.

Mission이 종료되면 Orchestrator는 Mission Evidence를 final report로 남긴다.

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
|[mission.md](./mission.md)|Mission, Mission spec, Mission design, Mission 흐름을 정의한다.|
|[task.md](./task.md)|Task, Task contract, Task 흐름, 재작업 흐름을 정의한다.|
|[evidence.md](./evidence.md)|Evidence, 검증 근거, 미검증 범위, role별 Evidence, Task Evidence, Mission Evidence를 정의한다.|
|[continuity.md](./continuity.md)|중단된 작업을 이어 가기 위한 연속성 원칙과 상태 신뢰 경계를 정의한다.|
|[reflection.md](./reflection.md)|회고 후보, memory, debt, gap, follow-up을 정의한다.|
