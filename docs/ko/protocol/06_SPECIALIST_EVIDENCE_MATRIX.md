# 06. Specialist Evidence Matrix

## 원칙

프로토콜은 “누가 참여해야 한다”에서 끝나지 않는다. **어떤 type의 참여가 어떤 artifact로 남고, closure packet에 어떻게 포함되는지**까지 정의해야 한다.

## 공통 Specialist Review Artifact

모든 specialist review는 아래 공통 형태를 따른다.
- `artifact_type = specialist_review`
- `reviewer_type`
- `review_target`: 검토 대상 식별자 (task_id 또는 artifact path)
- `status`: `approved | changes_requested | blocked` (doc 05 Closure Packet 참조)
- `summary`
- `blocking_concerns[]`: 빈 배열이면 blocking issue 없음. 각 항목은 `{ concern, severity, resolved }` 구조
- `recommended_reentry`: rewind 시 권장 재진입 지점. blocking concern이 없으면 `null`
- `debt_flags[]` (optional): 발견된 기술 부채 항목
- `memory_candidates[]` (optional): evolution pipeline으로 전달할 후보 항목

## Matrix

| reviewer_type | 언제 mandatory | 주요 관심사 | closure inclusion | evolution inclusion |
|---|---|---|---|---|
| architecture_authority | `task_kind=code`이고 `risk_level`이 `normal`, `high`, `critical` 중 하나 | boundary, coupling, technical fit | specialist_reviews[] | architecture precedent / debt / rules candidate |
| frontend_engineer | scope.paths에 UI/프론트엔드 파일 포함 시 (doc 01 Step 3 참조) | component structure, rendering, browser compatibility | specialist_reviews[] | frontend pattern / debt |
| backend_engineer | scope.paths에 API/서버 파일 포함 시 (doc 01 Step 3 참조) | API design, data flow, service boundary | specialist_reviews[] | backend pattern / debt |
| qa_engineer | 모든 `task_kind=code` task, `gate_profile=closure_ready` | acceptance, demo, failure path, rubric | specialist_reviews[] + verification_result | qa recipe / risk memory |
| critical_reviewer | `risk_level`이 `high` 또는 `critical`인 task, readiness round | weak assumptions, ship risk | specialist_reviews[] + readiness_round | challenge precedent / risk memory |
| security_engineer | auth/permission/secret/public input 경로 수정 시, `risk_level`이 `high` 또는 `critical` 시, `task_kind=audit` | abuse path, authz, secret leak | specialist_reviews[] | security warning / debt |
| devops_engineer | `task_kind=config` 또는 `task_kind=release`, env/service/deploy/migration 경로 수정 시 | runtime readiness, bootstrap, rollout | specialist_reviews[] | environment fact / ops debt |
| ui_ux_designer | `task_kind=design`, user-facing UI 경로 수정 시 | UX consistency, user flow | specialist_reviews[] | design precedent |
| technical_writer | `task_kind=docs` 또는 docs-impact 변경 포함 시 | operator/user docs completeness | specialist_reviews[] | docs rule / style memory |
| product_authority | every task final closure, phase boundary | user value, scope fit, ship/iterate | final_verdict / phase review | product precedent / scope decisions |

## Worker Artifacts Consumed by Specialists

`worker-self-check.json`은 최소 아래 specialist가 반드시 읽을 수 있어야 한다.
- `architecture_authority`
- `qa_engineer`
- `critical_reviewer`
- `frontend_engineer` (해당 task에 required reviewer로 포함된 경우)
- `backend_engineer` (해당 task에 required reviewer로 포함된 경우)

### Worker Self-Check 부재 시 규칙

specialist review 시작 시점에 `worker-self-check.json`이 존재하지 않으면, specialist는 이를 `blocking_concern`으로 기록해야 한다. 이 경우 해당 review의 결과는 `status = approved`가 될 수 없다.

## Required Reviewer Resolution

전체 알고리즘은 doc 01 "Required Reviewer Routing Algorithm" (Step 1~6)을 참조한다. 아래는 요약이다.

1. `task_kind`, `risk_level`, `scope.paths`, touched surface를 본다 (doc 01 Step 1~3).
2. 기본 reviewer set를 도출한다.
3. 아래 조건에 해당하면 conditional reviewer를 추가한다:
   - task가 auth/crypto/secrets 경로를 수정 → `security_engineer` 추가
   - task가 CI/CD/deploy 설정을 수정 → `devops_engineer` 추가
   - task가 API endpoint를 추가/제거 → `architecture_authority` 추가
   - task가 사용자 대면 UI를 수정 → `ui_ux_designer` 추가
4. closure packet에는 실제 수행된 specialist review artifact를 모두 포함한다.

## Rule

필수 reviewer가 빠진 task는 `reviewed`로 갈 수 없다. 구체적으로:
- `required_reviewer_types[]`의 모든 type에 대해 `status`가 `approved` 또는 `changes_requested`(해당 concern이 모두 resolved)인 specialist review artifact가 존재해야 한다.
- `status = blocked`인 review가 1건이라도 있으면 `reviewed`로 전환할 수 없다.
- required reviewer type에 해당하는 agent가 가용하지 않으면 task는 `blocked`로 전환하고, `blocking_reason`에 미가용 reviewer type을 기록한다.

## Evolution Handoff Rule

specialist review는 closure를 돕는 것에서 끝나지 않는다. 아래 중 하나라도 있으면 `orchestration_authority`가 evolution pipeline 입력으로 넘긴다.
- reusable lesson
- repeated risk pattern
- debt flag
- test recipe
- environment fact
- design precedent
- product precedence signal

### Memory Candidate 우선순위

하나의 specialist review에 여러 종류의 memory candidate가 포함된 경우, `orchestration_authority`는 아래 우선순위로 처리한다:
1. safety/security 관련 항목 (security warning, abuse path, secret leak 등)
2. architectural precedent (boundary decision, coupling rule, technical fit 판단)
3. operational lesson (environment fact, ops debt, runtime readiness)
4. optimization tip (성능 개선, 효율화 제안)
