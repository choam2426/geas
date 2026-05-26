# Roles

## 목적

이 문서는 Geas Workflow에서 User와 agent roles가 각각 무엇을 책임지고, 무엇을 대신할 수 없는지 정의한다.

책임 경계가 흐려지면 기준 수립, 실행, 검증, review, challenge, 수용 판단이 한 표면에 섞인다. Geas는 역할을 통해 agent가 준비하는 Evidence와 User가 내리는 `User Judgment`를 분리한다.

## Role

Role은 책임 경계다. Role은 누가 작업 기준을 정리하고, 누가 실행하고, 누가 검증 근거를 남기고, 누가 Evidence를 User가 읽을 수 있게 묶는지 정한다.

Role은 전문 관점이나 취향의 이름이 아니다. Role은 어떤 산출물과 Evidence를 책임지는지, 어떤 판단을 대신할 수 없는지 드러내는 장치다.

## 상호작용 표면

Geas의 기본 상호작용 표면은 User와 Orchestrator 사이에 있다.

```text
User <-> Orchestrator <-> agent roles
```

Orchestrator는 Geas Workflow를 진행하는 메인 Agent이며, User와 agent roles 사이의 상호작용 표면이다.

User의 요청, 질문, 수정 요청, 수용 판단은 Orchestrator를 통해 흐른다. Orchestrator는 User 요청을 `Mission Spec`, `Mission Plan`, Task Direction, `Task Contract`로 구체화하고, agent roles의 작업과 Evidence를 User가 판단할 수 있는 형태로 정리한다.

agent roles는 Orchestrator를 통해 작업 기준, Evidence 초점, 재작업 요청을 받는다. 이 구조는 User가 여러 agent role의 부분 결과를 직접 조율하는 비용을 줄이고, 수용 판단에 필요한 근거를 한 표면에서 확인하게 만든다.

## User

User는 최종 책임과 최종 수용 판단을 가진다.

User는 Orchestrator를 통해 Mission을 맡기고, Mission과 Task의 기준을 받아들이거나 수정하며, agent가 남긴 Evidence를 검토해 `User Judgment`를 남긴다.

User의 책임은 다음과 같다.

- Mission의 목표, 배경, 범위, 제외 범위가 자신의 의도와 맞는지 확인한다.
- `Mission Spec`을 받아들이거나 수정한다.
- `Mission Plan`이 Mission을 판단 가능한 Task 흐름으로 옮기는지 확인한다.
- Task Direction이 해당 Task의 접근, 디자인 방향, 산출물 형태, 구현 전략, tradeoff를 충분히 드러내는지 판단한다.
- `Task Contract`가 Task 경계, 산출물, 수용 기준, 확인 방법, review 초점을 판단 가능한 실행 단위로 잡는지 확인한다.
- agent가 남긴 Evidence를 검토한다.
- Task 결과를 수용, 재작업, 취소 중 하나로 판단한다.
- Mission 결과를 완료 수용, 추가 진행, 취소 중 하나로 판단한다.

User의 책임 경계는 다음과 같다.

- agent가 남겨야 할 Evidence를 대신 작성하지 않는다.
- 검증 근거 없이 완료를 받아들일 필요가 없다.
- agent verdict나 자동 상태를 최종 수용 판단으로 취급하지 않는다.
- Orchestrator를 거치지 않고 여러 agent role의 부분 결과를 직접 조율하지 않는다.

## Orchestrator

Orchestrator는 User와 agent roles 사이의 상호작용 표면이다.

Orchestrator의 핵심 책임은 agent 작업을 직접 수행하는 것이 아니라, User 의도와 agent 실행 사이에 판단 가능한 기준, Evidence, 요약, 기록을 유지하는 것이다.

Orchestrator의 책임은 다음과 같다.

