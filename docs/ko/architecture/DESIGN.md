# Geas 구현체 설계

이 문서는 Geas 프로토콜(`docs/ko/protocol/` 9 docs + `docs/schemas/` 14 schemas)을 여러 agent 클라이언트(Claude Code, Codex, opencode 등) 위에서 일관되게 실행하기 위해 구현체들이 공유해야 하는 공통 아키텍처 계약을 기술한다. 독자는 Geas를 하나 이상의 agent 클라이언트 위에 구축하거나 이식하려는 구현자다.

프로토콜 자체의 규칙·상태·artifact 의미는 이 문서가 아닌 protocol docs와 schema에 있다. 이 문서는 그 프로토콜을 구현체들이 같은 방식으로 실현하기 위해 공통으로 고정할 부분과 구현별 차이를 허용할 부분만 다룬다.

## 1. 개요

### 무엇인가

Geas는 상위 수준에서 두 층으로 구성된다.

1. **Protocol**: 불변 계약. 무엇이 발생해야 하는지, 어떤 artifact가 어떤 모양이어야 하는지 정의. `docs/ko/protocol/` 9 docs + `docs/schemas/` 14 schemas.
2. **Implementation Architecture Contract**: 여러 agent 클라이언트가 그 프로토콜을 일관되게 실행하기 위해 공유해야 하는 공통 아키텍처 계약. 이 문서의 주제.

이 문서는 두 층 중 두 번째 층을 다룬다. 상위 수준에서는 Protocol과 Implementation Architecture Contract로 나뉘고, 구현체 계약 내부는 다시 §3의 여섯 계층으로 분해된다.

Protocol이 최상위 불변 계약이다. 프로토콜이 바뀌면 이 문서와 개별 구현은 그에 맞춰 재설계되며, 그 반대는 아니다.

### 설계 목표

- **프로토콜 충실**: 구현체는 프로토콜이 정한 상태·전이·artifact를 한 치도 어긋나지 않게 실행한다.
- **클라이언트 중립**: 같은 프로토콜이 여러 agent 런타임(Claude Code, Codex, opencode 등) 위에서 동일하게 돈다.
- **쓰기 통로 단일화**: `.geas/` 모든 쓰기는 단일 CLI를 경유해 schema 검증과 atomic rename을 강제한다.
- **관측 가능**: artifact만 읽어도 mission이 어디까지 왔는지, 누가 무엇을 판단했는지 재구성 가능하다.
- **구현별 차이 허용 vs 공통 불변**: 클라이언트 어댑터, skill, agent roster는 공통 계약을 지키는 범위에서 구현별 차이를 둘 수 있지만 프로토콜, runtime state, CLI 계약은 공통으로 고정된다.

### 핵심 용어

본문 섹션에 들어가기 전 자주 쓰는 용어를 짧게 묶는다. 상세 정의는 해당 섹션 참조.

- **Slot**: 프로토콜이 정한 역할 자리 (orchestrator, decision-maker, design-authority, challenger, implementer, verifier, risk-assessor, operator, communicator 9개). §8.
- **Concrete agent type**: specialist 영역에서 slot에 바인딩될 수 있는 구현체 catalog의 정체성. 예: `software-engineer`, `platform-engineer`. §8.
- **Skill**: 프로토콜의 한 단계를 agent에게 실행시키는 prompt + 절차. §7.
- **메인 세션 (`main_session`)**: 사용자와 직접 대화하는 클라이언트 세션. orchestrator 역할을 담당한다. §8.
- **Spawn**: 메인 세션이 다른 slot을 별도 agent 실행 컨텍스트로 띄우는 행위. §9.
- **Client adapter**: 공유 skill·agent·CLI를 특정 agent 런타임에 bind하는 얇은 층. §9.

## 2. 설계 원칙

1. **Protocol as north star** — skill·CLI·agent는 프로토콜 변경에 맞춰 조정되며 반대 방향은 없다. 프로토콜 문서와 schema가 충돌의 정본이다.
2. **CLI-only writes** — `.geas/` 아래 어떤 쓰기도 CLI를 우회하지 않는다. 이 원칙은 모든 런타임에 동일하다. 다만 실제 차단 방식과 enforcement strength는 adapter마다 다를 수 있으며, 그 차이는 각 adapter 문서에서 명시한다.
3. **Evidence over declaration** — agent가 "done"이라 말해도 evidence 파일이 있기 전까지 상태는 전이하지 않는다. Transition guard는 주장 대신 artifact를 읽는다.
4. **Slot ≠ type ≠ runtime persona** — slot은 역할 자리이고, specialist concrete type은 구현체 catalog의 정체성이며, 실제 runtime persona는 그 아래 실행 수단이다. 한 concrete type이 여러 slot으로 바인딩될 수 있고 같은 slot을 여러 concrete type이 돌아가며 맡을 수 있다.
5. **Tool-agnostic skills** — skill 본문은 언어·프레임워크·패키지 매니저를 고정하지 않는다. 구체 도구 선택은 task contract(`verification_plan`)와 프로젝트 관례에 맡긴다.
6. **Append-only where provable** — 재판정·재시도가 있을 수 있는 판단 로그는 replace가 아닌 append로만 누적한다. 감사는 과거 결정의 흔적을 전제로 가능하다.
7. **Self-describing artifacts** — 모든 artifact는 `mission_id`를 포함하고 task-level artifact는 `task_id`도 포함한다. 파일을 경로와 분리해도 소속이 분명해야 한다.
8. **교체 가능 계층 명시** — 어떤 계층이 교체 가능한지, 어떤 계층이 불변인지 구현자가 혼동하지 않도록 선언한다 (§3 참조).

