# Hooks 레퍼런스

Geas 훅은 Claude Code 하네스가 수명주기 이벤트마다 자동으로 실행하는 셸 스크립트다. 조율자가 일일이 호출하지 않아도 거버넌스 불변 조건을 강제하고, 에이전트 컨텍스트를 주입하고, 텔레메트리를 기록한다.

설정: `plugin/hooks/hooks.json`
스크립트: `plugin/hooks/scripts/`

---

## 훅 수명주기

아래 다이어그램은 일반적인 Geas 세션에서 훅이 실행되는 순서를 보여준다.

```
세션 시작
│
├─► SessionStart       → session-init.sh
│     .geas/ 상태 확인, rules.md 컨텍스트 주입
│
│   [하위 에이전트 생성 시마다]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     rules.md + 에이전트 메모리를 하위 에이전트 컨텍스트에 주입
│   │
│   │   [Write 또는 Edit 도구 호출 시마다]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     타임스탬프 주입, 금지 경로 경고, seed.json 보호
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → verify-task-status.sh
│   │   │     5개 필수 evidence 파일 확인 + rubric_scores 검증
│   │   │
│   │   └─► PostToolUse (Write|Edit) → check-debt.sh
│   │         HIGH 부채 항목 3개 이상이면 경고
│   │
│   │   [컨텍스트 압축 발생 시]
│   │   │
│   │   └─► PostCompact → restore-context.sh
│   │         run.json 상태, remaining_steps, NEXT STEP 재주입
│   │
│   └─► SubagentStop   → agent-telemetry.sh
│         에이전트 생성 메타데이터를 costs.jsonl에 기록
│
세션 종료
│
├─► Stop               → verify-pipeline.sh   [차단]
│     완료된 모든 작업의 필수 evidence 확인
│
└─► Stop               → calculate-cost.sh
      토큰 사용량 + 추정 비용 요약
```

---

## Hook 1 — session-init.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `SessionStart` |
| 스크립트 | `plugin/hooks/scripts/session-init.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

Claude Code 세션 시작 시 한 번 실행된다.

1. **훅 입력 JSON에서 `cwd`를 읽는다.** `cwd`가 없으면 즉시 종료한다.
2. **`.geas/` 디렉토리 존재를 확인한다.** 디렉토리가 없으면 Geas 프로젝트가 아니므로 조용히 종료한다.
3. **`.geas/state/run.json` 존재를 확인한다.** 없으면 stderr에 경고를 출력하고(`[Geas] .geas/ directory exists but no run.json. Run setup first.`) 종료한다.
4. **run.json에서 세션 상태를 로드하고** stderr에 이어하기 요약을 출력한다:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
   checkpoint가 있으면 추가로 출력한다:
   ```
   [Geas] Checkpoint: task=<task_id>, step=<pipeline_step>, agent=<agent_in_flight>
   ```
5. **`.geas/rules.md`가 없으면 생성한다.** evidence 형식 요구사항과 금지 경로 규칙을 담은 기본 템플릿을 사용한다. 파일 생성 시 stderr에 안내를 출력한다.

### 조건

- `cwd`가 비어 있으면 전부 건너뛴다.
- `.geas/`가 없으면 전부 건너뛴다(Geas 프로젝트가 아님).
- `run.json`이 없으면 로드를 건너뛰지만 경고는 출력한다.

---

## Hook 2 — inject-context.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `SubagentStart` |
| 스크립트 | `plugin/hooks/scripts/inject-context.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

하위 에이전트가 생성될 때마다 실행된다. 프로젝트 전체 규칙과 에이전트별 메모리를 하위 에이전트의 시작 컨텍스트에 주입한다.

