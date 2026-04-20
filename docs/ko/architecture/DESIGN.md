# Geas 구현체 설계

이 문서는 Geas 프로토콜(`docs/ko/protocol/` 9 docs + `docs/schemas/` 14 schemas)을 실제로 돌리는 구현체의 아키텍처를 기술한다. 독자는 Geas를 하나 이상의 agent 클라이언트(Claude Code, Codex, opencode 등) 위에 구축하려는 구현자다.

프로토콜 자체의 규칙·상태·artifact 의미는 이 문서가 아닌 protocol docs와 schema에 있다. 이 문서는 "그 프로토콜을 어떻게 realize하는가"만 다룬다.

## 1. 개요

### 무엇인가

Geas는 두 층으로 구성된다.

1. **Protocol**: 불변 계약. 무엇이 발생해야 하는지, 어떤 artifact가 어떤 모양이어야 하는지 정의. `docs/ko/protocol/` 9 docs + `docs/schemas/` 14 schemas.
2. **Reference implementation**: 여러 agent 클라이언트 위에서 그 프로토콜을 돌리는 시스템. 이 문서의 주제.

프로토콜은 한 쌍의 합의이고, 구현체는 그 합의를 실제 agent들이 따르도록 붙드는 레일이다. 프로토콜과 구현체는 독립 진화한다 — 프로토콜이 바뀌면 구현체가 그에 맞춰 재설계되며, 그 반대는 아니다.

### 설계 목표

- **프로토콜 충실**: 구현체는 프로토콜이 정한 상태·전이·artifact를 한 치도 어긋나지 않게 실행한다.
- **클라이언트 중립**: 같은 프로토콜이 여러 agent 런타임(Claude Code, Codex, opencode 등) 위에서 동일하게 돈다.
- **쓰기 통로 단일화**: `.geas/` 모든 쓰기는 단일 CLI를 경유해 schema 검증과 atomic rename을 강제한다.
- **관측 가능**: artifact만 읽어도 mission이 어디까지 왔는지, 누가 무엇을 판단했는지 재구성 가능하다.
- **교체 가능 vs 불변**: 클라이언트 어댑터와 agent roster는 교체 가능하지만 프로토콜과 CLI 계약은 불변이다.

### 핵심 용어

본문 섹션에 들어가기 전 자주 쓰는 용어를 짧게 묶는다. 상세 정의는 해당 섹션 참조.

- **Slot**: 프로토콜이 정한 역할 자리 (orchestrator, decision-maker, design-authority, challenger, implementer, verifier, risk-assessor, operator, communicator 9개). §7.
- **Concrete agent**: slot을 실제로 수행하는 구현체(파일). 한 agent가 여러 slot을 겸임할 수 있다. §7.
- **Skill**: 프로토콜의 한 단계를 agent에게 실행시키는 prompt + 절차. §6.
- **메인 세션 (`main_session`)**: 사용자와 직접 대화하는 클라이언트 세션. orchestrator 역할을 담당한다. §7.
- **Spawn**: 메인 세션이 다른 slot을 별도 agent 실행 컨텍스트로 띄우는 행위. §8.
- **Client adapter**: 공유 skill·agent·CLI를 특정 agent 런타임에 bind하는 얇은 층. §8.

## 2. 계층 구조

구현체는 여섯 계층으로 나뉜다. 아래로 갈수록 불변, 위로 갈수록 클라이언트별.

```
┌─ Client Adapter      ── 클라이언트별 (Claude Code / Codex / opencode)
├─ Skill               ── 공유: 프로토콜 단계별 실행 prompt
├─ Agent Roster        ── 공유: slot → concrete agent 매핑
├─ CLI (geas)          ── 공유: .geas/ 쓰기 actuator
├─ Runtime State       ── 공유: .geas/ 디렉토리 포맷
└─ Protocol + Schemas  ── 불변 핵심
```