## 3. 계층 구조

구현체 계약은 여섯 계층으로 분해된다. 아래로 갈수록 공통 불변 계약이고, 위로 갈수록 그 계약 위에서 구현별 차이가 허용되는 층이다.

```
┌─ Client Adapter      ── 클라이언트별 (Claude Code / Codex / opencode)
├─ Skill               ── 공유: 프로토콜 단계별 실행 prompt
├─ Agent Roster        ── 공유: slot semantics + concrete agent type catalog
├─ CLI (geas)          ── 공유: .geas/ 쓰기 actuator
├─ Runtime State       ── 공유: .geas/ 디렉토리 포맷
└─ Protocol + Schemas  ── 불변 핵심
```

| 계층 | 역할 | 변형 가능성 |
|---|---|---|
| Client Adapter | 각 agent 런타임이 skill·agent·CLI를 bind하는 얇은 층 | 허용 |
| Skill | 프로토콜 단계를 agent에게 실행시키는 prompt·절차. 단계 책임과 required artifact는 고정 | 허용 |
| Agent Roster | protocol이 고정한 slot semantics를 concrete agent type catalog와 task별 binding 전략으로 실현 | 허용 |
| CLI (`geas`) | `.geas/`의 단일 쓰기 통로. Runtime State를 읽고 쓰며 schema 검증, 타임스탬프 주입, atomic rename, append-only 강제를 수행 | 공통 불변 |
| Runtime State | `.geas/` 디렉토리 포맷. 어떤 artifact가 어디에 존재해야 하는지와 파일 수준 규칙을 정의 | 공통 불변 |
| Protocol + Schemas | 프로토콜 문서와 JSON 스키마. 모든 artifact 구조와 상태 규칙의 정본 | 최상위 불변 |

Client Adapter, Skill, Agent Roster의 차이는 항상 아래 계층 계약을 침범하지 않는 범위에서만 허용된다. 예: agent roster에 새 specialist를 추가하거나 skill의 prompt wording을 바꾸는 것은 가능하지만, CLI 계약이나 Runtime State 포맷을 우회하거나 artifact 의미를 바꾸는 것은 허용되지 않는다.

## 4. Protocol + Schemas 층

이 문서는 protocol 또는 schema를 재술하지 않는다. 여기서 `Protocol`은 `docs/ko/protocol/` 아래 문서들과 `docs/schemas/` 아래 JSON schema를 함께 가리킨다. 이 섹션은 구현자가 참조해야 할 정본 포인터만 제공한다.

| 주제 | 문서 |
|---|---|
| 설계 축, 위험 | `docs/ko/protocol/00_PROTOCOL_FOUNDATIONS.md` |
| Agent slot, 권한 | `docs/ko/protocol/01_AGENTS_AND_AUTHORITY.md` |
| Mission phase, final verdict | `docs/ko/protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md` |
| Task lifecycle, evidence, gate, closure | `docs/ko/protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md` |
| Baseline, workspace, parallelism | `docs/ko/protocol/04_BASELINE_WORKSPACE_AND_PARALLELISM.md` |
| Runtime state, 재개 | `docs/ko/protocol/05_RUNTIME_STATE_AND_RECOVERY.md` |
| Memory | `docs/ko/protocol/06_MEMORY.md` |
| Debt, gap | `docs/ko/protocol/07_DEBT_AND_GAP.md` |
| Artifact 경로·스키마 registry | `docs/ko/protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` |

Artifact 구조의 최종 정본은 각 protocol 문서가 연결하는 `docs/schemas/*.schema.json`이다. 구현체 계약이 protocol 문서와 충돌하면 protocol 문서와 schema를 우선한다.

시각 다이어그램은 `docs/ko/DIAGRAMS.md`에 있다.

## 5. CLI `geas`

CLI는 `.geas/` 아래 모든 쓰기를 통과시키는 단일 actuator, 즉 유일한 쓰기 관문이다. 이 계층의 핵심 책임은 Runtime State에 대한 형식적 불변조건을 강제하는 것이다.

