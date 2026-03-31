# Geas 아키텍처

## 1. 개요

Geas는 멀티 에이전트 AI 개발을 위한 계약 기반 거버넌스 하네스다. 여러 AI 에이전트를 구조화된 프로토콜로 조율하며, 핵심 원칙은 네 가지다:

- 모든 의사결정은 정해진 프로세스를 따른다.
- 모든 행동은 append-only 원장에 기록되어 추적할 수 있다.
- 모든 산출물은 정형 계약(contract)에 맞춰 검증된다.
- 팀은 회고와 규칙 갱신을 통해 세션을 거듭하며 성장한다.

멀티 에이전트의 가치는 에이전트 수가 아니다. "에이전트가 끝났다고 말하면 끝"이 아니라, 근거 기반 검증으로 대체한다는 데 있다. Contract Engine이 불변 핵심이고, 에이전트, 협업 표면, 도구는 전부 교체 가능하다.

설계 결정을 내릴 때는 항상 이렇게 물어야 한다: **"이 변경이 멀티 에이전트 프로세스를 더 통제 가능하고, 추적 가능하고, 검증 가능하고, 학습 가능하게 만드는가?"**

---

## 2. 네 가지 기둥

| 기둥 | 정의 | 예시 |
|--------|-----------|-----------------|
| **거버넌스** | 모든 결정은 명시적 권한이 있는 정해진 절차를 따른다. | Compass가 파이프라인을 조율한다. Nova가 ship/iterate/cut 권한을 갖는다. Critic은 모든 투표 라운드에 반드시 참여한다. 어떤 에이전트도 자기 작업을 스스로 승인할 수 없다. |
| **추적성** | 모든 행동은 기록되고 사후에 감사할 수 있다. | 모든 전환은 실제 UTC 타임스탬프와 함께 `.geas/ledger/events.jsonl`에 기록된다. `run.json`의 checkpoint가 현재 파이프라인 단계와 실행 중인 에이전트를 추적한다. DecisionRecord는 에스컬레이션의 *이유*를 남긴다. |
| **검증** | 모든 산출물은 계약 대비 검증된다 -- "완료"란 "계약 충족"이다. | Evidence Gate가 세 단계로 검증한다: 기계적(빌드/린트/테스트 exit 0), 의미적(인수 기준 충족, rubric 점수가 임곗값 이상), 제품(Nova 판단). Ship Gate는 네 개의 독립 근거 파일이 있어야 통과시킨다. |
| **진화** | 팀은 시간이 지날수록 더 나아진다. | Scrum 회고는 모든 태스크에서 필수다. 교훈은 `.geas/memory/retro/`에 쌓인다. rules.md는 태스크가 끝날 때마다 갱신되는 문서다. conventions.md는 실행 중 발견한 프로젝트 고유 패턴을 기록한다. |

---

## 3. 4계층 아키텍처

```
+---------------------------+
| Collaboration Surface     |  <-- 교체 가능 (Dashboard, CLI, ...)
+---------------------------+
| Agent Teams               |  <-- 교체 가능 (Geas-12, Lean-4, Custom)
+---------------------------+
| Contract Engine           |  <-- 핵심 (Intake, TaskContract, Evidence Gate)
+---------------------------+
| Tool Adapters             |  <-- 교체 가능 (Claude Code, ...)
+---------------------------+
```

### 계층 설명

| 계층 | 역할 | 교체 가능 여부 |
|-------|------|----------------|
| **Collaboration Surface** | 사람이 시스템과 상호작용하는 인터페이스. 대시보드, CLI, 채팅 스레드 등 어떤 형태든 된다. | 완전 교체 가능. 코어 스킬에 표면 레이어 가정을 하드코딩하면 안 된다. |
| **Agent Teams** | 작업을 수행하는 전문 에이전트 집합. 기본 Geas-12 팀은 Nova(PM), Forge(아키텍트), Palette(디자이너), Pixel(프론트엔드), Circuit(백엔드), Sentinel(QA), Keeper(Git/릴리스), Shield(보안), Scroll(문서), Critic(반대 의견), Scrum(애자일 마스터), Pipeline(DevOps)으로 구성된다. | 완전 교체 가능. Contract Engine은 어떤 에이전트 구성에서든 동작한다. 에이전트는 템플릿이지, 고정된 정체성이 아니다. |
| **Contract Engine** | 작업 흐름을 정의하는 핵심 스킬 모음: intake, task compilation, context packet, implementation contract, evidence gate, verify-fix loop, vote round. 이 계층은 도구에 의존하지 않는다. | **교체 불가** -- 이것이 불변 핵심이다. 다른 모든 계층이 여기에 맞춘다. |
| **Tool Adapters** | 에이전트가 작업할 때 쓰는 런타임 도구들(파일 I/O, bash, 웹 검색, MCP 서버, 브라우저 자동화 등). | 완전 교체 가능. 코어 스킬은 특정 제품이 아닌 기능 카테고리로 도구를 참조한다. |

