# Sprint 모드 가이드

## 사용 시기

Sprint 모드는 기존 프로젝트에 제한된 기능을 추가할 때 사용합니다. 코드베이스가 이미 존재하고 새 엔드포인트, UI 페이지, 백그라운드 작업, 서비스 통합 등 하나의 명확한 추가 작업이 있을 때 사용하세요.

Sprint는 Genesis 단계를 건너뜁니다. 새 프로젝트를 스캐폴딩하거나 처음부터 아키텍처 패턴을 구축하지 않습니다. 기존 코드베이스가 제약 조건입니다.

## 사전 조건

- 모든 언어 또는 프레임워크의 기존 코드베이스
- 프로젝트 루트에서 초기화된 Git 저장소
- 명확한 기능 설명 (전체 시스템 리팩토링이 아닌 하나의 추가 작업)

---

## 작동 방식

### 첫 번째 Sprint (Geas 처음 사용)

1. Geas가 `.geas/` 상태가 없음을 감지 — 런타임 디렉터리를 초기화합니다
2. Forge가 코드베이스를 온보딩 — 마커 파일을 스캔하고 아키텍처를 매핑하며 `.geas/memory/_project/conventions.md`를 작성합니다
3. Intake가 기능에 대해 질문합니다 — 1-2개의 집중된 질문 (Initiative보다 가벼움):
   - 이 기능이 정확히 무엇을 하는가?
   - 어떤 기존 코드를 건드리는가?
   - 변경되면 안 되는 것은 무엇인가?
4. 아직 `seed.json`이 없습니다 — Intake가 프로젝트 정체성 (미션, 대상 사용자, 감지된 제약 조건)이 담긴 최소한의 것을 생성하고 `"source": "sprint"`로 표시하여 전체 Initiative intake가 아닌 자동 생성임을 나타냅니다
5. 기능 범위 (인수 기준, 범위 경계)는 seed.json이 아닌 TaskContract에 저장됩니다
6. 전체 파이프라인이 실행됩니다

### 이후 Sprint

1. Geas가 기존 `.geas/` 상태를 읽습니다 — 재초기화 없음
2. `seed.json`은 읽기 전용 — 어떤 상황에서도 수정되지 않습니다
3. Intake가 새 기능에 대해 질문합니다 (동일한 1-2개 질문)
4. 기능 범위가 TaskContract에 저장됩니다
5. 파이프라인이 직접 실행됩니다 — 온보딩 지연 없음

---

## seed.json 동작

| 상황 | 동작 |
|------|------|
| `seed.json` 존재 (Initiative 또는 이전 Sprint에서) | 프로젝트 컨텍스트 (미션, 제약 조건)를 위해 읽힘. 절대 수정되지 않음. |
| `seed.json` 없음 (첫 번째 Sprint) | 프로젝트 정체성으로 최소한의 seed 생성. `"source": "sprint"`로 표시. |

기능별 범위 — 인수 기준, 범위 포함/제외 — 는 항상 TaskContract에 저장되며 seed.json에는 저장되지 않습니다. 이를 통해 모든 Sprint에서 프로젝트 정체성이 안정적으로 유지됩니다.

---

## 파이프라인

Sprint는 Initiative MVP Build와 동일한 단계를 하나의 태스크에 적용하여 실행합니다:

| 단계 | 에이전트 | 필수 여부 |
|------|---------|-----------|
| TaskContract 컴파일 | task-compiler | 항상 |
| Design | Palette | 사용자 인터페이스가 있는 경우 |
| Tech Guide | Forge | 새 라이브러리, 새 스키마, 또는 모듈 간 변경이 있는 경우 |
| Implementation Contract | Worker + Sentinel + Forge | 항상 |
| Implementation | Worker (worktree 격리) | 항상 |
| Code Review | Forge | 항상 |
| Testing | Sentinel | 항상 |
| Evidence Gate | — | 항상 |
| Critic Pre-ship Review | Critic | 항상 |
| Nova Product Review | Nova | 항상 |
| Retrospective | Scrum | 항상 |
| Commit | Keeper | Ship 시 |

Design과 Tech Guide는 건너뛸 조건이 있습니다. 나머지는 모두 필수 — Code Review와 Testing은 제거할 수 없습니다.

TaskContract에는 Evidence Gate 평가 중 사용되는 `rubric` 배열이 포함됩니다. 기본 rubric 차원: `core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`. 프론트엔드 태스크는 `ux_clarity`와 `visual_coherence`를 추가합니다. 게이트가 통과하려면 모든 점수가 임계값을 충족해야 합니다.

---

## 온보딩

첫 번째 Sprint는 작업 시작 전에 Forge가 코드베이스를 스캔하도록 트리거합니다.

**Forge가 감지하는 것:**

- 마커 파일의 스택 (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`)
- 프레임워크, 빌드 시스템, 테스트 프레임워크, 패키지 매니저
- 진입점, 라우팅 패턴, 데이터베이스 연결, 핵심 모듈
- 명명 규칙, import 스타일, linter 및 formatter 설정

**스캔 깊이는 프로젝트 크기에 따라 조정됩니다:**

| 크기 | 파일 수 | 전략 |
|------|---------|------|
| 소형 | ~50 | 전체 스캔 — 모든 소스 파일 |
| 중형 | 50–500 | 집중 — `src/`, 설정, 진입점, 핵심 모듈 |
| 대형 | 500+ | 타겟 — Sprint 기능과 관련된 디렉터리만 |

**출력:** `.geas/memory/_project/conventions.md` — 스택, 빌드 명령, 주요 경로, 아키텍처 메모, 규칙의 구조적 요약.

이후 Sprint는 온보딩을 완전히 건너뜁니다. `conventions.md`가 이미 존재하면 Forge가 읽고 파이프라인이 즉시 시작됩니다.

---

## 실제 예시: 정산 및 분쟁 기능

기존 경매 플랫폼에 대한 Sprint:

- TaskContract `SP-01`이 6개 rubric 차원으로 컴파일됨 (core interaction, feature completeness, code quality, regression safety, UX clarity, visual coherence)
- Implementation Contract: 21개 개별 행동, 코딩 시작 전 10개 엣지 케이스 문서화 및 승인
- Evidence Gate에서 모든 rubric 점수 4 이상 — Ship

---

## 팁

- **기능을 제한적으로 유지하세요.** 하나의 명확한 추가 작업. 설명이 여러 독립적인 서브시스템을 다루면 별도의 Sprint로 나누세요.
- **기능을 설명할 때 `scope_out`을 명시적으로 언급하세요.** "기존 결제 흐름을 건드리면 안 됩니다"는 기능이 무엇을 해야 하는지만큼 중요합니다.
- **기존 코드 제약 조건은 `conventions.md`에서 자동으로 감지됩니다** — 스택을 다시 설명할 필요가 없습니다. Forge가 이미 알고 있습니다.
- **Sprint 간에 코드베이스가 크게 변경되면** (대규모 리팩토링, 스택 마이그레이션), `conventions.md`를 삭제하고 Geas에 재온보딩을 요청하세요. 다음 Sprint가 처음부터 다시 스캔합니다.
- **seed.json은 생성 후 불변입니다.** 프로젝트 미션이나 제약 조건이 근본적으로 변경되면 seed를 직접 편집하는 대신 `/geas:pivot-protocol`을 사용하세요.
