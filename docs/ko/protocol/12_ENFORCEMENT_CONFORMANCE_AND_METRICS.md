# 12. Enforcement, Conformance, and Metrics

## Enforcement Event Timeline

기본 순서:
1. `task_admission`
2. `pre_implementation`
3. `post_implementation`
4. `pre_integration`
5. `post_integration`
6. `pre_gate`
7. `post_gate`
8. `pre_verdict_submission`
9. `final_verdict`
10. `session_checkpoint`
11. `post_pass_learning`
12. `phase_transition_review`

## Hook Responsibilities

### 해도 되는 것
- artifact completeness 검사
- enum / invariant 검사
- stale start 차단
- lock conflict 차단
- missing required reviewer 차단
- missing worker self-check 차단
- incomplete closure packet 제출 차단
- packet stale 감지
- summary/recovery artifact 동기화
- phase transition 전에 gap/debt/rules artifacts 존재 여부 검사

### 하면 안 되는 것
- hook가 product verdict를 대신 결정
- hook가 specialist review를 대체
- hook가 missing evidence를 임의 생성
- hook가 불명확한 상태를 pass로 덮음

### Hook Failure 처리

hook은 외부 명령을 실행하므로 실패할 수 있다. 아래 규칙을 적용한다.

- **timeout**: hook은 기본 30초 timeout을 가진다 (`.geas/rules.md`에서 override 가능). timeout 발생 시 해당 hook을 `error`로 처리한다.
- **error 처리**: hook error 발생 시 해당 transition을 진행하지 않는다. 1회 자동 재시도한다. 재시도도 실패하면 task를 `blocked`로 전환하고 `orchestration_authority`에게 알린다.
- **hook 자체의 side-effect 실패**: hook이 artifact를 생성하거나 수정하는 경우, 실패한 hook이 남긴 partial artifact는 `_partial` suffix로 보존하고, 유효한 artifact로 간주하지 않는다.

## Conformance Scenarios

### State Integrity
- implementation contract 없이 `ready -> implementing` 시도 → 차단
- worker self-check 없이 `implementing -> reviewed` 시도 → 차단
- final verdict 없이 `verified -> passed` 시도 → 차단

### Drift / Revalidation
- stale task 시작 시 revalidation 강제
- paused task resume 시 baseline mismatch 감지

### Parallelism / Locking
- overlapping path lock 병렬 실행 차단
- integration lane simultaneous entry 차단

### Gate / Rubric
- worker self-check의 `confidence <= 2` (1-5 scale)인데 evidence gate threshold adjustment 누락 → 차단
- possible_stubs 존재하는데 stub cap 검증 누락 → 차단
  - **stub cap 정의**: 단일 task에서 허용되는 stub/placeholder 구현의 최대 수. 기본값: `risk_level=critical` → 0개, `risk_level=high` → 0개, `risk_level=normal` → 2개, `risk_level=low` → 3개. evidence gate tier 2 stub check에서 집행한다

### Memory Evolution
- 단일 low-quality incident를 stable memory로 직접 승격 시도 → 차단
  - **low-quality incident 정의**: (1) `evidence_refs` 수가 2 미만, 또는 (2) 원본 artifact의 gate score가 어떤 dimension에서든 3 미만, 또는 (3) `failed`/`cancelled` task에서 추출된 candidate
- superseded memory(`state = "superseded"`)가 `memory-packet.json`의 `applicable_memory_ids[]`에 포함됨 → 경고 1회, 2회 연속 시 차단
- harmful reuse(`memory-application-log.json`에 `effect = "negative"` 2건 이상)가 누적된 memory가 `stable` 또는 `canonical`로 유지됨 → `under_review`로 전환 필수 (doc 08 Harmful Reuse Rollback Procedure 참조)

### Evolution Loop
- passed task인데 retrospective 없음 → 첫 번째 발생 시 warning, 연속 2회 발생 시 block. 이 기본 정책을 override하려면 `.geas/rules.md`에 명시적 항목이 필요하다
- gap assessment 없이 evolving phase 종료 시도 → 차단
- debt register 없이 polishing/evolving phase close 시도 → 차단
- rules update가 있는데 packet builder가 반영하지 않음 → conformance failure

### Recovery
- gate result missing인데 `verified` 주장 → rewind
- dirty worktree + missing checkpoint → exact resume 금지

