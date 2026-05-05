# Evidence

## 목적

이 문서는 Geas 작업에서 Evidence의 의미, 검증 근거와 미검증 범위, role별 Evidence, Task Evidence, Mission Evidence의 책임 경계를 정의한다.

Evidence는 agent가 User의 검토와 수용 판단을 돕기 위해 검증 근거와 미검증 범위를 함께 정리한 근거 자료다.

## Evidence의 역할

Evidence는 User가 계약 기준, 실제 결과, 검증 근거, 미검증 범위, 남은 위험을 낮은 비용으로 대조할 수 있게 만든다.

Evidence는 다음 질문에 답해야 한다.

- 무엇을 했는가?
- 계약 기준과 어떻게 대응하는가?
- 무엇을 확인했는가?
- 무엇을 확인하지 못했는가?
- 확인 결과는 무엇인가?
- 남은 위험은 무엇인가?

## 검증 근거

검증 근거는 Task contract에 따라 만들어진 산출물이나 변경 결과를 정해진 기준과 방법으로 확인하고, 그 결과를 User가 다시 살펴볼 수 있게 남긴 자료다.

검증 근거의 중심 대상은 Task 산출물과 그 산출물이 계약 기준에 대응하는 방식이다.

검증 근거에는 다음 내용이 들어갈 수 있다.

- 실행한 테스트, 명령, 도구와 결과
- 실행 출력, 로그, 화면 관찰 결과
- 리뷰에서 확인한 범위와 발견 사항
- 확인한 파일, 화면, 산출물, 변경 결과의 참조
- acceptance criteria별 결과
- Task contract 기준과 결과의 대응

## 미검증 범위

미검증 범위는 Task 산출물이나 변경 결과 중 agent가 정해진 기준과 방법으로 확인하지 못한 부분이다.

미검증 범위는 실패와 다르다. 실패는 확인한 결과 기준을 만족하지 못한 것이고, 미검증 범위는 확인하지 못해 판단 근거가 없는 것이다.

미검증 범위에는 다음 내용이 들어갈 수 있다.

- 실행하지 못한 테스트나 검증 방법
- 확인하지 못한 환경
- 검토하지 못한 파일, 화면, 산출물
- 시간이나 접근 권한 때문에 확인하지 못한 범위
- Task contract 기준 중 결과를 확인하지 못한 항목
- 확인하지 못해 판단 근거가 부족한 위험

## Evidence 흐름

Task 수용 판단 전에는 각 role이 자기 Evidence를 남긴다. Orchestrator는 산출물, role별 Evidence, Task contract를 대조해 판단 입력을 구성하고, 가능한 선택지와 agent 측 권고를 User에게 제시한다.

Mission 수용 판단 전에는 Orchestrator가 Task Evidence, 필요한 role별 Evidence, Mission spec, Mission design을 대조해 판단 입력을 구성하고, 가능한 선택지와 agent 측 권고를 User에게 제시한다.

이 입력은 User의 수용 판단을 대체하지 않는다.

Task가 수용 판단으로 종료되면 Orchestrator가 그 판단까지 포함해 Task Evidence를 남긴다. Task Evidence는 다음 작업, 회고, 컨텍스트 복원을 위해 빠르게 훑을 수 있는 종료 요약 Evidence다.

Mission이 수용 판단과 회고로 종료되면 Orchestrator가 Mission Evidence를 남긴다. Mission Evidence는 Mission 전체를 다시 열어볼 때 출발점이 되는 final report다.

## Evidence 종류

### Task Evidence

Task Evidence는 Task가 수용 판단으로 종료된 뒤 Orchestrator가 Task 결과, User 수용 판단, 주요 Evidence 참조, 남은 항목을 짧게 정리해 남기는 종료 요약 Evidence다.

포함할 내용은 다음과 같다.

- Task 결과 요약
- User의 Task 수용 판단
- Task contract 기준에 대한 결과 요약
- 주요 Evidence 참조
- 미검증 범위와 남은 위험
- 남은 항목

