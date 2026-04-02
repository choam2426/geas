# Skills 레퍼런스

Geas 플러그인의 23개 skill 목록입니다. 사용자가 `/geas:<name>`으로 직접 호출하거나, Orchestrator가 실행 프로토콜 중 자동 호출합니다.

## 요약 표

| Skill | 분류 | 사용자 호출 | 호출 주체 | 주요 출력 |
|-------|------|-----------|-----------|-----------|
| [mission](#mission) | Entry | 가능 | 사용자 직접 | Orchestrator 호출 |
| [orchestrating](#orchestrating) | Entry | 불가 | 사용자 (`/geas:mission` 경유) | 4-phase 미션 (Specifying → Building → Polishing → Evolving) |
| [setup](#setup) | Entry | 불가 | Orchestrator (최초 실행) | `.geas/` 런타임 디렉토리 |
| [intake](#intake) | Core - Contract Engine | 불가 | Orchestrator | `.geas/spec/seed.json` |
| [task-compiler](#task-compiler) | Core - Contract Engine | 불가 | Orchestrator | `.geas/tasks/{id}.json` |
| [context-packet](#context-packet) | Core - Contract Engine | 불가 | Orchestrator | `.geas/packets/{task-id}/{worker}.md` |
| [implementation-contract](#implementation-contract) | Core - Contract Engine | 불가 | Orchestrator | `.geas/contracts/{task-id}.json` |
| [evidence-gate](#evidence-gate) | Core - Contract Engine | 불가 | Orchestrator | Gate 판정 + ledger 이벤트 |
| [verify-fix-loop](#verify-fix-loop) | Core - Contract Engine | 불가 | Orchestrator (evidence-gate 경유) | 수정 반복 + DecisionRecord |
| [verify](#verify) | Core - Verification | 불가 | Worker 에이전트 | 콘솔 체크리스트 리포트 |
| [vote-round](#vote-round) | Core - Verification | 불가 | Orchestrator (Specifying 시점) | `.geas/decisions/{dec-id}.json` |
| [decision](#decision) | Team - Execution | 가능 | Orchestrator 또는 사용자 | `.geas/decisions/{dec-id}.json` |
| [write-prd](#write-prd) | Team - Planning | 불가 | Nova (Specifying 중) | `.geas/spec/prd.md` |
| [write-stories](#write-stories) | Team - Planning | 불가 | Nova (Specifying 중) | `.geas/spec/stories.md` |
| [onboard](#onboard) | Team - Planning | 불가 | Orchestrator (기존 프로젝트, 최초 실행) | `.geas/memory/_project/conventions.md` |
| [coding-conventions](#coding-conventions) | Utility | 불가 | 모든 에이전트 | 참조 가이드 전용 |
| [briefing](#briefing) | Utility | 불가 | Nova 또는 Orchestrator | 콘솔 상태 리포트 |
| [run-summary](#run-summary) | Utility | 불가 | Orchestrator (세션 종료 시) | `.geas/summaries/run-summary-<date>.md` |
| [ledger-query](#ledger-query) | Utility | 불가 | Orchestrator 또는 사용자 | 포맷된 쿼리 결과 (읽기 전용) |
| [cleanup](#cleanup) | Utility | 불가 | Orchestrator (Building phase 이후 / Evolving) | `.geas/state/debt-register.json` 항목 |
| [pivot-protocol](#pivot-protocol) | Utility | 불가 | Orchestrator 또는 아무 에이전트 | `.geas/decisions/{dec-id}.json` |

---

## Entry Skills

### mission

진입점입니다. 사용자 의도를 받아 Orchestrator를 호출합니다.

**사용자 호출:** 가능 (`/geas:mission`)

**호출 주체:** 사용자 직접

**입력:**
- 사용자 자연어 (미션, 기능 요청, 또는 의사결정 질문)

**출력:**
- 없음 (즉시 Orchestrator에 위임)

**핵심 동작:**
- 얇은 진입 셸입니다. 사용자 입력을 받아 `/geas:orchestrating`를 호출합니다.
- Orchestrator 에이전트를 스폰하지 않습니다. Orchestrator는 메인 세션에서 실행되는 skill이지 sub-agent가 아닙니다.
- decision 전용 요청(코드 없음)은 `/geas:decision`으로 라우팅합니다.

**스키마:** 없음

---

### orchestrating

Geas 오케스트레이터입니다. 멀티 에이전트 팀 전체를 관리합니다. 셋업, intake, 4-phase 미션 파이프라인(Specifying → Building → Polishing → Evolving)을 담당합니다. Phase별 절차는 `references/` 파일에 있습니다. decision 전용 요청은 `/geas:decision`으로 라우팅합니다.

**사용자 호출:** 불가 (`/geas:mission` 호출 시 내부적으로 `/geas:orchestrating`가 실행됩니다)

**호출 주체:** 사용자 요청마다 `mission` skill이 호출합니다

**입력:**
- `.geas/state/run.json` — 시작 시 이어하기 vs 새 실행 판단
- `.geas/spec/seed.json` — intake 이후 미션 컨텍스트
- `.geas/ledger/events.jsonl` — 상태 전환 기록용 이벤트 로그
- `.geas/state/debt-register.json` — 에이전트 복귀 시마다 확인하는 기술 부채 추적

**출력:**
- `.geas/state/run.json` — 에이전트 생성 전마다 checkpoint 업데이트
- `.geas/ledger/events.jsonl` — 모든 상태 전환 이벤트 기록
- `.geas/state/debt-register.json` — evidence bundle에서 추출한 새 기술 부채 항목

**핵심 동작:**
- `Agent()` 생성 전마다 `.geas/state/run.json`에 checkpoint를 기록합니다. `pipeline_step`, `agent_in_flight`, `pending_evidence` 필드가 포함됩니다. 세션 복구가 이 파일에 의존합니다.
- 에이전트 복귀 후 예상 evidence 파일이 있는지 확인합니다. 없으면 실패 처리하고, 1회 재시도 후 에러를 기록합니다.
- 시작 시 4-phase 미션 파이프라인(Specifying → Building → Polishing → Evolving, 요청에 맞게 규모 조절)으로 실행하거나, decision 전용 요청은 `/geas:decision`으로 라우팅합니다. Phase별 절차는 `references/discovery.md`, `references/build.md`, `references/polish.md`, `references/evolution.md`에 있습니다. 작업별 파이프라인은 `references/pipeline.md`에 있습니다. 상세는 `docs/ko/protocol/02_MODES_MISSIONS_AND_RUNTIME.md` 참조.

**스키마:** 직접 소유하는 스키마 없음. 하위 skill의 스키마를 읽습니다.

---

### setup

최초 셋업입니다. `.geas/` 런타임 디렉토리를 초기화하고 설정 파일을 만듭니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator가 최초 실행 시(`.geas/state/run.json`이 없을 때) 호출합니다

**입력:** 없음 (`.gitignore`에 기존 항목이 있는지만 확인합니다)

**출력:**
- `.geas/` 디렉토리 트리: `spec/`, `state/`, `tasks/`, `contracts/`, `packets/`, `evidence/`, `decisions/`, `decisions/pending/`, `ledger/`, `summaries/`, `memory/_project/`, `memory/agents/`
- `.geas/state/run.json` — 초기 실행 상태 (`status: "initialized"`)
- `.geas/state/debt-register.json` — 빈 기술 부채 레지스터 (`{"items": []}`)
- `.geas/rules.md` — 모든 에이전트가 따르는 공유 규칙 (evidence 형식, 코드 경계)
- `.gitignore` — `.geas/` 항목이 없으면 추가

**핵심 동작:**
- `mkdir -p`로 멱등하게 디렉토리를 만듭니다. 기존 프로젝트에서도 안전합니다.
- `rules.md`에 기본 evidence 및 코드 규칙을 씁니다. Scrum이 회고를 거치며 이 파일을 점진적으로 갱신합니다.
- 사용자가 수동으로 실행할 필요 없습니다. Orchestrator가 자동으로 트리거합니다.

**스키마:** 없음.

---

## Core - Contract Engine Skills

### intake

미션 intake 게이트입니다. 협업 탐색으로 seed 스펙을 확정합니다. 한 번에 질문 하나, 섹션별로 승인받습니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator (시작 시퀀스 1단계, mode 분기 전)

**입력:**
- 사용자 자연어 (원본 미션 설명)
- `.geas/spec/seed.json` — 존재 여부 확인 (기존 프로젝트에서는 파일이 이미 있으면 건너뜁니다)

**출력:**
- `.geas/spec/seed.json` — `schemas/seed.schema.json`을 따르는 확정된 미션 스펙

**핵심 동작:**
- 한 번에 질문 하나만 합니다. 질문을 묶지 않습니다. 내부적으로 완성도 체크리스트를 추적합니다: `mission`, `acceptance_criteria` (3개 이상), `scope_out` (1개 이상), `target_user`, `constraints`. 전부 채워지면 종료합니다.
- 새 제품에서는 스코프 확정 전에 2~3개 접근 방식을 트레이드오프와 함께 제시합니다. 기존 프로젝트에서는 기능 범위 질문만 합니다.
- 사용자가 "그냥 만들어"라고 하면 `readiness_override: true`를 설정하고, 최선의 값으로 채운 뒤 진행합니다. 확정 이후 범위 변경은 `pivot-protocol`을 거쳐야 합니다.

**스키마:** `plugin/skills/intake/schemas/seed.schema.json`

---

### task-compiler

사용자 스토리를 TaskContract로 컴파일합니다. 검증 가능한 acceptance criteria, 경로 제한, eval 명령이 포함된 기계 판독 가능 작업 계약입니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — Specifying phase와 Building phase 진입 시

**입력:**
- 사용자 스토리 또는 기능 설명
- `.geas/spec/seed.json` — 미션 수준 컨텍스트
- `.geas/memory/_project/conventions.md` — build/lint/test 명령
- `.geas/tasks/` — 의존성 확인과 ID 순번을 위한 기존 계약

**출력:**
- `.geas/tasks/{id}.json` — `schemas/task-contract.schema.json`을 따르는 TaskContract
- `.geas/ledger/events.jsonl` — `task_compiled` 이벤트 추가

**핵심 동작:**
- 작업 유형별로 worker와 reviewer를 배정합니다. 프론트엔드는 Pixel/Forge, 백엔드는 Circuit/Forge, 디자인은 Palette/Forge입니다. worker가 건드리면 안 되는 경로는 `prohibited_paths`로 지정합니다.
- `rubric` 배열로 품질 차원과 임계값을 만듭니다. 기본 차원(`core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`)은 모든 작업에, `ux_clarity`와 `visual_coherence`는 UI 작업에 추가됩니다.
- `conventions.md`에서 eval 명령을 읽습니다. 없으면 프로젝트 설정 파일(package.json, Makefile, pyproject.toml)에서 자동 감지합니다.

**스키마:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

---

### context-packet

worker 전용 ContextPacket을 만듭니다. 해당 역할에 필요한 컨텍스트만 압축해서 전달하는 브리핑 문서입니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator가 worker를 작업에 배치하기 직전에 호출합니다

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract
- `.geas/evidence/{task-id}/` — 이전 worker 산출물
- `.geas/decisions/` — 관련 의사결정 기록
- `.geas/spec/seed.json` — 미션 컨텍스트
- `.geas/contracts/{task-id}.json` — implementation contract (Forge, Sentinel 패킷용)
- `.geas/state/debt-register.json` — 해당 작업 관련 미해결 기술 부채

**출력:**
- `.geas/packets/{task-id}/{worker-name}.md` — 역할별 마크다운 브리핑 (목표: 200줄 이내)

**핵심 동작:**
- worker 유형별로 필요한 컨텍스트만 줍니다. Palette는 디자인 제약과 타겟 사용자를 받습니다. Pixel/Circuit는 디자인 스펙과 eval 명령을 받습니다. Forge는 변경된 파일과 worker의 `self_check.known_risks`를 받습니다. Sentinel은 implementation contract의 `demo_steps`, `edge_cases`, 사용 가능한 QA 도구를 받습니다.
- Sentinel 패킷에는 `## QA Tools Available` 섹션(`.geas/config.json`에 실제 연결된 도구만 나열)과 `## Rubric Scoring` 섹션(평가할 차원 목록)이 포함됩니다.
- 의사결정 기록에서 사람이 확인한 결정이 가장 높은 우선순위를 가집니다.

**스키마:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

---

### implementation-contract

구현 전 합의 문서입니다. worker가 구체적인 실행 계획을 제안하면, Sentinel과 Forge가 코딩 시작 전에 승인합니다. 요구사항 오해로 인한 재작업을 방지합니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — Tech Guide(Forge) 이후, Implementation 전. 모든 작업에 예외 없이 실행합니다

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract
- `.geas/packets/{task-id}/{worker}.md` — worker의 ContextPacket
- `.geas/evidence/{task-id}/palette.json`, `.geas/evidence/{task-id}/forge.json` — 이전 디자인/기술 가이드 evidence (있는 경우)

**출력:**
- `.geas/contracts/{task-id}.json` — `schemas/implementation-contract.schema.json`을 따르는 implementation contract (`planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`, `status`)
- `.geas/ledger/events.jsonl` — `implementation_contract` 이벤트 (`approved` 또는 `revision_requested`)

**핵심 동작:**
- 3단계로 진행합니다. worker가 계약 초안 작성 → Sentinel이 QA 관점에서 검토(`demo_steps`가 모든 acceptance criterion을 커버하는지 확인) → Forge가 기술적 타당성 검토. 둘 다 승인해야 구현이 시작됩니다.
- 수정은 1회까지만 허용합니다. 수정 요청 후 재제출하면 Forge가 최종 결정을 내립니다.
- `demo_steps`는 모든 acceptance criterion을 커버해야 합니다. 누락이 있으면 불완전한 계약입니다.

**스키마:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

---

### evidence-gate

Evidence Gate v2 품질 게이트입니다. EvidenceBundle을 TaskContract 기준으로 평가합니다. 프로토콜에서는 Tier 0(Precheck) + Tier 1(Mechanical) + Tier 2(Contract+Rubric) 구조이며, 기존 Tier 3(Product)은 독립된 Final Verdict 단계로 분리되었습니다. Gate 통과 후 Closure Packet 조립 → Critical Reviewer pre-ship challenge → Final Verdict 순서로 진행됩니다. 상세는 `docs/ko/protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md` 참조.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — implementation, code review, QA 단계 이후마다 호출합니다

**입력:**
- `.geas/evidence/{task-id}/{worker-name}.json` — EvidenceBundle
- `.geas/tasks/{task-id}.json` — TaskContract (acceptance criteria, eval 명령, rubric, retry budget)

**출력:**
- Gate verdict (pass/fail/block/error) + tier별 결과. `iterate`는 gate 결과가 아니라 Final Verdict에서 사용됩니다.
- `.geas/tasks/{task-id}.json` — 통과 시 status를 `"passed"`로 업데이트
- `.geas/ledger/events.jsonl` — tier 결과가 포함된 `gate_result` 이벤트
- `.geas/decisions/{dec-id}.json` — 에스컬레이션 시 DecisionRecord
- 실패 시 `verify-fix-loop` 트리거 (retry budget 남아 있을 때)

**핵심 동작:**
- Tier 0 (Precheck): 필수 artifact 존재 여부, task state 적합성, baseline/integration 전제 조건을 확인합니다. 실패 시 이후 tier로 진행하지 않습니다.
- Tier 1 (Mechanical): TaskContract의 `eval_command`를 직접 실행하고 exit code를 기록합니다. 통과를 가정하지 않습니다. 첫 실패에서 멈춥니다.
- Tier 2 (Contract + Rubric): worker evidence에서 acceptance criteria를 확인한 뒤, rubric 차원 점수를 비교합니다. 모든 차원이 임계값을 넘어야 합니다. worker의 `self_check.confidence`가 2 이하면 모든 임계값이 1 올라갑니다.
- Gate 통과 후: Closure Packet 조립 → Critical Reviewer pre-ship challenge (high/critical risk 필수) → Final Verdict (product_authority가 pass/iterate/escalate 판정). 기존 Tier 3(Product)은 이 Final Verdict로 분리되었습니다.

**스키마:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`, `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

### verify-fix-loop

범위가 정해진 수정-검증 반복 루프입니다. TaskContract의 retry budget을 읽고, 반복마다 EvidenceBundle을 만들며, 에스컬레이션 시 DecisionRecord를 씁니다. 기본 최대 반복: 3회.

**사용자 호출:** 불가

**호출 주체:** Orchestrator (evidence-gate 실패 시 트리거)

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract (retry budget, escalation policy)
- `.geas/evidence/{task-id}/sentinel.json` — 실패한 EvidenceBundle과 구체적 실패 내용
- Gate 판정 — 어떤 tier가 왜 실패했는지 (rubric의 `blocking_dimensions` 포함)

**출력:**
- `.geas/packets/{task-id}/{fixer}-fix-{N}.md` — 반복별 수정 전용 ContextPacket
- `.geas/evidence/{task-id}/{fixer}-fix-{N}.json` — 수정 시도별 EvidenceBundle
- `.geas/decisions/{dec-id}.json` — budget 소진 시 DecisionRecord
- `.geas/ledger/events.jsonl` — 에스컬레이션 이벤트

**핵심 동작:**
- 반복마다: 적합한 fixer를 생성하고(프론트엔드 버그는 Pixel, 백엔드는 Circuit), worktree 격리로 실행한 뒤, worktree branch를 머지하고, evidence-gate(Tier 1 + Tier 2)를 다시 돌립니다.
- 수정 전용 ContextPacket에 rubric 평가의 `blocking_dimensions`가 포함됩니다. fixer가 어떤 품질 임계값을 못 넘었는지 정확히 알 수 있습니다.
- retry budget 소진 시 TaskContract의 `escalation_policy`를 따릅니다: `forge-review`(아키텍처 분석 + 수정 가능하면 1회 추가 시도), `nova-decision`(전략적 방향), `pivot`(pivot-protocol 호출).

**스키마:** `task-contract.schema.json` 읽기; `decision-record.schema.json` 쓰기.

---

## Core - Verification Skills

### verify

구조화된 검증 체크리스트입니다. BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY 5개 항목을 순서대로 확인합니다.

**사용자 호출:** 불가

**호출 주체:** Worker 에이전트 (Pixel, Circuit, Forge, Sentinel)가 완료 선언 전에 실행합니다

**입력:**
- `.geas/memory/_project/conventions.md` — 프로젝트 전용 명령 (없으면 프로젝트 설정 파일에서 자동 감지)
- 프로젝트 루트 마커 파일 (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`) — 스택 감지용

**출력:**
- 콘솔 체크리스트 리포트 (파일 생성 없음)

**핵심 동작:**
- 5개 항목을 순서대로 확인합니다: BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. 모든 항목이 PASS여야 VERDICT가 PASS입니다. PENDING이나 SKIP은 차단하지 않습니다. FAIL이면 구체적인 파일/라인 정보가 포함됩니다.
- Forge pre-check 모드는 BUILD + LINT만 돌립니다. Sentinel에 넘기기 전 빠른 게이트입니다.
- FUNCTIONALITY는 Sentinel 담당입니다 (브라우저 자동화 MCP로 E2E). 다른 에이전트는 `PENDING (Sentinel E2E)`로 표시합니다.

**스키마:** 없음.

---

### vote-round

구조화된 리뷰 프로토콜입니다. Forge가 제안하고, Critic이 도전하고, Orchestrator가 종합하며, 사용자가 확인합니다. DecisionRecord를 만듭니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — 주요 아키텍처 또는 횡단 관심사 결정 시 (주로 Specifying 1.5단계)

**입력:**
- Forge의 제안 (`.geas/decisions/pending/{proposal-id}.md`에 저장)
- 지정된 Critic 에이전트의 도전 (같은 파일에 추가)

**출력:**
- `.geas/decisions/{dec-id}.json` — `schemas/decision-record.schema.json`을 따르는 DecisionRecord
- 해결 후 `.geas/decisions/pending/{proposal-id}.md` 정리

**핵심 동작:**
- 4단계로 진행합니다. Forge가 구조화된 제안(What / Why / Trade-offs / Alternatives) 작성 → Critic이 구조화된 도전(Assessment / Concerns / Alternative / Recommendation) 작성 → Orchestrator가 양쪽을 종합해 사용자에게 옵션 제시 → 사용자 확인. 자율 모드에서는 Orchestrator가 자동 결정합니다.
- 아키텍처/기술 스택 제안과 디자인 시스템 결정에서 트리거됩니다. 개별 기능 스펙, 기능별 tech guide, 버그 수정, 소규모 리팩터링에서는 트리거하지 않습니다.
- Critic 참여는 필수입니다. 제안이 뻔해 보여도 Critic 단계를 건너뛸 수 없습니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Execution Skills

### decision

구현 전에 기술 또는 제품 결정을 내리기 위한 구조화된 멀티 에이전트 decision입니다. 코드 변경 없음 — 유틸리티 스킬입니다.

**사용자 호출:** 가능 (`/geas:decision`)

**호출 주체:** Orchestrator (mode 분기 후) 또는 사용자 직접

**입력:**
- 사용자의 질문 또는 결정 사항 (자연어)

**출력:**
- `.geas/decisions/{dec-id}.json` — 선택된 방향이 담긴 DecisionRecord

**핵심 동작:**
- 코드를 만들지 않습니다. 산출물은 DecisionRecord뿐입니다.
- 4명의 토론자를 병렬로 생성합니다: Forge (옵션 A 기술적 근거), Critic (옵션 A 도전 / 옵션 B 주장), Circuit (백엔드/확장성 관점), Palette (UX/프론트엔드 관점).
- Orchestrator가 입장을 종합하고, 트레이드오프를 제시하고, 사용자에게 최종 결정을 요청한 뒤, DecisionRecord를 씁니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Planning Skills

### write-prd

기능 아이디어나 미션에서 Product Requirements Document를 만듭니다.

**사용자 호출:** 불가

**호출 주체:** Nova — Specifying (mission 1.3단계)

**입력:**
- `$ARGUMENTS` — 기능 아이디어, 문제 정의, 또는 미션
- `.geas/spec/seed.json` — 미션 컨텍스트와 확정된 스코프

**출력:**
- `.geas/spec/prd.md` — 구조화된 PRD (Problem, Objective, Target Users, Scope In/Out, User Flows, Functional/Non-Functional Requirements, Success Metrics, Open Questions)

**핵심 동작:**
- 표준 섹션 순서(Problem ~ Open Questions)를 따르는 구조화된 마크다운 문서입니다.
- 모든 요구사항에 사용자 동기가 명확해야 합니다. 추적 가능성이 핵심입니다.
- 범위 밖 항목을 명시합니다. 실행 중 스코프 크리프를 막기 위해서입니다.

**스키마:** 없음.

---

### write-stories

기능이나 미션을 acceptance criteria가 달린 사용자 스토리로 쪼갭니다.

**사용자 호출:** 불가

**호출 주체:** Nova — Specifying (mission 1.3단계), write-prd 직후

**입력:**
- `$ARGUMENTS` — 기능 설명, 미션 정의, 또는 해결할 문제
- `.geas/spec/prd.md` — PRD 산출물이 입력 컨텍스트

**출력:**
- `.geas/spec/stories.md` — 표준 형식의 정렬된 사용자 스토리 (As a / I want to / So that + Acceptance Criteria + Priority + Estimate)

**핵심 동작:**
- 각 스토리는 독립적(단독 출시 가능)이고 테스트 가능(구체적이고 검증 가능한 acceptance criteria)해야 합니다.
- 우선순위순으로 정렬합니다 (P0 먼저). acceptance criteria가 3~5개를 넘으면 스토리를 쪼개야 합니다.
- acceptance criteria에 엣지 케이스(빈 상태, 오류 상태, 최대 한계)를 포함합니다. 해피 패스만으로는 부족합니다.

**스키마:** 없음.

---

### onboard

코드베이스 탐색 프로토콜입니다. 프로젝트 구조를 스캔하고, 스택을 감지하고, 아키텍처를 파악합니다. 기존 프로젝트 실행 시 기존 상태가 없을 때 자동 실행됩니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — 기존 프로젝트 실행 시 `.geas/memory/_project/conventions.md`가 없을 때

**입력:**
- 프로젝트 루트 파일: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`
- 소스 디렉토리 구조 (프로젝트 크기에 따라 깊이 조절)

**출력:**
- `.geas/memory/_project/conventions.md` — 스택, 빌드 명령, 주요 경로, 아키텍처 노트, 네이밍 컨벤션
- `.geas/memory/_project/state.json` — onboard 메타데이터 (mode, phase, project size, stack summary)

**핵심 동작:**
- Forge만 실행합니다 (단일 에이전트, 병렬 아님). 읽기 전용 정찰입니다. 코드 변경 없습니다.
- 프로젝트 크기에 따라 스캔 깊이가 달라집니다. 소규모(~50파일)는 전체 스캔, 중규모(50~500파일)는 `src/`와 진입점 중심, 대규모(500+파일)는 관련 디렉토리만 집중합니다.
- `conventions.md`가 이미 있으면 onboarding을 건너뜁니다. Orchestrator가 바로 읽고 실행 파이프라인으로 넘어갑니다.

**스키마:** 없음.

---

## Utility Skills

### coding-conventions

스택에 상관없이 적용되는 범용 코딩 표준입니다.

**사용자 호출:** 불가

**호출 주체:** 모든 에이전트가 상시 참조합니다. 파이프라인 단계로 호출되지 않습니다

**입력:** 없음

**출력:** 없음 (참조 문서 전용 — 파일 생성 없음)

**핵심 동작:**
- 스택과 무관한 범용 표준을 정의합니다: TypeScript strict 모드(해당 시), `any` 타입 금지, 함수/컴포넌트당 단일 책임, 우아한 에러 처리, 원자적 git commit, 모바일 우선 접근성 UI.
- 기술 스택 자체는 여기서 정하지 않습니다. Forge가 제안하고, Nova가 검증하고, Orchestrator가 확인하며, DecisionRecord에 기록됩니다. 그 후 Forge가 프로젝트별 `conventions.md`를 씁니다.
- `conventions.md`가 확장하고 구체화하는 베이스라인 역할입니다.

**스키마:** 없음.

---

### briefing

Nova의 아침 브리핑입니다. 뭘 출시했는지, 뭐가 막혀 있는지, 사람의 관심이 필요한 게 뭔지 구조화된 상태 리포트로 보여줍니다.

**사용자 호출:** 불가

**호출 주체:** Nova — 마일스톤, Evolving 시작, Orchestrator/사용자 요청 시

**입력:**
- `.geas/state/run.json` — 현재 단계와 미션
- `.geas/tasks/` — 상태별로 그룹화된 TaskContract
- `.geas/evidence/` — 최근 활동과 gate 결과
- 이전 브리핑 (변화 추적용)

**출력:**
- 콘솔 출력 전용 (파일 생성 없음)

**핵심 동작:**
- 5개 섹션 고정: What Shipped, What's Blocked, Needs Human Attention, Product Health (미션 정합성 / 품질 / 속도 / 사용자 가치), Next Priority. 60초 안에 읽을 수 있어야 합니다.
- Product Health에 Sentinel의 최근 테스트 통과율이 포함됩니다. Nova가 사용자 가치를 주관적으로 평가합니다 ("사용자가 이제 X를 할 수 있습니다").
- 모든 blocker에 제안 액션이 있습니다. 상황 보고가 아니라 행동 지침입니다.

**스키마:** 없음.

---

### run-summary

세션 종료 요약을 만듭니다. 의사결정, 완료된 이슈, 에이전트 통계, verify-fix 루프 기록이 포함됩니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — Evolving phase 종료 시, 또는 사용자 요청 시

**입력:**
- `.geas/state/run.json` — phase, mode, mission
- `.geas/memory/_project/agent-log.jsonl` — 에이전트 생성 이력
- `.geas/tasks/` — TaskContract 상태
- `.geas/decisions/` — 이번 세션 DecisionRecord
- `.geas/ledger/events.jsonl` — gate 결과, fix 루프, 에스컬레이션
- `.geas/ledger/costs.jsonl` — 에이전트 생성 비용 (선택)
- `.geas/state/debt-register.json` — 기술 부채 상태 (선택)

**출력:**
- `.geas/summaries/run-summary-<YYYY-MM-DD>.md` — 세션 감사 기록
- 콘솔 출력 (파일 내용과 동일)

**핵심 동작:**
- 포함 항목: 의사결정, 완료된 이슈(verify-fix 루프 횟수 포함), 진행 중인 이슈, 이름별 에이전트 생성 횟수, 미완료 작업.
- `costs.jsonl`이 있으면 Cost Report 테이블 (에이전트, 모델, phase, task별 생성 횟수)을 포함합니다. `debt-register.json`이 있으면 Tech Debt Report (심각도별 미해결, 이번 세션 신규/해결)를 포함합니다.
- 같은 날짜에 여러 요약이 생기면 순번 접미사가 붙습니다: `run-summary-2026-03-21-2.md`.

**스키마:** 없음.

---

### ledger-query

`.geas/ledger/events.jsonl` 구조화 검색입니다. task, phase, agent, 실패 기준으로 쿼리합니다. TaskContract, EvidenceBundle, DecisionRecord를 상호 참조합니다. 읽기 전용이며 절대 상태를 변경하지 않습니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator 또는 사용자 — 진단, 상태 확인, 이력 조회용

**입력 (읽기 전용):**
- `.geas/ledger/events.jsonl` — 기본 이벤트 로그
- `.geas/tasks/{id}.json` — 계약 상태 상호 참조용
- `.geas/evidence/{task-id}/{worker}.json` — evidence 파일 상호 참조용
- `.geas/decisions/{id}.json` — decision record 상호 참조용
- `.geas/state/run.json`, `.geas/spec/seed.json` — `status` 쿼리 타입용

**출력:**
- 포맷된 마크다운 쿼리 결과 콘솔 출력 (파일 생성 없음)

**핵심 동작:**
- 5가지 쿼리 타입: `timeline <task-id>`(하나의 작업 이벤트를 시간순으로), `phase <phase-name>`(한 phase 내 이벤트 + 요약 통계), `failures`(모든 gate 실패, fix 루프, 에스컬레이션 + 해결 상태), `agent <agent-name>`(한 에이전트의 모든 dispatch와 evidence), `status`(현재 run 상태 + 최근 10개 이벤트 + 활성 작업 목록).
- 엄격하게 읽기 전용입니다. 어떤 파일에도 절대 쓰지 않습니다.
- 50개 초과 결과는 30개로 제한합니다. 잘못된 JSONL 행은 건너뜁니다. 없는 상호 참조 파일은 `"(not found)"`로 표시합니다.

**스키마:** 없음 (모든 contract-engine 스키마를 읽지만 쓰지 않습니다).

---

### cleanup

엔트로피 스캔입니다. AI가 만든 불필요한 코드, 사용하지 않는 코드, 컨벤션 드리프트를 찾습니다. 발견 사항을 `.geas/state/debt-register.json`에 기록합니다. Building phase 이후 또는 Evolving 중에 실행합니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator — Phase 2 (Building) 이후, Phase 4 (Evolving) 중, 또는 사용자/Forge 명시 요청 시

**입력:**
- 모든 프로젝트 소스 파일 (`.gitignore` 준수; `node_modules`, `vendor`, `target`, `dist`, `build`, `.git` 제외)
- `.geas/memory/_project/conventions.md` — 컨벤션 드리프트 감지용 기준선

**출력:**
- `.geas/state/debt-register.json` — 발견 사항별 새 항목 추가
- 콘솔 요약 (스캔한 파일 수, 심각도별 이슈 수, 상위 3개 우선순위)

**핵심 동작:**
- 6가지 스캔 카테고리: 불필요한 주석(코드 재진술), 죽은 코드(미사용 export, 도달 불가 분기, 주석 처리된 블록), 중복(10줄 이상의 유사 코드), 과도한 추상화, 컨벤션 드리프트(네이밍, import 패턴, 파일 구조), AI 보일러플레이트(장황한 에러 처리, 불필요한 타입 어노테이션, 템플릿 잔재).
- 프로젝트 크기에 따라 스캔 깊이가 달라집니다. 소규모는 전체, 중규모는 현재 세션 변경 파일 + 코어 모듈, 대규모는 팀이 수정한 파일과 플래그된 영역만.
- 같은 근본 원인의 관련 발견 사항은 하나의 `debt-register.json` 항목으로 묶습니다. 한 파일에 주석 20개가 있다고 항목 20개를 만들지 않습니다.

**스키마:** 없음 (`.geas/state/debt-register.json`에 항목을 씁니다; 구조는 skill 내에서 정의됩니다).

---

### pivot-protocol

개발 중 언제, 어떻게 pivot할지 정의합니다.

**사용자 호출:** 불가

**호출 주체:** Orchestrator (evidence-gate의 `"pivot"` 에스컬레이션, Nova "Cut" 판정, 또는 팀원이 pivot 신호를 올릴 때)

**입력:**
- Orchestrator의 전체 컨텍스트: 뭐가 잘못됐는지, 뭘 시도했는지, 가능한 옵션
- `.geas/tasks/` — 취소하거나 재구성할 기존 TaskContract
- `.geas/decisions/` — 맥락 파악용 이전 의사결정

**출력:**
- `.geas/decisions/{dec-id}.json` — Nova의 pivot 방향과 근거가 담긴 DecisionRecord
- `.geas/tasks/` — 폐기된 TaskContract 취소; 새 접근을 위한 새 TaskContract 생성

**핵심 동작:**
- 트리거 조건: Sentinel이 핵심 기능에서 50% 이상 테스트 실패 보고, 핵심 기능이 기술적으로 불가능하다는 판단, Forge가 근본적 아키텍처 문제 발견, Nova "Cut" 판정, 여러 에이전트가 같은 우려를 제기.
- Nova가 5가지 옵션 중 pivot 유형을 결정합니다: scope cut, feature drop, approach change, push through, simplify. 누구든 pivot을 제안할 수 있습니다. 실패를 기다릴 필요 없습니다.
- pivot은 전략적 방향 전환입니다. 버그 수정, 리팩터링, 디자인 반복은 pivot이 아닙니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`
