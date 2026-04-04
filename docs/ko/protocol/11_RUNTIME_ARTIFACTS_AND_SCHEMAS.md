# 11. Runtime Artifacts and Schemas

## 목적

이 문서는 canonical runtime artifact와 memory artifact의 계약을 요약한다. 상세 필드 정의는 `schemas/`를 본다.

## Core Runtime Artifacts

### 파이프라인 Artifact (작업별)

| Artifact | Schema | 저장 경로 | 생산자 |
|----------|--------|----------|--------|
| `task-contract.json` | `task-contract.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}.json` | task_compiler |
| `implementation-contract.json` | `implementation-contract.schema.json` | `.geas/missions/{mission_id}/contracts/{task_id}.json` | primary worker |
| `worker-self-check.json` | `worker-self-check.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/worker-self-check.json` | primary worker |
| `specialist-review.json` | `specialist-review.schema.json` | `.geas/missions/{mission_id}/evidence/{task_id}/{agent-type}[-review].json` | specialist agents |
| `integration-result.json` | `integration-result.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/integration-result.json` | orchestration_authority |
| `gate-result.json` | `gate-result.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/gate-result.json` | orchestration_authority |
| `closure-packet.json` | `closure-packet.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/closure-packet.json` | orchestration_authority |
| `challenge-review.json` | `challenge-review.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/challenge-review.json` | critical_reviewer |
| `final-verdict.json` | `final-verdict.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/final-verdict.json` | product_authority |
| `vote-round.json` | `vote-round.schema.json` | `.geas/missions/{mission_id}/decisions/{dec_id}.json` | orchestration_authority |
| `failure-record.json` | `failure-record.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/failure-record-{seq}.json` | orchestration_authority |
| `retrospective.json` | `retrospective.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/retrospective.json` | process_lead |

### 세션 & 오케스트레이션 Artifact

| Artifact | Schema | 저장 경로 | 생산자 |
|----------|--------|----------|--------|
| `run-state.json` | `run-state.schema.json` | `.geas/state/run.json` | orchestration_authority |
| `lock-manifest.json` | `lock-manifest.schema.json` | `.geas/state/locks.json` | orchestration_authority |
| `health-check.json` | `health-check.schema.json` | `.geas/state/health-check.json` | orchestration_authority |
| `revalidation-record.json` | `revalidation-record.schema.json` | `.geas/missions/{mission_id}/tasks/{task_id}/revalidation-record.json` | orchestration_authority |
| `recovery-packet.json` | `recovery-packet.schema.json` | `.geas/recovery/recovery-{id}.json` | orchestration_authority |

### Evolution Artifact

| Artifact | Schema | 저장 경로 | 범위 |
|----------|--------|----------|------|
| `rules-update.json` | `rules-update.schema.json` | `.geas/missions/{mission_id}/evolution/rules-update-{seq}.json` | mission별 |
| `debt-register.json` | `debt-register.schema.json` | `.geas/missions/{mission_id}/evolution/debt-register.json` | mission별 (항목 누적) |
| `gap-assessment.json` | `gap-assessment.schema.json` | `.geas/missions/{mission_id}/evolution/gap-assessment-{transition}.json` | phase 전이별 |
| `phase-review.json` | `phase-review.schema.json` | `.geas/missions/{mission_id}/phase-reviews/{transition}.json` | phase 전이별 |
| `policy-override.json` | `policy-override.schema.json` | `.geas/state/policy-overrides.json` | 프로젝트별 |

### Memory Artifact

| Artifact | Schema | 저장 경로 | 생산자 |
|----------|--------|----------|--------|
| `memory-candidate.json` | `memory-candidate.schema.json` | `.geas/memory/candidates/{memory_id}.json` | orchestration_authority |
| `memory-entry.json` | `memory-entry.schema.json` | `.geas/memory/entries/{memory_id}.json` | orchestration_authority |
| `memory-review.json` | `memory-review.schema.json` | `.geas/memory/candidates/{memory_id}-review.json` | domain authority |
| `memory-application-log.json` | `memory-application-log.schema.json` | `.geas/memory/logs/{task_id}-{memory_id}.json` | orchestration_authority |
| `memory-packet.json` | `memory-packet.schema.json` | `.geas/missions/{mission_id}/packets/{task_id}/memory-packet.json` | orchestration_authority |
| `memory-index.json` | `memory-index.schema.json` | `.geas/state/memory-index.json` | orchestration_authority |

### 사람이 읽는 요약 (스키마 없음 — 마크다운)

| 파일 | 저장 경로 | 범위 |
|------|----------|------|
| `session-latest.md` | `.geas/state/session-latest.md` | session별 (compact 시 덮어쓰기) |
| `task-focus/{id}.md` | `.geas/state/task-focus/{task_id}.md` | task별 |
| `mission-summary.md` | `.geas/missions/{mission_id}/mission-summary.md` | mission별 |
| `run-summary-{ts}.md` | `.geas/summaries/run-summary-{timestamp}.md` | session별 |

## Schema Inventory

28개 JSON Schema + 1개 공유 정의 파일 (`_defs.schema.json`) = 총 29개 파일 (`schemas/`).

## Artifact Purpose Highlights

### `worker-self-check.json`
worker가 known risks, untested paths, possible stubs, confidence를 남기는 자기 평가 artifact.

### `challenge-review.json`
Critical reviewer의 pre-ship challenge. high/critical risk 작업에서 필수. reviewer는 최소 1개의 실질적 우려를 제기해야 한다 (protocol doc 05: substantive challenge obligation).

### `vote-round.json`
구조화된 투표 결과 — `proposal_round` (agree/disagree) 또는 `readiness_round` (ship/iterate/escalate). 이전의 별도 readiness-round artifact를 대체.

### `failure-record.json`
작업 실패와 되감기를 기록. 실패는 상태가 아님 — 작업이 rewind target으로 돌아감. retry_budget before/after를 추적.

### `health-check.json`
protocol doc 12의 8개 건강 신호. 각각 value, threshold, triggered 플래그를 가짐. phase 전이, 세션 시작, evolving phase 진입 시 계산.

### `policy-override.json`
rules.md 임시 오버라이드의 machine-readable 레지스트리. 항목은 삭제하지 않음 — 만료된 항목은 `expired: true`로 표시하여 감사 추적 유지.

### `retrospective.json`
per-task learning loop의 입력. process_lead가 작성.

### `rules-update.json`
승인된 규칙 변경을 durable behavior surface에 반영한 기록.

### `debt-register.json`
mission/phase 수준의 debt rollup artifact.

### `gap-assessment.json`
`scope_in` 대비 실제 `scope_out`의 차이를 평가한 artifact.

### `phase-review.json`
mission phase transition 전/후 상태를 요약한 artifact.

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
- `phase_targeting` — debt를 어느 mission phase에서 해소할지 지정하는 필드. `"polishing"`: cosmetic/quality debt, `"evolving"`: architectural debt, `"future"`: 현재 mission scope 밖이지만 추적은 필요한 debt

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

drift 감지 시 canonical protocol schema 정의가 우선한다. drift된 artifact를 스키마에 맞게 갱신한다.

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
2. 하위 호환 불가능하면 artifact를 reject하고, 생산자가 현재 스키마에 맞게 재생성하도록 요구한다.