### 플러그인 구조

```
plugin/
  plugin.json              # 매니페스트 (agents, skills, hooks, settings)
  skills/                  # 공유 스킬 (core + team + surface)
    intake/                # 소크라테스식 요구사항 수집
    task-compiler/         # seed -> TaskContract 변환
    context-packet/        # 역할별 브리핑
    evidence-gate/         # 3단계 검증
    implementation-contract/  # 구현 전 합의
    verify-fix-loop/       # 실패 -> 수정 -> 재검증 (재시도 예산 포함)
    vote-round/            # 구조화된 에이전트 투표 + 토론
    compass/               # 오케스트레이터 (메인 세션에서 실행)
    initiative/            # 4단계 신규 프로덕트 프로토콜
    sprint/                # 기존 프로젝트에 기능 추가 프로토콜
    debate/                # 코드 없이 의사결정만
    ...                    # 기타 유틸리티 스킬
  agents/                  # 12개 에이전트 정의 (.md + YAML frontmatter)
  hooks/
    hooks.json             # 훅 설정
    scripts/               # 훅 구현 스크립트
```

---

## 4. 데이터 흐름

### 태스크 전체 생명주기

태스크는 아래 산출물을 거치며, 각각 해당 `schemas/` 디렉토리의 JSON Schema를 따른다:

```
User Request
    |
    v
+-----------+     Socratic Q&A     +------------+
|  Intake   | ------------------->  |  seed.json |  (불변 프로젝트 정체성)
+-----------+                       +------------+
                                         |
                                         v
                                  +--------------+
                                  | Task Compiler | --- stories/feature desc
                                  +--------------+
                                         |
                                         v
                                  +--------------+
                                  | TaskContract  |  (.geas/tasks/{task-id}.json)
                                  +--------------+  goal, acceptance_criteria,
                                         |          eval_commands, rubric,
                                         |          retry_budget, worker, reviewer
                                         v
                                  +---------------+
                                  | ContextPacket |  (.geas/packets/{task-id}/{role}.md)
                                  +---------------+  역할별 브리핑
                                         |
                                         v
                                  +------------------------+
                                  | ImplementationContract |  (.geas/contracts/{task-id}.json)
                                  +------------------------+  planned_actions, edge_cases,
                                         |                    demo_steps, Sentinel + Forge 승인
                                         |
                                         v
                                  +----------------+
                                  | Implementation |  (worker가 격리된 worktree에서 실행)
                                  +----------------+
                                         |
                                         v
                                  +----------------+
                                  | EvidenceBundle |  (.geas/evidence/{task-id}/{agent}.json)
                                  +----------------+  에이전트별 근거 파일
                                         |
                                         v
                                  +--------------+     fail     +----------------+
                                  | Evidence Gate | ----------> | Verify-Fix Loop|
                                  +--------------+              +----------------+
                                    |    |                            |
                                    |    | (재시도 예산                |
                                    |    |  소진)                     | (gate 재실행)
                                    |    v                            |
                                    |  +----------------+             |
                                    |  | DecisionRecord | <-----------+
                                    |  +----------------+   (에스컬레이션 시)
                                    |  (.geas/decisions/)
                                    |
                                    | pass
                                    v
                              +-------------+
                              | GateVerdict |  pass / fail / iterate
                              +-------------+
                                    |
                                    v
                              +------------+
                              | Ship Gate  |  필수 근거 파일 4개:
                              +------------+  forge-review, sentinel,
                                    |         critic-review, nova-verdict
                                    v
                              +-----------+
                              |  Resolve  |  status -> "passed"
                              +-----------+  Keeper 커밋, Scrum 회고
```

### 산출물 요약

| 산출물 | 위치 | 스키마 | 생성 주체 |
|----------|----------|--------|------------|
| seed.json | `.geas/spec/seed.json` | `intake/schemas/seed.schema.json` | Intake |
| TaskContract | `.geas/tasks/{task-id}.json` | `task-compiler/schemas/task-contract.schema.json` | Task Compiler |
| ContextPacket | `.geas/packets/{task-id}/{role}.md` | `context-packet/schemas/context-packet.schema.json` | Context Packet Generator |
| ImplementationContract | `.geas/contracts/{task-id}.json` | `implementation-contract/schemas/implementation-contract.schema.json` | Worker (Sentinel + Forge 승인) |
| EvidenceBundle | `.geas/evidence/{task-id}/{agent}.json` | `evidence-gate/schemas/evidence-bundle.schema.json` | 각 에이전트가 작업 완료 후 작성 |
| GateVerdict | events.jsonl에 기록 | N/A (이벤트 형식) | Evidence Gate |
| DecisionRecord | `.geas/decisions/{dec-id}.json` | `evidence-gate/schemas/decision-record.schema.json` | Evidence Gate (에스컬레이션 시) |

