# Reflection

## 목적

이 문서는 Geas Workflow에서 작업 중 드러난 Reflection Candidates를 Task Memory, Memory, Debt Ledger, Continuity Ledger로 정리하는 기준을 설명한다.

Reflection의 목적은 작업에서 드러난 사실을 다음 Task의 판단 비용을 낮추는 맥락, 이후 작업에 반복 적용할 운영 지식, 장기 비용으로 추적할 항목, 이어받을 상태로 바꾸는 것이다.

## 기본 관점

Reflection Candidates는 Role Evidence, Task Evidence, Task Memory, Mission 진행 중 드러난 판단 맥락에서 나온다.

Task가 끝날 때는 같은 Mission 안의 이후 Task에 바로 쓸 수 있는 신호를 Task Memory에 반영한다. Mission이 끝날 때는 반복 적용할 가치가 있는 항목을 장기 Memory로 승격하고, 이후 비용으로 남는 항목은 Debt Ledger에 남기며, 이어가기 위해 필요한 상태와 결정은 Continuity Ledger에 남긴다.

Reflection은 User Judgment를 대신하지 않는다. Reflection은 User Judgment 이후에 수용된 결과, 받아들인 한계, 남은 위험, 진행 중 결정에서 다음 작업에 영향을 줄 항목을 골라 남기는 작업이다.

장기 기록의 1급 개념은 세 가지다.

|기록|역할|
|---|---|
|Memory|이후 작업의 판단이나 행동을 반복적으로 바꾸는 운영 지식|
|Debt Ledger|User가 알고 받아들였고 이후 비용으로 남는 위험, 미검증 범위, 품질 부채, 미충족 gap, follow-up 후보|
|Continuity Ledger|다음 세션, 다음 Task, 다른 agent가 이어받아야 하는 현재 상태, 결정, tradeoff, 열린 질문, 다음 행동|

## Reflection Candidates

Reflection Candidates는 이후 작업을 더 정확하고 낮은 비용으로 수행하게 만들 수 있는 신호다.

Reflection Candidates에는 다음 내용이 들어갈 수 있다.

- 반복될 가능성이 있는 실행 패턴이나 문제
- 자주 빠지는 verification check
- 역할 경계나 책임이 흐려진 지점
- Task Contract나 Evidence 초점에서 보강할 점
- User 수용 판단 비용을 높인 요인
- 이후 유지보수 비용으로 이어질 수 있는 선택
- 다음 Task에서 바로 참고해야 하는 User 결정이나 tradeoff

Reflection Candidates는 다음 정보를 함께 가진다.

|항목|역할|
|---|---|
|Observed Signal|무엇을 관찰했는지 남긴다.|
|Context|어떤 Task, Evidence, User Judgment, Mission 상황에서 나왔는지 남긴다.|
|Effect|그 신호가 이후 작업 비용이나 판단에 어떤 영향을 주는지 남긴다.|
|Suggested Destination|Task Memory, Memory, Debt Ledger, Continuity Ledger 중 어느 쪽 후보인지 남긴다.|

Reflection Candidates는 자동으로 장기 기록이 되지 않는다. Mission User Judgment 뒤에 실제 반영 대상을 다시 고른다.

## Task Memory

Task Memory는 Task 직후 같은 Mission 안의 다음 Task 비용을 낮추기 위해 갱신하는 Mission 단위 작업 맥락이다.

Task Memory는 Task Evidence와 분리해 남긴다. Task Evidence는 어떤 판단이 있었는지 종료 기록으로 남기고, Task Memory는 이후 Task의 specifying, 구현, 검증, Agent 리뷰, Challenge 리뷰, Task 요약의 입력으로 쓰인다.

Task Memory에는 다음 내용이 들어갈 수 있다.

|항목|역할|
|---|---|
|User Preference|이번 Mission 안에서 바로 적용해야 하는 User 선호나 판단 기준|
|Accepted Limit|User가 알고 받아들인 미검증 범위나 남은 위험|
|Working Context|다음 Task가 이어받아야 하는 파일, 문서, 흐름, 의존 관계|
|Avoid Next Time|같은 Mission 안에서 반복하지 말아야 할 오류나 비효율|
|Verification Habit|다음 Task에서 먼저 확인할 테스트, 화면, 문서, 환경|
|Reporting Hint|User가 읽기 쉬웠거나 어려웠던 보고 방식|

