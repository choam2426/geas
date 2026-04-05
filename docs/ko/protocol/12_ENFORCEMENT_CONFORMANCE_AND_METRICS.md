# 12. Enforcement, Conformance, and Metrics

> **기준 문서.**
> 이 문서는 enforcement point, hook의 허용/금지 행위, conformance 시나리오, observability 기대 수준, health signal, 필수 corrective response를 정의한다.

## 목적

Enforcement가 불가능한 프로토콜은 형식적 절차로 퇴화한다. 이 문서는 Geas가 이상 목표가 아닌 운영 구속력을 유지하도록 보장한다.

## Enforcement Event Timeline

기본 lifecycle은 아래 enforcement point를 포함해야 한다. 각 point는 프로토콜이 불변 조건을 검증하고, 잘못된 진행을 차단하며, telemetry를 발행할 수 있는 시점을 나타낸다.

| # | enforcement point | 발동 시점 |
|---|---|---|
| 1 | `task_admission` | 새 task가 활성 pipeline에 진입할 때 |
| 2 | `pre_implementation` | 승인된 task에 대한 작업 시작 전 |
| 3 | `post_implementation` | worker가 구현 완료를 알린 후 |
| 4 | `pre_integration` | 공유 workspace에 결과물을 병합하기 전 |
| 5 | `post_integration` | integration 성공 후 |
| 6 | `pre_gate` | evidence gate 평가 시작 전 |
| 7 | `post_gate` | evidence gate가 verdict를 산출한 후 |
| 8 | `pre_verdict_submission` | final verdict 제출 전 |
| 9 | `final_verdict` | Decision Maker가 pass, iterate, escalate를 발행할 때 |
| 10 | `session_checkpoint` | 주기적 또는 이벤트 기반 session 저장 시점 |
| 11 | `post_pass_learning` | task가 `passed`에 도달한 후 retrospective 실행 시 |
| 12 | `phase_transition_review` | mission이 phase 간 이동할 때 |

프로젝트는 추가할 수 있으나, 위 point들이 제공하는 의미적 coverage를 축소해서는 안 된다.

## Hook Responsibilities

Hook은 각 enforcement point의 실행 가능한 enforcement 메커니즘이다. Agent와 reviewer의 판단을 대체하지 않도록 명확한 경계 내에서 동작해야 한다.

### 허용되는 책임

Hook과 validator가 수행할 수 있는 것:

| 책임 | 예시 |
|---|---|
| artifact completeness 검사 | closure packet의 필수 필드 존재 확인 |
| enum / schema 검사 | task status가 유효한 값인지 검증 |
| invariant 검사 | artifact 간 task_id 일관성 확인 |
| stale-start 차단 | base_snapshot이 오래된 경우 구현 시작 거부 |
| lock conflict 차단 | 충돌하는 리소스에 대한 병렬 작업 방지 |
| missing-review 차단 | 필수 review가 없으면 gate 진입 차단 |
| packet freshness 검사 | 최신 contract 수정 이전에 생성된 packet 감지 |
| state 및 summary 동기화 | runtime state 파일과 session summary 업데이트 |
| phase-transition precondition 검사 | phase 종료 전 evolving exit gate 조건 확인 |
| telemetry 발행 | 시간, 결과, 리소스 사용량 기록 |
| 문서화된 policy enforcement | 프로젝트 policy에 명시된 규칙 적용 |

### 금지되는 책임

Hook은 agent, reviewer, authority role에 속하는 행위를 수행해서는 안 된다.

| 금지 행위 | 이유 |
|---|---|
| product verdict 발행 | verdict는 자동화가 아닌 agent 판단을 요구함 |
| specialist review 대체 | review 품질은 도메인 추론에 의존함 |
| 누락된 evidence 임의 생성 | 조작된 evidence는 gate 모델 전체를 훼손함 |
| 모호한 상태를 success로 변환 | 불확실성은 숨기지 않고 표면화해야 함 |
| mandatory review 또는 recovery rule 우회 | 보호 장치 생략은 프로토콜 신뢰를 침식함 |
| 명시적 policy authority 없이 contract override | contract 변경은 의도적 승인을 요구함 |

