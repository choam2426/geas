# Skill 레퍼런스

Skill은 dispatcher의 실행 지침이다. 각 skill은 Geas 프로토콜의 한 단계를 세션에서 반복 사용할 수 있는 프롬프트로 고정한다. Skill이 `.geas/`를 직접 쓰지는 않는다 — 모든 쓰기는 `geas` CLI를 통한다. 이 문서는 v3 skill 표면 기준으로 어떤 skill이 있고, 언제 실행되며, 어떤 CLI 명령을 호출하고, 무엇을 산출하는지를 정리한다.

원본 출처는 `architecture/DESIGN.md §7.5`의 공통 카탈로그, `architecture/CLI.md`의 CLI 계약, 그리고 `plugin/skills/{name}/SKILL.md`의 실제 skill 본문이다. 이 문서는 소비자 관점의 색인이며 CLI 계약이나 프로토콜 의미를 중복 기술하지 않는다.

---

## 1. 개요

Skill 층은 17개 skill로 구성된다. 사용자가 직접 호출하는 skill은 `mission`과 `navigating-geas` 두 개뿐이고, 나머지 15개는 `mission` main-session skill이 dispatch한다. Skill은 progressive disclosure 원칙을 따른다: frontmatter는 트리거와 CLI 표면을, 본문은 실행 절차를, 상세 패턴은 `references/`가 담는다. `.geas/`에 실제로 쓰는 유일한 주체는 CLI이므로, 이 문서에서 말하는 "주 산출물"은 해당 행의 CLI 명령이 기록한 결과다.

실행 방식은 두 가지다.

- `main_session` — 사용자와 같은 메인 세션에서 실행된다. `mission` dispatcher는 항상 main_session이며, mission lifecycle sub-skill과 multi-party skill도 같은 세션에서 실행된다.
- `spawned` — dispatcher가 별도 sub-agent를 spawn해 실행한다. 6개의 spawned skill(implementer, reviewer, verifier, voter, design-authority, decision-maker)이 여기에 해당한다. sub-agent가 skill을 수행하고 CLI로 쓰기를 마친 뒤 반환한다.

---

## 2. Skill 색인

| Skill | 그룹 | 실행 방식 | 사용자 호출 가능 | 한 줄 역할 |
|---|---|---|---|---|
| `mission` | A. 프로젝트 유틸리티 | main_session | 가능 (`/mission`) | Dispatcher 겸 사용자 단독 진입점 — bootstrap, resume, phase별 dispatch, briefing |
| `navigating-geas` | A. 프로젝트 유틸리티 | main_session | 가능 (`/navigating-geas`) | Skill 카탈로그·CLI·workflow 안내. 설명만 생성 |
| `specifying-mission` | B. Mission lifecycle | main_session | 불가 | Specifying phase 전체 구동: spec·design·초기 task set·phase-review |
| `drafting-task` | B. Mission lifecycle | main_session | 불가 | Task contract 1건 작성(초기 set 또는 중간 scope-in). 승인 시 ready 전이 |
| `scheduling-work` | B. Mission lifecycle | main_session | 불가 | 표면 충돌 규칙 하에 task 병렬 배치 구성, implementer dispatch |
| `running-gate` | B. Mission lifecycle | main_session | 불가 | Tier 0/1/2 gate 실행, reviewer verdict 집계, `fail`이면 제한 수정-재검증 루프 |
| `closing-task` | B. Mission lifecycle | main_session | 불가 | Orchestrator closure evidence 기록, task-state `deciding → passed` 전이 |
| `reviewing-phase` | B. Mission lifecycle | main_session | 불가 | Phase-review entry append와 mission-state phase 전진 |
| `consolidating-mission` | B. Mission lifecycle | main_session | 불가 | Consolidating phase의 debt·gap·memory 승격 |
| `verdicting-mission` | B. Mission lifecycle | main_session | 불가 | Mission-verdict 작성. `complete` 전이는 사용자 확인 후 dispatcher가 수행 |
| `convening-deliberation` | C. Multi-party | main_session (voter spawn) | 불가 | Full-depth 다자 판단. Voter spawn 후 deliberation entry 1건 기록 |
| `implementing-task` | D. Spawned agent | spawned | 불가 | Spawned implementer — 계획 concurrence, 구현, implementation evidence + self-check |
| `reviewing-task` | D. Spawned agent | spawned | 불가 | Spawned reviewer(challenger / risk-assessor / operator / communicator). Review-kind evidence append |
| `verifying-task` | D. Spawned agent | spawned | 불가 | Spawned verifier — contract `verification_plan` 실행 후 verifier evidence append |
| `deliberating-on-proposal` | D. Spawned agent | spawned | 불가 | Spawned voter — agree/disagree/escalate 투표 1건을 근거와 함께 반환. 직접 쓰기 없음 |
| `designing-solution` | D. Spawned agent | spawned | 불가 | Spawned design-authority — mission-design 작성, 구조 review, gap 분석 |
| `deciding-on-approval` | D. Spawned agent | spawned | 불가 | Spawned decision-maker — spec review, scope-in task 승인, phase-review, mission-verdict |

