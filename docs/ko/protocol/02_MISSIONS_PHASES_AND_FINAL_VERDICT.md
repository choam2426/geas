# 02. Missions, Phases, and Final Verdict

> Geas의 mission 모델, mission operating mode, 4-phase 흐름, phase review, mission-level deliberation, mission final verdict를 정의한다.

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

mission spec은 다음 필드를 고정한다.

| 핵심 필드 | 의미 |
|---|---|
| `id` | 이 미션을 식별하는 안정적인 id |
| `name` | 미션 이름 |
| `description` | 사용자가 실제로 원하는 일과 이 미션이 왜 필요한지 |
| `definition_of_done` | 미션이 끝났다고 판단하는 상위 기준 |
| `mode` | mission operating mode (lightweight / standard / full_depth) |
| `scope.in` / `scope.out` | 이 미션이 맡는 범위와 맡지 않는 범위 |
| `affected_surfaces` | 미션 결과로 영향이 갈 가능성이 큰 표면 |
| `acceptance_criteria` | `definition_of_done`에서 파생된 구체 완료 기준, phase gate와 task 도출에 쓴다 |
| `constraints` | 반드시 지켜야 하는 제약 |
| `risks` | 시작 시점에 알고 있는 mission 수준 위험 |
| `user_approved` | 현재 mission spec을 실행 기준으로 사용자에게 승인받았는지 여부 |

mission spec은 대화나 토론을 통해 사용자 요청을 구체화한 결과여야 한다. 미션이 크거나 모호할수록 `risks`와 `constraints`를 숨기지 않고 드러내야 한다. 실행 중 발견되는 assumption이나 해결해야 할 unknown 사항은 mission design에서 풀어 쓴다.

Mission spec은 사용자 승인 이후 immutable이다. scope를 넓히거나 definition of done이 바뀌어야 한다면 현재 mission을 escalate하거나 새 mission으로 시작한다. `specifying`으로의 phase 역행은 허용하지 않는다.

### Mission Design

Mission design(`mission-design.md`)은 승인된 mission spec을 실제 구현 계획으로 풀어 쓴 문서다. Design Authority가 작성하고 **사용자가 최종 승인**한다. 사용자 승인 전의 선행 절차는 mode에 따라 다르다 — `lightweight`는 선행 절차 없이 사용자에게 바로 올라가고, `standard`는 Decision Maker 리뷰를 거친 뒤 사용자 승인, `full_depth`는 Decision Maker·Challenger·specialist 1명이 참여하는 deliberation을 거친 뒤 사용자 승인. 미션의 "어떻게"를 담는 기준선으로, 접근·설계 결정·검증 계획·리스크·실패 모드를 한곳에 정리한다.

Mission design은 다음 섹션을 고정한다. 모든 섹션은 required이며, 해당 없는 섹션은 `해당 없음 ({이유})`을 한 줄로 명시한다.

| 섹션 | 내용 |
|---|---|
| `## Strategy` | 높은 수준의 접근. 주 경로와 선택 이유 |
| `## Architecture & Integration` | 컴포넌트 구조, 데이터 흐름, 기존 표면과의 접점 |
| `## Task Breakdown Rationale` | 왜 이 경계로 task를 나눴는지 (task 목록 자체는 task-contract가 담당) |
| `## Verification Plan` | 카테고리별 검증 활동. 각 항목은 범위, 도구, 책임 slot을 명시 |
| `## Key Design Decisions` | 주요 설계 결정, 이유, 고려한 대안 |
| `## Assumptions` | 설계 전제. `- {전제}: {깨지면 영향}` |
| `## Unknowns` | 미결 사항. `- {내용} — resolve at {phase} — {방법}` |
| `## Risks` | 리스크와 완화/수용 근거 |
| `## Failure Modes` | 예상 실패 패턴과 대응 |
| `## Migration / Rollout` | 기존 기능 전환 계획 또는 `해당 없음 ({이유})` |

헤딩은 정확히 위 이름으로 고정한다. CLI는 섹션 존재 여부만 검증한다.

## 4-Phase 모델

모든 mission은 `specifying -> building -> polishing -> consolidating` 흐름을 따르며, consolidating이 종결되면 mission phase는 종결 상태인 `complete`로 전이한다. 다만 polishing에서 새 task가 생기면 building으로 되돌아갈 수 있다.

### Phase Review

Phase review는 phase gate에서 "이 phase를 들어가도/나와도 되는가"를 판정한 공식 기록이다. 한 미션의 모든 phase review는 단일 파일(`phase-reviews.json`)의 `reviews` 배열에 시간 순으로 append된다. 정확한 구조는 `phase-reviews.schema.json`이 관리한다.

각 review object는 다음 필드를 가진다.

| 필드 | 의미 |
|---|---|
| `mission_phase` | 어떤 phase에 대한 review인지 |
| `status` | `passed`, `blocked`, `escalated` 중 이번 gate 판정 |
| `summary` | 이 판단을 뒷받침하는 요약 |
| `next_phase` | `passed`일 때 다음으로 갈 phase |
| `created_at` | 이 review가 작성된 시각 |