그 책임에는 schema 검증, 타임스탬프와 id 주입, atomic rename, append-only 강제, transition guard 같은 쓰기 enforcement가 포함된다. `schema template` 같은 agent 지원 기능도 CLI가 제공하지만, 이는 쓰기 관문 역할을 보조하는 부가 기능이다.

이 문서는 CLI의 계층상 책임과 경계만 다룬다. 명령 체계, 입력·출력 규약, 쓰기 파이프라인, 전이 guard 로직, append-only 검증 알고리즘, id 생성 규칙 같은 내부 계약은 `CLI.md`에서 상세히 기술한다.

## 6. Runtime State `.geas/`

```
.geas/
├── events.jsonl                              # 구현체 보조 — 필수 감사 로그 (append-only)
├── debts.json                                # project-level ledger (cross-mission)
├── missions/
│   └── {mission_id}/
│       ├── spec.json                         # mission-spec
│       ├── mission-design.md                 # mission-design
│       ├── mission-state.json                # mission-state
│       ├── phase-reviews.json                # append (reviews[])
│       ├── deliberations.json                # append (entries[], level=mission)
│       ├── mission-verdicts.json             # append (verdicts[])
│       ├── consolidation/
│       │   ├── gap.json
│       │   ├── memory-update.json
│       │   └── candidates.json                # 구현체 보조 — task evidence 집계본 (validate 대상 아님)
│       └── tasks/
│           └── {task_id}/
│               ├── contract.json             # task-contract
│               ├── implementation-contract.json
│               ├── self-check.json
│               ├── task-state.json
│               ├── gate-results.json         # append (runs[])
│               ├── deliberations.json        # append (entries[], level=task)
│               └── evidence/
│                   └── {agent}.{slot}.json   # append (entries[]) — (agent, slot) pair per file
└── memory/
    ├── shared.md
    └── agents/
        └── {agent_type}.md
```

`.geas/`는 두 계층으로 구성된다. **프로토콜 artifact**(각 schema가 관리하는 spec·contract·state·log 파일들)는 계약의 일부이며 `geas validate`의 검증 대상이다. **구현체 보조 파일**은 `.geas/` 안에 공존하지만 schema 검증 대상이 아니고 프로토콜 계약에 포함되지 않는다. `geas validate`는 프로토콜 artifact만 검사한다. 위 트리에서 특별 주석이 붙지 않은 파일은 전부 프로토콜 artifact다.

현재 구현체 보조 파일은 둘이다.

- `events.jsonl`: CLI가 프로토콜을 전진시키는 모든 mutation 명령 — 상태 전이, 승인, artifact append, single-artifact set 명령(`mission design-set`, `impl-contract set`, `memory shared-set`·`agent-set`, `gap set`, `memory-update set`) — 에서 append하는 감사 로그. 이벤트 기록은 best-effort로, primary artifact write가 atomic하며 권위를 가지고, 이벤트 append 실패는 primary write를 롤백하지 않고 삼킨다. 프로토콜 artifact는 아니지만 구현체가 필수로 유지한다. 각 줄은 독립 JSON object(`kind`, `actor`, `triggered_by`, `prior_event`, `created_at` 등)다. 런타임 경계 이벤트를 기록하는 구현체라면 SessionStart·SessionEnd 같은 항목도 여기에 append할 수 있다. 기록 대상과 shape의 owner는 CLI.md §14.6, 정본 kind 테이블은 HOOKS.md §4.2에 있다.
- `consolidation/candidates.json`: `geas consolidation scaffold`(CLI.md §14.4)가 현재 mission의 모든 task evidence에서 `debt_candidates`·`memory_suggestions`·`gap_signals`를 집계한 **편의용 집계본**이다. 승격의 단일 input이 아니다 — 원천 신호는 각 task의 evidence·closure·deliberation에 있고, orchestrator는 이 파일을 시작점으로 쓰되 필요 시 원천으로 돌아가 판단 근거를 확인한 뒤 project `debts.json`·mission `gap.json`·mission `memory-update.json`으로 승격한다. Stale 주의 — scaffold 실행 후 task evidence가 추가·변경되면 `candidates.json`은 그 변경을 반영하지 않는다. Orchestrator는 승격 직전에 `scaffold`를 다시 실행해 최신 집계를 얻어야 한다.

### 파일 owner 매트릭스

이 표의 Writer는 artifact의 판단과 내용을 소유하는 slot 또는 agent를 뜻한다. 실제 `geas` 호출은 런타임 제약에 따라 orchestrator가 proxy로 수행할 수 있지만, artifact의 semantic owner는 변하지 않는다. `candidates.json`·`events.jsonl`은 protocol artifact가 아닌 구현체 보조 파일이므로 이 매트릭스에서 제외한다.

