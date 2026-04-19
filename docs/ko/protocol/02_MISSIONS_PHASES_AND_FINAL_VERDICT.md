# 02. Missions, Phases, and Final Verdict

> GEAS의 mission 모델, mission operating mode, 4-phase 흐름, phase review, mission-level deliberation, mission final verdict를 정의한다.

## 목적

Mission은 사용자 요청을 실행 가능한 작업 체계로 바꾸는 상위 단위다. 이 문서는 미션을 무엇으로 정의하고, 어떤 승인 순서로 좁혀 가며, 언제 미션이 다음 phase로 넘어가고 최종적으로 승인되는지를 다룬다.

## Mission

Mission은 두 artifact로 정의된다.

- **Mission spec** — 미션이 무엇을 만족해야 하는지 (contract)
- **Mission design** — 어떻게 달성할지 (plan)

이와 함께 **operating mode**가 미션의 판단 깊이를 정한다 (spec의 `mode` 필드).

세 요소 모두 specifying phase에서 확정된다.

### Mission Operating Mode

Operating mode는 같은 mission이라도 얼마만큼의 설계·검토·정리 깊이를 요구할지 정한다.

| mode | 기본 기대 |
|---|---|
| `lightweight` | 구조를 단순하게 두되 승인과 최소 artifact는 생략하지 않는다 |
| `standard` | 기본 depth다. 설계, 실행, 검토, 정리를 균형 있게 남긴다 |
| `full_depth` | 반대 의견, 미해결 리스크, carry-forward 근거까지 더 분명하게 남긴다 |

Operating mode는 판단 깊이를 조절하지만, 승인 순서나 final verdict 책임을 바꾸지는 않는다.

### Mission Spec

Mission spec은 "이번 실행이 무엇을 만족해야 하는가"를 고정하는 상위 계약이다. Orchestrator가 작성하고 사용자가 승인한다. 정규 JSON artifact는 `spec.json`이고, 정확한 구조는 `mission-spec.schema.json`이 관리한다.

mission spec은 최소한 다음 필드를 고정한다.

| 핵심 필드 | 의미 |
|---|---|
| `mission_id` | 이 미션을 식별하는 안정적인 id |
| `mission` | 사용자가 실제로 원하는 일 |
| `definition_of_done` | 미션이 끝났다고 판단하는 상위 기준 |
| `mode` | mission operating mode (lightweight / standard / full_depth) |
| `scope.in` / `scope.out` | 이 미션이 맡는 범위와 맡지 않는 범위 |
| `affected_surfaces` | 미션 결과로 영향이 갈 가능성이 큰 표면 |
| `acceptance_criteria` | `definition_of_done`에서 파생된 구체 완료 기준, phase gate와 task 도출에 쓴다 |
| `constraints` | 반드시 지켜야 하는 제약 |
| `risks` | 시작 시점에 알고 있는 mission 수준 위험 |
| `user_approved` | 현재 mission spec을 실행 기준으로 사용자에게 승인받았는지 여부 |

mission spec은 대화나 토론을 통해 사용자 요청을 구체화한 결과여야 한다. 미션이 크거나 모호할수록 `risks`와 `constraints`를 숨기지 않고 드러내야 한다. 실행 중 발견되는 assumption이나 해결해야 할 unknown 사항은 mission design에서 풀어 쓴다.

### Mission Design

Mission design(`mission-design.md`)은 승인된 mission spec을 실행 계획으로 풀어 쓴 문서다. standalone schema는 없지만, 어떤 접근을 택했고 어떤 task 구조로 나눌지, 어떤 리스크를 어디서 흡수할지를 사람이 읽을 수 있게 정리한 기준선이다.

Mission design은 최소한 다음을 고정한다.

- 어떤 전략으로 mission을 달성할지
- 어디서 task를 나누는지
- 어떤 순서와 의존으로 진행할지
- 실행 시 전제하는 assumption
- 아직 명확하지 않은 unknown과 언제 해결할지
- 어떤 리스크를 어느 phase에서 다룰지
- 무엇을 이번 mission에서 하지 않을지

## 4-Phase 모델

모든 mission은 `specifying -> building -> polishing -> consolidating` 흐름을 따르며, consolidating이 종결되면 mission phase는 종결 상태인 `complete`로 전이한다. 다만 polishing에서 새 task가 생기면 building으로 되돌아갈 수 있다.

### Phase Review

Phase review는 phase gate에서 "이 phase를 들어가도/나와도 되는가"를 판정한 공식 기록이다. 정확한 구조는 `phase-review.schema.json`이 관리한다.

| 필드 | 의미 |
|---|---|
| `mission_phase` | 어떤 phase에 대한 review인지 |
| `status` | `ready_to_enter`, `ready_to_exit`, `blocked`, `escalated` 중 이번 gate 판정 |
| `summary` | 이 판단을 뒷받침하는 요약 |
| `next_phase` | `ready_to_exit`일 때 다음으로 갈 phase |

Phase review는 미션 수준 판단 기록이다. 개별 task의 검증 통과나 closure decision을 대신하지 않는다.

### `specifying`

**목적**: 사용자 요청을 승인 가능한 mission 기준선으로 바꾸고, 초기 task 집합까지 설계한다.

**산출물**: mission spec, mission design, 초기 task contract 집합, phase review.