1. **훅 입력 JSON에서 `cwd`와 `agent_type`을 읽는다.** `agent_type`에 플러그인 접두사(예: `geas:nova`)가 붙어 있을 수 있는데, 훅이 이걸 떼어내 순수 에이전트 이름(`nova`)을 얻는다.
2. **`.geas/` 디렉토리를 확인한다.** 없으면 조용히 종료한다.
3. **`.geas/rules.md`를 읽고** `--- PROJECT RULES (.geas/rules.md) ---` 헤더 아래 컨텍스트 블록에 포함한다.
4. **`.geas/memory/agents/<agent_name>.md`가 있으면 읽고** `--- YOUR MEMORY (.geas/memory/agents/<agent_name>.md) ---` 헤더 아래 포함한다. 이를 통해 각 에이전트 역할에 맞는 메모리가 세션 간에 지속된다.
5. **JSON 객체를 stdout으로 출력한다:**
   ```json
   { "additionalContext": "..." }
   ```
   하네스가 이걸 하위 에이전트의 시스템 컨텍스트에 머지한 뒤 첫 메시지를 전달한다.

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뛴다.
- 해당 에이전트의 메모리 파일이 없으면 에이전트 메모리 주입을 건너뛴다.
- rules.md도 메모리 파일도 없으면 아무것도 출력하지 않는다(JSON 없음).

---

## Hook 3 — protect-geas-state.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/protect-geas-state.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

`Write` 또는 `Edit` 도구 호출 후마다 실행된다. 세 가지 역할을 한다.

**1. 금지 경로 경고**

현재 작업의 `.geas/tasks/<current_task_id>.json`에서 `prohibited_paths` 목록을 읽는다. 작성된 파일이 해당 glob 패턴에 매칭되면(`fnmatch` 사용) stderr에 경고를 출력한다:
```
[Geas] WARNING: Write to <rel_path> matches prohibited path "<pattern>" in <task_id>
```
`.geas/` 내부 경로는 이 검사에서 항상 면제된다.

**2. 자동 타임스탬프 주입**

작성된 파일 경로가 `*/.geas/*.json`에 매칭되면, 파일을 읽어 `created_at` 필드를 검사한다. 다음 경우에 실제 UTC 타임스탬프(`YYYY-MM-DDTHH:MM:SSZ`)를 주입한다:
- `created_at`가 없거나 비어 있는 경우
- `created_at`가 더미 값처럼 보이는 경우(`:00:00Z` 또는 `:00:00.000Z`로 끝남)

에이전트가 `created_at`를 수동으로 설정할 필요가 없다. 훅이 쓰기 후 자동으로 교정한다.

**3. seed.json 동결 보호**

작성된 파일 경로가 `*/.geas/spec/seed.json`에 매칭되면 stderr에 경고를 출력한다:
```
[Geas] Warning: seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes.
```

### 조건

- 훅 입력에서 `cwd`나 `file_path`를 파싱할 수 없으면 즉시 건너뛴다.
- `run.json`에 활성 `current_task_id`가 없거나 작업 파일이 없으면 금지 경로 검사를 건너뛴다.
- 타임스탬프 주입은 `.geas/` 하위의 `.json` 확장자 파일에만 적용된다.
- seed.json 경고는 해당 경로에 대한 모든 쓰기에 내용과 무관하게 발동한다.

---

## Hook 4 — verify-task-status.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/verify-task-status.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

`Write` 또는 `Edit` 도구 호출 후마다 실행되지만, 작업 파일이 작성될 때만 동작한다.

1. **`.geas/tasks/*.json` 파일만 필터링한다.** 다른 쓰기는 즉시 무시한다.
2. **작업 파일을 읽는다.** `status`가 `"passed"`이면 5개 필수 evidence 아티팩트 존재를 확인한다:

   | 파일 | 역할 |
   |------|------|
   | `.geas/evidence/<tid>/forge-review.json` | Code Review (Forge) |
   | `.geas/evidence/<tid>/sentinel.json` | QA Testing (Sentinel) |
   | `.geas/evidence/<tid>/critic-review.json` | Pre-ship Review (Critic) |
   | `.geas/evidence/<tid>/nova-verdict.json` | Product Review (Nova) |
   | `.geas/memory/retro/<tid>.json` | Scrum Retrospective |

   누락된 파일마다 stderr에 경고를 출력한다.

