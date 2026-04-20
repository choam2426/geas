# Hooks 레퍼런스

Geas hook은 Claude Code 런타임이 정해진 lifecycle event마다 자동 실행하는 셸 스크립트이다. 거버넌스 불변 조건을 강제하고, agent 컨텍스트를 주입하며, 텔레메트리를 기록한다. 오케스트레이터가 직접 호출할 필요가 없다.

설정: `plugin/hooks/hooks.json`
스크립트: `plugin/hooks/scripts/`
공유 라이브러리: `plugin/hooks/scripts/lib/geas-hooks.js`

---

## Hook 목록

6개 lifecycle event에 걸쳐 11개 hook (10개 스크립트 + 1개 공유 라이브러리).

| # | Event | Matcher | Script | 목적 |
|---|-------|---------|--------|------|
| 1 | SessionStart | (all) | session-init.sh | 세션 초기화 + memory review cadence |
| 2 | SubagentStart | (all) | inject-context.sh | sub-agent에 규칙과 agent memory 주입 |
| 3 | PreToolUse | Write\|Edit | geas-write-block.js | .geas/ 경로에 대한 직접 Write/Edit 차단 |
| 4 | PreToolUse | Write | checkpoint-pre-write.sh | 쓰기 전 run.json 백업 (2단계 checkpoint) |
| 5 | PostToolUse | Write\|Edit | protect-geas-state.sh | scope guard, 타임스탬프 주입, spec 동결 경고 |
| 6 | PostToolUse | Write\|Edit | checkpoint-post-write.sh | 쓰기 후 pending checkpoint 정리 |
| 7 | PostToolUse | Write\|Edit | packet-stale-check.sh | 오래된 context packet 경고 |
| 8 | PostToolUse | Bash | integration-lane-check.sh | integration lock 없이 merge 시 경고 |
| 9 | Stop | (all) | calculate-cost.sh | 토큰 사용량 요약 |
| 10 | PostCompact | (all) | restore-context.sh | 컨텍스트 압축 후 상태 복원 |

---

## Hook Lifecycle

Geas 세션에서 hook이 실행되는 순서를 나타낸다.

```
Session begins
│
├─► SessionStart       → session-init.sh
│     Check .geas/ state, inject rules.md context,
│     warn about memory entries past review_after date
│
│   [For each sub-agent spawned]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     Inject rules.md + policy overrides + agent memory into sub-agent context
│   │
│   │   [Before each Write or Edit tool call]
│   │   │
│   │   ├─► PreToolUse (Write|Edit) → geas-write-block.js
│   │   │     .geas/ 경로에 대한 직접 쓰기 차단 (CLI 전용 강제)
│   │   │
│   │   [Before each Write tool call to run.json]
│   │   │
│   │   ├─► PreToolUse (Write) → checkpoint-pre-write.sh
│   │   │     Backup run.json before overwrite (two-phase checkpoint)
│   │   │
│   │   [After each Write or Edit tool call]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     Timestamp injection, scope path warning, mission spec freeze guard
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → checkpoint-post-write.sh
│   │   │     Remove pending checkpoint backup after successful write
│   │   │
│   │   └─► PostToolUse (Write|Edit) → packet-stale-check.sh
│   │         Warn if context packets may be stale after session recovery
│   │
│   │   [After each Bash tool call]
│   │   │
│   │   └─► PostToolUse (Bash) → integration-lane-check.sh
│   │         Warn if git merge/rebase runs without integration lock
│   │
│   │   [Context compaction fires]
│   │   │
│   │   └─► PostCompact → restore-context.sh
│   │         Re-inject run.json state, session context, L0 anti-forgetting
│
Session ends
│
└─► Stop               → calculate-cost.sh
      Token usage summary
```

---

## Hook 상세

### Hook 1 — session-init.sh

| 필드 | 값 |
|---|---|
| Event | `SessionStart` |
| Script | `plugin/hooks/scripts/session-init.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

세션이 시작될 때 한 번 실행된다. 세션 초기화와 memory review cadence 확인을 하나로 통합한 hook이다.

**세션 초기화:**

1. hook 입력 JSON에서 `cwd`를 읽는다. `cwd`가 없으면 즉시 종료한다.
2. `.geas/` 디렉토리를 확인한다. 없으면 Geas 프로젝트가 아니므로 조용히 종료한다.
3. `.geas/state/run.json`을 확인한다. 없으면 경고를 출력하고 종료한다.
4. run.json에서 세션 상태를 로드하고 stderr에 재개 요약을 출력한다:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
5. `.geas/rules.md`가 없으면 내장 템플릿으로 생성한다.

**Agent memory 확인** (통합):

6. `.geas/memory/agents/` 디렉토리에서 에이전트 노트 파일을 확인한다.
7. 발견된 에이전트 메모리 파일 수를 보고한다.

---

### Hook 2 — inject-context.sh

| 필드 | 값 |
|---|---|
| Event | `SubagentStart` |
| Script | `plugin/hooks/scripts/inject-context.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

