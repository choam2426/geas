# 05. Gate, Vote, and Final Verdict

## Core Separation

- **Evidence Gate**: objective verification
- **Vote Round**: structured disagreement or readiness deliberation
- **Final Verdict**: product closure decision

이 셋은 서로 대체되지 않는다.

## Legacy Geas와의 차이

기존 Geas Evidence Gate는 3-tier 구조(Tier 1: mechanical, Tier 2: semantic+rubric, Tier 3: product judgment)였다. 이 프로토콜에서 변경된 사항:
- **Tier 3 제거**: product judgment는 gate 내부가 아니라 독립된 **Final Verdict** 단계로 분리되었다.
- **Tier 0 추가**: artifact 존재 여부와 state 적합성을 검사하는 Precheck 단계가 추가되었다.
- **보존**: rubric scoring, iterate semantics, phase-level ship 판단은 그대로 유지한다.

## Evidence Gate v2

### Gate Profiles

| gate_profile | Tier 0 | Tier 1 | Tier 2 | 설명 |
|---|---|---|---|---|
| `code_change` | 실행 | 실행 | 실행 | 코드 변경이 포함된 일반 task |
| `artifact_only` | 실행 | 건너뜀 | 실행 (rubric만, build/test 없음) | 문서, 디자인 등 코드 변경 없는 task |
| `closure_ready` | 실행 | 건너뜀 | 간소화 (completeness 확인만) | release, config 등 최종 정리 task |

### Tier 0 — Precheck
- required artifacts 존재 여부
- task state 적합성
- baseline/integration prerequisites
- required reviewer/self-check presence

Tier 0 실패 시:
- 필수 artifact 누락 → gate verdict = `block`. 해당 artifact가 생성될 때까지 gate 재진입 불가. retry_budget을 차감하지 않는다.
- task state가 gate 진입 조건을 만족하지 않음 → gate verdict = `error`. orchestration_authority가 상태를 점검한다.
- baseline 불일치 → gate verdict = `block`. revalidation 수행 후 재진입.

Tier 0가 fail/block/error를 반환하면 Tier 1 이후로 진행하지 않는다.

### Tier 1 — Mechanical
- build/lint/test/typecheck/command execution
- 결과: `pass | fail`

### Tier 2 — Contract + Rubric
- acceptance criteria
- scope 위반 여부
- required checks / demo steps
- known risk 처리 여부: implementation contract의 `known_risks` 각 항목에 대해 mitigated, accepted with rationale, 또는 deferred to debt 중 하나로 처리되었는지 확인
- rubric scoring
- 결과: `pass | fail`

### Gate Verdict
- `pass`
- `fail`
- `block`
- `error` — gate 자체 실행 실패 (build system 미가용, timeout 등)

`iterate`는 gate 결과가 아니라 final verdict에서 사용한다.

### `fail`과 `block`의 차이

- `fail`: 구현 품질 문제. verify-fix loop으로 수정 가능. retry_budget을 1 차감한다.
- `block`: 구조적 전제 조건 미충족. 구현 수정으로 해결할 수 없다. retry_budget을 차감하지 않는다. blocking 원인 해소 후 gate 재진입.

`block` 발생 조건:
- Tier 0: 필수 artifact 누락, baseline 불일치
- Tier 2: stub cap 초과, 필수 specialist review 누락

### Gate Error 처리
gate verdict가 `error`이면 retry_budget을 차감하지 않는다. orchestration_authority가 원인을 해소한 후 gate를 재실행한다. 동일 원인으로 3회 연속 `error`이면 task를 `blocked`로 전환하고 원인을 기록한다.

## Rubric Scoring

기본 rubric 차원은 현재 Geas pipeline과 맞춘다.

### Default Dimensions
| dimension | evaluator | default threshold |
|---|---|---:|
| `core_interaction` | `qa_engineer` | 3 |
| `feature_completeness` | `qa_engineer` | 4 |
| `code_quality` | `architecture_authority` | 4 |
| `regression_safety` | `qa_engineer` | 4 |

