# Geas CLI 설계

이 문서는 Geas CLI(`geas`)의 아키텍처를 기술한다. 상위 구조와 다른 계층과의 관계는 `architecture/DESIGN.md`에 있다. 이 문서는 CLI 단독으로 보장해야 하는 내부 계약과 동작을 정의한다.

## 1. 목적과 범위

CLI는 `.geas/` 아래 모든 쓰기가 통과해야 하는 단일 actuator다. 주 소비자는 skill과 agent가 부리는 쉘 호출 — **사람이 터미널에 직접 치는 도구가 아니다**. 이 전제 아래 UX 배려(색상, 진행 표시, 대화형 프롬프트, `--quiet`·`--verbose` 같은 편의 옵션)는 전부 제거된다.

CLI가 책임지는 일은 여섯이다.

1. JSON payload를 schema로 검증하고 실패 시 구조화된 hint를 반환한다.
2. 상태 전이가 요구하는 선행 artifact를 읽어 guard를 평가한다.
3. 타임스탬프와 식별자를 자동 주입한다.
4. Append-only 로그의 불변성을 강제한다.
5. 쓰기를 temp → fsync → rename으로 원자화한다.
6. `.geas/` 경로를 고정한다 (사용자가 경로를 바꿀 수 없다).

이 여섯 외의 모든 것(HTTP API, UI, 자동 보고서, 통계 요약 등)은 CLI의 책임이 아니다.

## 2. 설계 전제

- **LLM-only interface.** 출력은 사람이 읽기 좋은 서식 대신 머신 소비용 JSON으로 고정.
- **경로 고정.** `.geas/`는 항상 프로젝트 루트 기준 상대 경로다. CLI는 루트를 자동으로 감지하며 `--cwd`·`--dir` 같은 경로 옵션은 제공하지 않는다. 프로젝트 루트는 (a) 현재 디렉토리 또는 상위 중 `.geas/` 디렉토리가 존재하는 가장 가까운 상위, 아니면 (b) `setup` 명령이 초기화한 현재 디렉토리.
- **옵션 최소.** 각 명령은 해당 작업에 필수적인 인자만 받는다. 편의 옵션 금지.
- **상태 저장 없음.** CLI는 자체 상태를 저장하지 않는다. 매 호출이 독립적이고 재현 가능하다.
- **멱등성 원칙.** 같은 입력으로 같은 `.geas/` 상태에 반복 호출하면 결과가 동일하다 (append 명령은 동일 entry가 이미 마지막에 있으면 no-op 반환).
- **Skill/agent discipline.** CLI는 agent의 선의를 검증하지 않는다. 잘못된 JSON은 schema가 걸러내지만, "이 전이가 정당한가"의 의미적 판단은 skill과 agent의 책임이다. CLI는 형식과 전이 선행 조건만 본다.

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

### Mission-level 명령

| 명령 | 연산 | 대상 artifact |
|---|---|---|
| `geas mission create` | create | `missions/{id}/spec.json` |
| `geas mission design-set` | set | `missions/{id}/mission-design.md` |
| `geas mission-state update` | update | `missions/{id}/mission-state.json` |
| `geas phase-review append` | append | `missions/{id}/phase-reviews.json` |
| `geas mission-verdict append` | append | `missions/{id}/mission-verdicts.json` |
| `geas deliberation append --level mission` | append | `missions/{id}/deliberations.json` |
| `geas debt register` | register | `missions/{id}/consolidation/debts.json` |
| `geas debt update-status` | update | `missions/{id}/consolidation/debts.json` |
| `geas gap set` | set | `missions/{id}/consolidation/gap.json` |
| `geas memory-update set` | set | `missions/{id}/consolidation/memory-update.json` |

### Task-level 명령

| 명령 | 연산 | 대상 artifact |
|---|---|---|
| `geas task draft` | create | `tasks/{id}/contract.json` |
| `geas task approve` | update | `contract.approved_by` |
| `geas task transition` | update | `task-state.json` (lifecycle 전이) |
| `geas task-state update` | update | `task-state.json` (active_agent, iterations) |
| `geas impl-contract set` | set | `tasks/{id}/implementation-contract.json` |
| `geas self-check set` | set | `tasks/{id}/self-check.json` |
| `geas evidence append` | append | `tasks/{id}/evidence/{agent}.json` |
| `geas gate run` | run | `tasks/{id}/gate-results.json` |
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
| `geas resume` | 현재 mission/task 상태를 agent가 소비할 context JSON으로 반환 |
| `geas validate` | `.geas/` 전체를 schema로 검증한 결과 JSON 반환 |
| `geas setup` | 프로젝트에 `.geas/` 초기화 |
| `geas event log --kind <k> --payload <json>` | `events.jsonl`에 append |

## 4. 입력 규약

### JSON payload 전달

JSON payload는 **stdin으로만** 받는다. 플래그 없음.

```bash
# heredoc
geas evidence append --task task-001 --agent implementer <<'EOF'
{
  "evidence_kind": "implementation",
  "summary": "..."
}
EOF

# 파이프
cat payload.json | geas mission create

# echo
echo '{"name": "..."}' | geas mission create
```

