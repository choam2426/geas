**[English](GUIDE.md)** | **한국어**

# Geas 사용 가이드

계약 기반 멀티 에이전트 AI 개발을 위한 Geas 하니스 단계별 가이드입니다.

Geas는 AI 기반 개발에 구조를 부여합니다: 모든 결정은 프로세스를 따르고, 모든 행동은 추적 가능하며, 모든 출력은 계약에 대해 검증되고, 팀은 시간이 지남에 따라 더 똑똑해집니다. 이 가이드는 설치, 첫 번째 미션, 그리고 그 과정에서 접하게 될 핵심 개념을 안내합니다.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [설치](#2-설치)
3. [첫 번째 미션 (Full-team)](#3-첫-번째-미션-full-team)
4. [기능 추가 (Sprint)](#4-기능-추가-sprint)
5. [의사결정 (Debate)](#5-의사결정-debate)
6. [.geas/ 이해하기](#6-geas-이해하기)
7. [Linear 연동 (선택사항)](#7-linear-연동-선택사항)
8. [MCP 서버 권장사항](#8-mcp-서버-권장사항)
9. [세션 재개](#9-세션-재개)
10. [Hook -- 기계적 강제](#10-hook----기계적-강제)
11. [FAQ / 문제 해결](#11-faq--문제-해결)

---

## 1. 사전 요구사항

시작하기 전에 다음을 준비하세요:

**필수:**

- [Claude Code CLI](https://claude.ai/code) 설치 및 인증 완료. Geas가 동작하는 런타임입니다.

**선택:**

- [Linear](https://linear.app) API 키 -- 에이전트 작업 중 협업 가시성, 이슈 추적, 사람의 개입을 위해 사용합니다. Linear 없이도 Geas는 동작하지만, 있으면 더 풍부한 경험을 제공합니다.
- Python 3.10+ -- Linear 통합(Linear CLI 래퍼가 Python으로 작성됨)과 파이프라인 무결성을 강제하는 hook 시스템에 필요합니다.

---

## 2. 설치

### 플러그인 마켓플레이스에서 설치

Claude Code 내에서 다음 두 명령을 실행하세요:

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

또는 `/plugin`을 입력하여 대화형 UI를 열 수 있습니다. **Marketplaces**에서 `choam2426/geas`를 추가한 다음, **Discover** 탭에서 설치하세요.

### 설치 확인

설치 후 Geas 스킬이 사용 가능한지 확인할 수 있습니다. 다음과 같이 자연어로 요청해 보세요:

```text
작업 관리 앱을 만들어줘.
```

Geas가 올바르게 설치되었다면 Compass(오케스트레이터)가 작동하여 intake 프로세스를 시작합니다. Claude가 바로 코드를 작성하는 대신 프로젝트 요구사항에 대한 소크라테스식 질문이 표시됩니다.

플러그인의 에이전트 등록 여부는 Claude Code 플러그인 목록에서도 확인할 수 있습니다.

---

## 3. 첫 번째 미션 (Full-team)

Full-team 모드는 새로운 제품을 처음부터 만들기 위한 것입니다. Genesis, MVP Build, Polish, Evolution의 네 단계를 거칩니다.

### 입력 방법

만들고 싶은 것을 자연어로 설명하세요:

```text
공유 가능한 초대 링크가 있는 실시간 투표 앱을 만들어줘.
```

이것만으로 충분합니다. Compass는 이것이 새로운 제품임을 감지하고 자동으로 Full-team 모드를 활성화합니다. 단계별로 다음과 같이 진행됩니다.

### 단계별 설명

#### 설정: 프로젝트 초기화

첫 실행 시 Compass가 자동으로 setup 스킬을 호출합니다. 프로젝트 루트에 다음 구조의 `.geas/` 런타임 디렉토리를 생성합니다:

```
.geas/
  spec/          -- 동결된 요구사항
  state/         -- 실행 상태 (run.json)
  tasks/         -- 컴파일된 TaskContract
  packets/       -- 에이전트 브리핑
  evidence/      -- 에이전트 출력물 및 검증 결과
  decisions/     -- 결정 기록
  ledger/        -- 추가 전용 이벤트 로그
  memory/        -- 프로젝트 컨벤션, 회고, 에이전트별 메모리
    _project/    -- 프로젝트 전체 컨벤션
    retro/       -- 작업별 회고 교훈
    agents/      -- 에이전트별 메모리 (세션 간 축적)
```

설정은 `.geas/rules.md`도 생성합니다. 모든 에이전트가 작업 전에 읽는 공유 규칙 문서로, 증거 작성 규칙, Linear 설정, 코드 경계 제약 조건을 포함합니다. 프로젝트가 진행되면서 발전하는 살아있는 문서입니다.

Linear 통합을 원하면 설정 과정에서 API 키 연결과 팀 선택을 안내합니다. 거절하면 팀은 `.geas/`만을 상태 저장소로 사용합니다.

#### Intake Gate: 미션 정의

에이전트가 코드를 쓰기 전에 Intake Gate가 실행됩니다. 숨겨진 가정을 표면화하고 동결된 사양을 생성하는 것이 목적입니다.

Compass가 최대 2라운드에 걸쳐 소크라테스식 질문을 합니다:

- 범위는 무엇인가? 명시적으로 범위 밖인 것은?
- 대상 사용자는 누구인가?
- 어떤 제약 조건이 있는가 (기술 스택, 호스팅, 예산)?
- 어떻게 완료를 알 수 있는가? 첫날 무엇이 동작해야 하는가?

각 답변은 다섯 가지 차원(명확성, 범위, 사용자, 제약 조건, 수용 기준)에 걸쳐 0-20 척도로 채점됩니다. Full-team 모드는 진행하기 위해 최소 100점 만점에 60점의 준비 점수가 필요합니다.

요약을 확인하면 사양이 `.geas/spec/seed.json`에 기록되고 동결됩니다. 이 seed가 전체 실행의 진실의 원천이 됩니다.

질문을 건너뛰고 싶다면 "그냥 만들어줘"라고 말할 수 있습니다 -- 하지만 seed에 미해결 모호성이 기록됩니다.

#### 모드 감지

seed가 동결된 후 Compass가 실행 모드를 결정합니다:

| 의도 | 감지된 모드 |
|------|------------|
| 새 제품 또는 광범위한 미션 | Full-team |
| 기존 프로젝트에 기능 추가 | Sprint |
| 코드 없는 의사결정 논의 | Debate |

`/geas:full-team`, `/geas:sprint`, `/geas:debate`로 직접 모드를 지정할 수도 있습니다.

#### 단계 1: Genesis

Genesis는 비전, 아키텍처, 작업 계획을 수립합니다.

**1. Nova의 비전.** Nova(CEO/Product 에이전트)가 seed를 읽고 제품 비전을 전달합니다: MVP 범위, 사용자 가치 제안, 전략적 방향. 출력은 `.geas/evidence/genesis/nova.json`에 기록됩니다.

**2. Forge의 아키텍처.** Forge(CTO/Architecture 에이전트)가 seed와 Nova의 비전을 읽고 기술 스택과 아키텍처를 제안합니다. 컨벤션은 `.geas/memory/_project/conventions.md`에 기록되고 DecisionRecord가 생성됩니다.

**3. 투표 라운드.** Compass가 영향받는 에이전트(일반적으로 Circuit, Palette, Critic)에게 아키텍처 제안에 대한 투표를 요청합니다. Critic은 필수 악마의 대변인으로서 제안의 숨겨진 위험과 트레이드오프를 스트레스 테스트합니다. 모두 동의하면 Genesis가 진행됩니다. 반대가 있으면 구조화된 토론이 실행됩니다 -- 주장을 주고받으며, 3라운드 미해결 시 Nova가 타이브레이커입니다.

**4. 작업 컴파일.** seed와 아키텍처가 5-10개의 세분화된 TaskContract으로 컴파일됩니다. 각각 다음을 포함합니다:
- 구체적이고 검증 가능한 목표
- 수용 기준 (작업당 최소 3개)
- 경로 경계 (작업자가 접근 가능한/불가능한 파일)
- 평가 명령 (build, lint, test)
- 재시도 예산 및 에스컬레이션 정책

Linear가 연결되어 있으면 각 작업이 이슈가 됩니다.

**5. MCP 서버 권장사항.** 선택된 기술 스택을 기반으로 Compass가 팀에 도움이 될 MCP 서버를 추천합니다([섹션 8](#8-mcp-서버-권장사항) 참조). 지금 연결하거나 건너뛸 수 있습니다.

**6. Genesis 종료.** 실행 상태가 업데이트되고 프로젝트가 MVP Build로 이동합니다.

#### 단계 2: MVP Build

모든 작업이 전체 파이프라인을 거칩니다. 어떤 단계도 건너뛰지 않고, 작업을 배치 처리하지 않습니다.

의존성 순서에 따라 각 TaskContract에 대해:

1. **디자인 (Palette)** -- 작업에 사용자 대면 인터페이스가 있으면 Palette가 레이아웃, 상호작용, 컴포넌트 계층 구조를 포함한 디자인 사양을 작성합니다. 백엔드 전용 작업에서는 건너뜁니다.

2. **기술 가이드 (Forge)** -- Forge가 기술 접근 문서를 작성합니다: 어떤 패턴을 사용할지, 무엇을 주의할지, 이 작업이 아키텍처와 어떻게 연결되는지. 사소한 작업(설정 변경, 버전 범프)에서는 건너뜁니다.

3. **구현 (Pixel/Circuit)** -- 배정된 작업자가 worktree 격리 환경에서 기능을 구현합니다. ContextPacket(seed, 디자인 사양, 기술 가이드, 이전 증거로 구성된 집중 브리핑)을 읽고 무엇을 구축했는지 문서화하는 EvidenceBundle을 생성합니다.

4. **코드 리뷰 (Forge)** -- Forge가 수용 기준과 아키텍처 컨벤션에 대해 구현을 리뷰합니다. 모든 작업에 필수입니다.

5. **테스트 (Sentinel)** -- Sentinel이 수용 기준과 평가 명령에 대해 QA를 실행합니다. 모든 작업에 필수입니다.

6. **Evidence Gate** -- 3단계 검증 게이트:
   - **Tier 1 -- 기계적**: 코드가 빌드되는가? lint를 통과하는가? 테스트가 통과하는가?
   - **Tier 2 -- 의미적**: 모든 수용 기준이 충족되었는가? 증거가 각 기준을 뒷받침하는가?
   - **Tier 3 -- 제품**: Nova가 미션 정렬과 품질에 대해 기능을 검토합니다.

   게이트가 실패하면 verify-fix loop가 시작됩니다: 담당 에이전트(프론트엔드 이슈는 Pixel, 백엔드 이슈는 Circuit)가 수정 전용 ContextPacket을 받고 다시 시도합니다. 작업의 재시도 예산(기본값 3)까지 반복됩니다. 예산이 소진되면 에스컬레이션됩니다 -- Forge가 설계를 검토하거나 Nova가 전략적 결정(계속, 제거, 피벗)을 내립니다.

7. **Critic 출시 전 리뷰 (Critic)** -- Nova가 판정을 내리기 전에 Critic이 축적된 증거를 검토하고 의심스러운 것에 이의를 제기합니다: 검증되지 않은 가정, 누락된 엣지 케이스, 너무 쉽게 통과한 수용 기준. Critic의 피드백은 `.geas/evidence/{task-id}/critic.json`에 기록됩니다.

8. **Nova 제품 리뷰** -- Nova가 모든 증거(Critic의 이의 제기 포함)를 읽고 판정을 내립니다: Ship, Iterate, 또는 Cut.

9. **Ship Gate** -- 작업을 passed로 표시하기 전에 Compass가 `forge-review.json`, `sentinel.json`, `critic.json`, `nova-verdict.json`이 모두 존재하는지 확인합니다. 누락된 것이 있으면 해당 단계를 먼저 실행합니다.

10. **Keeper 커밋** -- Ship Gate를 통과하면 Keeper가 작업 ID와 수용 기준을 참조하는 구조화된 커밋 메시지로 작업의 변경사항을 커밋합니다.

11. **Scrum 회고** -- Ship Gate 후 Scrum이 완료된 작업에 대한 회고를 실행합니다: 잘된 점, 잘못된 점, 추출해야 할 컨벤션. 교훈은 `.geas/memory/retro/`에 기록되고 관련 컨벤션은 `.geas/rules.md`에 병합됩니다.

각 작업 후 `.geas/rules.md`가 실행 중 발견된 새로운 컨벤션으로 업데이트됩니다.

#### 단계 3: Polish

모든 MVP 작업이 완료된 후:

- **Shield**(보안 에이전트)가 전체 프로젝트의 보안 리뷰를 실행합니다.
- **Scroll**(문서 에이전트)이 README와 문서를 작성합니다.

발견된 문제는 단계를 닫기 전에 수정됩니다.

#### 단계 4: Evolution

원래 범위 내에서의 최종 개선 패스:

- `scope_in`의 남은 항목이 처리됩니다.
- `scope_out`의 항목은 거부됩니다.
- Keeper가 릴리스 커밋 또는 태그를 생성하여 프로젝트의 산출물을 통합합니다.
- Nova가 다음 단계에 대한 권장 사항과 함께 최종 전략 브리핑을 전달합니다.

실행 상태가 `"complete"`로 설정됩니다.

### .geas/에 나타나는 것

전체 실행 후 모든 단계에서 아티팩트를 찾을 수 있습니다:

```
.geas/
  spec/seed.json                          -- 동결된 요구사항
  state/run.json                          -- 최종 실행 상태 (status: complete)
  tasks/task-001.json ... task-N.json     -- 모든 TaskContract
  evidence/genesis/nova.json              -- Nova의 비전
  evidence/genesis/forge.json             -- Forge의 아키텍처
  evidence/genesis/vote-circuit.json      -- 투표 결과
  evidence/genesis/vote-critic.json       -- Critic의 악마의 대변인 투표
  evidence/task-001/palette.json          -- 디자인 사양
  evidence/task-001/pixel.json            -- 구현 증거
  evidence/task-001/forge-review.json     -- 코드 리뷰
  evidence/task-001/sentinel.json         -- QA 결과
  evidence/task-001/critic.json           -- Critic의 출시 전 리뷰
  evidence/task-001/nova-verdict.json     -- 제품 리뷰
  evidence/polish/shield.json             -- 보안 리뷰
  evidence/polish/scroll.json             -- 문서 리뷰
  evidence/evolution/nova-final.json      -- 최종 브리핑
  packets/task-001/palette.md             -- 디자인 컨텍스트 패킷
  packets/task-001/pixel.md               -- 구현 컨텍스트 패킷
  decisions/dec-001.json                  -- 아키텍처 결정 기록
  ledger/events.jsonl                     -- 모든 상태 전환
  memory/_project/conventions.md          -- 프로젝트 컨벤션
  memory/retro/task-001.json             -- 작업별 회고 교훈
  memory/agents/pixel.md                 -- 에이전트별 메모리 (세션 간 축적)
  memory/agents/circuit.md               -- 에이전트별 메모리
  rules.md                                -- 공유 에이전트 규칙
  config.json                             -- 런타임 설정
```

---

## 4. 기능 추가 (Sprint)

### Sprint을 사용할 때

기존 프로젝트에 범위가 정해진 기능을 추가할 때 Sprint을 사용합니다. 코드베이스가 이미 존재하고 아키텍처가 확립되어 있으며, 한 가지 구체적인 것을 만들어야 할 때입니다.

Sprint은 Genesis 단계를 완전히 건너뜁니다. 비전, 아키텍처 제안, 투표 라운드가 없습니다. 대신 디자인, 빌드, 리뷰, QA로 바로 진행합니다.

### 입력 방법

추가할 기능을 설명하세요:

```text
설정 페이지에 다크 모드 토글을 추가해줘.
```

이전 실행에서 `.geas/` 디렉토리가 이미 있는 프로젝트라면 Compass가 기존 프로젝트를 감지하고 자동으로 Sprint 모드를 선택합니다. 첫 실행이라면 Compass가 먼저 설정과 intake를 실행합니다(가벼운 소크라테스식 질문 -- 1라운드, 기능이 무엇을 하는지, 무엇에 영향을 미치는지, 무엇을 변경하면 안 되는지에 집중).

### Sprint과 Full-team의 차이

| 측면 | Full-team | Sprint |
|------|-----------|--------|
| Genesis 단계 | 있음 (비전, 아키텍처, 투표) | 없음 |
| Intake 깊이 | 깊음 (최대 소크라테스식 2라운드, 임계값 60) | 가벼움 (1라운드, 임계값 40) |
| 작업 수 | 5-10개 작업 | 보통 1개 작업 |
| 컨벤션 | Forge가 처음부터 스캔하고 작성 | 기존 `.geas/memory/_project/conventions.md` 사용 |

`conventions.md`가 아직 없으면(프로젝트에서 첫 Sprint) Forge가 코드베이스를 스캔하고 파이프라인 시작 전에 컨벤션을 작성합니다.

### Sprint 파이프라인

1. **TaskContract 컴파일** -- 기능이 수용 기준, 경로 경계, 평가 명령을 포함한 단일 TaskContract으로 컴파일됩니다.

2. **디자인 (Palette)** -- 기능에 사용자 대면 인터페이스가 있는 경우. 백엔드 전용 작업에서는 건너뜁니다.

3. **기술 가이드 (Forge)** -- 기술 접근 지침. 사소한 변경에서는 건너뜁니다.

4. **구현** -- 배정된 작업자(Pixel 또는 Circuit)가 worktree 격리 환경에서 기능을 구축합니다.

5. **코드 리뷰 (Forge)** -- 필수. Forge가 구현을 리뷰합니다.

6. **테스트 (Sentinel)** -- 필수. Sentinel이 QA를 실행합니다.

7. **Evidence Gate** -- Full-team과 동일한 3단계 게이트 (기계적, 의미적, 제품).

8. **Nova 제품 리뷰** -- Ship, Iterate, 또는 Cut 판정.

9. **Ship Gate** -- 작업을 passed로 표시하기 전에 세 개의 필수 증거 파일이 모두 존재해야 합니다.

---

## 5. 의사결정 (Debate)

### Debate을 사용할 때

코드를 쓰기 전에 기술 또는 제품 결정을 내려야 할 때 Debate을 사용합니다. Debate 모드에서는 구현이 발생하지 않습니다. 출력은 기능이 아닌 DecisionRecord입니다.

예시:
- "이 프로젝트에 PostgreSQL과 MongoDB 중 어떤 것을 써야 할까?"
- "REST API인가 GraphQL인가?"
- "모노레포인가 별도 레포인가?"

### 입력 방법

```text
프론트엔드 프레임워크로 Next.js와 Remix 중 결정해야 합니다.
```

또는 직접 호출할 수 있습니다:

```text
/geas:debate 대시보드에 SSR과 클라이언트 사이드 렌더링 중 어떤 것을 써야 할까?
```

### Debate 진행 방식

1. **질문 프레이밍.** Compass가 질문을 2-3개 옵션이 있는 명확한 결정으로 공식화하고 사용자와 확인합니다.

2. **토론자 생성.** 여러 에이전트가 각 옵션에 대해 찬반을 논합니다:
   - Forge가 한 옵션의 기술적 장점을 주장
   - Critic이 가정에 도전하고 대안을 주장
   - Circuit이 백엔드/확장성 관점에서 평가
   - Palette가 UX/프론트엔드 관점에서 평가

3. **종합.** Compass가 요약을 제시합니다: 주장, 트레이드오프, 각 에이전트의 권장 사항.

4. **결정.** 사용자가 최종 결정을 내립니다. 질문, 옵션, 주장, 추론을 담은 DecisionRecord가 `.geas/decisions/{dec-id}.json`에 기록됩니다.

Debate은 코드를 생성하지 않습니다. DecisionRecord는 향후 Full-team 또는 Sprint 실행의 입력이 됩니다.

---

## 6. .geas/ 이해하기

`.geas/` 디렉토리는 Geas 관리 프로젝트의 런타임 상태 저장소입니다. 기본적으로 gitignore됩니다(setup이 `.gitignore`에 추가). 각 부분이 포함하는 내용은 다음과 같습니다.

### 디렉토리 구조

```
.geas/
  spec/
    seed.json                -- 동결된 요구사항 사양
  tasks/
    task-001.json            -- TaskContract: 목표, 기준, 경계, 상태
    task-002.json
  evidence/
    genesis/
      nova.json              -- Nova의 비전 문서
      forge.json             -- Forge의 아키텍처 제안
      vote-circuit.json      -- Circuit의 아키텍처 투표
      vote-critic.json       -- Critic의 투표 (악마의 대변인)
    task-001/
      palette.json           -- 디자인 사양
      pixel.json             -- 구현 증거
      forge-review.json      -- 코드 리뷰 결과
      sentinel.json          -- QA 테스트 결과
      critic.json            -- Critic의 출시 전 리뷰
      nova-verdict.json      -- 제품 리뷰 판정
    polish/
      shield.json            -- 보안 리뷰
      scroll.json            -- 문서 리뷰
  packets/
    task-001/
      palette.md             -- 디자인 컨텍스트 브리핑
      pixel.md               -- 구현 컨텍스트 브리핑
      forge-review.md        -- 리뷰 컨텍스트 브리핑
      sentinel.md            -- QA 컨텍스트 브리핑
  state/
    run.json                 -- 현재 실행 상태
  ledger/
    events.jsonl             -- 추가 전용 이벤트 로그
  decisions/
    dec-001.json             -- 아키텍처 결정 기록
  memory/
    _project/
      conventions.md         -- 프로젝트별 컨벤션
      linear-config.json     -- Linear 워크스페이스 ID (연결된 경우)
    retro/
      task-001.json          -- 각 작업의 회고 교훈
    agents/
      pixel.md               -- 에이전트별 메모리 (세션 간 축적)
      circuit.md             -- 에이전트별 메모리
  rules.md                   -- 공유 에이전트 규칙 (살아있는 문서)
  config.json                -- 런타임 설정 (Linear 활성화 여부, 팀 정보)
```

### 주요 파일 설명

**`spec/seed.json`** -- Intake Gate에서 생성되는 동결된 미션 사양입니다. 정제된 미션 선언, 대상 사용자, 범위(포함 및 제외), 수용 기준, 제약 조건, 준비 점수를 포함합니다. 확인 후에는 수정하면 안 됩니다. 범위 변경이 필요하면 대신 피벗 프로토콜이 트리거됩니다.

**`tasks/*.json`** -- TaskContract입니다. 각각은 기계가 읽을 수 있는 작업 합의서입니다: 구체적 목표, 검증 가능한 수용 기준, 파일 경로 경계, 평가 명령, 재시도 예산, 에스컬레이션 정책, 현재 상태(`pending`, `in_progress`, `passed`, `failed`, `escalated`).

**`evidence/{task-id}/*.json`** -- 에이전트가 작성한 EvidenceBundle입니다. 작업에 참여한 모든 에이전트가 무엇을 했는지, 어떤 파일을 변경했는지, 무엇을 발견했는지를 문서화하는 JSON 파일을 여기에 씁니다. 이것이 에이전트 작업의 추적 가능한 기록입니다. Evidence Gate는 작업 통과 여부를 결정하기 위해 이 파일들을 읽습니다.

**`packets/{task-id}/*.md`** -- ContextPacket입니다. 각 에이전트를 디스패치하기 전에 Compass가 생성하는 집중적이고 역할별 브리핑입니다. 에이전트가 전체 Linear 스레드를 읽거나 전체 코드베이스를 스캔하게 하는 대신, 해당 에이전트에게 필요한 컨텍스트만 패킷에 담습니다.

**`state/run.json`** -- 현재 실행 상태입니다. 미션 이름, 현재 모드(full-team/sprint/debate), 현재 단계(genesis/mvp/polish/evolve), 현재 작업 ID, 완료된 작업 목록, 전체 상태를 포함합니다. 세션 재개를 가능하게 하는 파일입니다.

**`ledger/events.jsonl`** -- 모든 상태 전환의 추가 전용 로그입니다: 작업 시작, 게이트 통과, 단계 완료, 에스컬레이션 트리거. 각 항목에는 실제 타임스탬프가 있습니다. 감사 추적입니다.

**`decisions/*.json`** -- DecisionRecord입니다. 투표 라운드, 토론, 에스컬레이션, 피벗 중에 생성됩니다. 각각은 맥락, 검토된 옵션, 내린 결정, 추론, 수용된 트레이드오프를 담고 있습니다.

**`rules.md`** -- 모든 에이전트가 작업 시작 전에 읽는 공유 규칙 문서입니다. 증거 작성 규칙, Linear 설정, 코드 경계 규칙, 실행 중 발견된 프로젝트별 컨벤션을 포함합니다. 이 파일은 살아있는 문서로, 프로젝트가 진행되면서 발전합니다.

**`memory/_project/conventions.md`** -- Forge가 코드베이스를 스캔한 후 작성하는 프로젝트별 컨벤션입니다. 디렉토리 구조, 네이밍 패턴, 테스트 패턴, 아키텍처 결정을 포함합니다.

**`memory/retro/*.json`** -- 각 작업 완료 후 Scrum이 작성하는 회고 기록입니다. 잘된 점, 잘못된 점, 추출할 컨벤션을 담고 있습니다. 회고에서 얻은 교훈은 `rules.md`에 피드백됩니다.

**`memory/agents/*.md`** -- 세션 간에 유지되는 에이전트별 메모리 파일입니다. 각 에이전트가 프로젝트에 대한 지식을 축적합니다: 학습한 패턴, 저지른 실수, 개발한 선호도. `inject-context` hook이 서브 에이전트 시작 시 관련 에이전트의 메모리를 주입합니다.

---

## 7. Linear 연동 (선택사항)

Linear는 Geas의 현재 협업 표면입니다. 에이전트 활동을 관찰하고, 추론을 읽고, 에이전트가 볼 수 있는 코멘트로 개입할 수 있는 공간을 제공합니다.

### 설정 방법

설정 단계에서 Compass가 물어봅니다:

> "이슈 추적을 위해 Linear를 연결하시겠습니까?"

예라고 하면:

1. **API 키.** Linear API 키가 필요합니다. [linear.app/settings/api](https://linear.app/settings/api)에서 발급받으세요. 키는 `lin_api_`로 시작합니다.

2. **저장.** 키는 프로젝트 루트의 `.env` 파일에 저장됩니다(또는 상위 디렉토리의 `.env`가 이미 있으면 거기서 감지됩니다).

3. **팀 선택.** Linear 팀이 여러 개인 경우 하나를 선택해야 합니다.

4. **워크스페이스 설정.** Geas가 레이블(feature, bug, design-spec, architecture 등)을 생성하고 Linear 워크스페이스의 워크플로 상태(Backlog, Todo, In Progress, In Review, Testing, Done, Canceled, Waiting)를 확인합니다.

5. **설정.** Linear 설정이 `.geas/config.json`에 저장됩니다.

### Linear가 제공하는 것

- **이슈 추적.** 각 TaskContract이 Linear 이슈가 됩니다. 상태 전환(In Progress, In Review, Testing, Done)은 Compass가 관리합니다.

- **에이전트 코멘트.** 에이전트가 배정된 이슈에 표준 형식으로 코멘트를 게시합니다: `[AgentName] 요약 내용`. 대화를 실시간으로 추적할 수 있습니다.

- **사람의 개입.** Linear 이슈에 작성한 코멘트가 에이전트 ContextPacket에 포함됩니다. "원형 차트 대신 막대 차트를 사용하세요"라고 쓰면 해당 작업을 맡는 다음 에이전트가 피드백을 보게 됩니다.

Linear 스레드 예시:

```
[Compass]  Task started. Assigned to Pixel.
[Palette]  Mobile-first layout. Vertical card stack.
[You]      Use bar charts instead of pie charts.
[Forge]    Agreed. CSS-only bar chart approach.
[Pixel]    Implementation complete. 5 components.
[Sentinel] QA: 5/5 criteria passed.
[Compass]  Evidence Gate PASSED.
[Nova]     Ship.
```

### Linear 없이 사용

Linear를 건너뛰어도 모든 것이 동작합니다. 차이점은:

- 추적할 실시간 코멘트 스트림이 없습니다. 진행 상황은 `.geas/`를 검사합니다.
- 코멘트를 통한 사람의 개입이 없습니다. Claude Code 세션에서 직접 상호작용합니다.
- 에이전트 증거는 동일하게 `.geas/evidence/`에 기록됩니다.

---

## 8. MCP 서버 권장사항

### MCP 서버란

MCP(Model Context Protocol) 서버는 실행 중 에이전트에게 외부 도구와 데이터 소스에 대한 접근을 제공합니다. Geas는 두 개의 내장 MCP 서버를 포함하며, 프로젝트의 기술 스택에 따라 추가 서버를 추천합니다.

### 내장 MCP 서버

Geas 플러그인이 설치되면 항상 사용 가능합니다:

| 서버 | 용도 |
|------|------|
| **Context7** | 라이브러리의 최신 문서와 코드 예제. 에이전트가 학습 데이터에 의존하지 않고 현재 API 문서를 참조할 수 있습니다. |
| **Playwright** | 브라우저 자동화. Sentinel이 UI 동작을 테스트하고 시각적 출력을 검증할 수 있습니다. |

### 상황별 추천

Genesis에서 Forge가 기술 스택을 제안한 후 Compass가 이를 분석하고 추가 MCP 서버를 추천합니다:

| 스택에서 감지됨 | 추천 서버 | 이유 |
|----------------|-----------|------|
| PostgreSQL | PostgreSQL MCP | Circuit이 데이터베이스 스키마를 직접 쿼리 가능 |
| MongoDB | MongoDB MCP | Circuit이 컬렉션을 탐색 가능 |
| 웹 프론트엔드 | MDN MCP | Pixel이 웹 표준을 참조 가능 |
| 배포 대상 있음 | Lighthouse MCP | Sentinel이 성능 및 접근성 감사 가능 |
| GitHub 호스팅 | GitHub MCP | Keeper가 PR과 이슈를 관리 가능 |

Compass는 다음과 같이 추천을 제시합니다:

```
기술 스택에 맞는 MCP 서버 추천:
- [PostgreSQL MCP] -- Circuit이 DB 스키마를 직접 쿼리 가능
  설치: claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>

연결하시겠습니까? (선택사항, 없이도 진행 가능)
```

연결하거나 건너뛸 수 있습니다. 연결된 서버는 `.geas/config.json`에 기록됩니다.

### MCP 서버 설치

각 추천에는 설치 명령이 포함됩니다. 예:

```bash
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://localhost:5432/mydb
claude mcp add --transport http mdn https://mcp.mdn.mozilla.net/
claude mcp add --transport http github https://mcp.github.com/anthropic
```

---

## 9. 세션 재개

Geas는 세션 중단에서 살아남도록 설계되었습니다. Claude Code가 종료되더라도(타임아웃, 크래시, 사용자가 터미널 닫기) 중단된 곳에서 이어갈 수 있습니다.

### 동작 방식

세션이 시작되면 `session-init` hook이 `.geas/state/run.json`을 확인합니다. 파일이 존재하고 상태가 `"in_progress"`이면 Compass가 현재 단계, 현재 작업, 완료된 작업 목록을 읽습니다. 그런 다음 작업이 중단된 정확한 지점에서 재개합니다.

실행 상태 파일이 추적하는 내용:

```json
{
  "version": "1.0",
  "status": "in_progress",
  "mission": "Real-time polling app",
  "mode": "full-team",
  "phase": "mvp",
  "current_task_id": "task-003",
  "completed_tasks": ["task-001", "task-002"],
  "decisions": ["dec-001"],
  "created_at": "2026-03-26T10:00:00Z"
}
```

### 재개 시 보이는 것

활성 Geas 실행이 있는 프로젝트에서 새 Claude Code 세션을 시작하면 상태 요약이 표시됩니다:

```
[Geas] Resuming session
  Mission: Real-time polling app
  Mode: full-team
  Phase: mvp
  Status: in_progress
  Completed: 2 of 7 tasks
```

미션 설명을 반복하거나 intake를 다시 실행할 필요가 없습니다. "계속"이라고 말하거나 다음에 할 일을 설명하면 Compass가 중단된 곳에서 이어갑니다.

### 엣지 케이스

- **`status: "complete"`로 세션 종료**: Compass가 이를 새로운 시작으로 취급합니다. 새 미션을 시작하거나 Sprint을 실행하여 기능을 추가할 수 있습니다.
- **`run.json`이 없음**: 첫 실행입니다. 설정이 자동으로 호출됩니다.
- **부분 완료된 작업**: 작업의 증거 디렉토리가 확인됩니다. 일부 증거가 있지만 파이프라인이 불완전하면 Compass가 마지막으로 완료된 단계에서 재개합니다.

---

## 10. Hook -- 기계적 강제

Hook은 Claude Code가 특정 라이프사이클 이벤트에서 자동으로 실행하는 셸 스크립트입니다. Geas 규칙의 기계적 강제를 제공합니다 -- 에이전트가 무시할 수 있는 프롬프트 지시에 의존하는 대신, hook은 도구 수준에서 작업을 가로채고 실제 종료 코드로 제약 조건을 강제합니다.

### Hook이 하는 일

| Hook | 실행 시점 | 동작 |
|------|-----------|------|
| **session-init** | 세션 시작 (`SessionStart`) | `run.json`에서 컨텍스트 복원, `rules.md`가 없으면 생성, 상태 요약 출력 |
| **inject-context** | 서브 에이전트 시작 (`SubagentStart`) | `rules.md`와 에이전트별 메모리(`memory/agents/{agent}.md`)를 서브 에이전트의 컨텍스트에 주입 |
| **verify-evidence** | 서브 에이전트 완료 후 (`SubagentStop`) | 에이전트가 배정된 작업에 대한 증거 파일을 작성했는지 확인 |
| **protect-geas-state** | `.geas/`에 대한 Write/Edit 후 (`PostToolUse`) | 필수 증거 없이 작업이 "passed"로 표시되거나 intake 후 `seed.json`이 수정되면 경고 |
| **verify-pipeline** | 세션 종료 전 (`Stop`) | 모든 완료된 작업에 대한 필수 증거를 확인. **세션 종료를 차단할 수 있는 유일한 hook.** |

### 볼 수 있는 것

- **세션 시작 시 상태 요약**: 정상입니다. session-init hook이 현재 프로젝트 상태를 출력하고 있습니다.
- **에이전트가 프로젝트 규칙과 메모리를 받음**: 정상입니다. inject-context hook이 작업 시작 전에 서브 에이전트에 `rules.md`와 에이전트별 메모리 파일을 제공하고 있습니다.
- **누락된 증거에 대한 경고**: 서브 에이전트가 증거 파일을 쓰지 않고 완료되었습니다. Compass가 일반적으로 재시도합니다.
- **"Pipeline incomplete"로 세션 종료 차단**: verify-pipeline hook이 필수 `forge-review.json` 또는 `sentinel.json` 증거 파일 없이 완료된 작업을 발견했습니다. 세션이 종료되기 전에 누락된 검증 단계를 완료해야 합니다.
- **seed.json 수정 경고**: 동결된 사양을 변경하려는 시도가 있었습니다. 보통 실수입니다.

hook의 전체 기술 레퍼런스(종료 코드, 타임아웃 동작, 문제 해결 포함)는 [HOOKS.md](HOOKS.md)를 참조하세요.

---

## 11. FAQ / 문제 해결

### "Compass agent not found"

Compass는 에이전트가 아니라 스킬입니다. 메인 Claude Code 세션에서 직접 실행됩니다. 별도의 Compass 에이전트를 생성할 필요가 없습니다. 이 오류가 보이면 Geas 플러그인이 올바르게 설치되었는지 확인하세요.

### Windows에서 hook 오류

Hook은 JSON 파싱에 Python이 필요한 bash 스크립트입니다. Windows에서:

- Python 3.10+ 이상이 설치되어 있고 `python`이 PATH에 있는지 확인하세요.
- Hook은 bash에서 실행됩니다 (Git Bash 또는 WSL이 제공).
- `python3`만 사용 가능한 경우 alias하거나 symlink하세요:
  ```bash
  alias python=python3
  ```

### "rules.md not found"

이 파일은 `session-init` hook에 의해 세션 시작 시 자동 생성되어야 합니다. 누락된 경우:

1. Geas 플러그인이 설치되어 있고 hook이 로딩되고 있는지 확인하세요 (`hooks.json`이 등록되어야 합니다).
2. Python이 사용 가능한지 확인하세요 (hook이 JSON 파싱에 사용합니다).
3. 우회 방법으로, setup 스킬도 `rules.md`를 생성합니다. 필요하면 수동으로 설정을 실행하세요.

### 파이프라인 단계 건너뜀

코드 리뷰(Forge)나 테스트(Sentinel)가 작업에 대해 실행되지 않은 것을 발견하면:

1. hook 오류 출력을 확인하세요 -- 실패한 hook이 파이프라인을 중단했을 수 있습니다.
2. 플러그인 버전이 최신인지 확인하세요.
3. `.geas/ledger/events.jsonl`에서 오류 이벤트를 확인하세요.
4. `verify-pipeline` hook이 세션 종료 시 이를 잡아내고 누락된 단계가 완료될 때까지 차단합니다.

### Evidence Gate가 계속 실패함

작업이 Evidence Gate에 반복적으로 실패하는 경우:

1. 어떤 계층이 실패하는지 확인하세요 (기계적, 의미적, 제품).
2. **기계적 실패**: 코드가 빌드되지 않거나, lint를 통과하지 않거나, 테스트가 실패합니다. TaskContract(`tasks/{task-id}.json`)의 평가 명령을 확인하세요.
3. **의미적 실패**: 수용 기준이 충족되지 않았습니다. 기준이 너무 엄격하거나 구현에서 요구사항이 누락되었을 수 있습니다.
4. verify-fix loop에는 재시도 예산(기본값 3)이 있습니다. 소진 후에는 Forge의 아키텍처 리뷰 또는 Nova의 전략적 결정으로 에스컬레이션됩니다.

### "Pipeline incomplete"로 세션 종료 차단

이것은 `verify-pipeline` hook이 설계된 대로 동작하는 것입니다. 필수 증거 파일(`forge-review.json` 또는 `sentinel.json`) 없이 완료된 작업을 발견했습니다.

해결 방법:
1. 오류 메시지를 읽고 영향받은 작업을 확인합니다.
2. 해당 작업에 대해 누락된 코드 리뷰(Forge) 또는 QA 테스트(Sentinel) 단계를 실행합니다.
3. `.geas/evidence/{task-id}/`에 증거 파일이 나타나는지 확인합니다.
4. 세션 종료를 다시 시도합니다.

### 초기화하고 처음부터 시작하기

`.geas/` 디렉토리를 삭제하고 새 세션을 시작하세요:

```bash
rm -rf .geas/
```

이렇게 하면 모든 런타임 상태, 증거, 결정, 이벤트 원장이 제거됩니다. 소스 코드는 영향받지 않습니다. 다음에 미션을 설명하면 Geas가 처음부터 설정을 실행합니다.

### Linear API 키 문제

- **"LINEAR_API_KEY not set"**: 키가 포함된 `.env` 파일을 찾지 못했습니다. 설정을 다시 실행하거나 `.env`에 `LINEAR_API_KEY=lin_api_...`를 수동으로 생성하세요.
- **인증 오류**: 키가 만료되었거나 유효하지 않을 수 있습니다. [linear.app/settings/api](https://linear.app/settings/api)에서 새 키를 발급받으세요.
- **상위 디렉토리의 키**: Linear CLI는 `dotenv`를 사용하여 디렉토리 트리를 따라 올라갑니다. 상위 디렉토리의 `.env`가 자동으로 발견됩니다.

### 에이전트가 출력을 생성하지 않음

서브 에이전트가 완료되었지만 증거 파일을 작성하지 않은 경우:

1. `verify-evidence` hook이 경고를 출력합니다.
2. Compass가 일반적으로 에이전트를 한 번 재시도합니다.
3. 에이전트가 오류를 만났는지 확인하세요 (도구 권한 거부, 파일 경로 문제 등).
4. `.geas/rules.md`가 존재하는지 확인하세요 -- 에이전트가 먼저 읽고, 누락되면 조용히 실패할 수 있습니다.