3. **sentinel과 forge-review evidence의 `rubric_scores`를 검증한다.** `sentinel.json`이나 `forge-review.json`이 존재하지만 비어 있지 않은 `rubric_scores` 필드가 없으면 출력한다:
   ```
   [Geas] Warning: <tid> sentinel.json is missing rubric_scores
   [Geas] Warning: <tid> forge-review.json is missing rubric_scores
   ```

### 조건

- `.geas/tasks/*.json`에 대한 쓰기에서만 동작한다.
- 작업 `status`가 `"passed"`일 때만 evidence를 확인한다.
- rubric_scores 검사는 해당 evidence 파일이 이미 존재할 때만 실행된다.

---

## Hook 5 — check-debt.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/check-debt.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

`Write` 또는 `Edit` 도구 호출 후마다 실행되지만, 부채 원장에서만 동작한다.

1. **`.geas/debt.json`만 필터링한다.** 다른 쓰기는 즉시 무시한다.
2. **부채 파일을 읽고** `severity == "HIGH"`이면서 `status == "open"`인 항목 수를 센다.
3. **3개 이상이면 경고한다:**
   ```
   [Geas] <N> HIGH tech debts open. Consider addressing before new features.
   ```
   경고는 stderr로 출력되며 파이프라인을 차단하지 않는다.

### 조건

- `.geas/debt.json`에 대한 쓰기에서만 동작한다.
- 경고 임계값은 open HIGH 항목 3개다.

---

## Hook 6 — restore-context.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `PostCompact` |
| 스크립트 | `plugin/hooks/scripts/restore-context.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

Claude Code 하네스가 컨텍스트 윈도우를 압축할 때마다 실행된다. 압축은 대화 이력을 버리는데, 이러면 조율자가 현재 작업과 파이프라인 위치를 잊어버릴 수 있다. 이 훅이 핵심 상태를 재주입한다.

1. **`.geas/`와 `run.json` 존재를 확인한다.** 둘 중 하나라도 없으면 조용히 종료한다.
2. **`run.json`에서 컨텍스트 블록을 구성한다:**
   - `Mode | Phase | Status`
   - `Mission`
   - `Current task ID`
   - `Completed tasks` (최근 5개만 표시)
3. **checkpoint가 있으면 포함한다:**
   - `Pipeline step` (진행 중이던 단계)
   - `Agent in flight` (실행 중이던 에이전트)
   - **`Remaining steps`** — 아직 실행할 파이프라인 단계의 순서 목록
   - **`NEXT STEP`** — `remaining_steps`의 첫 항목. 조율자가 다음에 뭘 할지 즉시 알 수 있도록 강조
4. **활성 작업이 있으면 현재 작업 계약**(목표 + acceptance criteria)을 포함한다.
5. **`.geas/rules.md`의 첫 30줄을** `--- KEY RULES ---` 헤더 아래 포함한다.
6. **JSON 객체를 stdout으로 출력한다:**
   ```json
   { "additionalContext": "..." }
   ```

### 조건

- `cwd`가 비어 있거나 `.geas/run.json`이 없으면 건너뛴다.
- checkpoint가 기록되지 않았으면 checkpoint 섹션을 생략한다.
- `current_task_id`가 없거나 작업 파일이 없으면 작업 계약 섹션을 생략한다.
- `rules.md`가 없으면 규칙 섹션을 생략한다.

---

## Hook 7 — agent-telemetry.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `SubagentStop` |
| 스크립트 | `plugin/hooks/scripts/agent-telemetry.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 10초 |

### 하는 일

하위 에이전트가 종료될 때마다 실행된다. 에이전트 생성 메타데이터를 ledger에 기록해 분포 분석에 쓴다. 참고: 이 훅은 실제 토큰 수를 기록하지 **않는다** — 그건 세션 종료 시 `calculate-cost.sh`가 한다.

1. **훅 입력에서 `cwd`와 `agent_type`을 읽는다.** 플러그인 접두사를 떼어낸다(예: `geas:nova` → `nova`).
2. **`run.json`을 읽어** 현재 `task_id`와 `phase`를 가져온다.
3. **하드코딩된 매핑으로 모델을 결정한다:**
   - `opus`: nova, forge, circuit, pixel, critic
   - `sonnet`: 나머지 모든 에이전트
