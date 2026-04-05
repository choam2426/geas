# 05. Gate, Vote, and Final Verdict

> **기준 문서.**
> Evidence gate, 루브릭 채점, vote round, closure packet 완전성, critical review challenge, final verdict를 정의한다.

## 목적

Geas는 자주 잘못 합쳐지는 세 가지 메커니즘을 분리한다:

- **Evidence Gate** — 객관적 검증
- **Vote Round** — 판단이 엇갈리거나 출시 리스크가 클 때의 구조화된 심의
- **Final Verdict** — 제품 수준의 종결 결정

이 분리는 필수다. 셋 중 하나가 다른 하나를 대체하는 것을 허용해서는 안 된다.

## 핵심 분리 원칙

1. 게이트는 evidence를 검증한다. 제품 전략을 판단하지 않는다.
2. vote round는 이견이나 준비 상태를 심의한다. 빠진 evidence를 만들어내지 않는다.
3. Final verdict는 완전한 패킷을 보고 판단한다. 직감만으로 결정하지 않는다.
4. `iterate`는 final verdict 계층에 속한다. 게이트 계층이 아니다.
5. 게이트 통과가 자동으로 `passed`를 의미하지 않는다.

## Evidence Gate

Evidence gate는 task의 산출물이 요구 기준을 충족하는지 판정하는 3단계 순차 검증 장치다. 구현과 리뷰가 완료된 후 실행되며, 결과(`pass | fail | block | error`)에 따라 task가 종결로 진행할 수 있는지 결정된다. 게이트는 제품 전략을 판단하지 않는다 — evidence가 존재하고 임계값을 충족하는지만 검증한다.

### 게이트 프로필

| gate_profile | Tier 0 | Tier 1 | Tier 2 | 용도 |
|---|---|---|---|---|
| `implementation_change` | 실행 | 실행 | 실행 | 주 산출물을 생산하거나 수정하는 task |
| `artifact_only` | 실행 | 생략 또는 축소 | 실행 | 주 구현 변경 없는 문서, 설계, 검토, 분석 task |
| `closure_ready` | 실행 | 선택 | 간소화된 완전성 + 준비 상태 확인 | 정리, 전달, 종결 조립 task |

프로필을 강화하는 것은 가능하지만, 정책 문서화 없이 약화하는 것은 허용하지 않는다.

## Tier 0 — 사전 점검

task가 게이트에 진입할 수 있는 상태인지 확인한다.

확인 항목:

- 필수 artifact 존재 여부
- task 상태의 적격성
- baseline / 통합 전제 조건
- 필수 리뷰 세트 존재 여부
- worker self-check 존재 여부 (필요한 경우)
- 패킷 최신성 (해당되는 경우)

### Tier 0 결과

- 필수 artifact 누락 → `block`
- 부적격 상태 → `error`
- stale 또는 불일치 baseline → `block`
- 검증기 또는 환경 장애 → `error`

Tier 0에서 통과하지 못하면 이후 단계를 즉시 중단한다.

## Tier 1 — 기계적 검증

객관적이고 반복 가능한 검증을 통과하는지 확인한다.

도메인별 예시:

- **소프트웨어**: build, lint, test, type-check
- **리서치**: 출처 검증, 인용 유효성 확인, 통계 재현성 점검
- **콘텐츠**: 문법 검사, 스타일 린트, 사실 확인, 링크 유효성
- **공통**: schema 검증, 생성된 artifact 유효성, 재현 가능한 명령 실행, 벤치마크 또는 eval 하네스 실행 (task가 요구하는 경우)

`artifact_only` 작업에서 Tier 1을 축소할 수 있지만, 도메인에 맞는 기계적 검증이 존재하면 완전히 생략해서는 안 된다 (예: 리서치의 인용 검증, 콘텐츠의 사실 확인, 데이터의 schema 검증). 반복 가능한 검증 수단이 전혀 없는 경우에만 전체 생략을 허용한다.

### 기계적 evidence 기록 요건

Tier 1 evidence에 포함해야 할 것:

- 실행한 명령 또는 하네스
- 종료 상태
- 타임스탬프
- 중요한 환경 조건
- 실패한 검증 항목과 위치

## Tier 2 — 계약 및 루브릭 검증

