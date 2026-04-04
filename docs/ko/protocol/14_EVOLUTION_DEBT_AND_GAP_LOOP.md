# 14. Evolution, Debt, and Gap Loop

## 목적

이 문서는 Geas의 차별점인 **Evolution**을 운영 루프로 정의한다. 핵심 질문은 아래와 같다.

1. task가 끝난 뒤 팀은 무엇을 배워야 하는가?
2. 그 학습은 어디에 저장되고, 어떻게 다음 행동을 바꾸는가?
3. 구현 범위와 원래 약속한 scope 사이 차이는 어떻게 측정하는가?
4. 기술 부채는 어떻게 누적·검토·해소하는가?

## Per-Task Retrospective Loop

모든 `passed` task 뒤에는 `orchestration_authority`가 `retrospective.json`을 작성한다.

최소 항목:
- `what_went_well[]`
- `what_broke[]`
- `what_was_surprising[]`
- `rule_candidates[]`
- `memory_candidates[]`
- `debt_candidates[]`
- `next_time_guidance[]`

## Retrospective -> Rule Update

### rule candidate 생성
다음 조건이면 rule candidate를 만들 수 있다.
- 같은 failure pattern이 2회 이상 반복
- 같은 reviewer concern이 2회 이상 반복
- same integration/recovery mistake 재발
- 분명한 process fix가 존재

### rule update 승인
아래 중 하나 필요:
- `orchestration_authority` + domain authority 승인
- evidence_refs 2개 이상 + `contradiction_count = 0`

### behavior change
승인된 rule은 아래를 바꾼다.
- packet L0 pinned invariants
- task compiler default checks
- implementation contract checklist
- reviewer focus prompts
- readiness auto trigger

즉 rule은 문서가 아니라 **future behavior modifier**다.

## Agent Memory Feedback Loop

retrospective에서 나온 lesson은 role-specific이면 `agent_memory`로, 그렇지 않으면 project-level memory로 들어간다.

### role-specific lesson 판별 기준

lesson이 아래 조건 중 하나 이상을 만족하면 role-specific이다:
- (a) 해당 agent type만 사용하는 tool/technique을 참조하는 경우
- (b) 해당 agent type만 생산하는 artifact type에 적용되는 경우
- (c) 해당 agent type의 review에서 생성된 경우

위 조건을 만족하지 않으면 project-level memory로 분류한다.

### 예:
- qa lesson → `qa_engineer`
- security lesson → `security_engineer`
- architecture precedent → `architecture_authority`
- implementation smell → relevant engineer type
- 프로세스 개선 관련 lesson → project-level (특정 agent type에 종속되지 않음)

다음 spawn 시 packet builder는 applicable agent_memory를 주입한다.

## Debt Tracking Model

`debt-register.json`은 mission/phase 수준의 부채 장부다.

### debt source
- worker self-check
- specialist reviews
- integration result
- final verdict notes
- retrospective
- gap assessment

### debt fields
- `debt_id`
- `severity = low | medium | high | critical`
- `kind = code_quality | architecture | security | docs | ops | test_gap | product_gap`
- `title`
- `description`
- `introduced_by_task_id`
- `owner_type`
- `status = open | accepted | scheduled | resolved | dropped`
  - **`scheduled` → `resolved` 전환 조건**: 해당 debt item을 명시적으로 대상으로 하는 task가 `state=passed`에 도달하고, 해당 task의 evidence에서 debt의 원래 concern이 해소되었음이 검증될 때 전환한다
- `target_phase = polishing | evolving | future`

### debt review cadence
- every task close: add/merge debt candidates
- every phase transition: rollup review
- mission close: unresolved debt snapshot mandatory

### debt action rules
- `critical` debt는 phase exit 전 triage 필수. triage 없이 phase exit을 시도하면 `phase_transition_review` hook이 차단한다.
- `high` debt는 `polishing` phase에서 해소하거나 `product_authority`의 explicit acceptance이 있어야 한다. acceptance 시 `rationale` 필드에 수용 사유를 기록한다.
- `accepted` debt는 `rationale`과 `owner_type` 없이 둘 수 없다. 둘 중 하나라도 비어 있으면 validator가 reject한다.
- `dropped` debt는 `orchestration_authority`의 승인과 `drop_reason` 기록이 필요하다. 승인 없이 `dropped`로 전환하면 차단한다.

### Evolution Phase에서 발견된 Critical Debt

evolving phase에서 retrospective 또는 gap assessment를 통해 새로운 critical debt가 발견되면 아래 절차를 따른다:

1. 해당 debt를 `debt-register.json`에 `severity = critical`, `status = open`으로 기록한다.
2. `product_authority`가 아래 중 하나를 결정한다:
   - **a. 즉시 수정**: evolving phase 내에서 수정 task를 생성한다. 이 task는 일반 task lifecycle을 따른다 (doc 03 참조).
   - **b. 수용**: `status = accepted`로 변경하고, `rationale`과 `owner_type`을 필수로 기록한다. 수용 근거 없이는 evolving phase exit gate를 통과할 수 없다 (위 debt action rules 및 Evolving Phase Exit Gate 참조).
   - **c. 다음 mission 이관**: `status = scheduled`, `target_phase = future`로 변경한다. `gap-assessment.json`의 `recommended_followups[]`에 해당 debt를 추가한다.
3. 결정은 `decision-record.json`에 기록한다. `decision_type`은 `"critical_debt_triage"`, `evidence_refs`에 해당 debt의 `debt_id`를 포함한다.

