# 08. Evolving Memory Lifecycle

> **기준 문서.**
> 이 문서는 교훈이 지속성 있는 memory로 전환되거나, decay, supersession, archival 과정을 거치는 상태 머신과 절차를 정의한다.

## 목적

lifecycle은 두 가지 상반된 실패 모드를 방지한다:

- **교훈 유실**: 가치 있는 교훈이 승격되지 않아 결국 잊히는 것.
- **조기 경직화**: 약한 일화를 너무 일찍 경직된 유사 규칙으로 만드는 것.

프로토콜을 준수하는 lifecycle은 memory 항목이 evidence를 통해 내구성을 확보하고, evidence 없이는 약화되도록 보장한다.

## Memory Evolution States

모든 memory 항목은 8개의 정규 state 중 정확히 하나를 차지한다. 이 state들은 승격, decay, 퇴역 파이프라인의 뼈대를 형성한다.

| State | 설명 |
|---|---|
| `candidate` | 제한된 confidence를 가진 새로 추출된 교훈. 아직 재사용에 신뢰할 수 없다. |
| `provisional` | 제한적 사용이 허용되며 신뢰 범위가 한정된 상태. 추가 evidence나 성공적 재사용을 대기 중이다. |
| `stable` | evidence와 재사용으로 충분히 뒷받침된 상태. 선언된 scope 내에서 일반적 적용이 안전하다. |
| `canonical` | 반복적으로 검증되어 높은 신뢰를 받는 상태. 규칙이나 고정 지침에 매핑되는 경우가 많다. canonical 항목은 소수로 유지해야 한다. |
| `under_review` | 모순이나 유해한 재사용으로 인해 검토가 필요하여 정상 신뢰에서 일시적으로 제외된 상태. |
| `decayed` | 이전에는 유용했으나 부실하거나 약해진 상태. 활성 사용으로 복귀하려면 새로운 evidence나 명시적 review가 필요하다. |
| `superseded` | 같은 행동 영역을 더 정확하게 다루는 새로운 교훈으로 대체된 상태. 이력용으로 보존된다. |
| `archived` | 과거 참조용으로만 보존된 상태. 활성 검색에 포함되지 않는다. |

## Source Signals

Memory candidate는 미션 실행 중 생성된 운영 산출물에서 추출할 수 있다. 대표적인 소스는 다음과 같다:

| 소스 | 예시 |
|---|---|
| Retrospective | 미션 종료 또는 phase 종료 리뷰 |
| Failure record | Evidence gate 실패, verify-fix-loop 한도 소진 |
| Specialist review | Challenger, Quality Specialist, Risk Specialist의 발견 사항 |
| Gate 결과 | pass/fail/block 결과의 패턴 |
| Recovery incident | 반복 위험이 있는 세션 복구 이슈 |
| Debt 패턴 | debt register의 반복적 항목 |
| Decision record | 결과 데이터가 포함된 구조화된 결정 |
| Gap assessment | 반복적 계획 또는 역량 격차 |

Candidate는 artifact로 뒷받침되지 않는 순수 추측에서 추출해서는 안 된다.

## Per-Task Evolution Loop

task가 `passed`에 도달한 후, evolution loop는 교훈을 포착하고 정제한다. 이 loop는 운영 경험이 재사용 가능한 memory로 전환되는 주요 메커니즘이다.

| 단계 | 동작 |
|---|---|
| 1 | task 산출물에서 교훈 추출 |
| 2 | Candidate 중복 제거 및 병합 |
| 3 | 소유자 또는 승인 authority로 라우팅 |
| 4 | 승격 또는 보류 결정 |
| 5 | 향후 재사용 시 application logging |

어떤 교훈도 생성하지 않는 task는 허용된다. 같은 교훈을 반복적으로 생성하면서 수렴하지 않는 task는 프로세스 실패를 나타낸다.

## Candidate Extraction Rules

모든 관찰이 memory 지위를 가질 자격이 있는 것은 아니다. 추출 규칙은 실행 가능한 교훈과 노이즈를 구별한다.

### 자동 추출이 허용되는 것

- 명확한 evidence가 있는 반복적 실패 패턴
- 여러 task에 걸친 반복적 reviewer 우려
- 명백한 재사용 가치가 있는 성공 패턴
- 반복 위험이 있는 recovery 이슈
- 향후 계획을 변경할 수 있는 gap-assessment 패턴

### 자동 추출이 허용되지 않는 것