---

## 3. 그룹별 skill

### 3.1 프로젝트 유틸리티 (2)

#### `mission`

Geas dispatcher. 메인 세션에서만 실행하며 절대 spawn하지 않는다. `.geas/`가 없으면 bootstrap하고, 상태를 점검한 뒤, 매 호출을 해당 phase에 맞는 sub-skill로 라우팅한다. Sub-skill의 반환을 `.geas/` 상태와 대조해 계속 진행할지 멈출지 결정한다. 사용자가 mission 작업을 시작·계속·재개할 때의 유일한 진입점이다.

- 트리거 — 사용자가 `/mission`을 호출(신규, 재개, "지금 어디지?"). dispatcher가 `.geas/` bootstrap도 방어적으로 수행한다.
- 주된 CLI — `geas setup`, `geas context`, `geas mission create|approve|state`, `geas mission-state update --phase`, `geas task draft|approve|transition`, `geas task deps add`, `geas gate run`, `geas phase-review append`, `geas mission-verdict append`, `geas debt register|update-status`, `geas gap set`, `geas memory-update set`, `geas memory shared-set|agent-set`, `geas deliberation append`(`convening-deliberation` 경유).
- 주 산출물 — dispatch하는 sub-skill이 기록하는 모든 artifact.

#### `navigating-geas`

Framework의 지도. Skill 카탈로그, CLI 표면, `mission` dispatcher의 오케스트레이션 방식을 설명해 사용자가 올바른 진입점을 고를 수 있게 한다. 설명만 생성하며 `.geas/`에 쓰지 않는다.

- 트리거 — 사용자가 skill 구성·CLI 명령·phase/slot/evidence 흐름을 물을 때, 또는 프로젝트 시작 시점에서 방향을 잡을 때.
- 주된 CLI — `geas context`, `geas schema list|show` (읽기 전용) — 답변 근거용.
- 주 산출물 — 채팅의 markdown 응답만. 파일 쓰기 없음.

### 3.2 Mission lifecycle sub-skills (8)

#### `specifying-mission`

`phase=specifying`이며 mission spec이 아직 user 승인 전일 때(또는 mission 자체가 없을 때) mission dispatcher가 invoke한다. 한 번에 한 질문으로 요구사항을 받아 승인된 mission spec, 승인된 mission design, 승인된 초기 task set을 만든 뒤 specifying phase-review로 마무리한다. Mission spec은 사용자 승인 후 불변이다.

- 트리거 — `phase=specifying`에서 `spec.json`이 없거나 / `user_approved=false`거나 / `mission-design.md`가 없거나 / 승인된 task가 아직 없는 경우.
- 주된 CLI — `geas mission create`, `geas mission design-set`, `geas mission approve`, `geas task draft`, `geas task approve`, `geas phase-review append`.
- 주 산출물 — `missions/{mid}/spec.json`, `missions/{mid}/mission-design.md`, 초기 승인 `tasks/{tid}/contract.json` 집합, specifying phase의 `phase-review` entry.

#### `drafting-task`

Task contract가 필요할 때 mission dispatcher가 invoke한다 — specifying 단계의 초기 set, 승인 spec 범위 내 중간 scope-in, 취소된 task의 대체(`supersedes`) 중 하나. 구체 implementer로 라우팅된 계약을 reviewer slot, surfaces, dependencies, baseline snapshot과 함께 작성한다. 계약은 승인과 동시에 불변이며, 수정이 필요하면 cancel 후 대체 계약으로 처리한다.

