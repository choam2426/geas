# Geas 아키텍처

## 1. 개요

Geas는 멀티 agent AI 팀을 위한 거버넌스 프로토콜이다. 소프트웨어 개발, 연구, 콘텐츠 제작 등 구조화된 작업을 수행하는 AI agent 그룹이라면 어디든 Geas를 적용하여 거버넌스가 보장되고, 추적 가능하며, 검증된 결과를 산출할 수 있다. 그리고 그 과정에서 팀은 계속 성장한다.

### 문제

여러 AI agent가 구조 없이 협업하면 세 가지 문제가 생긴다:

1. **검증이 없다.** Agent가 "완료"라고 선언하면 그대로 넘어간다. 작업이 실제로 계약을 충족하는지 독립적으로 확인하는 절차가 없다.
2. **기억이 없다.** 매 세션이 백지에서 시작된다. 과거 실패에서 얻은 교훈, 효과적인 패턴, 축적된 판단이 모두 사라진다.
3. **통제가 없다.** 의사결정이 암묵적으로 이루어진다. 누가, 어떤 권한으로, 어떤 근거에 기반해 무엇을 결정했는지 기록이 남지 않는다.

### 해결책

Geas는 **Contract Engine** 을 도입한다. 도메인에 무관하게 모든 작업 단위에 거버넌스 파이프라인을 강제하는 skill 집합이다:

- **task contract** 가 수행할 작업, 검증 방법, 리뷰어를 정의한다.
- **evidence gate** 가 작업의 계약 충족 여부를 독립적으로 검증한다. "완료"란 "증거가 증명한 상태"를 뜻한다.
- **closure packet** 이 구현, 리뷰, gate 결과, 리스크를 포함한 전체 이력을 조립하여 최종 판정에 제출한다.
- **memory system** 이 교훈을 포착하여 rules, context packet, agent memory를 통해 미래 작업에 반영한다.

Contract Engine은 도구에도 도메인에도 종속되지 않는다. Agent가 코드를 작성하든, 실험을 수행하든, 콘텐츠를 제작하든 상관없다. 오직 계약이 있었는가, 검증되었는가, 팀이 무엇을 배웠는가만을 추적한다.

### 설계 철학 (4 Pillars)

모든 설계 판단의 기준: **"이 결정이 프로세스를 더 통제 가능하고, 추적 가능하고, 검증 가능하고, 학습 가능하게 만드는가?"**

| Pillar | 보장하는 것 |
|---|---|
| **Governance** | 모든 의사결정이 명시적 권한과 정해진 절차를 따른다 |
| **Traceability** | 모든 행위가 기록되어 사후 감사가 가능하다 |
| **Verification** | 모든 산출물이 agent의 주장이 아닌 계약 대비 검증된다 |
| **Evolution** | 팀이 회고, 규칙, memory, 부채 추적을 통해 세션을 거듭하며 성장한다 |

> 4 Pillars의 구체적 프로토콜 바인딩과 설계 원칙은 `protocol/00_PROTOCOL_FOUNDATIONS.md` 참조.

---

## 2. 4계층 아키텍처

Geas는 관심사를 네 계층으로 분리한다. 핵심 통찰: **안정적이어야 하는 계층은 Contract Engine뿐이다.** 그 위아래는 거버넌스 모델을 깨뜨리지 않고 자유롭게 교체할 수 있다.

```
┌───────────────────────────┐
│  Collaboration Surface    │  Dashboard, CLI, chat, IDE — how humans interact
├───────────────────────────┤
│  Agent Teams              │  Domain profiles fill specialist slots with concrete agents
├───────────────────────────┤
│  Contract Engine          │  13 core skills — the immutable governance pipeline
├───────────────────────────┤
│  Tool Adapters            │  File I/O, shell, MCP servers — how agents act on the world
└───────────────────────────┘
```

| 계층 | 존재 이유 | 교체 가능 여부 |
|---|---|---|
| **Collaboration Surface** | 사용자 경험과 agent 워크플로를 분리한다. 대시보드를 쓰든 CLI를 쓰든 동일한 거버넌스가 보장된다. | 가능 |
| **Agent Teams** | 전문성과 프로세스를 분리한다. Contract Engine은 quality slot의 산출물이 `qa_engineer`에서 나왔든 `methodology_reviewer`에서 나왔든 관여하지 않는다. 리뷰가 존재하면 된다. | 가능 |
| **Contract Engine** | 불변 핵심. task 생명주기를 강제하는 13개 skill: intake, compilation, context, contracts, gates, verification, voting, memory, scheduling, setup, policy, reporting. | **불가** |
| **Tool Adapters** | Agent 역량과 agent 정체성을 분리한다. `git`을 쓰든 버전 관리 API를 쓰든 동일한 계약을 만족하면 된다. | 가능 |