### UI-sensitive Tasks Add
| dimension | evaluator | default threshold |
|---|---|---:|
| `ux_clarity` | `qa_engineer` or `ui_ux_designer` | 3 |
| `visual_coherence` | `qa_engineer` or `ui_ux_designer` | 3 |

### Scoring Rules
- 점수 범위: 1~5
- 어떤 dimension이든 threshold 미만이면 gate Tier 2 실패
- `blocking_dimensions[]`는 verify-fix-loop와 rewind 이유의 핵심 입력이다

### Low Confidence Threshold Adjustment

worker-self-check.json의 `confidence`는 단일 scalar (1-5)다. 이 값이 <= 2이면 **모든** rubric dimension의 threshold에 +1을 적용한다.

향후 worker-self-check schema가 per-dimension confidence를 지원하면 (`confidence_per_dimension: { dimension: score }`) 해당 dimension에만 +1을 적용한다. 현재는 scalar 기준으로 전체 적용한다.

예시: worker-self-check.json의 `confidence`가 2이면 모든 dimension의 threshold가 +1 상향된다 (`core_interaction` 3→4, `feature_completeness` 4→5, 등).

### Stub Check
`possible_stubs[]`가 비어 있지 않으면 gate는 해당 위치를 우선 검증한다. confirmed stub가 있으면 `feature_completeness`는 최대 2로 cap된다. confirmed stub 수가 stub cap을 초과하면 gate는 즉시 `block`을 반환한다.

stub cap 기본값 (risk_level별):

| risk_level | stub cap |
|---|---:|
| `low` | 3 |
| `normal` | 2 |
| `high` | 0 |
| `critical` | 0 |

## Worker Self-Check Consumption

`worker-self-check.json`은 아래처럼 gate에 영향을 준다.
- `known_risks[]` → contract review 우선순위
- `untested_paths[]` → QA 우선순위
- `possible_stubs[]` → stub cap
- `confidence` → threshold adjustment
- `what_to_test_next[]` → QA test plan seed

## Vote Rounds

### vote_round_policy 적용 규칙
- `never`: vote round를 실행하지 않는다. readiness_round trigger 조건이 충족되어도 건너뛴다.
- `auto`: 아래 readiness_round trigger 조건 중 하나라도 충족되면 자동으로 readiness_round를 실행한다. 충족되지 않으면 건너뛴다.
- `always`: trigger 조건과 관계없이 반드시 readiness_round를 실행한다.

`never`로 설정된 task에서 readiness_round trigger 조건이 발생하면, orchestration_authority가 이를 기록하되 round는 실행하지 않는다. 단, specialist review conflict (doc 01 Specialist Conflict Resolution)은 vote_round_policy와 관계없이 항상 vote round를 호출한다.

### `proposal_round`
언제 쓰나:
- specifying phase에서 cross-cutting proposal
- building phase 도중 major design/API boundary decision

quorum 요건: proposer + reviewer 최소 2명 이상이 참여해야 한다.

vote enum:
- `agree`
- `disagree`

quorum 미달 시: vote round는 `inconclusive`로 기록하고, orchestration_authority가 추가 참여자를 배정하여 재시도한다. 2회 연속 quorum 미달이면 task를 `escalated`로 전환한다.

### `readiness_round`
언제 쓰나:
- `risk_level = high` 또는 `critical`
- `open_risks.status = present`
- out-of-scope change 존재
- specialist review가 엇갈림
- retry 이후 재제출
- product_authority 또는 orchestration_authority 요청

quorum 요건: 최소 `orchestration_authority` + `product_authority` + specialist 1명 이상이 참여해야 한다.

vote enum:
- `ship`
- `iterate`
- `escalate`

quorum 미달 시: proposal_round과 동일한 규칙을 적용한다 (2회 연속 quorum 미달 시 `escalated` 전환).

## Closure Packet

