# Sprint 모드 가이드

## 언제 사용하나요?

Sprint 모드는 기존 프로젝트에 기능 하나를 추가할 때 사용합니다. 코드베이스가 이미 있고, 추가할 게 명확할 때 -- 새 엔드포인트, UI 페이지, 백그라운드 잡, 서비스 연동 같은 것입니다.

Sprint는 Discovery 단계를 건너뜁니다. 새 프로젝트를 세팅하거나 아키텍처 패턴을 밑바닥부터 잡지 않습니다. 기존 코드베이스 자체가 제약 조건입니다.

## 사전 준비

- 어떤 언어, 어떤 프레임워크든 기존 코드베이스가 있어야 합니다
- 프로젝트 루트에 Git 저장소가 초기화되어 있어야 합니다
- 명확한 기능 설명이 필요합니다 (시스템 전체 리팩토링 말고, 추가 작업 하나)

---

## 동작 방식

### 첫 Sprint (Geas를 처음 쓸 때)

1. Geas가 `.geas/`가 없는 걸 감지하고 런타임 디렉터리를 만듭니다
2. Forge가 코드베이스를 파악합니다 -- 마커 파일을 스캔하고, 아키텍처를 매핑하고, `.geas/memory/_project/conventions.md`를 작성합니다
3. Intake가 기능에 대해 1-2개 질문합니다 (Initiative보다 가볍습니다):
   - 이 기능이 정확히 뭘 하나요?
   - 기존 코드 중 어디를 건드리나요?
   - 건드리면 안 되는 건 뭔가요?
4. `seed.json`이 아직 없으면 Intake가 최소한의 것을 만듭니다. 프로젝트 정체성(미션, 대상 사용자, 감지된 제약 조건)만 담고 `"source": "sprint"`으로 표시해서 전체 Initiative intake이 아닌 자동 생성임을 나타냅니다
5. 기능 범위(인수 기준, 범위 경계)는 seed.json이 아니라 TaskContract에 들어갑니다
6. 전체 파이프라인이 실행됩니다

### 이후 Sprint

1. Geas가 기존 `.geas/` 상태를 읽습니다. 재초기화는 없습니다
2. `seed.json`은 읽기 전용입니다. 어떤 상황에서도 수정하지 않습니다
3. Intake가 새 기능에 대해 같은 1-2개 질문을 합니다
4. 기능 범위가 TaskContract에 들어갑니다
5. 파이프라인이 바로 실행됩니다. 온보딩 지연이 없습니다

---

## seed.json 동작

| 상황 | 동작 |
|------|------|
| `seed.json`이 있을 때 (Initiative나 이전 Sprint에서 생성) | 프로젝트 컨텍스트(미션, 제약 조건)를 읽습니다. 수정하지 않습니다. |
| `seed.json`이 없을 때 (첫 Sprint) | 프로젝트 정체성만 담은 최소 seed를 만듭니다. `"source": "sprint"` 표시. |

기능별 범위 -- 인수 기준, scope in/out -- 는 항상 TaskContract에 들어갑니다. seed.json에는 들어가지 않습니다. 이렇게 해야 Sprint를 여러 번 돌려도 프로젝트 정체성이 흔들리지 않습니다.

---

## 파이프라인

Sprint는 Initiative의 MVP Build와 같은 단계를 태스크 하나에 적용합니다:

| 단계 | 에이전트 | 필수 여부 |
|------|---------|-----------|
| TaskContract 컴파일 | task-compiler | 항상 |
| Design | Palette | UI가 있을 때 |
| Tech Guide | Forge | 새 라이브러리, 새 스키마, 모듈간 변경이 있을 때 |
| Implementation Contract | Worker + Sentinel + Forge | 항상 |
| Implementation | Worker (worktree 격리) | 항상 |
| Code Review | Forge | 항상 |
| Testing | Sentinel | 항상 |
| Evidence Gate | -- | 항상 |
| Critic Pre-ship Review | Critic | 항상 |
| Nova Product Review | Nova | 항상 |
| Retrospective | Scrum | 항상 |
| Commit | Keeper | Ship일 때 |

Design과 Tech Guide에는 건너뛰기 조건이 있습니다. 나머지는 전부 필수입니다. Code Review와 Testing은 뺄 수 없습니다.

TaskContract에는 Evidence Gate에서 쓰는 `rubric` 배열이 포함됩니다. 기본 rubric 차원은 `core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`이고, 프론트엔드 태스크면 `ux_clarity`와 `visual_coherence`가 추가됩니다. 모든 점수가 임계값을 넘어야 게이트를 통과합니다.

---

## 온보딩

첫 Sprint 때 Forge가 코드베이스를 스캔한 뒤 작업에 들어갑니다.

**Forge가 파악하는 것:**

- 마커 파일에서 스택 확인 (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`)
- 프레임워크, 빌드 시스템, 테스트 프레임워크, 패키지 매니저
- 진입점, 라우팅 패턴, DB 연결, 핵심 모듈
- 네이밍 컨벤션, import 스타일, linter/formatter 설정

**프로젝트 크기에 따라 스캔 깊이가 달라집니다:**

| 크기 | 파일 수 | 전략 |
|------|---------|------|
| 소형 | ~50 | 전체 스캔. 소스 파일 전부 |
| 중형 | 50-500 | 집중 스캔. `src/`, 설정, 진입점, 핵심 모듈 |
| 대형 | 500+ | 타겟 스캔. Sprint 기능과 관련된 디렉터리만 |

**결과물:** `.geas/memory/_project/conventions.md` -- 스택, 빌드 명령, 주요 경로, 아키텍처 메모, 컨벤션을 정리한 문서입니다.

두 번째 Sprint부터는 온보딩을 건너뜁니다. `conventions.md`가 이미 있으면 Forge가 그걸 읽고 바로 파이프라인을 시작합니다.

---

## 실전 예시: 정산 및 분쟁 기능

기존 경매 플랫폼에 Sprint를 돌린 사례입니다:

- TaskContract `SP-01`이 rubric 6차원으로 컴파일됨 (core interaction, feature completeness, code quality, regression safety, UX clarity, visual coherence)
- Implementation Contract: 개별 작업 21개, 코딩 전에 edge case 10개 문서화 및 승인
- Evidence Gate에서 모든 rubric 점수 4 이상 -- Ship

---

## 팁

- **기능 범위를 좁게 잡으세요.** 추가 작업 하나가 적당합니다. 설명이 독립적인 서브시스템 여러 개를 넘나든다면 Sprint를 나누세요.
- **scope_out을 확실히 말하세요.** "기존 결제 흐름은 건드리면 안 됩니다"는 기능이 뭘 해야 하는지만큼 중요합니다.
- **기존 코드 제약은 알아서 감지됩니다.** `conventions.md`에서 이미 파악됐으니 스택을 다시 설명할 필요 없습니다.
- **Sprint 사이에 코드베이스가 크게 바뀌었다면** (대규모 리팩토링, 스택 마이그레이션 등) `conventions.md`를 지우고 다시 온보딩시키세요. 다음 Sprint가 처음부터 스캔합니다.
- **seed.json은 만들고 나면 불변입니다.** 프로젝트 미션이나 제약 조건이 근본적으로 바뀌면, seed를 직접 고치지 말고 `/geas:pivot-protocol`을 사용하세요.
