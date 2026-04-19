# 08. Runtime Artifacts and Schemas

> Geas의 artifact, 정규 경로, 정규 스키마, owner 문서를 연결한다. 의미와 판단 규칙은 각 owner 문서가 관리하고, 이 문서는 연결만 맡는다.

## 목적

프로토콜 문서는 의미를 설명하고, schema는 구조를 정의한다. 이 문서는 둘 사이의 브리지다.

artifact를 읽을 때는 다음 순서를 따른다.

1. owner 문서에서 의미와 책임을 읽는다.
2. 이 문서에서 정규 경로와 정규 schema를 찾는다.
3. schema에서 정확한 필드와 enum을 확인한다.

schema 경로는 모두 `docs/schemas/` 아래에 있으므로 아래 표에는 파일명만 적는다.

## Core Artifact Registry

### Mission-level

| 개념 | 정규 경로 | schema | owner |
|---|---|---|---|
| mission spec | `.geas/missions/{mission_id}/spec.json` | `mission-spec.schema.json` | doc 02 |
| mission design | `.geas/missions/{mission_id}/mission-design.md` | markdown | doc 02 |
| mission-level deliberation | `.geas/missions/{mission_id}/deliberations/{deliberation_id}.json` | `deliberation.schema.json` | doc 02 |
| phase review | `.geas/missions/{mission_id}/phase-reviews/*.json` | `phase-review.schema.json` | doc 02 |
| mission state | `.geas/missions/{mission_id}/mission-state.json` | `mission-state.schema.json` | doc 05 |
| memory update | `.geas/missions/{mission_id}/consolidation/memory-update.json` | `memory-update.schema.json` | doc 06 |
| debts | `.geas/missions/{mission_id}/consolidation/debts.json` | `debts.schema.json` | doc 07 |
| gap | `.geas/missions/{mission_id}/consolidation/gap.json` | `gap.schema.json` | doc 07 |
| mission final verdict | `.geas/missions/{mission_id}/mission-verdict.json` | `mission-verdict.schema.json` | doc 02 |

### Task-level

| 개념 | 정규 경로 | schema | owner |
|---|---|---|---|
| task contract | `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` | `task-contract.schema.json` | doc 03 |
| implementation contract | `.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json` | `implementation-contract.schema.json` | doc 03 |
| implementer self-check | `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json` | `self-check.schema.json` | doc 03 |
| task-level deliberation | `.geas/missions/{mission_id}/tasks/{task_id}/deliberations/{deliberation_id}.json` | `deliberation.schema.json` | doc 03 |
| evidence | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `evidence-{implementation,review,verification,challenge,closure}.schema.json` (파일의 `evidence_kind`로 판별) | doc 03 |
| gate result | `.geas/missions/{mission_id}/tasks/{task_id}/gate-results/{gate_run_id}.json` | `gate-result.schema.json` | doc 03 |
| task state | `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json` | `task-state.schema.json` | doc 05 |
| task record | `.geas/missions/{mission_id}/tasks/{task_id}/record.json` | `record.schema.json` | doc 03 |

### Memory

| 개념 | 정규 경로 | schema | owner |
|---|---|---|---|
| shared memory | `.geas/memory/shared.md` | markdown | doc 06 |
| agent memory | `.geas/memory/agents/{agent}.md` | markdown | doc 06 |

## Drift를 읽는 기본 원칙

| 충돌 | 먼저 신뢰할 것 |
|---|---|
| 문서와 schema 충돌 | 구조는 schema, 의미는 owner 문서 |
| mission state나 task state와 artifact 충돌 | artifact |
| 요약과 canonical artifact 충돌 | canonical artifact |

Artifact가 어디에 있고 어떤 schema를 따르는지 헷갈릴 때는 이 문서로 돌아오고, 왜 필요한지와 무엇을 뜻하는지는 owner 문서로 돌아간다.