Task Memory는 Mission 안에서 쓰는 단기 맥락이다. consolidating에서 반복 적용할 가치가 확인되면 장기 Memory로 승격한다.

## Memory

Memory는 이후 작업에서도 반복적으로 적용할 운영 지식이다.

Memory로 반영할 항목은 다음 조건을 만족한다.

- Evidence나 User Judgment에서 나온다.
- 반복 가능한 교훈이다.
- 이후 작업의 판단이나 행동을 바꾼다.
- 특정 Mission 맥락을 넘어 다시 적용할 수 있다.

Memory에는 다음 내용이 들어갈 수 있다.

|항목|예시|
|---|---|
|계약 작성 기준|외부 API나 라이브러리에 의존하는 작업은 현재 공식 문서나 실제 실행 결과를 먼저 확인한다.|
|검증 습관|UI Task에서는 desktop과 mobile viewport 확인을 Verification Strategy에 포함한다.|
|리뷰 초점|인증, 권한, 쿼리, 데이터 처리 변경에서는 보안과 대량 데이터 성능 위험을 함께 확인한다.|
|Challenge 초점|새 dependency나 빠른 workaround가 장기 유지보수, 데이터 무결성, 장애 복구 비용을 만들지 압박한다.|
|보고 방식|User가 수용 판단할 때는 결과, 근거, 미검증 범위, 남은 위험을 함께 보여 준다.|

Memory는 감상이 아니라 다음 작업의 행동을 바꾸는 운영 기준이다.

## Debt Ledger

Debt Ledger는 User가 알고 받아들였고 이후 비용으로 남는 항목을 추적한다.

Debt Ledger에는 다음 내용이 들어갈 수 있다.

|항목|역할|
|---|---|
|Accepted Risk|User가 알고 받아들인 위험을 남긴다.|
|Unverified Scope|현재 수용했지만 이후 비용이 되는 미검증 범위를 남긴다.|
|Quality Debt|정리, 분리, 테스트 보강, 문서 보강이 필요한 품질 부채를 남긴다.|
|Remaining Gap|Mission 기준과 실제 결과 사이에 남았고 User가 비용을 알고 받아들인 차이를 남긴다.|
|Follow-up Candidate|현재 Mission 밖에서 새로 다룰 수 있지만 이후 비용과 연결되는 작업 후보를 남긴다.|

Debt Ledger 항목은 다음 내용을 함께 가진다.

- 현재 Mission에서 받아들인 이유
- 이후 비용이나 위험이 생기는 조건
- 예상되는 영향
- 다시 볼 기준이나 시점

남은 gap과 follow-up 후보는 독립 산출물이 아니다. User가 비용과 위험을 알고 현재 결과 안에 남기기로 수용했거나 이후 프로젝트 비용을 만들면 Debt Ledger 후보가 된다.

## Continuity Ledger

Continuity Ledger는 다음 Task, 다음 세션, 다른 agent 도구가 작업을 이어받기 위해 필요한 상태와 결정을 남긴다.

Continuity Ledger에는 다음 내용이 들어갈 수 있다.

|항목|역할|
|---|---|
|Current State|현재 Mission이나 Task가 어디까지 진행되었는지 남긴다.|
|Accepted Decisions|User가 받아들인 결정과 그 이유를 남긴다.|
|Tradeoffs|선택한 접근의 대가와 되돌릴 조건을 남긴다.|
|Open Questions|다음에 User나 agent가 다시 확인해야 하는 질문을 남긴다.|
|Next Actions|다음 Task나 다음 세션에서 바로 수행할 행동을 남긴다.|
|Handoff Notes|다른 agent가 이어받을 때 먼저 읽어야 할 맥락을 남긴다.|