제출된 작업이 승인된 계약과 수용 기준을 충족하는지 확인한다.

Tier 2가 확인하는 것:

- 수용 기준 충족 여부
- 범위 위반
- 필수 검증 항목과 시연 절차
- 알려진 리스크 처리 상태
- 리뷰 결과
- 루브릭 임계값
- stub 또는 placeholder 확인
- 변경이 승인된 계획에 실질적으로 충실한지

### 알려진 리스크 처리

`known_risks`의 모든 항목은 종결 시점에 다음 중 하나의 상태여야 한다:

| 상태 | 설명 |
|---|---|
| 완화 | 리스크에 대한 대응 조치를 실행했다 |
| 수용 | 근거를 명시한 뒤 리스크를 감수하기로 했다 |
| 유예 | 근거를 명시한 뒤 부채로 등록하고 이후에 처리한다 |

계약에 있던 리스크가 종결 시점에 언급 없이 빠지는 것은 허용하지 않는다.

## Gate Verdict

정규 결과:

| 판결 | 의미 | 재시도 한도 영향 |
|---|---|---:|
| `pass` | 필수 게이트 조건 통과 | 0 |
| `fail` | 구현 또는 검증 품질 문제 | 1 소진 |
| `block` | 구조적 전제 조건 누락 또는 미해소 | 0 |
| `error` | 게이트 실행 자체가 실패하거나 신뢰할 수 없음 | 기본 0 |

## `fail`과 `block`의 차이

이 구분은 중요하다.

### `fail`
구현을 개선해서 다시 제출할 수 있을 때 사용한다.

예시:

- 검증 실패
- 루브릭 최소 임계값 미달
- 회귀 동작 발견
- 수용 기준 미충족

### `block`
진행 자체가 구조적으로 불가능할 때 사용한다.

예시:

- artifact 누락
- 필수 specialist 리뷰 누락
- baseline 불일치
- 정책이 금지하는 수준의 stub 초과
- 불완전한 패킷 의존성

`block`에 해당하는 것을 `fail`로 분류해서 재시도 한도를 소진시키며 진행하는 것은 허용하지 않는다.

## 게이트 오류 처리

게이트가 `error`를 반환하면:

1. 실행 문제를 기록한다
2. 재시도 한도는 기본적으로 소진하지 않는다
3. 환경 또는 도구 원인을 해소한다
4. 보수적으로 재실행한다

같은 원인으로 `error`가 반복되면, 원인이 운영적인지 관할 문제인지에 따라 `blocked` 또는 `escalated`로 격상한다.

## 루브릭 채점

루브릭은 Tier 2에서 산출물의 품질을 정량 평가하는 도구다. 각 차원에 1-5 점수를 매기고, 임계값 미달 차원이 하나라도 있으면 Tier 2가 실패한다. 기계적 검증(Tier 1)이 "돌아가는가"를 확인한다면, 루브릭은 "잘 만들어졌는가"를 확인한다.

### 기본 차원

| 차원 | 평가 대상 | 주 평가자 | 기본 임계값 |
|---|---|---|---:|
| `core_interaction` | 핵심 동작이 의도대로 작동하는가 | Quality Specialist | 3 |
| `output_completeness` | 수용 기준을 빠짐없이 충족하는가 | Quality Specialist | 4 |
| `output_quality` | 산출물의 구조적·방법론적 품질이 충분한가 | Design Authority | 4 |
| `regression_safety` | 기존 동작에 악영향을 주지 않는가 | Quality Specialist | 4 |

### 선택적 추가 차원

프로젝트의 도메인과 필요에 따라 차원을 추가할 수 있다:

| 차원 | 평가 대상 |
|---|---|
| `ux_clarity` | 사용자 흐름과 인터페이스의 명확성 |
| `visual_coherence` | 시각적 일관성과 디자인 의도 부합 |
| `security_posture` | 보안 경계와 신뢰 모델의 건전성 |
| `operational_readiness` | 운영·배포·롤백 준비 상태 |
| `documentation_completeness` | 문서화 수준과 정확성 |
| `migration_safety` | 마이그레이션·전환의 안전성 |
| `evaluation_quality` | 에이전틱 변경에 대한 평가 evidence 충실도 |

### 채점 규칙