---

## 5. `.geas/` 디렉토리 구조

`.geas/`는 프로젝트별 런타임 상태 루트다. gitignore 대상이며 프로젝트마다 생성된다.

```
.geas/
  state/
    run.json                 # 현재 실행 상태: mode, phase, status,
                             # current_task_id, completed_tasks, checkpoint
                             # (remaining_steps, agent_in_flight,
                             # pipeline_step, retry_count 포함)

  spec/
    seed.json                # intake에서 동결된 미션 스펙 (불변)
    prd.md                   # PRD (Initiative 전용)
    stories.md               # PRD에서 분해된 사용자 스토리 (Initiative 전용)

  tasks/
    task-001.json            # 각 태스크의 TaskContract
    task-002.json            # goal, acceptance_criteria, eval_commands,
    ...                      # rubric, worker, reviewer, status, retry_budget

  contracts/
    task-001.json            # 태스크별 ImplementationContract
    ...                      # planned_actions, edge_cases, demo_steps, status

  packets/
    task-001/
      palette.md             # 디자이너용 ContextPacket
      pixel.md               # 프론트엔드 작업자용 ContextPacket
      forge.md               # 아키텍트용 ContextPacket
      forge-review.md        # 코드 리뷰용 ContextPacket
      sentinel.md            # QA용 ContextPacket
      ...

  evidence/
    discovery/                 # Discovery 단계 근거 (Initiative 전용)
      nova.json              # 비전과 MVP 범위
      forge.json             # 아키텍처 결정
      vote-*.json            # 투표 라운드 결과
    task-001/
      palette.json           # 디자인 스펙 근거
      pixel.json             # 구현 근거
      forge-review.json      # 코드 리뷰 근거
      sentinel.json          # QA/테스트 근거
      critic-review.json     # Critic 출시 전 리뷰
      nova-verdict.json      # 제품 오너 판정
      keeper.json            # 커밋 근거
    polish/
      shield.json            # 보안 리뷰
      scroll.json            # 문서 리뷰
    evolution/
      nova-final.json        # 최종 제품 리뷰
      keeper-release.json    # 릴리스 관리

  decisions/
    dec-001.json             # DecisionRecord -- 결정의 이유를 기록
    ...                      # 에스컬레이션, 아키텍처 결정, 피벗 시 생성

  ledger/
    events.jsonl             # Append-only 이벤트 로그 (모든 전환, gate 결과,
                             # 단계 완료를 실제 UTC 타임스탬프로 기록)

  memory/
    _project/
      conventions.md         # 프로젝트 고유 규칙 (기술 스택, 명령어,
                             # 패턴 -- Forge가 온보딩 시 탐지)
    retro/
      task-001.json          # Scrum의 회고 교훈
      ...

  rules.md                   # 계속 갱신되는 규칙 문서 -- Scrum이 각 태스크
                             # 회고 후 갱신

  debt.json                  # 기술 부채 추적기 (DEBT-001, DEBT-002, ...)
                             # severity, source_task, status

  config.json                # 런타임 설정 (연결된 MCP 서버 등)
```

### 주요 파일

| 파일 | 용도 | 갱신 주체 |
|------|---------|------------|
| `state/run.json` | 세션 상태와 checkpoint. 컨텍스트 압축 후 복구 기준점. | Compass (에이전트 스폰 전후) |
| `spec/seed.json` | 동결된 미션 정체성. 생성 후 절대 수정하지 않는다. | Intake (1회) |
| `rules.md` | 계속 갱신되는 규칙. 회고할 때마다 늘어난다. | Scrum |
| `debt.json` | 기술 부채 백로그. 훅을 통해 임곗값 경고. | Compass (에이전트 근거 확인 후) |
| `ledger/events.jsonl` | 감사 추적. Append-only. | Compass (모든 전환 시) |

---

## 6. seed.json 설계

### 목적

seed는 프로젝트의 동결된 정체성이다 -- 무엇을, 누구를 위해, 어떤 제약 안에서 만드는지를 담는다. 이후 모든 산출물(TaskContract, ContextPacket, Nova 판정)이 미션 정렬을 위해 참조하는 단일 진실 공급원이다.

