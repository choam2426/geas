# Geas CLI 설계

이 문서는 Geas CLI(`geas`)의 아키텍처를 기술한다. 상위 구조와 다른 계층과의 관계는 `DESIGN.md`에 있다. 이 문서는 CLI 단독으로 보장해야 하는 내부 계약과 동작을 정의한다.

## 1. 목적과 범위

CLI는 `.geas/` 아래 모든 쓰기가 통과해야 하는 단일 actuator다. 주 소비자는 skill과 agent가 부리는 쉘 호출이다. 따라서 이 CLI는 사람 친화형 인터랙션보다 머신 소비 가능성과 결정성을 우선하며, UX 배려(색상, 진행 표시, 대화형 프롬프트, `--quiet`·`--verbose` 같은 편의 옵션)는 전부 제거된다.

CLI가 책임지는 일은 여섯이다.

1. JSON payload를 schema로 검증하고 실패 시 구조화된 hint를 반환한다.
2. 상태 전이가 요구하는 선행 artifact를 읽어 guard를 평가한다.
3. 타임스탬프와 식별자를 자동 주입한다.
4. Append-only 로그의 불변성을 강제한다.
5. 쓰기를 temp → fsync → rename으로 원자화한다.
6. `.geas/` 경로를 고정한다 (사용자가 경로를 바꿀 수 없다).

이 여섯 외의 모든 것(HTTP API, UI, 자동 보고서, 통계 요약 등)은 CLI의 책임이 아니다.

## 2. 설계 전제

- **Machine-first interface.** 출력은 사람이 읽기 좋은 서식 대신 머신 소비용 JSON으로 고정한다. 사람도 직접 호출할 수 있지만, 호환성의 기준은 언제나 구조화된 응답 계약이다.
- **경로 고정.** `.geas/`는 항상 `geas setup`이 초기화한 프로젝트 루트 기준 상대 경로다. CLI는 현재 디렉토리부터 상위로 walk up 하며 setup이 만든 `.geas/config.json`을 찾고, 그 config가 가리키는 canonical 또는 delegate root만 유효한 프로젝트 루트로 인정한다. `--cwd`·`--dir` 같은 경로 옵션은 제공하지 않는다.
- **옵션 최소.** 각 명령은 해당 작업에 필수적인 인자만 받는다. 편의 옵션 금지.
- **상태 저장 없음.** CLI는 자체 상태를 저장하지 않는다. 매 호출이 독립적이고 재현 가능하다.
- **멱등성 원칙.** 같은 입력으로 같은 `.geas/` 상태에 반복 호출하면 결과가 동일하다 (append 명령은 동일 entry가 이미 마지막에 있으면 no-op 반환).
- **Skill/agent discipline.** CLI는 agent의 선의를 검증하지 않는다. 잘못된 JSON은 schema가 걸러내지만, "이 전이가 정당한가"의 의미적 판단은 skill과 agent의 책임이다. CLI는 형식과 전이 선행 조건만 본다.
- **Skill이 payload shape의 primary guide.** 각 skill 본문이 그 skill이 만드는 payload의 구조(agent가 채울 필드 조각 + placeholder + enum 허용값)를 담는다. `geas schema template`은 skill이 shape을 제공하지 않거나 agent가 확신이 없을 때 쓰는 **fallback**이다. 이렇게 매 호출마다 template 조회를 안 해도 되게 설계해 런타임 컨텍스트 비용을 줄인다.

## 3. 명령 체계

명령은 두 축으로 정돈된다. **Artifact** 축은 어떤 파일을 다루는가, **연산** 축은 어떻게 다루는가.

### 연산 분류

| 연산 | 의미 | 대상 |
|---|---|---|
| `create` | 처음 만드는 최상위 artifact | spec, mission-design, contract |
| `set` | 최상위 artifact를 통째로 갱신 | implementation-contract, self-check, gap, memory-update |
| `update` | 최상위 artifact의 일부 필드 갱신 | mission-state, task-state, task contract의 approved_by·status |
| `append` | 배열 append-only 로그에 entry 추가 | phase-reviews, mission-verdicts, gate-results, deliberations, evidence |
| `register` | 식별자 있는 entry를 새로 추가 | debts |
| `run` | 실행 + 결과 append (복합) | gate (tier 실행 결과를 runs에 append) |
| `read` | 파일 읽기 또는 요약 출력 | schema template, resume |
| `scaffold` | 구현체 보조 파일 생성 (프로토콜 artifact 아님 — validate 대상 아님) | consolidation candidates |

### Mission-level 명령

