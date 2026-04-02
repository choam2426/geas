# Geas 아키텍처

## 1. 개요

Geas는 멀티 에이전트 AI 개발을 위한 계약 기반 거버넌스 프로토콜이다. 여러 AI 에이전트를 구조화된 프로토콜로 조율하며, 네 가지 제어 목적(4 Pillars)을 보장한다:

- **Governance** — 모든 의사결정은 명시적 권한이 있는 정해진 절차를 따른다.
- **Traceability** — 모든 행동은 기록되고 사후에 감사할 수 있다.
- **Verification** — 모든 산출물은 계약 대비 검증된다. "완료"란 "계약 충족"이다.
- **Evolution** — 팀은 세션을 거듭하며 retrospective, rule update, memory promotion, debt tracking, gap assessment를 통해 성장한다.

멀티 에이전트의 가치는 에이전트 수가 아니다. "에이전트가 끝났다고 말하면 끝"이 아니라, 근거 기반 검증으로 대체한다는 데 있다. Contract Engine이 불변 핵심이고, 에이전트, 협업 표면, 도구는 전부 교체 가능하다.

설계 결정을 내릴 때는 항상 이렇게 물어야 한다: **"이 변경이 멀티 에이전트 프로세스를 더 통제 가능하고, 추적 가능하고, 검증 가능하고, 학습 가능하게 만드는가?"**

> 4 Pillars의 구체적 protocol binding과 설계 원칙은 `protocol/00_PROTOCOL_FOUNDATIONS.md` 참조.

---

## 2. 4계층 아키텍처

```
+---------------------------+
| Collaboration Surface     |  <-- 교체 가능 (Dashboard, CLI, ...)
+---------------------------+
| Agent Teams               |  <-- 교체 가능 (Geas-12, Lean-4, Custom)
+---------------------------+
| Contract Engine           |  <-- 핵심 (불변)
+---------------------------+
| Tool Adapters             |  <-- 교체 가능 (Claude Code, ...)
+---------------------------+
```

| 계층 | 역할 | 교체 가능 여부 |
|-------|------|----------------|
| **Collaboration Surface** | 사람이 시스템과 상호작용하는 인터페이스. 대시보드, CLI, 채팅 스레드 등. | 완전 교체 가능. |
| **Agent Teams** | 작업을 수행하는 전문 에이전트 집합. 기본 Geas-12 팀은 하나의 구성이며, 다른 팀 구성도 가능하다. | 교체 가능. Contract Engine의 데이터 흐름은 어떤 에이전트 구성에서도 동작한다. |
| **Contract Engine** | 작업 흐름을 정의하는 핵심 스킬 모음: intake, task compilation, context packet, implementation contract, evidence gate, verify-fix loop, vote round. 도구에 의존하지 않는다. | **교체 불가** — 이것이 불변 핵심이다. |
| **Tool Adapters** | 에이전트가 작업할 때 쓰는 런타임 도구들(파일 I/O, bash, MCP 서버 등). | 완전 교체 가능. 코어 스킬은 기능 카테고리로 도구를 참조한다. |

---

## 3. 실행 모델

### Mission Phase

Mission은 4개 phase를 거친다:

```
specifying ──[gate 1]──> building ──[gate 2]──> polishing ──[gate 3]──> evolving
                                                                           │
                                                                       [gate 4]
                                                                           │
                                                                         close
```

모든 phase가 항상 실행된다. 규모만 요청에 따라 조절 — 기능 하나면 가볍게, 풀 프로덕트면 풀코스.

Decision은 코드 변경 없이 구조적 의사결정을 수행하는 유틸리티 스킬(`decision/`)이다. 별도 실행 모드가 아니다.

> mission/phase 상세는 `protocol/02_MODES_MISSIONS_AND_RUNTIME.md` 참조.

---

## 4. Task Lifecycle

task는 프로토콜에서 유일한 closure 단위다. 7개 주요 상태와 4개 보조 상태를 거친다:

```
drafted → ready → implementing → reviewed → integrated → verified → passed
                                                                (+ blocked, escalated, cancelled, paused[scheduler flag])
```

각 전이에는 필수 artifact가 있다:

| 전이 | 필수 artifact |
|------|--------------|
| drafted → ready | task-contract.json |
| ready → implementing | implementation-contract.json (승인됨) |
| implementing → reviewed | worker-self-check.json + specialist-review.json |
| reviewed → integrated | integration-result.json |
| integrated → verified | gate-result.json (pass) |
| verified → passed | closure-packet.json + final-verdict.json (pass) |

> Task 상태 머신, 전이 조건, rewind 규칙 상세는 `protocol/03_TASK_MODEL_AND_LIFECYCLE.md` 참조.

---

## 5. 검증 흐름

```
Implementation
    │
    v
Evidence Gate (Tier 0 → Tier 1 → Tier 2)
    │                          │
    │ pass                     │ fail → Verify-Fix Loop (retry_budget 차감)
    v
Closure Packet 조립
    │
    v
Critical Reviewer Challenge (high/critical 필수)
    │
    v
Final Verdict (product_authority: pass / iterate / escalate)
    │
    v
Resolve → passed
```

