**[English](HOOKS.md)** | **한국어**

# Hook reference

## 개요

Hook은 Claude Code가 특정 라이프cycle event에서 자동으로 실행하는 셸 script입니다. Hook은 Geas 규칙의 **기계적 강제**를 담당합니다. agent가 무시하거나 잘못 해석할 수 있는 프롬프트 지시에 의존하는 대신, hook은 도구 수준에서 작업을 가로채고 실제 종료 코드로 제약 조건을 강제합니다.

Geas hook system은 세 가지 목적을 수행합니다:

1. **상태 연속성** -- 세션이 시작될 때 context를 복원하여 agent가 project의 이전 진행 상황을 이해할 수 있게 합니다.
2. **증거 검증** -- agent가 계약 engine이 요구하는 증거 아티팩트를 실제로 생성했는지 확인합니다.
3. **상태 보호** -- 중요 project 상태 파일에 대한 무단 또는 조기 수정을 방지합니다.

Hook은 프롬프트 기반 규칙을 대체하지 않습니다. 보완합니다: 프롬프트는 agent에게 무엇을 해야 하는지 알려주고, hook은 실제로 그렇게 했는지 검증합니다.


## Hook 설정

모든 hook은 `plugin/hooks/hooks.json`에 선언됩니다. 이 파일은 Claude Code의 hook 사양을 따릅니다:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex pattern or empty string>",
        "hooks": [
          {
            "type": "command",
            "command": "<path to script>",
            "timeout": <seconds>
          }
        ]
      }
    ]
  }
}
```

### field

| field | 설명 |
|------|------|
| `EventName` | hook을 트리거하는 라이프cycle event. `SessionStart`, `SubagentStart`, `SubagentStop`, `PreToolUse`, `PostToolUse`, `PostCompact`, `Stop` 중 하나. |
| `matcher` | hook 실행 조건을 필터링하는 정규식 pattern. `PostToolUse`의 경우 도구 이름에 대해 매칭됩니다. 빈 문자열은 모든 것에 매칭됩니다. |
| `type` | 항상 `"command"` -- hook은 외부 셸 명령입니다. |
| `command` | script 경로. `${CLAUDE_PLUGIN_ROOT}`를 사용하여 plugin directory 기준 상대 경로를 해석합니다. |
| `timeout` | 최대 실행 시간(초). 초과하면 hook이 종료되고 통과(exit 0)로 처리됩니다. |

### 입력

모든 hook은 stdin을 통해 최소한 다음을 포함하는 JSON 객체를 받습니다:

- `cwd` -- 세션의 현재 작업 directory.
- `tool_input` -- (PostToolUse 전용) 방금 호출된 도구에 전달된 입력 매개변수.


## Hook 상세 설명

### 1. session-init.sh

| 속성 | 값 |
|------|-----|
| **Event** | `SessionStart` |
| **Matcher** | _(없음 -- 모든 세션 시작 시 실행)_ |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/session-init.sh` |

#### 동작 설명

세션이 시작되면 이 hook은 작업 directory가 Geas 관리 project(`.geas/` directory 존재)인지 확인하고 이전 세션의 context를 복원합니다.

**단계별 동작:**

1. stdin JSON에서 `cwd`를 파싱합니다.
2. `.geas/` directory가 있는지 확인합니다. 없으면 조용히 종료합니다(Geas project가 아님).
3. `.geas/state/run.json`이 있는지 확인합니다. 없으면 먼저 설정을 실행하라는 알림을 출력합니다.
4. `run.json`을 읽고 stderr에 상태 요약을 출력합니다: mission, phase, status, 완료된 작업 수.
5. checkpoint 파일(`.geas/state/checkpoint.json`)이 있으면 읽어서 상태 요약에 checkpoint 정보를 포함합니다.
6. `.geas/rules.md`가 없으면, 증거 작성 규칙, Linear 설정, 코드 경계 규칙을 포함하는 내장 template에서 생성합니다.

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 절대 차단하지 않습니다. 순수하게 정보 제공 목적이며, context를 주입하고 누락된 설정 파일을 생성합니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공. 세션이 정상적으로 계속됩니다. |

---

### 2. inject-context.sh

