# Mission

## 목적

이 문서는 Mission의 의미, Mission spec, Mission design, Mission 흐름을 정의한다.

Mission은 User가 agent를 사용해 이루고자 하는 목표를 구체화한 것이다.

Mission은 User의 목표를 검토 가능한 기준선으로 만들고, 그 기준선을 실행 가능한 구조와 Task 계약으로 이어지게 하는 상위 작업 단위다.

## Mission

Mission은 최소한 다음 질문에 답해야 한다.

- 무엇을 이루려는가?
- 왜 필요한가?
- 어디까지 포함하는가?
- 어디까지 제외하는가?
- 어떤 기준으로 결과를 판단할 것인가?
- 어떤 위험이나 제약이 있는가?

Mission은 하나의 Task로 끝날 수도 있고, 여러 Task로 나뉠 수도 있다. 어떤 경우에도 Mission spec, Mission design, 초기 Task contract를 가진다. 단순한 Mission에서는 이 기준선들이 매우 짧을 수 있다.

## Mission Spec

Mission spec은 User의 목표를 검토 가능한 기준선으로 만드는 작업 기획이다.

Mission spec은 무엇을 하려는지, 왜 필요한지, 어디까지 포함하거나 제외하는지, 어떤 완료 기준과 수용 기준으로 판단할지를 고정한다.

Mission spec에는 다음 내용이 들어간다.

|항목|의미|
|---|---|
|이름|Mission을 식별할 수 있는 짧은 이름|
|목표|User가 agent를 사용해 이루려는 목표|
|배경|왜 이 Mission이 필요한지|
|완료 기준|Mission이 끝났다고 판단할 상위 기준|
|포함 범위|이번 Mission이 맡는 일|
|제외 범위|이번 Mission에서 하지 않을 일|
|수용 기준|결과를 판단할 구체 기준|
|제약|반드시 지켜야 하는 조건|
|가정|User 요청을 해석할 때 둔 전제|
|고려해야 할 위험|Mission을 실행하거나 수용 판단할 때 미리 의식해야 할 위험|

Mission spec은 User가 이해하고 받아들일 수 있어야 한다.

Mission spec이 받아들여진 뒤 완료 기준이나 범위가 바뀌어야 한다면 기존 실행 기준을 조용히 확장하지 않는다. Mission을 갱신할지, 보류할지, 중단할지, 후속 Mission으로 넘길지 판단해야 한다.

## Mission Design

Mission design은 Mission spec을 실행 가능한 작업 구조로 바꾸는 작업 계획이다.

Mission design은 Mission을 어떤 Task 구조와 검증 흐름으로 진행할지 설명한다.

Mission design에는 다음 내용이 들어간다.

|항목|의미|
|---|---|
|접근 전략|Mission을 어떤 방식으로 진행할지와 그 이유|
|Task 분해|Mission을 어떤 Task로 나누는지와 그 이유|
|진행 순서|Task 진행 순서와 주요 의존 관계|
|검증 전략|Mission과 Task를 어떤 Evidence로 판단할지|
|주요 가정|작업 계획이 의존하는 전제|
|위험과 대응|고려해야 할 위험과 대응 방식|

## Mission 흐름

Mission은 다음 흐름을 따른다.

```mermaid
flowchart LR
  S["specifying<br/>Mission spec, Mission design, 초기 Task contract"]
  B["building<br/>Task 실행과 Task 수용 판단"]
  C["consolidating<br/>Mission 대조와 Mission 수용 판단"]

  S --> B
  B --> C
  B --> S
  C --> B
  C --> S
```

### specifying

목적은 사용자 요청을 User가 수용 판단할 수 있는 Mission 기준선으로 바꾸는 것이다.

주요 흐름은 다음과 같다.

```mermaid
flowchart TD
  R["User request"]
  O["Orchestrator<br/>Mission spec 초안"]
  D["Work Designer<br/>Mission design"]
  T["Work Designer<br/>초기 Task contract"]
  H["Challenger<br/>기준선 압박 optional"]
  U["User<br/>Mission 기준선 수용 판단"]
  B["building"]

  R --> O --> D --> T
  T --> H --> U
  T --> U
  U -->|"수용"| B
  U -->|"수정 요청"| O
```

이 흐름에서 Orchestrator는 User 요청을 Mission spec 초안으로 구체화한다. Work Designer는 Mission spec을 Mission design과 초기 Task contract로 이어지게 만든다.

Challenger가 참여하면 Mission 기준선, Task 분해, 초기 검증 전략의 숨은 가정과 장기 위험을 압박하고 Challenger Evidence를 남긴다.

User는 Mission spec, Mission design, 초기 Task contract를 검토하고 수용 판단한다. 수정이 필요하면 specifying 안에서 기준선을 다시 다듬고, 수용되면 building으로 넘어간다.

남겨야 할 것은 Mission spec, Mission design, 초기 Task contract다. Challenger가 기준선을 압박했다면 Challenger Evidence도 남긴다.

### building

목적은 수용된 Task contract에 따라 작업을 수행하고, 각 Task에 대해 User가 수용 판단할 수 있도록 Evidence를 남기는 것이다.