| 명령 | 연산 | 대상 artifact |
|---|---|---|
| `geas mission create` | create | `missions/{id}/spec.json` + mission 디렉토리 scaffold (§14.1) |
| `geas mission design-set` | set | `missions/{id}/mission-design.md` |
| `geas mission-state update` | update | `missions/{id}/mission-state.json`. `--phase` 전이는 §14.2 참조 |
| `geas phase-review append` | append | `missions/{id}/phase-reviews.json` |
| `geas mission-verdict append` | append | `missions/{id}/mission-verdicts.json` |
| `geas deliberation append --level mission` | append | `missions/{id}/deliberations.json` |
| `geas debt register` | register | `missions/{id}/consolidation/debts.json` |
| `geas debt update-status` | update | `missions/{id}/consolidation/debts.json` |
| `geas gap set` | set | `missions/{id}/consolidation/gap.json` |
| `geas memory-update set` | set | `missions/{id}/consolidation/memory-update.json` |
| `geas consolidation scaffold` | scaffold | 모든 task evidence의 candidates 수집해 `consolidation/candidates.json` 생성 (§14.4) |

### Task-level 명령

| 명령 | 연산 | 대상 artifact |
|---|---|---|
| `geas task draft` | create | `tasks/{id}/contract.json` + task 디렉토리 scaffold (§14.1) |
| `geas task approve` | update | `contract.approved_by` |
| `geas task transition` | update | `task-state.json` (lifecycle 전이) |
| `geas task-state update` | update | `task-state.json` (active_agent, iterations) |
| `geas impl-contract set` | set | `tasks/{id}/implementation-contract.json` |
| `geas self-check set` | set | `tasks/{id}/self-check.json` |
| `geas evidence append` | append | `tasks/{id}/evidence/{agent}.json` |
| `geas gate run` | run | `tasks/{id}/gate-results.json`. 응답에 `suggested_next_transition` 힌트 포함 (§14.5) |
| `geas deliberation append --level task` | append | `tasks/{id}/deliberations.json` |

### Memory 명령

| 명령 | 연산 | 대상 artifact |
|---|---|---|
| `geas memory shared-edit` | — | `.geas/memory/shared.md` (editor 대체 CLI) |
| `geas memory agent-note --agent <type>` | — | `.geas/memory/agents/{type}.md` |

### Utility 명령

| 명령 | 동작 |
|---|---|
| `geas schema list` | 사용 가능한 schema 목록 JSON 반환 |
| `geas schema template <type>` | 해당 schema의 필수 필드 골격 JSON 반환 |
| `geas status` | 활성 mission의 phase, active_tasks 각각의 상태, pending 작업을 structured JSON으로 반환 (§14.6) |
| `geas resume` | 현재 mission/task 상태를 agent가 소비할 context JSON으로 반환 (session bootstrap용) |
| `geas validate` | `.geas/` 전체를 schema로 검증한 결과 JSON 반환 |
| `geas setup` | 프로젝트에 `.geas/` 초기화 (canonical config + root_id 생성) |
| `geas setup --link-to <path>` | 이 디렉토리의 `.geas/`를 다른 canonical 저장소로 위임 (워크트리 연결, §13 참조) |
| `geas event log --kind <k> --payload <json>` | `events.jsonl`에 append |

## 4. 입력 규약

### JSON payload 전달

JSON payload는 **stdin으로만** 받는다. 플래그 없음.

**권장 패턴 — quoted heredoc**:

```bash
geas evidence append --task task-001 --agent software-engineer <<'EOF'
{
  "evidence_kind": "implementation",
  "summary": "$HOME 경로와 `backtick`이 있어도 안전"
}
EOF
```

`<<'EOF'`의 quoted delimiter(`'EOF'`)가 shell 변수 확장과 backtick 평가를 전부 차단한다. JSON 원문이 CLI에 그대로 전달된다. **`<<EOF`(unquoted)는 금지** — shell이 `$`·backtick을 치환해 JSON을 오염시킨다.

대체 경로:

```bash
# 파일 경유
cat payload.json | geas mission create

# 짧은 payload + 내용에 single-quote 없으면 echo 가능
echo '{"name": "Mission X"}' | geas mission create
```

CLI는 stdin이 TTY가 아니면 UTF-8 JSON으로 해석한다. Payload가 필요한 명령인데 stdin이 비어 있거나 TTY면 입력 누락으로 실패한다 (`invalid_argument`, 종료 코드 1). JSON 파싱 실패도 같음.

### 식별자 인자

위치 인자가 아닌 명시적 플래그만 쓴다.

- `--mission <mission_id>` — mission 식별자 (생략 시 현재 활성 mission을 mission-state에서 유추; 활성이 없으면 실패).
- `--task <task_id>` — task 식별자 (task-level 명령에서 필수).
- `--agent <agent>` — evidence append에서 필수. evidence file의 `agent` 필드이자 경로 `evidence/{agent}.json`을 결정하는 식별자다. Authority agent는 slot 이름을, specialist는 concrete agent type 이름을 쓴다.
- `--level mission|task` — deliberation append에서 필수.

### 인자 규칙

- 모든 옵션은 long form(`--foo`). short form은 쓰지 않는다.
- Boolean flag는 `--flag` 존재 여부로만 결정되며 `--flag=true|false` 같은 값 부여 구문을 받지 않는다.
- 인자 유효성은 CLI가 1차로 본다 (ID 패턴, enum 값, 파일 존재). 2차로 schema가 payload를 본다.

## 5. 출력 규약

### 성공 응답