- 점수 범위는 1-5
- 임계값에 미달하는 차원이 하나라도 있으면 Tier 2 실패 (문서화된 프로필 예외가 없는 한)
- 실패 원인이 된 차원을 `blocking_dimensions[]`에 기록하여 검증-수정 루프에서 활용한다
- 임계값은 명시적 정책으로만 변경 가능하며, 즉흥적 판단으로 바꿀 수 없다

## 낮은 Confidence 조정

Worker self-check의 `confidence`가 2 이하이면 게이트 검증을 강화한다.

기본 정책:

- 해당 게이트 실행에서 모든 루브릭 임계값을 +1 상향 (최대 5)

프로젝트가 차원별 confidence 모델을 도입할 수 있지만, 그때까지는 이 전역 규칙을 적용한다.

## Stub 및 Placeholder 정책

Stub은 아직 완성되지 않은 임시 구현이다. "TODO"로 남긴 함수, 하드코딩된 반환값, 실제 로직 대신 넣어둔 더미 응답 등이 해당한다. Worker self-check의 `possible_stubs[]`에 선언된 것과 선언되지 않은 것 모두 게이트가 검사 대상으로 삼는다.

### risk level별 기본 stub 허용 수

| risk_level | 기본 stub 상한 |
|---|---:|
| `low` | 3 |
| `normal` | 2 |
| `high` | 0 |
| `critical` | 0 |

규칙:

- 확인된 stub은 완성도 점수에 상한을 둔다
- 허용 수를 초과하면 `block`을 발생시킨다
- 미선언 stub이 발견되면 선언된 stub보다 더 심각하게 취급하며, 신뢰도를 낮추는 evidence로 간주한다

## 에이전틱 작업의 평가 규율

task가 프롬프트, 도구, 메모리 동작, 라우팅 로직, 기타 에이전틱 제어 표면을 변경하는 경우, Tier 1 또는 Tier 2에 단위 테스트만이 아닌 대표적 평가를 포함해야 한다.

최소한 검증자가 확인해야 할 것:

- 목표 성공률이 개선되었는가
- 알려진 어려운 사례에서 회귀가 발생했는가
- 안전성 또는 정책 위반이 증가했는가
- 비용이나 지연 시간이 유의미하게 변했는가

특정 벤더의 eval 시스템이 필요한 것은 아니지만, 명시적으로 측정된 evidence는 필요하다.

## Worker Self-Check 활용

시스템은 `worker-self-check.json`을 단순 기록이 아닌 실질적 입력으로 활용해야 한다. Self-check가 직접 영향을 주는 영역:

- 리뷰 초점 설정
- Quality Specialist 검증 계획 수립
- stub 확인
- 임계값 상향 조정
- 부채 및 메모리 후보 추출
- agent memory 추출

Self-check를 수집하면서 활용하지 않는 것은 형식적 리뷰에 해당하며 프로토콜 위반이다.

## vote round

vote round는 여러 역할이 논쟁적인 결정에 대해 의견을 내는 구조화된 심의다. Evidence만으로 결론이 나지 않을 때 — 판단, 트레이드오프, 상충하는 관점을 한 역할이 단독으로 결정하는 대신 명시적으로 풀어야 할 때 사용한다.

vote round는 evidence를 대체하지 않는다. Evidence를 두고 어떻게 할지를 결정한다.

### vote round의 두 유형

| 유형 | 시점 | 주요 참여자 |
|---|---|---|
| `proposal_round` | 작업 시작 전 — 디자인 브리프 승인, 주요 구조적·방법론적 결정, 횡단적 제안 채택 | Design Authority, 관련 specialist, Decision Maker |
| `readiness_round` | 종결 전 — 고위험 출시 준비 확인, 차단 challenge의 공식 처리, 완성도와 긴급성 간 트레이드오프 해소 | Orchestrator, Decision Maker, Challenger, 관련 specialist |

### `vote_round_policy`

각 task가 vote round를 언제 진행할지 선언한다:

| 값 | 동작 |
|---|---|
| `never` | 재량적 라운드를 건너뜀 (필수 갈등 처리는 여전히 적용) |
| `auto` | 촉발 조건이 충족되면 진행 |
| `always` | final verdict 전에 항상 readiness round를 진행 |