### Domain Profile과 Slot 해석

Agent Teams는 **domain profile** 단위로 구성된다. 각 profile은 추상 specialist slot을 구체적 agent type에 매핑한다:

```
Mission spec: { "domain_profile": "software" }
    ↓
Orchestrator reads profiles.json
    ↓
quality_specialist → qa_engineer → Agent(agent: "qa-engineer", ...)
```

Contract Engine은 slot 이름(`implementer`, `quality_specialist`, `risk_specialist`, `operations_specialist`, `communication_specialist`)만 참조한다. Orchestrator가 런타임에 이를 구체적 agent로 해석한다. 동일한 13개 core skill이 소프트웨어, 연구, 기타 모든 도메인에서 작동하는 이유가 여기에 있다.

> Agent type, 권한 규칙, 라우팅에 대해서는 `protocol/01_AGENT_TYPES_AND_AUTHORITY.md` 참조.

---

## 3. 실행 모델

### 4단계 구조의 이유

모든 mission은 규모와 무관하게 동일한 네 단계를 거친다. 단일 기능은 경량 처리를, 전체 제품은 완전한 처리를 받지만 순서는 변하지 않는다. 명세 없이 구현에 돌입하면 범위가 흘러가고, 다듬기 없이 출하하면 부채가 쌓이기 때문이다.

```
Specifying ──→ Building ──→ Polishing ──→ Evolving ──→ Close
   │              │             │              │
 gate 1        gate 2        gate 3        gate 4
```

| 단계 | 목적 | 종료 조건 |
|---|---|---|
| **Specifying** | WHAT과 WHY를 정의한다. Mission spec, design brief, task list를 산출한다. 아키텍처 리뷰 필수. | 사용자 승인된 spec + design brief + 컴파일된 task |
| **Building** | 개별 task 파이프라인을 실행한다. 각 task는 contract → implement → review → gate → verdict를 따른다. | 모든 task가 통과하거나 명시적으로 보류됨 |
| **Polishing** | Building 중 발견된 부채, 문서 공백, 품질 이슈를 처리한다. | 부채 분류 완료, gap assessment 완료 |
| **Evolving** | 교훈을 포착한다. 회고, memory 승격, 규칙 갱신, 이월 백로그. | Evolution 산출물 기록, mission 요약 작성 |

규모에 따라 자동 조절된다: 경량 mission은 단계를 압축할 수 있지만 순서 자체는 절대 바뀌지 않는다.

> Mission과 phase의 상세 내용은 `protocol/02_MODES_MISSIONS_AND_RUNTIME.md` 참조.

---

## 4. Task 생명주기

Task는 프로토콜의 유일한 완결 단위다. 어떤 것도 task가 `passed`에 도달하지 않고는 출하, 완료, "끝남"으로 인정되지 않는다.

### 7개 상태의 이유

각 상태는 서로 다른 주체가 책임지는 고유한 점검 지점이다. 상태를 합치면(예: review를 implementation에 병합) 책임 소재가 흐려진다. 7-상태 모델은 어느 시점에서든 **지금 누가 책임지고 있으며, 다음에 무엇이 일어나야 하는가** 를 답할 수 있도록 보장한다.

```
drafted → ready → implementing → reviewed → integrated → verified → passed
```

보조 상태: `blocked`, `escalated`, `cancelled`

### 전이별 필수 산출물

증거 없이는 어떤 전이도 발생하지 않는다. 상태 변경이 주장이 아닌 산출물에 의해 통제되는 것이 핵심 강제 메커니즘이다.