sub-agent가 생성될 때마다 실행된다. 프로젝트 규칙과 agent별 memory를 sub-agent의 시작 컨텍스트에 주입한다.

1. hook 입력 JSON에서 `cwd`와 `agent_type`을 읽는다. 플러그인 접두사를 제거한다 (예: `geas:software-engineer` → `software-engineer`).
2. `.geas/` 디렉토리를 확인한다. 없으면 조용히 종료한다.
3. `.geas/rules.md`를 읽어 `--- PROJECT RULES (.geas/rules.md) ---` 아래에 포함한다.
4. `.geas/state/policy-overrides.json`을 읽는다. 만료되지 않은 활성 override를 필터링하여 `--- ACTIVE POLICY OVERRIDES ---` 아래에 rule_id, action, reason, expires_at를 포함한다.
5. `.geas/memory/agents/<agent_name>.md`가 있으면 `--- YOUR MEMORY ---` 아래에 포함한다.
6. stdout에 `{"additionalContext": "..."}`를 출력하여 런타임이 sub-agent의 시스템 컨텍스트에 병합하도록 한다.

**조건:** `cwd`가 비어 있거나 `.geas/`가 없으면 건너뛴다. rules.md, policy override, memory 파일 모두 없으면 아무것도 출력하지 않는다.

---

### Hook 3 — geas-write-block.js

| 필드 | 값 |
|---|---|
| Event | `PreToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/geas-write-block.js` |
| Blocking | 차단 (`.geas/` 쓰기 시 exit 2) |
| Timeout | 10 s |

모든 `Write` 또는 `Edit` 도구 호출 전에 실행된다. `.geas/` 경로에 대한 직접 파일 수정을 차단하여 CLI 전용 조작 규칙을 강제한다.

1. hook 입력 JSON에서 `file_path`를 추출한다.
2. 대상 경로에 `.geas/`가 포함되어 있는지 확인한다. 아니면 exit 0 (허용).
3. `.geas/` 내부이면 `{"decision":"block","reason":"..."}`를 출력하고 exit 2 (차단).

모든 `.geas/` 파일 수정은 타임스탬프 자동 관리와 스키마 검증을 수행하는 `geas` CLI를 통해야 한다.

---

### Hook 4 — checkpoint-pre-write.sh