| 속성 | 값 |
|------|-----|
| **Event** | `SubagentStart` |
| **Matcher** | _(없음 -- 모든 agent에 대해 실행)_ |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/inject-context.sh` |

#### 동작 설명

subagent가 실행을 시작하기 전에, 이 hook은 project 수준 규칙과 agent별 memory 파일을 읽은 다음, subagent의 system 프롬프트에 주입되는 추가 context로 출력합니다. 이를 통해 모든 subagent가 project의 현재 규칙과 해당 역할에 관련된 축적된 지식을 갖고 시작할 수 있습니다.

**단계별 동작:**

1. stdin JSON에서 `cwd`와 `agent_type`을 파싱합니다.
2. `.geas/` directory가 있는지 확인합니다. 없으면 조용히 종료합니다(Geas project가 아님).
3. `.geas/rules.md`가 있으면 읽습니다. `--- PROJECT RULES ---` 헤더 아래에 context 앞에 추가합니다.
4. agent별 memory 경로를 유도합니다: `.geas/memory/agents/{agent-type}.md`. 파일이 있으면 `--- YOUR MEMORY ---` 헤더 아래에 context에 추가합니다.
5. 수집된 context가 있으면 결합된 텍스트를 담은 `additionalContext` field가 포함된 JSON 객체를 출력합니다.

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 절대 차단하지 않습니다. 파일 읽기나 JSON 출력 중 오류가 발생하면 script는 조용히 실패하고(오류 억제) subagent는 추가 context 없이 시작합니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공. subagent가 주입된 context를 받습니다(파일이 없으면 context 없이 시작). |

#### 출력

stderr 경고를 통해 통신하는 다른 hook과 달리, 이 hook은 구조화된 JSON을 **stdout**에 씁니다:

```json
{
  "additionalContext": "--- PROJECT RULES (.geas/rules.md) ---\n...\n\n--- YOUR MEMORY (.geas/memory/agents/{agent-type}.md) ---\n..."
}
```

Claude Code는 이 JSON을 읽고 `additionalContext` 값을 subagent의 프롬프트에 주입합니다. context 파일이 없으면 hook은 출력을 생성하지 않습니다.

---

### 3. protect-geas-state.sh

| 속성 | 값 |
|------|-----|
| **Event** | `PostToolUse` |
| **Matcher** | `Write\|Edit` |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/protect-geas-state.sh` |

#### 동작 설명

agent가 `Write` 또는 `Edit` 도구를 사용할 때마다 이 hook은 대상 파일 경로를 검사하고 무결성 검사를 적용합니다.

**세 가지 강제 영역:**

1. **timestamp 주입** -- `.geas/**/*.json` 파일이 기록될 때 `created_at` field에 실제 UTC timestamp를 자동 주입합니다. agent가 `date -u`를 직접 호출할 필요 없습니다. 더미 timestamp(`:00:00Z` pattern)도 감지하여 실제 값으로 교체합니다.

2. **`.geas/spec/seed.json` 보호** -- seed 파일은 intake 후 동결됩니다. 수정이 발생하면 seed를 변경해서는 안 된다는 경고가 트리거됩니다.

3. **금지 경로 강제** -- 현재 작업의 `prohibited_paths`에 대해 모든 Write|Edit 작업을 검사합니다. 금지 경로 pattern과 일치하면 경고합니다(차단하지 않음).

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 경고만 하고 절대 차단하지 않습니다. 경고와 프롬프트 수준 규칙의 조합이 대부분의 위반을 방지하기에 충분하다고 신뢰합니다. 향후 version에서는 중요 상태 파일에 대해 차단(exit 2)으로 격상될 수 있습니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공(경고 유무에 관계없이). 작업이 허용됩니다. |

#### 경고 메시지

| 메시지 | 의미 |
|--------|------|
| `seed.json was modified after intake` | 동결된 seed 사양이 변경되었습니다. |
| `File {path} matches prohibited_paths for {task-id}` | 현재 작업의 금지 경로 pattern과 일치하는 파일이 작성되었습니다. |

---

### 4. verify-task-status.sh