| 전이 | 산출물 | 증명하는 것 |
|---|---|---|
| drafted → ready | `task-contract.json` | 범위, 기준, 라우팅이 정의됨 |
| ready → implementing | `implementation-contract.json` | 작업자와 리뷰어가 계획에 합의함 |
| implementing → reviewed | `worker-self-check.json` + specialist reviews | 작업이 완료되고 평가됨 |
| reviewed → integrated | `integration-result.json` | 변경 사항이 baseline에 병합됨 |
| integrated → verified | `gate-result.json` (pass) | Evidence gate가 품질을 확인함 |
| verified → passed | `closure-packet.json` + `final-verdict.json` | Decision Maker가 결과를 수락함 |

> 전체 상태 머신, 되감기 규칙, 재시도 예산: `protocol/03_TASK_MODEL_AND_LIFECYCLE.md`.

---

## 5. 검증 흐름

검증은 Geas의 핵심이다. 프로토콜은 어떤 agent의 완료 주장도 신뢰하지 않으며, 독립적 증거를 요구한다.

```
Implementation complete
        │
        ▼
  Evidence Gate
  ┌─────────────────────┐
  │ Tier 0: Precheck    │──→ block (missing artifact, wrong state)
  │ Tier 1: Mechanical  │──→ fail (repeatable checks failed)
  │ Tier 2: Contract    │──→ fail (criteria unmet, rubric below threshold)
  └─────────────────────┘
        │ pass
        ▼
  Closure Packet assembly
        │
        ▼
  Challenger Review (mandatory for high/critical risk)
        │
        ▼
  Final Verdict (Decision Maker: pass / iterate / escalate)
        │ pass
        ▼
     Resolved
```

### Gate 단계

| Tier | 답하는 질문 | 예시 |
|---|---|---|
| **Tier 0** (Precheck) | 이 task가 gate 대상 자격이 있는가? | 필수 산출물 존재, task 상태 유효, baseline 최신 |
| **Tier 1** (Mechanical) | 반복 가능한 검사를 통과하는가? | 소프트웨어: build, lint, test. 연구: 인용 검증, 통계 재현성. 콘텐츠: 문법, 팩트 체크 |
| **Tier 2** (Contract + Rubric) | 작업이 계약을 충족하는가? | 수용 기준 충족, rubric 점수 임계값 이상(1-5 척도), 알려진 리스크 처리됨 |

### Gate 결과

| 결과 | 의미 | 재시도 예산 영향 |
|---|---|---|
| `pass` | 검증 완료 — closure로 진행 | 없음 |
| `fail` | 품질 이슈 — verify-fix loop 진입 | -1 |
| `block` | 구조적 문제 — 진행 불가 | 없음 |
| `error` | Gate 자체 실패 — 조사 후 재실행 | 없음 |

### Final Verdict

Gate는 "증거가 확인되었다"고 말한다. Decision Maker는 "제품이 이를 수용해야 한다"고 말한다. 이 둘은 별개의 판단이다. Gate 통과가 자동으로 출하를 의미하지 않는다 — Decision Maker는 미해결 리스크, 부채, 제품 적합성을 포함한 전체 closure packet을 평가한다.

- `pass` — 완료, task가 `passed`에 도달
- `iterate` — 검증되었으나 충분하지 않음, 재작업 필요 (재시도 예산 미소비; 누적 3회 iterate 시 에스컬레이션)
- `escalate` — 로컬 권한 범위 초과, 사용자에게 에스컬레이션

> 전체 상세: `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`.

---

## 6. Memory와 진화

### Memory가 해결하는 문제

Memory 없이는 매 세션이 백지에서 시작된다. 팀은 같은 실수를 반복하고, 같은 엣지 케이스를 놓치며, 같은 패턴을 다시 발견한다. Memory의 존재 이유는 **과거 경험이 미래 행동을 바꾸는 것** 이다 — 지식 베이스가 아니라 행동 변경 메커니즘이다.

### Memory의 작동 방식

Memory는 구체적 표면을 통해 행동에 영향을 미친다:

| 표면 | 예시 |
|---|---|
| `rules.md` | "Auth endpoint에는 반드시 rate limiting을 적용할 것" — 과거 gate 실패에서 얻은 교훈 |
| Agent memory | `.geas/memory/agents/{type}.md` — 호출 시 읽히는 역할별 지침 |
| Context packet | 관련성 높은 교훈이 agent 브리핑에 주입됨 |
| Gate strictness | 과거 실패 이력이 있는 영역에 더 엄격한 임계값 적용 |
| Scheduling caution | 이전에 충돌을 유발한 병렬 조합 회피 |

### Memory 생명주기