| 파일 | Writer | 쓰기 시점 |
|---|---|---|
| `spec.json` | orchestrator | specifying |
| `mission-design.md` | design-authority | specifying |
| `mission-state.json` | orchestrator | phase·active task 변경 시 |
| `phase-reviews.json` | orchestrator | 각 phase gate 판정 후 |
| `deliberations.json` (mission) | orchestrator | deliberation 완료 후 |
| `mission-verdicts.json` | decision-maker | consolidating |
| `debts.json` (project-level) | orchestrator | 각 mission의 consolidating — 신규 register + 이번 mission에서 touched debt status update |
| `gap.json` | design-authority | consolidating |
| `memory-update.json` | orchestrator | consolidating |
| `contract.json` | design-authority | drafted 생성 시 |
| `implementation-contract.json` | implementer | implementing 진입 시 |
| `self-check.json` | implementer | 구현 완료 후 |
| `task-state.json` | orchestrator | lifecycle 전이·agent 활성화 시 |
| `gate-results.json` | orchestrator | 각 gate run 후 |
| `deliberations.json` (task) | orchestrator | deliberation 완료 후 |
| `evidence/{agent}.{slot}.json` | 해당 agent | 자기 evidence 제출 시 (한 agent가 여러 slot을 겸임하면 slot별로 파일 분리) |

`contract.approved_by`는 파일이 아닌 task-contract 안의 필드다. orchestrator가 `geas task approve --by user|decision-maker`를 호출해 값을 세팅한다. `user` 승인은 orchestrator가 사용자 대화로 확인한 뒤 대필하는 형식이고, `decision-maker` 승인은 스폰된 decision-maker의 판단을 orchestrator가 전달하는 형식이다. 어느 쪽이든 실제 CLI 호출은 orchestrator가 수행한다.

`mission-verdicts.json`은 이와 다르다. 스폰된 decision-maker subagent가 미션 artifact를 모두 읽은 뒤 직접 `geas mission-verdict append`를 호출한다. Subagent의 tool 호출을 허용하지 않는 런타임에서는 decision-maker가 판단 결과를 orchestrator에 반환하고 orchestrator가 CLI를 대신 호출하는 proxy 모델로 degrade한다. 어느 모델이든 semantic author는 decision-maker다.

### Append-only 불변성

다음 로그는 과거 item을 덮어쓰거나 삭제할 수 없다. 재시도·재판정도 새 item을 배열에 append한다.

- `phase-reviews.reviews`
- `mission-verdicts.verdicts`
- `gate-results.runs`
- `deliberations.entries`
- `evidence/{agent}.{slot}.entries`

CLI는 이 규칙을 강제한다 — append 외 연산은 거부한다. 이는 감사 가능성의 기초다.

### Drift 원칙

State 파일(`mission-state.json`, `task-state.json`)과 실제 artifact가 어긋나면 항상 artifact 쪽을 신뢰한다. State 파일은 인덱스이지 소유권 주장이 아니다. 자세한 재개 절차는 `docs/ko/protocol/05_RUNTIME_STATE_AND_RECOVERY.md`를 따른다.

## 7. Skill

Skill은 프로토콜 단계를 agent가 실행할 수 있게 노출하는 agent-facing 실행 인터페이스다. Skill은 공통 계약 전체를 담지 않으며, agent가 알아야 하는 절차, 분기, 필수 산출물, 입력 fragment만 드러낸다. 전체 schema, CLI 내부 알고리즘, runtime enforcement는 각각 Protocol + Schemas 층과 CLI 층의 책임으로 남는다.

따라서 Skill 계층에서 고정되는 것은 "어떤 단계에서 무엇을 남기고 어떤 CLI 관계를 갖는가"이지, 런타임별 wording이나 transport 자체가 아니다. Skill이 바뀐다면 원칙적으로 프로토콜 변경이나 실행 계약 조정에 따른 것이어야 하며, 특정 런타임의 표현 방식 차이만으로 바뀌어서는 안 된다.

### 7.1 공통으로 고정되는 것

- 핵심 skill 집합과 각 skill이 담당하는 프로토콜 단계
- `main_session` / `spawned` 실행 모델과 주된 slot
- 선행 artifact, 필수 산출물, 대표 CLI 호출 관계
- agent가 채워야 하는 입력 fragment와 실패 시 재시도 방식
- `.geas/` 쓰기를 CLI로만 수행한다는 실행 규율

### 7.2 Skill이 알 필요가 없는 것

- 전체 JSON schema 원문
- append-only 검증, transition guard, id/timestamp 주입 같은 CLI 내부 알고리즘
- root 탐색, atomic write, validate 구현 세부
- 런타임별 hook / middleware / callback 메커니즘

이 정보들은 공통 계약으로 고정될 수 있지만, owner는 Skill이 아니라 Protocol + Schemas, CLI, Client Adapter 층이다.

### 7.3 공유 source format