### debt 충돌 해소
동일 scope에서 상충하는 debt 항목이 존재하는 경우 (예: "API 인증을 OAuth로 전환" vs "현재 API key 방식 유지"):
1. `orchestration_authority`가 해당 domain authority와 함께 검토한다.
2. 하나를 `dropped`로 전환하고 `drop_reason`에 상충 해소 사유를 기록한다.
3. 결정 결과를 `retrospective.json`의 `what_was_surprising[]`에 기록한다.

## Gap Assessment

`gap-assessment.json`은 원래 `scope_in`과 실제 `scope_out`을 비교한 artifact다.

### 언제 쓰나
- `building -> polishing`
- `polishing -> evolving`
- `evolving -> mission close`
- major pivot 이후

### 최소 필드
- `scope_in_summary`
- `scope_out_summary`
- `fully_delivered[]`
- `partially_delivered[]`
- `not_delivered[]`
- `intentional_cuts[]`
- `unexpected_additions[]`
- `recommended_followups[]`

### 해석 규칙
- `unexpected_additions`가 있으면 traceability note 필요
- `not_delivered`가 남았는데 phase close를 원하면 `product_authority` rationale 필요
- **repeated partial delivery forward-feeding**: `partially_delivered`에 동일 항목이 2회 이상의 gap assessment에서 나타나면, 해당 항목은 다음 specifying phase의 intake에 priority constraint로 자동 추가된다.

  **End-to-end forward-feed 절차:**
  1. **감지**: gap assessment 작성 시 `orchestration_authority`가 `partially_delivered[]`의 각 항목을 이전 gap assessment들과 대조한다. 대조 기준은 항목의 `title`이 동일하거나, `scope_ref`가 동일한 경우이다.
  2. **판정**: 동일 항목이 2회 이상 나타나면 forward-feed 대상으로 mark한다. gap assessment의 해당 항목에 `forward_feed: true`와 `occurrence_count: N`을 기록한다.
  3. **전파**: 다음 mission의 specifying phase에서 intake skill이 `mission-{n}.json`을 생성할 때, forward-feed 대상 항목을 `constraints` 필드에 자동 삽입한다. 각 constraint에는 `source_ref: "{gap_assessment_id}"`, `reason: "repeated_partial_delivery"`, `original_scope: "{항목 title}"`을 포함한다.
  4. **검증**: task compiler가 `mission-{n}.json`에서 forward-feed constraint가 있는 경우, 해당 항목을 포함하는 task를 반드시 1개 이상 생성해야 한다. 생성하지 않으면 `product_authority`의 explicit rationale이 필요하다.
  5. **완료 확인**: forward-feed된 항목이 `fully_delivered`로 전환되면, 해당 constraint는 다음 gap assessment에서 제거된다. `partially_delivered`에 남으면 occurrence_count가 증가하고 forward-feed가 반복된다.
  6. **실패 시**: 3회 이상 반복되어도 해소되지 않으면, `orchestration_authority`가 retrospective에서 해당 항목의 실현 가능성을 재평가하고, `product_authority`가 `intentional_cuts`로 전환할지 판단한다

## Initiative Evolving Phase

evolving phase는 단순 회고가 아니라 아래 묶음이다.

1. all passed tasks retrospective 수집
2. rules / memory candidates promotion
3. debt register rollup
4. gap assessment 수행
5. mission summary 생성
6. next-loop backlog 또는 mission close 결정

## Evolving Phase Exit Gate

evolving phase를 닫으려면 아래 5개 artifact가 **모두** 존재해야 한다. 하나라도 누락되면 `phase_transition_review` hook이 차단한다.

1. `gap-assessment.json` — 이번 phase의 scope_in vs scope_out 비교 완료
2. updated `debt-register.json` — 모든 debt item의 status가 갱신됨 (`open` 상태의 debt가 남아 있으면 각각 `accepted` 이상으로 triage 필요)
3. approved `rules-update.json` — rule candidate가 있으면 승인/반려 완료. candidate가 없으면 `"no_candidates": true` 필드를 포함한 artifact를 생성한다
4. `mission-summary.md` — mission 수준 상태, 남은 문제, pending decision, outstanding risk 요약
5. `phase-review.json` — `product_authority`의 phase review 완료. `verdict` 필드가 `"approve"` 또는 `"approve_with_conditions"`여야 한다

**Exit gate 실패 시**: 누락된 artifact 목록을 `orchestration_authority`에게 반환하고, 해당 artifact가 생성될 때까지 phase는 열린 상태로 유지된다.

## Harmful Reuse Feedback Loop

memory 기반으로 생성된 rule이 `rules.md`에 존재하는데, 해당 memory가 weakening 또는 supersession 된 경우(doc 08 참조), 아래 절차를 따른다:

1. `orchestration_authority`는 해당 rule의 memory 의존성을 검토한다.
2. memory가 weakened/superseded된 이유가 rule의 유효성에 영향을 미치는 경우:
   - rule을 업데이트하여 memory 의존성을 제거하고 독립적 근거로 재정립하거나,
   - rule을 archive하고 `rules-update.json`에 archive 사유를 기록한다.
3. memory가 weakened/superseded됐으나 rule 자체의 논리가 여전히 유효한 경우:
   - rule의 `evidence_refs`에서 해당 memory 참조를 제거하고 대체 근거를 추가한다.

이 검토는 memory review cadence 또는 retrospective에서 수행한다.

## 핵심 문장

> Evolution은 “이번에 끝났다”를 넘어서 “다음에는 더 잘하게 만든다”를 보장하는 프로토콜 단계다.