4. **`.geas/ledger/costs.jsonl`에 JSONL 항목을 추가한다:**
   ```json
   {
     "event": "agent_complete",
     "agent": "nova",
     "task_id": "TASK-001",
     "phase": "mvp",
     "model": "opus",
     "timestamp": "2026-03-30T12:00:00Z"
   }
   ```
   디렉토리가 없으면 생성한다.

### 조건

- `cwd`가 비어 있거나 `run.json`이 없으면 건너뛴다.
- 활성 작업이 없어도 `costs.jsonl`에 추가한다(`task_id`가 빈 문자열일 수 있음).

---

## Hook 8 — verify-pipeline.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/verify-pipeline.sh` |
| **차단 여부** | **예 — exit 2로 세션 종료를 차단한다** |
| 타임아웃 | 30초 |

### 하는 일

세션이 끝나려 할 때 실행된다. 시스템에서 유일하게 exit code 2를 반환해 **파이프라인을 차단할 수 있는** 훅이다.

1. **`.geas/`와 `run.json` 존재를 확인한다.** 없으면 exit 0(허용)으로 종료한다 — Geas 프로젝트가 아닌 경우 영향을 받지 않는다.
2. **완료된 작업이 없으면 건너뛴다**(`completed_tasks`가 비어 있음). 확인할 것이 없다.
3. **`completed_tasks`의 모든 작업 ID를 순회하며** 5개 필수 evidence 파일을 확인한다:

   | 파일 | 설명 |
   |------|------|
   | `.geas/evidence/<tid>/forge-review.json` | Code Review |
   | `.geas/evidence/<tid>/sentinel.json` | QA Testing |
   | `.geas/evidence/<tid>/critic-review.json` | Critic Pre-ship Review |
   | `.geas/evidence/<tid>/nova-verdict.json` | Nova Product Review |
   | `.geas/memory/retro/<tid>.json` | Scrum Retrospective |

4. **누락된 파일이 있으면** stderr에 출력한다:
   ```
   [Geas] Pipeline incomplete. MANDATORY evidence missing:
     - TASK-001: sentinel.json (QA Testing) missing
     - TASK-001: memory/retro/TASK-001.json (Scrum Retrospective) missing

   Execute the missing steps before completing the session.
   ```
   그리고 **exit code 2로 종료**한다. 하네스가 세션 종료를 차단한다.

5. **모든 evidence가 있으면** exit 0으로 종료하고 세션이 정상 종료된다.

### Exit 코드

| 코드 | 의미 |
|------|------|
| 0 | 파이프라인 완료 — 세션 종료 허용 |
| 2 | Evidence 누락 — 세션 종료 차단 |

### 조건

- Geas 프로젝트가 아니면(`.geas/` 없음) 절대 차단하지 않는다.
- 완료된 작업이 0개면 절대 차단하지 않는다.

---

## Hook 9 — calculate-cost.sh

