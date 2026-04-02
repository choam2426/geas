# 01. Agent Types and Authority

## 목적

프로토콜은 고유 이름이 아니라 **type**로 정의한다. type는 역할, 결정권, 금지사항, 산출물 책임을 뜻한다.

## Core Authorities

### `orchestration_authority`
책임:
- mission 해석
- phase 선택
- task 분해와 우선순위 조정
- specialist 배정
- closure packet 조립
- recovery / context assembly / memory retrieval 오케스트레이션

결정권:
- task scheduling
- concurrency budget 사용
- stale/revalidation 요청
- vote round 호출

금지:
- product final verdict 직접 발행 금지
- specialist review를 생략한 채 closure packet 조작 금지

### `product_authority`
책임:
- specifying phase에서 방향과 우선순위 판단
- building phase 끝에서 final verdict (`pass | iterate | escalate`) 결정
- disagreement가 남을 때 제품 관점의 trade-off 판단

금지:
- raw implementation을 직접 대신 작성하는 primary worker 역할 금지
- 필수 evidence 누락 상태의 task를 pass 처리 금지

## Specialist Types

### `architecture_authority`
- 시스템 경계, contract, dependency, long-term maintainability 검토

### `frontend_engineer`
- UI/브라우저 상호작용 구현

### `backend_engineer`
- API, service, persistence, domain logic 구현

### `ui_ux_designer`
- interaction model, visual intent, user-flow, copy intent 점검

### `qa_engineer`
- acceptance criteria, demo path, test readiness, failure path 점검

### `security_engineer`
- auth, secret handling, permission boundary, abuse path 검토

### `devops_engineer`
- runtime/service/deploy/env/bootstrap 관련 점검

### `technical_writer`
- docs-first task, docs-impact review, migration note, operator guidance

### `critical_reviewer`
- 반대 시각, 약한 가정, 불충분한 evidence, ship risk를 공격적으로 탐지
- `risk_level`이 `high` 또는 `critical`인 task에는 반드시 required_reviewer_types에 포함되어야 한다 (Step 2에서 자동 추가됨)
- pre-ship challenge: closure packet 완성 전에 "ship하면 안 되는 이유"를 최소 1건 이상 제시해야 하며, 해당 우려가 해소되었음을 evidence로 남겨야 한다

### `repository_manager`
- integration hygiene, commit structure, release hygiene, repo cleanliness 보조

### `process_lead`
- retrospective, memory promotion hygiene, protocol drift 개선
- phase 종료 시 retrospective 수집을 주도하고, 반복 패턴을 식별하여 rules.md 승격 후보를 제안한다
- memory promotion 시 endorsing authority의 승인을 확보하고, promotion 이력을 `memory-review.json`에 기록한다
- protocol drift 감지 시 deviation report를 작성하여 orchestration_authority에게 전달한다

## Decision Boundary

| decision | primary owner | note |
|---|---|---|
| phase selection | orchestration_authority | mission signal 기반 |
| task routing | orchestration_authority | specialist required set 도출 |
| implementation approach | primary specialist + architecture_authority | contract review 필요 |
| evidence gate result | gate runner / verifier | objective verdict |
| readiness round result | reviewers set | deliberative |
| final closure | product_authority | task only |
| durable memory promotion | process_lead + endorsing authority | type별 승인자 필요 |

## Required Reviewer Routing Algorithm

task의 `required_reviewer_types[]`는 아래 알고리즘으로 결정한다. 각 단계는 누적이다 (이전 단계에서 추가된 reviewer는 유지).

### Step 1 — task_kind 기반 기본 reviewer

| task_kind | 기본 required reviewer |
|---|---|
| `code` | `architecture_authority` |
| `docs` | `technical_writer` |
| `config` | `devops_engineer` |
| `design` | `ui_ux_designer` |
| `audit` | `security_engineer` |
| `release` | `devops_engineer`, `repository_manager` |

### Step 2 — risk_level 기반 추가

| risk_level | 추가 reviewer |
|---|---|
| `low` | (추가 없음) |
| `normal` | (추가 없음) |
| `high` | `critical_reviewer`, `security_engineer` |
| `critical` | `critical_reviewer`, `security_engineer`, `qa_engineer` |

### Step 3 — scope.paths surface signal 기반 추가

아래 조건에 해당하는 파일이 `scope.paths`에 포함되면 해당 reviewer를 추가한다.

