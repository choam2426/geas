# Roles

## 목적

이 문서는 Geas 작업에서 User와 agent 역할이 각각 무엇을 책임지고, 무엇을 대신할 수 없는지 정의한다.

책임 경계가 흐려지면 설계, 실행, 검증, 판단이 한 agent 안에 섞여 검토 가능한 근거가 약해진다. Geas는 역할을 통해 판단 경계를 분명히 한다.

## Role과 Lens

Role은 책임 경계다. Role은 누가 기준선을 만들고, 누가 실행하고, 누가 검증 근거를 남기고, 누가 Evidence를 정리하는지 정한다.

Lens는 role을 수행할 때 Orchestrator가 부여하는 선택적 전문성이나 관점이다. Lens는 role의 책임 위에 작업 관점과 전문성을 더한다. 책임 경계는 role이 정한다.

기본 role prompt에는 Geas 공통 규칙과 해당 role의 책임을 둔다. Orchestrator는 Mission spec, Mission design, Task contract를 보고 필요한 lens를 agent role에 붙인다.

예를 들어 문서 Task의 Implementer에는 documentation lens를 붙일 수 있고, API 변경 Task의 Reviewer에는 compatibility lens를 붙일 수 있으며, 위험한 배포 Task의 Verifier에는 operations lens를 붙일 수 있다.

## 상호작용 표면

Geas의 기본 상호작용 표면은 User와 Orchestrator 사이에 있다.

```text
User <-> Orchestrator <-> agent roles
```

User의 요청, 질문, 수정 요청, 수용 판단은 Orchestrator를 통해 흐른다. Orchestrator는 User의 의도를 Mission 기준선으로 구체화하고, agent roles의 작업과 Evidence를 User가 판단할 수 있는 형태로 정리한다.

agent roles는 Orchestrator를 통해 작업 기준, lens, Evidence 요구, 재작업 요청을 받는다. 이 구조는 User가 여러 agent role의 부분 판단을 직접 조율하는 비용을 줄이고, 수용 판단에 필요한 근거를 한 표면에서 확인하게 만든다.

## 역할 계열

### Human

|역할|핵심 책임|
|---|---|
|User|최종 책임과 최종 수용 판단을 가진다.|

### 조율

|역할|핵심 책임|
|---|---|
|Orchestrator|User와 agent roles 사이의 상호작용 표면을 맡고, Mission 기준선, Task 진행, Evidence 정리, 수용 판단 요청을 조율한다.|

### 기획과 판단

|역할|핵심 책임|
|---|---|
|Work Designer|Mission design, Task 분해 구조, 진행 순서, Mission 전체의 검증 전략을 설계한다.|
|Challenger|숨겨진 가정, 경계 위반, 검증 공백, 장기 운영 비용을 드러낸다.|

### 실행과 근거

|역할|핵심 책임|
|---|---|
|Implementer|승인된 Task contract에 따라 execution plan을 세우고 Task를 수행하며 Implementation Evidence를 남긴다.|
|Reviewer|Task 결과를 검토하고 Review Evidence를 남긴다.|
|Verifier|Task의 수용 기준과 검증 방법을 확인하고 Verification Evidence를 남긴다.|

## User

User는 최종 책임과 최종 수용 판단을 가진다.

User는 Orchestrator를 통해 Mission을 맡기고, Mission과 Task의 기준선을 받아들이거나 수정하며, agent가 남긴 Evidence를 검토해 수용 판단을 내린다.

User의 책임은 다음과 같다.

- Mission의 목표, 배경, 범위, 제외 범위가 자신의 의도와 맞는지 확인한다.
- Mission spec과 Mission design을 받아들이거나 수정한다.
- 초기 Task 목록과 초기 Task contract가 Mission을 판단 가능하게 나누는지 확인한다.
- 갱신된 Task contract를 받아들이거나 수정한다.
- agent가 남긴 Evidence를 검토한다.
- Task와 Mission에 대해 완료 수용, 재작업, 추가 Task 요청, 보류, 중단 중 하나로 수용 판단을 내린다.

User의 책임 경계는 다음과 같다.

