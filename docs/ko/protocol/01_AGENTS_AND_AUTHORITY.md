# 01. Agents and Authority

> Geas가 어떤 slot 계열을 두고, 누가 어떤 경계 안에서 설계, 조율, 승인, 이의를 담당하는지 정의한다.

## 목적

Geas는 먼저 권한 경계를 고정한다. 누가 무엇을 결정할지 흐려지면 설계, 조율, 승인, 이의가 한 agent에 섞여 판단 근거가 약해진다. 이 문서는 slot 계열과 authority 경계를 정의한다.

## Slot 계열

### Authority 계열

| 표시 이름 | slot id | 핵심 책임 |
|---|---|---|
| Orchestrator | `orchestrator` | task 순서, 상태, reviewer 조합, phase 진행을 조율한다 |
| Decision Maker | `decision-maker` | 미션 단위 승인과 최종 판단을 맡는다 |
| Design Authority | `design-authority` | 미션을 구조화하고 task contract 집합을 설계한다 |
| Challenger | `challenger` | 숨겨진 복잡성, 경계 위반, 모호한 계약에 이의를 제기한다 |

### Specialist 계열

| 표시 이름 | slot id | 핵심 책임 |
|---|---|---|
| Implementer | `implementer` | 승인된 task contract에 따라 작업을 수행한다 |
| Verifier | `verifier` | acceptance criteria와 검증 절차를 독립적으로 확인한다 |
| Risk Assessor | `risk-assessor` | 안전, 품질, 리스크 관점에서 부족한 점을 드러낸다 |
| Operator | `operator` | 운영, 배포, 복구, 관측 가능성 관점을 점검한다 |
| Communicator | `communicator` | 사용자 전달물, 문서, 설명, handoff 품질을 점검한다 |

Slot은 역할 자리다. 실제 구현체는 이를 concrete agent type으로 매핑할 수 있지만, 프로토콜 의미는 slot 이름을 기준으로 읽는다.

## Authority 역할 경계

### Orchestrator

**책임**

- 사용자 요청을 mission spec으로 구체화한다.
- 승인된 mission spec과 mission design을 기준으로 task 흐름을 조율한다.
- task별 `routing`을 확정하고 reviewer 구성을 잠근다.
- task 상태 전이, baseline 재확인, workspace 충돌 회피를 관리한다.
- 관련 artifact들을 읽고 task closure decision을 남긴다.
- phase review를 작성하고 phase 전이를 준비한다.

**할 수 없는 것**

- mission spec, mission design, 초기 task contract 집합을 승인할 수 없다.
- specialist가 남겨야 할 implementation, review, verification evidence를 대신 작성할 수 없다.
- mission final verdict를 내릴 수 없다.

### Decision Maker

**책임**

- 현재 mission scope 안에서 추가되는 중간 task contract를 승인한다.
- 미션 단위의 구조적 트레이드오프와 보류 사유를 판단한다.
- mission final verdict를 내린다.
- standard mission에서 mission design과 초기 task contract 집합을 사용자 승인 전에 리뷰한다.
- full_depth mission에서 mission design과 초기 task contract 집합의 필수 deliberation에 참여한다.

**할 수 없는 것**

- mission spec, mission design, 초기 task contract 집합은 사용자만 승인할 수 있으므로 Decision Maker가 대신 승인할 수 없다.
- 개별 task의 implementation evidence를 대신 작성할 수 없다.
- task별 closure decision을 대신할 수 없다.
- 현재 mission scope 밖 task contract를 승인할 수 없다. Scope 밖 작업은 이 mission 안에서 다루지 않으며 사용자가 mission을 escalate하거나 후속 mission을 생성하는 방식으로 처리한다.
- required reviewer가 빠진 상태에서 mission final verdict를 내릴 수 없다.

### Design Authority

**책임**

- 승인된 mission spec을 바탕으로 mission design을 작성한다.
- 미션을 task contract 집합으로 분해한다.
- 각 task가 종결할 수 있는 단위인지, acceptance criteria가 충분한지 점검한다.
- 구현 중 새 task가 필요해질 때 분해 원칙을 다시 잡는다.

**할 수 없는 것**

- Orchestrator를 대신해 reviewer routing을 확정할 수 없다.
- task 상태를 임의로 전이할 수 없다.
- mission final verdict를 내릴 수 없다.

### Challenger

**책임**

- 숨겨진 복잡성, 계층 위반, 계약 모호성, 과도한 낙관을 드러낸다.
- 심각한 리스크가 보이면 challenge를 통해 차단 사유를 명시한다.
- 필요할 때 deliberation 안건을 열어야 한다는 신호를 보낸다.

**할 수 없는 것**

- 스스로 승인 권한을 행사할 수 없다.
- 막연한 선호를 block 사유처럼 취급할 수 없다.
- required reviewer를 대체할 수 없다.

## Specialist 슬롯별 최소 의무

| slot id | 최소 의무 |
|---|---|
| `implementer` | 승인된 task contract와 implementation contract 범위 안에서 작업하고, 실제 변경 내용을 추적 가능하게 남긴다 |
| `verifier` | acceptance criteria와 검증 절차를 독립적으로 확인하고, 통과 여부를 근거와 함께 남긴다 |
| `risk-assessor` | 리스크, 안전, 구조적 결함, 검증 공백을 명시적으로 지적한다 |
| `operator` | 운영 가능성, 배포 가능성, 복구 가능성, 관측 가능성 관점의 결함을 드러낸다 |
| `communicator` | 사용자 전달물과 설명이 목적, 범위, 제약과 어긋나지 않는지 점검한다 |

Specialist slot은 도메인 전반에 공통으로 쓰는 최소 분류다. 구현체는 더 구체적인 type을 둘 수 있지만, 최소 책임을 약화시켜서는 안 된다.

## 공통 운영 원칙

- 한 concrete agent가 여러 slot을 맡을 수는 있으며, 한 task 안에서도 reviewer/verifier 계열 slot을 겸임할 수 있다. 단 `implementer` slot은 exclusive다 — task 안에서 implementer를 맡은 agent는 같은 task에서 다른 slot을 맡을 수 없다 (자기 작업을 자기가 검증·리뷰하는 것 금지). 역할 전환은 evidence 경로(`evidence/{agent}.{slot}.json`)로 명시적으로 드러난다.
- authority slot은 missing specialist work를 대체해서는 안 된다.
- specialist review가 빠졌는데 closure나 final verdict로 우회해서는 안 된다.
- task 단위 evidence, gate, deliberation, closure는 doc 03이 owner다.
- mission phase와 mission final verdict는 doc 02가 owner다.
- 정규 경로와 스키마 연결은 doc 08이 owner다.
