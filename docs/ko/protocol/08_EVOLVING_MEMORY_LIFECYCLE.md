# 08. Evolving Memory Lifecycle

## 목적

이 문서는 Geas의 핵심 아이디어인 **지속적으로 발전하는 메모리**를 상세 규칙으로 정의한다. 핵심 질문은 이것이다.

> task 종료, 실패, recovery, review disagreement에서 얻은 학습을 어떻게 future behavior를 개선하는 durable memory로 바꿀 것인가?

## Memory Evolution States

- `candidate`
- `provisional`
- `stable`
- `canonical`
- `under_review`
- `decayed`
- `superseded`
- `archived`
- `rejected`

### 의미
- `candidate`: 추출됐지만 아직 가설 수준
- `provisional`: 근거는 충분히 있으나 재사용 검증이 더 필요
- `stable`: 반복 활용 가능한 신뢰된 memory
- `canonical`: 강한 승인 또는 반복 검증을 거친 거의 규칙 수준 memory
- `under_review`: harmful reuse 누적 또는 confidence < 0.3 decay로 재검토 대기 중 (retrieval에서 일시 제외)
- `decayed`: 한때 유효했지만 freshness/confidence가 떨어짐
- `superseded`: 새 memory로 대체됨
- `archived`: 참조용 보관
- `rejected`: noise 또는 부적절한 기억

## Source Signals

memory candidate는 아래 신호에서 나온다.

1. `final-verdict.json`
2. `failure-record.json`
3. `revalidation-record.json`
4. `integration-result.json`
5. `specialist-review.json`
6. `readiness-round.json`
7. `recovery-packet.json`
8. `worker-self-check.json`
9. `retrospective.json`
10. `gap-assessment.json`
11. `debt-register.json`

## Per-Task Evolution Loop

모든 `passed` task 뒤에는 최소한 아래 루프가 실행된다.

1. `process_lead`가 `retrospective.json` 작성
2. retrospective에서 lessons / debt / memory candidates / rules candidates 추출
3. domain authority가 candidate 검토
4. 승인되면:
   - `project_memory` 또는 `agent_memory`로 승격
   - 필요한 경우 `.geas/rules.md` 업데이트
   - debt면 `debt-register.json` 갱신
5. 다음 task의 packet builder가 이를 주입
6. 실제 적용 결과를 `memory-application-log.json`에 기록

## Candidate Extraction Rules

### 자동 추출해도 되는 것
- 같은 `failure_class`를 가진 실패가 2회 이상 반복 (`failure-record.json`의 `failure_class` 필드 기준)
- 같은 reviewer concern이 2개 이상 task의 `specialist-review.json`에서 재등장 (concern의 `category` 필드 기준)
- 같은 `recovery_class`의 recovery incident가 2회 이상 반복
- 특정 demo/test recipe가 3개 이상 task에서 효과적으로 사용됨
- 특정 path/domain에서 `integration-result.json`의 conflict가 2회 이상 발생
- `worker-self-check.json`의 `confidence <= 2`가 동일 `task_kind`에서 2회 이상 반복

### 자동 추출하면 안 되는 것
- 단일 task의 aesthetic preference
- conflict 없는 단발성 구현 취향
- evidence 없이 LLM이 추론한 일반론

## Candidate 최소 필드

- `memory_id`
- `memory_type`
- `state`
- `title`
- `summary`
- `scope`
- `evidence_refs[]`
- `signals.confidence`
- `signals.evidence_count`
- `signals.reuse_count`
- `signals.contradiction_count`
- `review_after`

## Promotion Pipeline

### Stage 1 — candidate creation
signal을 candidate로 만든다.

### Stage 2 — dedupe/merge
유사한 기존 candidate/stable memory와 병합 여부를 판정한다.

**Merge Eligibility 조건** — 두 candidate가 아래 3가지를 모두 만족하면 merge-eligible이다:
1. 동일한 `memory_type`
2. `scope`가 겹침 (동일 scope이거나 하나가 다른 하나의 상위 scope)
3. `summary`의 semantic similarity가 merge-eligible 수준일 것 (아래 판정 기준 참조)

**Semantic Similarity 판정 기준:**