| 계층 | 역할 | 교체 가능 |
|---|---|---|
| Protocol + Schemas | 프로토콜 문서와 JSON 스키마. 모든 artifact 구조와 상태 규칙의 정본 | 불가 |
| Runtime State | `.geas/` 디렉토리 포맷. 파일 위치·이름·append 규칙 | 불가 |
| CLI (`geas`) | `.geas/` 단일 쓰기 통로. schema 검증 + 타임스탬프 + atomic rename | 불가 |
| Agent Roster | slot 별 역할 정의 + 도메인 프로필(concrete agent 매핑) | 가능 |
| Skill | 프로토콜 단계를 agent에게 실행시키는 prompt·절차 | 가능 |
| Client Adapter | 각 agent 런타임이 skill·agent·CLI를 bind하는 얇은 층 | 가능 |

교체 가능한 계층 중 하나를 바꿔도 아래 계층이 그대로면 프로토콜 충실성은 유지된다. 예: agent roster에 새 specialist를 추가하거나 skill prompt 문구를 고쳐도 CLI와 프로토콜은 영향 없다.

## 3. Protocol + Schemas 층

이 문서는 protocol 또는 schema를 재술하지 않는다. 아래 포인터만 둔다. (이 섹션에서 'Protocol'은 protocol docs와 JSON schema를 합쳐 부른다.)

| 주제 | 문서 |
|---|---|
| 설계 축, 위험 | `protocol/00_PROTOCOL_FOUNDATIONS.md` |
| Agent slot, 권한 | `protocol/01_AGENTS_AND_AUTHORITY.md` |
| Mission phase, final verdict | `protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md` |
| Task lifecycle, evidence, gate, closure | `protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md` |
| Baseline, workspace, parallelism | `protocol/04_BASELINE_WORKSPACE_AND_PARALLELISM.md` |
| Runtime state, 재개 | `protocol/05_RUNTIME_STATE_AND_RECOVERY.md` |
| Memory | `protocol/06_MEMORY.md` |
| Debt, gap | `protocol/07_DEBT_AND_GAP.md` |
| Artifact 경로·스키마 registry | `protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` |

시각 다이어그램은 `docs/ko/DIAGRAMS.md`에 있다.

## 4. CLI `geas`

CLI는 `.geas/` 아래 모든 쓰기가 통과해야 하는 단일 actuator다. Schema 검증, 타임스탬프 주입, atomic rename, append-only 강제, transition guard, id 생성, template 제공이 모두 CLI 책임이다.

내부 계약(명령 체계, 입력·출력 규약, 쓰기 파이프라인, 전이 guard 로직, append-only 검증 알고리즘, id 생성 규칙 등)은 `architecture/CLI.md`에서 상세히 기술한다.

## 5. Runtime State `.geas/`

```
.geas/
├── missions/
│   └── {mission_id}/
│       ├── spec.json                         # mission-spec
│       ├── mission-design.md                 # mission-design
│       ├── mission-state.json                # mission-state
│       ├── phase-reviews.json                # append (reviews[])
│       ├── deliberations.json                # append (entries[], level=mission)
│       ├── mission-verdicts.json             # append (verdicts[])
│       ├── consolidation/
│       │   ├── debts.json
│       │   ├── gap.json
│       │   └── memory-update.json
│       └── tasks/
│           └── {task_id}/
│               ├── contract.json             # task-contract
│               ├── implementation-contract.json
│               ├── self-check.json
│               ├── task-state.json
│               ├── gate-results.json         # append (runs[])
│               ├── deliberations.json        # append (entries[], level=task)
│               └── evidence/
│                   └── {agent}.json          # append (entries[])
├── memory/
│   ├── shared.md
│   └── agents/
│       └── {agent}.md
└── events.jsonl                              # (선택) 감사 로그
```

### 파일 owner 매트릭스

"Writer"는 CLI 명령을 실제로 호출하는 slot을 뜻한다. 모든 쓰기는 CLI를 경유하며, Writer가 CLI 인자를 구성해 명령을 실행한다.

| 파일 | Writer | 쓰기 시점 |
|---|---|---|
| `spec.json` | orchestrator | specifying |
| `mission-design.md` | design-authority | specifying |
| `mission-state.json` | orchestrator | phase·active task 변경 시 |
| `phase-reviews.json` | orchestrator | 각 phase gate 판정 후 |
| `deliberations.json` (mission) | orchestrator | deliberation 완료 후 |
| `mission-verdicts.json` | decision-maker | consolidating |
| `debts.json` | orchestrator | consolidating |
| `gap.json` | design-authority | consolidating |
| `memory-update.json` | orchestrator | consolidating |
| `contract.json` | design-authority | drafted 생성 시 |
| `implementation-contract.json` | implementer | implementing 진입 시 |
| `self-check.json` | implementer | 구현 완료 후 |
| `task-state.json` | orchestrator | lifecycle 전이·agent 활성화 시 |
| `gate-results.json` | orchestrator | 각 gate run 후 |
| `deliberations.json` (task) | orchestrator | deliberation 완료 후 |
| `evidence/{slot}.json` | 해당 slot | 자기 evidence 제출 시 |