- User 요청을 User가 검토할 수 있는 `Mission Spec`으로 구체화한다.
- `Mission Spec`을 쓰기 전에 Intake Interview로 목표, 배경, 포함 범위, 제외 범위, 성공 기준, 제약, 검증 가능성, 위험, User가 결정해야 할 항목을 확인한다.
- `Mission Spec`을 바탕으로 `Mission Plan`을 작성하고 User 수용으로 연결한다.
- Task specifying에서 Task Direction과 `Task Contract`를 정리하고 User 수용으로 연결한다.
- `Mission Spec`, `Mission Plan`, Task Direction, `Task Contract`, 필요한 입력을 agent roles에 전달할 handoff로 정리한다.
- Role Evidence와 산출물을 받아 `Task Contract`에 대조하고, User가 읽을 수 있는 Task 요약으로 묶는다.
- User가 Task 결과를 수용, 재작업, 취소로 판단할 수 있게 검증 근거, 미검증 범위, 남은 위험을 드러낸다.
- building 중 새 Task가 필요하거나 기존 Task 기준이 바뀌어야 하면 Task Direction이나 `Task Contract` 갱신을 User 수용으로 연결한다.
- `User Judgment` 뒤에 `Task Evidence`를 남긴다.
- Task가 끝나면 같은 Mission 안의 이후 Task에 필요한 `Task Memory` 갱신을 조율한다.
- consolidating에서 수용된 Task 결과와 Evidence를 `Mission Spec`과 `Mission Plan`에 대조한다.
- Mission 중 받아들인 위험, 미검증 범위, 장기 기록 후보를 User가 완료 수용, 추가 진행, 취소 중 하나로 판단할 수 있는 형태로 정리한다.
- Mission User Judgment 뒤에 `Mission Evidence`를 남긴다.
- consolidating에서 `Debt Ledger`, Memory, `Continuity Ledger` 반영을 조율한다.
- `Mission Spec`이나 `Mission Plan` 수정이 필요한 상황을 드러내고 specifying으로 돌아갈 근거를 정리한다.

Orchestrator의 책임 경계는 다음과 같다.

- User의 최종 수용 판단을 대신할 수 없다.
- implement, verify, review, challenge를 직접 수행하지 않는다.
- Implementer, Verifier, Reviewer, Challenger가 남겨야 할 Role Evidence를 대신 작성할 수 없다.
- 검증 근거 없이 완료를 주장할 수 없다.
- Mission의 의미를 User 수용 없이 조용히 바꿀 수 없다.
- Task Direction이나 `Task Contract`를 User 수용 없이 조용히 확장할 수 없다.

## Implementer

Implementer는 수용된 Task Direction과 `Task Contract`를 작업 기준으로 삼아 Task를 수행한다.

Implementer의 책임은 다음과 같다.

- Starting Context를 먼저 읽고 작업에 필요한 기준과 입력을 이해한다.
- Task Direction의 결정과 `Task Contract`의 Scope, Deliverables, Execution Guardrails 안에서 실제 변경이나 산출물을 만든다.
- Impact Surface를 보고 변경이 닿을 수 있는 파일, 문서, UI 흐름, 데이터, 의존 관계를 확인한다.
- 구현 중 발견한 기준 차이, 위험, 막힌 지점을 `Implementation Evidence`에 남긴다.
- 변경 내용, 구현 판단, self check, 확인하지 못한 범위와 한계를 `Implementation Evidence`로 남긴다.

Implementer의 책임 경계는 다음과 같다.

- Task Direction이나 `Task Contract`를 User 수용 없이 조용히 확장할 수 없다.
- 자기 작업의 독립적인 `Review Evidence`나 `Verification Evidence`를 대신 작성할 수 없다.
- `Implementation Evidence`를 `Review Evidence`나 `Verification Evidence`처럼 표현할 수 없다.

## Verifier

Verifier는 `Task Contract`의 Acceptance Criteria와 Verification Strategy에 따라 실제 확인을 수행하고 `Verification Evidence`를 남긴다.

Verifier의 책임은 다음과 같다.

- Acceptance Criteria와 Verification Strategy를 기준으로 테스트, 명령, 도구, 화면 확인, 산출물 확인을 수행한다.
- 실행한 check, 출력, 환경, 대상, 기준별 결과를 남긴다.
- 기준별 통과, 실패, 부분 충족, 미검증 범위, 막힌 지점을 구분한다.
- Verification Strategy가 부족하거나 실행할 수 없으면 그 이유를 `Verification Evidence`에 남긴다.
- verification 관점의 verdict를 남긴다.

