# 03. Task Model and Lifecycle

> **기준 문서.**
> task 분류, 필수 메타데이터, 계약 품질 규칙, 상태 전이, 상태 복원, 재시도 한도, 범위 통제를 정의한다.

## 목적

Geas에서 task는 작업의 최소 완료 단위다. task 모델이 존재하는 이유는 작업 단위마다 다음에 답할 수 있어야 하기 때문이다:

- 정확히 무엇이 바뀌는가
- 얼마나 위험한가
- 누가 해야 하는가
- 누가 리뷰해야 하는가
- 성공했다는 걸 어떤 evidence가 증명하는가
- 실패하면 어디로 되감는가
- 숨겨진 범위나 부채가 들어왔는가

## task 분류

### `task_kind`

task가 무엇을 만들거나 수행하는지를 나타낸다.

| 값 | 의미 | 주 작업자 슬롯 |
|---|---|---|
| `implementation` | 핵심 산출물을 생산하거나 수정 | Implementer |
| `documentation` | 문서, 가이드, 참고자료 작성·갱신 | Communication Specialist |
| `configuration` | 파라미터, 환경, 템플릿 설정·변경 | Operations Specialist |
| `design` | 구조적, 시각적, 방법론적 설계 생성·수정 | Implementer 또는 Design Authority |
| `review` | 기존 작업물에 대한 평가, 감사, 검토 수행 | Risk Specialist 또는 Quality Specialist |
| `analysis` | 데이터, 시스템, 소스를 조사·탐색하여 인사이트 도출 | Implementer 또는 Quality Specialist |
| `delivery` | 릴리스, 발행, 최종 산출물 패키징·전달 | Operations Specialist |

프로젝트가 하위 분류(예: `implementation:frontend`, `review:security`)를 추가로 정의할 수 있지만, 상위 종류는 반드시 식별 가능해야 한다.

### `risk_level`

task가 잘못됐을 때 얼마나 큰 피해를 줄 수 있는지를 나타낸다.

| 값 | 의미 |
|---|---|
| `low` | 영향 범위가 좁고 롤백이 쉬운 변경 |
| `normal` | 일반적인 작업 |
| `high` | 영향 범위가 크거나, 불확실하거나, 민감한 표면에 닿는 변경 |
| `critical` | 안전·신뢰·프로덕션에 직결되어 실패 비용이 큰 변경 |

### `gate_profile`

task에 어떤 게이트 단계를 적용할지 결정한다.

| 값 | Tier 0 | Tier 1 | Tier 2 | 사용 시점 |
|---|---|---|---|---|
| `implementation_change` | 실행 | 실행 | 실행 | 주 산출물을 생산하거나 수정하는 task |
| `artifact_only` | 실행 | 생략 또는 축소 | 실행 | 주 구현 변경 없는 문서, 설계, 검토, 분석 task |
| `closure_ready` | 실행 | 선택 | 간소화 | 정리, 전달, 종결 조립 task |

### `vote_round_policy`

task에 구조화된 심의를 언제 진행할지 결정한다.

| 값 | 의미 |
|---|---|
| `never` | 재량적 준비 상태 라운드를 건너뜀 (필수 갈등 처리는 여전히 적용) |
| `auto` | 촉발 조건이 충족되면 진행 (고위험, 리뷰어 의견 충돌, 미해소 리스크, 재제출) |
| `always` | final verdict 전에 항상 준비 상태 라운드를 진행 |

## task 핵심 메타데이터

### 필수 필드

task에 반드시 있어야 하는 것:

| 필드 | 설명 |
|---|---|
| `task_id` | task 고유 식별자 |
| `title` | 사람이 읽을 수 있는 짧은 이름 |
| `description` | 이 task가 무엇을 달성하고 왜 하는지 |
| `task_kind` | 작업 유형 분류 (task 분류 참조) |
| `risk_level` | 영향 범위와 실패 비용 평가 |
| `status` | 현재 생명주기 상태 |
| `base_snapshot` | task 진입 시점의 공유 작업 상태 참조 — staleness 감지, 통합 기준, 롤백 지점으로 쓰인다 |
| `scope.surfaces` | 영향받는 표면, 경로, 도메인 |
| `acceptance_criteria[]` | 완료를 정의하는 관찰 가능하고 반증 가능한 조건 |
| `routing.primary_worker_type` | 주 구현자로 배정된 specialist 타입 |
| `routing.required_reviewer_types[]` | 리뷰 필수 specialist 타입 (라우팅 알고리즘이 산출) |
| `gate_profile` | 적용할 게이트 단계 |
| `vote_round_policy` | 구조화된 심의 시점 |
| `retry_budget` | 남은 검증 재시도 횟수 |
| `workspace` | 이 task를 위한 격리된 실행 환경 |

### 추가 권장 필드

미션 mode에 따라 엄격도가 결정된다: `lightweight`(가장 가벼움) → `standard` → `full_depth`(가장 엄격). 아래 필드는 `lightweight`에서는 생략 가능, `standard`에서는 포함 권장, `full_depth`에서는 사실상 필수.

| 필드 | 설명 |
|---|---|
| `non_goals` | 이 task가 명시적으로 하지 않을 것 |
| `affected_interfaces` | 변경으로 영향받는 인터페이스, 계약, schema |
| `rollback_notes` | 필요시 변경을 되돌리는 방법 |
| `observability_notes` | 운영 중 변경을 모니터링하는 방법 |
| `sensitive_surfaces` | 변경이 닿는 신뢰 경계, 인증 정보, 고위험 영역 |
| `out_of_scope_policy` | 승인된 계획 밖의 작업이 발견됐을 때 처리 방식 |
| `dependencies` | 가정과 외부 의존성 |
| `demo_steps` | 기대 결과를 시연하거나 재현하는 방법 |
| `phase_traceability` | 이 task를 촉발한 미션 단계와의 연결 |

## 수용 기준 작성 원칙

수용 기준은 충족 여부를 판단할 수 있을 만큼 구체적이어야 한다. 각 기준이 갖춰야 할 속성:

- **관찰 가능** — 통과 여부를 누가 봐도 알 수 있다
- **범위 한정** — 기준이 다루는 범위가 분명하고, 끝없는 정리 작업으로 번지지 않는다
- **반증 가능** — "이게 안 되면 이런 모습"을 구체적으로 떠올릴 수 있다
- **비중복** — 다른 기준을 달리 표현한 것이 아니다
- **비모순** — 다른 기준이나 알려진 제약과 충돌하지 않는다

나쁜 기준 예시: "기능이 더 좋아져야 한다."
좋은 기준 예시:
- 소프트웨어: "유효하지 않은 토큰을 제출하면 HTTP 401을 반환하고 재인증 경로를 보여준다."
- 리서치: "문헌 리뷰가 2020년 이후 독립 출처를 최소 3개 다루고 모순점을 식별한다."
- 콘텐츠: "요약이 200단어 이내이고, 원 출처를 인용하며, 근거 없는 주장을 포함하지 않는다."

## task 분해 규칙

다음 중 하나라도 해당하면 구현 전에 task를 쪼개야 한다:

- 리뷰를 따로 받아야 하는 영역을 둘 이상 걸친다
- 큰 구조 변경과 사용자에게 보이는 동작 변경이 한 task에 섞여 있다
- 리뷰어들이 서로 다른 곳에 집중해야 해서 한꺼번에 보기 어렵다
- 관련 없는 곳을 여럿 바꾸는데, "이 task가 뭘 완성했다"를 하나로 말할 수 없다
- worker가 "이건 안 한다"를 명확히 말하지 못한다
- 실제 영향 범위가 설정된 risk level보다 넓어 보인다

`critical` task는 실용적으로 가능한 한 작게 유지해야 한다.

## task 상태

### 주 상태

