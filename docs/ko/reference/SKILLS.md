# Skill 레퍼런스

Skill은 orchestrator의 실행 지침이다. 각 skill은 Geas 프로토콜(doc 02–07)의 특정 단계를 세션에서 읽어 재사용할 수 있는 프롬프트로 고정한다. Skill이 `.geas/`를 직접 쓰지는 않는다 — 모든 쓰기는 `geas` CLI를 통한다. 이 문서는 Phase 1 산출(v3) 기준으로 어떤 skill이 있고, 언제 실행되며, 어떤 CLI 명령을 호출하고, 무엇을 산출하는지를 정리한다.

CLI 계약 원본은 `architecture/CLI.md`를 본다. 이 문서는 소비자 관점이며 CLI 계약을 중복 기술하지 않는다.

---

## 1. Skill 목록

모든 skill은 `plugin/skills/{name}/SKILL.md` 아래에 위치한다. Orchestrator(`mission`)가 세션 진입점이며, 나머지 skill은 정해진 phase 전이 시점에 `mission`이 호출한다. 사용자가 직접 호출할 수 있는 것은 `mission`과 `help` 둘 뿐이다.

| Skill | 한 줄 설명 | Phase · 호출 시점 | 사용자 호출 가능 |
|---|---|---|---|
| `mission` | specifying → building → polishing → consolidating 전체 mission 흐름 구동 | 세션 진입점 | 가능 — `/geas:mission` |
| `intake` | 섹션 단위 승인으로 mission spec 확정 | specifying phase (미션당 1회) | 불가 |
| `task-compiler` | 범위 단위를 검증 가능한 acceptance criteria 기반 TaskContract로 컴파일 | specifying(초기 task 집합) + 미션 진행 중(범위 내 추가) | 불가 |
| `implementation-contract` | 구현 전 합의 — 구현자가 계획을 제안하고 reviewer가 사전 승인 | `ready` 직후, 첫 evidence append 전 | 불가 |
| `scheduling` | 충돌 규칙 하에서 ready task를 병렬 배치로 구성 | building phase, ready task 2개 이상 | 불가 |
| `evidence-gate` | Tier 0 / Tier 1 / Tier 2 실행 후 `gate-results` run 기록 | 모든 필수 reviewer · verifier evidence가 존재할 때 | 불가 |
| `verify-fix-loop` | 마지막 gate 결과 기준의 제한된 수정-재검증 루프 | Gate verdict가 `fail`일 때 | 불가 |
| `vote-round` | 심의 소집과 단일 vote entry append | full_depth mission에서 task/mission 집단 판단이 필요할 때 | 불가 |
| `memorizing` | task 학습과 retrospective로 `memory/shared.md`, `memory/agents/{type}.md` 재작성 | consolidating phase | 불가 |
| `setup` | 프로젝트 루트에 `.geas/` 초기화 | 새 프로젝트 첫 턴 | 불가 (`mission`이 호출) |
| `help` | geas 사용법 대화형 안내 | 사용자가 질문할 때 | 가능 — `/geas:help` |

v3에서 제거된 항목 (v2 문서에는 존재): `policy-managing`, `reporting`. 규칙 오버라이드와 건강 신호 보고는 더 이상 skill 단위 표면이 아니다.

---

## 2. Skill별 상세

### 2.1 `mission`

**목적.** Orchestrator. 메인 세션에서 직접 실행한다 — sub-agent로 스폰하면 안 된다. 프로토콜을 직접 읽고 각 phase를 하위 skill로 밀어낸다.

**실행 시점.** 세션 진입, 사용자가 `/geas:mission` 호출.

**호출하는 CLI.**
- `geas setup` (`.geas/`가 없을 때) — `setup` skill 경유.
- `geas mission create`, `geas mission approve`, `geas mission state` — mission artifact 연산.
- `geas mission-state update --phase <phase>` — phase 전이.
- `geas phase-review append`, `geas mission-verdict append` — phase gate와 final verdict.
- `geas task draft`, `geas task approve`, `geas task transition` — task 단위 연산.
- `geas gate run` — reviewer evidence 완비 후.
- `geas deliberation append --level mission|task` — `vote-round` 경유.
- `geas debt register`, `geas debt update-status` — polishing / consolidating.
- `geas consolidation scaffold`, `geas gap set`, `geas memory-update set` — consolidating phase.
- `geas context`, `geas status` — 상황 인식.

**주 산출물.** mission이 만드는 모든 것 — spec, design, task contract, evidence chain, gate run, verdict, debt, gap, memory-update — 위 CLI 명령을 거쳐 기록된다.

### 2.2 `intake`

**목적.** 자연어 요청을 승인된 mission spec, 승인된 mission design, 승인된 초기 task 집합으로 전환한다.

**실행 시점.** Specifying phase, orchestrator가 구동. 섹션 단위로, 한 번에 한 질문씩.