- 트리거 — specifying 단계 초기 set 작성(`specifying-mission`이 호출), building/polishing 단계의 중간 scope-in, 취소 task의 `supersedes` 대체.
- 주된 CLI — `geas task draft`, `geas task approve`, `geas task deps add`.
- 주 산출물 — `tasks/{tid}/contract.json`(drafted → approved), 초기화된 `tasks/{tid}/task-state.json`, evidence 디렉토리.

#### `scheduling-work`

승인된 task 중 dependency가 모두 만족되고 표면 충돌이 없는 것이 하나 이상일 때 mission dispatcher가 invoke한다. `contract.surfaces` pairwise 중복과 critical-risk solo 규칙을 지키면서 task-level 병렬 배치를 구성하고 선택한 task들의 implementer를 dispatch한다. Scheduling은 계획이며, 모든 제약은 CLI가 `task transition --to implementing` 시점에 다시 강제한다.

- 트리거 — `phase=building`(또는 `polishing`)이고 `ready` task 중 의존이 모두 `passed`인 것이 ≥1일 때, 또는 `implementing` 상태의 task가 없는 세션 재개.
- 주된 CLI — `geas task transition --to implementing` + 배치 조회용 `geas task state`, `geas mission state` (읽기 전용).
- 주 산출물 — 현재 배치의 dispatch plan. `implementing` 전이 외의 추가 artifact는 없다.

#### `running-gate`

Task의 모든 required reviewer slot과 verifier가 evidence를 append한 뒤 mission dispatcher가 invoke한다. Tier 0/1/2 gate를 실행하고 reviewer verdict를 집계하며, `fail` verdict 시 제한된 verify-fix 루프를 돈다(`reviewing → implementing`으로 되감고 `verify_fix_iterations` 증가). `pass` 또는 예산 소진까지 반복. `block` / `error` / `pass`는 루프에 진입하지 않으며 오직 `fail`만 진입한다.

- 트리거 — `task-state.status == reviewing` + `self-check.json` 유효 + `routing.required_reviewers`의 모든 slot evidence 존재 + verifier evidence 존재.
- 주된 CLI — `geas gate run`, `geas task transition`(rewind용 `implementing` 또는 예산 소진 시 `escalated`), 수정 반복 시 `geas evidence append --slot implementer`.
- 주 산출물 — `tasks/{tid}/gate-results.json`의 신규 entry, 되감긴 task-state 전이, 수정 반복 시 추가 implementation evidence.

#### `closing-task`

`deciding` 상태 task에 gate가 `verdict=pass`를 반환한 뒤 mission dispatcher가 invoke한다. Orchestrator 권위(slot = orchestrator, `verdict=approved`)로 closure evidence를 작성하며 retrospective 필드(잘 된 점, 망가진 점, 예상 밖, 다음엔 이렇게)를 함께 기록한다. 이어서 task-state를 `deciding → passed`로 전이한다. `deciding`를 빠져나오는 유일한 경로이며, retrospective 필드는 consolidation 입력이 된다.

- 트리거 — `task-state.status == deciding`이고 gate run의 verdict가 `pass`인 경우. 에스컬레이션 해결 후 재진입에도 같은 entry 형식을 사용한다.
- 주된 CLI — `geas evidence append --kind closure`, `geas task transition --to passed`.
- 주 산출물 — `tasks/{tid}/evidence/`의 closure-kind orchestrator evidence entry, `task-state.status = passed`.

#### `reviewing-phase`

현재 phase scope의 모든 mission-scope task가 terminal(`passed`, `cancelled`, `escalated`)에 도달했을 때 mission dispatcher가 invoke한다. `status=passed`, `next_phase`가 채워진 phase-review entry를 append하고, CLI로 `mission-state.phase`를 전진시킨다 — CLI가 허용하는 유일한 phase 전진 경로다.

- 트리거 — `specifying` / `building` / `polishing` 종료 시점, mission-scope task 전부 terminal. full_depth specifying은 mission-level deliberation entry가 추가로 필요하다.
- 주된 CLI — `geas phase-review append`, `geas mission-state update --phase`.
- 주 산출물 — `missions/{mid}/phase-reviews.json`의 새 entry, `mission-state.phase` 전진.

#### `consolidating-mission`

