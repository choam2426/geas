# 빠른 시작

## Geas란 무엇인가?

Geas는 Claude Code를 위해 만들어진 계약 기반 멀티 에이전트 AI 개발 하네스입니다. 모든 AI 팀에 네 가지 보장을 제공합니다: **Governance** (모든 결정이 정의된 프로세스를 따름), **Traceability** (모든 행동이 추적 가능한 아티팩트를 생성), **Verification** (출력물이 완료 선언이 아닌 인수 기준을 통해 검증됨), **Evolution** (팀이 세션을 거치며 지식을 축적). 미션을 설명하면 Geas가 12명의 전문 에이전트로 구성된 거버넌스 파이프라인을 실행하여 설계, 구축, 검토, 검증을 수행하고 모든 것을 기록합니다.

## 사전 요건

- [Claude Code CLI](https://claude.ai/code) 설치 및 인증 완료
- Git 저장소 (신규 또는 기존)

## 설치

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

## 모드 선택

### Initiative — 새로운 것 구축

처음부터 제품을 시작할 때 사용합니다. Geas는 네 단계를 실행합니다: Genesis → MVP → Polish → Evolution.

1. Claude Code에서 빈 프로젝트 디렉터리를 엽니다
2. 미션을 설명합니다: `Build me a real-time polling app with shareable invite links`
3. Intake가 구체화 질문을 한 후 요구사항을 `seed.json`으로 고정합니다
4. 팀이 네 단계 전체를 자율적으로 실행합니다

### Sprint — 기능 추가

기존 프로젝트에 단일 기능을 추가할 때 사용합니다. 전체 파이프라인, 제한된 범위.

1. Claude Code에서 기존 프로젝트를 엽니다
2. 기능을 설명합니다: `Add CSV export to the reports page`
3. Geas가 첫 실행 시 코드베이스를 온보딩합니다 (구조 파악, 컨텍스트 구축)
4. Sprint 파이프라인 실행: Design → Build → Review → QA → Evidence Gate

### Debate — 의사 결정

코드 작성 없이 구조적인 의사 결정을 할 때 사용합니다.

1. 질문을 설명합니다: `Should we use a monorepo or separate repositories?`
2. 에이전트들이 증거를 바탕으로 토론하며, 악마의 대변인 역할도 포함됩니다
3. 결정이 `.geas/decisions/`에 `DecisionRecord`로 기록됩니다

## 실행 중에 일어나는 일

에이전트들이 생성되어 자율적으로 작업합니다. 각 태스크의 파이프라인은 다음과 같습니다:

```
Design → Tech Guide → Implementation Contract → Implementation
  → Code Review → QA → Evidence Gate → Critic → Nova → Retro
```

모든 단계에서 증거가 수집됩니다. Evidence Gate는 태스크가 종료되기 전에 세 가지 티어를 모두 통과하도록 요구합니다: **Mechanical** (빌드, 린트, 테스트), **Semantic** (인수 기준 충족), **Product** (미션에 기여). 언제든지 개입할 수 있으며, 여러분의 입력은 최고 우선순위 이해관계자 피드백으로 처리됩니다.

## .geas/ 디렉터리

실행 후 프로젝트에는 `.geas/` 디렉터리가 생성됩니다 — 실행의 완전한 추적 기록입니다:

```
.geas/
├── spec/         — 고정된 미션 명세 (seed.json)
├── tasks/        — 인수 기준이 담긴 TaskContracts
├── evidence/     — 태스크별 구조적 작업 증거
├── decisions/    — 투표 기록 및 결정 기록
├── memory/       — 회고 교훈 및 에이전트별 메모리
└── ledger/       — 추가 전용 이벤트 로그
```

이 디렉터리는 기본적으로 gitignore됩니다. 저장소가 아닌 프로젝트에 속합니다.

## 다음 단계

- [Initiative 가이드](INITIATIVE.md) — 새로운 제품을 위한 전체 안내
- [Sprint 가이드](SPRINT.md) — 기능 추가 상세 안내
- [아키텍처](../architecture/DESIGN.md) — contract engine 작동 방식
- [에이전트](../reference/AGENTS.md) — 12인 에이전트 팀 소개