**호출하는 CLI.**
- `geas mission create` — 초기 `spec.json` 작성.
- `geas mission design-set` — 필요한 경우 `mission-design.md` 작성.
- `geas mission approve` — user-approved 표시.
- `geas task draft` — 초기 task마다 1회 호출.

**주 산출물.** `missions/{mid}/spec.json`, 선택적 `missions/{mid}/mission-design.md`, drafted 상태의 초기 `tasks/{tid}/contract.json` 집합.

### 2.3 `task-compiler`

**목적.** 범위 한 조각으로부터 TaskContract를 하나 만든다: routing(구체 implementer + 필수 reviewer slot), surfaces, verification plan, dependencies, baseline snapshot.

**실행 시점.** Specifying에서 초기 task 집합을 만들 때, 그리고 미션 진행 중에 decision-maker가 범위 내 추가를 승인할 때. 범위 바깥 추가는 사용자 승인이 필요하다(decision-maker는 범위 내에서만 권한이 있다).

**호출하는 CLI.**
- `geas task draft` — `contract.json` 작성 및 `task-state.json`(drafted) 초기화.

**주 산출물.** `tasks/{tid}/contract.json` + 스캐폴드된 `tasks/{tid}/task-state.json`과 evidence 디렉토리.

### 2.4 `implementation-contract`

**목적.** 코드 작성 전에 범위 · 요구사항 오해를 조기에 걸러낸다. 구현자가 `planned_actions`, `edge_cases`, `demo_steps`를 초안하고 quality specialist와 design authority가 검토한다.

**실행 시점.** `task transition --to ready` 성공 직후, 첫 evidence append 전. 구현 도중 수정(amendment)도 같은 skill이 담당한다.

**호출하는 CLI.**
- `geas evidence append --slot implementer`에 `evidence_kind: plan-proposal` — 구현자의 제안 행동.
- `geas evidence append --slot reviewer`에 `evidence_kind: review` — reviewer 승인.

**주 산출물.** `tasks/{tid}/evidence/` 아래에 review로 승인된 `plan-proposal` evidence entry.

### 2.5 `scheduling`

**목적.** 표면 충돌, critical-risk solo 규칙, baseline snapshot을 지키면서 ready task를 병렬 배치로 묶는다.

**실행 시점.** Building phase, `ready` task가 2개 이상일 때.

**호출하는 CLI.**
- `geas task state`, `geas mission state` — 읽기 전용 조회.

Scheduling은 배치 판단이다. Orchestrator가 판단 결과에 따라 구현자를 dispatch하고, 구현자가 각자 CLI 호출로 쓴다.

**주 산출물.** 현재 배치에 대한 dispatch plan. `.geas/`에는 쓰지 않는다.

### 2.6 `evidence-gate`

**목적.** 한 task의 evidence가 close 가능한지를 판정하는 객관적 gate. `pass` / `fail` / `block` / `error` 중 하나를 반환한다.

**실행 시점.** `contract.routing.required_reviewers`의 모든 slot이 entry ≥1의 evidence 파일을 갖고, 모든 verifier(있다면) 실행이 끝난 뒤.

**호출하는 CLI.**
- `geas gate run` — `gate-results.runs`에 run 기록. 응답에 `suggested_next_transition` hint가 포함되며, 따르는 판단은 orchestrator 몫이다.

**주 산출물.** `tasks/{tid}/gate-results.json`에 새 entry.

### 2.7 `verify-fix-loop`

**목적.** Gate가 `fail`을 반환했을 때의 제한된 수정 → 재검증 루프. `task-state.json`의 `verify_fix_iterations`를 읽고 구체적 실패 맥락과 함께 구현자를 dispatch하여 `evidence-gate`를 재실행한다. 예산 소진 시 escalation.

**실행 시점.** 마지막 `gate run`이 `verdict: fail`을 반환한 경우. `block`, `error`, `pass`에는 실행하지 않는다.

**호출하는 CLI.**
- `geas task-state update` — 반복 횟수 등 bookkeeping.
- `geas evidence append --slot implementer`에 `evidence_kind: implementation` — 재시도 기록.
- `geas gate run` — 반복마다 재실행.
- `geas task transition --to escalated` — 예산 소진 시.

**주 산출물.** 새 implementation evidence entry, 새 `gate-results.runs` entry, 필요 시 `escalated` 전이.

### 2.8 `vote-round`

**목적.** `geas deliberation append`의 얇은 소집 래퍼. Voter를 스폰해 agree / disagree / escalate vote를 근거와 함께 모으고, 단일 deliberation entry를 append한다.

**실행 시점.** `mission.mode == full_depth`일 때만 — CLI가 강제한다. Task-level 트리거: reviewer verdict 충돌, challenger의 구조적 이의, 비자명한 rewind target. Mission-level 트리거는 doc 02를 따른다(설계 분기, 전략적 판단).

**호출하는 CLI.**
- `geas deliberation append --level mission|task [--task <tid>]`.