CLI는 stdin이 TTY가 아니면 UTF-8 JSON으로 해석한다. Payload가 필요한 명령인데 stdin이 비어 있거나 TTY면 입력 누락으로 실패한다. JSON 파싱 실패는 `invalid_argument`.

Shell escaping을 피하려면 heredoc 또는 파일 경유 파이프가 가장 안전하다.

### 식별자 인자

위치 인자가 아닌 명시적 플래그만 쓴다.

- `--mission <mission_id>` — mission 식별자 (생략 시 현재 활성 mission을 mission-state에서 유추; 활성이 없으면 실패).
- `--task <task_id>` — task 식별자 (task-level 명령에서 필수).
- `--agent <slot>` — evidence append에서 필수. slot enum으로 제한.
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
| `path_collision` | create 대상이 이미 존재 |
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
| `ready → implementing` | 각 `dependencies`의 `task-state.json` | 모두 `status == passed` (contract 또는 task-state 중 source of truth) |
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

### 검증 알고리즘

Append 명령이 호출되면:

```
1. 기존 파일 로드 (없으면 최초 create와 동등 — entries=[payload], timestamps 주입)
2. 기존 entries 배열 A와 새 payload의 entries B 비교
3. B.length == A.length + 1 이어야 함
4. B[0..A.length-1] 는 A와 byte-identical (추가된 부분 외 변경 금지)
5. B[A.length] 는 새 entry — schema 검증, entry_id = max(existing) + 1, created_at 주입
6. 통과 시 atomic write
```

조건 위반이면 `append_only_violation` 반환. 예:
- 기존 entry를 덮어썼음 (B[i] ≠ A[i] for i < A.length)
- Entry를 삭제했음 (B.length ≤ A.length)
- 여러 entry를 한 번에 추가 (B.length > A.length + 1)

한 번에 여러 entry 추가는 금지 — 각 entry의 `created_at`을 CLI가 정확히 주입하려면 한 번에 하나여야 하고, 그래야 각 entry의 시간 순서가 실제 CLI 호출 순서와 일치한다.

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

`geas schema template <type>`는 해당 schema의 fill-in 골격 JSON을 반환한다.

### 생성 규칙

- Schema의 `required` 필드만 포함.
- `additionalProperties: false`인 object는 자식도 required 필드만 재귀 포함.
- 기본값:
  - `string` → `""` (minLength 있으면 `"___"` 등 placeholder)
  - `integer`/`number` → `0`
  - `boolean` → `false`
  - `array` → `[]`
  - `enum` → enum의 첫 값
  - `oneOf`/`anyOf` → 첫 대안 기준으로 생성
- `allOf`의 `if/then`은 evidence처럼 kind 분기가 있는 경우 `--kind`·`--role` 같은 sub-flag로 어느 분기를 채울지 선택 가능 (예: `schema template evidence --kind review`).
- CLI가 자동 주입하는 필드(`created_at`, `updated_at`, `entry_id` 등)는 template에서 제외 — agent가 이 필드를 채워 보낼 필요 없음.

Template은 참고용이므로 CLI가 나중에 실제 쓰기 시 schema 검증을 다시 수행한다. Template이 유효한 최소 payload를 돌려준다는 보장은 없다 (예: `minItems: 1`인 배열은 빈 배열로 생성되어 그대로 제출하면 검증 실패). Agent는 template을 받아 placeholder를 실제 값으로 채워야 한다.

## 13. 경로 규약과 불변 불가침

### 경로

모든 `.geas/` 경로는 프로젝트 루트 기준 상대. 루트 감지:

```
1. 현재 디렉토리부터 상위로 올라가며 `.geas/` 디렉토리 탐색
2. 가장 가까운 상위를 프로젝트 루트로 확정
3. 없으면 (setup 이전) 현재 디렉토리를 루트 후보로 하고, setup 외 명령은 루트 미확정이면 실패
```

CLI는 `--cwd`·`--project-root` 같은 override를 받지 않는다. 잘못된 디렉토리에서 호출하면 실패하거나 다른 `.geas/`를 조작할 위험이 있으므로, 실행 환경이 루트를 확실히 해둬야 한다.

### 불변 불가침

CLI는 다음을 절대 수행하지 않는다.

- Append-only 로그의 item 수정·삭제
- Agent가 제출한 `created_at`·`updated_at`·`entry_id`·`gate_run_id`·`mission_id`·`task_id`·`debt_id` 값 보존 (전부 덮어쓰기)
- `.geas/` 바깥 파일 쓰기
- 사용자 확인 없이 `.geas/` 전체 삭제 (setup은 존재 시 실패, 별도 `geas reset` 같은 명령은 제공하지 않음)
- `schema` 명령 외 경로로 schema 파일 노출
- 쓰기 실패를 부분 성공으로 보고

CLI가 이 원칙 중 하나를 어기는 변경을 포함한다면 그건 버그가 아니라 프로토콜 위반이다.
