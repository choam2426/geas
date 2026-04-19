# 02. Missions, Phases, and Final Verdict

> GEAS의 mission 모델, mission operating mode, 4-phase 흐름, phase review, mission-level deliberation, mission final verdict를 정의한다. Runtime checkpoint와 recovery는 doc 05가 owner다.

## 목적

Mission은 사용자 요청을 실행 가능한 작업 체계로 바꾸는 상위 단위다. 이 문서는 미션을 무엇으로 정의하고, 어떤 승인 순서로 좁혀 가며, 언제 미션이 다음 phase로 넘어가고 최종적으로 승인되는지를 다룬다.

## Mission

Mission은 "이번 실행이 무엇을 만족해야 하는가"를 붙드는 상위 계약이다. 정규 JSON artifact는 mission spec(`spec.json`)이며, 정확한 필드 구조는 `mission-spec.schema.json`이 관리한다.

### mission spec이 붙드는 것

mission spec은 최소한 다음 의미를 고정한다.

| 핵심 필드 | 의미 |
|---|---|
| `mission_id` | 이 미션을 식별하는 안정적인 id |
| `mission` | 사용자가 실제로 원하는 일 |
| `done_when` | 언제 미션이 끝났다고 볼지에 대한 상위 기준 |
| `audience` | 결과를 읽거나 쓰는 대상 |
| `scope.in` / `scope.out` | 이 미션이 맡는 범위와 맡지 않는 범위 |
| `acceptance_criteria` | phase gate와 task derivation에 쓰는 미션 수준 완료 기준 |
| `constraints` | 반드시 지켜야 하는 제약 |
| `risks`, `assumptions`, `unknowns` | 시작 시점의 위험과 미해결 조건 |
| `user_approved` | 현재 mission spec을 실행 기준으로 사용자에게 승인받았는지 여부 |

mission spec은 대화나 토론을 통해 사용자 요청을 구체화한 결과여야 한다. 미션이 크거나 모호할수록 `unknowns`와 `constraints`를 숨기지 않고 드러내야 한다.

## Mission Design

Mission design(`mission-design.md`)은 승인된 mission spec을 실행 계획으로 풀어 쓴 문서다. schema owner는 아니지만, 어떤 접근을 택했고 어떤 task 구조로 나눌지, 어떤 리스크를 어디서 흡수할지를 사람이 읽을 수 있게 정리한 기준선이다.

Mission design은 최소한 다음을 붙든다.

- 어떤 전략으로 mission을 달성할지
- 어디서 task를 나누는지
- 어떤 순서와 의존으로 진행할지
- 어떤 리스크를 어느 phase에서 다룰지
- 무엇을 이번 mission에서 하지 않을지

## Mission 운영 모드

운영 모드는 같은 mission이라도 얼마만큼의 설계·검토·정리 깊이를 요구할지 정한다.

| mode | 기본 기대 |
|---|---|
| `lightweight` | 구조를 단순하게 두되 승인과 최소 artifact는 생략하지 않는다 |
| `standard` | 기본 depth다. 설계, 실행, 검토, 정리를 균형 있게 남긴다 |
| `full_depth` | 반대 의견, 미해결 리스크, carry-forward 근거까지 더 분명하게 남긴다 |

Mode는 판단 깊이를 조절하지만, 승인 순서나 final verdict 책임을 바꾸지는 않는다.

## Phase Review

Phase review는 phase gate의 공식 판단 기록이다. 정확한 필드 구조는 `phase-review.schema.json`을 따른다.

| 필드 | 의미 |
|---|---|
| `mission_phase` | 어떤 phase에 대한 review인지 |
| `status` | `ready_to_enter`, `ready_to_exit`, `blocked`, `escalated` 중 현재 판단 |
| `summary` | 이 판단을 뒷받침하는 요약 |
| `next_phase` | `ready_to_exit`일 때 다음으로 갈 phase |

Phase review는 미션 수준 판단 기록이다. 개별 task의 검증 통과나 closure decision을 대신하지 않는다.

## 4-Phase 모델

모든 mission은 `specifying -> building -> polishing -> consolidating` 흐름을 따른다. 다만 polishing에서 새 task가 생기면 building으로 되돌아갈 수 있다.

### `specifying`

| 항목 | 내용 |
|---|---|
| **목적** | 사용자 요청을 승인 가능한 mission 기준선으로 바꾸고, 초기 task 집합까지 설계한다 |
| **이 phase에서 확정/생성되는 것** | mission spec, mission design, 초기 task contract 집합, phase review |
| **slot별 주요 책임** | Design Authority가 mission spec, mission design, task 분해를 작성하고, Decision Maker가 승인하며, Orchestrator가 실행 가능성과 reviewer 구성 가능성을 점검한다 |
| **phase gate에서 확인하는 것** | mission spec이 사용자 승인 상태인지, mission design이 mission spec과 정합적인지, 초기 task contract 집합이 사용자 승인 상태인지 |
| **phase gate 통과 시 후속 작업** | 초기 task의 `status`를 `drafted`에서 `ready`로 바꾸고 `building`으로 전이한다 |

