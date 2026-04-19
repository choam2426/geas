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
| implementer self-check | `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json` | `docs/schemas/self-check.schema.json` | doc 03 |
| evidence (implementation) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-implementation.schema.json` | doc 03 |
| evidence (review) | same as above | `docs/schemas/evidence-review.schema.json` | doc 03 |
| evidence (verification) | same as above | `docs/schemas/evidence-verification.schema.json` | doc 03 |
| evidence (challenge) | same as above | `docs/schemas/evidence-challenge.schema.json` | doc 03 |
| evidence (closure) | same as above | `docs/schemas/evidence-closure.schema.json` | doc 03 |
| gate result | `.geas/missions/{mission_id}/tasks/{task_id}/gate-results/{gate_run_id}.json` | `docs/schemas/gate-result.schema.json` | doc 03 |
| task-level deliberation | `.geas/missions/{mission_id}/tasks/{task_id}/deliberations/{deliberation_id}.json` | `docs/schemas/deliberation.schema.json` | doc 03 |
| mission-level deliberation | `.geas/missions/{mission_id}/deliberations/{deliberation_id}.json` | `docs/schemas/deliberation.schema.json` | doc 02 |
| mission final verdict | `.geas/missions/{mission_id}/mission-verdict.json` | `docs/schemas/mission-verdict.schema.json` | doc 02 |
| task record | `.geas/missions/{mission_id}/tasks/{task_id}/record.json` | `docs/schemas/record.schema.json` | doc 03 |
| mission state | `.geas/missions/{mission_id}/mission-state.json` | `docs/schemas/mission-state.schema.json` | doc 05 |
| task state | `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json` | `docs/schemas/task-state.schema.json` | doc 05 |
| recovery packet | `.geas/recovery/*.json` | `docs/schemas/recovery-packet.schema.json` | doc 05 |
| rules update | `.geas/missions/{mission_id}/consolidation/rules-update.json` | `docs/schemas/rules-update.schema.json` | doc 06 |
| rules | `.geas/rules.md` | markdown | doc 06 |
| agent memory | `.geas/memory/agents/{agent}.md` | markdown | doc 06 |
| debt register | `.geas/missions/{mission_id}/consolidation/debt-register.json` | `docs/schemas/debt-register.schema.json` | doc 07 |
| gap assessment | `.geas/missions/{mission_id}/consolidation/gap-assessment.json` | `docs/schemas/gap-assessment.schema.json` | doc 07 |

## Auxiliary Schemas

아래 schema는 현재 core owner 문서를 직접 대표하지는 않지만, runtime이나 enforcement를 보조하는 구조다.

| schema | 역할 |
|---|---|
| `design-brief.schema.json` | 과거 설계 요약용 보조 schema. 현재 mission design markdown을 대체하지 않는다 |
| `lock-manifest.schema.json` | 병렬 조율 구현체가 별도 lock 상태를 serialize할 때 쓰는 보조 schema |
| `health-check.schema.json` | enforcement/observability 계층의 health signal 직렬화 |
| `policy-override.schema.json` | 일시적 rule override 직렬화 |

## Canonical `.geas/` Layout

```text
.geas/
  recovery/
    *.json
  rules.md
  memory/
    agents/{agent}.md
  missions/{mission_id}/
    spec.json
    mission-design.md
    mission-state.json
    mission-verdict.json
    deliberations/
      {deliberation_id}.json
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
      task-state.json
      record.json
      evidence/{agent}.json
      gate-results/
        {gate_run_id}.json
      deliberations/
        {deliberation_id}.json
```

## Drift를 읽는 기본 원칙

| 충돌 | 먼저 신뢰할 것 |
|---|---|
| 문서와 schema 충돌 | 구조는 schema, 의미는 owner 문서 |
| mission state나 task state와 artifact 충돌 | artifact |
| 요약과 canonical artifact 충돌 | canonical artifact |

Artifact가 어디에 있고 어떤 schema를 따르는지 헷갈릴 때는 이 문서로 돌아오고, 왜 필요한지와 무엇을 뜻하는지는 owner 문서로 돌아간다.
