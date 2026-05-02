# 06. Memory

> Geas의 memory 구조, 변경 이력, retrieval, rollback을 정의한다. Task에서 올라오는 회고 입력은 doc 03이 owner이고, 미해결 debt와 gap은 doc 07이 owner다.

## 목적

Memory는 "다음 mission이 더 잘하게 만드는 기록"이다. 이 문서는 task 단위 작업 기록 자체가 아니라, 여러 mission에서 축적된 교훈을 어떻게 memory로 반영할지를 정의한다.

## Memory의 구조

Memory는 두 scope로 나뉘어 저장된다.

| scope | 경로 | 역할 |
|---|---|---|
| shared | `.geas/memory/shared.md` | 팀 전체가 따라야 하는 규칙, 관례, 금지, 기본 절차 |
| agent | `.geas/memory/agents/{agent_type}.md` | 특정 agent type이 참고할 개인화된 교훈. Namespace는 concrete agent type 이름이다 — authority는 slot 이름과 동일(예: `decision-maker.md`), specialist는 도메인 프로필이 정한 concrete type(예: `software-engineer.md`) |

Shared memory는 규범적이다. 반복 가능한 행동 기준으로 쓰이며, enforcement나 review에서 근거로 인용된다. Agent memory는 조언적이다. 역할별 판단을 돕지만, 새 mission의 contract나 evidence와 충돌하면 쉽게 버릴 수 있다.

Task evidence의 `memory_suggestions`와 closure evidence의 회고 필드(`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`)는 후보 입력일 뿐이다. 이 문서는 그 입력을 각 scope로 어떻게 승격할지 다룬다. debt와 gap 신호는 doc 07이 owner다.

## Shared Memory

Shared memory (`.geas/memory/shared.md`)는 장기적으로 재사용할 규칙을 모은다. 프로토콜은 정확한 문서 형식을 강제하지 않지만, 각 항목은 최소한 다음을 식별할 수 있어야 한다.

- 고유 `memory_id` — memory-update.json이 참조할 수 있는 안정적 식별자
- 본문 — 반복 가능한 행동 기준
- 출처 — 항목을 낳은 mission이나 evidence

Shared memory에는 일회성 상황 설명보다 반복 가능한 행동 기준이 들어가야 한다. 구현체는 읽기 편하게 항목을 범주로 묶어도 되고 묶지 않아도 된다 — 예: 프로젝트 관례, 학습된 규칙, 역할별 규칙.

## Agent Memory

Agent memory (`.geas/memory/agents/{agent_type}.md`)는 특정 **concrete agent type**이 다음 mission에서도 참고할 수 있는 메모다. Namespace 키는 agent type 이름이다. Authority slot은 단일 agent로 구성되므로 slot 이름이 곧 type 이름이다 (예: `challenger.md`). Specialist slot은 mission spec의 `domain_profile`이 정한 concrete type 이름을 쓴다 (예: `software-engineer.md`, `security-engineer.md`). Slot 이름은 memory namespace로 쓰지 않는다 — 같은 specialist slot을 도메인별로 다른 concrete type이 맡을 수 있기 때문에 slot 단위로 누적하면 도메인별 학습이 뒤섞인다.

좋은 agent memory는 다음 특징을 가진다.

- 한 번만 맞았던 우연이 아니라 반복 가능한 교훈이다.
- 역할에 맞는 판단 포인트를 짧게 요약한다.
- 새 mission의 contract나 evidence와 충돌하면 쉽게 버릴 수 있다.

Agent memory도 shared memory와 동일하게 consolidating phase에서 Orchestrator가 승격 판단을 내리고, 그 결과를 `memory-update.json`의 `agents` 섹션에 기록한다. `agents` 배열의 각 entry `agent` 키는 concrete type 이름을 쓴다.

## Memory Update

이 mission이 memory에 가한 변경은 `memory-update.json`에 기록한다. 경로는 `.geas/missions/{mission_id}/consolidation/memory-update.json`, 정확한 구조는 `memory-update.schema.json`이 관리한다.

memory-update.json은 두 섹션을 가진다.

- `shared` — `memory/shared.md`에 가한 변경 (added / modified / removed)
- `agents` — agent type별 `memory/agents/{agent_type}.md` 변경. 변경 있는 agent type만 배열에 포함

각 added·modified 항목은 `memory_id`, `reason`, 변경 근거가 된 `evidence_refs`를 남긴다. removed 항목은 `memory_id`와 `reason`만 남긴다. 제안됐지만 반영되지 않은 변경은 memory-update.json에 들어가지 않는다. 반영 여부 자체를 논의해야 할 만큼 비중이 큰 제안이라면 deliberation에 남기고, 거기에서 결론이 나면 그 결론만 memory-update.json에 반영한다.

Orchestrator가 consolidating phase에서 작성한다. task evidence의 `memory_suggestions`와 closure evidence의 회고 필드를 입력으로 받아, 각 후보를 (1) shared로 승격, (2) 특정 agent type memory로 승격, (3) 버림 중에서 결정하고, 승격된 결과만 이 artifact에 기록한다.

### shared memory 후보가 되는 기준

- 같은 실패나 혼선이 반복해서 나타난다.
- 항목이 생기면 행동이 달라진다.
- 특정 mission에만 맞는 임시 요령이 아니다.
- evidence나 재개 과정에서 드러난 반복 패턴 같은 실제 근거가 있다.

## Retrieval

Memory는 구현체가 context에 자동 주입하기 편하도록 존재하는 것이 아니라, 더 나은 판단을 돕기 위해 존재한다.

- mission 시작 시 mission spec의 scope·affected_surfaces와 관련 있는 shared memory와 agent memory를 먼저 읽는다.
- 새 task가 `ready`로 열릴 때 해당 task contract의 scope·surfaces에 관련된 memory만 다시 끌어온다. Task마다 적용 대상이 다르기 때문이다.
- 오래된 memory가 현재 mission spec이나 task contract와 충돌하면 현재 계약을 우선한다.

## Rollback

기존 memory가 오히려 품질을 떨어뜨리거나 잘못된 반복을 만든다면 되돌릴 수 있어야 한다. Shared memory, agent memory 모두에 해당한다.

- memory는 반복 가능한 교훈만 누적한다. 한 번의 우연이나 단기 상황은 승격하지 않는다.
- 더 이상 유효하지 않은 항목은 즉시 rollback한다. 실제 절차는 Memory Update 섹션이 정한다.
- rollback의 근거를 함께 남긴다. rollback 패턴 자체가 반복되면 ("이 유형의 memory를 자주 잘못 승격한다") 별도 항목으로 승격한다.