모든 성공 응답은 다음 형식의 JSON 한 객체다.

```json
{
  "ok": true,
  "path": ".geas/missions/mission-20260419-abcd1234/spec.json",
  "ids": {
    "mission_id": "mission-20260419-abcd1234"
  },
  "written": {
    "bytes": 4213,
    "fields_injected": ["created_at", "updated_at"]
  }
}
```

필드:
- `ok: true` — 고정.
- `path` — 이번 호출이 건드린 주 파일 경로.
- `ids` — 이번 호출이 생성·확정한 식별자 묶음.
- `written` — 부차 정보 (CLI가 주입한 필드 목록 등). agent가 쓰기 내용을 재확인할 때 참고.

Append 명령은 `ids`에 `entry_id` 또는 `gate_run_id` 같은 새 id를 담는다.

### 실패 응답

```json
{
  "ok": false,
  "error": {
    "code": "schema_validation_failed",
    "message": "mission-spec.schema.json: required field 'name' missing",
    "hints": {
      "missing_required": ["name"],
      "invalid_enum": [],
      "wrong_pattern": [],
      "additional_not_allowed": []
    }
  }
}
```

에러 코드는 고정된 enum이다:

| code | 의미 |
|---|---|
| `schema_validation_failed` | payload JSON이 schema를 통과하지 못함 |
| `guard_failed` | 전이 guard 등 선행 조건 불충족 |
| `append_only_violation` | append-only 로그를 append 외 방식으로 변경 시도 |
| `path_collision` | create 대상 **주 artifact**가 이미 존재 (§14.1의 보조 디렉토리·빈 wrapper는 해당 없음 — 조용한 no-op) |
| `missing_artifact` | 참조한 artifact가 존재하지 않음 |
| `invalid_argument` | CLI 인자 자체가 형식에 맞지 않음 |
| `io_error` | 파일 시스템 오류 |
| `internal_error` | 그 외 — 버그로 간주 |

### 종료 코드

| 코드 | 의미 |
|---|---|
| 0 | 성공 |
| 1 | 일반 오류 (invalid argument, internal error) |
| 2 | schema 검증 실패 |
| 3 | guard 실패 |
| 4 | I/O 오류 |
| 5 | append-only 위반 |

Skill·agent는 주로 JSON의 `ok` 필드로 판단하고, 종료 코드는 쉘 수준 실패 감지용으로만 쓴다.

## 6. 쓰기 파이프라인

모든 쓰기 명령은 다음 6단계를 순서대로 통과한다. 하나라도 실패하면 이후 단계는 실행되지 않고 `.geas/`는 건드리지 않는다.

```
1. parse            stdin에서 JSON payload 로드
2. schema validate  해당 artifact schema로 ajv 검증
3. guard check      필요한 경우 선행 artifact 읽어 조건 평가
4. inject           timestamp · id · entry_id 자동 주입
5. append-only check (해당 명령만) 기존 파일 읽어 array 불변성 확인
6. atomic write     temp → fsync → rename
```

### 6.1 Parse

stdin에서 payload를 로드한다. stdin이 TTY거나 비어 있는데 payload가 필요한 명령이면 `invalid_argument` (종료 코드 1). JSON 파싱 실패도 같음.

### 6.2 Schema validate

Artifact 별로 연결된 JSON Schema로 ajv 검증. 실패 시 6.7의 hints를 생성해 반환.

### 6.3 Guard check

해당 명령이 전이나 참조 무결성을 요구할 때 선행 artifact를 읽어 조건을 본다. 예:
- `task transition --to ready`: `contract.approved_by != null` + phase gate pass 확인
- `task transition --to implementing`: 모든 dependency task가 `passed` 상태인지 확인
- `task transition --to verified`: `gate-results.runs` 마지막 run verdict가 `pass`인지 확인
- `task transition --to passed`: 해당 task에 orchestrator closure entry가 verdict=approved로 존재하는지 확인

Guard 실패 시 `guard_failed` 반환.

### 6.4 Inject

CLI가 자동으로 채워야 하는 값:
- 최상위 `created_at` (create 연산에서만)
- 최상위 `updated_at` (모든 쓰기 연산)
- 각 append entry의 `created_at`
- `entry_id` (evidence·deliberation entries 연번), `gate_run_id` (gate-results 연번)
- 최초 생성에서 `mission_id`·`task_id` 검증 및 경로에 반영

Agent가 이 필드를 payload에 넣어 보내도 CLI가 덮어쓴다. 이것이 타임스탬프·id의 단일 진실원을 유지하는 유일한 방법이다.

### 6.5 Append-only check

§9에서 상세. 대상 명령에서만 수행한다.

### 6.6 Atomic write

```
① temp_path = .geas/.tmp/{target-basename}.{pid}.{rand}
② fd = open(temp_path, O_WRONLY | O_CREAT | O_EXCL, 0600)
③ write(fd, content)
④ fsync(fd)
⑤ close(fd)
⑥ rename(temp_path, target_path)
```