- 운영상 결과가 없는 순수 주관적 선호
- evidence 비중이 없는 미해결 논쟁
- 반복이나 전이 가치가 없는 일회성 새로움
- 로컬 보존 정책에 의해 금지된 콘텐츠

## Minimum Candidate Fields

candidate 레코드는 교훈, 출처, 제안된 행동 변경을 포착한다. 최소한 다음 필드를 포함해야 한다:

| 필드 | 용도 |
|---|---|
| `memory_id` | 고유 식별자 |
| `summary` | 사람이 읽을 수 있는 교훈 설명 |
| `scope` | 교훈이 적용되는 범위 (task, mission, project, agent, global) |
| `source_artifact_refs[]` | 교훈을 뒷받침하는 evidence 링크 |
| `confidence` | 수치 신뢰 점수 (0.0 -- 1.0) |
| `proposed_behavior_change` | 교훈이 적용될 경우 향후 행동이 어떻게 변해야 하는지 |
| `owner_type` | 이 memory 항목을 소유하는 에이전트 슬롯 |
| `state` | 현재 lifecycle state |
| `created_at` | 추출 시점 |

## Promotion Pipeline

promotion pipeline은 memory 항목을 원시 추출에서 review를 거쳐 활성 사용까지 이동시킨다. 각 stage는 confidence를 추가하거나 약한 candidate를 걸러낸다.

| Stage | 이름 | 설명 |
|---|---|---|
| 1 | Candidate creation | 추출기가 교훈을 기록하고 소스 evidence에 연결한다. |
| 2 | Dedupe / merge | 동등하거나 겹치는 candidate를 병합하여 memory 비대화를 방지한다. |
| 3 | Review | 적절한 authority 또는 reviewer가 evidence 충분성, scope 정확성, 전이 가능성, 과잉 일반화 위험, 예상 행동 영향을 평가한다. |
| 4 | Promotion | 현재 state의 최소 요건이 충족된 경우에만 다음 state로 진행한다. |
| 5 | Application logging | 향후 작업에 사용되면, 시스템이 해당 memory가 도움이 됐는지, 중립이었는지, 해가 됐는지 기록한다. |
| 6 | Reinforcement / weakening | 실제 재사용 결과에 따라 confidence와 state가 변경될 수 있다. |

## Promotion Rules

각 state 전환에는 특정 요건이 있다. 요건을 충족하지 않고 승격하면 memory 신뢰가 훼손된다.

### `candidate` to `provisional`

다음 조건이 충족될 때 권장:

- 실제 artifact에 연결되는 evidence가 존재
- 교훈이 향후 작업에 유용해 보임
- 전이 가능성이 그럴듯함
- 강한 모순이 없음

### `provisional` to `stable`

다음 조건이 충족될 때 권장:

- 해당 항목이 최소 한 번 성공적으로 재사용되었거나 강력한 다중 소스 evidence가 있음
- 소유자 review에서 scope가 올바르다고 동의
- 모순 횟수가 적거나 없음

### `stable` to `canonical`

다음 조건이 **모두** 충족될 때만 권장:

- 여러 task 또는 mission에 걸쳐 성공적 재사용이 반복됨
- 교훈이 시간이나 맥락에 걸쳐 유효하게 유지됨
- 해당 항목이 향후 프로세스, 안전, 또는 품질에 강하게 영향을 미침
- 더 강한 assurance profile이 고정 지침으로 요구

프로젝트는 canonical 항목의 수를 적게 유지해야 한다.

## Rules.md Update Loop

일부 memory는 규칙 지위를 가질 자격이 있다. 교훈이 단순히 context packet에 나타나는 것이 아니라 전역 또는 준전역적으로 행동을 변경해야 할 때 규칙 승격을 사용한다.

### Rule candidate sources

- 반복적 실패 패턴
- 반복적 reviewer 누락
- 반복적 recovery 실수
- 반복적 scope-control 이슈
- 반복적 안전 또는 품질 사각지대

### Rule update conditions

Rule candidate는 다음 중 하나 이상을 충족해야 한다:

- 여러 task의 뒷받침 evidence
- 미해결 모순이 없음
- 소유자 승인
- 예상되는 행동 변경에 대한 명시적 근거

### Rule application

규칙이 승인되면, 구현은 다음 중 하나 이상을 어떻게 변경하는지 명시해야 한다:

| 영역 | 변경 예시 |
|---|---|
| Task compiler 기본값 | 새로운 분류 또는 라우팅 규칙 |
| Contract 체크리스트 | 추가 수용 기준 |
| Review 체크리스트 | specialist reviewer의 새로운 초점 영역 |
| Gate 초점 | 조정된 evidence 요건 |
| Readiness-round 트리거 | 새로운 준비 조건 |
| Recovery 처리 | 수정된 recovery heuristic |

## Agent Memory Improvement Path

역할별 교훈은 다음과 같은 경우 `agent_memory`를 선호해야 한다:

- 교훈이 주로 해당 슬롯의 review 또는 implementation 행동에 관한 것
- artifact 유형이 주로 해당 슬롯이 생산하는 것
- 교훈이 전역 프로세스보다 specialist 체크리스트를 더 개선

그 외의 경우에는 project-level memory를 선호한다.

## Confidence and Freshness

confidence와 freshness는 memory 신뢰의 관련되지만 구별되는 두 차원이다.

| 차원 | 답하는 질문 |
|---|---|
| Confidence | "이 교훈을 얼마나 신뢰해야 하는가?" |
| Freshness | "이 교훈이 여전히 현재 유효할 가능성이 얼마나 되는가?" |

memory가 high-confidence이지만 low-freshness일 수 있다 (예: 이후 재설계된 인터페이스에 대해 잘 입증된 교훈). 이 경우 freshness가 재확인될 때까지 재사용은 보수적이어야 한다.

## Decay Rules

memory는 다음과 같은 경우 `decayed` state 고려 대상이다:

- `review_after`가 재확인 없이 경과
- 모순 횟수가 증가
- 재사용 횟수가 너무 오래 0으로 유지
- 주변 프로젝트 구조나 아키텍처가 실질적으로 변경됨

### Decayed-state exit

decayed memory는 새로운 뒷받침 evidence 또는 명시적 review 후에만 더 강한 state로 복귀할 수 있다. 시스템은 새로운 근거 없이 decayed 항목을 자동으로 복원해서는 안 된다.

## Supersession

memory는 더 새로운 항목이 같은 행동 영역을 더 정확하게 다룰 때 `superseded` state가 된다. Supersession은 부실한 지침을 방지하면서 조직의 이력을 보존한다.

| 규칙 | 설명 |
|---|---|
| 이력 보존 | Supersession은 이전 항목의 이력을 보존해야 한다 |
| 순방향 참조 | 대체 항목은 이전 항목을 참조해야 한다 |
| 활성 사용 금지 | Superseded memory는 recovery 또는 감사 워크플로우가 명시적으로 과거 비교를 요청하지 않는 한 활성 지침으로 사용해서는 안 된다 |

## Negative Learning and Harmful Reuse

memory 재사용이 반복적으로 결과에 해를 끼치면, 시스템은 다음을 수행해야 한다:

1. 해당 항목을 `under_review`로 이동
2. 부정적 적용 사례를 기록
3. scope가 잘못됐는지, 교훈이 부실해졌는지, 원본 evidence가 약했는지 검사
4. 수정, decay, supersede, 또는 archive 여부를 결정

반복적 유해 재사용은 단순히 memory review가 아닌 규칙 또는 체크리스트 review를 트리거해야 한다.

## Application Logging

시스템은 `memory-application-log` 또는 동등한 기록을 유지해야 한다. 이 로그는 우아한 이론과 실제로 유용한 지침을 구별하는 데 필수적이다.

| 필드 | 설명 |
|---|---|
| `memory_id` | 적용된 memory 항목 |
| `task_id` | 적용된 task |
| `applied_at` | 파이프라인에서 memory가 사용된 위치 |
| `effect` | `positive`, `neutral`, 또는 `negative` |
| `notes` | 자유 텍스트 설명 |
| `timestamp` | 적용 시점 |

## Anti-Bloat Rules

프로토콜을 준수하는 구현은 memory 비대화를 적극적으로 제어해야 한다. 적극적 관리 없이는 memory 저장소가 끝없이 증가하고 검색 품질이 저하된다.

권장 정책:

- candidate 생성 시 중복 병합
- 사용되지 않는 저가치 항목을 주기적으로 archive
- canonical memory를 적게 유지
- 재사용 횟수 0인 항목을 정기적으로 검토
- 구체적 행동 변경 없는 모호한 조언의 승격 거부

## 핵심 문장

lifecycle은 Geas memory의 면역 체계이다. 승격 규율이 없으면 memory는 약한 채로 남고, decay와 supersession이 없으면 memory는 화석화된 잡동사니가 된다.
