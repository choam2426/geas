# 06. Memory and Rules

> GEAS의 rules, agent memory, rule update, retrieval, harmful reuse rollback, mission-to-mission carry forward를 정의한다. Task에서 올라오는 retrospective 입력은 doc 03이 owner다.

## 목적

Memory와 rules는 "다음 mission이 더 잘하게 만드는 기록"을 다룬다. 이 문서는 task 단위 작업 기록 자체가 아니라, 여러 작업에서 축적된 교훈을 어떻게 프로젝트 규칙과 agent별 기억으로 반영할지를 정의한다.

## Rules와 Memory의 구분

| 대상 | 역할 |
|---|---|
| `rules.md` | 팀 전체가 다시 따라야 하는 규칙, 관례, 금지, 기본 절차 |
| agent memory | 특정 역할이나 agent가 다음 mission에서 참고할 개인화된 교훈 |
| `rules-update.json` | rule 변경 제안 또는 승인 이력 |

Task evidence의 `memory_suggestions`, `debt_candidates`, `gap_signals`는 입력일 뿐이다. 이 문서가 그 입력을 어떻게 승격할지 다룬다.

## `rules.md`

`rules.md`는 장기적으로 재사용할 규칙을 모은다. 프로토콜은 exact 문서 형식을 강제하지 않지만, 적어도 다음 범주는 구분되어야 한다.

- project conventions
- learned rules
- role-specific rules

`rules.md`에는 일회성 상황 설명보다 반복 가능한 행동 기준이 들어가야 한다.

## Agent Memory

Agent memory는 특정 slot이나 concrete agent가 다음 mission에서도 참고할 수 있는 역할별 메모다.

좋은 agent memory는 다음 특징을 가진다.

- 한 번만 맞았던 우연이 아니라 반복 가능한 교훈이다.
- 역할에 맞는 판단 포인트를 짧게 요약한다.
- 새 mission의 contract나 evidence와 충돌하면 쉽게 버릴 수 있다.

## Rule Update

Rule update의 정규 JSON artifact는 `rules-update.json`이고, exact 구조는 `rules-update.schema.json`이 관리한다.

Rule update는 다음 질문에 답해야 한다.

- 어떤 규칙을 제안, 승인, 거절, 대체하는가
- 왜 이런 변경이 필요한가
- 어떤 evidence를 근거로 삼았는가
- 어디에 적용되는가

### rule 후보가 되는 기준

- 같은 실패나 혼선이 반복해서 나타난다.
- 규칙이 생기면 행동이 달라진다.
- 특정 mission에만 맞는 임시 요령이 아니다.
- evidence나 recovery incident 같은 실제 근거가 있다.

## Retrieval

Memory와 rules는 자동 주입의 편의를 위해 존재하는 것이 아니라, 더 나은 판단을 돕기 위해 존재한다.

- mission 시작 시 관련 rules와 memory를 먼저 읽는다.
- 새 task나 새 phase가 열릴 때 현재 contract와 직접 관련된 기억만 다시 끌어온다.
- 오래된 memory가 현재 계약과 충돌하면 현재 계약을 우선한다.

## Recovery에서 온 입력

Recovery 과정에서 드러난 반복 실패는 memory나 rule update의 좋은 후보가 될 수 있다. 다만 recovery 자체를 rule로 승격하는 것이 아니라, recovery가 드러낸 반복 패턴을 승격해야 한다.

예를 들어 다음은 memory나 rule update 입력이 될 수 있다.

- 같은 종류의 checkpoint 누락이 반복됨
- 항상 같은 단계에서 artifact completeness 문제가 발생함
- recovery 때마다 같은 workspace 혼선이 다시 드러남

## Harmful Reuse Rollback

기존 memory나 rule이 오히려 품질을 떨어뜨리거나 잘못된 반복을 만든다면 되돌릴 수 있어야 한다.

- 잘못된 memory를 무조건 누적하지 않는다.
- 더 이상 맞지 않는 규칙은 superseded나 rejected 상태로 정리한다.
- harmful reuse가 드러난 근거도 함께 남긴다.

## Mission-to-Mission Carry Forward

다음 mission으로 넘길 것은 두 종류다.

- 이번 mission을 넘어 반복해서 유효한 rule/memory
- 아직 해결되지 않았지만 다음 mission 설계에 반영해야 할 주의점

Carry forward는 "남았던 일 목록" 전체를 복사하는 절차가 아니다. 반복해서 유효한 기준만 압축해 넘겨야 한다.

## Privacy

Memory와 rules는 다음을 불필요하게 장기 보존하지 않아야 한다.

- 비밀값
- 민감한 개인 정보
- 다음 mission 판단에 필요 없는 운영 세부정보

오래 남길 가치가 없는 정보는 memory가 아니라 일회성 task artifact로 남겨야 한다.