`summary`의 semantic similarity는 아래 중 하나로 판정한다 (프로젝트 설정에 따라 선택):
1. **LLM 판정 (기본)**: orchestration_authority가 두 summary를 비교하여 "동일 주제에 대한 동일 교훈인가?"를 yes/no로 판정한다. yes이면 merge-eligible.
2. **키워드 기반 (fallback)**: 두 summary에서 명사/동사 핵심어를 추출하고, Jaccard similarity >= 0.70이면 merge-eligible.

어느 방식이든 merge 판정 근거는 `memory-review.json`의 `rationale`에 기록한다.

**Merge 절차:**
- 두 entry 중 `evidence_refs`가 더 많은 쪽을 base로 삼는다.
- base entry에 나머지 entry의 고유 evidence_refs를 추가한다.
- `signals.evidence_count`는 두 entry의 합산으로 한다.
- 약한 쪽 entry는 `state = "superseded"`, `superseded_by = {base entry의 memory_id}`로 변경한다.

### Stage 3 — review
해당 domain owner가 memory 품질을 확인한다.
- process memory → `process_lead`
- architecture precedent → `architecture_authority`
- product precedent → `product_authority`
- QA recipe → `qa_engineer`
- security warning → `security_engineer`

### Stage 4 — promotion
review와 evidence strength에 따라 `provisional` 또는 `stable`로 승격한다.

### Stage 5 — application logging
future task에 적용될 때마다 success/failure를 기록한다.

### Stage 6 — reinforcement / weakening
성공 재사용은 confidence를 올리고, contradiction 또는 harmful reuse는 confidence를 내린다.

## Promotion Rules

### candidate -> provisional
아래 중 하나 이상 충족:
- evidence_refs 2개 이상
- 동일 유형 incident/similar incident 2회 이상
- domain authority의 explicit approval

### provisional -> stable
아래 조건 **모두** 충족:
- successful application log 3건 이상
- 최근 5회 적용에서 contradiction 0건
- domain authority review 완료

### stable -> canonical
아래 조건 **모두** 충족:
- successful application log 5건 이상, 3개 이상의 서로 다른 task에 걸쳐 있을 것
- process_lead + 해당 domain authority의 joint approval

## Rules.md Update Loop

`rules.md`는 durable behavior surface다. 업데이트는 아무 task 후에도 임의로 일어나면 안 되고 아래를 만족해야 한다.

### Rule Candidate Sources
- retrospective lesson
- repeated failure pattern
- repeated QA recipe
- architecture precedent
- security warning
- product precedent

### Rule Update Conditions
아래 조건을 **모두** 충족해야 한다:
- evidence_refs 2개 이상 또는 해당 domain authority의 explicit approval
- scope가 `project`인지 검증 (`_defs.schema.json`의 `memoryScope` 기준). project-wide가 아닌 rule은 `agent_memory`로 분류한다
- 최근 5개 task에서 해당 rule candidate와 관련된 negative application log가 0건 (harmful side effect 없음)

### Rules Update Artifact
- `rules-update.json`
- `affected_rule_ids[]`
- `reason`
- `evidence_refs[]`
- `applies_to`

### Rule Application
업데이트된 rules는 다음부터 아래에서 사용된다.
- packet builder L0 pinned invariants
- task compiler default checks
- implementation contract checklist
- readiness round auto triggers
- reviewer caution items

## Agent Memory Improvement Path

agent_memory는 type별 성능 개선 경로다.

예:
- `qa_engineer` → 자주 놓치던 edge-case recipe 저장
- `architecture_authority` → boundary smell precedent 저장
- `critical_reviewer` → recurring ship-risk 패턴 저장
- `backend_engineer` → transaction/auth/db migration hazard 저장

규칙:
- 같은 type에만 무조건 주입하지 않는다.
- task scope와 role match가 있을 때만 retrieval한다.
- harmful reuse가 누적되면 weakening 또는 supersession 한다.

## Confidence and Freshness

필수 필드 (`memory-entry.schema.json` 기준):
- `signals.confidence`: 0.0 ~ 1.0
- `signals.evidence_count`
- `signals.reuse_count`
- `signals.contradiction_count`
- `review_after`

### Decay Rules

- `review_after` 날짜를 경과했고, 해당 기간 동안 successful reuse가 0건이면 `decayed`
- `contradiction_count >= 3`이면 `decayed` (doc 12 Health Signals의 contradiction 누적 threshold과 동일)
- superseding memory가 나오면 `superseded`
- `confidence < 0.3`이면 decay review trigger (doc 07 Confidence Scoring Model 참조)

