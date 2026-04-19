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

## 3. Protocol 층

이 문서는 protocol을 재술하지 않는다. 아래 포인터만 둔다.

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

Writer는 반드시 CLI를 경유한다. "Writer"는 실제 `.geas/` 파일을 쓰라는 지시를 내리는 slot을 뜻한다.

| 파일 | Writer | 쓰기 시점 |
|---|---|---|
| `spec.json` | orchestrator | specifying |
| `mission-design.md` | design-authority | specifying |
| `mission-state.json` | orchestrator | phase·active task 변경 시 |
| `phase-reviews.json` | orchestrator | 각 phase gate 판정 후 |
| `deliberations.json` (mission) | orchestrator (기록자) | deliberation 완료 후 |
| `mission-verdicts.json` | decision-maker | consolidating |
| `debts.json` | orchestrator | consolidating |
| `gap.json` | design-authority | consolidating |
| `memory-update.json` | orchestrator | consolidating |
| `contract.json` | design-authority | drafted 생성 시 |
| `contract.approved_by` | user 또는 decision-maker | 승인 시 |
| `implementation-contract.json` | implementer | implementing 진입 시 |
| `self-check.json` | implementer | 구현 완료 후 |
| `task-state.json` | orchestrator | lifecycle 전이·agent 활성화 시 |
| `gate-results.json` | orchestrator | 각 gate run 후 |
| `deliberations.json` (task) | orchestrator | deliberation 완료 후 |
| `evidence/{agent}.json` | 해당 slot | 자기 evidence 제출 시 |

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

Skill은 프로토콜 단계를 실제 agent에게 실행시키는 prompt + 절차 묶음이다. Skill 본문은 어떤 agent가 어떤 slot 역할로 실행하든 동일하게 읽힌다. Skill이 바뀌면 프로토콜 변경에 맞춘 것이지 agent 구현체 변경 때문이 아니다.

### 핵심 skill 12개

각 skill은 프로토콜의 한 단계에 1:1로 대응한다.

| skill | 호출 slot | 목적 | 주된 CLI 호출 |
|---|---|---|---|
| `/mission-init` | orchestrator | specifying phase 실행 — mission spec·design·초기 task 집합 작성과 사용자 승인 받기 | `mission create`, `mission design-set`, `task draft`, `task approve` |
| `/task-draft` | design-authority | mission 진행 중 새 task contract 작성 | `task draft`, `task approve` |
| `/task-implement` | implementer | implementation contract 작성 → 구현 → self-check → implementation evidence | `impl-contract set`, `self-check set`, `evidence append` |
| `/task-review` | risk-assessor, operator, communicator, challenger | review evidence 제출 | `evidence append` |
| `/task-verify` | verifier | 독립 검증 수행 + verification evidence 제출 | `evidence append` |
| `/gate-run` | orchestrator | Tier 0 → 1 → 2 evidence gate 실행 | `gate run`, `task transition` |
| `/task-close` | orchestrator | closure evidence 작성 (approved / changes_requested / escalated / cancelled) | `evidence append`, `task transition` |
| `/deliberation` | 여러 slot | mission 또는 task 수준 다자 심의 | `deliberation append` |
| `/phase-review` | orchestrator | phase gate 판정 및 review 기록 | `phase-review append`, `mission-state update` |
| `/mission-consolidate` | orchestrator + design-authority | consolidating phase — debts, gap, memory-update 작성 | `debt register`, `gap set`, `memory-update set` |
| `/mission-verdict` | decision-maker | mission final verdict 작성 | `mission-verdict append` |
| `/resume` | orchestrator | context 유실 후 `.geas/` 읽고 현재 지점 재구성 | `resume` (CLI 출력 소비) |

### Skill 규약

- **Tool-agnostic**: skill 본문은 특정 언어·프레임워크·패키지 매니저를 가정하지 않는다. 도구 선택은 task contract의 `verification_plan`이나 프로젝트 관례가 결정한다.
- **CLI 지시만**: skill이 `.geas/`에 무언가 쓰게 할 때는 반드시 CLI 명령으로 지시한다. "이 JSON을 이 경로에 저장해" 같은 직접 쓰기 지시는 금지.
- **Schema template 선조회**: 새 artifact를 만들 때 skill은 먼저 `geas schema template <type>`을 호출해 필수 필드 골격을 받고 채운다.
- **Error hint 소비**: CLI 명령이 실패하면 skill은 error의 `hints`를 읽어 누락 필드를 보충하고 재시도한다.

### 유틸리티 skill

핵심 12개 외에 구현체 편의용 skill이 추가될 수 있다.

