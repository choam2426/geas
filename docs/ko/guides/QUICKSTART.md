# 빠른 시작

## Geas란?

Geas는 Claude Code 기반의 계약 기반 멀티 에이전트 AI 개발 하네스입니다. AI 팀에 네 가지를 보장합니다: **Governance** (모든 결정은 정해진 프로세스를 따릅니다), **Traceability** (모든 행동은 추적 가능한 산출물을 남깁니다), **Verification** (결과물은 인수 기준으로 검증됩니다 -- "다 했어요"로 끝나지 않습니다), **Evolution** (팀은 세션을 거듭하며 지식을 쌓아갑니다). 미션만 알려주면 12명의 전문 에이전트가 설계, 구현, 리뷰, 검증까지 알아서 진행하고 전부 기록합니다.

## 사전 준비

- [Claude Code CLI](https://claude.ai/code)가 설치되어 있어야 합니다
- Git 저장소가 필요합니다 (새로 만든 것이든 기존 것이든)

## 설치

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

## 미션 시작

`/geas:mission`을 실행하고, 만들고 싶은 것, 추가할 기능, 결정할 사안을 설명하세요.

```
/geas:mission Build me a real-time polling app with shareable invite links
```

나머지는 Geas가 알아서 합니다. 질문을 던져 요구사항을 정리하고, 적절한 모드를 판단한 뒤, 파이프라인을 실행합니다.

### 모드 자동 감지

모드를 직접 고를 필요가 없습니다. Geas가 의도를 읽고 자동으로 분기합니다:

| 의도 | 감지되는 모드 | 진행 방식 |
|---|---|---|
| 새 제품을 밑바닥부터 만들기 | **Initiative** | 4단계: Discovery → MVP → Polish → Evolution |
| 기존 프로젝트에 기능 추가 | **Sprint** | 범위 한정 파이프라인: Design → Build → Review → QA → Evidence Gate |

코드 없이 기술적/제품 결정이 필요할 때는 언제든 `/geas:debate`를 사용하세요 — 모드가 아닌 유틸리티 스킬입니다.

### 예시

```
/geas:mission Build a CLI tool that converts Markdown to PDF
```
→ Initiative: 새 제품을 처음부터 만듭니다

```
/geas:mission Add dark mode toggle to the settings page
```
→ Sprint: 기능 하나를 추가합니다

```
/geas:mission Should we migrate from REST to GraphQL?
```
→ Debate: 구조적으로 의사결정을 내립니다

## 실행하면 어떻게 되나요?

에이전트들이 생성되어 자율적으로 일합니다. 태스크마다 아래 파이프라인을 거칩니다:

```
Design → Tech Guide → Implementation Contract → Implementation
  → Code Review → QA → Evidence Gate → Critic → Nova → Retro
```

매 단계마다 증거가 쌓입니다. Evidence Gate는 태스크를 닫기 전에 세 가지를 모두 통과해야 합니다: **Mechanical** (빌드, 린트, 테스트), **Semantic** (인수 기준 충족 여부), **Product** (미션에 부합하는가). 언제든 끼어들 수 있고, 입력은 최우선 이해관계자 피드백으로 다뤄집니다.

## .geas/ 디렉터리

실행이 끝나면 프로젝트에 `.geas/` 디렉터리가 생깁니다. 실행 전체의 추적 기록입니다:

```
.geas/
├── spec/         — 확정된 미션 명세 (seed.json)
├── tasks/        — 인수 기준이 포함된 TaskContracts
├── evidence/     — 태스크별 작업 증거
├── decisions/    — 투표 기록, 의사결정 기록
├── memory/       — 회고 교훈, 에이전트별 메모리
└── ledger/       — append-only 이벤트 로그
```

기본적으로 gitignore 처리됩니다. 저장소가 아니라 프로젝트에 속하는 디렉터리입니다.

## 다음 단계

- [Initiative 가이드](INITIATIVE.md) — 새 제품을 만들 때의 전체 흐름
- [Sprint 가이드](SPRINT.md) — 기능 추가 상세 가이드
- [아키텍처](../architecture/DESIGN.md) — contract engine의 동작 방식
- [에이전트](../reference/AGENTS.md) — 12인 에이전트 팀 소개