Temp 디렉토리(`.geas/.tmp/`)는 루트 감지 시 없으면 생성된다. rename은 같은 볼륨 내 POSIX `rename(2)` 또는 Windows `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`로 atomic. crash 시 최악의 경우 temp 파일만 남고 target은 이전 상태 그대로.

### 6.7 Hints

Schema 검증 실패 시 CLI는 ajv 에러 목록을 해석해 agent가 바로 고칠 수 있는 구조로 반환한다.

```json
{
  "missing_required": ["name", "acceptance_criteria"],
  "invalid_enum": [
    {"path": "/mode", "allowed": ["lightweight", "standard", "full_depth"], "got": "quick"}
  ],
  "wrong_pattern": [
    {"path": "/id", "pattern": "^mission-[0-9]{8}-[a-zA-Z0-9]{8}$", "got": "mission-1"}
  ],
  "additional_not_allowed": ["extra_field"]
}
```

각 배열은 비어도 키는 항상 존재 (agent가 missing key 분기 안 하도록).

## 7. Schema 검증

### Schema 로딩

CLI 번들은 `docs/schemas/` 14개 schema를 전부 내장한다. 런타임 파일 접근이 아닌 embed. 버전 drift를 막기 위해 build 단계에서 검증되어 CLI 바이너리 안에 들어간다.

### 검증 타이밍

- Artifact 파일 쓰기 직전 (§6.2).
- `geas validate` 명령은 `.geas/` 전체를 돌며 각 파일을 대응 schema로 재검증.
- `schema template`은 해당 schema의 `required` 필드만 기본값으로 채운 골격 반환 (§12).

### 검증 엄격성

- `additionalProperties: false`가 모든 최상위 object에 적용되어 있으므로 agent가 모르는 필드를 붙이면 바로 거부.
- `allOf` / `if-then` 조건부 required(예: evidence_kind에 따른 kind별 required)는 ajv가 자동 적용.
- Pattern 매칭도 엄격 — `mission_id`, `task_id`, `debt_id`, `gate_run_id` 전부 검증.

## 8. Transition Guard

Transition guard는 "이 전이가 형식적으로 가능한가"만 본다. "이 전이가 지금 해야 하는가"의 판단은 skill·agent 책임.

### 전이별 선행 조건

Task lifecycle (doc 03 전이표)과 일치한다. CLI가 각 전이에서 읽고 확인하는 artifact:

| 전이 | 읽는 artifact | 검증 조건 |
|---|---|---|
| `drafted → ready` | `contract.json` | `approved_by != null` |
| `ready → implementing` | 각 `dependencies`의 `task-state.json` | 모두 `status == passed` |
| `implementing → reviewed` | `self-check.json` + `evidence/{reviewer}.json` | self-check 존재 + required reviewer 각각 최소 1 entry |
| `reviewed → verified` | `gate-results.runs` | 마지막 run verdict = `pass` |
| `verified → passed` | `evidence/orchestrator.json` | 마지막 entry가 evidence_kind=closure + verdict=approved |
| `* → blocked` | — | 항상 허용 (이유는 closure·state에 기록) |
| `blocked → ready/implementing/reviewed` | — | 항상 허용 (Orchestrator 판단) |
| `* → escalated` | — | 항상 허용 |
| `escalated → passed` | `evidence/orchestrator.json` | 마지막 closure entry verdict=approved |
| `escalated → ready/implementing/reviewed` | `evidence/orchestrator.json` | 마지막 closure entry verdict=changes_requested |
| `* → cancelled` | — | 항상 허용 |

Phase 전이(`mission-state update --phase`)에도 같은 원리: `phase-reviews.reviews`의 마지막 entry가 `status=passed`이고 `next_phase`가 목표와 일치해야 한다.

### Guard 알고리즘

```
1. 현재 task-state/mission-state의 현재 상태 읽기
2. (current, target) 쌍이 전이 표에 있는지 확인 (없으면 guard_failed)
3. 대응 선행 조건의 artifact 읽기
4. 조건 평가
5. 통과 시 §6의 나머지 단계 진행, 실패 시 guard_failed + hints 반환
```

Guard 실패 hints는 "무엇이 빠졌는가"를 구조화한다.

```json
{
  "reason": "closure_verdict_not_approved",
  "expected": { "evidence_kind": "closure", "verdict": "approved" },
  "got": { "evidence_kind": "closure", "verdict": "changes_requested" },
  "artifact": ".geas/missions/{mid}/tasks/{tid}/evidence/orchestrator.json"
}
```

## 9. Append-only 강제

### 적용 대상

- `phase-reviews.reviews`
- `mission-verdicts.verdicts`
- `gate-results.runs`
- `deliberations.entries`
- `evidence.entries`

### 입력 shape

Append 명령의 stdin payload는 **단일 entry object**다. 전체 wrapper(`{entries: [...]}` 또는 파일 최상위)를 보내지 않는다. 호출자는 entry 안쪽 필드만 채우고, CLI가 파일 로드·배열 append·timestamp 주입·파일 쓰기를 담당한다.