| 필드 | 값 |
|------|-----|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/calculate-cost.sh` |
| 차단 여부 | 아니오 (항상 exit 0) |
| 타임아웃 | 30초 |

### 하는 일

세션 종료 시(`verify-pipeline.sh` 이후) 실행된다. `~/.claude/projects/`의 하위 에이전트 세션 JSONL 파일을 파싱해 실제 토큰 사용량과 추정 비용을 계산한다.

1. **Claude 프로젝트 디렉토리를 찾는다.** `cwd`를 Claude가 사용하는 프로젝트 해시 형식으로 정규화한다(예: `A:\geas-test3` → `A--geas-test3`). `~/.claude/projects/` 아래에서 매칭되는 디렉토리를 찾는다.
2. **`subagents/` 하위 디렉토리가 있는 가장 최근 수정된 세션을 찾는다.**
3. **해당 디렉토리의 모든 하위 에이전트 JSONL 파일을 파싱한다.** 각 `assistant` 메시지에서 다음을 누적한다:
   - `input_tokens`
   - `output_tokens`
   - `cache_creation_input_tokens`
   - `cache_read_input_tokens`
4. **`.meta.json` 사이드카 파일에서 에이전트 유형을 읽어** 토큰 수를 에이전트 역할별로 귀속시킨다.
5. **Opus 가격을 상한으로 추정 비용을 계산한다:**
   - Input: $15 / 1M 토큰
   - Output: $75 / 1M 토큰
   - Cache creation: $3.75 / 1M 토큰
   - Cache read: $1.50 / 1M 토큰
6. **`.geas/ledger/cost-summary.json`에 전체 내역을 작성한다:**
   ```json
   {
     "session_cost_usd": 1.23,
     "tokens": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "cost_breakdown_usd": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "agent_count": 8,
     "agents": { "nova": { "input": 0, "output": 0, "spawns": 2 }, ... },
     "calculated_at": "2026-03-30T12:00:00Z"
   }
   ```
   에이전트는 output 토큰 내림차순으로 정렬된다.
7. **stderr에 요약 한 줄을 출력한다:**
   ```
   [Geas] Session cost: $1.23 (8 agents, 12,345 output tokens)
   ```

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뛴다.
- `~/.claude/projects/` 아래에서 Claude 프로젝트 디렉토리를 찾을 수 없으면 건너뛴다.
- `subagents/` 디렉토리가 있는 세션을 찾을 수 없으면 건너뛴다.
- 개별 JSONL 파싱 오류는 조용히 무시한다 — 이 훅은 best-effort로 동작한다.

---

## 훅 커스터마이징

훅은 `plugin/hooks/hooks.json`에 선언한다. 스키마는 다음과 같다:

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
|------|------|
| `EventName` | `SessionStart`, `SubagentStart`, `PostToolUse`, `SubagentStop`, `PostCompact`, `Stop` 중 하나 |
| `matcher` | `PostToolUse`용: 도구 이름의 파이프 구분 정규식(예: `Write\|Edit`). 빈 문자열은 전체 매칭. |
| `command` | 실행할 셸 명령. `${CLAUDE_PLUGIN_ROOT}`가 플러그인 디렉토리로 치환된다. |
| `timeout` | 훅이 강제 종료되기까지의 최대 초 수. |

**새 훅 추가 방법:**

1. `plugin/hooks/scripts/`에 스크립트를 작성한다.
2. 실행 권한을 부여한다(`chmod +x`).
3. `hooks.json`의 적절한 이벤트 아래에 항목을 추가한다.
4. 스크립트는 stdin으로 훅 페이로드를 JSON으로 받는다. stdout에 `{"additionalContext": "..."}`를 출력해 컨텍스트를 주입할 수 있다(SubagentStart와 PostCompact에서만).

**Exit 코드 규칙:**

| 코드 | 효과 |
|------|------|
| 0 | 성공, 계속 진행 |
| 1 | 에러 (기록되지만 차단하지 않음) |
| 2 | 파이프라인 차단 (`Stop` 훅에서만 의미 있음) |

---

## 훅이 참조하는 상태 파일

| 경로 | 사용하는 훅 |
|------|-----------|
| `.geas/state/run.json` | session-init, restore-context, verify-pipeline, agent-telemetry |
| `.geas/rules.md` | session-init (생성), inject-context (읽기), restore-context (읽기) |
| `.geas/memory/agents/<name>.md` | inject-context |
| `.geas/tasks/<tid>.json` | protect-geas-state, verify-task-status |
| `.geas/evidence/<tid>/forge-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/sentinel.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/critic-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/nova-verdict.json` | verify-task-status, verify-pipeline |
| `.geas/memory/retro/<tid>.json` | verify-task-status, verify-pipeline |
| `.geas/spec/seed.json` | protect-geas-state (동결 보호) |
| `.geas/debt.json` | check-debt |
| `.geas/ledger/costs.jsonl` | agent-telemetry |
| `.geas/ledger/cost-summary.json` | calculate-cost |