**Slot별 책임**: Orchestrator가 사용자와의 대화·토론을 통해 요청을 구체화하여 mission spec을 작성한다. Design Authority가 mission design과 task 분해를 작성한다. Decision Maker가 이들을 승인한다. Orchestrator가 실행 가능성과 reviewer 구성 가능성도 함께 점검한다.

**Phase gate 확인 사항**: mission spec이 사용자 승인 상태인지, mission design이 mission spec과 정합적인지, 초기 task contract 집합이 사용자 승인 상태인지.

**Phase gate 통과 시**: 초기 task의 `status`를 `drafted`에서 `ready`로 바꾸고 `building`으로 전이한다.

Specifying의 승인 순서는 고정한다.

1. mission spec 작성
2. 사용자 승인
3. mission design 작성
4. 사용자 승인
5. 초기 task contract 집합 작성
6. 사용자 승인

### `building`

**목적**: 승인된 task contract를 실행하고 task별 evidence와 종결 근거를 축적한다.

**산출물**: implementation contract, self-check, task evidence, gate result, task closure decision, phase review.

**Slot별 책임**: Specialist가 작업과 review를 수행한다. Orchestrator가 순서와 상태를 관리하며 task closure decision을 남긴다.

**Phase gate 확인 사항**: 이 phase에서 끝내기로 한 task가 `passed`이거나, 남은 작업이 새 task나 carry-forward로 명시되었는지.

**Phase gate 통과 시**: 통합 결과를 mission 수준에서 다듬는 `polishing`으로 전이한다.

Building에서 Decision Maker가 task별 final verdict를 반복해서 내리지는 않는다. task를 종결하는 판단은 Orchestrator의 task closure decision으로 처리하고, Decision Maker는 mission 수준 판단에 집중한다.

### `polishing`

**목적**: task 단위 완료를 mission 수준 완성도로 다시 점검한다.

**산출물**: 필요 시 추가 task contract, phase review.

**Slot별 책임**: Orchestrator가 통합 상태를 정리한다. Design Authority와 관련 specialist가 남은 구조적 부족분을 식별한다.

**Phase gate 확인 사항**: 남은 부족분이 새 task로 풀릴지, debt/gap으로 남길지, 아니면 추가 조치 없이 mission을 마무리할 수 있는지.

**Phase gate 통과 시**: 새 task가 필요하면 contract를 작성해 다시 `building`으로 돌아가고, 아니면 `consolidating`으로 전이한다.

Polishing은 "예쁘게 마무리"하는 단계라기보다, 미션 수준에서 부족분을 식별하고 흡수할지 되돌릴지 정하는 단계다.

### `consolidating`

**목적**: mission을 종결하기 전에 남길 것과 넘길 것을 확정한다.

**산출물**: gap, debts, memory 입력, mission final verdict, 마지막 phase review.

**Slot별 책임**: Orchestrator가 종결 근거를 정리한다. Design Authority가 scope closure를 점검한다. Decision Maker가 mission final verdict를 내린다.

**Phase gate 확인 사항**: debt와 gap이 정리되었는지, 다음 작업으로 넘길 항목이 드러나는지, final verdict 판단 근거가 충분한지.

**Phase gate 통과 시**: mission phase를 `complete`로 전이한다.

## Mission-level Deliberation

Deliberation은 미션 수준에서 명시적 다자 판단이 필요할 때 남기는 구조화된 심의 기록이다. 정확한 구조는 `deliberation.schema.json`이 관리하며, 같은 schema가 task-level deliberation에도 쓰인다. level은 저장 경로로 구분한다.

Mission-level deliberation은 보통 다음 때 열린다.

- mission spec이나 mission design의 구조적 방향에 이견이 클 때
- polishing이나 consolidating에서 carry-forward 범위를 두고 판단이 갈릴 때
- final verdict 전에 보류, 승인, escalate 근거를 명시적으로 남겨야 할 때

### Operating mode별 요구

- `lightweight`: 이견이 드러날 때 ad-hoc으로 엶.
- `standard`: 위 세 상황 중 하나가 발생하면 엶.
- `full_depth`: standard 규칙에 더해, mission design을 사용자 승인하기 전에 최소 한 번의 deliberation을 필수로 엶. 모든 full_depth deliberation에는 Challenger가 필수로 참가한다.

Challenger 참가는 lightweight와 standard에서는 선택이며, full_depth에서는 필수다.

Task를 종결하기 위한 deliberation은 doc 03이 owner다.

## Mission Final Verdict

Mission final verdict는 미션 전체의 종결 판단이다. verdict 값은 `approved` / `changes_requested` / `escalated` 중 하나이며, 이 판단은 Decision Maker만 내릴 수 있다. 정규 JSON artifact는 `mission-verdict.json`이고, 정확한 구조는 `mission-verdict.schema.json`이 관리한다.

Mission final verdict는 다음 근거를 함께 본다.

- 승인된 mission spec과 mission design
- 마지막 phase review
- gap
- debts
- carry-forward 항목
- 필요하면 mission-level deliberation 기록

모든 task가 `passed`라고 해서 mission final verdict가 자동으로 `approved`가 되는 것은 아니다. 미션 수준에서 남은 gap, 수용된 debt, 다음 작업으로 넘겨야 할 내용이 여전히 있을 수 있기 때문이다.
