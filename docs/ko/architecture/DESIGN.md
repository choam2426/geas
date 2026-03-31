# Geas 아키텍처

## 1. 개요

Geas는 멀티 에이전트 AI 개발을 위한 계약 기반 거버넌스 프레임워크입니다. 모든 결정이 정해진 프로세스를 따르고, 모든 행동이 추가 전용 원장(append-only ledger)을 통해 추적되며, 모든 산출물이 공식 계약에 근거하여 검증되고, 팀이 회고와 살아있는 규칙들을 통해 세션을 넘어 발전해 나가는 구조화된 프로토콜 아래 AI 에이전트 팀을 조율합니다.

핵심 통찰은 멀티 에이전트 개발의 가치가 에이전트의 수에 있지 않다는 것입니다. 가치는 거버넌스된 프로세스가 즉흥적인 "에이전트가 완료했다고 주장하는 것"을 증거 기반 검증으로 대체한다는 점에 있습니다. 계약 엔진이 불변 요소이며, 에이전트·협업 표면·도구는 모두 교체 가능합니다.

설계 결정을 내릴 때마다 **"이것이 멀티 에이전트 프로세스를 더 잘 거버닝되고, 추적 가능하고, 검증 가능하며, 학습 가능하게 만드는가?"** 라고 스스로에게 물어보세요.

---

## 2. 네 가지 기둥

| 기둥 | 정의 | 구체적인 예시 |
|--------|-----------|-----------------|
| **거버넌스(Governance)** | 모든 결정은 명시적인 권한이 있는 정해진 프로세스를 따릅니다. | Compass가 파이프라인을 오케스트레이션하고, Nova가 ship/iterate/cut 권한을 가지며, Critic은 모든 vote round에 반드시 참여해야 합니다. 어떤 에이전트도 자신의 작업을 스스로 승인할 수 없습니다. |
| **추적 가능성(Traceability)** | 모든 행동은 기록되어 사후에 감사할 수 있습니다. | 모든 전환은 실제 UTC 타임스탬프와 함께 `.geas/ledger/events.jsonl`에 기록됩니다. `run.json`의 체크포인트 상태는 활성 파이프라인 단계와 진행 중인 에이전트를 추적합니다. DecisionRecord는 에스컬레이션의 *이유*를 포착합니다. |
| **검증(Verification)** | 모든 산출물은 계약에 대해 검증됩니다 — "완료"는 "계약 이행"을 의미합니다. | Evidence Gate는 세 가지 계층을 실행합니다: 기계적 검증(build/lint/test 명령어가 exit 0으로 종료), 의미론적 검증(인수 기준 충족, rubric 점수가 임계값 이상), 제품 검증(Nova 판단). Ship Gate는 작업을 passed로 표시하기 전에 네 개의 독립적인 증거 파일을 요구합니다. |
| **진화(Evolution)** | 팀은 시간이 지남에 따라 더 스마트해집니다. | Scrum 회고는 모든 작업에 필수입니다. 교훈은 `.geas/memory/retro/`에 저장됩니다. Rules.md는 각 작업 후 업데이트되는 살아있는 문서입니다. Conventions.md는 실행 중에 발견된 프로젝트별 패턴을 포착합니다. |

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

| 계층 | 역할 | 교체 가능성 |
|-------|------|----------------|
| **Collaboration Surface** | 인간이 시스템과 상호작용하는 인터페이스입니다. 대시보드, CLI, 또는 채팅 스레드일 수 있습니다. | 완전히 교체 가능합니다. 핵심 스킬은 표면 가정을 하드코딩해서는 안 됩니다. |
| **Agent Teams** | 작업을 실행하는 전문 에이전트 집합입니다. 기본 Geas-12 팀은 Nova(PM), Forge(아키텍트), Palette(디자이너), Pixel(프론트엔드), Circuit(백엔드), Sentinel(QA), Keeper(Git/릴리스), Shield(보안), Scroll(문서), Critic(악마의 변호인), Scrum(애자일 마스터), Pipeline(DevOps)을 포함합니다. | 완전히 교체 가능합니다. 계약 엔진은 어떤 에이전트 구성과도 함께 작동합니다. 에이전트는 정체성이 아닌 템플릿입니다. |
| **Contract Engine** | 작업 흐름 *방식*을 정의하는 핵심 스킬들: intake, 작업 컴파일, context packet, implementation contract, evidence gate, verify-fix loop, vote round. 이 계층은 도구에 종속되지 않습니다. | **교체 불가** — 이것이 불변 요소입니다. 다른 모든 계층이 이것에 적응합니다. |
| **Tool Adapters** | 에이전트가 작업을 수행하는 데 사용하는 런타임 도구들(파일 I/O, bash, 웹 검색, MCP 서버, 브라우저 자동화). | 완전히 교체 가능합니다. 핵심 스킬은 특정 제품 이름이 아닌 카테고리로 기능을 참조합니다. |