공유 repo에서 핵심 skill의 정본은 `skills/{name}/SKILL.md`에 둔다. 보조 설명이 필요하면 `references/`를, 실행 코드가 필요하면 `scripts/`를 함께 둘 수 있다. 이는 공통 계약 그 자체라기보다, 여러 adapter가 같은 skill 내용을 재사용하기 위한 공유 source format이다.

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

공유 source format 규칙:

- `SKILL.md`는 필수다.
- `references/`는 본문을 작게 유지하기 위한 progressive disclosure 장치다. 보조 자료의 진입점은 `SKILL.md` 하나로 유지하고, 깊은 중첩 링크 체인은 피한다.
- 경로는 모두 forward slash. Windows 경로 표기 금지.
- 본문이 길어지면 절차나 패턴을 `references/`로 분리한다.
- 실행 코드가 필요하면 `scripts/`를 둘 수 있다.

### 7.4 `SKILL.md` 최소 구조

`SKILL.md`는 YAML frontmatter + markdown 본문으로 구성한다. Frontmatter의 목적은 adapter가 공통 source를 런타임별 형식으로 변환할 때 안정적인 최소 metadata를 제공하는 것이다.

필수 frontmatter 필드:

```yaml
---
name: mission                     # 필수. 64자 이내, 소문자·숫자·하이픈만
description: >                    # 필수. 3인칭, 1024자 이내
  Runs the specifying phase — captures the mission spec, mission design,
  and initial task contract set with user approvals. Triggers at mission
  start before any building work.
---
```

- `name`은 stable identifier다. skill 집합 전체에서 일관된 naming convention을 유지한다.
- `description`은 이 skill이 무엇을 하고 언제 쓰이는지 요약한다. Adapter는 이 필드를 각 런타임의 help/registration metadata로 재사용할 수 있다.

각 skill의 실행 주체(`main_session` vs `spawned`)와 담당 slot은 아래 "Skill 계약" 테이블이 단일 진실원이다. 프로토콜이 정한 고정 매핑이므로 skill 파일 자체에 중복해서 쓰지 않는다.

본문은 agent가 실행에 필요한 정보만 담는다. 최소한 다음 내용이 드러나면 된다.

```markdown
# 목적
한 문단 — 이 skill이 프로토콜의 어느 단계를 담당하는가.

# 선행 조건
- 호출 전에 이미 존재해야 하는 artifact
- 요구되는 task/mission 상태

# 절차
체크리스트 형태로 작성한다. 단계마다 호출할 CLI 명령과 분기 조건 포함.

진행:
- [ ] 1. ...
- [ ] 2. ...

# 호출하는 CLI 명령
이 skill이 사용하는 `geas ...` 명령 목록.

# 산출물
실행 후 `.geas/`에 생기거나 갱신되는 파일.

# 실패 처리
- schema 검증 실패 → hints 읽고 재시도
- guard 실패 → 누락된 선행 조건 파악
- 그 외 이례 상황
```

CLI 내부 알고리즘, 전체 schema 원문, runtime별 interception 메커니즘 같은 정보는 여기에 복제하지 않는다. Skill은 agent 실행 인터페이스이지 전체 구현 문서가 아니다.

### 7.5 핵심 skill 계약

Skill 층은 17개 skill로 구성된다. 사용자 진입점은 `mission` 하나이며, 나머지는 dispatcher가 조건에 따라 invoke하는 sub-skill이다.

#### 사용자 호출 가능 (2)

| skill | `execution` | 담당 slot | 목적 |
|---|---|---|---|
| `mission` | `main_session` | orchestrator | Mission dispatcher — bootstrap, state 점검, phase별 sub-skill dispatch, briefing |
| `navigating-geas` | `main_session` | orchestrator | Skill 카탈로그·CLI·workflow 안내 |

#### Mission lifecycle sub-skills (8, main_session)

| skill | 담당 slot | dispatcher가 부르는 시점 | 주된 CLI |
|---|---|---|---|
| `specifying-mission` | orchestrator | specifying phase 진입, mission spec 미승인 | `mission create`, `mission approve`, `mission design-set` |
| `drafting-task` | orchestrator (필요 시 design-authority 자문) | 초기 task set 작성 또는 mission 중간 task 필요 | `task draft`, `task approve`, `task deps add` |
| `scheduling-work` | orchestrator | 승인된 task가 있고 dispatch 준비 | `task transition --to implementing` |
| `running-gate` | orchestrator | required reviewer와 verifier evidence가 모두 도착 | `gate run`, `task transition` |
| `closing-task` | orchestrator | gate pass 직후 | `evidence append --kind closure`, `task transition --to passed` |
| `reviewing-phase` | orchestrator | 해당 phase scope의 task가 전부 종결 | `phase-review append`, `mission-state update --phase` |
| `consolidating-mission` | orchestrator (gap에 design-authority spawn) | consolidating phase 진입 | `consolidation scaffold`, `debt register`, `gap set`, `memory-update set`, `memory shared-set`, `memory agent-set` |
| `verdicting-mission` | orchestrator (decision-maker spawn) | 모든 phase 종료 | `mission-verdict append` |

