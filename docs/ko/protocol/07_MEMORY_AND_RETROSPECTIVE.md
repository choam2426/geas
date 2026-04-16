# 07. Memory and Retrospective

> **기준 문서.**
> 이 문서는 Geas에서 memory의 목적, 구조, retrospective loop, retrieval 규칙을 정의한다.

## 목적

Geas memory는 노트를 축적하는 것이 아니라 미래 행동을 바꾸기 위해 존재한다. Memory 시스템은 저장된 교훈이 미래의 task 실행, review 품질, recovery를 실질적으로 개선할 때만 적합한 것으로 인정된다.

| 목표 | 설명 |
|---|---|
| 재발 방지 | 동일한 실패의 반복을 차단한다 |
| 성공 재사용 | 검증된 성공 패턴을 새 작업에 적용한다 |
| recovery 가속 | 보존된 맥락을 활용하여 중단 후 안전하게 재개한다 |
| review 개선 | 이력 기반 통찰로 reviewer의 초점을 강화한다 |

## 핵심 원칙

1. **Memory는 행동을 바꿔야 한다.** 어떤 규칙, 맥락, 결정에도 영향을 미치지 않는 memory는 비기능적이다.
2. **저장 위치는 두 곳이다.** 프로젝트 지식은 `rules.md`, 에이전트별 노트는 `memory/agents/*.md`에 저장한다.
3. **양보다 선별적 주입.** 두 파일 모두 에이전트 맥락에 주입되므로, 간결하게 유지해야 한다.

## 저장 구조

| 저장소 | 위치 | 형식 | 주입 방식 |
|---|---|---|---|
| 프로젝트 지식 | `.geas/rules.md` | markdown | `inject-context.sh` → 모든 에이전트 |
| 에이전트 노트 | `.geas/memory/agents/{agent}.md` | markdown | `inject-context.sh` → 해당 에이전트 |

### rules.md

프로젝트 관례, 학습된 규칙, 역할별 지침을 통합한다:

소프트웨어 프로젝트 예시:

```markdown
## Project Conventions
- TypeScript strict, ES2022, NodeNext
- React 19 + Vite

## Learned Rules
- FTS5 MATCH requires try-catch for malformed queries
- Category moves must check full subtree depth

## Role-Specific Rules
### reviewer
- Always verify acceptance_criteria against the delivered evidence before approving
```

연구 프로젝트 예시:

```markdown
## Project Conventions
- APA 7th edition citation format
- All statistical claims require effect size + confidence interval

## Learned Rules
- Survey instruments must be pilot-tested before full deployment
- Mixed-methods designs require explicit integration point documentation

## Role-Specific Rules
### methodology-reviewer
- Check for Type I error inflation in multiple comparisons
```

콘텐츠 프로젝트 예시:

```markdown
## Project Conventions
- AP Stylebook for news content, Chicago Manual for long-form
- All claims require two independent sources

## Learned Rules
- Embedded quotes must be verified against primary source, not secondary citations
- Image alt text must convey informational content, not decorative description

## Role-Specific Rules
### fact-checker
- Flag statistical claims that lack original study citation
```

Evolving phase의 rules-update 워크플로우로 갱신한다. `inject-context.sh` hook을 통해 모든 에이전트 맥락에 주입된다.

위 저장소에 기록되는 업데이트는 모두 passed 상태에 도달한 task 이후 수행되는 회고 루프에서 발생한다.

## Per-Task Retrospective Loop

모든 `passed` task 이후, 프로젝트는 retrospective 또는 retrospective 기여를 생성해야 한다. Retrospective는 task 수행 중 발생한 일을 기록하여 이후 task가 그 경험을 활용하게 한다.

### Minimum retrospective topics

각 retrospective는 최소한 아래 영역을 다루어야 한다:

| topic | 기록 대상 |
|---|---|
| `what_went_well[]` | 좋은 결과를 낸 실천, 도구, 결정 |
| `what_broke[]` | failure, regression, 예상치 못한 문제 |
| `what_was_surprising[]` | 틀린 것으로 판명된 가정, 예상치 못한 복잡성 |
| `rule_candidates[]` | 반복 문제를 방지할 행동 변화 |
| `memory_candidates[]` | 미래 context를 위해 보존할 가치가 있는 교훈 |
| `debt_candidates[]` | 명시적 추적이 필요한 타협 |
| `next_time_guidance[]` | 다음 유사 task를 위한 구체적 조언 |

Retrospective는 구체적이어야 한다. "더 조심해야 함"은 너무 약하다. "Rate limit 없는 Auth endpoint가 challenge review에서 계속 실패함"이 유용하다.

### Memory Candidate 출처

Memory candidate는 다음에서 발생한다:

| 출처 | 저장 대상 |
|---|---|
| task 회고의 `memory_candidates` | `rules.md` (프로젝트 전체) 또는 agent memory (역할별) |
| challenger review의 `concerns` | `rules.md`에 학습 규칙으로 |
| worker self-check의 `known_risks` | 해당 worker 유형의 agent memory |
| specialist review 발견사항 | 해당 specialist 유형의 agent memory |

### Specialist의 memory 제안

모든 specialist는 재사용 가능한 지식을 발견하면 evidence의 공통 선택 필드 `memory_suggestions[]`에 담아야 한다. Orchestrator는 회고 과정에서 확인된 제안을 수확하고, 해당 agent memory 파일(`.geas/memory/agents/{agent_type}.md`) 또는 `rules.md` 반영 대상으로 정리한다.

Specialist는 다음을 관찰할 때 memory와 rule 후보를 생성해야 한다:

| 관찰 내용 | 우선순위 |
|---|---|
| 반복되는 차단 실패 | 최고 — 즉시 규칙 후보 |
| 반복되는 예방 가능 회귀 | 높음 — 패턴으로 포착할 가치 |
| 재사용 가치가 높은 성공 패턴 | 높음 — 표준화할 가치 |
| 리뷰어 체크리스트 빈틈 | 중간 — 향후 리뷰 품질 개선 |
| 도메인별 안티패턴 | 중간 — 재발 방지 |
| 낮은 가치의 조언성 관찰 | 낮음 — evidence가 강할 때만 포착 |

## Retrospective to Rule Update

Retrospective에서 반복 문제가 드러나면, 해당 패턴을 enforcement 가능한 rule로 변환하는 것을 검토해야 한다.

### Rule candidate가 정당화되는 경우

Rule candidate는 특히 다음 상황에서 정당화된다:

- 동일 failure가 반복될 때
- 동일 reviewer concern이 반복될 때
- 동일 recovery 실수가 반복될 때
- 동일 scope-control drift가 반복될 때
- 명확한 행동 변화가 문제를 방지했을 때

### Rule 승인 요건

Rule은 다음을 갖추어야 한다:

| 요건 | 목적 |
|---|---|
| 뒷받침하는 evidence | 문제가 실재하고 반복됨을 증명 |
| 명확한 행동 영향 | rule로 인해 무엇이 달라지는지 명시 |
| 소유자 | enforcement 책임 주체 |
| 범위 명시 | rule의 적용 대상과 시점 |
| enforcement 계획 | rule을 어떻게 표면화하고 검사할 것인지 |

### Behavior-change requirement

Rule은 그로 인해 무엇이 달라지는지 프로젝트가 설명할 수 있어야 완성된다. 예:

- 더 엄격한 contract checklist
- review checklist 항목 추가
- gate focus 변경
- scheduler caution
- packet-builder pinning

## Agent Memory Feedback Loop

에이전트별 마크다운 파일로, `memory/agents/{agent}.md`에 위치한다:

- **주입**: 에이전트 호출 시 해당 에이전트의 맥락에 포함
- **갱신**: 에이전트 자신이 종료 전에 갱신 (`geas memory agent-note` 사용)
- **범위**: 프로젝트 전체에 걸쳐 mission과 session을 넘어 지속

소프트웨어 도메인 예시:

```markdown
# Design Authority Memory

- Review must reference each acceptance_criterion explicitly (task-001 finding)
- FTS5 index scope: title+description only, not code (mission-AQeKIOxC)
```

연구 도메인 예시:

```markdown
# Methodology Reviewer Memory

- Always verify sample size justification against stated power analysis (task-003 finding)
- Longitudinal designs: check for attrition bias at each measurement wave (mission-R7kL9mQx)
```

콘텐츠 도메인 예시:

```markdown
# Editor Memory

- Headlines over 70 chars get truncated in social previews — flag during review (task-012 finding)
- Listicle formats must still have narrative thread, not just bullet accumulation (mission-C4nT8pRw)
```

Role 특화 교훈은 agent memory가 되어야 한다. Cross-role 교훈은 project memory 또는 rules가 되어야 한다.

### Role-specific lesson 기준

교훈이 주로 다음과 관련될 때 role-specific이다:

- 해당 slot이 주로 사용하는 tool 또는 technique
- 해당 slot이 주로 생산하는 artifact
- 해당 slot의 반복적 review blind spot
- 해당 slot의 반복적 도메인 특화 성공 패턴

## 수용 기준

Memory candidate는 다음 질문에 모두 답할 수 있을 때만 시스템에 진입한다:

1. 무엇이 일어났는가? (사실적 근거)
2. 어떤 evidence가 이를 뒷받침하는가? (근거 없는 주장 방지)
3. 미래 행동을 어떻게 바꿔야 하는가? (운영적 가치)

다음 중 하나에 해당하는 후보는 수용하지 않는다:

- 일반적인 조언
- artifact로 뒷받침되지 않는 주장
- 운영적 결과가 없는 일회성 선호

## Retrieval

1. `rules.md`는 모든 에이전트에게 항상 주입된다
2. `memory/agents/{agent}.md`는 해당 에이전트 유형에만 주입된다

이 두 파일이 전체 memory surface다.

## Harmful Reuse Rollback

팀이 이전 가이던스로 인한 반복적 유해 패턴을 발견했을 때:

1. 관련된 memory 또는 rule을 식별한다
2. 필요 시 해당 memory를 review 상태로 전환한다
3. 필요 시 rule을 업데이트한다
4. 부정적 패턴을 명시적으로 기록한다
5. 이후 packet이 잘못된 가이던스를 전파하지 않는지 검증한다

유해한 가이던스를 rollback 없이 계속 재사용하는 시스템은 진화하지 않는 것이다.

## Mission-to-Mission Carry Forward

Evolution output은 다음을 통해 다음 mission에 영향을 미쳐야 한다:

- task template
- rules
- rules.md 및 agent memory
- debt 우선순위
- reviewer focus

Mission 종료는 끝이 아니라 handoff다.

## Privacy

Memory에 원시 비밀, 자격 증명, 개인 데이터, 운영에 필요한 수준을 넘는 보안 민감 exploit 세부사항을 저장해서는 안 된다. 민감한 교훈은 추상화하여, 민감한 세부사항 없이 행동 지침만 유지해야 한다.

## 핵심 선언

Geas의 memory는 두 파일과 하나의 loop다: 팀이 배운 것을 담는 `rules.md`, 각 역할이 배운 것을 담는 agent memory, 그리고 task 경험을 지속적 지침으로 전환하는 retrospective loop. 나머지는 부수적이다.