### 플러그인 구조

```
plugin/
  plugin.json              # 매니페스트 (agents, skills, hooks, settings)
  skills/                  # 공유 스킬 (core + team + surface)
    intake/                # 소크라테스식 요구사항 수집
    task-compiler/         # seed -> TaskContracts
    context-packet/        # 역할별 브리핑
    evidence-gate/         # 3계층 검증
    implementation-contract/  # 구현 전 합의
    verify-fix-loop/       # 실패 -> 수정 -> 재검증 (재시도 예산 포함)
    vote-round/            # 구조화된 에이전트 투표 + 토론
    compass/               # 오케스트레이터 (메인 세션에서 실행)
    initiative/            # 4단계 신규 제품 프로토콜
    sprint/                # 제한된 기능 추가 프로토콜
    debate/                # 의사결정 전용 토론, 코드 없음
    ...                    # 추가 유틸리티 스킬
  agents/                  # 12개 에이전트 정의 (YAML frontmatter가 있는 .md 파일)
  hooks/
    hooks.json             # Hook 구성
    scripts/               # Hook 구현 스크립트
```

---

## 4. 데이터 흐름

### 완전한 작업 생명주기

작업은 다음 아티팩트를 통해 흐르며, 각각은 관련 `schemas/` 디렉토리의 JSON 스키마를 준수합니다:

```
사용자 요청
    |
    v
+-----------+     소크라테스식 Q&A     +------------+
|  Intake   | ---------------------->  |  seed.json |  (불변 프로젝트 정체성)
+-----------+                          +------------+
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
                                            |                    demo_steps, 승인자
                                            |                    Sentinel + Forge
                                            v
                                     +----------------+
                                     | Implementation |  (격리된 worktree의 worker)
                                     +----------------+
                                            |
                                            v
                                     +----------------+
                                     | EvidenceBundle |  (.geas/evidence/{task-id}/{agent}.json)
                                     +----------------+  에이전트별 증거 파일
                                            |
                                            v
                                     +--------------+     실패     +----------------+
                                     | Evidence Gate | ----------> | Verify-Fix Loop|
                                     +--------------+              +----------------+
                                       |    |                            |
                                       |    | (재시도 예산               |
                                       |    |  소진)                     | (gate 재실행)
                                       |    v                            |
                                       |  +----------------+             |
                                       |  | DecisionRecord | <-----------+
                                       |  +----------------+   (에스컬레이션 시)
                                       |  (.geas/decisions/)
                                       |
                                       | 통과
                                       v
                                 +-------------+
                                 | GateVerdict |  pass / fail / iterate
                                 +-------------+
                                       |
                                       v
                                 +------------+
                                 | Ship Gate  |  4개 증거 파일 필요:
                                 +------------+  forge-review, sentinel,
                                       |         critic-review, nova-verdict
                                       v
                                 +-----------+
                                 |  Resolve  |  status -> "passed"
                                 +-----------+  Keeper 커밋, Scrum 회고
```

### 아티팩트 요약

| 아티팩트 | 위치 | 스키마 | 생성 주체 |
|----------|----------|--------|------------|
| seed.json | `.geas/spec/seed.json` | `intake/schemas/seed.schema.json` | Intake |
| TaskContract | `.geas/tasks/{task-id}.json` | `task-compiler/schemas/task-contract.schema.json` | Task Compiler |
| ContextPacket | `.geas/packets/{task-id}/{role}.md` | `context-packet/schemas/context-packet.schema.json` | Context Packet Generator |
| ImplementationContract | `.geas/contracts/{task-id}.json` | `implementation-contract/schemas/implementation-contract.schema.json` | Worker (Sentinel + Forge 승인) |
| EvidenceBundle | `.geas/evidence/{task-id}/{agent}.json` | `evidence-gate/schemas/evidence-bundle.schema.json` | 작업 완료 후 각 에이전트 |
| GateVerdict | events.jsonl에 기록 | N/A (이벤트 형식) | Evidence Gate |
| DecisionRecord | `.geas/decisions/{dec-id}.json` | `evidence-gate/schemas/decision-record.schema.json` | Evidence Gate (에스컬레이션 시) |

