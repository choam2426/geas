# Geas Workflow

## 목적

Geas는 AI Agent 작업을 User가 책임 있게 맡기고, 검토하고, 수용 판단할 수 있게 하는 구조화된 작업 흐름이다.

Geas의 목적은 Agent의 단기 산출 속도보다, User가 결과를 이해하고 판단하고 다음 작업으로 이어가기까지의 총 비용을 낮추는 데 있다.

이 workflow는 User 요청을 명확한 계약으로 정리하고, 판단 가능한 Task 단위로 실행하며, 검증 근거와 미검증 범위를 남긴다. User는 그 근거를 검토해 수용, 재작업, 취소를 판단한다. 작업 후에는 중요한 결정, 받아들인 위험, 남은 문제, 반복 가능한 교훈을 다음 작업이 이어받을 수 있게 남긴다.

## Workflow 구조

Geas Workflow는 Mission과 Task를 중심으로 구성된다.

Mission은 User가 AI Agent에게 맡긴 목표 단위다.

Mission은 목표, 배경, 범위, 제외 범위, 수용 기준을 드러내고, 여러 Task 결과를 종합해 전체 목표를 판단하는 기준이 된다.

Mission은 다음 질문에 답한다.

- 무엇을 이루려는가?
- 왜 필요한가?
- 어디까지 포함하는가?
- 어디까지 제외하는가?
- 어떤 상태가 충분한가?
- 어떤 근거를 보고 판단하는가?

Task는 Mission의 일부를 User가 판단 가능한 크기로 나눈 실행 단위다.

Task는 User가 결과와 Evidence를 한 번에 대조해 수용, 재작업, 취소를 판단할 수 있는 단위다. 같은 산출물, 수용 기준, 확인 방법, 남은 위험으로 판단할 수 있는 일은 하나의 Task로 묶고, 서로 다른 판단이 필요한 일은 Task를 나눈다. Task는 계약, 실행, Evidence, User Judgment를 거쳐 종료된다.

Task는 다음 질문에 답한다.

- Mission의 어떤 부분을 담당하는가?
- 무엇을 바꾸거나 만드는가?
- 이번 Task에서 다루는 범위는 어디까지인가?
- 이번 Task에서 제외하는 일은 무엇인가?
- 어떤 결과가 나오면 충분한가?
- 어떤 Evidence가 필요한가?

Mission은 전체 목표와 최종 판단 기준을 제공하고, Task는 그 목표를 검토 가능한 실행 단위로 만든다.

## Orchestrator

Orchestrator는 Geas Workflow를 진행하는 메인 Agent이며, User와 agent 작업 사이의 상호작용 표면이다.

Orchestrator는 User 요청을 Mission과 Task로 구체화하고, agent 작업 결과와 Evidence를 계약 기준에 대조해 User가 수용 판단할 수 있는 입력으로 정리한다. User Judgment는 User의 결정으로 남는다.

## Mission Workflow

Mission은 specifying, building, consolidating 세 phase로 진행된다.

```text
User request
  -> specifying
  -> building
  -> consolidating
```

- specifying은 User 요청을 Mission 기준과 판단 가능한 Task 구조로 정리한다.
- building은 Task specifying, implement, verify, review, 선택적 challenge, summarize, User Judgment, Task Evidence 기록, Task Memory 반영을 진행한다.
- consolidating은 수용된 Task 결과를 Mission 기준과 대조하고, Mission 수용 판단과 회고를 통해 다음 작업으로 이어질 맥락을 남긴다.

### Task Workflow

Task는 Task specifying, implement, verify, review, 선택적 challenge, summarize, User Judgment, record Task Evidence, update Task Memory 순서로 진행된다.

```text
Task specifying
  -> implement
  -> verify
  -> review
  -> challenge(선택)
  -> summarize
  -> User Judgment
  -> record Task Evidence
  -> update Task Memory
```

implement, verify, review, challenge는 각각 Task 결과를 판단하기 위한 Evidence를 남긴다. Evidence는 검증 근거와 미검증 범위를 함께 다룬다.

Task 요약은 Orchestrator가 산출물, Evidence, 미검증 범위, 남은 위험을 Task 기준에 대조해 User가 수용 여부를 판단하기 쉽게 정리한 보고다.

