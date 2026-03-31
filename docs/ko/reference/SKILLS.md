# Skills 레퍼런스

Geas 플러그인의 모든 22개 skill. Skill은 사용자가 직접 (`/geas:<name>`) 호출하거나, Compass가 실행 프로토콜의 일환으로 호출합니다.

## 요약 표

| Skill | 분류 | 사용자 호출 가능 | 호출 주체 | 주요 출력 |
|-------|------|----------------|-----------|-----------|
| [compass](#compass) | Entry | 아니오 | 사용자 (`/geas:mission` 경유) | 전체 세션 오케스트레이션 |
| [setup](#setup) | Entry | 아니오 | Compass (최초 실행) | `.geas/` 런타임 디렉토리 |
| [intake](#intake) | Core - Contract Engine | 아니오 | Compass | `.geas/spec/seed.json` |
| [task-compiler](#task-compiler) | Core - Contract Engine | 아니오 | Compass | `.geas/tasks/{id}.json` |
| [context-packet](#context-packet) | Core - Contract Engine | 아니오 | Compass | `.geas/packets/{task-id}/{worker}.md` |
| [implementation-contract](#implementation-contract) | Core - Contract Engine | 아니오 | Compass | `.geas/contracts/{task-id}.json` |
| [evidence-gate](#evidence-gate) | Core - Contract Engine | 아니오 | Compass | Gate 판정 + 원장 이벤트 |
| [verify-fix-loop](#verify-fix-loop) | Core - Contract Engine | 아니오 | Compass (evidence-gate 경유) | 수정 반복 + DecisionRecord |
| [verify](#verify) | Core - Verification | 아니오 | Worker 에이전트 | 콘솔 체크리스트 보고서 |
| [vote-round](#vote-round) | Core - Verification | 아니오 | Compass (Genesis 시점) | `.geas/decisions/{dec-id}.json` |
| [initiative](#initiative) | Team - Execution | 예 | Compass 또는 사용자 | 전체 제품 빌드 (4단계) |
| [sprint](#sprint) | Team - Execution | 예 | Compass 또는 사용자 | 기존 프로젝트에 기능 추가 |
| [debate](#debate) | Team - Execution | 예 | Compass 또는 사용자 | `.geas/decisions/{dec-id}.json` |
| [write-prd](#write-prd) | Team - Planning | 아니오 | Nova (Genesis 중) | `.geas/spec/prd.md` |
| [write-stories](#write-stories) | Team - Planning | 아니오 | Nova (Genesis 중) | `.geas/spec/stories.md` |
| [onboard](#onboard) | Team - Planning | 아니오 | Compass (Sprint, 최초 실행) | `.geas/memory/_project/conventions.md` |
| [coding-conventions](#coding-conventions) | Utility | 아니오 | 모든 에이전트 | 참조 가이드 전용 |
| [briefing](#briefing) | Utility | 아니오 | Nova 또는 Compass | 콘솔 상태 보고서 |
| [run-summary](#run-summary) | Utility | 아니오 | Compass (세션 종료 시) | `.geas/summaries/run-summary-<date>.md` |
| [ledger-query](#ledger-query) | Utility | 아니오 | Compass 또는 사용자 | 형식화된 쿼리 결과 (읽기 전용) |
| [cleanup](#cleanup) | Utility | 아니오 | Compass (MVP 이후 / Evolution 중) | `.geas/debt.json` 항목 |
| [pivot-protocol](#pivot-protocol) | Utility | 아니오 | Compass 또는 임의 에이전트 | `.geas/decisions/{dec-id}.json` |

---

## Entry Skills

### compass

**설명:** Geas 오케스트레이터 — 멀티 에이전트 팀을 조율합니다. 설정, intake, 모드 감지를 관리하고 initiative/sprint/debate 프로토콜에 위임합니다.

**사용자 호출 가능:** 아니오 (`/geas:mission` 경유로 호출되며, 해당 skill이 `/geas:compass`를 호출함)

**호출 주체:** 모든 사용자 요청 시 `mission` skill

**입력:**
- `.geas/state/run.json` — 재시작 또는 새 실행 여부 확인을 위해 시작 시 검사
- `.geas/spec/seed.json` — intake 후 미션 컨텍스트
- `.geas/ledger/events.jsonl` — 전환 사항 기록을 위한 이벤트 로그
- `.geas/debt.json` — 에이전트 복귀 후 기술 부채 추적

**출력:**
- `.geas/state/run.json` — 모든 에이전트 생성 전 체크포인트 업데이트
- `.geas/ledger/events.jsonl` — 모든 상태 전환에 대한 이벤트 항목
- `.geas/debt.json` — evidence bundle에서 추출된 새 기술 부채 항목

**주요 동작:**
- 모든 `Agent()` 생성 전, `pipeline_step`, `agent_in_flight`, `pending_evidence`가 포함된 체크포인트로 `.geas/state/run.json`을 읽고 씁니다. 세션 복구는 이에 의존합니다.
- 모든 에이전트 복귀 후, 예상 evidence 파일이 존재하는지 확인합니다. Evidence 누락 = 단계 실패; 한 번 재시도 후 오류를 기록합니다.
- 시작을 세 가지 모드 중 하나로 라우팅합니다: Initiative (새 제품), Sprint (경계가 있는 기능), Debate (결정 전용). 사용자 의도 또는 명시적 skill 호출로 모드를 감지합니다.

**스키마:** 직접 소유하지 않음; 하위 skill의 스키마를 읽습니다.

---

### setup

**설명:** 최초 설정 — `.geas/` 런타임 디렉토리를 초기화하고 설정 파일을 생성합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** Compass (`.geas/state/run.json`이 없을 때 최초 실행 시)

**입력:** 없음 (기존 항목 확인을 위해 `.gitignore` 읽기)

**출력:**
- `.geas/` 디렉토리 트리: `spec/`, `state/`, `tasks/`, `packets/`, `evidence/`, `decisions/`, `ledger/`, `memory/_project/`
- `.geas/state/run.json` — 초기 실행 상태 (`status: "initialized"`)
- `.geas/debt.json` — 비어 있는 기술 부채 등록부 (`{"items": []}`)
- `.geas/rules.md` — 공유 에이전트 규칙 (evidence 형식, 코드 경계)
- `.gitignore` — `.geas/` 항목이 없으면 추가

**주요 동작:**
- `mkdir -p`를 통한 멱등 디렉토리 생성 — 기존 프로젝트에서도 안전하게 호출 가능합니다.
- 모든 에이전트가 따라야 하는 기본 evidence 및 코드 규칙이 포함된 `rules.md`를 작성합니다; Scrum은 회고를 통해 이 파일을 지속적으로 업데이트합니다.
- 사용자가 직접 실행할 필요가 없습니다; Compass가 자동으로 트리거합니다.

**스키마:** 없음.

---

## Core - Contract Engine Skills

### intake

**설명:** 미션 intake 게이트 — seed spec을 확정하기 위한 협력적 탐색. 한 번에 하나씩 질문하며, 섹션별 승인 방식.

**사용자 호출 가능:** 아니오

**호출 주체:** Compass (시작 시퀀스 1단계, 모드 감지 이전)

**입력:**
- 사용자 자연어 (원시 미션 진술)
- `.geas/spec/seed.json` — 존재 여부 확인 (Sprint 변형은 파일이 이미 존재하면 생성 건너뜀)

**출력:**
- `.geas/spec/seed.json` — `schemas/seed.schema.json`에 부합하는 확정된 미션 spec

**주요 동작:**
- 한 번에 하나씩 질문하며 (절대 묶어서 묻지 않음) `mission`, `acceptance_criteria` (≥3), `scope_out` (≥1), `target_user`, `constraints`로 구성된 완성도 체크리스트를 내부적으로 추적합니다. 모두 충족되면 중단합니다.
- 범위를 확정하기 전에 트레이드오프가 있는 2~3가지 접근 방식을 제시합니다 (Initiative 모드); Sprint 모드는 접근 방식 제안을 건너뛰고 기능 범위에 대한 질문만 합니다.
- 사용자가 "그냥 만들어"라고 하면 `readiness_override: true`를 설정하고, 최선의 값으로 채운 후 진행합니다. 확정 후 범위 변경은 `pivot-protocol`을 통해야 합니다.

**스키마:** `plugin/skills/intake/schemas/seed.schema.json`

---

### task-compiler

**설명:** 사용자 스토리를 TaskContract로 컴파일합니다 — 검증 가능한 인수 기준, 경로 경계, 평가 명령이 포함된 기계 판독 가능한 작업 합의서.

**사용자 호출 가능:** 아니오

**호출 주체:** Initiative 중 Compass (Genesis 단계, 1.6단계) 및 Sprint (1단계)

**입력:**
- 사용자 스토리 또는 기능 설명
- `.geas/spec/seed.json` — 미션 수준 컨텍스트
- `.geas/memory/_project/conventions.md` — 빌드/린트/테스트 명령
- `.geas/tasks/` — 의존성 확인 및 ID 순서 지정을 위한 기존 계약

**출력:**
- `.geas/tasks/{id}.json` — `schemas/task-contract.schema.json`에 부합하는 TaskContract
- `.geas/ledger/events.jsonl` — `task_compiled` 이벤트 추가

**주요 동작:**
- 작업 유형에 따라 worker와 reviewer를 할당하고 (프론트엔드 → Pixel/Forge, 백엔드 → Circuit/Forge, 디자인 → Palette/Forge 등) worker가 수정해서는 안 되는 `prohibited_paths`를 설정합니다.
- 품질 차원과 임계값이 있는 `rubric` 배열을 생성합니다: 모든 작업에 적용되는 기본 차원 (`core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`), UI 작업에는 `ux_clarity`와 `visual_coherence` 추가.
- `conventions.md`에서 eval 명령을 읽으며; 없으면 프로젝트 설정 파일 (package.json, Makefile, pyproject.toml)에서 감지합니다.

**스키마:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

---

### context-packet

**설명:** worker를 위한 역할별 ContextPacket 생성 — 집중적이고 관련성 높은 컨텍스트만 담은 압축된 브리핑.

**사용자 호출 가능:** 아니오

**호출 주체:** 작업에 대한 worker 파견 전 Compass

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract
- `.geas/evidence/{task-id}/` — 상위 worker 출력
- `.geas/decisions/` — 관련 결정 기록
- `.geas/spec/seed.json` — 미션 컨텍스트
- `.geas/contracts/{task-id}.json` — implementation contract (Forge와 Sentinel 패킷용)
- `.geas/debt.json` — 작업과 관련된 미해결 기술 부채 항목

**출력:**
- `.geas/packets/{task-id}/{worker-name}.md` — 역할에 맞춤화된 마크다운 브리핑 (목표: 200줄 미만)

**주요 동작:**
- 각 worker 유형은 자신의 역할에 관련된 컨텍스트만 받습니다: Palette는 디자인 제약과 목표 사용자 컨텍스트를 받고; Pixel/Circuit은 디자인 spec과 eval 명령을 받으며; Forge는 변경된 파일과 worker의 `self_check.known_risks`를 받고; Sentinel은 implementation contract의 `demo_steps`와 `edge_cases`, 그리고 사용 가능한 QA 도구를 받습니다.
- Sentinel 패킷에는 실제로 연결된 도구만 나열하는 `## QA Tools Available` 섹션 (`.geas/config.json` 기준)과 평가자가 점수를 매겨야 하는 차원을 나열하는 `## Rubric Scoring` 섹션이 포함됩니다.
- 사람이 확인한 결정은 결정 기록에서 추출할 때 최우선 순위를 갖습니다.

**스키마:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

---

### implementation-contract

**설명:** 구현 전 합의 — worker가 구체적인 실행 계획을 제안하고, 코딩 시작 전 Sentinel과 Forge가 승인합니다. 잘못된 요구사항 이해로 인한 낭비적인 구현 사이클을 방지합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** 모든 작업에 대해 Tech Guide (Forge) 이후와 구현 이전에 Compass

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract
- `.geas/packets/{task-id}/{worker}.md` — worker의 ContextPacket
- `.geas/evidence/{task-id}/palette.json`, `.geas/evidence/{task-id}/forge.json` — 이전 디자인 및 tech guide evidence (있는 경우)

**출력:**
- `.geas/contracts/{task-id}.json` — `schemas/implementation-contract.schema.json`에 부합하는 implementation contract (필드: `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`, `status`)
- `.geas/ledger/events.jsonl` — `approved` 또는 `revision_requested`와 함께 `implementation_contract` 이벤트

**주요 동작:**
- 3단계 프로세스: worker가 계약 초안 작성 → Sentinel이 QA 커버리지 검토 (`demo_steps`는 모든 인수 기준을 포함해야 함) → Forge가 기술적 실행 가능성 검토. 둘 다 승인해야 구현이 시작됩니다.
- 한 번의 수정 사이클을 허용하며; 이후 Forge가 최종 결정을 내리고 구현이 진행됩니다.
- `demo_steps`는 모든 인수 기준을 포함해야 합니다 — 기준에 대한 커버리지가 없는 계약은 불완전한 것으로 간주됩니다.

**스키마:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

---

### evidence-gate

**설명:** 3단계 품질 게이트 — EvidenceBundle을 해당 TaskContract에 대해 평가합니다. 기계적 (빌드/린트/테스트), 시맨틱 (인수 기준 + rubric), 제품 (Nova 판단).

**사용자 호출 가능:** 아니오

**호출 주체:** 각 구현, 코드 리뷰, 또는 QA 단계 이후 Compass

**입력:**
- `.geas/evidence/{task-id}/{worker-name}.json` — EvidenceBundle
- `.geas/tasks/{task-id}.json` — TaskContract (인수 기준, eval 명령, rubric, 재시도 예산)

**출력:**
- Gate 판정 (pass/fail/iterate) 및 단계별 분석
- `.geas/tasks/{task-id}.json` — pass 시 상태를 `"passed"`로 업데이트
- `.geas/ledger/events.jsonl` — 단계별 결과가 포함된 상세 `gate_result` 이벤트
- `.geas/decisions/{dec-id}.json` — 에스컬레이션 시 DecisionRecord
- 실패 시 `verify-fix-loop` 트리거 (재시도 예산이 남은 경우)

**주요 동작:**
- Tier 1 (기계적): TaskContract의 각 `eval_command`를 실제로 실행하고 종료 코드를 기록합니다. 통과를 가정하지 않습니다. 첫 번째 실패 시 중단합니다.
- Tier 2 (시맨틱): worker evidence에서 각 인수 기준을 확인한 후, Forge와 Sentinel의 `rubric_scores`에서 rubric 차원 점수를 매깁니다. 모든 차원이 임계값을 충족해야 합니다; worker의 `self_check.confidence`가 ≤ 2이면 모든 임계값을 1 높입니다.
- Tier 3 (제품): Nova를 생성하여 Ship/Iterate/Cut 판정을 받습니다; 기능 완성, 단계 완성, 또는 pivot 결정에만 트리거되며 — 중간 단계에는 트리거되지 않습니다.

**스키마:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`, `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

### verify-fix-loop

**설명:** Verify-Fix Loop — 경계가 있는 수정-검증 내부 루프. TaskContract에서 재시도 예산을 읽고, 반복마다 EvidenceBundle을 생성하며, 에스컬레이션 시 DecisionRecord를 작성합니다. 최대 반복 횟수는 계약에 따르며 (기본값 3).

**사용자 호출 가능:** 아니오

**호출 주체:** Compass (evidence-gate 실패 시 트리거)

**입력:**
- `.geas/tasks/{task-id}.json` — TaskContract (재시도 예산, 에스컬레이션 정책)
- `.geas/evidence/{task-id}/sentinel.json` — 구체적인 실패가 포함된 실패한 EvidenceBundle
- Gate 판정 — 어느 단계가 왜 실패했는지 (`blocking_dimensions` from rubric 포함)

**출력:**
- `.geas/packets/{task-id}/{fixer}-fix-{N}.md` — 반복당 수정 전용 ContextPacket
- `.geas/evidence/{task-id}/{fixer}-fix-{N}.json` — 각 수정 시도의 EvidenceBundle
- `.geas/decisions/{dec-id}.json` — 예산 소진 시 DecisionRecord
- `.geas/ledger/events.jsonl` — 에스컬레이션 이벤트

**주요 동작:**
- 각 반복: 적절한 수정 담당자를 생성하고 (프론트엔드 버그는 Pixel, 백엔드는 Circuit) worktree 격리로 실행하며, worktree 브랜치를 병합한 후 evidence-gate (Tier 1 + Tier 2)를 다시 실행합니다.
- 수정 전용 ContextPacket에는 rubric 평가의 `blocking_dimensions`가 포함되어 수정 담당자가 어떤 품질 임계값이 실패했는지 정확히 알 수 있습니다.
- 재시도 예산이 소진되면, TaskContract의 `escalation_policy`를 따릅니다: `forge-review` (수정 가능하면 한 번 더 시도하는 아키텍처 분석), `nova-decision` (전략적 방향), 또는 `pivot` (pivot-protocol 호출).

**스키마:** `task-contract.schema.json`을 읽고; `decision-record.schema.json`을 씁니다.

---

## Core - Verification Skills

### verify

**설명:** 구조화된 검증 체크리스트 — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. 완료를 선언하기 전에 코드 품질을 확인하기 위해 호출합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** Worker 에이전트 (Pixel, Circuit, Forge, Sentinel) 완료 게시 전

**입력:**
- `.geas/memory/_project/conventions.md` — 프로젝트별 명령 (프로젝트 설정 파일 감지로 대체)
- 스택 감지를 위한 프로젝트 루트 마커 파일 (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`)

**출력:**
- 콘솔 체크리스트 보고서 (파일 작성 없음)

**주요 동작:**
- 순서대로 5개 항목 체크리스트: BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. VERDICT는 모든 항목이 PASS인 경우에만 PASS (PENDING 및 SKIP은 차단하지 않음); 특정 파일/라인 세부 정보와 함께 항목 실패 시 FAIL.
- Forge 사전 점검 모드는 BUILD + LINT만 실행합니다 — Sentinel의 전체 QA로 넘기기 전의 빠른 게이트.
- FUNCTIONALITY는 Sentinel의 영역입니다 (브라우저 자동화 MCP를 통한 E2E); 다른 에이전트는 직접 실행하는 대신 `PENDING (Sentinel E2E)`으로 표시합니다.

**스키마:** 없음.

---

### vote-round

**설명:** 구조화된 검토 프로토콜 — Forge가 제안하고, Critic이 도전하며, Compass가 종합하고, 사용자가 확인합니다. DecisionRecord를 생성합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** 주요 아키텍처 또는 횡단 관심사 결정 시 Compass (주로 Genesis 단계 1.5)

**입력:**
- Forge의 제안 (`.geas/decisions/pending/{proposal-id}.md`에 저장)
- 지정된 Critic 에이전트의 도전 (동일 파일에 추가)

**출력:**
- `.geas/decisions/{dec-id}.json` — `schemas/decision-record.schema.json`에 부합하는 DecisionRecord
- 해결 후 `.geas/decisions/pending/{proposal-id}.md` 정리

**주요 동작:**
- 4단계 프로세스: Forge가 구조화된 제안 작성 (무엇 / 왜 / 트레이드오프 / 대안) → Critic이 구조화된 도전 작성 (평가 / 우려 사항 / 대안 / 권고) → Compass가 둘 다 종합하고 사용자에게 옵션 제시 → 사용자 확인 또는 자율 모드에서 Compass 자동 결정.
- 아키텍처/기술 스택 제안 및 디자인 시스템 결정에 트리거됩니다; 개별 기능 spec, 기능별 tech guide, 버그 수정, 또는 사소한 리팩토링에는 트리거되지 않습니다.
- Critic 참여는 필수입니다 — 제안이 명백해 보여도 Critic 단계를 건너뛰는 것은 허용되지 않습니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Execution Skills

### initiative

**설명:** Geas 팀으로 새 제품 시작 — Genesis, MVP Build, Polish, Evolution.

**사용자 호출 가능:** 예 (`/geas:initiative`)

**호출 주체:** Compass (모드 감지 후) 또는 사용자 직접

**입력:**
- `.geas/spec/seed.json` — intake에서 확정된 미션 spec
- `.geas/tasks/` — MVP Build 순서를 위한 컴파일된 TaskContract

**출력 (단계별):**
- Genesis: `.geas/evidence/genesis/nova.json`, `.geas/spec/prd.md`, `.geas/spec/stories.md`, `.geas/evidence/genesis/forge.json`, `.geas/decisions/dec-001.json`, `.geas/tasks/*.json`
- MVP Build (작업별): 전체 evidence 체인 — `palette.json`, `forge.json`, `contracts/{id}.json`, `{worker}.json`, `forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`, `memory/retro/{id}.json`
- Polish: `.geas/evidence/polish/shield.json`, `.geas/evidence/polish/scroll.json`
- Evolution: `.geas/evidence/evolution/nova-final.json`, `.geas/evidence/evolution/keeper-release.json`, `.geas/summaries/run-summary-<date>.md`

**주요 동작:**
- 모든 MVP 작업은 전체 11단계 파이프라인을 실행합니다 (Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critic Review → Nova Review → Retrospective → Resolve). 코드 리뷰와 테스팅은 예외 없이 필수입니다.
- Ship Gate는 작업을 통과로 표시하기 전에 4개의 필수 evidence 파일을 강제합니다: `forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`. 파일이 없으면 해당 단계 실행이 트리거됩니다.
- Scrum 회고는 사소한 작업이라도 모든 작업 후 필수입니다. `.geas/memory/retro/{task-id}.json`을 생성하며; 파일이 없으면 한 번 재시도가 트리거됩니다.

**스키마:** 모든 contract-engine 스키마를 읽고 씁니다.

---

### sprint

**설명:** Geas 팀으로 기존 프로젝트에 경계가 있는 기능 추가 — Design, Build, Review, QA.

**사용자 호출 가능:** 예 (`/geas:sprint`)

**호출 주체:** Compass (모드 감지 후) 또는 사용자 직접

**입력:**
- `.geas/spec/seed.json` — 읽기 전용 프로젝트 컨텍스트 (Sprint는 파일이 존재한 후 절대 수정하지 않음)
- `.geas/memory/_project/conventions.md` — 없으면 Forge가 먼저 온보딩 실행

**출력:**
- `.geas/tasks/{id}.json` — 기능을 위한 단일 TaskContract
- Initiative MVP Build와 동일한 전체 evidence 체인 (작업별)
- `.geas/summaries/run-summary-<date>.md` — 세션 감사 추적

**주요 동작:**
- Genesis를 완전히 건너뜁니다 (PRD 없음, 스토리 없음, 아키텍처 투표 없음). 기능 설명에서 직접 단일 TaskContract를 컴파일합니다.
- Initiative MVP Build와 동일한 11단계 파이프라인을 실행합니다. Ship Gate, Critic Review, Nova Review, Scrum 회고 모두 필수입니다.
- `.geas/memory/_project/conventions.md`가 없으면 (알 수 없는 프로젝트의 첫 번째 Sprint), Compass가 파이프라인 시작 전 `onboard` skill을 실행하도록 Forge를 생성합니다.

**스키마:** 모든 contract-engine 스키마를 읽고 씁니다.

---

### debate

**설명:** 구현 전 기술 또는 제품 결정을 내리기 위한 구조화된 멀티 에이전트 토론 실행.

**사용자 호출 가능:** 예 (`/geas:debate`)

**호출 주체:** Compass (모드 감지 후) 또는 사용자 직접

**입력:**
- 사용자의 질문 또는 결정 프레임 (자연어)

**출력:**
- `.geas/decisions/{dec-id}.json` — 선택된 방향이 담긴 DecisionRecord

**주요 동작:**
- 코드가 생성되지 않습니다. 전체 출력은 DecisionRecord입니다.
- 4명의 토론자를 병렬로 생성합니다: Forge (기술적 근거로 옵션 A 주장), Critic (옵션 A 도전 / 옵션 B 주장), Circuit (백엔드/확장성 관점), Palette (UX/프론트엔드 관점).
- Compass가 입장을 종합하고 트레이드오프를 제시하며 사용자에게 최종 결정을 요청한 후 DecisionRecord를 작성합니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Planning Skills

### write-prd

**설명:** 기능 아이디어 또는 미션에서 제품 요구사항 문서를 작성합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** Genesis 중 Nova (Initiative 단계 1.3)

**입력:**
- `$ARGUMENTS` — 기능 아이디어, 문제 진술, 또는 미션
- `.geas/spec/seed.json` — 미션 컨텍스트 및 수락된 범위

**출력:**
- `.geas/spec/prd.md` — 구조화된 PRD (문제, 목표, 목표 사용자, 범위 내/외, 사용자 플로우, 기능/비기능 요구사항, 성공 지표, 미결 질문)

**주요 동작:**
- 표준 섹션 순서가 있는 구조화된 마크다운 문서로 출력을 형식화합니다 — 문제에서 미결 질문까지.
- 요구사항을 사용자 필요사항에 추적 가능하게 유지합니다; 모든 요구사항은 명확한 사용자 동기를 가져야 합니다.
- 실행 중 범위 확장을 방지하기 위해 범위 외의 내용을 명시합니다.

**스키마:** 없음.

---

### write-stories

**설명:** 기능 또는 미션을 인수 기준이 있는 사용자 스토리로 분해합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** Genesis 중 Nova (Initiative 단계 1.3), write-prd 직후

**입력:**
- `$ARGUMENTS` — 기능 설명, 미션 진술, 또는 해결할 문제
- `.geas/spec/prd.md` — 입력 컨텍스트로 사용되는 PRD 출력

**출력:**
- `.geas/spec/stories.md` — 표준 형식의 순서가 있는 사용자 스토리 (~로서 / ~하고 싶다 / ~하기 위해 + 인수 기준 + 우선순위 + 추정치)

**주요 동작:**
- 각 스토리는 독립적이어야 하고 (단독으로 배포 가능) 테스트 가능해야 합니다 (구체적이고 검증 가능한 인수 기준).
- 스토리는 우선순위로 순서가 정해집니다 (P0 먼저). 3~5개 이상의 인수 기준이 필요한 스토리는 분할해야 합니다.
- 인수 기준에는 엣지 케이스 포함 (빈 상태, 오류 상태, 최대 한도) — 해피 패스만이 아님.

**스키마:** 없음.

---

### onboard

**설명:** 코드베이스 탐색 프로토콜 — 프로젝트 구조 스캔, 스택 감지, 아키텍처 매핑. Sprint 모드에서 기존 상태가 없을 때 자동으로 사용됩니다.

**사용자 호출 가능:** 아니오

**호출 주체:** `.geas/memory/_project/conventions.md`가 없을 때 Sprint 모드에서 Compass

**입력:**
- 프로젝트 루트 파일: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`
- 소스 디렉토리 구조 (프로젝트 크기에 따라 깊이 다름)

**출력:**
- `.geas/memory/_project/conventions.md` — 스택, 빌드 명령, 주요 경로, 아키텍처 노트, 네이밍 규칙
- `.geas/memory/_project/state.json` — 온보드 메타데이터 (모드, 단계, 프로젝트 크기, 스택 요약)

**주요 동작:**
- Forge만 실행합니다 (단일 에이전트, 병렬 아님). 읽기 전용 정찰 — 코드 변경 없음.
- 스캔 깊이는 프로젝트 크기에 적응합니다: 소규모 (~50개 파일)는 전체 스캔, 중규모 (50~500개 파일)는 `src/`와 진입점에 집중 스캔, 대규모 (500개 이상 파일)는 관련 디렉토리 대상 스캔.
- 두 번째 Sprint 동작: `conventions.md`가 이미 존재하면 온보딩을 완전히 건너뜁니다. Compass가 직접 읽고 Sprint 실행을 진행합니다.

**스키마:** 없음.

---

## Utility Skills

### coding-conventions

**설명:** AI 스타트업 워크스페이스를 위한 범용 코딩 표준 — 스택 불문.

**사용자 호출 가능:** 아니오

**호출 주체:** 모든 에이전트가 상시 가이드라인으로 참조하며; 파이프라인의 단계로 호출되지 않음

**입력:** 없음

**출력:** 없음 (참조 문서만 — 파일 작성 없음)

**주요 동작:**
- 스택에 관계없이 적용되는 범용 표준을 정의합니다: TypeScript 엄격 모드 (해당하는 경우), `any` 타입 금지, 함수/컴포넌트당 단일 책임, 우아한 오류 처리, 원자적 git 커밋, 모바일 우선 접근 가능한 UI.
- 기술 스택 자체는 여기에서 사전 정의되지 않습니다 — Forge가 제안하고, Nova가 검증하며, Compass가 확인하고, 결정은 DecisionRecord로 기록됩니다. 그런 다음 Forge가 프로젝트별 `conventions.md`를 작성합니다.
- `conventions.md`가 확장하고 전문화하는 기준선 역할을 합니다.

**스키마:** 없음.

---

### briefing

**설명:** Nova 아침 브리핑 — 배포된 내용, 차단된 내용, 사람의 주의가 필요한 내용에 대한 구조화된 상태 보고서.

**사용자 호출 가능:** 아니오

**호출 주체:** Nova (마일스톤 시, Evolution 시작 시, 또는 Compass/사람 요청 시)

**입력:**
- `.geas/state/run.json` — 현재 단계 및 미션
- `.geas/tasks/` — 상태별로 그룹화된 TaskContract
- `.geas/evidence/` — 최근 활동 및 gate 결과
- 이전 브리핑 (델타 추적용)

**출력:**
- 콘솔 출력만 (파일 작성 없음)

**주요 동작:**
- 고정된 5섹션 형식: 배포된 내용, 차단된 내용, 사람의 주의 필요, 제품 상태 (미션 정렬 / 품질 / 속도 / 사용자 가치), 다음 우선순위. 60초 이내에 읽을 수 있어야 합니다.
- 제품 상태에는 가장 최근 테스트 실행에서 Sentinel의 통과율이 포함됩니다; Nova는 주관적인 사용자 가치 평가를 합니다 ("사용자가 이제 X를 할 수 있습니다").
- 모든 차단 항목에는 제안된 조치가 포함됩니다 — 브리핑은 단순한 설명이 아닌 실행 가능합니다.

**스키마:** 없음.

---

### run-summary

**설명:** 세션 종료 요약 생성 — 결정, 완료된 이슈, 에이전트 통계, verify-fix 루프. 콘솔과 `.geas/` 파일로 출력.

**사용자 호출 가능:** 아니오

**호출 주체:** Initiative (Evolution 단계) 및 Sprint 종료 시 Compass, 또는 사람 요청 시

**입력:**
- `.geas/state/run.json` — 단계, 모드, 미션
- `.geas/memory/_project/agent-log.jsonl` — 에이전트 생성 기록
- `.geas/tasks/` — TaskContract 상태
- `.geas/decisions/` — 이번 세션에서 만든 DecisionRecord
- `.geas/ledger/events.jsonl` — gate 결과, 수정 루프, 에스컬레이션
- `.geas/ledger/costs.jsonl` — 에이전트 생성 비용 (선택 사항)
- `.geas/debt.json` — 기술 부채 상태 (선택 사항)

**출력:**
- `.geas/summaries/run-summary-<YYYY-MM-DD>.md` — 세션 감사 추적
- 콘솔 출력 (파일 내용과 동일)

**주요 동작:**
- 다음 내용을 포함합니다: 결정 사항, 완료된 이슈 (verify-fix 루프 횟수 포함), 진행 중인 이슈, 이름별 생성된 에이전트, 미결 작업.
- `costs.jsonl`이 존재하면 비용 보고서 표 (에이전트, 모델, 단계, 작업별 생성 횟수)를, `debt.json`이 존재하면 기술 부채 보고서 (심각도별 미결, 이번 세션의 신규 및 해결)를 포함합니다.
- 같은 날 여러 요약은 순서 접미사를 붙입니다: `run-summary-2026-03-21-2.md`.

**스키마:** 없음.

---

### ledger-query

**설명:** `.geas/ledger/events.jsonl`에 대한 구조화된 검색 — 작업, 단계, 에이전트, 또는 실패별 쿼리. TaskContract, EvidenceBundle, DecisionRecord를 교차 참조합니다. 읽기 전용, 절대 상태를 수정하지 않음.

**사용자 호출 가능:** 아니오

**호출 주체:** 진단, 상태 확인, 기록 검토를 위해 Compass 또는 사람

**입력 (읽기 전용):**
- `.geas/ledger/events.jsonl` — 기본 이벤트 로그
- `.geas/tasks/{id}.json` — 계약 상태 교차 참조
- `.geas/evidence/{task-id}/{worker}.json` — evidence 파일 교차 참조
- `.geas/decisions/{id}.json` — 결정 기록 교차 참조
- `.geas/state/run.json`, `.geas/spec/seed.json` — `status` 쿼리 유형용

**출력:**
- 콘솔에 출력된 형식화된 마크다운 쿼리 결과 (파일 작성 없음)

**주요 동작:**
- 5가지 쿼리 유형: `timeline <task-id>` (한 작업의 모든 이벤트를 시간순으로), `phase <phase-name>` (단계 내 모든 이벤트와 요약 통계), `failures` (모든 gate 실패, 수정 루프, 에스컬레이션 및 해결 상태), `agent <agent-name>` (한 에이전트의 모든 파견 및 evidence), `status` (마지막 10개 이벤트와 활성 작업 목록이 포함된 현재 실행 상태).
- 완전한 읽기 전용 — 이 skill은 어떤 상황에서도 어떤 파일에도 쓰지 않습니다.
- 50개 이상 반환되는 쿼리는 출력을 30개 이벤트로 제한합니다; 잘못된 형식의 JSONL 줄은 건너뜁니다; 교차 참조 파일이 없으면 실패하는 대신 `"(not found)"`를 표시합니다.

**스키마:** 없음 (모든 contract-engine 스키마를 읽지만 쓰지 않음).

---

### cleanup

**설명:** 엔트로피 스캔 — AI 슬롭, 사용하지 않는 코드, 규칙 위반 감지. `.geas/debt.json`에 결과를 기록합니다. MVP 이후 또는 Evolution 중에 호출합니다.

**사용자 호출 가능:** 아니오

**호출 주체:** Phase 2 (MVP) 이후, Phase 4 (Evolution) 중, 또는 사람이나 Forge의 명시적 요청 시 Compass

**입력:**
- 모든 프로젝트 소스 파일 (`.gitignore` 준수; `node_modules`, `vendor`, `target`, `dist`, `build`, `.git` 건너뜀)
- `.geas/memory/_project/conventions.md` — 규칙 위반 감지를 위한 기준선

**출력:**
- `.geas/debt.json` — 각 발견 사항에 대한 새 항목 추가
- 콘솔 요약 (스캔된 파일, 심각도별 이슈 수, 상위 3개 우선순위)

**주요 동작:**
- 6가지 스캔 카테고리: 불필요한 주석 (코드 재진술), 사용하지 않는 코드 (미사용 export, 도달할 수 없는 브랜치, 주석 처리된 블록), 중복 (파일 간 10줄 이상의 실질적으로 유사한 코드), 과도한 추상화, 규칙 위반 (네이밍, import 패턴, 파일 구조), AI 보일러플레이트 (장황한 오류 처리, 중복 타입 어노테이션, 템플릿 잔재).
- 스캔 깊이는 프로젝트 크기에 따라 조정됩니다: 소규모 프로젝트는 전체 스캔; 중규모는 현재 Sprint에서 변경된 파일과 핵심 모듈; 대규모는 팀이 수정한 파일과 표시된 영역만.
- 동일한 근본 원인을 가진 관련 발견 사항은 하나의 `debt.json` 항목으로 그룹화됩니다 (한 파일의 주석 20개에 대해 20개의 항목 대신).

**스키마:** 없음 (`.geas/debt.json`에 항목을 작성하며; 구조는 skill에서 정의됨).

---

### pivot-protocol

**설명:** 제품 개발 중 언제, 어떻게 pivot할지.

**사용자 호출 가능:** 아니오

**호출 주체:** Compass (evidence-gate 에스컬레이션 정책 `"pivot"`, Nova "Cut" 판정, 또는 팀원이 pivot 신호를 제기할 때 트리거)

**입력:**
- Compass의 전체 컨텍스트: 무엇이 잘못되었는지, 무엇을 시도했는지, 사용 가능한 옵션
- `.geas/tasks/` — 취소 또는 재구성할 기존 TaskContract
- `.geas/decisions/` — 컨텍스트를 위한 이전 결정

**출력:**
- `.geas/decisions/{dec-id}.json` — Nova의 선택된 pivot 방향과 근거가 담긴 DecisionRecord
- `.geas/tasks/` — 삭제된 TaskContract는 취소됨; 새 접근 방식을 위한 새 TaskContract 생성

**주요 동작:**
- 트리거 조건: Sentinel이 핵심 기능에 대해 50% 이상의 테스트 실패 보고, 핵심 기능이 기술적으로 불가능하다고 선언, Forge가 근본적인 아키텍처 문제 발견, Nova가 "Cut" 판정 발행, 또는 여러 에이전트가 동일한 우려를 제기.
- Nova가 5가지 옵션 중 pivot 유형을 결정합니다: 범위 축소, 기능 삭제, 접근 방식 변경, 계속 진행, 또는 단순화. 모든 팀원이 pivot을 제안할 수 있습니다 — 실패를 기다릴 필요 없습니다.
- Pivot은 전략적 방향 변경이지 코드 수정이 아닙니다. 버그 수정, 리팩토링, 디자인 반복은 pivot이 아닙니다.

**스키마:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`