### Decayed State Exit Transitions

`decayed` 상태의 memory는 아래 전이가 가능하다:
- `decayed` → `under_review`: process_lead 또는 domain authority가 수동으로 재검토를 요청한 경우. 재검토 결과에 따라 reinstate(이전 상태 복원), archive, reject 중 하나로 전이한다.
- `decayed` → `archived`: 재검토 없이 정리가 필요한 경우. repository_manager 또는 process_lead가 실행.
- `decayed` 상태에서 자동 복원은 없다. 반드시 명시적 인간/authority 행위가 필요하다.

## Supersession

memory는 immutable truth가 아니다. 새 사실이 나오면 대체될 수 있다.

필드:
- `supersedes[]`
- `superseded_by`
- `supersession_reason`

규칙:
- superseded memory는 삭제하지 않는다.
- retrieval에서 default 제외하지만, audit/drill-down (L3)에서는 보인다.
- superseded memory를 `evidence_refs`로 참조하는 다른 memory가 있으면, 해당 참조를 superseding memory의 `memory_id`로 갱신한다.
- superseded memory에 기반한 `rules.md` 항목이 있으면, doc 14의 Harmful Reuse Feedback Loop 절차를 따라 rule의 유효성을 재검토한다.

### Superseded State Exit Transitions

`superseded` 상태의 memory는 아래 전이가 가능하다:
- `superseded` → `archived`: audit trail로 보존 완료 후 정리. process_lead 또는 repository_manager가 실행.
- `superseded_by`가 가리키는 memory가 `rejected`된 경우: `superseded` → `under_review`로 전이하여 원래 memory의 유효성을 재검토한다. 재검토 결과에 따라 이전 상태로 reinstate하거나 archive한다.

## Negative Learning

좋은 기억만 저장하면 안 된다. 아래도 memory가 된다.
- false green을 만든 검증 누락 패턴
- merge 전에 괜찮아 보였지만 integration에서 깨지는 조합
- recovery 실패를 부른 unsafe checkpoint 패턴
- low-confidence self-check를 무시해서 생긴 회귀

이런 항목은 주로 아래 `memoryType` enum 값으로 남긴다 (`_defs.schema.json` 기준):
- `failure_lesson` — 실패에서 추출한 교훈 (false green, 검증 누락 등)
- `risk_pattern` — 반복되는 위험 패턴 (unsafe checkpoint, integration 깨짐 등)
- `security_pattern` — 보안 관련 경고/패턴
- `process_improvement` — 프로세스 개선 (gap/debt에서 파생된 교훈)

## Application Logging

memory가 실제로 사용될 때마다 아래를 남긴다.
- 어떤 task에 주입되었나
- 누가 사용했나
- 어떤 효과가 있었나 (`positive | negative | neutral | neutral_but_risky | unknown`)
- strengthen / weaken / supersede 중 무엇이 필요한가

이 기록이 있어야 memory가 “살아 있는 시스템”이 된다.

### Logging Frequency

application log는 아래 조건이 **모두** 충족될 때 기록한다:
1. memory entry가 `memory-packet.json`에 포함되어 agent에게 주입되었을 때
2. 해당 packet을 소비한 task가 terminal state에 도달했을 때 (`passed`, `cancelled`, 또는 `escalated`)

참고: `failed`는 task state가 아니다 (doc 03 참조). task 실패는 FailureRecord로 기록되며, task는 rewind되거나 `escalated`로 전이한다. retry_budget 소진으로 `escalated`에 도달한 task는 terminal로 간주하여 application log를 기록한다.

`effect` 판정 기준:
- task가 `passed`이고 해당 memory의 guidance가 적용 범위에 포함되면 → `positive`
- task가 `passed`이지만 해당 memory가 실제 행동에 영향 없었으면 → `neutral`
- task가 `escalated`이고 FailureRecord의 failure 원인이 해당 memory의 guidance와 관련 있으면 → `negative`
- task가 `escalated`이지만 failure 원인이 해당 memory와 무관하면 → `neutral`
- task가 `cancelled`이면 → `unknown` (의도적 중단이므로 memory 효과 판정 불가)
- 판단 불가 → `unknown`

