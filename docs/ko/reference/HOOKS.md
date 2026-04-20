# Hook 레퍼런스

Hook은 Claude Code 런타임(하니스)이 정해진 lifecycle 이벤트마다 자동 실행하는 스크립트다. Geas는 세션 시작 시 `.geas/` 상태를 수면으로 끌어올리고, sub-agent에 memory를 주입하고, `.geas/` 직접 쓰기를 막는 용도로만 사용한다. Hook은 best-effort다 — 실패하거나 부재해도 미션 자체는 계속 진행된다. 런타임 트리 원본은 `geas` CLI 소유이고, hook은 상태를 들여다볼 뿐이다.

설정: `plugin/hooks/hooks.json`
스크립트: `plugin/hooks/scripts/`
공용 헬퍼: `plugin/hooks/scripts/lib/geas-hooks.js`

`.geas/events.jsonl`이 기록하는 대상과 어느 CLI 명령이 이벤트를 내보내는지는 `architecture/CLI.md` §14.7과 `architecture/DESIGN.md`에서 다룬다.

---

## 1. Hook 목록

lifecycle 이벤트 3개에 스크립트 3개. v3 표면은 의도적으로 작다 — v2의 checkpoint, policy 보호, packet 신선도, integration lock, restore, cost 집계 hook은 G7에서 제거했다. 각각 `.geas/` 레지스트리 밖에 쓰거나 CLI가 이미 책임지는 영역을 중복했기 때문이다.

| # | 이벤트 | Matcher | 스크립트 | 목적 |
|---|---|---|---|---|
| 1 | `SessionStart` | (전체) | `session-init.sh` | `.geas/` 상태 요약을 한 줄로 stderr에 출력. |
| 2 | `SubagentStart` | (전체) | `inject-context.sh` | shared memory + 에이전트별 memory를 새 sub-agent 컨텍스트에 주입. |
| 3 | `PreToolUse` | `Write|Edit` | `geas-write-block.js` | `.geas/`를 대상으로 하는 `Write` / `Edit` 툴 호출 차단. |

G7에서 삭제된 항목(마이그레이션 설계 재검토 없이 되돌리지 말 것):

- `calculate-cost.sh` (Stop) — 토큰 사용량 집계는 `.geas/` 레지스트리 바깥 기록이었다.
- `checkpoint-pre-write.sh`, `checkpoint-post-write.sh` (PreToolUse / PostToolUse `Write` on `run.json`) — 더 이상 존재하지 않는 파일에 대한 v2 전용 두 단계 checkpoint.
- `packet-stale-check.sh` (PostToolUse Write|Edit) — v3에 없는 v2 "context packet" 개념을 검사.
- `protect-geas-state.sh` (PostToolUse Write|Edit) — `geas-write-block.js`(PreToolUse)와 역할이 겹치고 더 약했다.
- `integration-lane-check.sh` (PostToolUse Bash) — lock-manifest 표면이 없는 v3에서는 무의미한 integration lock 경고.
- `restore-context.sh` (PostCompact) — v2 전용 `run.json`에서 컨텍스트를 복원하는 스크립트.

---

## 2. Hook lifecycle

```
Session 시작
│
├─► SessionStart              → session-init.sh
│     .geas/ 상태 읽어 한 줄 요약을 stderr로 출력
│     (mission 수 + 최신 id + phase, memory, open 부채). 쓰기 없음.
│
│   [orchestrator가 spawn하는 sub-agent마다]
│   │
│   ├─► SubagentStart         → inject-context.sh
│   │     .geas/memory/shared.md + agents/{type}.md를 읽어
│   │     { "additionalContext": "..." } JSON을 stdout에 출력.
│   │
│   │   [Write/Edit 툴 호출 직전]
│   │   │
│   │   ├─► PreToolUse        → geas-write-block.js
│   │   │     file_path가 .geas/ 아래면 "decision":"block" JSON과
│   │   │     CLI 사용을 안내하는 reason을 stdout에 출력.
│   │   │     그 외엔 exit 0으로 조용히 통과.
```

v3에는 `PostToolUse`, `Stop`, `PostCompact` hook이 없다.

---

## 3. 각 hook 상세

### 3.1 `SessionStart` — `session-init.sh`

**실행 시점.** 매 세션 시작.