| 상태 | 의미 |
|---|---|
| `drafted` | task가 만들어졌지만 아직 착수할 준비가 안 됨 |
| `ready` | 승인되었고, baseline이 유효하며, 구현을 시작할 수 있음 |
| `implementing` | 격리된 작업 공간에서 주 작업 진행 중 |
| `reviewed` | 구현 산출물이 있고 필수 리뷰가 완료됨 |
| `integrated` | 변경이 공유 baseline에 반영됨 |
| `verified` | evidence gate를 통과함 |
| `passed` | Decision Maker가 closure packet을 수용함 — 완료 |

### 보조 상태

| 상태 | 의미 |
|---|---|
| `blocked` | 외부·구조적 문제가 해소되지 않으면 진행할 수 없음 |
| `escalated` | 현재 권한으로는 결정할 수 없어 상위 판단이 필요함 |
| `cancelled` | 사유를 기록하고 의도적으로 중단됨 |

## 실패는 상태가 아니다

실패는 task 상태가 아니다. gate가 실패하거나 verdict가 iterate되면, `geas task transition`으로 rewind target 상태로 되돌린다. 실패는 `events.jsonl`에 이벤트로 기록한다 (이벤트 유형: `gate_failed`, `verdict_iterate`, `unrecoverable_error`). 별도 failure artifact는 필요하지 않다.

## 구현 계약

구현 계약은 worker와 리뷰어가 작업 전에 "무엇을, 어떻게 하고, 무엇을 건드리지 않을지" 합의하는 문서다. worker, 리뷰어, 오케스트레이터 모두 같은 기대치를 갖고 작업을 시작하기 위해 존재한다. 승인된 구현 계약 없이는 task 구현을 시작할 수 없다.

> **저장 위치**: 구현 계약은 별도 파일이 아니라 `record.json`의 섹션으로 저장한다 (`geas task record add --section implementation_contract`).

### 필수 필드

| 필드 | 설명 |
|---|---|
| `planned_actions` | 수행할 구체적 단계 — worker가 실행하고 reviewer가 검증할 수 있을 정도로 구체적 |
| `non_goals` | 이 task가 명시적으로 하지 않을 것 (scope creep 방지) |
| `status` | 계약 상태: `draft`, `in_review`, `approved`, `revision_requested` |

### 좋은 계약이 추가로 밝혀야 하는 것

| 질문 | 설명 |
|---|---|
| 왜 이 방법인가 | 대안이 있었음에도 이 접근법을 택한 근거 |
| 뭘 전제하는가 | 이 계획이 의존하는 인터페이스나 가정 |
| 뭘 안 건드리나 | 의도적으로 변경 범위에서 제외한 것 |
| 어떻게 보여줄 건가 | 완료 후 성공을 시연하는 방법 |
| 리뷰어가 뭘 봐야 하나 | 리뷰 시 집중해야 할 영역 |
| 어떤 리스크를 감수하나 | 인지한 상태에서 수용·완화·유예한 리스크 |

### 계약 승인 규칙

- 계약은 주 worker와 필수 리뷰어 모두 이해할 수 있는 수준으로 작성해야 한다.
- 구현을 수반하는 task는 Design Authority 주도의 계약 리뷰를 거친다.
- 승인 후 범위가 실질적으로 바뀌면 계약 수정이 필요하다.
- 거부된 계약의 task는 `ready` 상태를 유지한다.
- 반복 거부 시 오케스트레이터는 task를 분해하거나 명확화하거나 에스컬레이션한다. 강행은 허용하지 않는다.

## 계약 수정 규칙

다음 중 하나라도 발생하면 승인된 계약을 수정하고 재승인받아야 한다:

### 실질적 변경의 기준

다음 중 하나 이상에 해당하면 실질적 범위 변경으로 간주한다:

- task의 `scope.surfaces` 밖의 경로를 변경
- 수용 기준이 추가되거나 변경됨
- risk_level이 상승
- 새로운 외부 의존성이 발생
- `non_goals`에 명시된 항목이 범위 안으로 들어옴