**주 산출물.** `deliberations.entries`에 새 entry 1개. Challenger는 필수 voter다.

### 2.9 `memorizing`

**목적.** 미션에서 누적된 `memory_suggestions`와 closure retrospective로부터 `memory/shared.md`, `memory/agents/{type}.md`를 재작성한다. Patch가 아닌 full-replace 의미론 — skill이 새 파일을 조립하고 CLI가 원자 교체한다.

**실행 시점.** Consolidating phase.

**호출하는 CLI.**
- `geas memory shared-set` — `memory/shared.md` 전체 교체.
- `geas memory agent-set --agent <type>` — `memory/agents/{type}.md` 전체 교체.
- `geas memory-update set` — 의미적 changelog 기록(doc 07 기준 markdown과 changelog는 쌍으로 쓴다).

**주 산출물.** 재작성된 memory markdown 파일과 `missions/{mid}/consolidation/memory-update.json`.

### 2.10 `setup`

**목적.** Doc 08 기준으로 `.geas/` 트리를 초기화한다. 멱등이며 재실행 안전.

**실행 시점.** 새 프로젝트 첫 턴. Orchestrator가 `.geas/`가 없을 때 방어적으로 호출하기도 한다.

**호출하는 CLI.**
- `geas setup` (유일).

**주 산출물.** `.geas/` 골격(비어 있는 `missions/`, `memory/`, `events.jsonl` 헤더 등).

### 2.11 `help`

**목적.** 대화형 안내. `.geas/` 상태가 있으면 읽고 사용법 · 개념 질문에 markdown으로 답한다.

**실행 시점.** 사용자가 `/geas:help` 호출.

**호출하는 CLI.** 쓰기 없음. 답변 근거를 위해 `geas context`, `geas status`를 읽을 수 있다.

**주 산출물.** 채팅에 markdown 응답만. 파일을 쓰지 않는다.

---

## 3. Skill → CLI 매핑

빠른 조회용이다. 명령 상세(플래그, JSON shape, 실패 모드)는 `architecture/CLI.md` 참조.

| Skill | CLI 명령(정식) |
|---|---|
| `mission` | mission-level + task-level + memory + debt + gap + memory-update + event + status + context 전체 |
| `intake` | `mission create`, `mission design-set`, `mission approve`, `task draft` |
| `task-compiler` | `task draft` |
| `implementation-contract` | `evidence append` (plan-proposal, review) |
| `scheduling` | `task state`, `mission state` (읽기 전용) |
| `evidence-gate` | `gate run` |
| `verify-fix-loop` | `task-state update`, `evidence append`, `gate run`, `task transition --to escalated` |
| `vote-round` | `deliberation append --level mission|task` |
| `memorizing` | `memory shared-set`, `memory agent-set`, `memory-update set` |
| `setup` | `setup` |
| `help` | `context`, `status` (읽기 전용) |

---

## 4. 문제 진단 — 사용자가 직접 쓸 수 있는 읽기 전용 CLI

CLI 대부분은 skill이 부르는 내부 plumbing이다. 아래 명령은 skill을 거치지 않고 상태를 들여다볼 때 사용자가 직접 실행해도 안전하다.

| 명령 | 표시 내용 |
|---|---|
| `geas context` | 현재 `.geas/` 상태(활성 mission, phase, task 수) JSON 요약. |
| `geas status` | 활성 mission의 phase, 활성 task의 state · agent, pending queue. 읽기 전용. |
| `geas mission state --mission <mid>` | Mission spec + phase + task 수. |
| `geas task state --task <tid>` | Task contract 요약 + 현재 lifecycle state + iteration 수. |
| `geas debt list` | 프로젝트 전체의 open / resolved 부채. |
| `geas schema list` | 내장 schema 목록. |
| `geas schema show <name>` | 단일 schema의 JSON. |
| `geas validate` | `.geas/` 트리 전체를 schema로 재검증. |

Skill 흐름 바깥에서 사용자가 직접 쓰는 쓰기 연산은 memory 재작성뿐이다.

- `geas memory shared-set` — stdin markdown으로 `.geas/memory/shared.md` 덮어쓰기.
- `geas memory agent-set --agent <type>` — `.geas/memory/agents/{type}.md` 덮어쓰기.

그 외 `.geas/` 연산은 반드시 skill이 주도하는 흐름을 따른다. `.geas/` 하위 파일에 대한 직접 `Write` / `Edit`는 `PreToolUse` 훅이 차단한다(`HOOKS.md` 참조).

---

## 5. 교차 참조

- `architecture/CLI.md` — CLI 계약, 명령 표면, 오류 코드 원본.
- `architecture/DESIGN.md` — skill이 프로토콜 계층과 맺는 관계.
- `protocol/02` ~ `protocol/07` — skill이 구현하는 규약 원본.
- `HOOKS.md` — skill 호출 주변에서 자동 실행되는 hook 표면.
- `plugin/skills/{name}/SKILL.md` — skill별 실제 프롬프트 본문.