Continuity Ledger는 장기 운영 지식이 아니라 이어가기 위한 현재 상태 기록이다. 같은 내용이 반복 적용할 운영 기준으로 굳어지면 Memory 후보가 된다.

## 분류 기준

Reflection Candidates는 다음 기준으로 분류한다.

|분류|판단 질문|남기는 위치|
|---|---|---|
|Memory|다음 작업의 판단이나 행동을 반복적으로 바꾸는가?|Memory, Mission Evidence의 Memory Updates|
|Debt Ledger|User가 알고 받아들였고 이후 비용으로 남는가?|Debt Ledger, Mission Evidence의 Debt Ledger Updates|
|Continuity Ledger|다음 Task, 다음 세션, 다른 agent가 이어받아야 하는 현재 상태인가?|Continuity Ledger, Mission Evidence의 Continuity Ledger Updates|

하나의 후보가 둘 이상의 기록에 걸칠 수 있다. 이때 각 기록에는 자기 목적에 맞는 부분만 남긴다.

|상황|분류|
|---|---|
|반복되는 verification 누락을 이후 모든 UI Task에서 막아야 한다.|Memory|
|이번 Mission에서는 일부 환경 확인을 수용했지만 다음 운영 변경 때 비용이 된다.|Debt Ledger|
|다음 Task가 방금 수용한 디자인 방향을 이어받아야 한다.|Continuity Ledger|
|임시 구조를 받아들였고 다음 확장 때 분리 비용이 생긴다.|Debt Ledger|
|User가 특정 보고 방식을 더 읽기 쉽다고 판단했고 이후에도 적용할 수 있다.|Memory|
|다음 세션에서 먼저 열어봐야 할 파일과 미완료 질문이 있다.|Continuity Ledger|

## Mission 마무리와 회고 반영

Mission 마무리에서 Reflection은 consolidating 안에서 다룬다.

Mission User Judgment 전에는 다음을 정리한다.

1. Role Evidence, Task Evidence, Task Memory에서 Reflection Candidates를 모은다.
2. Mission Spec, Mission Plan, Task Evidence, User Judgment를 대조한다.
3. 후보를 Memory, Debt Ledger, Continuity Ledger 후보로 분류한다.
4. 각 후보가 어떤 Evidence, User Judgment, Mission 기준과 연결되는지 남긴다.

Mission User Judgment 뒤에는 다음을 반영한다.

1. User가 받아들인 한계와 남은 위험 중 Debt Ledger에 남길 항목을 확정한다.
2. 반복 적용할 가치가 있는 Task Memory와 Reflection Candidates를 Memory로 승격한다.
3. 다음 Task, 다음 세션, 다른 agent가 이어받아야 하는 상태와 결정을 Continuity Ledger에 남긴다.
4. Mission Evidence에는 Debt Ledger Updates, Memory Updates, Continuity Ledger Updates의 요약과 참조만 남긴다.

Mission Evidence는 각 장기 기록의 정본을 대체하지 않는다.

## 품질 기준

좋은 Reflection 항목은 다음 조건을 만족한다.

- Evidence나 User Judgment에 연결되어 있다.
- 이후 작업의 판단, 실행, 검증, 보고 비용을 낮춘다.
- 무엇을 다르게 해야 하는지 드러난다.
- 하나의 판단이나 행동 단위로 다룰 수 있다.
- 특정 Mission의 맥락을 잃어도 이해할 수 있다.
- User가 받아들인 미검증 범위나 남은 위험과 연결되면 그 사실을 드러낸다.

## 책임 경계

Reflection의 책임 경계는 다음과 같다.

- User Judgment는 Evidence를 검토한 뒤 별도로 남긴다.
- Reflection 항목은 User Judgment를 대신하지 않는다.
- Reflection Candidates는 자동으로 Memory, Debt Ledger, Continuity Ledger가 되지 않는다.
- Task Memory는 같은 Mission 안의 단기 맥락이며 장기 Memory가 아니다.
- Debt Ledger 항목은 성과처럼 표현하지 않는다.
- Continuity Ledger는 완료 선언이 아니라 이어가기 위한 상태 기록이다.