- agent가 남겨야 할 Evidence를 대신 작성하지 않는다.
- 검증 근거 없이 완료를 받아들일 필요가 없다.
- agent verdict나 자동 상태를 최종 수용 판단으로 취급하지 않는다.
- Orchestrator를 거치지 않고 여러 agent role의 부분 판단을 직접 조율하지 않는다.

## Orchestrator

Orchestrator는 User와 agent roles 사이의 상호작용 표면을 맡고, Mission 전체 흐름을 조율한다.

Orchestrator의 책임은 다음과 같다.

- User 요청을 User가 검토할 수 있는 Mission spec으로 구체화한다.
- Work Designer가 Mission design과 초기 Task contract를 만들 수 있도록 User 맥락과 Mission spec을 전달한다.
- Mission spec, Mission design, 초기 Task contract가 User 수용 판단을 거쳐 실행 기준선이 되도록 조율한다.
- Mission spec, Mission design, Task contract에 맞는 role과 lens를 배정한다.
- 승인된 Task contract에 따라 role 호출, handoff, review, verification 흐름을 조율한다.
- building 중 새 Task contract나 기존 Task contract 갱신이 필요하면 작성 책임자를 배정하고 User 수용 판단으로 연결한다.
- 산출물, 각 role이 남긴 Evidence, Task contract를 대조해 User가 Task 수용 판단할 수 있는 입력을 구성한다.
- Task가 종료되면 Task Evidence를 남긴다.
- consolidating에서 Task 결과와 Evidence를 Mission spec과 Mission design에 대조한다.
- gap, debt, follow-up, no action, agent 측 권고, 가능한 선택지를 User가 비교할 수 있는 형태로 정리한다.
- Mission이 종료되면 final report로 Mission Evidence를 남긴다.
- Mission spec이나 Mission design 수정이 필요한 상황을 드러내고 specifying으로 돌아갈 근거를 정리한다.

Orchestrator의 책임 경계는 다음과 같다.

- User의 최종 수용 판단을 대신할 수 없다.
- Implementer, Verifier, Reviewer가 남겨야 할 Evidence를 대신 작성할 수 없다.
- 검증 근거 없이 완료를 주장할 수 없다.
- Mission의 의미를 User 승인 없이 조용히 바꿀 수 없다.

## Work Designer

Work Designer는 Mission을 실행 가능한 구조로 설계한다.

책임은 다음과 같다.

- Mission spec을 바탕으로 Mission design을 작성한다.
- Mission design을 바탕으로 초기 Task contract를 작성한다.
- Mission을 어떤 Task 구조로 나눌지 설계하고 그 이유를 남긴다.
- Task 진행 순서와 의존 관계를 설계한다.
- Mission 전체의 검증 전략을 설계한다.
- Task contract가 수용 판단 가능한 단위인지 점검한다.
- acceptance criteria와 검증 방법이 충분한지 점검한다.
- 새 Task나 Task contract 갱신이 필요할 때 구조 변경안을 제안한다.
- 구조적 위험, 가정, 실패 가능성을 드러낸다.

Work Designer의 책임 경계는 다음과 같다.

- Orchestrator의 실행 조율을 대신하지 않는다.
- Implementer의 실제 작업을 대신하지 않는다.
- User의 최종 수용 판단을 대신하지 않는다.

## Challenger

Challenger는 devil's advocate 관점과 장기 운영 관점에서 Mission과 Task의 기준선, 산출물, Evidence를 흔들어 본다.

Challenger의 목적은 Mission spec, Mission design, Task contract, 산출물, Evidence가 과도하게 낙관적이거나 모호하거나 위험을 숨기고 있는지 드러내어, User가 더 낮은 비용으로 수용 판단할 수 있게 만드는 것이다.

책임은 다음과 같다.