`contract.approved_by`는 파일이 아닌 task-contract 안의 필드다. orchestrator가 `geas task approve --by user|decision_maker`를 호출해 값을 세팅한다. `user` 승인은 orchestrator가 사용자 대화로 확인한 뒤 대필하는 형식이고, `decision_maker` 승인은 스폰된 decision-maker의 판단을 orchestrator가 전달하는 형식이다. 어느 쪽이든 CLI 호출자는 orchestrator.

### Append-only 불변성

다음 로그는 과거 item을 덮어쓰거나 삭제할 수 없다. 재시도·재판정도 새 item을 배열에 append한다.

- `phase-reviews.reviews`
- `mission-verdicts.verdicts`
- `gate-results.runs`
- `deliberations.entries`
- `evidence/{agent}.entries`

CLI는 이 규칙을 강제한다 — append 외 연산은 거부한다. 이는 감사 가능성의 기초다.

### Drift 원칙

State 파일(`mission-state.json`, `task-state.json`)과 실제 artifact가 어긋나면 항상 artifact 쪽을 신뢰한다. State 파일은 인덱스이지 소유권 주장이 아니다. 자세한 재개 절차는 `protocol/05`.

## 6. Skill

Skill은 프로토콜 단계를 agent에게 실행시키는 prompt + 절차 묶음이다. Skill 본문은 어떤 agent가 어떤 slot으로 실행하든 동일하게 읽힌다. Skill이 바뀌면 프로토콜 변경에 맞춘 것이지 agent 구현체 변경 때문이 아니다.

### 디렉토리 구조

각 skill은 자기 이름의 디렉토리를 갖고, 안에 `SKILL.md` 하나가 필수다. 보조 자료는 `references/` 아래 둔다.

```
skills/
├── mission/
│   ├── SKILL.md
│   └── references/
│       ├── spec-interview.md
│       ├── design-review-prompts.md
│       └── task-breakdown-patterns.md
├── task-draft/
│   └── SKILL.md
├── task-implement/
│   ├── SKILL.md
│   └── references/
│       └── risk-level-patterns.md
├── task-review/
│   ├── SKILL.md
│   └── references/
│       └── review-rubrics.md
├── task-verify/
│   └── SKILL.md
├── gate-run/
│   ├── SKILL.md
│   └── references/
│       └── tier-procedures.md
├── task-close/
│   └── SKILL.md
├── deliberation/
│   └── SKILL.md
├── phase-review/
│   └── SKILL.md
├── mission-consolidate/
│   └── SKILL.md
├── mission-verdict/
│   └── SKILL.md
└── resume/
    └── SKILL.md
```

규칙:

- `SKILL.md`는 필수. `references/`는 본문을 작게 유지하기 위한 progressive disclosure 장치.
- `references/`의 파일은 **SKILL.md에서 1-level로만** 링크한다. 중첩(references/A.md에서 references/B.md 참조)은 Claude가 부분 읽기를 할 가능성이 있어 금지.
- `references/` 안에 100줄 넘는 파일은 상단에 table of contents를 둔다.
- 경로는 모두 forward slash. Windows 경로 표기 금지.
- 실행 코드가 필요하면 `scripts/`를 둘 수 있지만 Geas core skill은 대부분 prompt-only이므로 거의 필요 없다.

### SKILL.md 구조

YAML frontmatter + markdown 본문.

**frontmatter 필드** (Anthropic 표준만 사용):

```yaml
---
name: mission                     # 필수. 64자 이내, 소문자·숫자·하이픈만
description: >                    # 필수. 3인칭, 1024자 이내
  Runs the specifying phase — captures the mission spec, mission design,
  and initial task contract set with user approvals. Triggers at mission
  start before any building work.
---
```