Verifier의 책임 경계는 다음과 같다.

- 검증하지 않은 범위를 통과한 것처럼 표현할 수 없다.
- `User Judgment`는 `Verification Evidence`를 검토한 뒤 User가 별도로 남긴다.
- `Task Contract` 자체가 잘못된 경우 조용히 기준을 바꾸지 않고 그 사실을 `Verification Evidence`에 남긴다.
- verification verdict를 User 수용 판단처럼 표현할 수 없다.

## Reviewer

Reviewer는 `Task Contract`의 Review And Challenge Focus에 따라 Task 결과와 관련 Evidence를 점검하고 `Review Evidence`를 남긴다.

Reviewer의 책임은 다음과 같다.

- Task 결과가 계약 기준과 기대 품질에 비추어 충분한지 점검한다.
- 품질, 경계, 누락, 사용자 영향, edge case, 유지보수 위험, Evidence 충분성을 확인한다.
- 사용한 review focus, 점검 범위, 점검하지 않은 범위, review 방법을 남긴다.
- 발견한 문제, 남은 위험, 재작업 후보를 드러낸다.
- 추가 verification, challenge, User 판단으로 올릴 항목을 제안한다.
- review 관점의 verdict를 남긴다.

Reviewer의 책임 경계는 다음과 같다.

- Acceptance Criteria 충족 여부를 최종 판단하지 않는다.
- `User Judgment`는 `Review Evidence`를 검토한 뒤 User가 별도로 남긴다.
- 점검하지 않은 모든 위험을 확인했다고 주장하지 않는다.
- review verdict를 User 수용 판단처럼 표현할 수 없다.

## Challenger

Challenger는 `challenge` 단계에서 Task 기준, 산출물, Evidence를 압박해 User가 수용 판단 전에 보기 어려운 위험을 드러낸다.

Challenger의 목적은 Task 결과와 Evidence가 과도하게 낙관적이거나 모호하거나 위험을 숨기고 있는지 드러내어, User가 더 낮은 비용으로 수용 판단할 수 있게 만드는 것이다.

Challenger의 책임은 다음과 같다.

- 숨은 가정, 암묵적 scope 확장, 경계 위반을 finding과 근거로 드러낸다.
- Acceptance Criteria, Verification Strategy, Review And Challenge Focus의 공백을 finding과 근거로 드러낸다.
- 단기 산출 뒤에 숨은 장기 비용, 유지보수 위험, 되돌리기 비용, 품질 부채를 finding과 근거로 드러낸다.
- 품질 속성의 tradeoff와 반복될 가능성이 있는 문제를 finding과 근거로 드러낸다.
- User 판단으로 올려야 할 위험과 더 깊은 review나 verification이 필요한 지점을 남긴다.
- 다음 Mission이나 Task의 계약, 실행 방식, verification, 기록 방식에 반영할 Reflection Candidates를 드러낸다.
- challenge 관점의 verdict를 남긴다.
- `Challenger Evidence`를 남긴다.

Challenger의 책임 경계는 다음과 같다.

- 막연한 선호를 차단 사유로 취급할 수 없다.
- 승인 권한을 행사할 수 없다.
- 구현 방향을 확정하지 않는다.
- Reviewer나 Verifier의 필수 점검을 대신하지 않는다.
- challenge verdict를 User 수용 판단처럼 표현할 수 없다.

## 역할 분리 규칙

- 같은 agent는 같은 Task에서 여러 role을 맡지 않는다.
- 같은 Task에서 Implementer의 self check와 독립 verification은 분리한다.
- Implementer, Verifier, Reviewer, Challenger의 Evidence 작성 책임은 서로 섞지 않는다.
- Reviewer와 Verifier Evidence는 서로 다른 관점의 Evidence로 함께 읽는다.
- Challenger finding은 승인, 구현 지시, User 수용 판단이 아니다.
- agent verdict는 `User Judgment`가 아니다.
- `User Judgment`는 Evidence를 검토한 뒤 User가 별도로 남긴다.
- Orchestrator는 Role Evidence를 대신 작성하지 않는다.
- 생략되는 role이 있어도 실행, review, verification, challenge, User 수용 판단의 책임과 Evidence는 섞지 않는다.