### `auto` 촉발 조건

다음 중 하나라도 해당하면 readiness round가 진행된다:

- `risk_level`이 `high` 또는 `critical`
- 필수 리뷰어 간 실질적 의견 불일치
- 미해소 리스크가 남아 있음
- 범위 밖 변경이 발생
- 실패 또는 iterate 이후 재제출
- Decision Maker나 Orchestrator가 명시적으로 심의를 요청

### Vote 결과

| 결과 | 의미 |
|---|---|
| `ship` | 참여자가 verdict로 진행해도 된다고 합의 |
| `iterate` | 참여자가 추가 작업이 필요하다고 합의 |
| `escalate` | 현재 권한 수준에서 합의에 도달할 수 없음 |

Vote 결과에는 참여자 목록을 포함한다. 만장일치가 아닌 경우 반대 의견을 반드시 기록한다.

### Vote round 반복 상한

단일 vote round 안건은 최대 3회 심의를 초과할 수 없다. 3회 내에 합의에 도달하지 못하면 vote 결과는 반드시 `escalate`이어야 한다.

## Closure Packet

Closure packet은 task의 전체 이야기를 하나로 압축한 evidence 묶음이다. Decision Maker는 이 패킷만 보고 final verdict를 내린다. 패킷이 불완전하면 verdict를 내릴 수 없다.

### 필수 필드

| 필드 | 설명 |
|---|---|
| `task_summary` | 이 task가 무엇을 달성했는지 |
| `change_summary` | 무엇이 어디서 바뀌었는지 |
| `specialist_reviews[]` | 필수 specialist 슬롯이 제출한 리뷰 |
| `integration_result` | baseline에 변경을 반영한 결과 |
| `verification_result` | evidence gate 판정 결과 |
| `worker_self_check` | worker가 작성한 자기 점검 |
| `open_risks` | 인지했으나 완전히 해소하지 못한 리스크 |
| `debt_snapshot` | 이 task가 남긴 부채 |
| `readiness_round` | vote round 결과. 진행하지 않았으면 명시적 null |
| `challenge_review` | Challenger의 사전 검증 결과. high/critical에서 필수, low/normal에서는 명시적 null |

### 완전성 규칙

Closure packet이 완전하다고 인정되려면 다음을 모두 충족해야 한다:

- 위 필수 필드가 전부 존재한다
- 필수 리뷰어의 산출물이 빠짐없이 포함되어 있다
- 미해소 차단 사안이 실제로 해소되었거나, 인정된 리스크로서 정식 경로를 통해 이월되어 있다
- artifact 참조가 서로 일관된다
- 패킷의 모든 내용이 현재 검증된 제출물을 가리킨다 (이전 버전이 아님)

이 규칙을 충족하지 않으면서 "충분히 완전하다"고 서술로 주장하는 것은 허용하지 않는다.

## Closure Packet 내 specialist 리뷰

각 specialist 리뷰에 포함해야 할 필드:

| 필드 | 설명 |
|---|---|
| `reviewer_type` | 리뷰를 작성한 specialist 슬롯 |
| `status` | `approved`, `changes_requested`, 또는 `blocked` |
| `summary` | 리뷰 결과와 판단 근거 |
| `blocking_concerns[]` | 개별적으로 대응할 수 있는 차단 사안 목록 |
| `evidence_refs[]` | 리뷰 과정에서 검토한 artifact |
| `rubric_scores[]` | 루브릭 차원별 점수 (선택) |

차단 사안은 하나씩 식별하고 대응할 수 있는 형태여야 한다. "우려가 여러 가지 있다" 수준으로는 부족하다.

## Critical Review Challenge

일반 리뷰어는 "이게 맞는가"를 확인한다. Challenger는 반대로 "이게 왜 틀릴 수 있는가"를 찾는다. 협력적 리뷰에서는 모두가 성공을 전제하고 보기 때문에, 의도적으로 반대 입장에서 검증하는 역할이 따로 필요하다.

Challenger가 찾아내야 하는 것:

| 대상 | 예시 |
|---|---|
| 숨겨진 가정 | "이 API는 항상 200을 반환한다"고 전제했지만 실제로 검증하지 않음 |
| 과신 | worker confidence가 5인데 테스트 커버리지가 낮음 |
| 취약한 복잡성 | 동작은 하지만 조건이 하나만 바뀌어도 깨질 구조 |
| 성급한 출시 논리 | "일단 내보내고 고치자"식 판단이 근거 없이 채택됨 |
| 미검토 부정 시나리오 | 정상 경로만 테스트하고 실패 경로를 확인하지 않음 |

### 규칙

- `high`와 `critical` task에서 필수
- 실질적인 문제 제기를 최소 하나 이상 포함해야 한다
- 각 문제 제기가 차단 사안인지 조언 사안인지 구분해야 한다
- 결과를 `challenge-review.json`에 기록한다

### 차단 사안이 나오면

다음 중 하나로 처리한다:

| 처리 방법 | 설명 |
|---|---|
| verdict 전 해소 | 문제를 수정하거나 근거를 보완한 뒤 다시 제출 |
| readiness round 이관 | 여러 관점의 심의가 필요한 경우 vote round로 넘김 |
| 에스컬레이션 | 현재 권한으로 판단할 수 없는 경우 사용자에게 올림 |

차단 사안을 closure packet에서 누락시키는 것은 허용하지 않는다.

## Final Verdict

Final verdict는 프로토콜에서 task를 종결할 수 있는 유일한 메커니즘이다. Evidence gate가 "검증을 통과했는가"를 판정한다면, final verdict는 "이 결과를 제품으로 받아들일 것인가"를 판정한다. Decision Maker만이 이 판결을 내릴 수 있으며, closure packet에 근거해야 한다.

### 판결 종류

| 판결 | 효과 | 재시도 한도 영향 |
|---|---|---|
| `pass` | task가 `passed` 상태가 된다. 완료 | 없음 |
| `iterate` | 명시적 상태 복원 대상을 지정하고 추가 작업을 요구한다 | 소진하지 않음 (단, iterate 반복 상한에 카운트) |
| `escalate` | 현재 권한으로 결정할 수 없어 사용자에게 올린다 | 없음 |

### `pass`를 내릴 수 없는 조건

다음 중 하나라도 해당하면 `pass` 판결이 금지된다:

| 조건 | 이유 |
|---|---|
| closure packet이 불완전 | 판단 근거 자체가 부족하다 |
| evidence gate를 통과하지 못함 | 검증되지 않은 결과를 수용할 수 없다 |
| 필수 리뷰가 누락됨 | 필요한 관점이 빠져 있다 |
| 미해소 차단 사안이 정식 경로를 거치지 않음 | 알려진 문제를 무시한 채 통과시킬 수 없다 |
| task 상태가 `verified`가 아님 | 상태 전이 규칙 위반이다 |
| evidence가 이전 또는 불일치 제출물을 가리킴 | 현재 결과가 아닌 것으로 판단할 수 없다 |

### `iterate` 규칙

`iterate`는 게이트 실패가 아니라 제품 판단이다. "검증은 통과했지만 제품으로 받아들이기엔 부족하다"는 뜻이다. 재시도 한도를 소진하지 않지만 다음을 반드시 기록한다:

| 기록 항목 | 설명 |
|---|---|
| 거부 사유 | 현재 결과가 왜 수용할 수 없는지 |
| 상태 복원 대상 | 어떤 상태로 돌아가서 작업을 재개할지 |
| 새로운 기대치 | 다음 제출에서 달라져야 할 수용 기준이나 트레이드오프 |

불확실성이 좁혀지지 않는 채 `iterate`가 반복되면 에스컬레이션을 촉발한다.

## 종결 이후

Task가 `passed`가 된다고 해석이 끝나는 것은 아니다. 종결 과정에서 드러난 정보는 시스템의 미래 행동으로 이어져야 한다.

| 종결 시 드러난 것 | 반영 대상 |
|---|---|
| 해소하지 못한 타협 | 부채 등록 |
| 예상보다 많거나 적게 전달한 범위 | gap 평가 |
| 반복되는 판결 패턴 | 규칙 및 메모리 |

## 핵심 선언

성숙한 워크플로는 하나의 메커니즘에 모든 역할을 맡기지 않는다. Evidence gate는 검증하고, vote round는 심의하고, final verdict는 결정한다. 이 경계가 흐려지면 신뢰가 무너진다.
