# 08. Runtime Artifacts and Schemas

> GEAS의 artifact, 정규 경로, 정규 스키마, owner 문서를 연결한다. 의미와 판단 규칙은 각 owner 문서가 관리하고, 이 문서는 연결만 맡는다.

## 이 문서의 역할

프로토콜 문서는 의미를 설명하고, schema는 구조를 정의한다. 이 문서는 둘 사이의 브리지다.

artifact를 읽을 때는 다음 순서를 따른다.

1. owner 문서에서 의미와 책임을 읽는다.
2. 이 문서에서 정규 경로와 정규 schema를 찾는다.
3. schema에서 exact field와 enum을 확인한다.

## Core Artifact Registry

| 개념 | 정규 경로 | schema / 형식 | owner |
|---|---|---|---|
| mission spec | `.geas/missions/{mission_id}/spec.json` | `docs/schemas/mission-spec.schema.json` | doc 02 |
| mission design | `.geas/missions/{mission_id}/mission-design.md` | markdown | doc 02 |
| phase review | `.geas/missions/{mission_id}/phase-reviews/*.json` | `docs/schemas/phase-review.schema.json` | doc 02 |
| task contract | `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` | `docs/schemas/task-contract.schema.json` | doc 03 |
| implementation contract | `.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json` | `docs/schemas/implementation-contract.schema.json` | doc 03 |
| worker self-check | `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json` | `docs/schemas/self-check.schema.json` | doc 03 |
| evidence (dispatch) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence.schema.json` | doc 03 |
| evidence (implementation) | same as above | `docs/schemas/evidence-implementation.schema.json` | doc 03 |
| evidence (review) | same as above | `docs/schemas/evidence-review.schema.json` | doc 03 |
| evidence (verification) | same as above | `docs/schemas/evidence-verification.schema.json` | doc 03 |
| evidence (challenge) | same as above | `docs/schemas/evidence-challenge.schema.json` | doc 03 |
| evidence (decision) | same as above | `docs/schemas/evidence-decision.schema.json` | doc 03 |
| task record | `.geas/missions/{mission_id}/tasks/{task_id}/record.json` | `docs/schemas/record.schema.json` | doc 03 |
| run state | `.geas/state/run-state.json` | `docs/schemas/run-state.schema.json` | doc 05 |
| recovery packet | `.geas/recovery/*.json` | `docs/schemas/recovery-packet.schema.json` | doc 05 |
| rules update | `.geas/missions/{mission_id}/consolidation/rules-update.json` | `docs/schemas/rules-update.schema.json` | doc 06 |
| rules | `.geas/rules.md` | markdown | doc 06 |
| agent memory | `.geas/memory/agents/{agent}.md` | markdown | doc 06 |
| debt register | `.geas/missions/{mission_id}/consolidation/debt-register.json` | `docs/schemas/debt-register.schema.json` | doc 07 |
| gap assessment | `.geas/missions/{mission_id}/consolidation/gap-assessment.json` | `docs/schemas/gap-assessment.schema.json` | doc 07 |

## Current Mixed-storage or Unschematized Artifacts

이번 라운드에서 standalone schema나 canonical file shape를 새로 만들지 않은 항목은 다음처럼 읽는다.

| 개념 | 현재 상태 | owner |
|---|---|---|
| task-level deliberation | `.geas/missions/{mission_id}/decisions/*.json`에 저장하며 현재 schema 파일명은 `vote-round.schema.json`이다 | doc 03 |
| closure packet | standalone schema 없음. 현재는 `record.json.closure`와 관련 evidence 묶음으로 읽는다 | doc 03 |
| mission final verdict | standalone schema와 canonical path를 이번 라운드에서 고정하지 않는다 | doc 02 |

`vote-round.schema.json`은 현재 파일명만 유지하는 legacy 이름이다. 의미 owner는 deliberation을 다루는 문서 쪽이다.

## Auxiliary Schemas

아래 schema는 현재 core owner 문서를 직접 대표하지는 않지만, runtime이나 enforcement를 보조하는 구조다.

| schema | 역할 |
|---|---|
| `_defs.schema.json` | slot enum, timestamp, 공통 정의 |
| `design-brief.schema.json` | 과거 설계 요약용 보조 schema. 현재 mission design markdown을 대체하지 않는다 |
| `lock-manifest.schema.json` | 병렬 조율 구현체가 별도 lock 상태를 serialize할 때 쓰는 보조 schema |
| `health-check.schema.json` | enforcement/observability 계층의 health signal 직렬화 |
| `policy-override.schema.json` | 일시적 rule override 직렬화 |

## Canonical `.geas/` Layout

```text
.geas/
  state/
    run-state.json
  recovery/
    *.json
  rules.md
  memory/
    agents/{agent}.md
  missions/{mission_id}/
    spec.json
    mission-design.md
    decisions/
      *.json
    phase-reviews/
      *.json
    consolidation/
      rules-update.json
      debt-register.json
      gap-assessment.json
    tasks/{task_id}/
      contract.json
      implementation-contract.json
      self-check.json
      record.json
      evidence/{agent}.json
```

## Drift를 읽는 기본 원칙

| 충돌 | 먼저 신뢰할 것 |
|---|---|
| 문서와 schema 충돌 | 구조는 schema, 의미는 owner 문서 |
| run state와 artifact 충돌 | artifact |
| 요약과 canonical artifact 충돌 | canonical artifact |

Artifact가 어디에 있고 어떤 schema를 따르는지 헷갈릴 때는 이 문서로 돌아오고, 왜 필요한지와 무엇을 뜻하는지는 owner 문서로 돌아간다.