주요 흐름은 다음과 같다.

```mermaid
flowchart TD
  C["수용된 Task contract"]
  E["Task 실행과 role별 Evidence"]
  I["Orchestrator<br/>Task 수용 판단 입력"]
  U["User<br/>Task 수용 판단"]
  TE["Task Evidence<br/>종료 요약"]
  N["다음 Task"]
  G["consolidating"]
  S["specifying"]

  C --> E --> I --> U
  U -->|"완료 수용"| TE
  U -->|"재작업"| E
  U -->|"Task 계약 갱신"| C
  U -->|"Mission 기준선 재검토"| S
  TE -->|"남은 Task 있음"| N --> C
  TE -->|"남은 Task 없음"| G
```

Mission 문서의 building은 Task 수용 루프를 다룬다. Task 내부의 구현, 검증, review 세부 흐름은 `task.md`가 다룬다.

Orchestrator는 수용된 Task contract를 기준으로 role 호출, handoff, verification, review 흐름을 조율한다. 각 role은 자기 책임 범위에서 Task 결과를 만들거나 확인하고 role별 Evidence를 남긴다.

Orchestrator는 산출물, role별 Evidence, Task contract를 대조해 User가 Task를 수용 판단할 수 있는 입력을 구성한다.

User는 Task 결과와 Evidence를 보고 완료 수용, 재작업, Task 계약 갱신, Mission 기준선 재검토 중 필요한 판단을 내린다. Task가 수용 판단으로 종료되면 Orchestrator가 Task Evidence를 남기고, 남은 Task가 있으면 building 안에서 다음 Task로 이어 간다.

남겨야 할 것은 Task 결과, Implementation Evidence, Verification Evidence, Review Evidence다. Task가 종료되면 Task Evidence도 남긴다. Challenger가 참여했다면 Challenger Evidence도 남긴다.

### consolidating

목적은 수용된 Task들을 Mission 기준선과 대조하고, User가 Mission 전체를 수용 판단할 수 있는 상태로 정리하는 것이다.

주요 흐름은 다음과 같다.

```mermaid
flowchart TD
  T["수용된 Task 결과와 Task Evidence"]
  C["Mission spec/design과 대조"]
  R["gap/debt/follow-up 후보 정리"]
  I["Mission 수용 판단 입력"]
  U["User<br/>Mission 수용 판단"]
  M["memory 반영"]
  E["Mission Evidence<br/>final report"]
  B["building"]
  S["specifying"]

  T --> C --> R
  R -->|"Mission 판단 가능"| I --> U
  R -->|"추가 Task 필요"| B
  R -->|"기준선 갱신 필요"| S
  U -->|"완료 수용"| M --> E
  U -->|"추가 작업"| B
  U -->|"Mission 재검토"| S
```

gap, debt, follow-up 후보는 Mission 수용 판단 전에 정리한다. memory는 User의 Mission 수용 판단 이후에 반영한다.

Orchestrator는 수용된 Task 결과와 Task Evidence를 Mission spec, Mission design과 대조한다. 이때 Mission 기준선과 실제 결과 사이의 gap, 수용한 결과 안에 남는 debt, 현재 Mission 밖에서 다룰 follow-up 후보를 정리한다.

추가 Task나 Task contract 갱신이 필요하면 building으로 돌아간다. Mission spec이나 Mission design 수정이 필요하면 specifying으로 돌아간다.

Mission 판단이 가능하면 Orchestrator는 Task Evidence, 필요한 role별 Evidence, Mission 기준선, gap, debt, follow-up 후보를 대조해 Mission 수용 판단 입력, agent 측 권고, 가능한 선택지를 구성한다.

User가 Mission을 수용하면 수용된 gap과 debt, 남기기로 한 follow-up을 확인하고 필요한 memory를 반영한다. 이후 Orchestrator가 Mission Evidence를 final report로 남긴다.

남겨야 할 것은 Mission 결과 요약, Mission Evidence, agent 측 권고, User의 수용 판단, gap, debt, follow-up, memory 업데이트다.

Mission은 User의 수용 판단이 남고, 수용된 gap과 debt, 남기기로 한 follow-up, 필요한 memory가 정리되었을 때 complete로 볼 수 있다.

## Mission 판단

모든 Task가 수용되어도 Mission이 자동으로 완료되는 것은 아니다.

Mission 수용 판단에서는 수용된 Task들이 Mission spec과 Mission design을 충족하는지 다시 본다. 이때 전체 목표와 Task 결과 사이의 gap, Evidence에 드러난 미검증 범위, follow-up, 현재 Mission에서 더 진행하지 않을 debt가 함께 판단 대상이 된다.

Mission의 최종 판단은 agent의 완료 선언이나 Task 상태가 아니라, 수용 판단 입력과 User의 수용 판단 위에 성립한다. Memory로 반영할 교훈은 수용 판단 이후 회고에서 정리한다. Mission Evidence는 수용 판단, 회고, memory 업데이트 이후 Mission 전체를 다시 열어볼 수 있게 남기는 final report다.