```bash
geas evidence append --task task-001 --agent software-engineer <<'EOF'
{
  "evidence_kind": "implementation",
  "summary": "...",
  "artifacts": [...]
}
EOF
```

### 검증 알고리즘

Append 명령이 호출되면:

```
1. 기존 파일 로드 (없으면 빈 wrapper 초기화 — 최상위 메타 필드 + entries=[])
2. stdin payload를 entry schema로 검증
3. 새 entry에 CLI 주입 필드 추가 (entry_id = max(existing) + 1, created_at = 현재 UTC)
4. 기존 entries 배열에 새 entry append
5. 파일 최상위 updated_at 갱신
6. atomic write (temp → fsync → rename)
```

호출자가 보낸 payload에 `entry_id`, `created_at` 같은 CLI 주입 필드가 들어 있으면 CLI가 무시하고 자체 값으로 덮어쓴다 — id 충돌과 위조 방지.

한 번에 여러 entry 추가는 불가능하다 (입력 shape 자체가 단일 entry). 배치가 필요하면 호출자가 반복 호출해야 하며, 이 경우 각 호출의 `created_at`이 실제 CLI 호출 순서와 일치한다.

### 예외

`debts.entries`는 append-only가 아니다. `debt register`는 새 entry를 추가하지만 `debt update-status`는 기존 entry의 `status`·`resolved_by`·`resolution_rationale`을 갱신한다. debts는 "미션별 부채 상태"를 반영하는 mutable 리스트이므로 다른 append-only 로그와 성격이 다르다. CLI는 `debts` 쓰기에서 이 두 명령 외의 변경을 거부한다 (다른 필드 mutation 금지).

## 10. ID 생성

CLI가 자동 생성하는 id 목록:

| id | 패턴 | 생성 규칙 |
|---|---|---|
| `mission_id` | `^mission-[0-9]{8}-[a-zA-Z0-9]{8}$` | `mission create`가 날짜(YYYYMMDD, 프로젝트 로컬 TZ) + 8자 난수(base62)로 생성 |
| `task_id` | `^task-[0-9]{3}$` | `task draft`가 현재 mission의 `tasks/` 디렉토리에서 max(번호) + 1로 생성 |
| `debt_id` | `^debt-[0-9]{3}$` | `debt register`가 현재 mission의 debts.entries에서 max(번호) + 1로 생성 |
| `gate_run_id` | `^gate-[0-9]+$` | `gate run`이 해당 task의 gate-results.runs에서 max(번호) + 1로 생성 |
| `entry_id` (evidence) | integer ≥ 1 | `evidence append`가 해당 agent의 entries에서 max + 1로 생성 |
| `entry_id` (deliberation) | integer ≥ 1 | `deliberation append`가 해당 deliberations.entries에서 max + 1로 생성 |

Agent가 payload에 id를 포함해도 CLI가 무시하고 자체 생성 값을 넣는다. 이것이 id 충돌과 위조를 원천 차단한다.

## 11. Timestamp 주입

CLI는 RFC 3339 / ISO 8601 `date-time` 문자열을 UTC로 주입한다.

| 필드 | 주입 시점 |
|---|---|
| 최상위 `created_at` | `create`·최초 `append`·최초 `register`에서 한 번 |
| 최상위 `updated_at` | 모든 쓰기 연산마다 현재 시각으로 갱신 |
| Append entry의 `created_at` | 해당 entry가 배열에 추가되는 시점 |

Payload에 agent가 넣은 timestamp 값은 CLI가 덮어쓴다. `created_at`의 프로젝트 로컬 TZ 해석이 필요하면 agent가 파일을 읽어 변환한다 — CLI 저장은 UTC로 고정.

## 12. Template 생성

Template은 **fallback 도구**다 — skill 본문이 payload shape을 이미 담고 있다면 호출할 필요 없다. Skill에 shape이 없거나 agent가 확신 없을 때만 호출.

### 호출 방식

```
geas schema template <type> --op <operation> [--kind <k>]
```

- `<type>`: schema 이름 (evidence, task-contract, mission-spec 등)
- `--op`: 수행할 연산 (create, set, append, update, register, run). 같은 schema도 op에 따라 "agent가 채울 부분"이 다름.
- `--kind`: allOf 분기가 있는 schema에서 분기 선택 (예: evidence의 `--kind review`/`verification`/`closure`).

### 응답 형식 — 3분할

```json
{
  "you_must_fill": {
    "evidence_kind": "review",
    "summary": "<REQUIRED: one-sentence summary>",
    "verdict": "<enum: approved | changes_requested | blocked>",
    "concerns": [],
    "rationale": "<REQUIRED: markdown allowed>",
    "scope_examined": "<REQUIRED: markdown allowed>",
    "methods_used": ["<REQUIRED: at least 1>"],
    "scope_excluded": [],
    "artifacts": [],
    "memory_suggestions": [],
    "debt_candidates": [],
    "gap_signals": [],
    "revision_ref": null
  },
  "cli_auto_fills": [
    "entry_id",
    "created_at"
  ],
  "from_flags_or_path": [
    { "field": "mission_id", "source": "project root" },
    { "field": "task_id",    "source": "--task flag"   },
    { "field": "agent",      "source": "--agent flag"  }
  ]
}
```

