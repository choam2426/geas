# 02. Modes, Missions, and Runtime

## Mission Model

mission은 사용자의 요청을 protocol이 실행 가능한 형태로 정규화한 상위 목적이다.

최소 필드:
- `mission_id`
- `intent`
- `goal`
- `constraints`
- `source_request`
- `entry_signals`
- `scope_in`
- `current_phase`

## Mission Intent Enum

- `explore`
- `plan`
- `build`
- `fix`
- `review`
- `decide`
- `recover`

## Initiative 4-Phase Model

모든 mission은 필요 시 아래 4개 phase를 순차적으로 거친다.

### Phase Flow

```
specifying ──[gate 1]──> building ──[gate 2]──> polishing ──[gate 3]──> evolving
                                                                             │
                                                                        [gate 4]
                                                                             │
                                                                           close
                                                                        (또는 다음 mission)

gate 1: mission brief + scope_in + initial tasks 존재
gate 2: MVP-critical task 전부 passed + blocking_conflict 없음 + critical debt 0건 + unmitigated high debt 0건
         필수 artifact: phase-review.json, gap-assessment.json
gate 3: high/critical debt 전부 triaged + required reviews approved + 모든 known risk에 shipping rationale 기록
         필수 artifact: phase-review.json, gap-assessment.json
gate 4: gap-assessment.json + retrospective.json + rules update + debt snapshot + mission summary
         필수 artifact: phase-review.json, gap-assessment.json
```

### 1) `specifying`
목표:
- 미션 정의 고정
- MVP scope_in 생성
- architecture / conventions 결정
- initial backlog 컴파일

필수 산출물:
- mission brief
- `scope_in`
- decision records
- initial tasks
- conventions / project memory seed

### 2) `building`
목표:
- scope_in의 필수 가치 경로를 구현
- task 단위 closure 반복

phase exit 조건:
- MVP-critical task 전부 `passed`
- blocking_conflict 없음
- `critical` severity debt가 0건이고, `high` severity debt 중 mitigation plan이 없는 항목이 0건

### 3) `polishing`
목표:
- UX/QA/security/docs/perf/debt hardening
- release-readiness 확보
- entropy scan: dead code, AI boilerplate, convention drift, 코드 중복을 검출하고 정리한다
- entropy scan 결과 발견된 항목은 debt-register에 기록하거나, 즉시 수정한다

phase exit 조건:
- `high` 및 `critical` severity debt가 모두 `triaged` 상태 (accept, defer with rationale, 또는 resolve 중 하나)
- required documentation/security/ops reviews 완료 (해당 specialist의 review가 `approved` status)
- 모든 known risk 항목에 shipping rationale이 기록되어 있음

### 4) `evolving`
목표:
- 실제 delivered scope 평가
- gap assessment 수행
- retrospective 집계
- rules.md / memory / debt register 업데이트
- 다음 mission 또는 다음 cycle backlog 생성

phase exit 조건:
- `gap-assessment.json` 존재
- `retrospective.json` 묶음 정리 완료
- approved rules update 반영
- debt snapshot 반영
- mission summary 생성

## Runtime Phases

- `bootstrap`
- `planning`
- `scheduling`
- `executing`
- `integrating`
- `verifying`
- `learning`
- `idle`

runtime phase는 현재 작업 안에서 어디에 있는지, mission phase는 initiative progression 상 어디에 있는지 표현한다.

## `run.json` 핵심 필드

- `session_start_ref`
- `integration_branch`
- `phase`
- `mission_phase`
- `focus_task_id`
- `checkpoint_seq`
- `recovery_state`
- `active_locks`
- `packet_refs`

## Phase Semantics

- `bootstrap`: repo 상태/lock/summary/recovery anchor 로드
- `planning`: mission clarification / task compile / contract refinement / scope update
- `scheduling`: ready task 선별, 병렬 윈도우 계산
- `executing`: worktree 내 구현/수정/국소 검토
- `integrating`: serialized integration lane
- `verifying`: gate / readiness / closure packet 완성
- `learning`: retrospective, memory extraction, rules/debt/gap update
- `idle`: active in-flight 작업 없음

## Phase Review Artifacts

### 필수 artifact (없으면 phase 전환 불가)

| 전환 | 필수 artifact |
|---|---|
| `specifying` -> `building` | (phase-review.json 권장, 필수 아님) |
| `building` -> `polishing` | `phase-review.json`, `gap-assessment.json` |
| `polishing` -> `evolving` | `phase-review.json`, `gap-assessment.json` |
| `evolving` -> close/다음 mission | `phase-review.json`, `gap-assessment.json` |

### 권장 artifact (해당 시 작성)
- `debt-register.json`: 기술 부채가 식별된 경우 모든 전환에서 권장
- `rules-update.json`: protocol 규칙 변경이 제안된 경우 작성

### Phase 전환 실패 시
필수 artifact가 누락되었거나 phase exit 조건을 충족하지 못하면 phase 전환이 거부된다. 이 경우:
1. orchestration_authority가 누락 항목을 식별하여 task로 추가하거나 기존 task에 반영한다.
2. 3회 연속 전환 시도 실패 시 decision skill을 호출하여 scope 조정 또는 기준 완화를 논의한다.
3. 전환 시도 실패 이력은 `phase-review.json`에 기록한다.

## Scope In / Scope Out

- `scope_in`: specifying phase에서 약속한 범위
- `scope_out`: 현재까지 실제로 `passed` 된 task들의 결과 요약

phase 종료 시 항상 `scope_in`과 `scope_out`을 비교해야 한다. 이 비교가 **gap assessment**의 입력이다.