`phase=consolidating` 진입 시 mission dispatcher가 invoke한다. task evidence에서 후보를 scaffold하고, debt / memory / gap 후보를 승격해 `memory-update.json`과 `gap.json`을 작성하며, memory markdown(`shared.md`와 agent별 `agents/{type}.md`)을 교체한다. Memory markdown 교체와 `memory-update set`은 프로토콜상 쌍으로 실행한다.

- 트리거 — `phase=consolidating` 진입, 또는 artifact가 부분적으로만 기록된 consolidation을 재개할 때.
- 주된 CLI — `geas debt register`, `geas gap set`, `geas memory-update set`, `geas memory shared-set`, `geas memory agent-set`.
- 주 산출물 — `missions/{mid}/consolidation/gap.json`, `missions/{mid}/consolidation/memory-update.json`, `debts.json`의 추가 entry, 재작성된 `.geas/memory/shared.md`와 `.geas/memory/agents/{type}.md`.

#### `verdicting-mission`

`consolidating-mission`이 debt / gap / memory-update / memory markdown을 모두 기록한 뒤 mission dispatcher가 invoke한다. Decision-maker를 spawn해 mission-verdict entry를 작성하게 한다. `complete` 전이는 dispatcher가 사용자 최종 briefing에서 명시적 확인을 받은 후에만 수행한다.

- 트리거 — `phase=consolidating`이며 consolidation artifact가 모두 존재하고 mission-scope task가 전부 terminal, phase별 phase-review가 기록된 상태.
- 주된 CLI — `geas mission-verdict append`(decision-maker가 `deciding-on-approval`로 작성), 사용자 확인 후 `geas mission-state update --phase complete`.
- 주 산출물 — `missions/{mid}/mission-verdict.json`의 새 entry, 확인 시 `mission-state.phase = complete`.

### 3.3 Multi-party (1)

#### `convening-deliberation`

`mission.mode == full_depth`이며 다자 판단이 필요할 때 mission dispatcher가 invoke한다. `geas deliberation append`의 얇은 소집 래퍼다: voter를 spawn해 독립적으로 dispatch(voter끼리는 투표 전 서로의 표를 볼 수 없음)하고, 반환을 모아 CLI 집계 결과로 deliberation entry 1건을 기록한다. 최종 판단 계산은 skill이 하지 않고 CLI 집계 규칙이 source of truth다.

- 트리거 — task-level: reviewer verdict가 양립 불가로 충돌하거나, challenger가 closure가 단독 판정할 수 없는 구조적 이의를 제기하거나, rewind target이 비자명할 때. Mission-level: full-depth specifying 종료에 challenger 포함 ≥3 voter의 기록된 합의가 필요하거나, phase rollback을 검토할 때.
- 주된 CLI — `geas deliberation append --level mission|task`.
- 주 산출물 — `deliberations.entries`의 신규 entry 1건(`tasks/{tid}/deliberations.json` 또는 `missions/{mid}/deliberations.json`). Challenger는 가능한 한 필수 voter다.

### 3.4 Spawned agent procedures (6)

#### `implementing-task`

승인되고 dependency가 만족된 task를 dispatcher가 넘겨주었을 때 spawn된 implementer가 invoke한다. 코드 작성 전에 구체 계획(planned_actions, edge_cases, demo_steps)을 선언하고 reviewer concurrence를 1라운드 받는다. 계획 승인 후에만 `implementing`으로 전이해 변경을 수행하며, 마무리로 implementation-kind evidence entry 1건과 `self-check.json`을 기록한다. 같은 concrete agent가 동일 task에서 implementer와 reviewer/verifier를 겸하는 것은 금지다.

- 트리거 — 첫 실행은 `task-state.status == ready`, verify-fix 수정 실행은 `implementing`. `base_snapshot`이 실제 workspace와 일치해야 한다.
- 주된 CLI — `geas self-check append`, `geas evidence append --slot implementer`(계약용 `plan-proposal` kind, 최종 기록용 `implementation` kind), `geas task transition --to implementing|reviewing`.
- 주 산출물 — `tasks/{tid}/evidence/`의 implementation-kind evidence entry, `tasks/{tid}/self-check.json`. (별도의 `impl-contract set` 등록은 비블로킹 queue에 있으며, 현재는 계획 concurrence를 `evidence append --kind plan-proposal` + reviewer review entry로 기록한다.)