### Mission Evidence

Mission Evidence는 Mission이 수용 판단과 회고로 종료된 뒤 Orchestrator가 Mission 기준선, Task 결과, Evidence, User 수용 판단, 남은 항목, 반영한 memory를 종합해 남기는 final report다.

포함할 내용은 다음과 같다.

- Mission 결과 요약
- User의 Mission 수용 판단
- Mission spec 기준별 결과
- Mission design과 실제 진행의 차이
- Task별 결과와 Task Evidence 참조
- 주요 검증 근거 요약
- 미검증 범위
- 남은 위험
- gap, debt, follow-up 분류
- 회고 요약
- 반영한 memory
- 다음 Mission이나 Task에 적용할 운영 기준

### Role Evidence

Role Evidence는 각 role이 자기 책임 범위에서 Task 결과를 이해하고 판단하는 데 필요한 근거를 남긴 자료다.

Role Evidence에는 해당 role을 수행하며 드러난 회고 후보가 들어갈 수 있다. 회고 후보는 다음 Task나 Mission의 계약, 실행 방식, 검증 방법, 기록 방식에 반영할 만한 신호다.

#### Implementation Evidence

Implementation Evidence는 Implementer가 Task contract 안에서 실제로 무엇을 만들거나 바꿨는지, 그 과정에서 어떤 판단을 했는지, 산출물을 넘기기 전에 어디까지 자기 점검했는지를 남기는 Evidence다. 이는 Task 결과의 내용과 구현 맥락을 이해하기 위한 근거다.

포함할 내용은 다음과 같다.

- 수행한 작업 요약
- 변경 또는 생성한 산출물
- 영향을 받은 범위
- 중요한 판단과 이유
- 관련 기준선이나 참조
- 계약과 달라진 점이나 갱신이 필요한 지점
- 자기 점검 범위와 발견한 한계
- 회고 후보

자기 점검은 Implementer가 산출물을 넘기기 전에 스스로 확인한 범위와 발견한 한계를 드러내는 데 둔다.

#### Verification Evidence

Verification Evidence는 Verifier가 Task contract의 acceptance criteria와 검증 방법에 따라 무엇을 실제로 확인했는지, 어떤 결과가 나왔는지, 어떤 항목이 실패하거나 미검증으로 남았는지를 남기는 Evidence다. 이는 User가 수용 판단할 수 있도록, Verifier가 기준 충족 여부에 대한 agent 측 판단 입력을 남기는 근거다.

포함할 내용은 다음과 같다.

- 실행한 검증 방법
- 검증 환경이나 조건
- 검증 대상과 기준선 버전
- acceptance criteria별 결과
- 실행 출력 또는 관찰 결과
- 실패한 기준과 관찰된 문제
- 절차에서 벗어난 점이나 특이 사항
- 미검증 범위와 이유
- 보정 또는 재검증이 필요한 항목
- 회고 후보

#### Review Evidence

Review Evidence는 Reviewer가 산출물과 관련 Evidence를 어떤 기준과 범위에서 점검·평가했는지, 어떤 품질 문제나 적합성 문제를 발견했는지, 어떤 남은 위험과 권고를 제시하는지 남기는 Evidence다. 이는 산출물이 계약 기준과 기대 품질에 비추어 충분한지 살피기 위한 근거다.

포함할 내용은 다음과 같다.

- 점검·평가 기준과 관점
- 점검·평가 대상
- 점검·평가 범위
- 점검·평가 방식
- 발견한 문제와 근거
- 문제의 중요도나 처리 필요성
- 남은 위험
- 제외한 범위
- verdict와 권고
- 회고 후보

#### Challenger Evidence

Challenger Evidence는 Challenger가 기준선, 산출물, Evidence를 devil's advocate 관점과 장기 운영 관점에서 압박해 어떤 숨은 가정, scope 경계 위반, 검증 공백, 과도한 낙관, 장기 비용을 드러냈는지 남기는 Evidence다. 이는 User 수용 판단 전에 놓치기 쉬운 위험을 드러내기 위한 근거다.