- `you_must_fill`: **agent가 stdin으로 제출해야 하는 JSON**. placeholder에 `<REQUIRED: ...>` 형식으로 힌트 제공. Agent는 placeholder를 실제 값으로 교체.
- `cli_auto_fills`: CLI가 자동으로 채우는 필드 — agent가 포함해서 보내도 덮어씀. 참고용 목록.
- `from_flags_or_path`: CLI 플래그나 프로젝트 경로에서 유추되는 필드 — agent는 JSON에 포함하지 않음.

### 생성 규칙

- `you_must_fill`은 schema의 required 중 **CLI 자동/플래그 유추 제외**한 필드들만 포함.
- 각 필드의 placeholder:
  - `string` (minLength ≥1): `"<REQUIRED: 짧은 설명>"`
  - `enum`: `"<enum: 값1 | 값2>"`
  - `array` (minItems ≥1): `["<REQUIRED: at least N>"]`
  - `array` (minItems = 0): `[]`
  - `number`: `0`
  - `boolean`: `false`
  - `null`-허용 필드: `null`
- `allOf` kind 분기가 있으면 `--kind` 값에 해당하는 분기의 required만 포함.

### 재호출 최소화

동일 세션(persistent-main runtime)에서는 한 번 받아둔 응답을 agent가 기억해 재사용. Turn-scoped runtime이더라도 skill 본문에 shape이 있으면 template 호출이 아예 불필요.

Template 응답의 `you_must_fill`을 그대로 제출해도 placeholder 때문에 schema 검증 실패할 수 있다 — agent는 placeholder를 실제 값으로 반드시 교체.

## 13. 경로 규약과 불변 불가침

### 경로

모든 `.geas/` 경로는 `geas setup`이 초기화한 프로젝트 루트 기준 상대다. 루트 감지는 `.geas/config.json`을 통한다.

**`.geas/config.json` 형식**:

```json
// canonical (루트 저장소)
{
  "root_id": "7a9b3c4d-...",      // UUID, setup이 생성, 이동 감지·충돌 식별
  "canonical_root": "/abs/path/to/project"
}

// delegate (워크트리, 다른 `.geas/`를 가리킴)
{
  "delegate_to": "/abs/path/to/canonical/project"
}
```

**루트 감지 알고리즘**:

```
1. 현재 디렉토리부터 상위로 walk up하며 `geas setup`이 만든 `.geas/config.json` 탐색
2. 첫 발견 config를 파싱
3a. `delegate_to`가 있으면 해당 경로로 이동, 그 경로의 `.geas/config.json`을 다시 파싱
   (delegate chain은 한 단계만 허용; 이중 delegate는 invalid_argument)
3b. `canonical_root`가 있으면 그 경로가 실제 프로젝트 루트
4. canonical_root와 현재 파일시스템 경로가 다르면 "프로젝트 이동됨" warning + 자동 갱신
5. `.geas/` 디렉토리만 있고 `config.json`이 없으면 초기화되지 않은 상태로 간주하고 실패 (`missing_artifact`)
6. config·`.geas/` 둘 다 없으면 setup 외 명령은 실패 (`missing_artifact`)
```

**Worktree 지원**:

```bash
# 메인 repo
cd /repo/main
geas setup
# → /repo/main/.geas/config.json 작성 (canonical)

# Git worktree 생성 후
git worktree add /repo/.worktrees/feature-a
cd /repo/.worktrees/feature-a
geas setup --link-to /repo/main
# → /repo/.worktrees/feature-a/.geas/config.json 작성 (delegate)
# 모든 CLI 호출은 실제로 /repo/main/.geas/에 쓰임
```

Delegate가 설정된 워크트리에서 쓰기 명령은 canonical 저장소의 `.geas/`에 실제 파일을 작성한다. Read 명령도 canonical을 본다. 어떤 경우에도 setup이 만들지 않은 임의의 `.geas/` 디렉토리를 루트로 간주하지 않는다.

CLI는 `--cwd`·`--project-root` 같은 override를 받지 않는다. 루트 변경이 필요하면 config를 수정하거나 cwd를 바꿔야 한다.

**`root_id`의 역할**:

- Canonical config에만 존재, setup이 UUID v4를 생성.
- 응답 JSON에 항상 포함되어 agent가 "어느 저장소에 썼는지" 확인 가능.
- `canonical_root` 경로가 다른 프로젝트로 혼동되거나 두 `.geas/`가 같은 id를 가지면 `invalid_argument` 반환.
- Mission·task artifact에는 snapshot하지 않는다 — root 식별은 `config.json` 하나에서만 한다. 감사 용도로 root_id를 넣고 싶다면 `events.jsonl`의 이벤트 payload에 담는다.

### 불변 불가침

CLI는 다음을 절대 수행하지 않는다.