| 필드 | 값 |
|---|---|
| Event | `PreToolUse` |
| Matcher | `Write` |
| Script | `plugin/hooks/scripts/checkpoint-pre-write.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

모든 `Write` 도구 호출 전에 실행된다. `run.json`에 대한 2단계 checkpoint의 전반부를 구현한다.

1. 쓰기 대상이 `.geas/state/run.json`인지 확인한다. 다른 파일은 무시한다.
2. `run.json`을 `_checkpoint_pending`으로 복사하여 백업한다.

`checkpoint-post-write.sh` (Hook 6)와 함께 동작한다.

**조건:** `.geas/state/run.json`에 대한 쓰기에만 동작한다. `run.json`이 아직 없으면 건너뛴다.

---

### Hook 5 — protect-geas-state.sh

| 필드 | 값 |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/protect-geas-state.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

모든 `Write` 또는 `Edit` 도구 호출 후에 실행된다. 세 가지 역할을 수행한다.

**1. Scope 경로 경고**

현재 task 파일에서 `scope.surfaces` 허용 목록을 읽는다. 기록된 파일이 glob 패턴과 일치하지 않으면 경고한다:
```
[Geas] WARNING: Write to <rel_path> outside scope.surfaces in <task_id>
```
`.geas/` 내부 경로는 항상 면제된다.

**2. 자동 타임스탬프 주입**

`*/.geas/*.json` 패턴에 해당하는 파일에서, `created_at` 필드가 없거나 비어 있거나 더미 값이면 실제 UTC 타임스탬프를 주입한다.

**3. Mission spec 동결 보호**

기록된 파일이 `*/.geas/missions/*/spec.json`이면 경고한다:
```
[Geas] WARNING: Mission spec was modified. Mission specs should be frozen after intake. Use a vote round for scope changes.
```

---

### Hook 6 — checkpoint-post-write.sh

| 필드 | 값 |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/checkpoint-post-write.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

모든 `Write` 또는 `Edit` 도구 호출 후에 실행된다. 2단계 checkpoint의 후반부를 구현한다.

1. 쓰기 대상이 `.geas/state/run.json`인지 확인한다. 다른 파일은 무시한다.
2. `.geas/state/_checkpoint_pending`이 있으면 제거하여, 쓰기가 성공적으로 완료되었음을 확인한다.

`checkpoint-pre-write.sh` (Hook 4)와 함께 동작한다.

---

### Hook 7 — packet-stale-check.sh

| 필드 | 값 |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/packet-stale-check.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

모든 `Write` 또는 `Edit` 도구 호출 후 `run.json`에 대해 실행된다.

1. `recovery_class`가 설정되어 있는지 확인한다 (복구된 세션을 의미).
2. 현재 task의 context packet이 존재하는지 확인한다.
3. 복구된 세션에서 packet이 있으면 경고한다:
   ```
   Warning: STALE PACKETS: Session recovered (<recovery_class>). Context packets for <task_id> may be stale.
   ```

**조건:** `.geas/state/run.json`에 대한 쓰기에만 동작한다. `current_task_id`가 없거나 packet이 없으면 건너뛴다.

---

### Hook 8 — integration-lane-check.sh

| 필드 | 값 |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Bash` |
| Script | `plugin/hooks/scripts/integration-lane-check.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

모든 `Bash` 도구 호출 후에 실행된다. single-flight integration lane 규칙을 강제한다.

1. Bash 명령에 `git merge` 또는 `git rebase`가 포함되어 있는지 확인한다. 다른 명령은 무시한다.
2. `.geas/state/locks.json`에서 보유 중인 `integration` lock을 찾는다.
3. integration lock이 없으면 경고한다:
   ```
   INTEGRATION LANE: No integration_lock held. Acquire integration_lock before merging.
   ```

---

### Hook 9 — calculate-cost.sh

| 필드 | 값 |
|---|---|
| Event | `Stop` |
| Script | `plugin/hooks/scripts/calculate-cost.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 30 s |

세션 종료 시 실행된다. `~/.claude/projects/`의 sub-agent 세션 JSONL 파일을 파싱하여 토큰 사용량 요약을 생성한다.

1. `cwd`를 프로젝트 해시 형식으로 정규화하여 Claude 프로젝트 디렉토리를 찾는다.
2. 가장 최근 세션 디렉토리를 찾는다.
3. 모든 sub-agent JSONL 파일을 파싱한다. `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`를 누적한다.
4. `.meta.json` 사이드카 파일에서 agent 유형을 읽는다.
5. `.geas/state/token-summary.json`에 전체 내역(totals, agent별, 타임스탬프)을 기록한다.
6. stderr에 요약을 출력한다:
   ```
   [Geas] Token summary: input=N output=N agents=N
   ```

**조건:** `.geas/`가 없거나 Claude 프로젝트 디렉토리를 찾을 수 없으면 건너뛴다.

---

### Hook 10 — restore-context.sh

| 필드 | 값 |
|---|---|
| Event | `PostCompact` |
| Script | `plugin/hooks/scripts/restore-context.sh` |
| Blocking | 안 함 (항상 exit 0) |
| Timeout | 10 s |

Claude Code 런타임이 컨텍스트 윈도우를 압축할 때마다 실행된다. 오케스트레이터가 현재 위치를 잃지 않도록 핵심 상태를 재주입한다.

1. `run.json`에서 컨텍스트 블록을 구성한다: Phase, Status, Mission, Current task ID, Completed tasks (최근 5개).
2. checkpoint가 있으면 포함한다: pipeline step, agent in flight, remaining steps, NEXT STEP (강조 표시).
3. recovery class가 있으면 포함한다.
4. 활성 task가 있으면 task contract (goal + acceptance criteria)를 포함한다.
5. `.geas/state/session-latest.md`를 읽어 `--- SESSION CONTEXT ---` 섹션으로 주입한다.
6. 현재 task의 `record.json` closure 섹션에서 `open_risks` 배열을 읽는다.
7. `.geas/rules.md`의 처음 30줄을 `--- KEY RULES ---`로 포함한다.
8. agent memory 파일 수를 `--- MEMORY STATE ---`로 포함한다.
9. `## L0 ANTI-FORGETTING` 섹션에 7개 필수 보존 항목을 출력한다:
   - Phase 및 status
   - 현재 task와 goal
   - 되감기 사유 (recovery class 또는 clean session)
   - 다음 필수 산출물 (remaining_steps에서)
   - 미해결 위험 (record.json closure에서)
   - 복구 결과
   - 활성 규칙 수 + agent memory 파일 수
10. stdout에 `{"additionalContext": "..."}`를 출력한다.

**조건:** `cwd`가 비어 있거나 `.geas/state/run.json`이 없으면 건너뛴다.

---

## 공유 라이브러리 — geas-hooks.js

경로: `plugin/hooks/scripts/lib/geas-hooks.js`

모든 hook 스크립트가 공통 작업에 사용하는 Node.js 모듈이다. 유틸리티 함수:

| Function | 설명 |
|---|---|
| `parseInput()` | stdin JSON을 읽고 `cwd`, `filePath`, `agentType`, `command`를 추출한다 |
| `geasDir(cwd)` | 지정된 작업 디렉토리의 `.geas/` 경로를 반환한다 |
| `readJson(path)` | JSON 파일을 파싱한다. 오류 시 `null` 반환 |
| `writeJson(path, data)` | 2칸 들여쓰기로 JSON을 기록한다. 부모 디렉토리를 자동 생성한다 |
| `appendJsonl(path, obj)` | JSONL 파일에 한 줄을 추가한다 |
| `warn(msg)` | stderr에 `[Geas] WARNING: <msg>`를 출력한다 |
| `info(msg)` | stderr에 `[Geas] <msg>`를 출력한다 |
| `fnmatch(str, pattern)` | `*`와 `?`를 지원하는 glob 매칭 |
| `matchScope(rel, paths)` | 상대 경로가 scope.surfaces 항목과 일치하는지 확인한다 |
| `outputContext(ctx)` | stdout에 `{"additionalContext": "..."}`를 출력한다 |
| `exists(path)` | 파일 존재 여부를 확인한다 |
| `relPath(filePath, cwd)` | 슬래시로 정규화된 상대 경로를 반환한다 |

---

## Hook 커스터마이징

Hook은 `plugin/hooks/hooks.json`에 선언한다. 스키마:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<tool_name_regex_or_empty>",
        "hooks": [
          {
            "type": "command",
            "command": "<absolute_path_or_env_var_path>",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**주요 필드:**

| 필드 | 설명 |
|---|---|
| `EventName` | `SessionStart`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `PostCompact`, `Stop` 중 하나 |
| `matcher` | `PreToolUse`/`PostToolUse`용: 파이프로 구분된 도구 이름 정규식 (예: `Write\|Edit`). 빈 문자열은 전체 매칭 |
| `command` | 실행할 셸 명령. `${CLAUDE_PLUGIN_ROOT}`는 플러그인 디렉토리로 해석된다 |
| `timeout` | hook 강제 종료까지 최대 초 수 |

**새 hook 추가 방법:**

1. `plugin/hooks/scripts/`에 스크립트를 작성한다.
2. 실행 권한을 부여한다 (`chmod +x`).
3. 적절한 event 아래 `hooks.json`에 항목을 추가한다.
4. 스크립트는 stdin으로 hook 페이로드를 JSON으로 수신한다. stdout에 `{"additionalContext": "..."}`를 출력하면 컨텍스트가 주입된다 (SubagentStart와 PostCompact만 해당).

**Exit code 규칙:**

| 코드 | 효과 |
|---|---|
| 0 | 성공, 계속 진행 |
| 1 | 오류 (기록되지만 차단하지 않음) |
| 2 | 차단 (`Stop` hook에서만 유효) |

Hook 실패 처리, 런타임 검증, 재개와 관련된 프로토콜 상세는 `protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md`, `protocol/05_RUNTIME_STATE_AND_RECOVERY.md`, `protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`, `architecture/CLI.md`를 참조한다.

---

## Hook이 참조하는 상태 파일

| 경로 | 사용하는 hook |
|---|---|
| `.geas/state/run.json` | session-init, restore-context, protect-geas-state, checkpoint-pre-write, checkpoint-post-write, packet-stale-check |
| `.geas/state/_checkpoint_pending` | checkpoint-pre-write (생성), checkpoint-post-write (제거) |
| `.geas/memory/agents/*.md` | session-init (개수 확인), inject-context, restore-context |
| `.geas/state/locks.json` | integration-lane-check |
| `.geas/rules.md` | session-init (생성), inject-context (읽기), restore-context (읽기) |
| `.geas/missions/<mid>/tasks/<tid>/contract.json` | protect-geas-state (scope 체크), restore-context (goal + criteria) |
| `.geas/missions/<mid>/tasks/<tid>/packets/*.md` | packet-stale-check (staleness 체크) |
| `.geas/missions/<mid>/tasks/<tid>/record.json` | restore-context (closure.open_risks 읽기) |
| `.geas/missions/<mid>/spec.json` | protect-geas-state (동결 보호) |
| `.geas/state/policy-overrides.json` | inject-context |
| `.geas/state/session-latest.md` | restore-context |
| `.geas/state/token-summary.json` | calculate-cost (기록) |
| `.geas/state/events.jsonl` | (CLI를 통한 이벤트 로깅) |