기록 없이 계약이 바뀌면 프로토콜 위반이다.

## Worker Self-Check

구현 완료를 주장하기 전에 주 worker는 반드시 self-check를 작성해야 한다.

> **저장 위치**: worker self-check는 별도 파일이 아니라 `record.json`의 섹션으로 저장한다 (`geas task record add --section self_check`).

### 필수 필드

- `confidence` — 정수 1-5 (아래 Confidence semantics 참조)
- `summary` — 수행한 내용과 현재 상태 평가
- `known_risks[]` — 구현 중 발견한 위험
- `untested_paths[]` — 테스트하지 않은 코드 경로나 시나리오

### 활용 방식

Self-check는 고해성사가 아니라 리뷰를 가속하는 구조화된 입력이다. 리뷰 시스템은 이를 다음과 같이 활용한다:

- Quality Specialist가 검증 우선순위를 정하는 데 사용
- Design Authority가 리뷰 초점을 잡는 데 사용
- Challenger가 도전 지점을 선정하는 데 사용
- confidence가 낮으면 게이트 임계값을 상향 조정
- stub 목록에서 부채 후보를 추출

### Confidence 등급

| 점수 | 의미 |
|---|---|
| `1` | 매우 불확실하다 |
| `2` | 불완전하거나 잘못 구현했을 가능성이 있다 |
| `3` | 대체로 괜찮지만 확인 안 된 부분이 있다 |
| `4` | 높은 확신이 있고 우려 사항이 적다 |
| `5` | 강한 확신이 있으며 evidence로 뒷받침된다 |

Confidence는 리뷰 시 참고하는 신호이지, 그 자체가 검증 결과는 아니다.

## task 수준 부채

task는 구현, 리뷰, 검증, 종결 어느 시점에서든 부채를 남길 수 있다.

### 부채 분류

| 축 | 값 |
|---|---|
| `severity` | `low` · `normal` · `high` · `critical` |
| `kind` | `output_quality` · `verification_gap` · `structural` · `risk` · `process` · `documentation` · `operations` |

부채와 차단은 다르다:

- **차단**은 지금 당장 진행을 막는다
- **부채**는 진행은 가능하지만 미래에 비용이나 리스크로 돌아온다

진행 속도를 유지하겠다고 차단에 해당하는 문제를 부채로 분류해서는 안 된다.

## 전이 테이블

| 이전 상태 | 다음 상태 | 필수 조건 |
|---|---|---|
| `drafted` | `ready` | `contract.json` 존재 |
| `ready` | `implementing` | `record.json` `implementation_contract` 섹션 (status=approved) |
| `implementing` | `reviewed` | `record.json` `self_check` 섹션 + `evidence/` implementer 역할 |
| `reviewed` | `integrated` | `record.json` `gate_result` 섹션 (verdict=pass) + `evidence/` reviewer 또는 tester 역할 |
| `integrated` | `verified` | evidence gate 통과 |
| `verified` | `passed` | `record.json` verdict (pass) + `closure` + `retrospective` 섹션 + `challenge_review` (high/critical) |
| 활성 상태 | `blocked` | 외부적·구조적·자원 문제로 안전한 진행 불가 |
| 활성 상태 | `escalated` | 해소 안 된 갈등 또는 권한 경계 도달 |
| 활성 상태 | `cancelled` | 기록된 사유와 함께 명시적 취소 |
| `blocked` | `ready` | 차단 원인 해소, 재검증 통과 |
| `escalated` | `ready` | 에스컬레이션 해소, 의도적 재진입 |
| `integrated` | `implementing` | 게이트 실패로 검증-수정 루프 |
| `integrated` | `reviewed` | 통합 실패 또는 발산으로 재조정 필요 |
| `verified` | `ready` / `implementing` / `reviewed` | final verdict = `iterate`, 명시적 상태 복원 대상 |

**상태의 진실 소스**: task의 생명주기 상태는 `contract.json`에 있으며 `geas task transition`으로 관리한다. `record.json`에는 상태 필드가 없고, 섹션 데이터만 누적한다.

