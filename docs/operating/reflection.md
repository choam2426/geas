# Reflection

## 목적

이 문서는 작업 중 드러난 회고 후보를 memory, debt, gap, follow-up으로 정리하는 기준을 정의한다.

회고의 목적은 이번 작업에서 드러난 사실을 바탕으로 이후 작업을 더 정확하고 낮은 비용으로 수행할 수 있게 하는 것이다.

## 기본 관점

회고 후보는 role별 Evidence, Task Evidence, Mission 진행 중 드러난 판단 맥락에서 시작할 수 있다.

Task가 종료될 때는 필요한 회고 후보를 Task Evidence에 가볍게 참조하고, Mission이 종료될 때는 확정한 회고 결과와 반영한 memory를 Mission Evidence에 남긴다.

회고 후보는 다음 범주로 분류한다.

- memory
- debt
- gap
- follow-up

회고의 중심은 이후 작업에서 실제 판단을 바꿀 항목을 남기는 데 있다.

## 회고 후보

회고 후보는 이후 작업을 더 정확하고 낮은 비용으로 수행하게 만들 수 있는 신호다.

회고 후보에는 다음 내용이 들어갈 수 있다.

- 반복될 가능성이 있는 실행 패턴이나 문제
- 자주 빠지는 verification check
- 역할 경계나 책임이 흐려진 지점
- 계약이나 Evidence 초점에서 보강할 점
- User 수용 판단 비용을 높인 요인
- 이후 유지보수 비용으로 이어질 수 있는 선택

회고 후보는 다음 정보를 함께 가진다.

- 관찰된 신호
- 발생한 맥락

## Memory

Memory는 이후 작업에서도 반복적으로 적용할 운영 지식이다. 회고 단계에서는 회고 후보 중 실제 memory로 반영할 항목을 정한다.

Memory는 파일 위치에 따라 두 수준으로 나눈다.

|수준|의미|
|---|---|
|Common Memory|Orchestrator를 포함한 모든 role이 이후 작업에서 적용해야 할 운영 기준|
|Role Memory|특정 role이 자기 책임 범위에서 이후 작업에 적용해야 할 운영 기준|

Common Memory는 `.geas/memory/common.yaml`에 둔다. Role Memory는 `.geas/memory/roles/<role>.yaml`에 둔다. Memory 파일 안에는 적용 수준이나 role 이름을 다시 쓰지 않는다.

Memory로 반영할 항목은 다음 조건을 만족한다.

- Evidence나 실제 실행 결과에서 나온다.
- 반복 가능한 교훈이다.
- 이후 작업의 판단이나 행동을 바꿀 수 있다.
- 특정 Mission 맥락을 넘어 다시 적용할 수 있다.

공통 memory 예시는 다음과 같다.

- 외부 API나 라이브러리에 의존하는 작업에서는 현재 공식 문서나 실제 실행 결과를 먼저 확인한다.
- 데이터 삭제, 마이그레이션, 권한 변경처럼 되돌리기 어려운 작업에서는 rollback 방법과 verification checks를 계약에 포함한다.
- UI나 문서처럼 해석 여지가 큰 산출물은 완료 기준을 확인 가능한 상태로 적는다.

role별 memory 예시는 다음과 같다.

- Implementer는 새 문법이나 런타임 기능을 쓰기 전에 프로젝트의 실제 언어 버전과 배포 환경을 확인한다.
- Verifier는 시간대, 외부 API, UI viewport처럼 환경에 따라 달라지는 결과를 주요 검증 조건에 포함한다.
- Reviewer는 인증, 권한, 쿼리, 데이터 처리 변경에서 보안과 large dataset 성능 위험을 함께 확인한다.
- Challenger는 새 dependency나 빠른 workaround가 장기 유지보수, 데이터 무결성, 장애 복구 비용을 만들지 압박한다.

## Debt

Debt는 현재 Mission에서 수용한 결과 안에 남아 이후 변경, 검증, 운영 비용으로 이어질 수 있는 항목이다.