#### Multi-party (1, main_session)

| skill | 담당 slot | dispatcher가 부르는 시점 | 주된 CLI |
|---|---|---|---|
| `convening-deliberation` | orchestrator (voter spawn) | `mode == full_depth`에서 reviewer verdict 충돌, 구조적 이견, phase rollback | `deliberation append` |

#### Spawned agent procedures (6, spawned)

| skill | 담당 slot | spawn 시점 | 주된 CLI |
|---|---|---|---|
| `implementing-task` | implementer | 승인된 task가 dispatch됨 | `self-check append`, `evidence append --slot implementer` |
| `reviewing-task` | challenger / risk-assessor / operator / communicator | 구현 evidence와 self-check 제출 후 | `evidence append --slot <reviewer>` |
| `verifying-task` | verifier | reviewer concurrence 완료 후 | `evidence append --slot verifier` |
| `deliberating-on-proposal` | 호출된 voter slot | `convening-deliberation`이 소집 | (직접 write 없음 — vote 반환) |
| `designing-solution` | design-authority | mission design 작성, task 구조 review, gap 분석 | `mission design-set`, `evidence append --slot design-authority`, `gap set` |
| `deciding-on-approval` | decision-maker | mission spec 승인, task 승인, phase-review, mission-verdict | `evidence append --slot decision-maker`, `task approve`, `phase-review append`, `mission-verdict append` |

17개 skill의 단계 책임과 산출물 관계는 공통 계약으로 고정된다. Sub-skill은 `mission` dispatcher 외에는 invoke되지 않으며(sub-skill frontmatter에 `user-invocable: false`), 사용자 수동 호출과 Claude auto-trigger는 dispatcher 단독 결정 원칙을 깨지 않는 범위로 제한된다. Skill 이름과 문장 스타일은 adapter별로 달라질 수 있지만 이 표가 가리키는 단계 책임과 산출물 관계는 바뀌지 않는다.

### 7.6 Skill 규약

- **Tool-agnostic**: skill 본문은 특정 언어·프레임워크·패키지 매니저를 가정하지 않는다. 도구 선택은 task contract의 `verification_plan`과 프로젝트 관례가 결정한다.
- **CLI 지시만**: `.geas/` 쓰기는 반드시 CLI 명령으로 지시한다. "이 JSON을 이 경로에 저장해" 같은 직접 쓰기 지시 금지.
- **Agent-facing input fragment만 노출**: skill은 artifact 전체 schema를 복제하지 않고, agent가 실제로 채워야 하는 필드 조각만 노출한다. CLI가 자동 주입하는 필드와 schema 전체 구조는 다른 계층의 책임으로 남는다. Agent가 필요한 입력 조각을 skill에서 확신할 수 없을 때만 `geas schema template`을 fallback으로 호출한다.
- **Feedback loop**: CLI 실패는 응답의 `hints`를 읽어 재시도한다. Gate 실패나 schema 검증 실패 같은 품질 중요 구간도 "run → read hint → fix → retry" 루프로 설계한다.
- **단계 계약 보존**: wording과 예시는 바뀔 수 있지만 선행 조건, 필수 산출물, CLI 관계, 분기 의미는 보존해야 한다.
- **Progressive disclosure**: 상세 패턴이나 예시는 `references/`로 분리해 본문에는 실행에 필요한 최소 절차만 둔다.
- **Why, not just what**: 규칙을 적을 때 그 이유를 명시한다. Agent가 skill에 없는 상황으로 일반화할 때 "왜"가 판단 근거가 된다.

### 7.7 유틸리티 skill

핵심 skill 외 프로젝트 편의를 위한 skill은 허용된다. Frontmatter와 디렉토리 규약은 핵심 skill과 동일하게 유지하되, 이런 skill은 프로토콜 필수가 아니므로 클라이언트별로 더하거나 뺄 수 있다.

- `/setup` — 프로젝트에 `.geas/` 초기화 (main_session, orchestrator)
- `/help` — skill·명령 탐색 안내 (main_session, orchestrator)

유틸리티 skill은 핵심 skill의 단계 책임을 대체해서는 안 된다. 추가한다면 실행 주체와 slot 매핑을 문서화해 핵심 skill과 혼동되지 않게 유지한다.

## 8. Agent Roster

Agent Roster는 protocol이 고정한 slot semantics와 authority 경계를 현재 구현체의 concrete agent type catalog와 task별 binding 전략으로 실현하는 층이다. Slot의 의미와 권한 경계 자체는 `docs/ko/protocol/01_AGENTS_AND_AUTHORITY.md`가 owner이고, 이 섹션은 그 고정된 slot들을 어떤 agent type 집합으로 제공하고 task별로 어떻게 바인딩하는지만 다룬다.

