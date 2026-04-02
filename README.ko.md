<div align="center">

**[English](README.md)** | **한국어**

# Geas

### Governance. Traceability. Verification. Evolution.

멀티 에이전트 AI 개발에 구조를 잡아 줍니다 — 결정에는 프로세스가 있고, 과정에는 기록이 남고, 결과물은 계약으로 검증하고, 팀은 세션마다 성장합니다.

[![Claude Code](https://img.shields.io/badge/Built_for-Claude_Code-6B4FBB?style=for-the-badge)](https://claude.ai/code)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Agents](https://img.shields.io/badge/Agents-12-4A90D9?style=flat-square)](docs/ko/reference/AGENTS.md)
[![Skills](https://img.shields.io/badge/Skills-23-2ECC71?style=flat-square)](docs/ko/reference/SKILLS.md)
[![Hooks](https://img.shields.io/badge/Hooks-9-E67E22?style=flat-square)](docs/ko/reference/HOOKS.md)

</div>

---

## Geas란?

Geas는 Claude Code에서 동작하는 계약 기반 멀티 에이전트 개발 하네스입니다. 핵심은 네 가지입니다: 결정에는 프로세스가 있고(**Governance**), 행동에는 기록이 남고(**Traceability**), 결과물은 계약으로 검증하고(**Verification**), 팀은 세션마다 성장합니다(**Evolution**). 미션을 설명하면 전문 에이전트 팀이 설계부터 검증까지 수행하고, 전 과정을 기록합니다.

---

## 네 가지 원칙

| 원칙 | 정의 | 구체적 예시 |
|------|------|------------|
| **Governance** | 결정마다 정해진 프로세스와 명시적 권한이 있습니다. | 아키텍처를 고를 때 투표를 거칩니다. 의견이 갈리면 토론을 열고, 트레이드오프를 기록합니다. |
| **Traceability** | 행동마다 기록이 남고, 나중에 추적할 수 있습니다. | 상태가 바뀔 때마다 타임스탬프와 함께 `.geas/ledger/events.jsonl`에 기록하고, `run.json` 체크포인트로 파이프라인 위치를 추적합니다. |
| **Verification** | 결과물을 계약 기준으로 검증합니다. "완료" = "계약 충족"입니다. | Evidence Gate가 3단계로 검증합니다: 기계적(빌드/린트/테스트), 의미론적(수용 기준 + 루브릭 점수), 제품(Nova 판단). |
| **Evolution** | 팀이 세션을 거듭할수록 성장합니다. | 작업이 끝날 때마다 Scrum이 회고를 실행합니다. 교훈은 `.geas/tasks/{task-id}/retrospective.json`에, 규칙은 `rules.md`에 쌓입니다. |

---

## 빠른 시작

**준비물**: [Claude Code CLI](https://claude.ai/code) 설치 및 인증

### 1. 플러그인 설치

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

### 2. 미션 시작

```text
/geas:mission
```

만들고 싶은 것, 추가할 기능, 결정할 사안을 설명하면 됩니다. Compass가 알아서 모드를 골라서 — Initiative(새 제품), Sprint(기능 추가), Debate(의사결정) — 파이프라인을 돌립니다.

### 3. 과정 확인

```
[Compass]  작업 시작. Pixel에게 할당.
[Palette]  모바일 퍼스트 레이아웃. 세로 카드 스택.
[사람]     파이차트 대신 막대그래프로 해줘.          <- 사람의 개입
[Forge]    동의. CSS-only 막대그래프.
[Pixel]    구현 완료. 5개 컴포넌트.
[Sentinel] QA: 5/5 기준 통과.
[Critic]   리스크: 오프라인 폴백 없음, 리사이즈 시 차트 리플로우.
[Compass]  Evidence Gate PASSED.
[Nova]     Ship.
[Scrum]    회고: CSS 애니메이션 규칙을 rules.md에 추가.
```

---

## 동작 방식

```mermaid
graph LR
    A[사용자 의도] -->|질문으로 정제| B[Intake Gate]
    B -->|요구사항 고정| C[Task Compiler]
    C -->|TaskContract| D[에이전트 실행]
    D -->|증거| E[Evidence Gate]
    E -->|PASS| F[배포]
    E -->|FAIL| G[수정-재검증 루프]
    G --> D
```

전 과정의 기록이 `.geas/`에 남습니다:

```
.geas/
├── spec/seed.json           # 고정된 요구사항
├── tasks/*.json             # 수용 기준이 포함된 TaskContract
├── packets/                 # 에이전트별 브리핑
├── evidence/                # 작업별 증거
├── decisions/               # 투표 기록, 결정 기록
├── ledger/events.jsonl      # 추가 전용 이벤트 로그
├── memory/
│   ├── retro/               # 작업별 회고 교훈
│   └── agents/              # 에이전트별 메모리 (세션마다 축적)
└── rules.md                 # 공유 프로젝트 규칙 (시간이 갈수록 성장)
```

---

## 팀

Compass가 파이프라인을 조율하고, 12명의 전문 에이전트가 각자의 계약 아래에서 일합니다:

| 그룹 | 에이전트 | 역할 |
|------|---------|------|
| **리더십** | Nova | CEO / 제품 판단 |
| | Forge | CTO / 아키텍처 |
| **디자인** | Palette | UI/UX 디자이너 |
| **엔지니어링** | Pixel | 프론트엔드 |
| | Circuit | 백엔드 |
| | Keeper | Git / 릴리스 매니저 |
| **품질** | Sentinel | QA 엔지니어 |
| **운영** | Pipeline | DevOps |
| | Shield | 보안 |
| **전략** | Critic | 악마의 변호인 |
| **문서** | Scroll | 테크 라이터 |
| **프로세스** | Scrum | 애자일 마스터 / 회고 |

---

## 문서

### 시작하기
| 문서 | 설명 |
|------|------|
| [빠른 시작](docs/ko/guides/QUICKSTART.md) | 5분 시작 가이드 |
| [Initiative 가이드](docs/ko/guides/INITIATIVE.md) | 새 제품 만들기 |
| [Sprint 가이드](docs/ko/guides/SPRINT.md) | 기존 프로젝트에 기능 추가 |
| [Debate 가이드](docs/ko/guides/DEBATE.md) | 구조화된 의사결정 |
| [시나리오](docs/ko/guides/SCENARIOS.md) | 테스트 데이터가 포함된 실제 예시 |

### 아키텍처
| 문서 | 설명 |
|------|------|
| [설계](docs/ko/architecture/DESIGN.md) | 시스템 아키텍처, 데이터 흐름, 원칙 |
| [파이프라인](docs/ko/architecture/PIPELINE.md) | 실행 파이프라인 단계별 참조 |
| [스키마](docs/ko/architecture/SCHEMAS.md) | 데이터 계약과 관계 |

### 레퍼런스
| 문서 | 설명 |
|------|------|
| [Skills](docs/ko/reference/SKILLS.md) | 23개 skill 레퍼런스 |
| [Agents](docs/ko/reference/AGENTS.md) | 12명 에이전트 레퍼런스 |
| [Hooks](docs/ko/reference/HOOKS.md) | 9개 hook 레퍼런스 |
| [Governance](docs/ko/reference/GOVERNANCE.md) | 평가 기준과 품질 게이트 |

---

## 라이선스

[Apache License 2.0](LICENSE)

---

<div align="center">

**플러그인을 설치하세요. 미션을 시작하세요. 결과를 검증하세요. 팀이 성장하는 걸 지켜보세요.**

</div>