---

## 5. `.geas/` 디렉토리 구조

`.geas/` 디렉토리는 프로젝트의 런타임 상태 루트입니다. gitignore되어 있으며 프로젝트별로 생성됩니다.

```
.geas/
  state/
    run.json                 # 현재 실행 상태: mode, phase, status,
                             # current_task_id, completed_tasks, checkpoint
                             # (remaining_steps, agent_in_flight,
                             # pipeline_step, retry_count 포함)

  spec/
    seed.json                # intake에서 동결된 미션 명세 (불변)
    prd.md                   # 제품 요구사항 문서 (Initiative 전용)
    stories.md               # PRD에서 분해된 사용자 스토리 (Initiative 전용)

  tasks/
    task-001.json            # 각 작업의 TaskContract
    task-002.json            # goal, acceptance_criteria, eval_commands,
    ...                      # rubric, worker, reviewer, status, retry_budget 포함

  contracts/
    task-001.json            # 작업별 ImplementationContract
    ...                      # planned_actions, edge_cases, demo_steps, status

  packets/
    task-001/
      palette.md             # 디자이너용 ContextPacket
      pixel.md               # 프론트엔드 worker용 ContextPacket
      forge.md               # 아키텍트용 ContextPacket
      forge-review.md        # 코드 리뷰용 ContextPacket
      sentinel.md            # QA용 ContextPacket
      ...

  evidence/
    genesis/                 # Genesis 단계 증거 (Initiative 전용)
      nova.json              # 비전 및 MVP 범위
      forge.json             # 아키텍처 결정
      vote-*.json            # Vote round 결과
    task-001/
      palette.json           # 디자인 명세 증거
      pixel.json             # 구현 증거
      forge-review.json      # 코드 리뷰 증거
      sentinel.json          # QA/테스팅 증거
      critic-review.json     # Critic 출시 전 리뷰
      nova-verdict.json      # 제품 소유자 판단
      keeper.json            # 커밋 증거
    polish/
      shield.json            # 보안 리뷰
      scroll.json            # 문서 리뷰
    evolution/
      nova-final.json        # 최종 제품 리뷰
      keeper-release.json    # 릴리스 관리

  decisions/
    dec-001.json             # DecisionRecord — 결정이 이루어진 이유
    ...                      # 에스컬레이션, 아키텍처 선택, 방향 전환 시 생성

  ledger/
    events.jsonl             # 추가 전용 이벤트 로그 (모든 전환, gate 결과,
                             # 실제 UTC 타임스탬프와 함께 단계 완료 기록)

  memory/
    _project/
      conventions.md         # 프로젝트별 관례 (기술 스택, 명령어,
                             # 패턴 — 온보딩 중 Forge가 감지)
    retro/
      task-001.json          # Scrum의 회고 교훈
      ...

  rules.md                   # 살아있는 규칙 문서 — 각 작업 회고 후
                             # Scrum이 업데이트

  debt.json                  # 기술 부채 추적기 (DEBT-001, DEBT-002, ...)
                             # severity, source_task, status

  config.json                # 런타임 설정 (연결된 MCP 서버 등)
```

### 주요 파일

| 파일 | 목적 | 업데이트 주체 |
|------|---------|------------|
| `state/run.json` | 세션 상태 및 체크포인트. 컴팩션 후 복구 앵커. | Compass (모든 에이전트 spawn 전/후) |
| `spec/seed.json` | 동결된 미션 정체성. 생성 후 절대 수정되지 않음. | Intake (한 번) |
| `rules.md` | 살아있는 관례. 모든 회고와 함께 성장. | Scrum |
| `debt.json` | 기술 부채 백로그. Hook을 통한 임계값 경고. | Compass (에이전트 증거 읽은 후) |
| `ledger/events.jsonl` | 감사 추적. 추가 전용. | Compass (모든 전환) |

---

## 6. seed.json 설계

### 목적

seed는 프로젝트의 동결된 정체성입니다 — 우리가 무엇을 만들고 있는지, 누구를 위해, 어떤 경계 안에서. 모든 하위 아티팩트(TaskContract, ContextPacket, Nova 판단)가 미션 정렬을 위해 참조하는 단일 진실의 원천입니다.

### 스키마