- Append-only 로그의 item 수정·삭제
- Agent가 제출한 `created_at`·`updated_at`·`entry_id`·`gate_run_id`·`mission_id`·`task_id`·`debt_id` 값 보존 (전부 덮어쓰기)
- `.geas/` 바깥 파일 쓰기
- 사용자 확인 없이 `.geas/` 전체 삭제 (setup은 존재 시 실패, 별도 `geas reset` 같은 명령은 제공하지 않음)
- `schema` 명령 외 경로로 schema 파일 노출
- 쓰기 실패를 부분 성공으로 보고

CLI가 이 원칙 중 하나를 어기는 변경을 포함한다면 그건 버그가 아니라 프로토콜 위반이다.

## 14. 자동화 동작

CLI는 atomic 단일 파일 쓰기가 기본이지만, 아래 범위 내에서 **확장된 부작용**을 갖는 자동화를 수행한다. 각 자동화는 orchestrator의 반복 호출을 줄이되 (a) 의미적 판단은 건드리지 않고 (b) 모든 부작용이 `events.jsonl`에 기록되며 (c) 실패 시 partial 상태 없이 명확히 reported 된다.

### 14.1 Scaffold 자동 생성

`mission create`와 `task draft`는 단일 파일 쓰기 이상의 디렉토리 scaffold를 수행한다.

**`mission create` 부작용**:
- `.geas/missions/{mission_id}/spec.json` 작성 (주 artifact)
- `.geas/missions/{mission_id}/mission-state.json` 초기화 (`phase: specifying`, `active_tasks: []`)
- 빈 wrapper 초기화: `phase-reviews.json` (`reviews: []`), `deliberations.json` (`level: mission`, `entries: []`), `mission-verdicts.json` (`verdicts: []`)
- 디렉토리 생성: `tasks/`, `consolidation/`

**`task draft` 부작용**:
- `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` 작성
- `task-state.json` 초기화 (`active_agent: null`, `verify_fix_iterations: 0`)
- 디렉토리 생성: `evidence/`, `deliberations.json` (`level: task`, `entries: []`)

**Idempotency 경계**: scaffold의 멱등성은 **주 artifact 외 요소만** 해당한다.

- **주 artifact** (`spec.json`, `contract.json`): 이미 존재하면 `path_collision` 에러. 덮어쓰지 않음.
- **보조 요소** (빈 wrapper 파일 `phase-reviews.json`·`deliberations.json`·`mission-verdicts.json`, 서브디렉토리 `tasks/`·`consolidation/`·`evidence/`): 이미 존재하면 조용한 no-op. 기존 내용 보존.

이 분리 덕분에 scaffold 재시도는 안전하지만, 동일 id의 주 artifact 재생성은 명시적 실패로 감지된다. 빈 wrapper 파일은 schema 유효(빈 배열 허용)하므로 검증 통과.

### 14.2 Phase 전이 강화

`geas mission-state update --phase <phase>`는 phase에 따라 추가 검증·전이를 수행한다.

**`--phase building`**:
- `mission-state.phase`를 `building`으로 갱신하기 전 각 drafted task의 `approved_by`를 확인.
- `approved_by != null`인 drafted task를 일괄 ready로 전이 시도.
- 응답은 per-task 결과:
  ```json
  {
    "ok": true,
    "path": ".geas/missions/{mid}/mission-state.json",
    "bulk_transitions": {
      "success": ["task-001", "task-002"],
      "skipped": [{"task_id": "task-003", "reason": "approved_by is null"}],
      "failed":  [{"task_id": "task-004", "reason": "dependency not passed"}]
    }
  }
  ```
- 각 per-task 전이는 독립 atomic write. 일부 실패해도 mission-state는 건드리지 않음 (phase 전이는 모든 전이 성공 시에만 확정, 아니면 `guard_failed` 반환).

**`--phase consolidating`**:
- 모든 task의 `status`가 `passed` / `cancelled` / `escalated` 중 하나인지 검증.
- 미종결 task가 있으면 `guard_failed` + `unresolved_tasks: [...]` 반환.

**기타 phase 전이**: 단순 phase 갱신 + phase-reviews 마지막 entry의 `next_phase`와 일치하는지 guard.

### 14.3 Deliberation append 검증

`geas deliberation append --level mission|task [--task <id>]`는 append 시 다음을 검증한다.

- Voter 집합이 요구 조건(mission 기준 3+ voter, task 기준 2+ voter)을 충족하는지.
- `result` 필드가 voter들의 vote 집합과 일관되는지 (agree 과반 → agree, disagree 과반 → disagree, escalate가 하나라도 있으면 escalate, 그 외 inconclusive).
- 조건 미충족 시 `guard_failed` 반환 (누락 voter 또는 result 불일치 명시).

Deliberation entry는 **결과가 확정된 상태로만** append된다. "열린 심의"는 파일에 기록되지 않고 orchestrator/agent 맥락 안에서만 추적된다. 이 모델은 append-only 계약을 유지한다 — 한 번 기록된 entry는 수정되지 않는다.

### 14.4 Consolidation scaffold

