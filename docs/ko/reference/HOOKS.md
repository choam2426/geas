# Hooks 레퍼런스

Geas 훅은 Claude Code 하네스가 정의된 수명 주기 이벤트에 자동으로 실행하는 셸 스크립트입니다. 오케스트레이터가 이를 기억하여 호출할 필요 없이 거버넌스 불변 조건을 강제하고, 에이전트 컨텍스트를 삽입하며, 텔레메트리를 기록합니다.

설정: `plugin/hooks/hooks.json`
스크립트: `plugin/hooks/scripts/`

---

## 훅 수명 주기

다음 다이어그램은 일반적인 Geas 세션 중 훅이 실행되는 순서를 보여줍니다.

```
세션 시작
│
├─► SessionStart       → session-init.sh
│     .geas/ 상태 확인, rules.md 컨텍스트 삽입
│
│   [생성된 각 하위 에이전트에 대해]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     rules.md + 에이전트 메모리를 하위 에이전트 컨텍스트에 삽입
│   │
│   │   [각 Write 또는 Edit 도구 호출에 대해]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     타임스탬프 삽입, 금지된 경로 경고, seed.json 보호
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → verify-task-status.sh
│   │   │     5개 필수 evidence 파일 + rubric_scores 검증 확인
│   │   │
│   │   └─► PostToolUse (Write|Edit) → check-debt.sh
│   │         HIGH 부채 항목이 >= 3일 때 경고
│   │
│   │   [컨텍스트 압축 실행 시]
│   │   │
│   │   └─► PostCompact → restore-context.sh
│   │         run.json 상태, remaining_steps, NEXT STEP 재삽입
│   │
│   └─► SubagentStop   → agent-telemetry.sh
│         에이전트 생성 메타데이터를 costs.jsonl에 기록
│
세션 종료
│
├─► Stop               → verify-pipeline.sh   [차단]
│     완료된 모든 작업에 필수 evidence가 있는지 확인
│
└─► Stop               → calculate-cost.sh
      토큰 사용량 + 예상 비용 요약
```

---