- `name`은 예약어(`anthropic`, `claude`) 금지. Gerund 형태(예: `task-drafting`) 또는 짧은 명사형(`task-draft`) 둘 다 허용하되 skill 집합 내 일관된 선택.
- `description`은 무엇을 하는지와 언제 쓰는지를 포함한다 (Anthropic skill 가이드). "이 skill은..."이 아니라 "Runs the...", "Captures the..." 같은 3인칭.

각 skill의 실행 주체(`main_session` vs `spawned`)와 담당 slot은 아래 "Skill 명세" 테이블이 단일 진실원이다. 프로토콜이 정한 고정 매핑이므로 skill 파일 자체에 중복해서 쓰지 않는다.

**본문 권장 섹션** (500줄 이내):

```markdown
# 목적
한 문단 — 이 skill이 프로토콜의 어느 단계를 담당하는가.

# 선행 조건
- 호출 전에 이미 존재해야 하는 artifact
- 요구되는 task/mission 상태

# 절차
체크리스트 형태로 작성한다. 단계마다 호출할 CLI 명령과 분기 조건 포함.

```
진행:
- [ ] 1. ...
- [ ] 2. ...
```

# 호출하는 CLI 명령
이 skill이 사용하는 `geas ...` 명령 목록.

# 산출물
실행 후 `.geas/`에 생기거나 갱신되는 파일.

# 실패 처리
- schema 검증 실패 → hints 읽고 재시도
- guard 실패 → 누락된 선행 조건 파악
- 그 외 이례 상황
```

본문이 500줄을 넘으면 절차나 패턴을 `references/{name}.md`로 분리하고 SKILL.md에서 포인터만 둔다 ("자세한 Tier 2 집계 규칙은 `references/tier-procedures.md`").

### Skill 명세

| skill | `execution` | `slot` | 목적 | 주된 CLI |
|---|---|---|---|---|
| `/mission` | `main_session` | orchestrator | specifying phase 진입점 (mission 생성과 초기 승인) | `mission create`, `mission design-set`, `task draft`, `task approve`, `mission-state update` |
| `/task-draft` | `main_session` | orchestrator (design-authority를 spawn) | 중간 task contract 작성 | `task draft`, `task approve` |
| `/task-implement` | `spawned` | implementer | 구현 + self-check + implementation evidence | `impl-contract set`, `self-check set`, `evidence append` |
| `/task-review` | `spawned` | risk-assessor / operator / communicator / challenger | review evidence 제출 | `evidence append` |
| `/task-verify` | `spawned` | verifier | 독립 검증 + verification evidence | `evidence append` |
| `/gate-run` | `main_session` | orchestrator | Tier 0 → 1 → 2 gate 실행 | `gate run`, `task transition` |
| `/task-close` | `main_session` | orchestrator | closure evidence 작성 | `evidence append`, `task transition` |
| `/deliberation` | `main_session` | orchestrator (참가 slot들을 spawn) | 다자 심의 | `deliberation append` |
| `/phase-review` | `main_session` | orchestrator | phase gate 판정 | `phase-review append`, `mission-state update` |
| `/mission-consolidate` | `main_session` | orchestrator (gap은 design-authority를 spawn) | debts·gap·memory-update | `debt register`, `gap set`, `memory-update set` |
| `/mission-verdict` | `main_session` | orchestrator (decision-maker를 spawn) | mission final verdict | `mission-verdict append` |
| `/resume` | main_session | orchestrator | context 유실 후 재개 | `resume` |

### Skill 규약

- **Tool-agnostic**: skill 본문은 특정 언어·프레임워크·패키지 매니저를 가정하지 않는다. 도구 선택은 task contract의 `verification_plan`과 프로젝트 관례가 결정한다.
- **CLI 지시만**: `.geas/` 쓰기는 반드시 CLI 명령으로 지시한다. "이 JSON을 이 경로에 저장해" 같은 직접 쓰기 지시 금지.
- **Schema template 선조회**: 새 artifact를 만들 때 `geas schema template <type>`을 먼저 불러 필수 필드 골격을 받는다.
- **Error hint 소비**: CLI 실패 시 `hints`를 읽어 누락 필드를 보충하고 재시도.
- **500줄 이하 + 1-level references**: 초과하면 `references/`로 분리, 중첩 링크 금지.
- **체크리스트 패턴**: 다단계 절차는 체크리스트로 제시해 agent가 진행 상황을 추적하도록 유도.
- **Feedback loop**: 품질 중요 구간(예: gate 실패, schema 검증 실패)은 "validate → fix → retry" 루프로 설계.