## Metrics

### Core
- stale start blocks
- revalidation count
- integration drift rate
- gate fail rate
- readiness round rate
- average closure latency
- worker low-confidence rate
- debt introduced per task
- debt resolved per phase
- gap closure ratio
- memory promotion count
- memory successful reuse count
- memory harmful reuse count
- recovery exact-resume rate
- recovery rewind rate
- packet stale regeneration count

### Run Summary

매 세션 종료 시 `run-summary.md`를 생성하여 세션 감사 추적을 남긴다.

포함 항목:
- 세션에서 완료된 task 목록과 각 verdict
- 발생한 failure/rewind 목록
- 새로 생성/승격된 memory 목록
- `rules.md` 변경 사항
- debt-register 변동 사항
- 전체 소요 시간과 주요 milestone 시점

저장 위치: `.geas/summaries/run-summary-{timestamp}.md`

### Health Signals

| signal | 구체적 threshold | 의미 |
|---|---|---|
| memory bloat | `memory-index.json` entries > 100개이면서 최근 10개 task에서 reuse 0 | memory가 축적만 되고 활용되지 않음 |
| review gap | 최근 5개 task에서 required specialist review 누락률 > 20% | review 프로세스가 무시되고 있음 |
| gate quality 문제 | final verdict `iterate` 비율 > 30% (최근 10개 task 기준) | specialist gate 품질이 낮거나 기준이 불명확함 |
| contradiction 누적 | `contradiction_count >= 3`인 stable memory가 2개 이상 | memory review cadence 부족. doc 08 Decay Rules에서 `contradiction_count >= 3`이면 `decayed`로 전환하므로, 이 signal이 발생하면 decay rule 집행이 누락된 것이다 |
| repeated failure class | 동일 `failure_class`가 3회 이상 반복 | memory promotion 또는 process rule 필요 |
| debt 정체 | `accepted` 상태 debt가 `resolved` 상태 debt의 2배 이상 (phase 단위) | polishing/evolving phase가 효과 없음 |
| scope control 약화 | 최근 5개 task 중 > 30%에서 `implementation_contract` 승인 후 scope 변경 발생 | scope control이 약함 |
| worker low-confidence | `confidence <= 2` 비율 > 25% (최근 10개 task 기준) | task 분할 또는 context packet 개선 필요 |

### Health Signal 감지 주체 및 시점

health signal은 `orchestration_authority`가 아래 시점에 계산한다:
1. 매 `learning` runtime phase 진입 시
2. 매 phase transition review 시
3. session 시작 시 (recovery 후 상태 점검)

계산 결과는 `.geas/state/health-check.json`에 기록하며, 각 signal의 현재 값과 threshold 초과 여부를 포함한다. threshold를 초과한 signal이 있으면 해당 mandatory response를 즉시 실행한다.

### Health Signal 감지 시 필수 대응

health signal이 threshold를 초과하면 아래 대응이 **반드시** 수행되어야 한다:

1. **memory bloat**: `process_lead`가 다음 retrospective에서 reuse 0인 memory를 일괄 review한다. `review_after`가 경과한 항목은 `decayed`로 전환한다.
2. **review gap**: `orchestration_authority`가 다음 task부터 specialist review 누락 시 `pre_gate` hook에서 block을 활성화한다.
3. **gate quality 문제**: `process_lead`가 rubric 기준 명확화를 위한 rule candidate를 생성한다. 필요 시 evidence gate threshold를 조정한다.
4. **contradiction 누적**: 해당 memory를 즉시 `under_review`로 전환하고 doc 08의 decay rule을 적용한다.
5. **repeated failure class**: 해당 failure pattern을 memory candidate로 자동 등록하고, doc 14의 Retrospective -> Rule Update 프로세스를 trigger한다.
6. **debt 정체**: `process_lead`가 phase review에서 debt 해소 계획을 수립한다. 다음 phase에서 debt resolution task를 우선 scheduling한다.
7. **scope control 약화**: `orchestration_authority`가 implementation contract 승인 절차를 강화한다. scope 변경 시 re-approval을 필수로 한다.
8. **worker low-confidence**: `orchestration_authority`가 task granularity를 검토하고 context packet의 L1/L2 memory 품질을 개선한다.