#### `reviewing-task`

Implementer가 implementation evidence와 `self-check.json`을 제출한 뒤(또는 implementer가 계획을 먼저 제안한 사전 concurrence 시점에) spawn된 reviewer(challenger / risk-assessor / operator / communicator)가 invoke한다. 자기 lane의 evidence를 읽고 verdict를 세워 review-kind evidence entry 1건을 append한다. 슬롯별 입장(적대적 / 실패 모드 / 운용성 / 사람 표면)은 agent 파일이 담고, 여기서는 공통 절차만 다룬다.

- 트리거 — `implementing` 상태 task(사전 계획 concurrence) 또는 `reviewing` 상태 task(사후 review)에 reviewer로 spawn된 경우. 해당 task의 implementer와 겸할 수 없다.
- 주된 CLI — `geas evidence append --slot <reviewer slot>`에 `evidence_kind: review`.
- 주 산출물 — `verdict`, `concerns`, `scope_examined`, `methods_used`를 갖춘 review-kind evidence entry.

#### `verifying-task`

Reviewer concurrence가 끝난 뒤(또는 full-depth에서는 reviewer와 병렬로) spawn된 verifier가 invoke한다. Task contract의 `verification_plan`을 implementer와 독립적으로 실행하고, 모든 acceptance criterion을 pass/fail로 구체 근거와 함께 매핑한 verification-kind evidence entry 1건을 기록한다. 누락·모호한 검증은 gate `error`를 만든다.

- 트리거 — `task-state.status == reviewing`(또는 verifier를 reviewer와 병렬로 돌리는 프로파일에서는 `implementing`). implementation-kind evidence가 ≥1건 있고 `base_snapshot`이 workspace와 일치해야 한다.
- 주된 CLI — `geas evidence append --slot verifier`에 `evidence_kind: verification`.
- 주 산출물 — 모든 acceptance criterion을 덮는 `criteria_results`를 갖춘 verifier evidence entry.

#### `deliberating-on-proposal`

심의 도중 spawn된 voter가 invoke한다. Voter는 proposal text와 supporting artifact를 읽고, 지정 slot의 시각으로 독립적 판단을 내려 rationale과 dissent note와 함께 vote 1건(`agree` / `disagree` / `escalate`)을 반환한다. Voter끼리는 자기 투표 반환 전에 서로의 표를 보지 않는다.

- 트리거 — `convening-deliberation`이 proposal text, supporting artifact 경로, voter 식별 slot을 함께 넘기며 voter를 spawn.
- 주된 CLI — 없음(직접 쓰기 없음). 소집 skill이 반환을 모아 `geas deliberation append`를 호출한다.
- 주 산출물 — 소집 skill로 반환되는 vote 객체.

#### `designing-solution`

세 가지 시점 중 하나에서 spawn된 design-authority가 invoke한다 — mission-design 작성, task contract 또는 implementation contract의 구조적 review, consolidating phase의 gap 분석. 분기별로 CLI 표면이 다르다. 같은 task에서 design-authority와 implementer를 겸할 수 없다.

- 트리거 — 분기 A(mission-design 작성, spec `user_approved: true`이고 `mission-design.md` 없음), 분기 B(task / implementation contract 구조 review), 분기 C(`consolidating`에서 gap 분석).
- 주된 CLI — `geas mission design-set`(A), `geas evidence append --slot design-authority`에 `evidence_kind: review`(B), `geas gap set`(C).
- 주 산출물 — `missions/{mid}/mission-design.md`, design-authority review-kind evidence, 또는 `missions/{mid}/consolidation/gap.json`.

#### `deciding-on-approval`

네 가지 시점 중 하나에서 spawn된 decision-maker가 invoke한다 — mission spec review(standard 또는 full_depth), 중간 scope-in task contract 승인, phase-review verdict 작성, mission-verdict 작성. 분기별로 CLI 표면이 다르다.

- 트리거 — 분기 A(사용자 sign-off 전 mission spec review), 분기 B(building / polishing 중간 scope-in task 승인), 분기 C(phase-review verdict 작성), 분기 D(consolidating 종료 후 mission-verdict 작성).
- 주된 CLI — `geas evidence append --slot decision-maker`(A, spec review entry), `geas task approve`(B), `geas phase-review append`(C), `geas mission-verdict append`(D).
- 주 산출물 — decision-maker review-kind evidence, 승인된 task contract, phase-review entry, 또는 mission-verdict entry.