### 유틸리티 skill

핵심 12 skill 외 프로젝트 편의를 위한 skill 허용. `execution`·`slot` 필드는 동일하게 필요.

- `/setup` — 프로젝트에 `.geas/` 초기화 (main_session, orchestrator)
- `/help` — skill·명령 탐색 안내 (main_session, orchestrator)

유틸리티는 프로토콜 필수가 아니므로 클라이언트별로 더하거나 뺄 수 있다.

## 7. Agent Roster

### Slot → agent 매핑

프로토콜은 9개 slot을 정의한다. 각 slot은 하나 이상의 concrete agent가 맡는다.

| slot | 역할 | 실행 모델 | 도메인 변형 |
|---|---|---|---|
| `orchestrator` | mission 제어, task 전이, closure evidence 작성, 사용자 대화 | 메인 세션 (agent 파일 없음) | 없음 |
| `decision-maker` | mission final verdict, 중간 task 승인, standard 선승인 | `spawned` | 없음 |
| `design-authority` | mission design, task 분해, gap 작성 | `spawned` | 없음 |
| `challenger` | 반대 의견, deliberation 참여 | `spawned` | 없음 |
| `implementer` | 구현 + self-check + implementation evidence | `spawned` | 도메인별 |
| `verifier` | 독립 검증 | `spawned` | 도메인별 |
| `risk-assessor` | 위험 리뷰 | `spawned` | 도메인별 |
| `operator` | 운영 리뷰 | `spawned` | 도메인별 |
| `communicator` | 문서·전달 리뷰 | `spawned` | 도메인별 |

Orchestrator는 agent 파일로 존재하지 않는다. 사용자와 직접 대화하는 메인 세션이 orchestrator 역할을 담당한다. mission, gate-run, task-close, phase-review 같은 메인 세션 skill은 이 세션 안에서 실행된다. 다른 slot은 필요할 때 orchestrator가 스폰한 별도 agent에서 실행된다.

Authority slot 중 orchestrator 외 셋(decision-maker, design-authority, challenger)은 domain과 무관하게 단일 agent 정의를 갖는다. Specialist slot 다섯은 도메인 프로필이 concrete agent를 제공한다.

### Agent 파일 배치

```
agents/
├── authority/
│   ├── decision-maker.md
│   ├── design-authority.md
│   └── challenger.md
└── specialist/
    ├── software/
    │   ├── implementer.md       # 예: software-engineer
    │   ├── verifier.md          # 예: qa-engineer
    │   ├── risk-assessor.md     # 예: security-engineer
    │   ├── operator.md          # 예: platform-engineer
    │   └── communicator.md      # 예: technical-writer
    └── research/
        ├── implementer.md
        ├── verifier.md
        ├── risk-assessor.md
        ├── operator.md
        └── communicator.md
```

### Agent 파일 포맷 (portable core)

Agent 파일은 클라이언트 런타임마다 실제 포맷이 다르다(Claude Code subagent YAML, Codex AGENTS.md 섹션, opencode agent 파일 등). 공유 repo에서는 다음 **portable core**를 쓰고, 각 client adapter가 자기 런타임 포맷으로 rewrap한다.

```yaml
---
name: decision-maker        # 필수. slot 이름과 동일 (authority) 또는 concrete agent 이름 (specialist)
slot: decision-maker        # 필수. 이 agent가 맡는 protocol slot
description: >              # 필수. 3인칭, 언제 이 agent가 쓰이는지
  Issues mission final verdicts, approves mid-mission scope-inside tasks,
  and pre-approves mission design in standard mode.
domain: null                # authority는 null. specialist는 도메인 이름 (software, research 등)
---

# Role body
이 agent의 system prompt 본문. slot 책임, 권한 경계, 기본 stance, 어떤 skill을 실행할 때 어떤 자세인지.
```

