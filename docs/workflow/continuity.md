# Continuity

## 목적

이 문서는 끊긴 Mission이나 Task를 이어 갈 때 진행 상태 기록을 출발점으로 복귀 지점을 정하는 기준을 정의한다. 진행 상태 기록이 수용된 기준, Evidence, `User Judgment`와 어긋나면 복귀 지점은 수용된 기준, Evidence, `User Judgment`를 기준으로 다시 정한다.

Continuity의 목표는 대화 맥락, 세션, 컨텍스트 압축, 도구 변경 이후에도 agent가 진행 상태 기록, 수용된 기준, Evidence, `User Judgment`, 회고를 기준으로 작업을 다시 이어 갈 수 있게 하는 것이다.

## 기본 관점

Continuity는 작업을 재개하기 전에 진행 상태 기록, `Mission Spec`, `Mission Plan`, Task Direction, `Task Contract`, Evidence, `User Judgment`를 대조해 복귀 지점을 정하는 절차다.

진행 상태 기록은 Run State와 현재 Task의 Task State를 함께 본다. Run State는 현재 Mission id, 현재 단계, 현재 Task id를 빠르게 찾고, Task State는 현재 Task 안에서 이어갈 phase를 찾는 색인이다.

Run State와 Task State는 복귀 위치를 찾기 위한 색인이지, 완료나 수용 판단의 근거가 아니다.

복귀 지점은 수용된 기준, Evidence, `User Judgment`를 기준으로 정한다.

## 재개 전 확인

재개 전 확인은 작업을 바로 이어 하기 전에 진행 상태 기록, 수용된 기준, Evidence, `User Judgment`가 같은 복귀 지점을 가리키는지 확인하는 절차다.

작업을 이어 갈 때는 다음 순서로 확인한다.

1. Run State에서 현재 Mission id, 현재 단계, 현재 Task id를 확인한다.
2. 진행 중인 Task가 있으면 Task State의 phase를 확인한다.
3. 최신 수용된 `Mission Spec`과 `Mission Plan`을 확인한다.
4. 진행 중인 Task가 있으면 Task Direction과 `Task Contract`를 확인한다.
5. 산출물과 작업 트리 변경이 수용된 Task 기준과 연결되는지 확인한다.
6. `Mission Evidence`, `Task Evidence`, Role Evidence를 확인한다.
7. Evidence가 드러내는 검증 근거, 미검증 범위, 남은 위험을 확인한다.
8. 관련 `User Judgment`를 확인한다.
9. `Task Memory`, `Debt Ledger`, Memory, `Continuity Ledger`가 복귀 지점에 영향을 주는지 확인한다.
10. 복귀 지점을 정한다.

현재 작업 기준은 최신 수용된 `Mission Spec`, `Mission Plan`, Task Direction, `Task Contract`다. 진행 상태 기록, 작업 기준, Evidence, `User Judgment`, 종료 요약이 서로 다른 위치를 가리키면 drift로 다룬다.

## drift

drift는 진행 상태 기록, 작업 트리, 수용된 기준, Evidence, `User Judgment`가 서로 다른 복귀 지점을 가리키는 상태다.

예시는 다음과 같다.

- Task State는 Task 수용 판단 대기 phase를 가리키지만 필요한 `Verification Evidence`나 `Review Evidence`가 없다.
- 작업 트리 변경이 어떤 Task 기준에 속하는지 불명확하다.
- 산출물이나 Evidence에 Mission scope 밖 변경이 섞여 있다.
- `Task Evidence`가 주요 Role Evidence를 참조하지만 해당 근거가 남아 있지 않다.
- Task State가 작업 기준, Evidence, `User Judgment`, 종료 요약과 다른 phase를 가리킨다.

drift가 발견되면 수용된 기준, Evidence, `User Judgment`를 기준으로 어긋난 부분을 확인하고 복귀 지점을 다시 정한다.

drift가 발견되면 Orchestrator는 가장 신뢰할 수 있는 기준과 부족한 근거를 User에게 드러낸다. 이후 누락 Evidence 보완, 안전한 단계로 되돌아가기, 기준 재수용, Task 취소, `User Judgment` 요청 중 하나로 복귀 방식을 정한다.

## 멈춘 작업과 재개

멈춘 작업은 세션 전환, 컨텍스트 압축, `User Judgment` 대기, 외부 조건 확인처럼 작업 흐름이 잠시 멈춘 상태를 포함한다.

작업을 재개할 때의 첫 판단은 복귀 지점이다.

재개는 수용된 기준, Evidence, `User Judgment`를 기준으로 복귀 지점을 정하는 일에서 시작한다.

## 상태 신뢰 경계

Continuity의 상태 신뢰 경계는 다음과 같다.

- 진행 상태 기록은 완료 상태, Evidence verdict, `User Judgment`를 확정하지 않는다.
- Task State는 Evidence verdict나 `User Judgment`를 확정하지 않는다.
- `User Judgment`가 없는 Task나 Mission은 완료로 다루지 않는다.
- 불완전한 Evidence는 완전한 Evidence처럼 소비하지 않는다.
- 작업 트리 변경은 `Task Contract`와 Evidence에 연결해 읽는다.
- 근거가 부족한 상태에서는 User 또는 상위 Mission 판단으로 올린다.
- 복원 과정에서 확인한 상태는 새 Evidence verdict를 자동으로 만들지 않는다.