| 조건 | 추가 reviewer |
|---|---|
| UI/프론트엔드 파일 (예: `*.tsx`, `*.vue`, `*.css`, `components/`, `pages/`) | `ui_ux_designer`, `frontend_engineer` |
| API/서버 파일 (예: `routes/`, `api/`, `controllers/`, `services/`) | `backend_engineer` |
| 인프라/배포 파일 (예: `Dockerfile`, `*.yaml` in infra/, CI config) | `devops_engineer` |
| 인증/권한 파일 (예: `auth/`, `permissions/`, `*.policy`) | `security_engineer` |
| 테스트 파일 (예: `*.test.*`, `*.spec.*`, `__tests__/`) | `qa_engineer` |

### Step 4 — gate_profile 기반 조정

| gate_profile | 조건 |
|---|---|
| `closure_ready` | `qa_engineer` 필수 추가 |
| `artifact_only` | code reviewer (architecture_authority, frontend/backend_engineer) 제외 가능 |

### Step 5 — 중복 제거 및 최소 보장

최종 `required_reviewer_types[]`에서 중복을 제거한다. primary_worker_type과 동일한 type이 포함되어 있으면 해당 항목은 유지한다 (자기 검토는 별도의 reviewer가 담당해야 하므로 같은 type의 다른 인스턴스가 필요하다는 의미가 아니라, 해당 type의 전문성이 리뷰에 필요하다는 의미이다).

### Step 6 — 빈 배열 방지

Step 1~5를 거친 후 `required_reviewer_types[]`가 빈 배열이면 `architecture_authority`를 기본 reviewer로 추가한다. 모든 task는 최소 1명의 reviewer를 가져야 한다.

## Specialist Conflict Resolution

두 명 이상의 specialist가 상반된 판단을 내릴 때 (예: architecture_authority가 "리팩토링 필요"를 주장하고 product_authority가 "즉시 ship" 주장) 아래 절차를 따른다.

1. **충돌 감지**: 동일 task에 대해 specialist-review 결과가 `pass`와 `block` (또는 상호 모순되는 조건부 pass)으로 나뉘면 충돌로 간주한다.
2. **vote round 호출**: orchestration_authority가 `vote_round`를 호출한다. 참가자는 충돌 당사자 + 해당 task의 나머지 required_reviewer_types이다.
3. **vote round 결과 적용**:
   - 합의(`consensus`) 도달 시: 합의 결과에 따른다.
   - 과반(`majority`) 도달 시: 과반 의견을 채택하되, 소수 의견을 `decision-record`에 기록한다.
   - 합의 실패 시: product_authority가 제품 관점 trade-off를 판단하여 최종 결정하고, 결정 근거를 `decision-record`에 기록한다.
4. **escalation**: product_authority 판단에도 해결 불가한 구조적 충돌은 task를 `escalated` 상태로 전환하고 human stakeholder에게 전달한다.

## Single-Agent Session

단일 agent만 가용한 세션에서는 해당 agent가 여러 type의 역할을 순차적으로 수행한다. 이 경우에도 아래 규칙은 유지된다:
- `orchestration_authority`와 `product_authority`는 동일 agent가 수행할 수 있으나, final verdict 발행 시 product_authority 역할로 명시적 전환을 기록해야 한다.
- required_reviewer_types에 해당하는 specialist review artifact는 각 type별로 별도 생성해야 한다.
- specialist conflict resolution에서 vote round의 quorum 미달이 불가피하므로, 2회 연속 quorum 미달 시 바로 product_authority 판단으로 전환한다.

### Single-Agent Specialist Conflict Safeguard

단일 에이전트 세션에서 specialist conflict가 발생하면 (동일 agent가 양측 역할을 모두 수행하므로 자기 판정 편향이 존재한다), 아래 구조적 safeguard를 적용한다:

1. **기록 의무**: 해당 conflict를 `decision-record.json`에 기록한다. 양측 입장(어떤 type 역할에서 어떤 판단을 내렸는지), 각 입장의 근거, 그리고 최종 선택한 판정을 명시한다.
2. **high risk 이상 escalation**: conflict가 `risk_level = high` 또는 `critical`인 task에서 발생하면, 판정을 `escalated`로 전환하고 human stakeholder 개입을 요청한다. 단일 agent의 자기 판정으로는 high risk 이상의 conflict를 해소할 수 없다.
3. **low/normal risk 자기 판정**: conflict가 `risk_level = low` 또는 `normal`인 task에서 발생하면, 단일 에이전트가 판정할 수 있다. 단, retrospective에서 `what_was_surprising[]`에 해당 conflict를 반드시 기록하여 향후 검토 대상으로 남긴다.

## Type Naming Rules for Artifacts

artifact는 type-neutral name을 사용한다.
예:
- `specialist-review.json`
- `closure-packet.json`
- `final-verdict.json`
- `memory-entry.json`
- `memory-review.json`

고유 이름 기반 파일명은 canonical spec에서 사용하지 않는다.
