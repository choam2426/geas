# Continuity

## 목적

이 문서는 중단된 Mission이나 Task를 이어 갈 때 진행 상태 기록을 출발점으로 복귀 지점을 정하는 기준을 정의한다. 진행 상태 기록이 계약, Evidence, User 수용 판단과 어긋나면 복귀 지점은 계약, Evidence, User 수용 판단을 기준으로 다시 정한다.

Continuity의 목표는 대화 맥락, 세션, 컨텍스트 압축 이후에도 agent가 진행 상태 기록, 계약, Evidence, User 수용 판단, 회고를 기준으로 작업을 다시 이어 갈 수 있게 하는 것이다.

## 기본 관점

Continuity는 작업을 재개하기 전에 진행 상태 기록, 계약, Evidence, User 수용 판단을 대조해 복귀 지점을 정하는 절차다.

진행 상태 기록은 Run State와 현재 Task의 Task State를 함께 본다. Run State는 현재 Mission id, 현재 단계, 현재 Task id를 빠르게 찾고, Task State는 현재 Task 안에서 이어갈 phase를 찾는다.

Run State와 Task State는 복귀 위치를 찾기 위한 색인이지, 완료나 수용 판단의 근거가 아니다.

복귀 지점은 계약, Evidence, User 수용 판단을 기준으로 정한다.

## 재개 전 확인

재개 전 확인은 작업을 바로 이어 하기 전에 진행 상태 기록, 기준선, Evidence, User 수용 판단이 같은 복귀 지점을 가리키는지 확인하는 절차다.

작업을 이어 갈 때는 다음 순서로 확인한다.

1. Run State에서 현재 Mission id, 현재 단계, 현재 Task id를 확인한다.
2. 진행 중인 Task가 있으면 Task State의 phase를 확인한다.
3. 최신 versioned Mission spec과 Mission design을 확인한다.
4. 진행 중인 Task가 있으면 최신 versioned Task contract를 확인한다.
5. 산출물과 작업 트리 변경이 Task contract와 연결되는지 확인한다.
6. Mission Evidence, Task Evidence, role별 Evidence를 확인한다.
7. Evidence가 드러내는 검증 근거, 미검증 범위, 남은 위험을 확인한다.
8. 관련 User 수용 판단을 확인한다.
9. 회고나 후속 항목이 복귀 지점에 영향을 주는지 확인한다.
10. 복귀 지점을 정한다.

현재 기준선은 각 scope에서 가장 큰 번호의 versioned Mission Spec, Mission Design, Task Contract다. 기준선, Evidence, User Judgment, 종료 요약이 서로 다른 위치를 가리키면 drift로 다룬다.

## drift

drift는 진행 상태 기록, 작업 트리, 계약, Evidence, User 수용 판단이 서로 다른 복귀 지점을 가리키는 상태다.

예시는 다음과 같다.

- Task State는 Task 수용 판단 대기 phase를 가리키지만 필요한 Verification Evidence나 Review Evidence가 없다.
- 작업 트리 변경이 어떤 Task contract에 속하는지 불명확하다.
- 산출물이나 Evidence에 Mission scope 밖 변경이 섞여 있다.
- Task Evidence가 주요 role별 Evidence를 참조하지만 해당 근거가 남아 있지 않다.
- Task State가 기준선, Evidence, User Judgment, 종료 요약과 다른 phase를 가리킨다.

drift가 발견되면 계약, Evidence, User 수용 판단을 기준으로 어긋난 부분을 확인하고 복귀 지점을 다시 정한다.

drift가 발견되면 Orchestrator는 가장 신뢰할 수 있는 기준선과 부족한 근거를 User에게 드러낸다. 이후 누락 Evidence 보완, 안전한 phase로 되돌아가기, 기준선 갱신, User 판단 요청, 중단 중 하나로 복귀 방식을 정한다.

## 중단과 재개

중단은 세션 전환, 컨텍스트 압축, User 수용 판단 대기, 외부 조건 확인, 의도적인 보류처럼 작업 흐름이 잠시 멈춘 상태를 포함한다.

작업을 재개할 때의 첫 판단은 복귀 지점이다.

재개는 계약, Evidence, User 수용 판단을 기준으로 복귀 지점을 정하는 일에서 시작한다.

## 상태 신뢰 경계

Continuity의 상태 신뢰 경계는 다음과 같다.

- 진행 상태 기록은 완료 상태, Evidence verdict, User 수용 판단을 확정하지 않는다.
- Task State는 Evidence verdict나 User 수용 판단을 확정하지 않는다.
- User 수용 판단이 없는 Task나 Mission은 완료로 다루지 않는다.
- partial Evidence는 완전한 Evidence처럼 소비하지 않는다.
- dirty workspace는 Task contract와 Evidence에 연결해 읽는다.
- 근거가 부족한 상태에서는 User 또는 상위 Mission 판단으로 올린다.
- 복원 과정에서 확인한 상태는 Evidence verdict를 자동으로 만들지 않는다.