**읽는 파일.**
- `.geas/missions/` — `mission-*` 항목을 세고 사전식으로 가장 큰 id를 찾아 해당 mission의 phase를 읽는다.
- `.geas/missions/{latest}/mission-state.json` — 존재하면 `mission_phase` 필드.
- `.geas/memory/shared.md` — 존재 여부만 확인.
- `.geas/memory/agents/` — `*.md` 파일 수.
- `.geas/debts.json` — `status == "open"` entry 수.

**쓰기.** 없음. 읽기 전용.

**출력.** stderr에 한 줄짜리 `[Geas]` 요약. 예:

```
[Geas] Session resumed. Missions: 3 | latest: mission-20260420-ab12cd34 (building) | Memory: shared=yes, agent notes=2 | Open debts: 1
```

`.geas/`가 없거나 요약할 내용이 없으면 조용히 종료한다.

**실패 처리.** Best-effort. I/O 오류나 파싱 오류가 발생하면 전부 삼키고 세션은 요약 라인 없이 계속한다.

### 3.2 `SubagentStart` — `inject-context.sh`

**실행 시점.** 하니스가 sub-agent를 spawn할 때마다.

**읽는 파일.**
- `.geas/memory/shared.md` — 전체 본문(모든 sub-agent에 주입).
- `.geas/memory/agents/{agent_type}.md` — 하니스가 `agent_type`을 넘겨주고 대응 파일이 존재할 때만 주입.

Mission · task 컨텍스트는 의도적으로 주입하지 않는다. Mission · task 컨텍스트는 orchestrator의 TaskContract와 agent 프롬프트로 명시적으로 흐르며, hook 경로를 타지 않는다.

**쓰기.** 없음.

**출력.** stdout에 JSON:

```json
{ "additionalContext": "--- SHARED MEMORY ... ---\n\n...\n\n--- YOUR MEMORY ... ---\n\n..." }
```

두 memory 소스 모두 본문이 비어 있으면 아무 것도 출력하지 않는다.

**실패 처리.** Best-effort. `.geas/`가 없거나 memory 파일을 읽을 수 없으면 컨텍스트 주입 없이 종료하고, sub-agent는 orchestrator가 넘긴 컨텍스트만으로 시작한다.

### 3.3 `PreToolUse` (`Write|Edit`) — `geas-write-block.js`

**실행 시점.** 모든 `Write` / `Edit` 툴 호출 직전.

**읽는 입력.** stdin의 hook payload: `cwd`, `tool_input.file_path`.

**쓰기.** 디스크에 쓰지 않음.

**판정.**
- `file_path`가 `.geas/` 아래(`cwd` 상대 경로 또는 정규화된 절대 경로의 하위 문자열 검사)에 해당하면 stdout에 JSON을 출력하고 exit 0:
  ```json
  {
    "decision": "block",
    "reason": "[Geas] BLOCKED: Direct Write/Edit to .geas/ is not allowed. All .geas/ file modifications must use geas CLI commands. Examples: geas mission create, geas task draft, geas evidence append, geas memory shared-set, geas debt register, geas event log. Use Bash tool to invoke CLI commands instead."
  }
  ```
- 그 외에는 exit 0으로 조용히 통과(허용).

**실패 처리.** stdin 파싱 오류나 입력 누락은 전부 exit 0(허용)으로 처리한다. Hook은 fail-open이다 — 망가진 hook이 `.geas/` 바깥의 정상 편집을 가로막으면 안 된다. 실제 권위 있는 장벽은 CLI 자체이고, hook은 조기 경고 역할이다.

---

## 4. 이벤트와 Hook 경계

`events.jsonl`은 hook과 별개 채널이다. Hook은 Claude Code 하니스 안에서만 실행되고 `.geas/events.jsonl`에 쓰지 않는다. 이벤트는 `geas` CLI가 프로토콜 waypoint(미션 생성, task 전이, evidence append 등)를 수행할 때만 남긴다. 전체 계약은 `architecture/CLI.md` §14.7이 소유한다.

### 4.1 Automation-only 범위

`events.jsonl`은 automation-only다 — 모든 entry는 CLI waypoint 하나에 대응한다. Hook은 entry를 만들지 않고, 사용자 측 메시지도 만들지 않는다. CLI가 직접 관찰하지 못한 사건을 기록하고 싶다면 operator가 `geas event log`를 호출한다 — 여전히 CLI를 경유하지 hook을 경유하지 않는다.

### 4.2 CLI가 내보내는 이벤트 종류