### Harmful Reuse Rollback Procedure

승격된 memory(provisional 이상)에 negative application log가 **2건 이상** 누적되면 아래 절차가 trigger된다:

1. **자동 상태 변경**: 해당 memory의 state를 `”under_review”`로 변경한다.
2. **Review 소집**: process_lead + domain authority가 해당 memory와 negative log를 검토한다.
3. **가능한 판정 결과** (괄호 안은 `memory-review.schema.json`의 `decision` enum 값):
   - **supersede** (`supersede`): 수정된 새 memory를 생성하고, 기존 entry를 `superseded`로 변경
   - **demote** (`weaken`): `provisional`로 강등 (stable/canonical이었던 경우)
   - **archive** (`archive`): `archived` 상태로 변경하고 `”invalidated”` tag 부여
4. 판정 결과는 `memory-review.json`에 기록하고, `reason`과 `evidence_refs`를 명시한다.

### under_review State Transition 전체 명세

**진입 조건** (아래 중 하나):
- negative application log가 2건 이상 누적 (Harmful Reuse Rollback)
- `confidence < 0.3` decay review trigger (doc 07 참조)
- process_lead 또는 domain authority의 수동 재검토 요청

**진입 시 행동**:
- 해당 memory의 `state`를 `"under_review"`로 변경
- retrieval에서 일시 제외 (`suppressed_memory_ids[]`에 추가, `reason: "under_review"`)

**퇴출 조건** (review 완료 후 아래 중 하나로 전환, 괄호 안은 `memory-review.schema.json`의 `decision` enum 값):
1. **reinstate** (`keep`): review 결과 memory가 여전히 유효하다고 판단된 경우, 이전 state(`provisional`/`stable`/`canonical`)로 복원한다. `contradiction_count`를 0으로 reset하고, `review_after`를 현재 날짜 + 90일로 갱신한다.
2. **supersede** (`supersede`): 수정된 새 memory를 생성하고, 기존 entry를 `superseded`로 변경
3. **demote** (`weaken`): `provisional`로 강등 (stable/canonical이었던 경우)
4. **archive** (`archive`): `archived` 상태로 변경하고 `"invalidated"` tag 부여
5. **reject** (`reject`): 근거가 완전히 무효화된 경우 `rejected`로 변경

**Review 미완료 시**: review 없이 under_review 상태로 30일 이상 방치되면, 다음 retrospective에서 process_lead가 반드시 처리해야 한다. 60일 초과 시 자동으로 `archived` 처리된다.

### Reinstate Circuit Breaker

동일 memory가 `under_review`를 3회 이상 거친 경우 (reinstate 후 다시 under_review에 진입하는 패턴이 반복된 경우):

- `reinstate` (`keep`)는 더 이상 선택할 수 없다. review에서 해당 option을 제외한다.
- 가능한 판정은 `supersede`, `demote` (`weaken`), `archive`, `reject` 중 하나다.
- 이 제한은 `memory-entry.json`에 `under_review_count` 필드를 추가하여 추적한다. 초기값은 `0`이며, `under_review` 상태 진입 시마다 `+1`한다.
- 3회 이상 under_review를 거친 memory는 구조적으로 불안정한 것으로 간주하며, reinstate를 허용하면 무한 루프(reinstate → 문제 재발 → under_review → reinstate)가 발생할 수 있으므로 이를 차단한다.

## Anti-Bloat Rules

1. `evidence_refs`가 0개인 stylistic preference는 `rejected` 처리한다
2. `confidence < 0.3`이고 `review_after`를 경과한 memory는 retrieval에서 기본 제외한다 (L3 drill-down에서만 접근 가능)
3. stable memory도 review cadence를 갖는다 (기본: promotion 날짜 + 180일, doc 11 `review_after` 참조)
4. 같은 내용을 여러 memory로 중복 생성하지 않는다. 중복 감지 시 Promotion Pipeline Stage 2의 Merge 절차를 적용한다
5. `scope = "task"`인 observation을 `scope = "project"` rule로 바로 승격하지 않는다. 최소 `scope = "mission"`을 거쳐야 한다

## 핵심 문장

> Geas memory는 “저장되는 기록”이 아니라 “재사용 결과에 따라 계속 강화되거나 약화되고, rules와 packets를 통해 다음 행동을 바꾸는 운영 지식”이다.