Memory는 지속성이 아닌 증거를 통해 신뢰를 획득한다. 교훈이 참인 이유는 누군가 그렇게 말했기 때문이 아니라, 검증되었기 때문이다.

```
candidate → provisional → stable → canonical
                ↕               ↕
           under_review    under_review
                ↓               ↓
        decayed / superseded / archived
```

| 전이 | 요구 사항 |
|---|---|
| candidate → provisional | 2건 이상의 evidence 참조 |
| provisional → stable | 3회 이상 성공적 재사용, 모순 0건 |
| stable → canonical | 3개 이상 task에 걸쳐 5회 이상 재사용, 공동 authority 승인 |

### 진화 루프

완료된 모든 task 이후, 프로토콜은 가치를 추출한다:

1. **회고** — 무엇이 효과적이었고, 무엇이 실패했고, 무엇이 예상 밖이었는가
2. **규칙 후보** — 강제할 가치가 있는 패턴 ("이런 유형의 실패가 반복되고 있다")
3. **Memory 승격** — 충분한 증거를 확보한 교훈의 단계 상승
4. **부채 추적** — 타협 사항을 가시화하고 소유자를 지정
5. **Gap assessment** — 약속한 범위 대비 실제 산출 범위의 정직한 비교

Mission 종료 시 Evolving 단계에서 이 모든 것을 통합한다. 진화하지 않는 mission은 배우지 않는 mission이다.

> Memory 시스템: `protocol/07`, `08`, `09`. 진화 루프: `protocol/13`.

---

## 7. 컨텍스트 유실 방어

LLM 세션은 컨텍스트 한계에 도달한다. 압축(compaction)이 발생하면 orchestrator는 작업 메모리 — 현재 phase, 활성 task, 남은 단계, 미해결 리스크 — 를 잃는다. 방어 없이는 세션이 혼란스러운 상태에서 재개되어 잘못된 판단을 내린다.

### 방어 1: 외부화된 상태

`run.json`이 전체 파이프라인 위치를 디스크에 저장한다: 현재 phase, 활성 task, `remaining_steps[]` 배열, checkpoint 메타데이터. 컨텍스트가 완전히 유실되더라도 이 파일을 읽으면 orchestrator는 현재 위치와 다음 행동을 정확히 알 수 있다.

### 방어 2: 자동 복원

`PostCompact` hook이 모든 compaction 이벤트 후에 실행된다. `run.json`, `session-latest.md`, `rules.md`, 활성 task contract를 읽어 L0(절대 삭제 불가) 컨텍스트로 재주입한다. Orchestrator는 다음 정보를 갖고 재개한다:

- 현재 phase와 task
- 다음 파이프라인 단계
- 수용 기준과 미해결 리스크
- 활성 규칙과 memory 상태

이것은 최선 노력 복구가 아니라 프로토콜 보장이다. Anti-forgetting 계층이 compaction으로 인한 컨텍스트 저하를 치명적이 아닌 점진적으로 만든다.

> 전체 복구 모델: `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`.

---

## 8. Plugin 구조

```
plugin/
├── plugin.json                # Manifest
├── skills/                    # 15 skills (13 core + 2 utility, flat)
│   ├── mission/               # Orchestrator: 4-phase pipeline, slot resolution
│   ├── intake/                # Requirements gathering
│   ├── task-compiler/         # Mission spec → TaskContracts
│   ├── context-packet/        # Role-specific briefings
│   ├── implementation-contract/
│   ├── evidence-gate/         # Tier 0/1/2 verification
│   ├── verify-fix-loop/
│   ├── vote-round/            # Structured voting and decisions
│   ├── memorizing/            # Memory lifecycle
│   ├── scheduling/            # Parallel task scheduling
│   ├── setup/                 # Project init + codebase discovery
│   ├── policy-managing/
│   ├── reporting/             # Health signals, briefing, summaries
│   ├── write-prd/             # SW utility: PRD generation
│   └── write-stories/         # SW utility: story generation
├── agents/
│   ├── authority/             # 3 spawnable (product-authority, design-authority, challenger)
│   ├── software/              # 5 specialists (software-engineer, qa-engineer, security-engineer, platform-engineer, technical-writer)
│   └── research/              # 6 specialists (literature-analyst, research-analyst, methodology-reviewer, research-integrity-reviewer, research-engineer, research-writer)
└── hooks/
    ├── hooks.json             # 16 lifecycle hooks
    └── scripts/
```

