# 빠른 시작

## Geas가 뭔가?

Geas는 Claude Code 위에서 돌아가는 계약 기반 멀티 에이전트 AI 개발 하네스다. AI 팀에 네 가지 원칙을 보장한다: **Governance** (모든 결정은 정해진 프로세스를 탄다), **Traceability** (모든 행동은 추적 가능한 산출물을 남긴다), **Verification** (결과물은 "다 했어요"가 아니라 인수 기준으로 검증된다), **Evolution** (팀은 세션마다 지식을 쌓아간다). 미션만 던지면, 12명의 전문 에이전트가 설계-구현-리뷰-검증 파이프라인을 알아서 돌리고 전부 기록한다.

## 사전 요건

- [Claude Code CLI](https://claude.ai/code) 설치 + 인증
- Git 저장소 (새로 만든 것이든 기존 것이든)

## 설치

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

## 모드 선택

### Initiative -- 처음부터 만들기

제품을 밑바닥부터 시작할 때 쓴다. Genesis → MVP → Polish → Evolution, 총 네 단계로 진행된다.

1. Claude Code에서 빈 프로젝트 디렉터리를 연다
2. 미션을 말한다: `Build me a real-time polling app with shareable invite links`
3. Intake가 몇 가지 질문을 던진 뒤 요구사항을 `seed.json`으로 확정한다
4. 이후 네 단계를 에이전트 팀이 자율적으로 진행한다

### Sprint -- 기능 하나 추가

기존 프로젝트에 기능 하나를 추가할 때 쓴다. 파이프라인은 전부 돌되, 범위는 한정된다.

1. Claude Code에서 기존 프로젝트를 연다
2. 기능을 설명한다: `Add CSV export to the reports page`
3. 첫 실행이면 Geas가 코드베이스를 파악한다 (구조 읽기, 컨텍스트 구성)
4. Sprint 파이프라인 실행: Design → Build → Review → QA → Evidence Gate

### Debate -- 결정만 내리기

코드는 안 짜고, 구조적으로 의사결정만 할 때 쓴다.

1. 질문을 던진다: `Should we use a monorepo or separate repositories?`
2. 에이전트들이 근거를 대며 토론한다. 악마의 변호인 역할도 포함이다
3. 결과는 `.geas/decisions/`에 `DecisionRecord`로 남는다

## 실행하면 무슨 일이 벌어지나

에이전트들이 생성되어 자율적으로 일한다. 태스크마다 아래 파이프라인을 탄다:

```
Design → Tech Guide → Implementation Contract → Implementation
  → Code Review → QA → Evidence Gate → Critic → Nova → Retro
```

매 단계마다 증거가 쌓인다. Evidence Gate는 태스크를 닫기 전에 세 가지를 전부 통과해야 한다: **Mechanical** (빌드, 린트, 테스트), **Semantic** (인수 기준 충족 여부), **Product** (미션에 부합하는가). 아무 때나 끼어들 수 있고, 그 입력은 최우선 이해관계자 피드백으로 다뤄진다.

## .geas/ 디렉터리

실행이 끝나면 프로젝트에 `.geas/` 디렉터리가 생긴다. 실행 전체의 추적 기록이다:

```
.geas/
├── spec/         — 확정된 미션 명세 (seed.json)
├── tasks/        — 인수 기준이 들어간 TaskContracts
├── evidence/     — 태스크별 작업 증거
├── decisions/    — 투표 기록, 의사결정 기록
├── memory/       — 회고 교훈, 에이전트별 메모리
└── ledger/       — append-only 이벤트 로그
```

기본적으로 gitignore 처리된다. 저장소가 아니라 프로젝트에 속하는 디렉터리다.

## 다음 단계

- [Initiative 가이드](INITIATIVE.md) — 새 제품을 만들 때의 전체 흐름
- [Sprint 가이드](SPRINT.md) — 기능 추가 상세 가이드
- [아키텍처](../architecture/DESIGN.md) — contract engine이 어떻게 돌아가는지
- [에이전트](../reference/AGENTS.md) — 12인 에이전트 팀 소개