| 속성 | 값 |
|------|-----|
| **Event** | `PostToolUse` |
| **Matcher** | `Write\|Edit` |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/verify-task-status.sh` |

#### 동작 설명

agent가 `Write` 또는 `Edit` 도구를 사용하여 `.geas/tasks/*.json` 파일에서 작업의 상태를 `"passed"`로 설정할 때, 이 hook은 5개의 필수 증거 파일이 존재하는지 확인합니다:

- `forge-review.json` (Forge agent의 코드 review)
- `sentinel.json` (Sentinel agent의 QA test)
- `critic-review.json` (Critic agent의 출시 전 review)
- `nova-verdict.json` (Nova agent의 제품 review)
- `memory/retro/{task-id}.json` (Scrum agent의 회고)

하나라도 없으면 hook은 경고를 출력합니다.

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 경고만 하고 절대 차단하지 않습니다. **verify-pipeline**이 나중에 세션 종료 시 강제할 문제에 대한 조기 경고 역할을 합니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공(경고 유무에 관계없이). 작업이 허용됩니다. |

#### 경고 메시지

| 메시지 | 의미 |
|--------|------|
| `{task-id} marked as passed but forge-review.json is missing` | 코드 review 증거 없이 작업이 "passed"로 승격되었습니다. |
| `{task-id} marked as passed but sentinel.json is missing` | QA test 증거 없이 작업이 "passed"로 승격되었습니다. |
| `{task-id} marked as passed but critic-review.json is missing` | Critic 출시 전 review 증거 없이 작업이 "passed"로 승격되었습니다. |
| `{task-id} marked as passed but nova-verdict.json is missing` | Nova 제품 review 증거 없이 작업이 "passed"로 승격되었습니다. |
| `{task-id} marked as passed but retro/{task-id}.json is missing` | Scrum 회고 증거 없이 작업이 "passed"로 승격되었습니다. |

---

### 5. restore-context.sh

| 속성 | 값 |
|------|-----|
| **Event** | `PostCompact` |
| **Matcher** | _(없음 -- 모든 context 압축 후 실행)_ |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/restore-context.sh` |

#### 동작 설명

Claude Code가 대화 context를 압축한 후(context 윈도우에 맞추기 위해), 중요한 Geas 상태가 손실될 수 있습니다. 이 hook은 필수 상태를 재주입하여 오케스트레이터가 현재 실행의 추적을 잃지 않고 계속할 수 있게 합니다.

**단계별 동작:**

1. stdin JSON에서 `cwd`를 파싱합니다.
2. `.geas/` directory가 있는지 확인합니다. 없으면 조용히 종료합니다.
3. `.geas/state/run.json`과 `.geas/rules.md`를 읽습니다.
4. 현재 실행 상태와 규칙을 `additionalContext` JSON으로 출력합니다.

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 절대 차단하지 않습니다. 순수하게 정보 제공 목적이며, 압축 후 context를 재주입합니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공. 복원된 context로 세션이 계속됩니다. |

---

### 6. track-cost.sh

| 속성 | 값 |
|------|-----|
| **Event** | `SubagentStop` |
| **Matcher** | _(없음 -- 모든 subagent 완료 후 실행)_ |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/track-cost.sh` |

#### 동작 설명

subagent가 완료된 후, 이 hook은 agent 이름, 작업 ID, 사용된 model을 `.geas/ledger/costs.jsonl`에 기록합니다. 이 데이터는 `run-summary` skill이 실행 종료 시 비용 보고서 section을 생성하는 데 사용됩니다.

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 절대 차단하지 않습니다. 순수한 로깅 hook입니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공. 비용 항목이 기록되었습니다. |

---

### 7. verify-pipeline.sh

| 속성 | 값 |
|------|-----|
| **Event** | `Stop` |
| **Matcher** | _(없음 -- 모든 세션 종료 시 실행)_ |
| **Timeout** | 30초 |
| **Script** | `plugin/hooks/scripts/verify-pipeline.sh` |

#### 동작 설명

세션이 종료되기 전에, 이 hook은 완료된 모든 작업에 필수 증거 파일이 있는지 확인합니다. 이것은 **차단할 수 있는 유일한 hook**으로, 불완전한 검증 상태에서 세션이 종료되는 것을 방지합니다.

**단계별 동작:**

1. stdin JSON에서 `cwd`를 파싱합니다.
2. `.geas/`와 `run.json`이 있는지 확인합니다. 없으면 건너뜁니다.
3. `run.json`에서 `status`를 읽습니다. 이미 `"complete"`이면 건너뜁니다(재확인 불필요).
4. `run.json`에서 `phase`를 읽습니다. `mvp`, `polish`, `evolve` 단계에서만 강제합니다. `genesis` 단계에서는 증거 요구 사항이 아직 강제되지 않습니다.
5. `completed_tasks` 배열을 순회합니다. 각 작업에 대해 다음 5개 증거 파일을 확인합니다:
   - `.geas/evidence/{task-id}/forge-review.json`
   - `.geas/evidence/{task-id}/sentinel.json`
   - `.geas/evidence/{task-id}/critic-review.json`
   - `.geas/evidence/{task-id}/nova-verdict.json`
   - `.geas/memory/retro/{task-id}.json`
6. 증거가 누락되면 목록을 출력하고 **세션 종료를 차단합니다**.

#### 종료 동작

- 모든 증거가 존재하거나 검사가 해당되지 않는 경우(Geas project가 아님, 이미 완료됨, genesis 단계) **exit 0으로 종료합니다**.
- 필수 증거가 누락되면 **exit 2로 종료합니다**. 세션 종료가 차단되며, agent는 누락된 검증 단계를 먼저 완료해야 합니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | pipeline이 완료되었습니다. 세션이 종료될 수 있습니다. |
| `2` | **차단.** 필수 증거가 누락되었습니다. 세션 종료가 방지됩니다. |


### 8. check-debt.sh

| 속성 | 값 |
|------|-----|
| **Event** | `PostToolUse` |
| **Matcher** | `Write\|Edit` |
| **Timeout** | 10초 |
| **Script** | `plugin/hooks/scripts/check-debt.sh` |

#### 동작 설명

agent가 `Write` 또는 `Edit` 도구를 사용하여 `.geas/debt.json`에 기록할 때마다, 이 hook은 파일을 읽고 `severity: "HIGH"`인 항목 수를 셉니다. 3개 이상이면 stderr에 경고를 출력하여 팀에 tech debt 백로그에 주의가 필요함을 알립니다.

**단계별 동작:**

1. stdin JSON에서 `cwd`와 `tool_input`을 파싱합니다.
2. 기록된 파일이 `.geas/debt.json`인지 확인합니다. 아니면 조용히 종료합니다.
3. `.geas/debt.json`을 읽고 `severity`가 `"HIGH"`인 항목을 셉니다.
4. 3개 이상이면 stderr에 경고를 출력합니다: `[Geas] Warning: {count} HIGH-severity tech debt items open. Review .geas/debt.json.`

#### 종료 동작

- **항상 exit 0으로 종료합니다.** 이 hook은 경고만 하고 절대 차단하지 않습니다. debt 해결 우선순위를 높이라는 권고 신호입니다.

#### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공(경고 유무에 관계없이). 작업이 허용됩니다. |

#### 경고 메시지

| 메시지 | 의미 |
|--------|------|
| `{count} HIGH-severity tech debt items open. Review .geas/debt.json.` | 3개 이상의 HIGH severity debt 항목이 축적되고 있습니다. 팀이 해결을 우선시해야 합니다. |

---


## 라이프cycle 다이어그램

다음 다이어그램은 일반적인 Geas 세션에서 각 hook이 언제 실행되는지 보여줍니다:

```
Session Start
    |
    v
[SessionStart] ---> session-init.sh
    |                  - run.json 상태 + checkpoint 복원
    |                  - rules.md가 없으면 생성
    |                  - 상태 요약 출력
    v
Agent Work Loop
    |
    |--- agent가 Write/Edit 도구 사용
    |       |
    |       v
    |   [PostToolUse] ---> protect-geas-state.sh
    |       |                - .geas/**/*.json에 timestamp 주입
    |       |                - .geas/spec/seed.json 수정 확인
    |       |                - prohibited_paths 확인
    |       |                - (경고만, 차단하지 않음)
    |       |
    |       +-------------> verify-task-status.sh
    |       |                - task passed 시 5개 증거 파일 확인
    |       |                - (경고만, 차단하지 않음)
    |       |
    |       +-------------> check-debt.sh
    |       |                - .geas/debt.json 기록 시 HIGH 항목 수 확인
    |       |                - HIGH >= 3이면 경고
    |       |                - (경고만, 차단하지 않음)
    |       v
    |   도구 작업 진행
    |
    |--- context 압축
    |       |
    |       v
    |   [PostCompact] ---> restore-context.sh
    |       |                - 실행 상태와 규칙 재주입
    |       v
    |   복원된 context로 세션 계속
    |
    |--- subagent 디스패치
    |       |
    |       v
    |   [SubagentStart] ---> inject-context.sh
    |       |                  - .geas/rules.md 읽기
    |       |                  - .geas/memory/agents/{agent-type}.md 읽기
    |       |                  - additionalContext JSON 출력
    |       v
    |   subagent가 주입된 context로 실행
    |       |
    |       v
    |   subagent 완료
    |       |
    |       v
    |   [SubagentStop] ---> track-cost.sh
    |       |                 - agent/task/model을 costs.jsonl에 기록
    |       |                 - (차단하지 않음)
    |       v
    |   메인 agent가 결정: 재시도 또는 계속
    |
    v