Phase review는 미션 수준 판단 기록이다. 개별 task의 검증 통과나 closure decision을 대신하지 않는다. 같은 phase에서 blocked 후 재시도가 일어나면 같은 `mission_phase` 값으로 새 review object가 배열에 append된다.

### `specifying`

**목적**: 사용자 요청을 승인 가능한 mission 기준선으로 바꾸고, 초기 task 집합까지 설계한다.

**산출물**: mission spec, mission design, 초기 task contract 집합, phase review.

**Slot별 책임**: Orchestrator가 사용자와의 대화·토론을 통해 요청을 구체화하여 mission spec을 작성한다. Design Authority가 mission design과 task 분해를 작성한다. 사용자가 이들을 최종 승인한다 — **최종 승인 주체는 언제나 사용자**이며, mode에 따라 사용자 승인 전 선행 절차가 다르다. `lightweight`는 선행 절차 없이 사용자 승인으로 바로 간다. `standard`는 mission design과 초기 task contract 집합에 대해 Decision Maker가 사용자 승인 전 리뷰를 수행한다. `full_depth`는 같은 대상에 대해 Decision Maker·Challenger·specialist 1명이 참여하는 deliberation이 사용자 승인 전 필수로 열린다. Orchestrator가 실행 가능성과 reviewer 구성 가능성도 함께 점검한다.

**Phase gate 확인 사항**: mission spec이 사용자 승인 상태인지, mission design이 mission spec과 정합적인지, 초기 task contract 집합이 사용자 승인 상태인지.

**Phase gate 통과 시**: 초기 task의 `status`를 `drafted`에서 `ready`로 바꾸고 `building`으로 전이한다.

Specifying의 승인 순서는 고정한다.

1. mission spec 작성
2. 사용자 승인
3. mission design 작성
4. mode별 선행 절차: `standard`는 Decision Maker 리뷰, `full_depth`는 Decision Maker·Challenger·specialist 1명 deliberation (`lightweight`는 건너뜀)
5. 사용자 승인
6. 초기 task contract 집합 작성
7. mode별 선행 절차 (4와 동일)
8. 사용자 승인

### `building`

**목적**: 승인된 task contract를 실행하고 task별 evidence와 종결 근거를 축적한다.

**산출물**: implementation contract, self-check, task evidence, gate result, task closure decision, phase review.

**Slot별 책임**: Specialist가 작업과 review를 수행한다. Orchestrator가 순서와 상태를 관리하며 task closure decision을 남긴다.

**Phase gate 확인 사항**: 이 phase에서 끝내기로 한 task가 `passed`이거나, 남은 작업이 새 task나 carry-forward로 명시되었는지.

**Phase gate 통과 시**: 통합 결과를 mission 수준에서 다듬는 `polishing`으로 전이한다.

Building에서 Decision Maker가 task별 final verdict를 반복해서 내리지는 않는다. task를 종결하는 판단은 Orchestrator의 task closure decision으로 처리하고, Decision Maker는 mission 수준 판단에 집중한다.

Building이나 polishing에서 새 task contract가 추가될 때 승인 주체는 현재 mission scope 내인지에 따라 갈린다. 현재 mission scope 안에 들어오는 task는 Decision Maker가 승인하며 task contract의 `approved_by`는 `decision-maker`로 기록한다. 현재 scope 밖 작업은 이 mission 안에서 처리하지 않는다 — mission spec은 immutable이므로, 사용자가 scope를 넓히고 싶다면 이 mission을 escalate하거나 후속 mission을 새로 생성해 carry-forward로 연결한다.

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

**Slot별 책임**: Orchestrator가 종결 근거와 debts, memory update를 정리한다. Design Authority가 scope closure를 점검하고 gap을 작성한다. Decision Maker가 mission final verdict를 내린다.

**Phase gate 확인 사항**: debt와 gap이 정리되었는지, 다음 작업으로 넘길 항목이 드러나는지, final verdict 판단 근거가 충분한지.

**Phase gate 통과 시**: mission phase를 `complete`로 전이한다.

### Phase 역행 규칙

Phase gate가 `passed`로 끝난 뒤 다음 phase를 정할 때, 정상 경로 외에 다음 역행만 허용된다.

- `polishing → building`: 남은 구조적 부족분이 새 task로만 풀릴 때.
- `consolidating → polishing` 또는 `consolidating → building`: consolidating에서 debt나 gap으로 넘길 수 없는 부족분이 드러나 mission 안에서 다시 처리해야 할 때.

`specifying`으로의 역행은 허용하지 않는다. mission spec 자체가 바뀌어야 한다면 현재 mission을 escalate하거나 새 mission으로 시작한다.

## Mission-level Deliberation

Deliberation은 미션 수준에서 명시적 다자 판단이 필요할 때 남기는 구조화된 심의 기록이다. 정확한 구조는 `deliberation.schema.json`이 관리하며, 같은 schema가 task-level deliberation에도 쓰인다. 한 scope의 모든 심의는 단일 파일(mission-level은 `deliberations.json`, task-level은 각 task의 `deliberations.json`)의 `entries` 배열에 시간 순으로 append된다. 파일 최상위의 `level` 필드로 scope를 구분하며, task-level일 때는 `task_id`도 함께 기록한다.