### 스키마

`plugin/skills/intake/schemas/seed.schema.json`에 정의되어 있다. 필수 필드:

| 필드 | 타입 | 설명 |
|-------|------|-------------|
| `version` | string (const "1.0") | 스키마 버전 |
| `mission` | string | 정제된 명확한 미션 선언문 |
| `acceptance_criteria` | array (최소 3개) | "완료"를 정의하는 측정 가능한 기준 |
| `scope_in` | array (최소 1개) | 명시적으로 포함하는 기능 |
| `scope_out` | array (최소 1개) | 명시적으로 제외하는 기능 (범위를 의식적으로 고려했다는 증거) |
| `completeness_checklist` | object | 각 섹션을 사용자가 승인했는지 확인하는 boolean 체크리스트 |
| `created_at` | date-time | 동결 시점의 UTC 타임스탬프 |

선택 필드: `target_user`, `constraints`, `assumptions`, `ambiguity_notes`, `source`, `readiness_override`.

### 불변성

사용자가 확정하면 seed는 실행 중 절대 수정하지 않는다. 범위 변경이 필요하면 pivot-protocol 스킬을 대신 호출한다.

### source 필드

`source` 필드는 seed가 어떻게 만들어졌는지 나타낸다:

| 값 | 뜻 |
|-------|---------|
| `"initiative"` | 전체 소크라테스식 intake 과정을 거쳤다. 모든 섹션을 사용자가 승인한 종합 seed다. |
| `"sprint"` | 최소한의 자동 생성 seed다. seed가 없을 때(프로젝트 첫 Sprint)만 생성된다. 코드베이스 온보딩에서 탐지한 프로젝트 정체성을 담는다. |

### Initiative vs Sprint 동작

**Initiative**는 여러 단계의 소크라테스식 intake을 거쳐 전체 seed를 만든다:
1. 범위 평가 (너무 크면 분해)
2. 요구사항 탐색 (한 번에 질문 하나, 객관식 선호)
3. 트레이드오프 포함 접근법 2-3가지 제안
4. 섹션별로 seed 작성 + 사용자 명시 승인
5. completeness checklist 검증 (모든 boolean이 true)
6. 동결

**Sprint**는 seed를 읽기 전용 컨텍스트로 취급한다:
- `seed.json`이 있으면 (이전 Initiative나 Sprint에서 생성): 미션/제약 사항을 읽는다. 절대 수정하지 않는다. 기능 범위는 TaskContract에 직접 들어간다.
- `seed.json`이 없으면 (Geas 첫 사용): `"source": "sprint"`로 최소 seed를 생성한다. 코드베이스 온보딩에서 탐지한 스택, 규칙, 프로젝트 정체성을 담는다.

이 구분 덕분에 seed는 *프로젝트 정체성*을, TaskContract는 *지금 만들 것*을 각각 담당한다.

---

## 7. 컨텍스트 소실 방어

### 문제

오래 실행되는 오케스트레이션 세션은 컨텍스트 윈도우 한계에 부딪힌다. LLM이 컨텍스트를 압축하면 파이프라인 상태가 망가진다:

- 오케스트레이터가 현재 단계를 잊는다
- 필수 단계(코드 리뷰, 테스트, Critic 리뷰)를 건너뛴다
- 완료된 태스크와 진행 중인 태스크를 혼동한다
- 에이전트 정의(YAML frontmatter + 역할 설명)는 짧고 자기 완결적이라 압축 후에도 거의 100% 보존된다
- SKILL.md 파이프라인 단계(긴 순차 절차)는 압축기가 요약하면서 단계 순서와 필수 마커가 사라져 크게 열화된다

### 해법

Geas는 두 가지 방어책을 쓴다:

#### 방어 1: run.json의 checkpoint 상태

Compass는 에이전트를 스폰하기 전마다 파이프라인 위치 전체를 `.geas/state/run.json`에 기록한다:

```json
{
  "mode": "initiative",
  "phase": "mvp",
  "status": "in_progress",
  "current_task_id": "task-003",
  "completed_tasks": ["task-001", "task-002"],
  "checkpoint": {
    "pipeline_step": "code_review",
    "agent_in_flight": "forge",
    "pending_evidence": ["forge-review.json"],
    "retry_count": 0,
    "parallel_batch": null,
    "remaining_steps": ["testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"],
    "last_updated": "2026-03-30T10:15:00Z"
  }
}
```

