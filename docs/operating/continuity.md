# Continuity

## 목적

이 문서는 중단된 Mission이나 Task를 이어 가기 위한 연속성 원칙과 상태 신뢰 경계를 정의한다.

Continuity의 목표는 agent가 대화 맥락을 잃어도 계약, Evidence, 수용 판단을 기준으로 작업을 다시 이해할 수 있게 하는 것이다.

## 기본 관점

상태 표시는 정본이 아니다.

Mission이나 Task가 어떤 상태로 표시되어 있어도, 그 상태는 계약과 Evidence를 찾아가기 위한 인덱스일 뿐이다. 실제 판단의 기준은 다음이다.

- Mission spec
- Mission design
- Task contract
- Evidence
- User의 수용 판단
- 회고와 후속 항목

상태 표시와 근거가 어긋나면 근거를 우선한다.

## 복원 절차

작업을 이어 갈 때는 다음 순서로 확인한다.

1. 현재 Mission 목표와 Mission spec을 확인한다.
2. Mission design이 있으면 현재 작업 기준으로 유효한지 확인한다.
3. 진행 중이거나 마지막으로 다룬 Task contract를 확인한다.
4. Task Evidence와 Implementation Evidence를 확인한다.
5. Evidence 안에 어떤 검증 근거와 미검증 범위가 남았는지 확인한다.
6. User의 수용 판단이 있었는지 확인한다.
7. 회고, gap, debt, 후속 항목이 있는지 확인한다.
8. 현재 이어 갈 위치를 판단한다.

복원 결과는 specifying, building, consolidating 중 어느 단계로 돌아갈지로 표현한다.

## drift

drift는 상태 표시, 작업 트리, Evidence, 계약이 서로 어긋난 상태를 말한다.

예시는 다음과 같다.

- Task가 passed로 표시되어 있지만 Verification Evidence가 없다.
- 작업 트리에 변경이 있지만 어떤 Task contract와 연결되는지 알 수 없다.
- Mission scope 밖 변경이 섞여 있다.
- User 수용 판단이 없는데 완료로 표시되어 있다.
- Implementation Evidence는 있지만 review나 verification이 없다.

drift가 발견되면 조용히 진행하지 않는다.

## drift 처리 원칙

drift는 다음 순서로 처리한다.

1. 계약과 Evidence를 우선 읽는다.
2. 상태 표시가 계약과 Evidence에 맞는지 확인한다.
3. 맞지 않으면 어떤 부분이 어긋났는지 기록한다.
4. 자동으로 복원할 수 있으면 근거를 남기고 이어 간다.
5. 자동으로 복원할 수 없으면 blocked 또는 escalated로 다룬다.

복원할 수 없는 상태에서 임의로 완료, passed, accepted를 만들지 않는다.

## 중단과 재개

작업이 중단될 수 있는 이유는 다음과 같다.

- User 입력 대기
- 검증 실패
- 외부 의존성 문제
- 권한이나 환경 문제
- scope 변경 필요
- 판단 근거 부족
- agent 실행 중단

재개할 때는 "무엇을 하던 중이었는가"보다 "어떤 계약과 Evidence를 기준으로 어디까지 판단할 수 있는가"를 먼저 본다.

## 안전 원칙

- 근거 없는 상태 표시는 신뢰하지 않는다.
- partial Evidence는 완전한 Evidence처럼 소비하지 않는다.
- dirty workspace는 Task contract와 Evidence에 연결해 읽는다.
- 완료나 accepted 주장에 User 수용 판단이 없으면 완료로 보지 않는다.
- 어떤 근거를 신뢰할지 판단할 수 없으면 escalated로 다룬다.

## Continuity 결과

Continuity 결과는 다음 중 하나여야 한다.

|결과|의미|
|---|---|
|목표로 복귀|Mission 목표나 scope를 다시 확인해야 한다.|
|계약으로 복귀|Mission spec, Mission design, Task contract를 갱신해야 한다.|
|실행으로 복귀|Task 작업을 이어 가거나 재작업해야 한다.|
|검증으로 복귀|Evidence가 부족해 추가 확인이 필요하다.|
|결정으로 복귀|Evidence는 있으나 User 수용 판단이 필요하다.|
|회고로 복귀|수용 판단은 있었고 후속 항목 정리가 필요하다.|
|blocked|외부 입력이나 조건 없이는 진행할 수 없다.|
|escalated|agent가 판단할 수 없어 User 또는 상위 Mission 판단이 필요하다.|

Continuity는 별도 완료 선언이 아니다. 이어 갈 위치와 근거를 정하는 절차다.