Agent 상세: `reference/AGENTS.md`. Skill 상세: `reference/SKILLS.md`. Hook 상세: `reference/HOOKS.md`.

---

## 9. 런타임 상태 (`.geas/`)

`.geas/`는 프로젝트별 런타임 디렉토리다. Gitignore 대상이며 setup skill이 생성한다. Task contract, evidence, memory, 이벤트 로그 등 모든 런타임 산출물이 이곳에 저장된다.

```
.geas/
├── state/
│   ├── run.json                    # Mission state, checkpoint, remaining_steps
│   ├── locks.json                  # Lock manifest for parallelism
│   ├── health-check.json           # Health signal results
│   ├── memory-index.json           # Memory entry registry
│   ├── session-latest.md           # Post-compact recovery context
│   └── task-focus/{task_id}.md     # Per-task focus summaries
├── missions/{mission_id}/
│   ├── spec.json                   # Mission spec (frozen after intake)
│   ├── tasks/{task_id}.json        # Task contracts
│   ├── tasks/{task_id}/            # Per-task artifacts (self-check, reviews, gate, verdict, retrospective)
│   ├── evidence/{task_id}/         # Specialist review evidence
│   ├── contracts/{task_id}.json    # Implementation contracts
│   ├── evolution/                  # Debt register, gap assessments, rules updates
│   └── phase-reviews/             # Phase transition reviews
├── memory/
│   ├── _project/conventions.md     # Project conventions (detected at setup)
│   ├── agents/{type}.md            # Per-agent persistent memory
│   ├── candidates/                 # Pre-promotion memory candidates
│   ├── entries/                    # Promoted memory entries
│   └── logs/                       # Memory application logs
├── ledger/events.jsonl             # Append-only audit trail
├── recovery/                       # Recovery packets
└── rules.md                        # Team rules (continuously updated)
```

> 산출물 스키마: `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`.

---

## 10. 도구 무관 원칙

Core skill은 특정 도구, 프레임워크, 패키지 매니저를 가정해서는 안 된다. Contract Engine이 도메인에 무관할 수 있는 이유가 바로 이것이다 — 동일한 evidence gate가 pytest를 쓰든 인용 검증기를 쓰든 작동한다.

**작동 방식:** Setup skill이 초기화 시 프로젝트 관례를 감지하여 `.geas/memory/_project/conventions.md`에 기록한다. Skill은 이 파일을 읽어 실행할 명령을 판단한다. 프로젝트 스택이 바뀌어도 skill 정의를 수정할 필요가 없다.

**Core skill에서 금지:** 하드코딩된 도구 이름, 프레임워크 가정, 기본 패키지 매니저.

**허용:** `conventions.md` 참조, 마커 파일 감지(package.json, go.mod, pyproject.toml), 다중 대안 예시.

---

## 11. 프로토콜 참조

`docs/protocol/`의 프로토콜 문서가 모든 프로토콜 수준 규칙의 정본이다. 본 문서는 아키텍처 개요이므로, 충돌 시 프로토콜이 우선한다.

| 주제 | 문서 |
|---|---|
| 설계 원칙, 4 Pillars | `00_PROTOCOL_FOUNDATIONS` |
| Agent type, 권한, 라우팅 | `01_AGENT_TYPES_AND_AUTHORITY` |
| Mission phase, mode | `02_MODES_MISSIONS_AND_RUNTIME` |
| Task 생명주기, 상태 머신 | `03_TASK_MODEL_AND_LIFECYCLE` |
| Workspace, lock, 병렬성 | `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM` |
| Gate, vote, verdict | `05_GATE_VOTE_AND_FINAL_VERDICT` |
| Specialist evidence matrix | `06_SPECIALIST_EVIDENCE_MATRIX` |
| Memory 시스템 | `07`, `08`, `09` |
| 세션 복구 | `10_SESSION_RECOVERY_AND_RESUMABILITY` |
| 산출물, 스키마 | `11_RUNTIME_ARTIFACTS_AND_SCHEMAS` |
| 강제, 메트릭 | `12_ENFORCEMENT_CONFORMANCE_AND_METRICS` |
| 진화, 부채, gap 루프 | `13_EVOLUTION_DEBT_AND_GAP_LOOP` |
