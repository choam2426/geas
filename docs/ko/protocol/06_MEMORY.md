# 06. Memory

> GEAS의 memory 구조, 변경 이력, retrieval, 잘못된 재사용의 rollback, mission 간 carry forward를 정의한다. Task에서 올라오는 retrospective 입력은 doc 03이 owner다.

## 목적

Memory는 "다음 mission이 더 잘하게 만드는 기록"이다. 이 문서는 task 단위 작업 기록 자체가 아니라, 여러 mission에서 축적된 교훈을 어떻게 memory로 반영할지를 정의한다.

## Memory의 구조

Memory는 두 scope로 나뉘어 저장된다.

| scope | 경로 | 역할 |
|---|---|---|
| shared | `.geas/memory/shared.md` | 팀 전체가 따라야 하는 규칙, 관례, 금지, 기본 절차 |
| agent | `.geas/memory/agents/{agent}.md` | 특정 역할이나 agent가 참고할 개인화된 교훈 |

Shared memory는 규범적이다. 반복 가능한 행동 기준으로 쓰이며, enforcement나 review에서 근거로 인용된다. Agent memory는 조언적이다. 역할별 판단을 돕지만, 새 mission의 contract나 evidence와 충돌하면 쉽게 버릴 수 있다.

Task evidence의 `memory_suggestions`나 retrospective의 `rule_candidates`·`memory_candidates`는 후보 입력일 뿐이다. 이 문서는 그 입력을 각 scope로 어떻게 승격할지 다룬다. debt와 gap 신호는 doc 07이 owner다.

## Shared Memory

Shared memory (`.geas/memory/shared.md`)는 장기적으로 재사용할 규칙을 모은다. 프로토콜은 정확한 문서 형식을 강제하지 않지만, 각 항목은 최소한 다음을 식별할 수 있어야 한다.

- 고유 `memory_id` — memory-update.json이 참조할 수 있는 안정적 식별자
- 본문 — 반복 가능한 행동 기준
- 출처 — 항목을 낳은 mission이나 evidence

Shared memory에는 일회성 상황 설명보다 반복 가능한 행동 기준이 들어가야 한다. 구현체는 읽기 편하게 항목을 범주로 묶어도 되고 묶지 않아도 된다 — 예: 프로젝트 관례, 학습된 규칙, 역할별 규칙.

## Agent Memory

Agent memory (`.geas/memory/agents/{agent}.md`)는 특정 slot이나 concrete agent가 다음 mission에서도 참고할 수 있는 역할별 메모다.

좋은 agent memory는 다음 특징을 가진다.

- 한 번만 맞았던 우연이 아니라 반복 가능한 교훈이다.
- 역할에 맞는 판단 포인트를 짧게 요약한다.
- 새 mission의 contract나 evidence와 충돌하면 쉽게 버릴 수 있다.

Shared memory와 달리 agent memory는 조언적이라, formal 변경 이력을 두지 않는다. 각 mission의 retrospective 신호가 승격된 결과는 agent memory 파일 자체에 반영된다.

## Memory Update

Shared memory의 각 mission별 변경 이력은 `memory-update.json`에 기록한다. 경로는 `.geas/missions/{mission_id}/consolidation/memory-update.json`, 정확한 구조는 `memory-update.schema.json`이 관리한다.

Memory update는 이 mission이 shared memory에 가한 변경을 기록한다.

- `added` — 새로 추가한 항목 목록
- `modified` — 기존 항목 중 내용이나 범위가 바뀐 것
- `removed` — 삭제되거나 더 이상 유효하지 않다고 판단한 것

각 항목은 memory_id와 reason을 남기고, 필요하면 evidence나 deliberation 링크도 함께 기록한다. 제안됐지만 반영되지 않은 변경은 memory-update.json에 들어가지 않는다. 반영 여부 자체를 논의해야 할 만큼 비중이 큰 제안이라면 deliberation에 남기고, 거기에서 결론이 나면 그 결론만 memory-update.json에 반영한다.

### shared memory 후보가 되는 기준

- 같은 실패나 혼선이 반복해서 나타난다.
- 항목이 생기면 행동이 달라진다.
- 특정 mission에만 맞는 임시 요령이 아니다.
- evidence나 재개 과정에서 드러난 반복 패턴 같은 실제 근거가 있다.

## Retrieval

Memory는 자동 주입의 편의를 위해 존재하는 것이 아니라, 더 나은 판단을 돕기 위해 존재한다.

- mission 시작 시 관련 shared memory와 agent memory를 먼저 읽는다.
- 새 task나 새 phase가 열릴 때 현재 contract와 직접 관련된 memory만 다시 끌어온다.
- 오래된 memory가 현재 계약과 충돌하면 현재 계약을 우선한다.

## 재개 중 드러난 입력

재개 과정에서 드러난 반복 실패는 memory의 좋은 후보가 될 수 있다. 재개 자체를 memory로 승격하는 것이 아니라, 재개가 드러낸 반복 패턴을 승격한다.

예를 들어 다음은 memory 후보가 될 수 있다.

- 같은 단계에서 artifact completeness 문제가 반복됨
- 재개할 때마다 같은 workspace 혼선이 다시 드러남
- 같은 종류의 상태 누락이 반복됨

## 잘못된 재사용의 Rollback

기존 memory가 오히려 품질을 떨어뜨리거나 잘못된 반복을 만든다면 되돌릴 수 있어야 한다.

- 잘못된 memory를 무조건 누적하지 않는다.
- 더 이상 맞지 않는 항목은 `removed`로 memory-update.json에 기록하고 shared.md에서 폐기하거나 deprecated 섹션으로 옮긴다.
- rollback의 근거도 함께 남긴다.

## Mission 간 Carry Forward

다음 mission으로 넘길 것은 두 종류다.

- 이번 mission을 넘어 반복해서 유효한 memory
- 아직 해결되지 않았지만 다음 mission 설계에 반영해야 할 주의점

Carry forward는 "남았던 일 목록" 전체를 복사하는 절차가 아니다. 반복해서 유효한 기준만 압축해 넘겨야 한다.

## Privacy

Memory는 다음을 불필요하게 장기 보존하지 않아야 한다.

- 비밀값
- 민감한 개인 정보
- 다음 mission 판단에 필요 없는 운영 세부정보

오래 남길 가치가 없는 정보는 memory가 아니라 일회성 task artifact로 남겨야 한다.