Specifying의 승인 순서는 고정한다.

1. mission spec 작성
2. 사용자 승인
3. mission design 작성
4. 사용자 승인
5. 초기 task contract 집합 작성
6. 사용자 승인

### `building`

| 항목 | 내용 |
|---|---|
| **목적** | 승인된 task contract를 실행하고 task별 evidence와 closure 근거를 축적한다 |
| **이 phase에서 확정/생성되는 것** | implementation contract, self-check, task evidence, gate 결과, task closure decision, phase review |
| **slot별 주요 책임** | Specialist가 작업과 review를 수행하고, Orchestrator가 순서와 상태를 관리하며 task closure decision을 남긴다 |
| **phase gate에서 확인하는 것** | 이 phase에서 끝내기로 한 task가 `passed`이거나, 남은 작업이 새 task나 carry-forward로 명시되었는지 |
| **phase gate 통과 시 후속 작업** | 통합 결과를 mission 수준에서 다듬는 `polishing`으로 전이한다 |

Building에서 Decision Maker가 task별 final verdict를 반복해서 내리지는 않는다. task를 닫는 판단은 Orchestrator의 task closure decision으로 처리하고, Decision Maker는 mission 수준 판단에 집중한다.

### `polishing`

| 항목 | 내용 |
|---|---|
| **목적** | task 단위 완료를 mission 수준 완성도로 다시 점검한다 |
| **이 phase에서 확정/생성되는 것** | 통합 검토 결과, 필요 시 추가 task contract, phase review |
| **slot별 주요 책임** | Orchestrator가 통합 상태를 정리하고, Design Authority와 관련 specialist가 남은 구조적 부족분을 식별한다 |
| **phase gate에서 확인하는 것** | 남은 부족분이 새 task로 풀릴지, debt/gap으로 남길지, 아니면 추가 조치 없이 mission을 마무리할 수 있는지 |
| **phase gate 통과 시 후속 작업** | 새 task가 필요하면 contract를 작성해 다시 `building`으로 돌아가고, 아니면 `consolidating`으로 전이한다 |

Polishing은 "예쁘게 마무리"하는 단계라기보다, 미션 수준에서 부족분을 식별하고 흡수할지 되돌릴지 정하는 단계다.

### `consolidating`

| 항목 | 내용 |
|---|---|
| **목적** | mission을 닫기 전에 남길 것과 넘길 것을 확정한다 |
| **이 phase에서 확정/생성되는 것** | gap assessment, debt register, rules/memory 입력, 마지막 phase review |
| **slot별 주요 책임** | Orchestrator가 종결 근거를 정리하고, Design Authority가 scope closure를 점검하며, Decision Maker가 final verdict를 내린다 |
| **phase gate에서 확인하는 것** | debt와 gap이 정리되었는지, 다음 작업으로 넘길 항목이 드러나는지, final verdict 판단 근거가 충분한지 |
| **phase gate 통과 시 후속 작업** | Decision Maker가 mission final verdict를 남기고 mission phase를 `complete`로 전이한다 |

## Mission-level Deliberation

Deliberation은 미션 수준에서 명시적 다자 판단이 필요할 때 남기는 구조화된 심의 기록이다. 저장 위치와 현재 schema 파일명은 doc 08이 관리한다.

Mission-level deliberation은 보통 다음 때 열린다.

- mission spec이나 mission design의 구조적 방향에 이견이 클 때
- polishing이나 consolidating에서 carry-forward 범위를 두고 판단이 갈릴 때
- final verdict 전에 보류, 승인, 에스컬레이션 근거를 명시적으로 남겨야 할 때

Task를 닫기 위한 deliberation은 doc 03이 owner다.

## Mission Final Verdict

Mission final verdict는 미션 전체를 승인할지, 추가 작업을 요구할지, 에스컬레이션할지를 정하는 마지막 판단이다. 이 판단은 Decision Maker만 내릴 수 있다.

Mission final verdict는 다음 근거를 함께 본다.

- 승인된 mission spec과 mission design
- 마지막 phase review
- gap assessment
- debt register
- carry-forward 항목
- 필요하면 mission-level deliberation 기록

모든 task가 `passed`라고 해서 mission final verdict가 자동으로 `approved`가 되는 것은 아니다. 미션 수준에서 남은 gap, 수용된 debt, 다음 작업으로 넘겨야 할 내용이 여전히 있을 수 있기 때문이다.