- `/setup` — 프로젝트에 `.geas/` 초기화
- `/help` — skill·명령 탐색 안내

유틸리티는 프로토콜에 필수가 아니므로 클라이언트별로 더하거나 뺄 수 있다.

## 7. Agent Roster

### Slot → agent 매핑

프로토콜은 9개 slot을 정의한다. 각 slot은 하나 이상의 concrete agent가 맡는다.

| slot | 역할 | 도메인 변형 유무 |
|---|---|---|
| `orchestrator` | mission 제어, task 전이, closure evidence 작성 | 없음 |
| `decision-maker` | mission final verdict, 중간 task 승인, standard 선승인 | 없음 |
| `design-authority` | mission design, task 분해, gap 작성 | 없음 |
| `challenger` | 반대 의견, deliberation 참여 | 없음 |
| `implementer` | 구현 + self-check + implementation evidence | 도메인별 |
| `verifier` | 독립 검증 | 도메인별 |
| `risk-assessor` | 위험 리뷰 | 도메인별 |
| `operator` | 운영 리뷰 | 도메인별 |
| `communicator` | 문서·전달 리뷰 | 도메인별 |

Authority slot 넷은 domain과 무관하게 단일 agent 정의를 갖는다. Specialist slot 다섯은 도메인 프로필이 concrete agent를 제공한다.

### Agent 파일 배치

```
agents/
├── authority/
│   ├── orchestrator.md
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

### 도메인 프로필

도메인 프로필은 "이 프로젝트에서 specialist slot들이 어떤 concrete agent로 해석되는가"를 선언한다. Mission spec의 단일 필드 또는 프로젝트 설정이 프로필을 선택한다. 프로필이 바뀌어도 skill·CLI·프로토콜은 동일하게 작동한다.

### Agent ≠ 정체성

한 concrete agent가 여러 slot을 겸임할 수 있다. 예: 한 software-engineer agent가 implementer로 작업한 task의 verifier까지 맡는 것은 허용되지 않지만(독립성 요구), 다른 task에서는 operator 역할을 맡을 수 있다. 어떤 slot으로 작업하고 있는지는 evidence 파일의 경로와 내부 `agent` 필드로 드러난다.

## 8. Client Adapter

Client adapter는 공유 skill·agent·CLI를 특정 agent 런타임이 실행할 수 있는 형태로 bind하는 얇은 층이다. 각 어댑터가 책임지는 일은 셋이다.

1. **Skill loading**: 공유 skill 본문을 해당 런타임의 네이티브 skill/command 포맷으로 등록.
2. **Agent loading**: 공유 agent 정의를 런타임의 agent/프롬프트 형식으로 등록.
3. **CLI invocation**: skill이 CLI 명령을 부르면 런타임이 그 명령을 실행하도록 함. (쉘 실행, 서브프로세스, 플러그인 bridge 등)

### 공통 기대 동작

어떤 클라이언트든 다음을 제공해야 한다.

- Skill 본문을 agent에게 전달할 수 있는 경로 (예: slash 명령, AGENTS.md, 직접 프롬프트)
- Agent 정체성을 slot에 바인딩하는 방법
- CLI 실행 (shell 또는 동등 통로)
- `.geas/` 읽기 (artifact 확인용)

### 선택적 강화

다음은 있으면 좋지만 없어도 프로토콜은 작동한다. 강화 수단이 없는 클라이언트는 해당 책임을 agent discipline과 CLI 명시 호출로 대신한다.

- `.geas/` 직접 쓰기 차단 (PreToolUse 훅 등): CLI-only 규약을 runtime이 강제
- Context 유실 후 자동 `/resume` 실행 (PostCompact 훅 등): 없는 환경에서는 agent가 감지 후 수동 호출
- Session 경계 이벤트 기록 (SessionStart/End 훅 등): CLI `event log` 직접 호출로 대체

### 구체 클라이언트

각 클라이언트의 구체적 hook·skill·agent 매핑 세부는 이 문서가 아닌 reference 문서에 둔다. 클라이언트별 매핑이 바뀌어도 DESIGN 계층 구조는 영향받지 않는다.

## 9. 설계 원칙

1. **Protocol as north star** — skill·CLI·agent는 프로토콜 변경에 맞춰 조정되며 반대 방향은 없다. 프로토콜 문서와 schema가 충돌의 정본이다.
2. **CLI-only writes** — `.geas/` 아래 어떤 쓰기도 CLI를 우회하지 않는다. Agent가 Edit/Write로 직접 건드리면 schema 보장과 append-only 불변성이 즉시 깨진다.
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