- **Tier 0** (Precheck): artifact 존재, task state 적합성, baseline 확인
- **Tier 1** (Mechanical): build/lint/test/typecheck
- **Tier 2** (Contract + Rubric): acceptance criteria, rubric scoring (1-5점, dimension별 threshold)
- **block**: 구조적 전제 조건 미충족 (retry_budget 미차감)
- **fail**: 품질 문제 (retry_budget 1 차감, verify-fix loop)
- **Final Verdict iterate**: 제품 판단 (retry_budget 미차감, 3회 누적 시 escalated)

> Evidence Gate, rubric scoring, vote round, closure packet, final verdict 상세는 `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md` 참조.

---

## 6. Memory와 Evolution

Geas의 핵심 차별점은 **팀이 세션을 넘어 학습한다**는 것이다.

### Memory 시스템

memory는 저장소가 아니라 **행동 변경 장치**다. rules.md, agent_memory, risk_memory, context packet을 통해 다음 task의 행동을 바꾼다.

9개 상태로 이루어진 lifecycle:

```
candidate → provisional → stable → canonical
                ↕               ↕
           under_review    under_review
                ↓               ↓
        decayed / superseded / archived / rejected
```

승격 조건:
- candidate → provisional: evidence 2+ OR incident 2+ OR authority 승인
- provisional → stable: application log 3+, contradiction 0, authority review
- stable → canonical: application log 5+ across 3+ tasks, joint approval

### Evolution 루프

매 task 완료 후:
1. **Retrospective**: process_lead가 교훈, rule/memory/debt candidate 추출
2. **Rules.md Update**: 검증된 교훈을 팀 규칙으로 승격
3. **Memory Promotion**: candidate → provisional → stable → canonical
4. **Debt Tracking**: 부채 기록, 분류, phase별 해소
5. **Gap Assessment**: scope_in vs scope_out 비교, 미달 항목 forward-feed

> Memory 상세는 `protocol/07`, `08`, `09` 참조. Evolution 루프 상세는 `protocol/14` 참조.

---

## 7. 컨텍스트 소실 방어

오래 실행되는 세션은 컨텍스트 윈도우 한계에 부딪힌다. Geas는 두 가지 방어책을 쓴다:

### 방어 1: run.json checkpoint

`remaining_steps[]` 배열이 현재 파이프라인 위치를 디스크에 외부화한다. 단계가 끝날 때마다 배열에서 제거된다. 압축 후에도 이 파일을 읽으면 다음 단계를 정확히 알 수 있다.

### 방어 2: PostCompact 훅

컨텍스트 압축 시 자동으로 `run.json`을 읽어 현재 상태(phase, task, remaining_steps, rules.md 핵심)를 대화에 재주입한다.

> Session recovery 상세는 `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` 참조.

---

## 8. 플러그인 구조

```
plugin/
  plugin.json              # 매니페스트
  skills/                    # 공유 스킬 (27개)
    # --- Contract Engine (핵심) ---
    intake/                  # 소크라테스식 요구사항 수집
    task-compiler/           # seed → TaskContract
    context-packet/          # 역할별 브리핑
    implementation-contract/ # 구현 전 합의
    evidence-gate/           # Tier 0/1/2 검증
    verify-fix-loop/         # 실패 → 수정 → 재검증
    vote-round/              # 구조화된 투표
    verify/                  # 검증 유틸리티
    # --- 실행 ---
    orchestrating/           # 오케스트레이터: 4-phase 미션 파이프라인
      references/
        specifying.md        # Specifying phase 절차
        pipeline.md          # 작업별 14단계 파이프라인
        building.md          # Building phase 관리
        polishing.md         # Polishing phase 절차
        evolving.md          # Evolving phase 절차
    scheduling/              # 작업 스케줄링 및 병렬화
    decision/                # 구조적 의사결정 (유틸리티 스킬)
    mission/                 # 미션 lifecycle 관리
    # --- Memory & Evolution ---
    memorizing/              # Memory 수집 및 승격
    conformance-checking/    # 프로토콜 적합성 점검
    # --- 지원 ---
    briefing/                # 에이전트 브리핑 조립
    onboard/                 # 프로젝트 온보딩
    setup/                   # 환경 설정
    cleanup/                 # 세션 정리
    reporting/               # 상태 보고
    run-summary/             # 실행 요약 생성
    ledger-query/            # 원장 조회
    pivot-protocol/          # 피벗 처리
    policy-managing/         # 정책 관리
    coding-conventions/      # 컨벤션 감지
    chaos-exercising/        # 카오스 테스트
    write-prd/               # PRD 생성
    write-stories/           # 스토리 생성
  agents/                    # 에이전트 정의 (.md)
  hooks/
    hooks.json               # 훅 설정
    scripts/                 # 18개 훅 스크립트 (아래 참조)
```

### Hooks (18개 스크립트)

