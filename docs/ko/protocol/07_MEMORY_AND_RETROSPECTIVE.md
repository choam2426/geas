# 07. Memory System

> **기준 문서.**
> 이 문서는 Geas에서 memory의 목적, 구조, retrieval을 정의한다.

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

## 구조

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

### Agent memory

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

## 출처

Memory candidate는 다음에서 발생한다:

| 출처 | 저장 대상 |
|---|---|
| task 회고의 `memory_candidates` | `rules.md` (프로젝트 전체) 또는 agent memory (역할별) |
| challenger review의 `concerns` | `rules.md`에 학습 규칙으로 |
| worker self-check의 `known_risks` | 해당 worker 유형의 agent memory |
| specialist review 발견사항 | 해당 specialist 유형의 agent memory |

## 수용 기준

Memory candidate는 다음 질문에 모두 답할 수 있을 때만 시스템에 진입한다:

1. 무엇이 일어났는가? (사실적 근거)
2. 어떤 evidence가 이를 뒷받침하는가? (근거 없는 주장 방지)
3. 미래 행동을 어떻게 바꿔야 하는가? (운영적 가치)

다음에 해당하는 candidate는 거부해야 한다: 일반적인 조언, artifact로 뒷받침되지 않는 것, 운영적 결과가 없는 일회성 선호.

## Retrieval

1. `rules.md`는 모든 에이전트에게 항상 주입된다
2. `memory/agents/{agent}.md`는 해당 에이전트 유형에만 주입된다

이 두 파일이 전체 memory surface다.

## Privacy

Memory에 원시 비밀, 자격 증명, 개인 데이터, 운영에 필요한 수준을 넘는 보안 민감 exploit 세부사항을 저장해서는 안 된다. 민감한 교훈은 추상화하여, 민감한 세부사항 없이 행동 지침만 유지해야 한다.

## 핵심 선언

Geas의 memory는 두 파일이다: 팀이 배운 것을 담는 `rules.md`, 각 역할이 배운 것을 담는 agent memory. 나머지는 부수적이다.