`name`·`slot`·`description`·`domain` 네 필드는 필수. 본문은 자유 markdown. Adapter는 이 core를 각 런타임의 네이티브 agent 선언으로 변환한다. Agent 파일 사이에 cross-reference나 런타임 도구(`allowed_tools` 등)는 adapter별 rewrap 때 추가한다 — portable core에는 넣지 않는다.

### 도메인 프로필

도메인 프로필은 "이 프로젝트에서 specialist slot들이 어떤 concrete agent로 해석되는가"를 선언한다. 프로필 선택의 **단일 진실원은 `spec.json`의 `domain_profile` 필드**다. 프로젝트 전역 기본값은 두지 않는다 — 모든 mission이 자기 spec에서 명시적으로 프로필을 지정한다. 프로필이 바뀌어도 skill·CLI·프로토콜은 동일하게 작동하며 실행되는 concrete agent 파일만 달라진다.

### Agent ≠ 정체성

한 concrete agent가 여러 slot을 겸임할 수 있다. 예: 한 software-engineer agent가 implementer로 작업한 task의 verifier까지 맡는 것은 허용되지 않지만(독립성 요구), 다른 task에서는 operator 역할을 맡을 수 있다. 어떤 slot으로 작업하고 있는지는 evidence 파일의 경로(`evidence/{slot}.json`)와 내부 `agent` 필드(concrete agent 이름)로 드러난다.

## 8. Client Adapter

Client adapter는 공유 skill·agent·CLI를 특정 agent 런타임이 실행할 수 있는 형태로 bind하는 얇은 층이다. 각 어댑터가 책임지는 일은 셋이다.

1. **Skill loading**: 공유 skill 본문을 해당 런타임의 네이티브 skill/command 포맷으로 등록.
2. **Agent loading**: 공유 agent 정의를 런타임의 agent/프롬프트 형식으로 등록.
3. **CLI invocation**: skill이 CLI 명령을 부르면 런타임이 그 명령을 실행하도록 함. (쉘 실행, 서브프로세스, 플러그인 bridge 등)

### 8.1 공통 기대 동작

어떤 클라이언트든 다음을 제공해야 한다.

- **메인 세션 (`main_session`) = orchestrator**: 사용자와 직접 대화하는 세션이 orchestrator slot을 담당한다. §6 skill 명세의 `main_session` skill은 이 세션에서 실행되며, `spawned` skill은 별도 컨텍스트로 위임.
- Skill 본문을 agent에게 전달할 수 있는 경로 (slash 명령, AGENTS.md 섹션, 직접 프롬프트 등)
- Agent 정체성을 slot에 바인딩하는 방법
- 서브 agent 컨텍스트를 띄우고 결과를 받아오는 메커니즘 (§8.3 참조)
- CLI 실행 (shell 또는 동등 통로). `geas` 바이너리가 PATH에 있어야 함.
- `.geas/` 읽기 (artifact 확인용)

### 8.2 Session model

런타임이 메인 세션을 다루는 방식은 세 갈래. Adapter는 자기 런타임이 어느 모델인지 선언하고 그에 맞는 bootstrap을 구현한다.

| 모델 | 특징 | Bootstrap |
|---|---|---|
| Persistent-main | 메인 세션이 영속. orchestrator state가 메모리에 유지. | 세션 시작 시 한 번 `geas resume` 주입. 이후 session 지속 동안 orchestrator identity 유지. |
| Turn-scoped | 매 CLI invocation이 새 turn. state는 메모리에 없음. | 각 `main_session` skill 실행 첫 줄에 `geas resume` 강제. `.geas/` 외에 상태 없음. |
| Agent-switch | primary agent = orchestrator, subagent로 전환·복귀 가능. | primary agent를 "orchestrator mode"로 고정. subagent 전환 시 `.geas/`에 상태 persist 강제. |

Claude Code는 Persistent-main, Codex는 Turn-scoped, opencode는 Agent-switch 쪽에 가깝다. §6 skill 본문은 이 셋 모두에서 동작하도록 bootstrap 의존성을 `geas resume`에 위임한다.

### 8.3 Spawn 추상화

`spawned` skill을 실제로 어떻게 띄우는지는 런타임 성격에 따라 세 레벨로 나뉜다.