Debt는 현재 Mission을 수용할 때 User가 함께 판단해야 하는 남은 비용이다.

Debt에는 다음이 들어갈 수 있다.

- 임시 해결
- 정리가 필요한 구조
- 이후 분리 비용을 만들 수 있는 결합이나 구조
- 검증을 더 강화해야 할 영역
- 운영이나 유지보수 비용을 만들 수 있는 선택

Debt는 다음을 함께 남긴다.

- 현재 Mission에서 수용한 이유
- 이후 비용이나 위험이 생기는 조건
- 예상되는 영향
- 다시 다룰 기준이나 시점

## Gap

Gap은 Mission 기준선과 실제 결과 사이에 남은 차이다.

Gap은 Mission spec, Mission design, Task contract, 산출물, Evidence를 대조할 때 드러난다.

Gap에는 다음이 들어갈 수 있다.

- 충족되지 않은 Mission 목표 일부
- Mission 기준선에 포함되었지만 확인하지 못한 환경
- User 기대와 산출물 사이의 차이
- Mission scope 안에 있었지만 산출물이나 Evidence에 반영되지 않은 부분

Gap은 User 수용 판단의 대상이다. Gap은 이름만 바꿔 debt나 follow-up으로 돌리지 않는다.

Mission 완료 기준이나 scope에 걸린 gap은 추가 Task로 해결하거나, Mission 기준선을 갱신하고 User 수용 판단을 다시 거친다.

User가 비용과 위험을 알고 현재 Mission 안에 남기기로 수용한 항목은 debt로 남긴다.

현재 Mission scope 밖에서 새로 다룰 항목은 follow-up으로 남긴다.

## Follow-up

Follow-up은 현재 Mission의 결과 바깥에서 새로 다룰 수 있는 다음 작업 후보다.

Follow-up은 다음 중 하나로 분류할 수 있다.

- 추가 구현
- 추가 검증
- 문서 보완
- 운영 또는 배포 확인
- 별도 조사나 의사결정

Follow-up은 다음 작업의 입력으로 남긴다. 현재 Mission의 완료 여부는 User가 Evidence와 남은 항목을 보고 수용 판단한다.

## 수용 판단과 회고 흐름

Mission 마무리 흐름은 수용 판단 입력을 준비하는 정리와, 수용 판단 이후의 memory 반영으로 나뉜다.

Mission 수용 판단 전에는 다음을 정리한다.

1. Mission spec, Mission design, Task contract, Mission 결과를 대조한다.
2. Task Evidence와 role별 Evidence에서 gap, debt, follow-up으로 이어질 신호를 확인한다.
3. gap, debt, follow-up 후보를 정리한다.
4. 각 후보와 연결된 미검증 범위와 남은 위험을 함께 드러낸다.

Mission 수용 판단 이후에는 다음을 정리한다.

1. User가 받아들인 gap과 debt, 남기기로 한 follow-up을 확인한다.
2. 회고 후보 중 공통 memory나 role별 memory로 반영할 항목을 정한다.
3. Mission Evidence에 회고 요약, 반영한 memory, 남은 gap, debt, follow-up을 남긴다.

## 회고 항목의 품질 기준

좋은 회고 항목은 다음 조건을 만족한다.

- Evidence나 User 수용 판단에 연결되어 있다.
- 이후 작업의 판단이나 행동을 바꿀 수 있다.
- 무엇을 다르게 해야 하는지 드러난다.
- 하나의 판단이나 행동 단위로 다룰 수 있다.
- 특정 Mission의 맥락을 잃어도 이해할 수 있다.
- User가 받아들인 미검증 범위와 연결되면 그 사실을 드러낸다.

## 책임 경계

회고의 책임 경계는 다음과 같다.

- User 수용 판단은 Evidence를 검토한 뒤 별도로 남긴다.
- 회고 후보는 자동으로 memory가 되지 않는다.
- debt와 gap은 성과처럼 표현하지 않는다.
- follow-up의 존재만으로 현재 Mission의 완료 여부를 결정하지 않는다.