## 전이 불변 규칙

1. 요약만으로 필수 상태를 건너뛸 수 없다.
2. 필수 artifact가 빠지거나 유효하지 않으면 진행할 수 없다.
3. `verified` 외의 상태에서 `passed`가 될 수 없다.
4. evidence가 불확실하면 보수적으로 상태를 복원해야 한다.
5. `blocked`나 `escalated` task는 재진입 사유를 설명할 수 있는 상태를 보존해야 한다.

## 상태 복원 대상

### 기본 상태 복원 안내

| 실패 위치 | 기본 상태 복원 대상 |
|---|---|
| 게이트에서 발견된 구현 품질 문제 | `implementing` |
| 리뷰 artifact 누락 | 원인에 따라 `ready` 또는 `reviewed` |
| 통합 전 baseline 발산 | `ready` |
| baseline 병합 후 통합 실패 | `reviewed` |
| 제품 우려로 인한 final verdict iterate | 기록된 대로 `ready`, `reviewed`, 또는 `implementing` |

상태 복원은 반드시 명시적이어야 한다. "다시 해봐"는 유효한 상태 복원 지시가 아니다.

## 재시도 한도

### 초기값

프로젝트가 재시도 한도를 조정할 수 있지만 기본값은:

| gate_profile | 권장 초기 retry_budget |
|---|---:|
| `implementation_change` | 2 |
| `artifact_only` | 1 |
| `closure_ready` | 1 |

### 소진 규칙

- `gate fail`은 1 소진
- `block`은 0 소진
- `error`는 로컬 정책이 달리 정하지 않는 한 0 소진
- final verdict의 `iterate`는 0 소진하지만 iterate 반복 상한에 카운트

### 한도 소진

재시도 한도가 0인데 task가 여전히 검증을 통과하지 못하면 오케스트레이터는:

- task를 분해하거나
- 에스컬레이션하거나
- 공식적으로 범위에서 제외하거나
- 사유를 기록하고 취소해야 한다

## Iterate 반복 상한

Final verdict `iterate`는 게이트 실패가 아니라 제품 판단이다. `retry_budget`을 소진하지 않지만, 같은 task에 iterate가 반복되면 의사결정 자체에 문제가 있다는 뜻이다.

기본 규칙:

- 같은 task에 `iterate` 판결이 누적 3번이면 사용자가 명시적으로 경로를 재설정하지 않는 한 `escalated`로 전환한다

## 범위 변경 통제

다음에 해당하면 범위 변경으로 간주하고 기록한다:

- 승인된 계획에 없는 영역을 변경
- 수용 기준에 포함되지 않은 사용자 대면 동작 도입
- 새로운 의존성이나 인터페이스 생성
- 전달 파이프라인, 민감 데이터 처리, 런타임 설정 변경
- 후속 작업이 필요한 중대한 요구사항 발생

범위 변경은 다음 중 하나 이상에 반영한다:

- 계약 수정
- 부채 등록
- gap 평가

## 취소 규칙

취소된 task는 다음을 기록한다:

- 취소 사유
- 재활용 가능한 부분 artifact가 있는지
- 부채나 메모리 후보가 발생했는지
- 대체 task나 범위 축소 경로가 존재하는지

취소 과정에서 이미 생산된 evidence를 삭제해서는 안 된다.

## 대표적 흐름

### 정상 경로

`drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed`

### 검증-수정 경로

`ready -> implementing -> reviewed -> integrated(fail) -> implementing -> reviewed -> integrated -> verified(pass) -> passed`

### 제품 iterate 경로

`verified -> final verdict iterate -> reviewed 또는 implementing -> ... -> verified -> passed`

## 핵심 선언

Geas에서 task는 단순한 할 일이 아니다. 범위를 명확히 하고, evidence를 만들어내고, 현실이 계획과 어긋날 때 보수적으로 복구하도록 강제하는 통제된 계약이다.