| 레벨 | 수단 | 독립성 | 병렬성 |
|---|---|---|---|
| A. Native parallel | 런타임의 sub-agent API (별도 컨텍스트, 독립 tool 권한) | 강 | 가능 |
| B. Sequential role-swap | 동일 프로세스에서 prompt 교체로 역할 전환 | 약 (컨텍스트 공유) | 불가 |
| C. Process fork | 별도 프로세스 실행 (예: `codex exec --prompt=...`) | 강 | 가능하지만 workspace isolation 필요 |

Level에 따른 프로토콜 영향:

- **Deliberation**: Level A는 voter 병렬 스폰. Level B는 순차 voter 실행. Level C는 병렬 가능하되 `.geas/` 쓰기가 서로 겹치지 않도록 adapter가 조율.
- **Reviewer 독립성**: Level B는 동일 컨텍스트에서 implementer 직후 verifier를 돌리면 컨텍스트 오염 우려. 이 경우 adapter는 Level C로 격상하거나 evidence의 `agent` 필드로 논리적 구분만 유지.
- **Task 병렬 실행**: Level B 런타임은 단일 세션 안에서 여러 task 병렬 실행이 물리적으로 불가. Orchestrator는 순차 실행으로 degrade.

모든 레벨에서 evidence 파일은 동일 스키마를 따른다. 독립성 보증의 강도만 다르다.

### 8.4 Hook-equivalent expectations

런타임이 hook 시스템을 제공하면 프로토콜 불변조건을 자동 강제하기 쉽다. 없으면 skill·CLI 호출로 대체한다. 두 경로 다 "프로토콜이 요구하는 동작"은 동일.

| 기능 | 이상적 (hook 있음) | Degraded (hook 없음) |
|---|---|---|
| `.geas/` 직접 쓰기 차단 | PreToolUse가 Edit/Write를 `.geas/` 경로에 대해 거부 | Adapter가 agent tool 권한에서 `.geas/` 제외 + 매 skill 종료 시 `geas validate` 강제 |
| Context 유실 후 복원 | PostCompact가 `geas resume` 자동 호출 | `main_session` skill 본문 첫 줄에 `geas resume` mandatory |
| Session 경계 기록 | SessionStart/End이 `geas event log`로 이벤트 기록 | Skill 시작·종료 지점에서 `geas event log` 명시 호출 |
| `.geas/` 외부 수정 감지 | PostToolUse가 파일 해시 변화 감지 | `geas validate` 주기적 실행 (다음 CLI 명령 전 권장) |

Hook이 있는 런타임은 왼쪽, 없는 런타임은 오른쪽을 구현. 어느 쪽이든 불변조건은 지켜진다. Hook 있는 쪽이 enforcement가 더 강력하고, 없는 쪽은 agent discipline에 더 의존한다는 차이만 남는다.

### 8.5 Skill transport

공유 `skills/` 디렉토리가 원본이고 adapter는 각 런타임 포맷으로 변환한다.

| 런타임 | 변환 방식 |
|---|---|
| Claude Code | `skills/{name}/SKILL.md`를 그대로 플러그인에 등록. 네이티브 SKILL.md 규약이 일치. |
| Codex | build-time generator가 `skills/**/SKILL.md`를 `AGENTS.md` 섹션으로 concat + slash command alias 매핑. Frontmatter의 `name`이 `/slash-command`로, `description`이 섹션 머리말로. |
| opencode | `~/.config/opencode/commands/{name}.md` 같은 네이티브 command 경로로 emit. |

Adapter는 원본을 수정하지 않는다. 변환 출력물만 자기 런타임 설정에 등록. 원본과 출력 사이 drift 감지를 위해 adapter는 build-time에 SKILL.md content hash를 기록할 수 있다.

### 8.6 Agent roster transport

Agent 파일의 portable core(§7)를 각 런타임 포맷으로 rewrap.

| 런타임 | 변환 방식 |
|---|---|
| Claude Code | portable core에 `model`, `allowed_tools` 등 Claude Code subagent 필드를 추가해 네이티브 YAML로 등록. |
| Codex | `AGENTS.md` 하나에 섹션으로 concat. portable core의 `slot`·`description`·본문이 섹션 내용. |
| opencode | opencode agent 파일 포맷(예: `mode`, `model`)을 portable core 위에 덧씌움. |