## 훅 1 — session-init.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SessionStart` |
| 스크립트 | `plugin/hooks/scripts/session-init.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

Claude Code 세션이 시작될 때 한 번 실행됩니다.

1. **훅 입력 JSON에서 `cwd`를 읽습니다.** `cwd`가 없으면 즉시 종료합니다.
2. **`.geas/` 디렉토리를 확인합니다.** 디렉토리가 없으면 프로젝트가 Geas 프로젝트가 아닙니다 — 조용히 종료합니다.
3. **`.geas/state/run.json`을 확인합니다.** 없으면 stderr에 경고를 출력하고 (`[Geas] .geas/ directory exists but no run.json. Run setup first.`) 종료합니다.
4. **run.json에서 세션 상태를 로드**하고 stderr에 재개 요약을 출력합니다:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
   체크포인트가 있으면 다음도 출력합니다:
   ```
   [Geas] Checkpoint: task=<task_id>, step=<pipeline_step>, agent=<agent_in_flight>
   ```
5. **`.geas/rules.md`가 없으면 생성합니다**, evidence 형식 요구사항과 금지된 경로 규칙을 포함하는 내장 템플릿을 사용합니다. 파일이 생성될 때 stderr에 알림을 출력합니다.

### 조건

- `cwd`가 비어 있으면 완전히 건너뜁니다.
- `.geas/`가 없으면 완전히 건너뜁니다 (비-Geas 프로젝트).
- `run.json`이 없으면 run.json 로딩을 건너뜁니다만, 여전히 경고를 출력합니다.

---

## 훅 2 — inject-context.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SubagentStart` |
| 스크립트 | `plugin/hooks/scripts/inject-context.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

하위 에이전트가 생성될 때마다 실행됩니다. 프로젝트 전체 규칙과 에이전트별 메모리를 하위 에이전트의 시작 컨텍스트에 삽입합니다.

1. **훅 입력 JSON에서 `cwd`와 `agent_type`을 읽습니다.** `agent_type` 필드에는 플러그인 접두사가 있을 수 있으며 (예: `geas:nova`); 훅은 이를 제거하여 에이전트 이름만 가져옵니다 (`nova`).
2. **`.geas/` 디렉토리를 확인합니다.** 없으면 조용히 종료합니다.
3. **`.geas/rules.md`를 읽고** `--- PROJECT RULES (.geas/rules.md) ---` 헤더 아래 컨텍스트 블록에 포함합니다.
4. **`.geas/memory/agents/<agent_name>.md`를 읽고** (있으면) `--- YOUR MEMORY (.geas/memory/agents/<agent_name>.md) ---` 헤더 아래 포함합니다. 이를 통해 각 에이전트 역할은 세션에 걸쳐 지속되는 역할별 메모리를 갖습니다.
5. **stdout에 JSON 객체를 출력합니다**:
   ```json
   { "additionalContext": "..." }
   ```
   하네스는 하위 에이전트가 첫 번째 메시지를 받기 전에 이를 하위 에이전트의 시스템 컨텍스트에 병합합니다.

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뜁니다.
- 해당 에이전트 이름의 메모리 파일이 없으면 에이전트 메모리 삽입을 건너뜁니다.
- rules.md와 메모리 파일 모두 없으면 아무것도 출력하지 않습니다 (JSON 없음).

---

## 훅 3 — protect-geas-state.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/protect-geas-state.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 세 가지 별도의 책임을 가집니다.

**1. 금지된 경로 경고**

`.geas/tasks/<current_task_id>.json`에서 현재 작업의 `prohibited_paths` 목록을 읽습니다. 작성된 파일이 해당 glob 패턴 중 하나와 일치하면 (`fnmatch`를 통해), stderr에 경고를 출력합니다:
```
[Geas] WARNING: Write to <rel_path> matches prohibited path "<pattern>" in <task_id>
```
`.geas/` 내부 경로는 항상 이 확인에서 제외됩니다.

**2. 자동 타임스탬프 삽입**

작성된 파일 경로가 `*/.geas/*.json`과 일치하면, 훅은 파일을 읽고 `created_at` 필드를 검사합니다. 다음 경우에 실제 UTC 타임스탬프 (`YYYY-MM-DDTHH:MM:SSZ`)를 삽입합니다:
- `created_at`이 없거나 비어 있을 때, 또는
- `created_at`이 더미 값처럼 보일 때 (`:00:00Z` 또는 `:00:00.000Z`로 끝나는 경우).

즉, 에이전트는 `created_at`을 수동으로 설정할 필요가 없습니다; 훅이 쓰기 후 자동으로 수정합니다.

**3. seed.json 고정 보호**

작성된 파일 경로가 `*/.geas/spec/seed.json`과 일치하면, stderr에 경고를 출력합니다:
```
[Geas] Warning: seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes.
```

### 조건

- 훅 입력에서 `cwd` 또는 `file_path`를 파싱할 수 없으면 즉시 건너뜁니다.
- `run.json`에 활성 `current_task_id`가 없거나 작업 파일이 없으면 금지된 경로 확인을 건너뜁니다.
- 타임스탬프 삽입은 `.geas/` 아래 `.json` 확장자 파일에만 적용됩니다.
- seed.json 경고는 내용에 관계없이 해당 정확한 경로에 대한 모든 쓰기에 실행됩니다.

---

## 훅 4 — verify-task-status.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/verify-task-status.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

모든 `Write` 또는 `Edit` 도구 호출 후에 실행되지만, 작업 파일이 작성될 때만 동작합니다.

1. **`.geas/tasks/*.json` 파일에만 필터링합니다.** 다른 모든 쓰기는 즉시 무시됩니다.
2. **작업 파일을 읽습니다.** `status`가 `"passed"`이면, 5개의 필수 evidence 아티팩트의 존재를 확인합니다:

   | 파일 | 역할 |
   |---|---|
   | `.geas/evidence/<tid>/forge-review.json` | 코드 리뷰 (Forge) |
   | `.geas/evidence/<tid>/sentinel.json` | QA 테스팅 (Sentinel) |
   | `.geas/evidence/<tid>/critic-review.json` | Pre-ship 검토 (Critic) |
   | `.geas/evidence/<tid>/nova-verdict.json` | 제품 검토 (Nova) |
   | `.geas/memory/retro/<tid>.json` | Scrum 회고 |

   각 누락 파일에 대해 stderr에 경고를 출력합니다.

3. **sentinel과 forge-review evidence에서 `rubric_scores`를 검증합니다** (최근 추가). `sentinel.json` 또는 `forge-review.json`이 있지만 비어 있지 않은 `rubric_scores` 필드가 없으면 출력합니다:
   ```
   [Geas] Warning: <tid> sentinel.json is missing rubric_scores
   [Geas] Warning: <tid> forge-review.json is missing rubric_scores
   ```

### 조건

- `.geas/tasks/*.json`에 대한 쓰기에만 활성화됩니다.
- 작업 `status` 필드가 `"passed"`와 같을 때만 evidence를 확인합니다.
- rubric_scores 확인은 해당 evidence 파일이 이미 존재하는 경우에만 실행됩니다.

---

## 훅 5 — check-debt.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/check-debt.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

모든 `Write` 또는 `Edit` 도구 호출 후에 실행되지만, 부채 원장에만 동작합니다.

1. **`.geas/debt.json`에만 필터링합니다.** 다른 모든 쓰기는 즉시 무시됩니다.
2. **부채 파일을 읽고** `severity == "HIGH"` 및 `status == "open"`인 항목을 셉니다.
3. **개수가 3 이상이면 경고합니다:**
   ```
   [Geas] <N> HIGH tech debts open. Consider addressing before new features.
   ```
   경고는 stderr에 출력되며 파이프라인을 차단하지 않습니다.

### 조건

- `.geas/debt.json`에 대한 쓰기에만 활성화됩니다.
- 경고 임계값은 3개의 열린 HIGH 항목입니다.

---

## 훅 6 — restore-context.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostCompact` |
| 스크립트 | `plugin/hooks/scripts/restore-context.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

Claude Code 하네스가 컨텍스트 창을 압축할 때마다 실행됩니다. 압축은 대화 기록을 버리는데, 이로 인해 오케스트레이터가 현재 작업과 파이프라인 위치를 잃을 수 있습니다. 이 훅은 중요한 상태를 재삽입합니다.

1. **`.geas/`와 `run.json`을 확인합니다.** 없으면 조용히 종료합니다.
2. **`run.json`에서 컨텍스트 블록을 구성합니다**:
   - `Mode | Phase | Status`
   - `Mission`
   - `Current task ID`
   - `Completed tasks` (마지막 5개 표시)
3. **있으면 체크포인트 데이터를 포함합니다**:
   - `Pipeline step` (진행 중이던 단계)
   - `Agent in flight` (실행 중이던 에이전트)
   - **`Remaining steps`** — 아직 실행할 파이프라인 단계의 순서 목록 (최근 추가)
   - **`NEXT STEP`** — `remaining_steps`의 첫 번째 항목, 오케스트레이터가 즉시 다음에 무엇을 해야 하는지 알 수 있도록 강조 표시
4. **작업이 활성화되어 있으면 현재 작업 계약**을 포함합니다 (목표 + 인수 기준).
5. **`.geas/rules.md`의 처음 30줄**을 `--- KEY RULES ---` 헤더 아래 포함합니다.
6. **stdout에 JSON 객체를 출력합니다**:
   ```json
   { "additionalContext": "..." }
   ```

### 조건

- `cwd`가 비어 있거나 `.geas/run.json`이 없으면 건너뜁니다.
- 체크포인트가 기록되지 않으면 체크포인트 섹션을 생략합니다.
- `current_task_id`가 설정되지 않거나 작업 파일이 없으면 작업 계약 섹션을 생략합니다.
- `rules.md`가 없으면 규칙 섹션을 생략합니다.

---

## 훅 7 — agent-telemetry.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SubagentStop` |
| 스크립트 | `plugin/hooks/scripts/agent-telemetry.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 10초 |

### 동작 내용

하위 에이전트가 완료될 때마다 실행됩니다. 분포 분석을 위해 에이전트 생성 메타데이터를 원장에 기록합니다. 참고: 이 훅은 실제 토큰 수를 기록하지 **않습니다** — 그것은 세션 종료 시 `calculate-cost.sh`가 수행합니다.

1. **훅 입력에서 `cwd`와 `agent_type`을 읽습니다.** 플러그인 접두사를 제거합니다 (예: `geas:nova` → `nova`).
2. **`run.json`을 읽어** 현재 `task_id`와 `phase`를 가져옵니다.
3. **하드코딩된 매핑에서 모델을 결정합니다**:
   - `opus`: nova, forge, circuit, pixel, critic
   - `sonnet`: 다른 모든 에이전트
4. **JSONL 항목을 `.geas/ledger/costs.jsonl`에 추가합니다**:
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
   디렉토리가 없으면 생성합니다.

### 조건

- `cwd`가 비어 있거나 `run.json`이 없으면 건너뜁니다.
- 작업이 활성화되어 있지 않아도 `costs.jsonl`에 추가합니다 (`task_id`는 빈 문자열일 수 있음).

---

## 훅 8 — verify-pipeline.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/verify-pipeline.sh` |
| **차단 여부** | **예 — 세션 종료를 차단하기 위해 exit 2 반환** |
| 시간 제한 | 30초 |

### 동작 내용

세션이 종료되려고 할 때 실행됩니다. 이것은 exit 코드 2를 반환하여 **파이프라인을 차단**할 수 있는 시스템의 유일한 훅입니다.

1. **`.geas/`와 `run.json`을 확인합니다.** 없으면 0으로 종료 (허용) — 비-Geas 프로젝트는 영향받지 않습니다.
2. **완료된 작업이 없으면 건너뜁니다** (`completed_tasks`가 비어 있음). 검증할 것이 없습니다.
3. **`completed_tasks`의 모든 작업 ID를 반복**하며 5개의 필수 evidence 파일을 확인합니다:

   | 파일 | 설명 |
   |---|---|
   | `.geas/evidence/<tid>/forge-review.json` | 코드 리뷰 |
   | `.geas/evidence/<tid>/sentinel.json` | QA 테스팅 |
   | `.geas/evidence/<tid>/critic-review.json` | Critic Pre-ship 검토 |
   | `.geas/evidence/<tid>/nova-verdict.json` | Nova 제품 검토 |
   | `.geas/memory/retro/<tid>.json` | Scrum 회고 |

4. **파일이 누락되면** stderr에 출력합니다:
   ```
   [Geas] Pipeline incomplete. MANDATORY evidence missing:
     - TASK-001: sentinel.json (QA Testing) missing
     - TASK-001: memory/retro/TASK-001.json (Scrum Retrospective) missing

   Execute the missing steps before completing the session.
   ```
   그런 다음 **exit 코드 2로 종료**하여 하네스가 세션 종료를 차단하게 합니다.

5. **모든 evidence가 있으면** 0으로 종료하고 세션이 정상적으로 종료되도록 허용합니다.

### Exit 코드

| 코드 | 의미 |
|---|---|
| 0 | 파이프라인 완료 — 세션 종료 허용 |
| 2 | Evidence 누락 — 세션 종료 차단 |

### 조건

- 비-Geas 프로젝트 (`.geas/` 없음)는 절대 차단되지 않습니다.
- 완료된 작업이 없는 세션은 절대 차단되지 않습니다.

---

## 훅 9 — calculate-cost.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/calculate-cost.sh` |
| 차단 여부 | 아니오 (모든 경우 0으로 종료) |
| 시간 제한 | 30초 |

### 동작 내용

세션 종료 시 실행됩니다 (`verify-pipeline.sh` 이후). `~/.claude/projects/`의 하위 에이전트 세션 JSONL 파일을 파싱하여 실제 토큰 사용량과 예상 비용을 계산합니다.

1. **Claude 프로젝트 디렉토리를 찾습니다** — `cwd`를 Claude가 사용하는 프로젝트 해시 형식으로 정규화하여 (예: `A:\geas-test3` → `A--geas-test3`). `~/.claude/projects/` 아래에서 일치하는 디렉토리를 찾습니다.
2. **`subagents/` 하위 디렉토리가 있는 가장 최근에 수정된 세션을 찾습니다.**
3. **해당 디렉토리의 모든 하위 에이전트 JSONL 파일을 파싱합니다.** 각 `assistant` 메시지에 대해 누적합니다:
   - `input_tokens`
   - `output_tokens`
   - `cache_creation_input_tokens`
   - `cache_read_input_tokens`
4. **`.meta.json` 사이드카 파일에서 에이전트 유형을 읽어** 에이전트 역할별 토큰 수를 귀속합니다.
5. **Opus 가격을 상한으로 사용하여 예상 비용을 계산합니다**:
   - 입력: $15 / 1M 토큰
   - 출력: $75 / 1M 토큰
   - 캐시 생성: $3.75 / 1M 토큰
   - 캐시 읽기: $1.50 / 1M 토큰
6. **`.geas/ledger/cost-summary.json`에 전체 분석을 씁니다**:
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
   에이전트는 출력 토큰 내림차순으로 정렬됩니다.
7. **stderr에 요약 줄을 출력합니다**:
   ```
   [Geas] Session cost: $1.23 (8 agents, 12,345 output tokens)
   ```

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뜁니다.
- `~/.claude/projects/` 아래에서 Claude 프로젝트 디렉토리를 찾을 수 없으면 건너뜁니다.
- `subagents/` 디렉토리가 있는 세션을 찾을 수 없으면 건너뜁니다.
- 개별 JSONL 파싱 오류는 조용히 무시됩니다 — 훅은 최선 노력 방식입니다.

---

## 훅 커스터마이징

훅은 `plugin/hooks/hooks.json`에 선언됩니다. 스키마는 다음과 같습니다:

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
| `EventName` | 다음 중 하나: `SessionStart`, `SubagentStart`, `PostToolUse`, `SubagentStop`, `PostCompact`, `Stop` |
| `matcher` | `PostToolUse`용: 파이프로 구분된 도구 이름 정규식 (예: `Write\|Edit`). 빈 문자열은 모두에 일치. |
| `command` | 실행할 셸 명령. `${CLAUDE_PLUGIN_ROOT}`는 플러그인 디렉토리로 해석됩니다. |
| `timeout` | 훅이 종료되기 전 최대 초 수. |

**새 훅 추가 방법:**

1. `plugin/hooks/scripts/`에 스크립트를 작성합니다.
2. 실행 가능하게 만듭니다 (`chmod +x`).
3. 적절한 이벤트 아래 `hooks.json`에 항목을 추가합니다.
4. 스크립트는 stdin으로 훅 페이로드를 JSON으로 받습니다. stdout에 `{"additionalContext": "..."}` 출력으로 컨텍스트를 삽입합니다 (SubagentStart와 PostCompact만 해당).

**Exit 코드 규칙:**

| 코드 | 효과 |
|---|---|
| 0 | 성공, 계속 |
| 1 | 오류 (기록되지만 차단하지 않음) |
| 2 | 파이프라인 차단 (`Stop` 훅에만 의미 있음) |

---

## 훅에서 참조하는 상태 파일

| 경로 | 사용 훅 |
|---|---|
| `.geas/state/run.json` | session-init, restore-context, verify-pipeline, agent-telemetry |
| `.geas/rules.md` | session-init (생성), inject-context (읽기), restore-context (읽기) |
| `.geas/memory/agents/<name>.md` | inject-context |
| `.geas/tasks/<tid>.json` | protect-geas-state, verify-task-status |
| `.geas/evidence/<tid>/forge-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/sentinel.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/critic-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/nova-verdict.json` | verify-task-status, verify-pipeline |
| `.geas/memory/retro/<tid>.json` | verify-task-status, verify-pipeline |
| `.geas/spec/seed.json` | protect-geas-state (고정 보호) |
| `.geas/debt.json` | check-debt |
| `.geas/ledger/costs.jsonl` | agent-telemetry |
| `.geas/ledger/cost-summary.json` | calculate-cost |