## Hook Failure Handling

Hook이 실패한 경우:

- 해당 transition은 기본적으로 중단된다
- 자동 재시도를 1회 시도할 수 있다
- 반복 실패 시 원인에 따라 task를 `blocked`로 이동하거나 recovery를 trigger한다
- 부분 side effect는 격리하고 유효한 evidence로 취급하지 않는다

## Conformance Classes

Conformance class는 관련 프로토콜 기대치를 그룹화하여, 프로젝트가 어떤 영역을 enforcement하고 어디에 gap이 있는지 기술할 수 있게 한다.

프로젝트는 자체 용어로 성숙도를 기술할 수 있으나, baseline 프로토콜 conformance는 최소한 아래 class를 포함해야 한다:

| class | 대상 |
|---|---|
| state integrity conformance | task 상태 전환이 필수 전제 조건과 함께 유효한 경로를 따르는지 |
| artifact conformance | 모든 필수 artifact가 존재하고 schema에 대해 유효한지 |
| review and gate conformance | review가 올바르게 routing되고, gate가 실행되며, verdict가 기록되는지 |
| recovery conformance | session recovery가 safe-boundary 규칙을 따르고 유효한 상태를 생성하는지 |
| evolution conformance | retrospective, debt, gap assessment, rules update가 일정대로 수행되는지 |
| observability conformance | enforcement point에서 telemetry가 발행되고 상관 분석이 가능한지 |

## Core Conformance Scenarios

아래 시나리오는 프로토콜 위반 또는 edge case 발생 시 기대되는 동작을 정의한다. 각 시나리오는 trigger 조건과 기대되는 enforcement 응답을 명시한다.

### State integrity

| 시나리오 | 기대 응답 |
|---|---|
| `ready -> implementing` 전환 시 approved contract 없음 | blocked |
| `implementing -> reviewed` 전환 시 worker self-check 없음 | blocked |
| `verified -> passed` 전환 시 final verdict 없음 | blocked |
| `passed` 주장 시 closure packet 미완성 | blocked |

### Drift / revalidation

| 시나리오 | 기대 응답 |
|---|---|
| revalidation 없이 stale task 시작 | blocked |
| base_snapshot 불일치 상태에서 integration 시도 | blocked |
| contract 수정 후 재생성 없이 packet 제출 | policy에 따라 blocked 또는 warning |

### Parallelism / locking

| 시나리오 | 기대 응답 |
|---|---|
| unsafe lock이 겹치는 상태에서 병렬 실행 | blocked |
| 동시 integration lane 진입 | blocked |
| recovery 중 abandoned lock 미정리 | warning, 반복 발생 시 blocked |

### Gate / rubric

| 시나리오 | 기대 응답 |
|---|---|
| policy가 요구하는데 confidence tightening 누락 | blocked |
| placeholder 존재 시 stub cap check 누락 | blocked |
| 미션 mode 또는 risk level이 요구하는 agentic-control 변경 건에서 필수 eval evidence 누락 | blocked |

### Memory evolution

| 시나리오 | 기대 응답 |
|---|---|
| weak anecdote에서 stable memory로 직접 승격 | blocked |
| superseded memory를 active normative context로 재사용 | warning, 반복 발생 시 blocked |
| harmful reuse threshold 초과인데 `under_review` 전환 없음 | conformance failure |

### Evolution loop

| 시나리오 | 기대 응답 |
|---|---|
| passed task 이후 retrospective 없음 | warning, 반복 발생 시 blocked |
| gap assessment 없이 phase 종료 | blocked |
| 알려진 debt를 transition review에서 누락 | conformance failure |

### Recovery

| 시나리오 | 기대 응답 |
|---|---|
| unsafe boundary에서 exact resume 시도 | blocked |
| 중단 후 gate artifact 없이 `verified` 주장 | 상태 복원 |
| recovery 후 partial artifact를 canonical로 취급 | blocked |

## Metrics Taxonomy