Deliberation entry는 voter들의 vote와 최종 `result`가 모두 확정된 상태로만 append한다. 진행 중인 "열린 심의" 상태는 artifact에 기록하지 않고 orchestrator 맥락 안에서만 추적한다. 이 규약은 append-only 불변성을 유지하기 위한 것이다 — 한 번 기록된 entry는 이후 수정되지 않는다.

Mission-level deliberation은 보통 다음 때 열린다.

- mission spec이나 mission design의 구조적 방향에 이견이 클 때
- polishing이나 consolidating에서 carry-forward 범위를 두고 판단이 갈릴 때
- final verdict 전에 보류, 승인, escalate 근거를 명시적으로 남겨야 할 때

### Operating mode별 요구

- `lightweight`: 이견이 드러날 때 ad-hoc으로 엶. mission design과 초기 task contract 집합은 사용자가 바로 승인한다.
- `standard`: 위 세 상황 중 하나가 발생하면 엶. mission design과 초기 task contract 집합은 Decision Maker가 사용자 승인 전에 리뷰한다.
- `full_depth`: standard 규칙에 더해, 사용자가 mission design과 초기 task contract 집합을 승인하기 전에 각각 최소 한 번의 deliberation을 필수로 엶. 이 deliberation에는 Decision Maker, Challenger, 그리고 해당 미션 맥락에 맞는 specialist slot 한 명이 voter로 참여한다 (최소 3 voter). 이 deliberation이 통과하면 Decision Maker의 별도 리뷰는 생략할 수 있다.

Challenger 참가는 lightweight와 standard에서는 선택이며, full_depth에서는 필수다. Voter slot이 artifact에 기록되므로 phase gate는 full_depth mission의 deliberation entry에 `voter: challenger`가 포함되는지와 voter 수가 3 이상인지 확인하고 어느 하나라도 누락되면 해당 phase를 통과시키지 않는다. 이 3-voter + Challenger 요구는 phase review가 강제하며, CLI의 `deliberation append`는 schema 최소(2 voter) 이상이면 받아들인다 — 즉 요건 위반은 phase 종결 시점에 검출된다.

Orchestrator는 이 최소 요건 이상으로 voter 수를 늘릴 재량을 갖는다. 사안 무게나 범위를 고려해 판단이 더 넓은 관점을 요구한다고 판단하면 추가 specialist를 voter로 포함시킨다. 어느 mode에서든 위에서 정의한 최소 요건은 동일하게 적용되고, 그 이상은 orchestrator의 판단에 맡긴다.

Task를 종결하기 위한 deliberation은 doc 03이 owner다.

## Mission Verdict

Mission verdict는 미션의 종결 판단이다. verdict 값은 `approved` / `changes_requested` / `escalated` / `cancelled` 중 하나이며, 이 판단은 Decision Maker만 내릴 수 있다. 한 미션의 모든 verdict는 단일 파일(`mission-verdicts.json`)의 `verdicts` 배열에 시간 순으로 append된다. 정확한 구조는 `mission-verdicts.schema.json`이 관리한다.

`changes_requested`나 `escalated` 이후 추가 작업을 거쳐 다시 consolidating이 끝나면 새 verdict object가 배열에 append된다. 최신 항목이 현재 판단이다.

각 verdict object는 다음 필드를 가진다.

| 필드 | 의미 |
|---|---|
| `verdict` | `approved` / `changes_requested` / `escalated` / `cancelled` 중 이번 판단 |
| `rationale` | 이 판단의 근거 서술. 필요하면 특정 artifact 경로를 문장 안에 인용 |
| `carry_forward` | 미래로 넘길 항목(리스크, debt, 미해결 gap 등). 없으면 빈 배열 |
| `created_at` | 이 verdict가 작성된 시각 |

### 취소된 mission 처리

사용자 요청이나 외부 사유로 mission을 중단해야 할 때는 verdict `cancelled`로 종결한다. 실행이 조금이라도 진행된 mission은 consolidating phase를 거쳐 가능한 범위에서 debts, gap, memory update를 정리한 뒤 verdict `cancelled`를 기록한다. 아직 mission spec이 사용자 승인되지 않은 specifying 단계에서 포기하는 경우에만 consolidating을 건너뛰고 곧바로 `complete`로 전이하면서 verdict `cancelled`를 남긴다.

Decision Maker는 verdict를 낼 때 미션의 모든 artifact(mission spec, mission design, phase reviews, gap, debts, memory update, 모든 mission-level deliberation, 각 task의 contract·evidence·closure)를 읽고 판단한다. 판단 근거는 `rationale`에 담는다.

모든 task가 `passed`라고 해서 verdict가 자동으로 `approved`가 되는 것은 아니다. 미션 수준에서 남은 gap, 수용된 debt, 다음 작업으로 넘겨야 할 내용이 여전히 있을 수 있기 때문이다.