필수 필드:
- `task_summary`
- `change_summary`
- `specialist_reviews[]`
- `integration_result`
- `verification_result`
- `worker_self_check`
- `open_risks`
- `debt_snapshot`
- `readiness_round` (없으면 `null`)

### `specialist_reviews[]`
각 review는 아래를 최소로 가진다.
- `reviewer_type`
- `status = approved | changes_requested | blocked`
- `summary`
- `blocking_concerns[]`
- `rubric_scores[]` (optional but recommended)

### `open_risks`
구조형으로 강제한다.
- `status = none | present`
- `items[]`

### `debt_snapshot`
- `status = none | present`
- `items[]`

## Critical Reviewer Pre-ship Challenge

gate 통과 후, closure packet 조립 후, final verdict 전에 `critical_reviewer`가 pre-ship challenge를 수행한다.

### 목적
- gate가 놓칠 수 있는 구조적 위험, 숨은 가정, 과도한 복잡성을 표면화한다
- final verdict에 들어가는 closure packet의 품질을 높인다

### 규칙
- `risk_level`이 `high` 또는 `critical`이면 필수, 그 외에는 `orchestration_authority` 판단
- `critical_reviewer`는 최소 1개의 concern을 제기해야 한다 (substantive challenge 의무)
- concern이 blocking이면 closure packet에 `open_risks`로 추가하고 readiness_round trigger
- concern이 non-blocking이면 closure packet의 notes에 기록
- challenge 결과는 `challenge-review.json`으로 기록

### Readiness Round과 Blocking Concern의 관계

`critical_reviewer`의 blocking concern이 readiness_round를 trigger한 경우:
- readiness_round 결과가 `ship`이면, 해당 blocking concern은 **acknowledged risk**로 전환된다. specialist-review의 `blocking_concerns[]`에서 해당 항목의 `resolved`를 `true`로 변경하고, `resolution = "accepted_via_readiness_round"`를 기록한다. 이로써 closure packet 완전성 조건이 충족된다.
- readiness_round 결과가 `iterate`이면, rewind하여 concern을 해소한다.
- readiness_round 결과가 `escalate`이면, task를 `escalated`로 전환한다.

### 흐름
```
Evidence Gate pass → Closure Packet assembly → Critical Reviewer Challenge → Final Verdict
```

## Final Verdict

`product_authority`는 기본적으로 **task definition + closure packet**을 보고 판단한다.

allowed verdicts:
- `pass`
- `iterate`
- `escalate`

의미:
- `pass` → `passed`
- `iterate` → rewind target 명시
- `escalate` → 상위 의사결정 필요

Final Verdict `iterate`는 retry_budget과 독립적이다. `iterate`는 gate fail이 아니라 product 판단이므로 retry_budget을 차감하지 않는다. 단, `iterate`에도 반복 제한이 있다: 동일 task에 대해 `iterate`가 3회 누적되면 `escalated`로 전환한다.

packet이 불완전하면 `pass` 금지다. packet이 "완전(complete)"하려면 아래를 모두 충족해야 한다:
- 모든 필수 필드(`task_summary`, `change_summary`, `specialist_reviews[]`, `integration_result`, `verification_result`, `worker_self_check`, `open_risks`, `debt_snapshot`)가 채워져 있을 것
- required reviewer set에 해당하는 모든 specialist review가 `specialist_reviews[]`에 포함되어 있을 것
- gate result(`verification_result`)가 존재할 것
- `blocking_concerns[]`에 미해결 항목이 없을 것(`status = blocked`인 specialist review가 없을 것)

## Gap Assessment Linkage

phase-level 또는 mission-level 종료 판단에서는 task closure만으로 충분하지 않다. `product_authority`는 필요 시 아래를 함께 본다.
- current `scope_in`
- delivered `scope_out`
- `gap-assessment.json`
- current debt snapshot
- unresolved product risks

즉, **task는 닫혀도 phase는 아직 안 닫힐 수 있다.**