건전한 Geas 구현은 최소 6개 metric family를 관찰해야 한다. 이 family들은 프로토콜이 좋은 결과를 내고 있는지 또는 기능 부전으로 흐르고 있는지 가시성을 제공한다.

### 1) Quality

결과물이 acceptance criteria를 충족하는지, reviewer 간 품질 평가가 일치하는지 측정한다.

| metric | 추적 대상 |
|---|---|
| gate fail rate | evidence gate에서 실패하는 task 비율 |
| final verdict iterate rate | Decision Maker가 재작업을 요청하는 task 비율 |
| regression rate | 변경 후 이전에 통과하던 기준이 실패하는 경우 |
| acceptance-criterion miss rate | gate 시점에 미완성으로 표시된 기준 |
| review disagreement rate | reviewer 평가가 충돌하는 빈도 |

### 2) Reliability

프로토콜 인프라 자체가 올바르게 동작하는지 측정한다.

| metric | 추적 대상 |
|---|---|
| recovery exact-resume rate | safe boundary에서의 성공적 resume |
| recovery state-restoration rate | 이전 safe state로 rollback이 필요한 resume |
| hook error rate | 정당한 task 문제가 아닌 hook 자체 실패 |
| corrupted artifact rate | 예상치 못하게 schema validation에 실패하는 artifact |
| stale packet regeneration count | base_snapshot drift로 재생성된 packet |

### 3) Throughput

작업이 pipeline을 통해 얼마나 효율적으로 이동하는지 측정한다.

| metric | 추적 대상 |
|---|---|
| average task closure latency | `ready`에서 `passed`까지의 시간 |
| queue time before implementation | worker 배정 대기 시간 |
| integration-lane wait time | integration 접근 대기로 차단된 시간 |
| time spent blocked | task 전체에서 `blocked` 상태에 머문 총 시간 |

### 4) Safety and risk

고위험 작업이 적절한 검토를 받는지 측정한다.

| metric | 추적 대상 |
|---|---|
| critical-review challenge rate | Challenger review를 받는 high/critical task 비율 |
| policy override count | 해당 기간의 명시적 policy override 수 |
| risk-area review coverage | specialist review가 있는 위험 민감 task 비율 |
| placeholder / stub incident rate | integration 후 발견되는 stub 또는 placeholder |
| high-risk task escalation rate | 사용자에게 escalate되는 고위험 task 비율 |

### 5) Learning

프로토콜이 시간이 지남에 따라 스스로를 개선하고 있는지 측정한다.

| metric | 추적 대상 |
|---|---|
| memory promotion count | 상위 lifecycle 상태로 승격된 memory |
| successful memory reuse count | 긍정적 결과로 적용된 memory |
| harmful memory reuse count | 부정적 결과로 적용된 memory |
| rules-update count | 해당 기간의 신규 또는 수정된 rule |
| debt introduced vs resolved | 신규 debt와 해결된 debt의 균형 |

### 6) Cost / efficiency

회피 가능한 재작업이나 저가치 활동에 노력이 낭비되는지 측정한다.

| metric | 추적 대상 |
|---|---|
| repeated failure class count | 3회 이상 반복되는 고유 failure 패턴 |
| revalidation count | staleness로 인해 revalidation이 필요한 task |
| wasted speculative work count | 잘못된 가정으로 폐기된 작업 |
| low-confidence worker rate | self-check에서 1-2점을 기록하는 비율 |

## Run Summary

세션은 아래 내용을 포함하는 사람이 읽을 수 있는 run summary를 생성해야 한다:

- 다룬 task 목록과 최종 상태
- failure / 상태 복원 목록
- 주요 review 및 verdict
- memory 및 rules 변경 사항
- debt 변경 사항
- 주요 timestamp 또는 milestone

## Health Signals

Health signal은 metric에서 도출된 집계 지표로, 주의가 필요한 체계적 문제를 시사한다. 프로젝트는 규모에 적합한 구체적 threshold를 정의해야 한다.