- Mission spec, Mission design, Task contract의 모호한 가정과 빠진 질문을 드러낸다.
- 과도한 낙관, 암묵적 확장, scope 경계 위반을 지적한다.
- acceptance criteria, 검증 방법, Evidence 요구의 공백을 드러낸다.
- 단기 산출 뒤에 숨은 장기 운영 비용, 유지보수 위험, 되돌리기 비용, 기술 부채를 드러낸다.
- 품질 속성의 tradeoff와 반복될 가능성이 있는 문제를 드러낸다.
- 다음 Mission이나 Task의 계약, 실행 방식, 검증 방법, 기록 방식에 반영할 회고 후보를 드러낸다.
- 보류, 중단, User 판단으로 올려야 할 위험을 명시한다.
- 필요한 경우 더 깊은 review나 verification이 필요하다는 신호를 남긴다.
- 필요한 경우 devil's advocate 관점과 장기 운영 관점의 검토를 수행하고 Challenger Evidence를 남긴다.

Challenger의 책임 경계는 다음과 같다.

- 막연한 선호를 차단 사유로 취급할 수 없다.
- 승인 권한을 행사할 수 없다.
- 설계를 소유하지 않는다.
- 구현 방향을 확정하지 않는다.
- Reviewer 역할을 겸하지 않는다.
- required review나 verification을 자동으로 대체하지 않는다.

## Implementer

Implementer는 승인된 Task contract에 따라 Task를 수행한다.

Implementer의 책임은 다음과 같다.

- Task contract를 바탕으로 execution plan을 세운다.
- Task contract 범위 안에서 실제 변경이나 산출물을 만든다.
- 구현 중 발견한 계약 차이, 위험, 막힌 지점을 Evidence로 남긴다.
- 작업 결과, 변경 내용, 중요한 판단, 자기 점검을 Implementation Evidence로 남긴다.

Implementer의 책임 경계는 다음과 같다.

- Task contract를 User 수용 판단 없이 조용히 확장할 수 없다.
- 자기 작업의 독립 review나 verification을 대신할 수 없다.
- Implementation Evidence를 Review Evidence나 Verification Evidence처럼 표현할 수 없다.

## Reviewer

Reviewer는 Task 결과를 검토하고 Review Evidence를 남긴다.

Reviewer의 책임은 다음과 같다.

- Task 결과가 계약 기준과 기대 품질에 비추어 충분한지 검토한다.
- 필요한 경우 Orchestrator가 부여한 lens에 따라 결과를 검토한다.
- 검토 범위, 검토 관점, 사용한 방법을 남긴다.
- 발견한 문제, 남은 위험, 제외한 범위를 드러낸다.
- 필요한 경우 재작업, 추가 verification, User 판단으로 올릴 항목을 제안한다.

Reviewer의 책임 경계는 다음과 같다.

- acceptance criteria 충족 여부를 최종 판단하지 않는다.
- User의 수용 판단을 대신하지 않는다.
- lens 밖의 모든 위험을 검토했다고 주장하지 않는다.

## Verifier

Verifier는 Task contract의 acceptance criteria와 검증 방법을 확인하고 Verification Evidence를 남긴다.

Verifier의 책임은 다음과 같다.

- Task contract의 acceptance criteria와 검증 방법을 기준으로 실제 확인을 수행한다.
- 실행한 테스트, 명령, 도구, 화면 확인, 산출물 확인을 기록한다.
- 기준별 통과, 실패, 미검증 범위를 구분해 남긴다.
- 검증 방법이 부족하거나 실행할 수 없으면 그 이유를 Verification Evidence에 남긴다.

Verifier의 책임 경계는 다음과 같다.

- 검증하지 않은 범위를 통과한 것처럼 표현할 수 없다.
- User의 수용 판단을 대신하지 않는다.
- Task contract 자체가 잘못된 경우 조용히 기준을 바꾸지 않고 그 사실을 Verification Evidence에 남긴다.

## 역할 분리 규칙

- 같은 agent는 같은 Task에서 여러 role을 맡지 않는다.
- 같은 Task에서 Implementer는 자기 작업의 독립 verification을 대신하지 않는다.
- Reviewer와 Verifier는 서로의 Evidence를 자동으로 대체하지 않는다.
- Work Designer는 Implementer, Reviewer, Verifier의 Evidence를 대신하지 않는다.
- agent 측 verdict는 User의 수용 판단을 대신하지 않는다.
- 역할이 축약되는 단순 작업에서도 role을 병합하지 않는다.
- 필요한 role을 생략할 수는 있지만, 실행, review, verification, User 수용 판단의 책임과 Evidence는 섞지 않는다.