핵심은 `remaining_steps` 배열이다. 단계가 끝날 때마다 앞에서 하나씩 빠진다. 오케스트레이터가 컨텍스트를 잃어도 `remaining_steps`를 읽으면 다음에 뭘 해야 하는지 정확히 알 수 있다.

#### 방어 2: PostCompact 훅 (restore-context.sh)

`PostCompact` 훅은 컨텍스트 압축이 일어날 때마다 자동 실행된다. `run.json`을 읽고 현재 상태를 `additionalContext`로 대화에 주입한다:

- 모드, 단계, 상태
- 현재 태스크 ID와 목표
- 현재 태스크의 인수 기준
- 파이프라인 단계와 실행 중인 에이전트
- `remaining_steps` 배열 + 명시적 `NEXT STEP` 표시
- `rules.md`의 처음 30줄 (핵심 규칙)

공격적 압축 후에도 오케스트레이터는 정확히 어디서 재개해야 하는지 구조화된 상태 요약을 받게 된다.

#### 에이전트 정의는 살아남는데 파이프라인이 깨지는 이유

에이전트 정의는 작고 자기 완결적인 마크다운 파일이다(이름, 모델, 역할 설명). 압축해도 의미가 잘 보존된다.

SKILL.md 파이프라인 정의는 조건 분기, 필수 마커(`[MANDATORY]`), 스킵 조건, 상호 참조가 있는 긴 순차 절차다. 압축기가 요약하면서:
- 인접 단계를 합쳐 버린다
- 조건부 스킵 로직을 날린다
- `[MANDATORY]` 표기를 잃는다
- "11단계"를 "설계부터 완료까지 파이프라인이 돈다" 정도로 축약한다

checkpoint + restore-context 방식은 파이프라인 위치를 디스크에 외부화해서 이 문제를 완전히 우회한다. 디스크에 있으면 압축의 영향을 받지 않는다.

---

## 8. 도구 비의존 원칙

### 규칙

코어 스킬(`plugin/skills/`)은 특정 도구, 프레임워크, 패키지 매니저, 데이터베이스, 테스트 러너, 빌드 도구를 하드코딩하면 안 된다. 이래야 Contract Engine이 어떤 기술 스택에서든 쓸 수 있다.

### 금지 사항

- 패키지 매니저 이름(npm, pnpm, yarn, bun)을 기본값으로 가정
- 프레임워크 이름(Next.js, React, Express, Django)을 요구 사항으로 지정
- 데이터베이스 이름(PostgreSQL, MongoDB)을 전제로 깔기
- 테스트 도구 이름(Playwright, Jest, pytest)을 필수로 못 박기
- 빌드 도구 이름(webpack, vite)을 특정해서 처방

### 허용 패턴

| 패턴 | 예시 | 근거 |
|---------|---------|-----------|
| conventions.md 참조 | "conventions.md에 있는 빌드 명령어를 실행하라" | 프로젝트별 명령어는 스킬 정의가 아닌 conventions.md에 둔다 |
| 마커 파일 감지 | "package.json이 있으면..." / "go.mod가 있으면..." | 스택 식별용 감지 대상이지, 처방이 아니다 |
| 복수 대안 예시 | "예: Jest, pytest, 또는 vitest" | 여러 옵션을 보여주면 하나를 강제하지 않는다 |
| MCP 도구 카테고리 | "브라우저 자동화 MCP" | 에이전트 정의에서 MCP 카테고리는 참조해도 되지만, 특정 제품만 유일한 옵션으로 적으면 안 된다 |

### 실제 동작 방식

1. **Forge가 프로젝트를 온보딩한다** -- Discovery(Initiative) 또는 사전 조건(Sprint) 단계에서 `.geas/memory/_project/conventions.md`에 탐지한 규칙을 기록한다.
2. **TaskContract가 conventions.md를 참조한다** -- eval_commands에 테스트, 빌드, 린트 명령어가 들어간다.
3. **Worker가 ContextPacket을 읽는다** -- 관련 규칙이 포함되어 있다.
4. **Evidence Gate가 eval_commands를 실행한다** -- TaskContract에 있는 프로젝트별 명령어이지, 하드코딩된 도구 호출이 아니다.

결과적으로, Python/Django 프로젝트에서는 conventions.md에 적힌 `pytest`와 `ruff`를 쓰고, TypeScript/Next.js 프로젝트에서는 `vitest`와 `eslint`를 쓴다. 스킬 정의를 바꿀 필요가 없다.

### CLAUDE.md에 의한 강제

프로젝트의 CLAUDE.md에 이 규칙이 명시되어 있다. 코어 스킬에 하드코딩된 도구 참조를 추가하는 PR은 아키텍처 위반이므로 거부해야 한다.