`plugin/skills/intake/schemas/seed.schema.json`에 정의되어 있습니다. 필수 필드:

| 필드 | 유형 | 설명 |
|-------|------|-------------|
| `version` | string (const "1.0") | 스키마 버전 |
| `mission` | string | 정제된, 명확한 미션 진술 |
| `acceptance_criteria` | array (최소 3개) | "완료"를 정의하는 측정 가능한 기준 |
| `scope_in` | array (최소 1개) | 명시적으로 포함된 기능 |
| `scope_out` | array (최소 1개) | 명시적으로 제외된 기능 (범위가 고려되었음을 증명) |
| `completeness_checklist` | object | 각 섹션이 사용자 승인을 받았음을 확인하는 불리언 값들 |
| `created_at` | date-time | 동결된 UTC 타임스탬프 |

선택적 필드: `target_user`, `constraints`, `assumptions`, `ambiguity_notes`, `source`, `readiness_override`.

### 불변성

사용자가 확인하면 seed는 실행 중에 절대 수정되지 않습니다. 범위가 변경되어야 하는 경우에는 pivot-protocol 스킬이 대신 호출됩니다.

### source 필드

`source` 필드는 seed가 생성된 방식을 나타냅니다:

| 값 | 의미 |
|-------|---------|
| `"initiative"` | 전체 소크라테스식 intake 프로세스. 모든 섹션이 사용자 승인을 받은 포괄적인 seed. |
| `"sprint"` | 최소한으로 자동 생성된 seed. seed가 없을 때만 생성됨 (프로젝트의 첫 번째 Sprint). 코드베이스 온보딩에서 감지된 프로젝트 정체성을 포함. |

### Initiative vs Sprint 동작

**Initiative**는 다단계 소크라테스식 intake를 통해 전체 seed를 생성합니다:
1. 범위 평가 (너무 크면 분해)
2. 요구사항 탐색 (한 번에 하나씩, 객관식 선호)
3. 트레이드오프가 있는 2-3가지 접근법 제안
4. 명시적인 사용자 승인과 함께 섹션별로 seed 구축
5. completeness checklist 검증 (모든 불리언이 true)
6. 동결

**Sprint**는 seed를 읽기 전용 컨텍스트로 취급합니다:
- `seed.json`이 존재하는 경우 (이전 Initiative 또는 Sprint로부터): 미션/제약을 위해 읽습니다. 절대 수정하지 않습니다. 기능 범위는 TaskContract로 직접 이동합니다.
- `seed.json`이 존재하지 않는 경우 (Geas를 처음 사용하는 경우): 코드베이스 온보딩에서 감지된 스택, 관례, 프로젝트 정체성으로 채워진 `"source": "sprint"`를 가진 최소 seed를 생성합니다.

이 분리는 seed가 *프로젝트 정체성*을 포착하고, TaskContract가 *지금 무엇을 만들 것인지*를 포착함을 의미합니다.

---

## 7. 컨텍스트 쇠퇴 저항

### 문제

장시간 오케스트레이션 세션은 컨텍스트 창 제한에 도달합니다. LLM이 컨텍스트를 컴팩트화하면 파이프라인 상태가 저하됩니다:

- 오케스트레이터가 어떤 단계에 있었는지 잊어버림
- 필수 단계(코드 리뷰, 테스팅, critic 리뷰)를 건너뜀
- 완료된 작업과 진행 중인 작업을 추적하지 못함
- 에이전트 정의(YAML frontmatter + 역할 설명)는 짧고 자체 완결적이기 때문에 ~100% 정확도로 컴팩션에서 살아남음
- SKILL.md 파이프라인 단계(긴 순차적 절차)는 컴팩터가 요약하면서 단계 순서와 필수 마커를 잃어 상당히 저하됨

### 해결책

Geas는 두 부분으로 구성된 방어를 사용합니다:

#### 1부: run.json의 체크포인트 상태

모든 에이전트 spawn 전에 Compass는 전체 파이프라인 위치를 `.geas/state/run.json`에 씁니다:

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

`remaining_steps` 배열이 핵심 요소입니다. 각 단계가 완료되면 앞에서 제거됩니다. 오케스트레이터가 컨텍스트를 잃으면 `remaining_steps`를 읽어 다음에 무엇이 오는지 정확히 알 수 있습니다.

#### 2부: PostCompact Hook (restore-context.sh)

`PostCompact` hook은 모든 컨텍스트 컴팩션 후 자동으로 발동합니다. `run.json`을 읽고 현재 상태를 `additionalContext`로 대화에 주입합니다:

- Mode, phase, status
- 현재 작업 ID 및 목표
- 현재 작업의 인수 기준
- 파이프라인 단계 및 진행 중인 에이전트
- 명시적인 `NEXT STEP` 표시기가 있는 `remaining_steps` 배열
- `rules.md`의 처음 30줄 (주요 관례)

이는 적극적인 컴팩션 후에도 오케스트레이터가 어디서 재개할지 정확히 알려주는 구조화된 상태 요약을 받는다는 것을 의미합니다.

#### 에이전트 정의는 살아남지만 파이프라인은 저하되는 이유

에이전트 정의는 작고 자체 완결적인 마크다운 파일(이름, 모델, 역할 설명)입니다. 잘 압축되며 컴팩션 후에도 의미를 유지합니다.

SKILL.md 파이프라인 정의는 조건부 로직, 필수 마커(`[MANDATORY]`), 건너뛰기 조건, 교차 참조가 있는 긴 순차적 절차입니다. 컴팩트화될 때 요약기는 다음 경향이 있습니다:
- 인접한 단계를 병합
- 조건부 건너뛰기 로직 삭제
- `[MANDATORY]` 주석 손실
- "11단계"를 "파이프라인이 design에서 resolve까지 실행된다"로 요약

체크포인트 + restore-context 접근법은 파이프라인 위치를 컴팩션에 영향받지 않는 디스크로 외부화함으로써 이를 완전히 회피합니다.

---

## 8. 도구 비종속 원칙

### 규칙

핵심 스킬(`plugin/skills/`)은 특정 도구, 프레임워크, 패키지 관리자, 데이터베이스, 테스트 실행기, 빌드 도구를 하드코딩해서는 안 됩니다. 이는 계약 엔진이 어떤 기술 스택에서도 이식 가능하게 유지시킵니다.

### 금지된 것

- 기본값으로 가정된 패키지 관리자 이름 (npm, pnpm, yarn, bun)
- 요구사항으로 가정된 프레임워크 이름 (Next.js, React, Express, Django)
- 가정으로 사용된 데이터베이스 이름 (PostgreSQL, MongoDB)
- 필수 도구로 지정된 테스트 도구 이름 (Playwright, Jest, pytest)
- 규정된 선택으로 사용된 빌드 도구 이름 (webpack, vite)

### 허용된 것

| 패턴 | 예시 | 근거 |
|---------|---------|-----------|
| conventions.md 참조 | "conventions.md에서 빌드 명령어 실행" | 프로젝트별 명령어는 스킬 정의가 아닌 conventions.md에 있음 |
| 마커 파일 감지 | "package.json이 있으면..." / "go.mod이 있으면..." | 스택 식별을 위한 감지 대상이지 규정이 아님 |
| 다중 대안 예시 | "예: Jest, pytest, 또는 vitest" | 여러 옵션 제시는 하나를 규정하는 것을 피함 |
| MCP 도구 카테고리 | "browser automation MCP" | 에이전트 정의는 MCP 카테고리를 참조할 수 있지만 특정 제품 이름을 유일한 옵션으로 지정하지 않음 |

### 실제 작동 방식

1. **Forge가 프로젝트를 온보딩합니다** — Genesis(Initiative) 또는 사전 조건(Sprint) 중에 발견된 관례를 `.geas/memory/_project/conventions.md`에 작성
2. **TaskContract는 conventions.md를 참조합니다** — eval_commands를 위해 (예: 테스트 명령어, 빌드 명령어, lint 명령어)
3. **Worker들은 ContextPacket을 읽습니다** — 관련 관례가 포함되어 있음
4. **Evidence Gate는 TaskContract의 eval_commands를 실행합니다** — 이것들은 하드코딩된 도구 호출이 아닌 프로젝트별 명령어

이는 Python/Django 프로젝트에서의 Geas 세션이 conventions.md가 그렇게 명시했기 때문에 `pytest`와 `ruff`를 사용하고, TypeScript/Next.js 프로젝트는 `vitest`와 `eslint`를 사용한다는 것을 의미합니다 — 어떤 스킬 정의도 변경하지 않고.

### CLAUDE.md 적용

프로젝트의 CLAUDE.md는 이 규칙들을 명시적으로 포함합니다. 핵심 스킬에 하드코딩된 도구 참조를 추가하는 PR은 아키텍처를 위반하며 거부되어야 합니다.
