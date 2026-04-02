# 09. Memory Retrieval and Context Engine

## 목적

memory가 많아져도 context window를 망치면 시스템은 오히려 나빠진다. 따라서 retrieval과 packet assembly는 memory system의 절반이다.

## Retrieval Inputs

retrieval은 아래 입력을 본다.
- current phase / mission phase
- task kind / risk level
- scope.paths
- touched paths
- reviewer set
- known risks
- recent failures / incidents
- mission intent
- agent type
- applicable rules.md entries

## Retrieval Priority Bands

### L0 — pinned invariants
항상 들어가는 최소 핵심 규칙
- session phase
- mission phase
- focus task id
- task goal / acceptance
- current rewind status
- hard protocol invariants
- approved `rules.md` entries

### L1 — task-local packet
현재 task에 직접 relevant한 baseline / scope / contract / recent review / recent memory

### L2 — applicable memory
현재 task와 role에 맞는 stable/provisional memory. `memory_type`이 `agent_rule`인 항목은 role match 시, `risk_pattern`인 항목은 risk level에 따라 우선 포함

### L3 — drill-down
필요 시에만 여는 상세 로그, 과거 incident, superseded memory

## Memory Packet

`memory-packet.json`은 특정 agent에게 주입할 구조화된 요약이다.

최소 필드:
- `target_agent_type`
- `target_task_id`
- `pinned_items[]`
- `applicable_memory_ids[]`
- `caution_items[]`
- `suppressed_memory_ids[]`
- `assembly_reason`

## Retrieval Scoring Heuristic

각 memory entry의 retrieval score는 아래 가중치로 계산한다:

| Factor | Weight | 설명 |
|---|---|---|
| `scope_match` | `0.25` | memory의 scope가 현재 task scope와 일치하는 정도 (0.0~1.0) |
| `path_overlap` | `0.20` | memory의 관련 path와 task의 touched paths 겹침 비율 (0.0~1.0) |
| `role_match` | `0.15` | memory의 target agent type과 현재 agent type 일치 여부 (0 또는 1) |
| `freshness` | `0.15` | `last_confirmed_at` 기준 최신일수록 높음. 계산: `max(0.0, 1.0 - (days_since_last_confirmed / 180))`. 180일 이상 경과하면 0.0 |
| `confidence` | `0.10` | memory의 현재 confidence 값 그대로 사용 (0.0~1.0) |
| `reuse_success` | `0.10` | `successful_reuses / (successful_reuses + failed_reuses)` (0.0~1.0, 적용 이력 없으면 0.5) |
| `contradiction_penalty` | `-0.15` | `min(contradiction_count * 0.05, 0.15)` 를 차감 |

**계산식:**
```
raw_score = (scope_match * 0.25) + (path_overlap * 0.20) + (role_match * 0.15)
          + (freshness * 0.15) + (confidence * 0.10) + (reuse_success * 0.10)
          - contradiction_penalty
score = clamp(raw_score, 0.0, 1.0)
```

task의 risk_level이 `high` 이상이면 `risk_pattern` type의 memory에 `+0.10` bonus를 부여한다.

### Scope Match 계산

memory의 `scope`와 현재 task의 context scope를 비교하여 0.0~1.0 점수를 산출한다.

| Memory Scope \ Task Context | task | mission | project |
|---|---|---|---|
| `task` (동일 task) | 1.0 | 0.3 | 0.1 |
| `task` (다른 task) | 0.2 | 0.3 | 0.1 |
| `mission` | 0.7 | 1.0 | 0.5 |
| `project` | 0.5 | 0.7 | 1.0 |
| `agent` (동일 agent type) | 0.8 | 0.8 | 0.8 |
| `agent` (다른 agent type) | 0.1 | 0.1 | 0.1 |
| `global` | 0.4 | 0.4 | 0.6 |

### Path Overlap 계산

memory의 관련 경로는 `evidence_refs[]`에서 추출한다. evidence_ref가 task를 가리키면 해당 task의 `scope.paths`를 사용한다. evidence_ref가 file artifact를 가리키면 해당 파일 경로를 사용한다.

`path_overlap = |memory_paths ∩ task_paths| / |task_paths|` (task_paths가 비어 있으면 0.0)

### Freshness 계산

`last_confirmed_at`는 memory-entry의 직접 필드가 아니라, 해당 memory_id에 대한 가장 최근의 `memory-application-log.json` 중 `effect = "positive"`인 항목의 `created_at`에서 파생한다. positive application log가 없으면 memory-entry 자체의 `created_at`을 사용한다.

`freshness = max(0.0, 1.0 - (days_since_last_confirmed / 180))`

### Edge Cases

- **memory-index.json이 비어 있는 경우**: retrieval engine은 빈 결과를 반환하고, L2 단계를 skip한다. packet의 `applicable_memory_ids[]`는 빈 배열이 된다. 이는 정상 동작이다 (doc 07 Empty Memory Index 참조).
- **모든 memory의 score가 동일한 경우**: `confidence`가 높은 entry를 우선한다. confidence도 동일하면 `last_confirmed_at`이 최신인 entry를 우선한다.
- **budget이 0인 경우**: L1/L2 memory를 포함하지 않고 L0 (pinned invariants)만으로 packet을 구성한다. 모든 후보는 `suppressed_memory_ids[]`에 `reason: "budget_zero"` 로 기록한다.