| signal | 권장 threshold | 의미 |
|---|---|---|
| memory bloat | 최근 작업 대비 reuse 0인 항목이 많음 | memory가 도움보다 빠르게 축적되고 있음 |
| review gap | 필수 review 반복 누락 | review 엄격성이 감소하고 있음 |
| gate quality issue | 최근 task 대비 iterate rate 과다 | 요구사항 또는 gate가 불명확함 |
| contradiction accumulation | stable memory에 모순이 반복 발생 | memory review cadence가 약함 |
| repeated failure class | 동일 failure pattern 3회 이상 | rule 또는 memory hardening 필요 |
| debt stagnation | resolved debt가 accepted debt 대비 현저히 부족 | evolution phase가 효과를 내지 못함 |
| scope-control weakness | 승인 후 반복적 contract drift | planning discipline이 약함 |
| low-confidence saturation | worker self-check에서 1-2점이 너무 많음 | task가 과대하거나 context가 약함 |

## Observability Expectations

Observability는 프로토콜 동작의 사후 분석과 디버깅을 가능하게 한다. 구현은 아래를 상관시킬 수 있는 충분한 telemetry를 노출해야 한다:

| 차원 | 예시 |
|---|---|
| 어떤 task가 활성 상태였는지 | 모든 trace span에 task_id 포함 |
| 어떤 slot이 행동했는지 | 각 action에 slot 이름 부착 |
| 어떤 artifact가 생성 또는 소비되었는지 | artifact type 및 identifier |
| 어떤 gate 또는 hook이 실행되었는지 | enforcement point 이름과 결과 |
| 어떤 outcome이 발생했는지 | pass, fail, block, error, iterate |
| 리소스 소비 | 측정 가능한 경우 step별 시간 및 비용 |

Trace, metric, log 전반에 공통 naming을 사용하여 추후 분석이 가능하도록 한다.

## Detection Owner and Timing

Health 계산은 문제를 조기에 발견할 수 있도록 명확한 시점에 수행되어야 한다.

| 시점 | trigger |
|---|---|
| `learning` 중 | 각 task가 retrospective를 완료한 후 |
| phase transition review 중 | mission이 다음 phase로 이동하기 전 |
| recovery 이후 session 시작 시 | 기존 문제 감지를 위해 restore-context의 일부로 수행 |
| incident 또는 policy override 발생 시 | 예외 이벤트 직후 즉시 수행 |

결과는 가시적인 health artifact 또는 summary에 기록되어야 한다.

## Mandatory Responses

Health signal이 threshold를 초과하면, 프로젝트는 필수 response를 정의해야 한다. 권장 기본값:

| signal | 권장 응답 |
|---|---|
| memory bloat | 가치 낮은 항목 review 또는 archive |
| review gap | `pre_gate`에서 blocking 강화 |
| gate quality issue | rubric 또는 eval coverage 명확화 |
| contradiction accumulation | 해당 memory를 `under_review`로 전환 |
| repeated failure class | rule candidate 및 memory candidate 발행 |
| debt stagnation | debt 작업을 명시적으로 scheduling |
| scope-control weakness | 더 엄격한 contract amendment 요구 |
| low-confidence saturation | task 분할 또는 context packet 개선 |

## 추적 요건 Cadence

프로젝트는 최소한 아래 시점에 conformance를 review해야 한다:

- mission 종료 시
- 주요 delivery 시점
- 반복 recovery incident 이후
- 의미 있는 protocol 변경 이후
- 일반 hard-stop을 약화시킨 policy override 이후

## Policy Override

Override는 프로젝트가 제한된 상황에서 정상적인 hard-stop이나 요구사항을 의도적으로 약화시킬 때 발생한다.

Override 규칙:

- 반드시 명시적이어야 한다
- 소유자와 근거가 있어야 한다
- 범위와 만료를 명시해야 한다
- evidence 의무를 삭제해서는 안 된다
- 후속 debt 또는 review 작업을 발생시켜야 한다

위험도가 높은 작업에서는 override가 더 드물고 더 가시적이어야 한다.

## Key Statement

Enforcement는 프로토콜과 구전의 차이다. Geas가 유효하지 않은 진행을 차단할 수 없다면, 더 이상 workflow를 통치하고 있는 것이 아니다.