`geas consolidation scaffold`:
- 현재 mission의 모든 task evidence 파일을 훑어 `debt_candidates`, `memory_suggestions`, `gap_signals`을 수집.
- `.geas/missions/{mid}/consolidation/candidates.json` 생성 (덮어쓰기 허용):
  ```json
  {
    "mission_id": "...",
    "collected_at": "...",
    "debt_candidates": [{"source_task": "task-001", "source_entry": 3, ...}, ...],
    "memory_suggestions": [...],
    "gap_signals": [...]
  }
  ```
- Schema 검증 대상이 아님 (`candidates.json`은 지원용 파일). `geas validate`는 건너뜀.
- Orchestrator는 `candidates.json`을 Read tool로 보고 `debts.json`·`gap.json`·`memory-update.json`을 별도 `register`/`set` 명령으로 작성. Candidates → 공식 승격은 자동화 없음.

### 14.5 Gate 결과 힌트

`geas gate run` 응답에 `suggested_next_transition` 필드 포함:

```json
{
  "ok": true,
  "path": ".geas/missions/{mid}/tasks/{tid}/gate-results.json",
  "ids": { "gate_run_id": "gate-2" },
  "suggested_next_transition": {
    "verdict": "pass",
    "target_state": "verified",
    "command": "geas task transition --task task-001 --to verified"
  }
}
```

- `verdict`에 따른 target:
  - `pass` → `verified`
  - `block` → `blocked`
  - `fail` → null (orchestrator가 rewind 대상 결정)
  - `error` → null (원인 해소 후 재실행)
- CLI는 **자동 전이하지 않는다**. orchestrator가 hint를 보고 별도 `task transition` 호출.

### 14.6 Status

`geas status [--mission <mission_id>]`:
- 기본은 현재 활성 mission (`mission-state.phase != complete`).
- 응답:
  ```json
  {
    "ok": true,
    "mission_id": "...",
    "phase": "building",
    "active_tasks": [
      {"task_id": "task-001", "status": "implementing", "active_agent": "implementer"},
      {"task_id": "task-002", "status": "reviewed", "pending_gate": true}
    ],
    "pending": {
      "drafted_unapproved": ["task-003"],
      "blocked": [],
      "escalated": []
    },
    "phase_progress": {
      "tasks_total": 5, "passed": 2, "in_flight": 2, "terminated": 1
    }
  }
  ```
- 순수 조회 — 쓰기 없음.

### 14.7 Events 로깅 강제

자동화가 붙은 모든 명령은 `events.jsonl`에 이벤트를 append한다. 이벤트 스키마:

```json
{
  "event_id": "evt-<seq>",
  "kind": "<enum>",
  "actor": "cli:auto" | "orchestrator" | "user" | "decision_maker",
  "triggered_by": {"type": "command", "ref": "geas mission-state update --phase building"},
  "prior_event": "evt-<seq>",
  "payload": { ... },
  "created_at": "<ISO 8601 UTC>"
}
```

- **`actor: "cli:auto"`** 이벤트는 반드시 선행 orchestrator/user 의도 이벤트(`prior_event`)와 체인 연결되어야 한다.
- **Artifact 참조는 단방향 (events → artifact)**: 쓰기를 동반하는 이벤트는 `payload`에 영향 받은 artifact 경로와 식별자를 담는다 (예: `{ "artifact": "tasks/task-001/evidence/implementer.json", "entry_id": 3 }`). 프로토콜 artifact 쪽에는 역방향 event_id 참조를 두지 않는다 — artifact schema는 `additionalProperties: false`로 닫혀 있고, events.jsonl은 구현체 보조 로그라 artifact 계약을 오염시키지 않는 게 원칙이다. 특정 artifact에 어떤 이벤트가 영향을 줬는지 알고 싶으면 events.jsonl에서 해당 경로로 grep한다.
- **Rollback**: 자동 전이 취소 시 기존 이벤트를 삭제·수정하지 않고 역방향 이벤트를 append한다 (`kind: "transition_reversed"` 등, `invalidates: evt-<seq>`).
- 이벤트 기록 실패 시 해당 명령 자체가 `io_error`로 실패 — 부작용을 남기지 않는다.

### 14.8 자동화 안 함 (수동 유지)

다음은 orchestrator의 명시적 호출이 필요하며 CLI가 자동화하지 않는다.

- `task transition --to blocked/cancelled/escalated`: 이유 명시 필수
- `task transition --to ready/implementing/reviewed` (from `blocked`): 복귀 지점 판단
- `changes_requested` closure 이후 rewind target 지정
- `gate run` 이후 `verified` 전이 (§14.5의 hint만 제공)
- `evidence append` 이후 lifecycle 전이 (closure 포함 — evidence 쓰기와 전이 쓰기를 분리)
- `mission-verdict append`: decision-maker 전용 판단
- `debt update-status`: status 변경의 의미적 판단
- `consolidation/candidates.json`에서 공식 `debts.json`·`gap.json`·`memory-update.json`으로 승격

이 분리 원칙은 "CLI는 형식·구조·deterministic 집계만, 판단은 orchestrator와 agent"라는 §2의 전제를 유지한다.