---

## 4. Skill → CLI 매핑

빠른 조회용이다. 명령 상세(플래그, JSON shape, 실패 모드)는 `architecture/CLI.md` 참조.

| Skill | CLI 명령(정식) |
|---|---|
| `mission` | dispatch하는 sub-skill을 통해 mission / task / evidence / gate / phase-review / mission-verdict / debt / gap / memory / memory-update / context 표면 전체 |
| `navigating-geas` | `context`, `schema list`, `schema show` (읽기 전용) |
| `specifying-mission` | `mission create`, `mission design-set`, `mission approve`, `task draft`, `task approve`, `phase-review append` |
| `drafting-task` | `task draft`, `task approve`, `task deps add` |
| `scheduling-work` | `task transition --to implementing`, `task state`, `mission state` |
| `running-gate` | `gate run`, `task transition`, `evidence append --slot implementer`(수정 반복) |
| `closing-task` | `evidence append --kind closure`, `task transition --to passed` |
| `reviewing-phase` | `phase-review append`, `mission-state update --phase` |
| `consolidating-mission` | `debt register`, `gap set`, `memory-update set`, `memory shared-set`, `memory agent-set` |
| `verdicting-mission` | `mission-verdict append`, `mission-state update --phase complete` |
| `convening-deliberation` | `deliberation append --level mission\|task` |
| `implementing-task` | `self-check append`, `evidence append --slot implementer`, `task transition` |
| `reviewing-task` | `evidence append --slot <reviewer slot>` |
| `verifying-task` | `evidence append --slot verifier` |
| `deliberating-on-proposal` | (없음 — 소집 skill로 vote 반환) |
| `designing-solution` | `mission design-set`, `evidence append --slot design-authority`, `gap set` |
| `deciding-on-approval` | `evidence append --slot decision-maker`, `task approve`, `phase-review append`, `mission-verdict append` |

---

## 5. 사용자 호출 명령과 읽기 전용 CLI

사용자 호출 가능한 skill은 두 개다.

- `/mission` — mission 작업의 단독 진입점. 신규·계속·재개를 수행하며 다른 lifecycle skill은 모두 여기서 dispatch된다.
- `/navigating-geas` — framework 지도. Skill·CLI·workflow를 설명한다. 아무 때나 안전하게 호출할 수 있고 쓰기 없음.

그 외 `plugin/skills/` 아래 skill은 모두 `mission`이 dispatch한다 — sub-skill의 frontmatter에 `user-invocable: false`가 있으므로 직접 호출하지 말 것.

Skill을 거치지 않고 `.geas/` 상태만 확인하고 싶을 때 사용자가 안전하게 직접 실행할 수 있는 읽기 전용 CLI는 아래와 같다.

| 명령 | 표시 내용 |
|---|---|
| `geas context` | 현재 `.geas/` 상태(활성 mission, phase, task 수) JSON 요약. |
| `geas mission state --mission <mid>` | Mission spec + phase + task 수. |
| `geas task state --task <tid>` | Task contract 요약 + 현재 lifecycle state + verify-fix 반복 횟수. |
| `geas debt list` | 프로젝트 전체의 open / resolved 부채. |
| `geas schema list` | 내장 schema 목록. |
| `geas schema show <name>` | 단일 schema의 JSON. |

`.geas/`에 대한 다른 모든 쓰기는 skill이 주도하는 CLI 호출을 통해야 한다. `.geas/` 하위 파일에 대한 직접 `Write` / `Edit`는 `PreToolUse` 훅이 차단한다(`HOOKS.md` 참조).

---

## 6. 교차 참조

- `architecture/CLI.md` — CLI 계약, 명령 표면, 오류 코드 원본.
- `architecture/DESIGN.md §7.5` — 실행 역할별로 그룹화된 17-skill 권위 카탈로그.
- `protocol/01`–`protocol/08` — skill이 구현하는 프로토콜 계층.
- `HOOKS.md` — skill 호출 주변에서 자동 실행되는 hook 표면.
- `plugin/skills/{name}/SKILL.md` — skill별 실제 프롬프트 본문.