## Role-Specific Budgets

### `orchestration_authority`
- pinned invariants: 8~12 bullets
- task-local packet: 1 compact summary
- memory entries: 5~8개 이하

### specialist
- task-local packet: 강하게 우선
- memory entries: 3~5개 이하
- caution items: 1~2개

### `product_authority`
- full implementation detail 대신 closure packet + high-signal memory only
- memory entries: 3개 이하

## Context Assembly Algorithm

1. pinned invariants 구성 (L0 — anti-forgetting 항목 포함, role budget에 포함되지 않음)
2. task contract / implementation contract / recent reviews에서 task-local packet 생성
3. rules.md applicable subset 계산
4. retrieval engine으로 memory 후보 추출
5. score 정렬 후 budget 내로 top-N 선택
6. 동점(tied score)인 경우 `confidence`가 높은 entry를 우선한다
7. budget 초과로 제외된 entry는 `suppressed_memory_ids[]`에 기록하고, 각 항목에 `reason: "budget_overflow"` 명시
8. cautionary incident 별도 표시
9. packet version 기록 (형식: `"{task_id}-{sequence_number}"`, sequence_number는 regeneration마다 1씩 증가)
10. packet ref를 `run.json`에 기록

### Packet Versioning

- `packet_version` 형식: `"{task_id}-{sequence_number}"`
  - `task_id`: 대상 task의 ID
  - `sequence_number`: 해당 task에 대해 packet이 생성/재생성될 때마다 1씩 증가 (초기값 1)
- 이전 version의 packet은 저장하지 않는다 (최신 packet만 유효)

## Packet Staleness Rules

packet은 아래면 stale다.
- task `base_commit`이 변경됨
- required reviewer set가 바뀜
- integration result가 새로 생김
- gate fail 또는 rewind 발생
- memory packet version이 바뀜
- rules update가 적용됨
- focus task가 바뀜
- packet에 포함된 memory 중 하나 이상이 `under_review` 또는 `superseded` 상태로 전이한 경우

`under_review` 또는 `superseded` 상태 전이로 인한 staleness의 경우, 재생성된 packet의 `suppressed_memory_ids[]`에 해당 memory를 추가하고 `reason: "state_changed_to_under_review"` 또는 `reason: "state_changed_to_superseded"`로 기록한다.

stale packet은 다음 step 전에 재생성해야 한다.

### Stale Packet 재생성 규칙

- stale packet은 **incremental patch가 아니라 처음부터 재생성(full regeneration)** 한다.
- 재생성은 `orchestration_authority`가 다음 step에서 해당 packet을 소비하기 **전에** trigger한다.
- 재생성 비용: context assembly algorithm 1회 실행 (위 Context Assembly Algorithm 참조).
- 재생성 시 `packet_version`의 `sequence_number`가 1 증가한다.
- **재생성 실패 시**: context assembly algorithm 실행 중 오류(예: memory-index 로드 실패, run.json 손상)가 발생하면, 이전 packet을 `stale` 표시 상태로 유지하고 해당 task의 다음 step 실행을 block한다. `orchestration_authority`는 오류 원인을 해소한 후 재생성을 재시도한다.

## Summaries

### `session-latest.md`
세션 전체 최신 요약. compaction/resume의 anchor.

### `task-focus/<task-id>.md`
현재 task에 대한 국소 요약. specialist subagent에 주입되는 기본 요약.

### `mission-summary.md`
mission 레벨 상태, 남은 문제, pending decision, outstanding risk 요약.

## Anti-Forgetting Guarantee

시스템은 최소한 아래 7개 항목을 잃지 않아야 한다. 각 항목은 `session-latest.md` 또는 `run.json`에서 복원 가능해야 한다.
1. current phase / mission phase — `run.json`의 `phase`, `mission_phase` 필드
2. focus task state — `run.json`의 `focus_task_id`와 해당 `task.json`의 `state`
3. current rewind reason — 활성 rewind가 없으면 `"none"`을 명시. `run.json`의 `rewind` 필드
4. required next artifact — 현재 task state에서 다음 전이에 필요한 artifact. `run.json` 또는 `task.json`에서 도출
5. open risks — `run.json`의 `open_risks[]` 또는 현재 task의 `known_risks[]`
6. most recent recovery outcome — recovery가 없었으면 `"no_recovery"`를 명시. `recovery-packet.json`에서 도출
7. most relevant rules 1~3개 + most relevant stable memory 1~3개 — retrieval scoring에서 상위 항목 선택

### Budget과의 관계

위 anti-forgetting 항목은 **L0 (pinned invariants)** 에 속하며, role-specific budget에 **포함되지 않는다**. 즉 role budget이 "memory entries 3~5개"라 하더라도 anti-forgetting 항목은 별도로 항상 주입된다. Budget은 L1/L2 memory에만 적용된다.