Session End Requested
    |
    v
[Stop] ---> verify-pipeline.sh
    |          - 모든 completed_tasks의 증거 확인
    |          - mvp/polish/evolve 단계에서만
    |          - 증거 누락 시 차단 (exit 2)
    |
    |--- exit 0 ---> 세션 종료
    |--- exit 2 ---> 세션 차단, agent가 수정해야 함
```

### 주요 상호작용

- **session-init**은 상태와 checkpoint 정보를 복원하여 무대를 설정합니다. 이것이 없으면 agent는 이전 작업에 대한 context 없이 시작합니다.
- **inject-context**는 모든 subagent가 project 규칙과 자체 축적된 memory를 상속받도록 합니다. 이것이 없으면 subagent는 project별 제약 조건이나 이전 실행에서 얻은 교훈에 대한 지식 없이 시작합니다.
- **protect-geas-state**는 timestamp 주입, seed 보호, 금지 경로 경계를 agent가 파일을 쓸 때 실시간으로 강제합니다.
- **verify-task-status**는 조기 task 완료를 포착합니다 -- 5개의 필수 증거 파일 없이 task가 "passed"로 표시될 때. **verify-pipeline**이 나중에 강제할 문제에 대한 조기 경고 역할을 합니다.
- **restore-context**는 context 압축 후 중요 상태를 재주입하여 오케스트레이터가 현재 실행의 추적을 잃지 않도록 합니다.
- **track-cost**는 subagent 완료 후 agent, task, model 정보를 기록합니다. 이 데이터는 run-summary 비용 보고서에 사용됩니다.
- **check-debt**는 `.geas/debt.json` 기록을 모니터링하고 3개 이상의 HIGH severity tech debt 항목이 열려 있으면 경고합니다. 이를 통해 팀이 debt가 관리 불가능해지기 전에 인식할 수 있습니다.
- **verify-pipeline**은 최종 관문입니다. 이전 경고가 무시되었더라도 이 hook은 불완전한 증거로 세션이 닫히는 것을 방지합니다. "선언보다 증거(Evidence over declaration)" 원칙의 기계적 강제입니다.


## 의존성

### Python (필수)

모든 hook은 JSON 파싱에 `jq` 대신 Python을 사용합니다. 이는 의도적인 선택입니다:

- Python은 거의 모든 개발 머신에서 사용 가능합니다.
- `jq`는 macOS나 Windows에 기본 설치되어 있지 않으며 별도 설치가 필요합니다.
- Python 호출은 표준 library(`json`, `sys`, `os`, `glob`)만 사용합니다 -- 서드파티 패키지가 필요하지 않습니다.

Python은 bash script 내에서 `python -c "..."` 블록을 사용하여 인라인으로 호출됩니다. script는 `python`이 PATH에 있을 것으로 예상합니다. system에서 `python3`만 사용하는 경우 `python`을 alias하거나 symlink하세요.

### Bash

모든 hook은 bash script이며 bash 호환 셸이 필요합니다. Windows에서는 Git Bash 또는 WSL을 통해 제공됩니다.

### 파일 system

Hook은 `.geas/` directory 하위의 파일을 읽고 확인합니다:

| 경로 | 용도 |
|------|------|
| `.geas/state/run.json` | 현재 실행 상태 (mission, phase, status, 작업 목록) |
| `.geas/rules.md` | agent 규칙 template (session-init이 없으면 생성, inject-context가 주입) |
| `.geas/memory/agents/{agent-type}.md` | agent별 축적 memory (inject-context가 주입) |
| `.geas/tasks/*.json` | TaskContract 파일 (protect-geas-state가 모니터링) |
| `.geas/spec/seed.json` | 동결된 project 사양 (protect-geas-state가 모니터링) |
| `.geas/evidence/{task-id}/*.json` | 증거 파일 (verify-task-status와 verify-pipeline이 확인) |
| `.geas/ledger/costs.jsonl` | 비용 추적 로그 (track-cost가 기록, run-summary가 읽음) |
| `.geas/debt.json` | Tech debt 추적기 (Compass가 agent 증거에서 수집하여 기록, check-debt가 모니터링) |


## 문제 해결

### Hook이 실행되지 않음

**증상:** 출력에 `[Geas]` 메시지가 나타나지 않습니다.

**가능한 원인:**
- 작업 directory에 `.geas/` directory가 없습니다. Hook은 Geas project가 아닌 경우 조용히 건너뜁니다.
- `hooks.json`이 로드되지 않았습니다. plugin이 Claude Code에 올바르게 등록되었는지 확인하세요.
- `${CLAUDE_PLUGIN_ROOT}` 변수가 설정되지 않았습니다. 이 변수는 Claude Code가 plugin을 로드할 때 자동으로 설정됩니다.

### "python: command not found"

**증상:** Hook이 조용히 실패하거나 python을 찾을 수 없다는 셸 오류를 출력합니다.

**해결:** `python`이 PATH에 있는지 확인하세요. `python3`만 사용 가능한 system에서는:
```bash
# 방법 1: alias (~/.bashrc 또는 ~/.zshrc에 추가)
alias python=python3

# 방법 2: symlink
sudo ln -s $(which python3) /usr/local/bin/python
```

### Hook 타임아웃

**증상:** Hook이 멈춘 것처럼 보이다가 출력 없이 세션이 계속됩니다.

**원인:** Hook에는 타임아웃(10초 또는 30초)이 있습니다. Python이나 파일 I/O가 느린 경우(예: 네트워크 마운트된 `.geas/` directory) hook이 완료되기 전에 종료될 수 있습니다.

**해결:** `.geas/`를 로컬 storage로 이동하세요. Hook 타임아웃은 `hooks.json`에서 설정되며 필요 시 늘릴 수 있습니다.

### "Pipeline incomplete"로 세션 종료 차단

**증상:** `Pipeline incomplete. MANDATORY evidence missing` 메시지와 함께 세션이 종료되지 않습니다.

**원인:** `verify-pipeline.sh`가 필요한 5개 증거 파일(`forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`, `memory/retro/{task-id}.json`) 중 하나 이상 없이 완료된 작업을 발견했습니다.

**해결:** 이것은 설계된 대로 동작하는 것입니다. 누락된 검증 단계를 완료하세요:
1. 오류 메시지에 나열된 작업을 확인합니다.
2. 해당 작업에 대해 누락된 단계를 실행합니다: 코드 review(Forge), QA test(Sentinel), 출시 전 review(Critic), 제품 review(Nova), 회고(Scrum).
3. `.geas/evidence/{task-id}/`와 `.geas/memory/retro/`에 증거 파일이 작성되었는지 확인합니다.
4. 세션 종료를 다시 시도합니다.

### seed.json 수정 경고

**증상:** `[Geas] Warning: seed.json was modified after intake.`

**원인:** intake 단계 이후 agent가 `.geas/spec/seed.json`을 편집했습니다. seed는 요구사항 수집이 완료되면 동결되어야 합니다.

**해결:** 수정이 의도적인 경우(예: 개발 중 발견된 실수 수정) 경고를 인정할 수 있습니다. 실수인 경우 git history에서 원본 seed를 복원하세요:
```bash
git checkout HEAD -- .geas/spec/seed.json
```

### 증거 없이 작업이 "passed"로 표시됨

**증상:** `[Geas] Warning: {task-id} marked as passed but forge-review.json is missing`

**원인:** agent가 코드 review 또는 QA 증거 없이 TaskContract의 상태를 `"passed"`로 설정했습니다. 이는 Evidence Gate를 우회하는 것입니다.

**해결:** 작업 상태를 수동으로 `"passed"`로 설정하지 마세요. 검증이 완료된 후 Evidence Gate skill이 상태 전환을 처리하도록 하세요. 상태가 조기에 설정된 경우 되돌리고 누락된 검증 단계를 실행하세요.