User Judgment는 User가 Task 결과를 수용, 재작업, 취소 중 하나로 판단하는 결정이다.

Task Memory는 Task 판단 뒤 다음 Task의 비용을 낮추기 위해 반영된다. User 의도, 범위, 수용 기준, 위험 수용에 영향을 주는 Task Memory는 User가 받아들인다. 작업 방식, 확인 습관, 보고 방식처럼 workflow 성능을 높이는 Task Memory는 Orchestrator가 받아들일 수 있다. 받아들인 Task Memory는 같은 Mission 안의 다음 Task부터 작업 맥락으로 사용된다.

### User 판단 지점

User 판단은 workflow 중 여러 번 일어난다.

- Mission 기준 합의: 목표, 배경, 범위, 제외 범위, 수용 기준이 의도와 맞는지 판단한다.
- 진행 방식 합의: 접근, 가정, 위험, Task 구조가 검토 가능한지 판단한다.
- Task 기준 합의: Task 경계, 산출물, 수용 기준, 확인 방법이 판단 가능한 실행 단위인지 판단한다.
- Task 결과 수용 판단: Task 산출물과 Evidence를 보고 수용, 재작업, 취소를 판단한다.
- Mission 결과 수용 판단: 수용된 Task와 남은 위험, 미검증 범위, 장기 기록 후보를 종합해 Mission을 완료로 받아들일지, 추가 Task를 진행할지, 취소할지 판단한다.
- 다음 작업 인계 판단: 이후 작업에 남길 Task Memory, Debt Ledger, Memory, Continuity Ledger 항목을 판단한다.

## 판단 경계

Geas Workflow에서 검증, 검토, 수용 판단은 서로 다른 책임이다.

- 검증은 agent 쪽 행위다. 테스트 실행, 실행 출력 확인, 변경 내역 제시, 미검증 범위 드러내기가 여기에 속한다.
- Agent 리뷰와 Challenge 리뷰는 agent 쪽 검토다. Agent 리뷰는 Task 결과의 품질, 계약 적합성, Evidence 충분성을 점검하고, Challenge 리뷰는 숨은 가정, 검증 공백, 장기 위험을 압박한다.
- Evidence는 agent가 남기는 근거 자료다. Evidence에는 검증 근거, agent 쪽 검토 결과, 미검증 범위가 함께 들어간다.
- 검토는 User 쪽 행위다. User가 Evidence를 읽고 필요한 경우 직접 확인하는 일이다.
- 수용 판단은 User 쪽 결정이다. Task 결과는 수용, 재작업, 취소 중 하나로 판단한다. Mission 결과는 완료 수용, 추가 진행, 취소 중 하나로 판단한다.

## 작업 연속성

Geas Workflow는 컨텍스트 압축, 세션 전환, 작업자 교체, agent 도구 변경 이후에도 작업을 같은 기준에서 이어 갈 수 있게 한다.

이어갈 수 있는 작업 상태에는 현재 Mission 기준, Task 기준, 산출물, Evidence, User Judgment, 받아들인 위험, 미검증 범위, 남은 문제, Task Memory, Debt Ledger, Memory, Continuity Ledger가 함께 남는다.

새 세션이나 다른 agent 도구에서 작업을 재개할 때 Orchestrator는 남은 대화 맥락보다 이 작업 상태를 우선해 현재 위치와 다음 행동을 복원한다. 이 복원 가능한 상태가 있어야 User와 agent가 이전 판단을 다시 설명하지 않고도 같은 기준으로 검토와 실행을 이어 갈 수 있다.

## 문서 구성

|문서|책임|
|---|---|
|[roles.md](./roles.md)|User와 agent 역할의 책임 경계를 정의한다.|
|[mission-task.md](./mission-task.md)|Mission과 Task의 관계, Mission Workflow, Task Workflow, 단계별 Evidence, 재작업과 기준 변경을 정의한다.|
|[continuity.md](./continuity.md)|끊긴 작업을 이어 가기 위한 연속성 원칙과 상태 신뢰 경계를 정의한다.|
|[reflection.md](./reflection.md)|Task Memory, Memory, Debt Ledger, Continuity Ledger를 정의한다.|
