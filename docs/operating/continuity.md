# Continuity

## 목적

이 문서는 중단된 Mission이나 Task를 이어 갈 때 진행 상태 기록을 출발점으로 복귀 지점을 정하는 기준을 정의한다. 진행 상태 기록이 계약, Evidence, User 수용 판단과 어긋나면 복귀 지점은 계약, Evidence, User 수용 판단을 기준으로 다시 정한다.

Continuity의 목표는 대화 맥락, 세션, 컨텍스트 압축 이후에도 agent가 진행 상태 기록, 계약, Evidence, User 수용 판단, 회고를 기준으로 작업을 다시 이어 갈 수 있게 하는 것이다.

## 기본 관점

Continuity는 작업을 재개하기 전에 진행 상태 기록, 계약, Evidence, User 수용 판단을 대조해 복귀 지점을 정하는 절차다.

진행 상태 기록은 현재 Mission 흐름, 현재 Task, 마지막으로 확인한 계약, 연결된 Evidence, 마지막 User 수용 판단, 대기 중인 판단을 빠르게 찾기 위한 작업 위치 기록이다.

복귀 지점은 계약, Evidence, User 수용 판단을 기준으로 정한다.

## 복원 절차

작업을 이어 갈 때는 다음 순서로 확인한다.

1. 진행 상태 기록에서 현재 흐름, 현재 Task, 마지막으로 확인한 계약, 연결된 Evidence, 마지막 User 수용 판단, 대기 중인 판단을 확인한다.
2. Mission spec과 Mission design을 확인한다.
3. 진행 중이거나 마지막으로 다룬 Task contract를 확인한다.
4. 산출물과 작업 트리 변경이 Task contract와 연결되는지 확인한다.
5. Mission Evidence, Task Evidence, role별 Evidence를 확인한다.
6. Evidence가 드러내는 검증 근거, 미검증 범위, 남은 위험을 확인한다.
7. 마지막 User 수용 판단을 확인한다.
8. 회고나 후속 항목이 복귀 지점에 영향을 주는지 확인한다.
9. 복귀 지점을 정한다.

## drift

drift는 진행 상태 기록, 작업 트리, 계약, Evidence, User 수용 판단이 서로 다른 복귀 지점을 가리키는 상태다.

예시는 다음과 같다.

- 진행 상태 기록은 Task 수용 완료를 가리키지만 User 수용 판단이나 Task Evidence가 없다.
- 작업 트리 변경이 어떤 Task contract에 속하는지 불명확하다.
- 산출물이나 Evidence에 Mission scope 밖 변경이 섞여 있다.
- Task Evidence가 주요 role별 Evidence를 참조하지만 해당 근거가 남아 있지 않다.
- 진행 상태 기록은 Task 수용 판단 대기 상태를 가리키지만 필요한 Verification Evidence나 Review Evidence가 없다.

drift가 발견되면 계약, Evidence, User 수용 판단을 기준으로 어긋난 부분을 확인하고 복귀 지점을 다시 정한다.

## 중단과 재개

중단은 세션 전환, 컨텍스트 압축, User 수용 판단 대기, 외부 조건 확인, 의도적인 보류처럼 작업 흐름이 잠시 멈춘 상태를 포함한다.

작업을 재개할 때의 첫 판단은 복귀 지점이다.

재개는 계약, Evidence, User 수용 판단을 기준으로 복귀 지점을 정하는 일에서 시작한다.

## 상태 신뢰 경계

Continuity의 상태 신뢰 경계는 다음과 같다.

- 진행 상태 기록은 완료 상태, Evidence verdict, User 수용 판단을 확정하지 않는다.
- User 수용 판단이 없는 Task나 Mission은 완료로 다루지 않는다.
- partial Evidence는 완전한 Evidence처럼 소비하지 않는다.
- dirty workspace는 Task contract와 Evidence에 연결해 읽는다.
- 근거가 부족한 상태에서는 User 또는 상위 Mission 판단으로 올린다.
- 복원 과정에서 확인한 상태는 Evidence verdict를 자동으로 만들지 않는다.