Challenger Evidence는 Mission 수준과 Task 수준에서 남을 수 있다.

Mission-level Challenger Evidence는 Mission spec, Mission design, 초기 Task contract, Mission 전체 검증 전략을 대상으로 한다. 이 Evidence는 Mission 기준선이 과도하게 낙관적이거나, scope 경계가 흐리거나, 장기 운영 비용과 구조적 위험을 숨기고 있는지 드러낸다.

Task-level Challenger Evidence는 Task contract, 산출물, Implementation Evidence, Verification Evidence, Review Evidence를 대상으로 한다. 이 Evidence는 Task 수용 판단 전에 숨은 가정, 검증 공백, 암묵적 scope 확장, 장기 유지보수 위험을 드러낸다.

포함할 내용은 다음과 같다.

- 압박한 수준과 대상
- 드러난 모호한 가정이나 빠진 질문
- 과도한 낙관, 암묵적 확장, scope 경계 위반
- acceptance criteria, 검증 방법, Evidence 요구의 공백
- 장기 운영 비용이나 유지보수 위험
- 품질 속성의 tradeoff
- 반복될 가능성이 있는 문제
- 보류, 중단, User 판단으로 올려야 할 위험
- 더 깊은 review나 verification이 필요한 지점
- 가능한 완화 방향
- 회고 후보

## Verdict

verdict는 Verification Evidence, Review Evidence, Challenger Evidence에서 agent 측 판단 입력으로 사용한다. Implementation Evidence는 산출물, 실행 중 판단, 자기 점검 범위와 한계를 남기는 데 둔다.

verdict는 Task 전체에 대한 최종 판정이 아니라, 해당 Evidence가 맡은 관점에서 Task 결과를 어떻게 볼지 제시하는 agent 측 판단 입력이다.

verdict 값은 다음 세 가지로 제한한다.

|verdict|의미|
|---|---|
|passed|이 Evidence가 맡은 관점에서는 Task 결과가 Task contract를 충족한다고 볼 근거가 있다.|
|changes_requested|Task 결과가 Task contract를 충족하려면 수정이나 재확인이 필요하다.|
|escalated|Task contract 안에서 판단하기 어려워 User 또는 Mission 수준 판단이 필요하다.|

verdict는 agent 측 판단 입력이다. 최종 완료는 User가 Evidence를 검토하고 수용 판단을 남겨야 성립한다.

## Evidence 품질 기준

충분한 Evidence는 User가 계약 기준, 결과, 남은 위험을 비교할 수 있는 상태를 만든다.

좋은 Evidence는 다음 조건을 만족한다.

- 계약 기준과 연결되어 있다.
- 확인한 것과 확인하지 못한 것을 구분한다.
- 실행 출력이나 관찰 결과처럼 재검토 가능한 근거를 남긴다.
- 남은 위험과 User 판단 지점을 드러낸다.
- agent 측 verdict와 User 수용 판단을 구분한다.

## 책임 경계

Evidence의 책임 경계는 다음과 같다.

- Evidence는 User의 수용 판단을 대체하지 않는다.
- 미검증 범위는 검증 근거처럼 표현하지 않는다.
- 테스트나 확인을 실행하지 않았다면 검증된 것으로 표현하지 않는다.
- Implementation Evidence는 verdict를 포함하지 않는다.
- role별 Evidence는 서로를 자동으로 대체하지 않는다.
- role별 Evidence의 작성 책임은 해당 role에 있다.
- Orchestrator의 책임은 판단 입력, Task Evidence, Mission Evidence를 구성하는 것이다.
- agent 측 권고는 Evidence와 verdict를 바탕으로 한 판단 입력으로 표현한다.
- agent verdict나 자동 상태는 User 수용 판단처럼 표현하지 않는다.