### Slot → agent 매핑

프로토콜은 9개 slot을 정의한다. Agent Roster는 authority slot에는 고정 agent 정의를, specialist slot에는 concrete agent type catalog를 제공한다. 실제 task에서 어떤 specialist slot에 어떤 concrete type을 바인딩할지는 task contract의 `routing`과 adapter가 함께 결정한다.

| slot | 역할 | 활성화 방식 | 도메인 변형 |
|---|---|---|---|
| `orchestrator` | mission 제어, task 전이, closure evidence 작성, 사용자 대화 | 메인 세션 (agent 파일 없음) | 없음 |
| `decision-maker` | mission final verdict, 중간 scope 내 task 승인, standard mission의 mission design·초기 task set 리뷰 | `spawned` | 없음 |
| `design-authority` | mission design, task 분해, gap 작성 | `spawned` | 없음 |
| `challenger` | 반대 의견, deliberation 참여 | `spawned` | 없음 |
| `implementer` | 구현 + self-check + implementation evidence | `spawned` | 도메인별 |
| `verifier` | 독립 검증 | `spawned` | 도메인별 |
| `risk-assessor` | 위험 리뷰 | `spawned` | 도메인별 |
| `operator` | 운영 리뷰 | `spawned` | 도메인별 |
| `communicator` | 문서·전달 리뷰 | `spawned` | 도메인별 |

Orchestrator는 agent 파일로 존재하지 않는다. 사용자와 직접 대화하는 메인 세션이 orchestrator 역할을 담당한다. mission, gate-run, task-close, phase-review 같은 메인 세션 skill은 이 세션 안에서 실행된다. 다른 slot은 필요할 때 orchestrator가 선택한 authority agent 또는 specialist concrete type으로 실행된다.

Authority slot 중 orchestrator 외 셋(decision-maker, design-authority, challenger)은 domain과 무관하게 slot-fixed agent 정의를 갖는다. Specialist slot 다섯은 구현체가 제공하는 concrete agent type catalog를 사용하고, task별 routing이 그중 어떤 type을 어떤 slot에 바인딩할지 정한다.

### Agent 파일 배치

```
agents/
├── authority/
│   ├── decision-maker.md
│   ├── design-authority.md
│   └── challenger.md
└── specialist/
    ├── software/
    │   ├── software-engineer.md
    │   ├── platform-engineer.md
    │   ├── qa-engineer.md
    │   ├── security-engineer.md
    │   └── technical-writer.md
    └── research/
        ├── research-engineer.md
        ├── evaluator.md
        ├── research-operator.md
        └── research-writer.md
```

### Agent 파일 포맷 (portable core)

Agent 파일은 클라이언트 런타임마다 실제 포맷이 다르다. 공유 repo에서는 다음 portable core를 쓰고, 각 client adapter가 자기 런타임 포맷으로 rewrap한다. 여기서 authority 파일은 slot-fixed agent 정의의 공통 source이고, specialist 파일은 concrete agent type 정의의 공통 source다. Adapter는 이를 각 런타임의 실제 agent/persona 형식으로 변환한다.

```yaml
---
name: decision-maker        # 필수. authority는 slot 이름, specialist는 concrete type 이름
description: >              # 필수. 3인칭, 언제 이 agent가 쓰이는지
  Issues mission final verdicts, approves mid-mission scope-inside tasks,
  and pre-approves mission design in standard mode.
---

# Role body
이 agent의 system prompt 본문. slot 책임, 권한 경계, 기본 stance, 어떤 skill을 실행할 때 어떤 자세인지.
```

`name`과 `description` 두 필드만 필수다. 본문은 자유 markdown이다. Authority agent 정의의 slot은 파일 경로(`agents/authority/{slot}.md`)로 결정된다. Specialist agent 정의의 domain과 concrete type은 파일 경로(`agents/specialist/{domain}/{type}.md`)로 결정되고, 어떤 slot에 바인딩될지는 task contract의 `routing`과 adapter가 런타임 시점에 결정한다. Agent 파일 사이의 cross-reference나 런타임 도구(`allowed_tools` 등)는 adapter별 rewrap 때 추가한다.

### 도메인 프로필

도메인 프로필은 구현체가 specialist concrete agent type catalog를 조직하기 위해 둘 수 있는 선택적 개념이다. 현재 protocol artifact와 schema는 이를 mission spec의 필수 필드로 고정하지 않는다. 따라서 어떤 구현체는 명시적 profile을 둘 수 있고, 다른 구현체는 profile 없이 전체 catalog에서 task별 routing으로 직접 concrete type을 선택할 수도 있다.

