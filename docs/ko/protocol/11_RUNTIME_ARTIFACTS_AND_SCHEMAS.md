# 11. Runtime Artifacts and Schemas

## 목적

이 문서는 canonical runtime artifact와 memory artifact의 계약을 요약한다. 상세 필드 정의는 `schemas/`를 본다.

## Core Runtime Artifacts

- `run.json`
- `task.json`
- `implementation-contract.json`
- `worker-self-check.json`
- `specialist-review.json`
- `integration-result.json`
- `gate-result.json`
- `readiness-round.json`
- `closure-packet.json`
- `final-verdict.json`
- `failure-record.json`
- `revalidation-record.json`
- `recovery-packet.json`
- `retrospective.json`
- `rules-update.json`
- `debt-register.json`
- `gap-assessment.json`
- `phase-review.json`

## Memory Artifacts

- `memory-candidate.json`
- `memory-entry.json`
- `memory-review.json`
- `memory-application-log.json`
- `memory-packet.json`
- `memory-index.json`

## Evolution Artifact 저장 경로

| Artifact | 저장 경로 | 범위 |
|---|---|---|
| `retrospective.json` | `.geas/tasks/{task_id}/retrospective.json` | task별 |
| `rules-update.json` | `.geas/evolution/rules-update-{sequence}.json` | mission별 |
| `debt-register.json` | `.geas/evolution/debt-register.json` | mission별 (단일 파일, 항목 누적) |
| `gap-assessment.json` | `.geas/evolution/gap-assessment-{phase_transition}.json` | phase 전이별 |
| `phase-review.json` | `.geas/evolution/phase-review-{phase_transition}.json` | phase 전이별 |
| `mission-summary.md` | `.geas/summaries/mission-summary.md` | mission별 |
| `session-latest.md` | `.geas/summaries/session-latest.md` | session별 (덮어쓰기) |
| `task-focus/{id}.md` | `.geas/summaries/task-focus/{task_id}.md` | task별 |

## Artifact Purpose Highlights

### `worker-self-check.json`
worker가 known risks, untested paths, possible stubs, confidence를 남기는 자기 평가 artifact

### `retrospective.json`
per-task learning loop의 입력. process_lead가 작성

### `rules-update.json`
승인된 규칙 변경을 durable behavior surface에 반영한 기록

### `debt-register.json`
mission/phase 수준의 debt rollup artifact

### `gap-assessment.json`
`scope_in` 대비 실제 `scope_out`의 차이를 평가한 artifact

### `phase-review.json`
mission phase transition 전/후 상태를 요약한 artifact

## Canonical Fields to Notice

### 모든 artifact의 공통 메타
- `version`
- `artifact_type`
- `artifact_id`
- `producer_type`
- `created_at`
- `updated_at`

### worker self-check의 핵심
- `known_risks`
- `untested_paths`
- `possible_stubs`
- `what_to_test_next`
- `confidence`

### debt register의 핵심
- `items[]`
- `rollup_by_severity`
- `rollup_by_kind`
- `phase_targeting` — debt를 어느 mission phase에서 해소할지 지정하는 필드. `"polish"`: cosmetic/quality debt, `"evolution"`: architectural debt, `"future"`: 현재 mission scope 밖이지만 추적은 필요한 debt

### gap assessment의 핵심
- `scope_in_summary`
- `scope_out_summary`
- `fully_delivered`
- `partially_delivered`
- `not_delivered`
- `intentional_cuts`
- `unexpected_additions`

### memory entry의 핵심
- `memory_type`
- `state`
- `scope`
- `summary`
- `evidence_refs`
- `confidence`
- `support_count`
- `successful_reuses`
- `failed_reuses`
- `contradiction_count`
- `review_after` — ISO 8601 날짜. 이 날짜 이후 memory entry의 지속적 유효성을 재평가해야 한다. reviewer가 promotion 시점에 설정한다. 기본값: `provisional` memory는 promotion 날짜 + 90일, `stable` memory는 promotion 날짜 + 180일
- `supersedes`
- `superseded_by`

## Contract Philosophy

- prose 문서는 의미를 정의한다.
- schema는 형식과 enum을 강제한다.
- hook는 존재 여부와 invariant를 집행한다.

세 층이 서로 역할을 침범하면 drift가 생긴다. drift가 감지되면 해당 artifact의 생성/소비를 block하고 수정해야 한다. drift의 구체적 사례:

1. **schema-artifact drift**: schema에 required field가 추가됐으나, `.geas/` 내 기존 artifact에 해당 필드가 없는 경우
2. **hook-protocol drift**: hook가 특정 artifact의 존재를 검사하지만, protocol 변경으로 해당 artifact를 더 이상 생성하지 않는 경우
3. **doc-schema version drift**: prose 문서가 참조하는 schema version이 실제 배포된 schema version과 일치하지 않는 경우

drift 감지 시 canonical split docs의 정의가 우선한다(doc 13 Migration Rule 참조).

## Artifact Validation Failure Modes

### required field 누락

schema에 `required`로 정의된 field가 artifact에 없는 경우:
1. validator가 해당 artifact를 **reject**한다.
2. artifact를 생성한 producer agent에게 누락 필드 목록과 함께 재생성을 요청한다.
3. 재생성 2회 실패 시 `orchestration_authority`에게 escalation한다.

### artifact_type 불일치

artifact의 `artifact_type` 필드가 파일명이나 사용 context와 일치하지 않는 경우:
1. validator가 경고를 기록한다.
2. 해당 artifact를 소비하는 다음 단계를 block한다.
3. producer agent가 artifact_type을 수정하거나 새 artifact를 생성한다.

### 공통 메타의 version 비호환

artifact의 `version` 필드가 현재 schema version과 호환되지 않는 경우:
1. 하위 호환 가능한 범위(`major` version 동일)면 경고만 기록하고 진행한다.
2. 하위 호환 불가능하면 artifact를 reject하고, doc 13의 migration 절차에 따라 변환한다.