Authority slot 셋(decision-maker, design-authority, challenger)은 도메인 무관. Specialist slot 다섯은 mission spec의 `domain_profile`에 따라 해당 도메인 디렉토리의 agent만 로드·스폰 가능하도록 adapter가 제한.

### 8.7 구체 클라이언트 문서 포인터

각 어댑터의 실제 hook 매핑, skill generator 구현, permission 설정, Session model 전환 코드 등 상세는 DESIGN이 아닌 `docs/ko/reference/` 아래 해당 어댑터 문서에 둔다. 어댑터가 늘어도 DESIGN 계층 구조는 영향받지 않는다.

## 9. 설계 원칙

1. **Protocol as north star** — skill·CLI·agent는 프로토콜 변경에 맞춰 조정되며 반대 방향은 없다. 프로토콜 문서와 schema가 충돌의 정본이다.
2. **CLI-only writes** — `.geas/` 아래 어떤 쓰기도 CLI를 우회하지 않는다. 원칙은 모든 런타임에 동일하며, 강제 방식은 §8.4 degradation matrix를 따른다 — hook 가능 런타임은 runtime-level 차단, 그렇지 않은 런타임은 agent 권한 제한과 CLI `validate` 사후 검사로 대체한다.
3. **Evidence over declaration** — agent가 "done"이라 말해도 evidence 파일이 있기 전까지 상태는 전이하지 않는다. Transition guard는 주장 대신 artifact를 읽는다.
4. **Slot ≠ identity** — slot은 역할 자리, concrete agent는 구현체 정체성. 한 agent가 여러 slot을 겸임할 수 있고 같은 slot을 여러 agent가 돌아가며 맡을 수 있다.
5. **Tool-agnostic skills** — skill 본문은 언어·프레임워크·패키지 매니저를 고정하지 않는다. 구체 도구 선택은 task contract(`verification_plan`)와 프로젝트 관례에 맡긴다.
6. **Append-only where provable** — 재판정·재시도가 있을 수 있는 판단 로그는 replace가 아닌 append로만 누적한다. 감사는 과거 결정의 흔적을 전제로 가능하다.
7. **Self-describing artifacts** — 모든 artifact는 `mission_id`를 포함하고 task-level artifact는 `task_id`도 포함한다. 파일을 경로와 분리해도 소속이 분명해야 한다.
8. **교체 가능 계층 명시** — 어떤 계층이 교체 가능한지, 어떤 계층이 불변인지 구현자가 혼동하지 않도록 선언한다 (§2 참조).

## 10. 확장 포인트

- **새 도메인 프로필** — specialist slot 5개에 대응하는 agent 묶음 하나를 `agents/specialist/{domain}/`에 더한다. Skill·CLI·프로토콜 변경 없음.
- **새 클라이언트 어댑터** — §8의 공통 기대 동작을 구현하면 된다. 기존 어댑터 영향 없음.
- **새 utility skill** — 핵심 12개 외에 프로젝트 편의를 위한 skill은 자유롭게 추가 가능하다. 단 프로토콜 단계의 필수 skill을 대체하지 않는다.
- **대시보드·관측 도구** — `.geas/` 파일을 읽기 전용으로 소비하는 도구는 제한 없이 추가 가능하다. 쓰기가 필요하면 CLI를 경유한다.

## 11. 금지 지점

- **Protocol 우회** — 구현체가 프로토콜이 정의한 상태·전이·artifact를 생략하거나 단축하는 것.
- **CLI 우회 쓰기** — agent가 Edit/Write 도구로 `.geas/` 파일을 직접 수정하는 것.
- **Append-only 로그 수정** — 과거 review·verdict·run·entry 객체의 내용을 바꾸거나 삭제하는 것. 정정이 필요하면 새 item을 append한다.
- **Slot 정체성 위조** — agent가 자기 slot이 아닌 이름으로 evidence를 제출하는 것.
- **핵심 12 skill의 의미 임의 변경** — 이름이나 호출 패턴은 클라이언트별로 다를 수 있으나 단계별 책임과 산출물 관계는 프로토콜 그대로다.

---

부록으로 클라이언트별 매핑·현재 구현체 상태·이관 절차는 `docs/ko/reference/`에 둔다. 이 문서는 그것들과 독립적으로 구현 목표 구조를 기술한다.