명시적 도메인 프로필을 쓰는 구현체라면, 그 프로필은 "이 mission에서 기본적으로 어떤 specialist concrete agent type 집합을 우선 사용할 것인가"를 정하는 선택 전략으로 작동한다. 이 경우에도 skill·CLI·프로토콜은 동일하게 작동하며, 바뀌는 것은 사용 가능한 specialist concrete type의 기본 후보 집합뿐이다.

### Agent ≠ 정체성

하나의 concrete agent type이 task에 따라 서로 다른 specialist slot으로 바인딩될 수 있다. 예를 들어 `platform-engineer`가 어떤 task에서는 `implementer`, 다른 task에서는 `operator`로 일할 수 있다. 하지만 protocol이 읽는 것은 언제나 slot semantics이고, 어떤 concrete type이 그 slot을 수행했는지는 task contract의 `routing`과 `evidence/{agent}.{slot}.json` 경로 및 내부 `agent`·`slot` 필드로 복원된다. 독립성이 요구되는 경우(예: implementer 직후 verifier)는 adapter가 별도 컨텍스트를 강제하거나 최소한 role separation이 audit 가능하게 드러나도록 해야 한다.

## 9. Client Adapter

Client adapter는 공유 skill·agent·CLI를 특정 agent 런타임에서 실행 가능하게 연결하는 투영 계층이다. Adapter는 공통 계약의 의미를 재해석하지 않으며, 이를 각 런타임의 세션 모델, agent 모델, command transport에 맞게 실어 나른다.

DESIGN 관점에서 adapter의 최소 책임은 다음 다섯 가지다.

- 메인 세션을 orchestrator로 유지한다.
- 공유 skill source와 agent source를 해당 런타임 형식으로 노출한다.
- authority slot과 specialist concrete type을 task contract의 `routing`에 맞게 바인딩한다.
- `spawned` 실행을 해당 런타임의 별도 컨텍스트 또는 동등한 메커니즘에 연결한다.
- `geas` CLI와 `.geas/` 읽기를 런타임에서 사용할 수 있게 연결한다.

런타임마다 세션 지속성, sub-agent 방식, 자동 interception 지점, source transport 형식은 달라질 수 있다. 이런 차이는 execution strategy와 enforcement strength를 바꿀 수는 있지만, protocol semantics나 artifact 의미를 바꾸어서는 안 된다.

특히 `.geas/` 직접 쓰기 차단, context 복원, session 경계 기록, 외부 수정 감지 같은 자동 enforcement 지점은 런타임마다 강도가 다를 수 있다. 일부 런타임은 위반 시도 자체를 차단할 수 있지만, 일부는 agent discipline과 사후 검사에 더 의존한다.

## 10. 확장 포인트

- **specialist catalog 확장** — 구현체는 새로운 specialist concrete agent type, type 조합, 또는 task별 binding 전략을 추가할 수 있다. 공유 source layout을 쓰는 구현체라면 보통 `agents/specialist/` 아래에 이를 배치한다.
- **새 클라이언트 어댑터** — 구현체는 새로운 agent 런타임을 위한 adapter를 추가할 수 있다. 중요한 것은 §9의 최소 책임을 충족하는 것이지, 세션 모델이나 transport 방식을 기존 구현과 같게 맞추는 것이 아니다.
- **새 utility skill** — 핵심 skill 외에 프로젝트 편의를 위한 skill은 자유롭게 추가 가능하다. 이름, registration 방식, 노출 형식은 구현체가 정할 수 있다. 단 프로토콜 단계의 필수 skill을 대체하지 않는다.
- **대시보드·관측 도구** — `.geas/` artifact를 읽기 전용으로 소비하는 도구는 자유롭게 추가 가능하다. 저장 위치나 관측 방식은 구현체가 정할 수 있으며, 쓰기가 필요하면 CLI를 경유한다.

## 11. 금지 지점

- **Protocol 우회** — 구현체가 프로토콜이 정의한 상태·전이·artifact를 생략하거나 단축하는 것.
- **CLI 우회 쓰기** — agent가 Edit/Write 도구로 `.geas/` 파일을 직접 수정하는 것.
- **Append-only 로그 수정** — 과거 review·verdict·run·entry 객체의 내용을 바꾸거나 삭제하는 것. 정정이 필요하면 새 item을 append한다.
- **Slot 정체성 위조** — agent가 자기 slot이 아닌 이름으로 evidence를 제출하는 것.
- **핵심 skill의 의미 임의 변경** — 이름이나 호출 패턴은 클라이언트별로 다를 수 있으나 단계별 책임과 산출물 관계는 프로토콜 그대로다.

---

부록으로 클라이언트별 매핑·현재 구현체 상태·이관 절차는 `docs/ko/reference/`에 둔다. 이 문서는 그것들과 독립적으로 구현 목표 구조를 기술한다.