| kind | 발신 명령 |
|---|---|
| `mission_created` | `geas mission create` |
| `mission_approved` | `geas mission approve` |
| `mission_phase_advanced` | `geas mission-state update --phase` |
| `phase_review_appended` | `geas phase-review append` |
| `mission_verdict_appended` | `geas mission-verdict append` |
| `task_drafted` | `geas task draft` |
| `task_approved` | `geas task approve` |
| `task_state_changed` | `geas task transition` |
| `self_check_set` | `geas self-check set` |
| `evidence_appended` | `geas evidence append` |
| `gate_run_recorded` | `geas gate run` |
| `deliberation_appended` | `geas deliberation append` |
| `debt_registered` | `geas debt register` |
| `debt_status_updated` | `geas debt update-status` |
| `gap_set` | `geas gap set` |
| `memory_update_set` | `geas memory-update set` |
| `memory_shared_set` | `geas memory shared-set` |
| `memory_agent_set` | `geas memory agent-set` |
| 사용자 지정 `kind` | `geas event log` |

### 4.3 Actor 네임스페이스

각 이벤트의 `actor` 필드는 다음 세 종류를 받는다.

1. **Slot 식별자(kebab-case)** — 프로토콜이 정의한 임의의 slot id: `orchestrator`, `decision-maker`, `design-authority`, `challenger`, `implementer`, `verifier`, `risk-assessor`, `operator`, `communicator` 등 도메인 profile이 정의한 구체 slot까지.
2. **`user`** — 로그에 반영된 사람 판단.
3. **`cli:auto`** — CLI 자신. 사용자 · orchestrator가 트리거한 waypoint에서 CLI가 auto-emit할 때 쓴다.

`cli:auto`의 `:`은 kebab-case slot-id 관례에 대한 의도적 예외다. 이 예외는 events.jsonl에만 해당한다(어느 프로토콜 artifact도 이 문자를 허용하지 않는다). events.jsonl이 프로토콜 artifact가 아닌 구현체 보조 로그이기 때문이다. 원칙은 `architecture/CLI.md` §14.7 참조.

### 4.4 Best-effort 의미론

이벤트 쓰기 실패가 상위 CLI 명령을 롤백하지 않는다. events.jsonl을 쓸 수 없는 상황(디스크 부족, 권한 오류)에서도 waypoint를 수행한 CLI 명령은 `ok`로 반환한다. Hook의 fail-open 정책과 같은 원리 — 텔레메트리는 주 쓰기보다 부수적이다.

---

## 5. Hook 확장하기

Geas 위에 프로젝트 고유 lifecycle 동작을 올리고 싶다면, plugin의 `hooks.json`을 건드리지 말고 자체 hook 스크립트를 추가한다. Claude Code 하니스는 사용자 수준 `settings.json`의 hook과 plugin hook을 합성해 둘 다 실행한다.

**사용자 hook 위치.**
- 사용자 수준: `~/.claude/settings.json`.
- 프로젝트 수준: 프로젝트 루트의 `.claude/settings.json`.

**명명 규칙.**
- 커스텀 스크립트 이름은 프로젝트 · 조직 prefix(`myorg-session-note.sh` 등)를 붙여 Geas 스크립트와 혼동되지 않도록 한다.
- Geas v3 스크립트 3개는 그대로 둔다. `session-init.sh`, `inject-context.sh`, `geas-write-block.js`에 로직을 덧붙이지 않는다 — upstream 변경이 덮어쓴다.

**커스텀 hook 권장 규칙.**

1. **`.geas/`는 읽기 전용.** Hook에서 `.geas/`에 쓰지 않는다. 기록이 필요하면 `geas event log`를 호출한다.
2. **Fail-open.** Hook의 본질이 차단(e.g. `geas-write-block.js`)이 아닌 한, 임무 수행 불가 시 exit 0으로 통과시킨다.
3. **긴 작업 금지.** 하니스가 timeout을 강제한다. 1초 이내로 유지한다.
4. **`.geas/` 차단 존중.** `.geas/`를 대상으로 하는 커스텀 `Write|Edit` hook은 `geas-write-block.js`가 선행 차단하므로 무력해진다. 쓰기는 반드시 CLI로 경로를 돌려 준다.

---

## 6. 교차 참조

- `architecture/CLI.md` §14.7 — events.jsonl 계약, 이벤트 종류, actor 네임스페이스.
- `architecture/DESIGN.md` — 자동화 · hook · CLI 관계도.
- `SKILLS.md` — 어느 skill이 어느 CLI 명령을 호출하는지.
- `plugin/hooks/hooks.json` — 현재 등록 상태.
- `plugin/hooks/scripts/` — 실제 스크립트 본문.