훅은 에이전트 협조 없이 거버넌스를 강제하는 lifecycle 이벤트 핸들러다.

| Lifecycle Event | 스크립트 |
|----------------|----------|
| **SessionStart** | `session-init.sh`, `memory-review-cadence.sh` |
| **PreToolUse** | `checkpoint-pre-write.sh` |
| **PostToolUse (Write/Edit)** | `protect-geas-state.sh`, `verify-task-status.sh`, `check-debt.sh`, `stale-start-check.sh`, `lock-conflict-check.sh`, `memory-promotion-gate.sh`, `memory-superseded-warning.sh`, `checkpoint-post-write.sh`, `packet-stale-check.sh` |
| **PostToolUse (Bash)** | `integration-lane-check.sh` |
| **SubagentStart** | `inject-context.sh` |
| **SubagentStop** | `agent-telemetry.sh` |
| **Stop** | `verify-pipeline.sh`, `calculate-cost.sh` |
| **PostCompact** | `restore-context.sh` |

---

## 9. `.geas/` 디렉토리 구조

`.geas/`는 프로젝트별 런타임 상태 루트다. gitignore 대상이며 프로젝트마다 생성된다.

```
.geas/
  state/
    run.json                 # 세션 상태, checkpoint, remaining_steps
    locks.json               # lock manifest
    health-check.json        # health signal 계산 결과
    session-latest.md        # 컨텍스트 압축 후 복구용
    task-focus/{task_id}.md  # 작업별 포커스 요약

  spec/
    seed.json                # intake에서 동결된 미션 스펙 (불변)

  tasks/
    {task_id}/
      task-contract.json
      implementation-contract.json
      worker-self-check.json
      specialist-review.json
      integration-result.json
      gate-result.json
      closure-packet.json
      challenge-review.json
      final-verdict.json
      retrospective.json

  evidence/
    {task_id}/
      architecture-authority-review.json
      qa-engineer.json
      challenge-review.json
      product-authority-verdict.json

  packets/
    {task_id}/
      {agent_type}.md            # 역할별 컨텍스트 패킷

  evolution/
    rules-update-{seq}.json
    debt-register.json
    gap-assessment-{transition}.json
    phase-review-{transition}.json

  contracts/
    {task_id}.json             # 구현 계약

  decisions/
    {dec_id}.json              # 의사결정 기록
    pending/                   # 진행 중 제안

  recovery/
    recovery-{id}.json         # 세션 되감기용 복구 패킷

  memory/
    _project/conventions.md
    agents/{type}.md
    candidates/{memory_id}.json  # 메모리 후보 (승격 전)
    entries/{memory_id}.json     # 승격된 메모리 항목
    logs/{task_id}-{memory_id}.json  # 적용 로그
    retro/{task_id}.json
    incidents/{id}.json

  summaries/
    mission-summary.md
    run-summary-{timestamp}.md

  ledger/
    events.jsonl             # append-only 감사 추적

  rules.md                   # 계속 갱신되는 팀 규칙
```

> Artifact 상세 및 스키마는 `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` 참조.

---

## 10. 도구 비의존 원칙

코어 스킬(`plugin/skills/`)은 특정 도구를 하드코딩하면 안 된다.

**금지**: 패키지 매니저, 프레임워크, DB, 테스트 도구, 빌드 도구 이름을 기본값으로 가정.

**허용**: `.geas/memory/_project/conventions.md` 참조, 마커 파일 감지(package.json, go.mod), 복수 대안 예시("예: Jest, pytest").

실제 동작: architecture authority가 온보딩 시 conventions.md에 프로젝트 규칙을 기록 → TaskContract의 eval_commands가 이를 참조 → Evidence Gate가 프로젝트별 명령어를 실행. 스킬 정의를 바꿀 필요 없다.

---

## 11. 프로토콜 참조

운영 프로토콜 상세 명세는 `docs/ko/protocol/`에 있다. 이 문서는 아키텍처 개요이며, 프로토콜 수준의 규칙은 protocol/ 문서가 canonical이다.

| 관심사 | 참조 |
|--------|------|
| 설계 원칙, 4 Pillars | `protocol/00_PROTOCOL_FOUNDATIONS.md` |
| Agent type, 권한 경계 | `protocol/01_AGENT_TYPES_AND_AUTHORITY.md` |
| Mission phase, mission model | `protocol/02_MODES_MISSIONS_AND_RUNTIME.md` |
| Task lifecycle, state machine | `protocol/03_TASK_MODEL_AND_LIFECYCLE.md` |
| Worktree, lock, parallelism | `protocol/04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md` |
| Gate, vote, verdict | `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md` |
| Specialist evidence matrix | `protocol/06_SPECIALIST_EVIDENCE_MATRIX.md` |
| Memory system | `protocol/07`, `08`, `09` |
| Session recovery | `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` |
| Artifact, schema | `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` |
| Enforcement, metrics | `protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` |
| Evolution loop | `protocol/14_EVOLUTION_DEBT_AND_GAP_LOOP.md` |
