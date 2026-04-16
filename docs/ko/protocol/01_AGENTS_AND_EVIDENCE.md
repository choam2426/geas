# 01. Agents, Authority, and Evidence

> Geas에서 누가 어떤 slot으로 참여하고, 어떤 evidence를 남기며, 어떤 권한으로 판단하는지 정의한다.

## 1. 역할 구조

Geas는 먼저 **slot**을 정의하고, 프로젝트는 각 slot에 구체 역할을 매핑한다. 여기서 slot은 프로토콜이 요구하는 기능 자리이고, type은 그 자리를 맡는 구체 역할이다. 각 slot에는 다음이 함께 정해진다:

- 결정 권한
- 필수 산출물
- 차단 권한
- 금지 사항
- 이해충돌 제약
- 감사 요건

구현체는 모든 task에 대해 누가 작업했고, 누가 검토했고, 누가 반론을 제기했고, 누가 결정했는지, 그리고 그 권한이 무엇이었는지를 설명할 수 있어야 한다.

이 문서에서 정의한 슬롯 이름은 task routing과 evidence 해석의 기준이 되며, 정규 열거형은 `docs/schemas/_defs.schema.json`을 따른다.

### 직무 분리

프로토콜은 다음 분리를 요구한다.

1. 작업을 조율하는 역할과 최종 판단을 내리는 역할은 분리되어야 한다.
2. 주 구현을 맡은 역할은 빠진 외부 리뷰를 자기 판단으로 대신해서는 안 된다.
3. 비판적 검토를 맡은 역할은 차단 의견을 분명히 남길 수 있어야 하며, 그 의견은 묻히지 않아야 한다.
4. 고위험 작업은 최종 판단 전에 둘 이상의 관점에서 검토되어야 한다.
5. 하나의 물리적 에이전트가 여러 `slot`을 맡을 수는 있지만, artifact에는 어떤 `slot`으로 행동했는지와 그 전환이 분명하게 남아야 한다.

### Authority 계열

Authority 계열은 프로토콜이 고정한다. 도메인이 달라져도 이 slot 구조와 책임은 바뀌지 않는다.

| slot 이름 | 정규 slot ID | 핵심 책임 | 조율 | 미션 설계 승인 | 구현 계약 승인 | 차단 | 최종 판단 |
|---|---|---|---:|---:|---:|---:|---:|
| **Orchestrator** | `orchestrator` | 미션 흐름 관리, 라우팅, 순서 조정, 패킷 구성, 복구, 메모리 관리 | O | X | X | O | X |
| **Decision Maker** | `decision-maker` | 미션 설계 승인, 최종 수용 판단, 트레이드오프 판단 | X | O | X | O | O |
| **Design Authority** | `design-authority` | 미션 설계 검토, 구조 검토, 구현 계약 승인 | X | X | O | O | X |
| **Challenger** | `challenger` | 반대 관점에서 검토하고 숨은 리스크를 드러냄 | X | X | X | O | X |

### Specialist 계열

Specialist 계열은 도메인이 달라도 반복해서 나타나는 기능 표면을 나눈 slot 계열이다. 구현체는 각 slot에 자기 도메인의 구체 역할(type)을 매핑한다.

| slot 이름 | 정규 slot ID | 핵심 기능 | 대표 산출물 |
|---|---|---|---|
| **Implementer** | `implementer` | task의 핵심 산출물을 만든다 | 코드 변경, 리서치 결과, 콘텐츠 초안, 분석 산출물 |
| **Verifier** | `verifier` | 수용 기준 충족 여부와 검증 누락을 확인한다 | 검증 결과, 누락 경로 노트, 재현성 노트 |
| **Risk Assessor** | `risk-assessor` | 리스크, 신뢰 경계, 정책 저촉 가능성을 본다 | 리스크 평가, 위협 노트, 준수 검토 |
| **Operator** | `operator` | 산출물을 다음 단계나 외부 주체에 넘기는 과정과 운영 준비, 복구 가능성을 점검한다 | 운영 준비 노트, 산출물 인계 점검 결과, 롤백 계획 |
| **Communicator** | `communicator` | 문서, 안내, 사용자 대면 표현의 정확성과 명확성을 본다 | 문서 리뷰, 안내 문안 점검, 대상 적합성 검토 |

하나의 구체 역할(type)은 여러 specialist slot을 맡을 수 있다. 중요한 것은 역할 이름이 아니라, 각 task에서 어떤 slot으로 참여했는지가 분명히 남는 것이다.

프로토콜은 specialist slot만 정의한다. 각 구현체는 자기 도메인에 맞는 구체 역할(type)과 slot 매핑을 별도로 관리한다. 다만 authority 계열의 구조와 책임은 바꿀 수 없다.

## 2. 역할 경계

### Authority 역할 경계

#### Orchestrator (`orchestrator`)

책임:

- 사용자 의도를 미션으로 구체화
- 미션 모드와 현재 단계 선택
- task 라우팅 배정
- 동시성, 잠금, 재검증, 복구 관리
- 최종 승인에 필요한 근거 정리
- 단계 경계에서 학습 artifact와 교훈을 정리해 메모리에 반영

금지:

- 최종 승인을 내릴 수 없다
- 구현 계약을 승인할 수 없다
- 필수 리뷰를 임의로 줄이거나 생략할 수 없다
- 빠진 evidence를 직접 작성할 수 없다
- 해소되지 않은 갈등이나 반대 의견을 최종 승인 근거에서 숨길 수 없다

#### Decision Maker (`decision-maker`)

책임:

- 미션 설계 승인·거부
- 최종 승인 판단
- 최종 판단 근거를 evidence로 남김
- 리뷰어 의견이 갈릴 때 합의되지 않은 핵심 쟁점을 최종 판단

금지:

- 불완전한 closure packet으로 최종 승인할 수 없다
- 기록된 차단 의견을 근거 없이 지울 수 없다
- 필수 리뷰 없이 최종 승인할 수 없다

#### Design Authority (`design-authority`)

책임:

- 미션 설계와 task 설계의 구조적 타당성을 검토
- 인터페이스, 의존성, 경계, 계약 구조를 검토
- 구현 계약 승인·거부

금지:

- 최종 승인을 내릴 수 없다
- 리스크 판단을 대신할 수 없다
- 실행 evidence를 설계 판단으로 대체할 수 없다

#### Challenger (`challenger`)

책임:

- 반대 관점에서 검토
- 주 구현 경로가 놓친 가정과 위험을 식별
- 차단 사유와 반대 근거를 분명히 드러냄

금지:

- 리뷰를 형식적 요약으로 대신할 수 없다
- 차단 의견을 근거 없이 주장할 수 없다

### Specialist 슬롯별 최소 책임

아래는 각 specialist slot에 요구되는 최소 책임이다. 구현체는 이를 자기 도메인에 맞는 체크리스트로 구체화할 수 있다.
이 문서에서 task artifact 경로는 task root `.geas/missions/{mission_id}/tasks/{task_id}/`를 기준으로 읽는다.

| 슬롯 | 핵심 책임 | 도메인 산출물·검토 근거 | Geas 아티팩트 | 주요 차단 사유 |
|---|---|---|---|---|
| Implementer | task 계약에 맞는 산출물을 만들고, 남은 위험과 미검증 항목을 드러냄 | 작업 산출물 | `self-check.json`, `evidence/{agent}.json` (`evidence_kind=implementation`) | 계약 위반, 누락된 변경, 미검증 위험 은폐 |
| Verifier | 수용 기준 충족 여부를 검증하고, 누락된 검증 경로를 식별 | 검증 결과, 재현성 노트 | `evidence/{agent}.json` (`evidence_kind=verification`) | 기준 미충족, 미검증 부정 경로, 재현 불가 검증 근거 |
| Risk Assessor | 신뢰 경계, 민감 데이터, 남용 경로와 정책 저촉 가능성을 검토 | 리스크 노트, 위협·남용 경로, 준수 관찰 | `evidence/{agent}.json` (`evidence_kind=review`) | 권한 우회, 데이터 노출, 정책 저촉 |
| Operator | 산출물 인계 절차, 환경 준비, 복구 가능성을 점검 | 운영 준비 노트, 인계 점검 결과, 롤백 계획 | `evidence/{agent}.json` (`evidence_kind=review`) | 인계 실패, 설정 드리프트, 롤백 불가 |
| Communicator | 문서와 사용자 대면 표현의 정확성, 완전성, 대상 적합성을 검토 | 문서 리뷰, 안내 문안, 전환 가이드 | `evidence/{agent}.json` (`evidence_kind=review`) | 낡은 안내, 누락된 가이드, 오해 유발 표현 |

## 3. Evidence 기준

참여와 판단은 이름이 아니라 evidence로 남아야 한다. 해당 책임을 실제로 수행하고 그 결과를 기록했을 때만 참여나 판단으로 인정한다.

### Evidence 종류

Evidence 파일은 `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json`에 저장한다. 공통 진입점은 `docs/schemas/evidence.schema.json`이고, 실제 구조는 `evidence_kind`에 따라 하위 스키마로 갈라진다. `evidence_kind`는 slot이 아니라 evidence 형식을 가리킨다.

| evidence_kind | 의미 | verdict |
|---|---|---|
| `implementation` | 작업 산출물, 남은 위험, 미검증 항목 같은 구현 근거를 남긴다 | 없음 |
| `review` | 검토 의견, 우려, 보완 요청 같은 리뷰 판단을 남긴다 | 있음 |
| `verification` | 기준별 검증 결과와 누락된 검증 경로를 남긴다 | 있음 |
| `challenge` | 반대 근거와 차단 판단을 별도 형식으로 남긴다 | 있음 |
| `decision` | Decision Maker의 최종 판단과 그 근거를 남긴다 | 있음 |

Evidence는 `slot → evidence_kind → verdict` 순서로 읽는다. `slot`은 책임을, `evidence_kind`는 구조를, `verdict`는 그 구조 안에서 남긴 판단을 뜻한다.

모든 evidence_kind는 선택 필드 `memory_suggestions[]`를 공통으로 둘 수 있다. 미래 행동을 바꿀 가치가 있는 교훈만 여기에 남긴다.

Evidence 참조가 없는 검토나 최종 판단은 신뢰도가 낮은 입력으로 취급해야 하며 높은 엄격도 수준에서는 단독으로 종결 근거가 될 수 없다.

### Verdict 의미

`review`, `verification`, `challenge` evidence는 아래 verdict를 쓴다.

| verdict | 의미 |
|---|---|
| `approved` | 해당 검토 범위에서 task를 수용할 수 있다고 판단 |
| `changes_requested` | 수용 전에 추가 작업이 필요하다고 판단 |
| `blocked` | 명시적 에스컬레이션 없이는 진행을 막아야 할 문제를 발견 |

`decision` evidence는 아래 verdict를 쓴다.

| verdict | 의미 |
|---|---|
| `approved` | 현재 task를 닫고 다음 단계로 넘길 수 있다고 판단 |
| `changes_requested` | 추가 작업 뒤 다시 판단해야 한다고 판단 |
| `escalated` | 현재 수준에서 닫지 않고 상위 판단이나 사용자 개입으로 넘겨야 한다고 판단 |

### 슬롯과 Evidence 종류 매핑

위 종류를 어떤 slot이 쓰는지는 아래처럼 읽는다. 같은 `review` evidence를 남기더라도 책임은 `slot`으로 구분한다. 예를 들어 Risk Assessor와 Design Authority는 모두 `review`를 쓰지만, 검토 범위는 다르다.

| 슬롯 | evidence_kind | 근거 |
|---|---|---|
| Implementer | `implementation` | 작업 산출물과 남은 위험을 구현 근거로 남긴다 |
| Verifier | `verification` | 검증 기준과 결과를 기록한다 |
| Risk Assessor | `review` | 리스크 검토와 차단 사유를 리뷰 형식으로 남긴다 |
| Operator | `review` | 인계와 운영 준비 상태를 리뷰 형식으로 남긴다 |
| Communicator | `review` | 문서와 사용자 대면 표현을 리뷰 형식으로 남긴다 |
| Design Authority | `review` | 구조와 계약 타당성을 리뷰 형식으로 남긴다 |
| Challenger | `challenge` | 반대 근거와 차단 판단을 별도 형식으로 남긴다 |
| Decision Maker | `decision` | 최종 판단과 그 근거를 남긴다 |

Decision Maker는 `decision` evidence를 남긴다. task 수준 종결 상태는 `record.json`의 `verdict` 섹션에 함께 남긴다.

## 4. 라우팅 책임

최종 라우팅 책임은 Orchestrator에게 있다. Orchestrator는 어떤 specialist와 authority slot이 이 task에 들어와야 하는지 결정하고, 그 결과를 task contract에 남겨야 한다.

`task_kind`, `risk_level`, `gate_profile`, `scope.surfaces`, `routing.required_reviewer_slots[]` 같은 task contract 필드와 라우팅 계산 규칙은 doc 03을 따른다.

필수 리뷰어 간 갈등 해소, vote round, 최소 참여 인원, 최종 판단 절차는 doc 05를 따른다.

## 5. Evidence 읽기 원칙

### Evidence 출처 우선순위

Specialist는 가능하면 다음 순서로 직접적인 evidence를 선호한다:

| 우선순위 | 출처 | 신뢰 수준 |
|---|---|---|
| 1 | 현재 task를 위해 생산된 정규 artifact | 최고 |
| 2 | 재현 가능한 명령, 검증, 테스트 결과 | 높음 |
| 3 | 산출물 직접 검토 | 높음 |
| 4 | rules.md 항목 및 agent memory 노트 | 중간 |
| 5 | artifact에 연결되지 않은 서술 주장 | 최저 |

낮은 우선순위의 evidence가 높은 우선순위의 모순되는 evidence를 근거 없이 무효화할 수 없다.

### Worker Artifact 활용

모든 specialist가 worker artifact를 참고할 수 있지만, 다음 조합이 특히 중요하다:

| worker artifact | 주 소비 슬롯 | 기대 효과 |
|---|---|---|
| `known_risks[]` | Design Authority, Risk Assessor, Challenger | worker 자신이 불확실한 지점에 리뷰를 집중 |
| `unverified_cases[]` | Verifier | 검증 우선순위 결정 |
| `possible_stubs[]` | Verifier, Design Authority, Challenger | 미완성 구현의 명시적 확인 강제 |
| `what_to_test_next[]` | Verifier | 검증 시나리오 설계 가속 |
| `summary` | 전체 리뷰어 | 리뷰 방향 설정용. 리뷰 자체를 대체하지 않는다 |

## 6. 운영 규칙

### 단일 에이전트·소규모 팀 운영

하나의 물리적 에이전트가 여러 논리적 타입을 맡을 수 있지만, artifact에 명시적 역할 전환이 드러나야 한다. 단일 에이전트 모드에서:

- 구현 역할과 리뷰 역할을 별도로 기록해야 한다
- 자기 갈등은 의사결정 기록에 포착해야 한다
- `high`·`critical` 갈등은 사용자에게 에스컬레이션하는 게 좋다
- 최종 판단은 명시적 Decision Maker 역할 전환 아래에서 내려야 한다
- 독립 리뷰가 실제로 일어나지 않았는데 일어난 것처럼 가장할 수 없다

### 사용자 에스컬레이션 경계

다음 중 하나라도 발생하면 사용자에게 에스컬레이션해야 한다:

- 법적, 프라이버시, 정책 불확실성
- 불확실성이 좁혀지지 않는 반복적 `changes_requested` 또는 반복적 복구 실패
- 해소 안 되는 critical 리스크 의견 대립
- 사용자 승인이 필요한 로컬 정책 아래에서 규제·안전 관련 산출물 인계 또는 외부 제공
- 정상적 hard-stop을 약화하는 정책 오버라이드

### 추적 요건

artifact로부터 다음을 재구성할 수 있어야 한다:

- 주 작업자가 누구였는지
- 누가 리뷰했는지
- 누가 반론을 제기했는지
- 누가 최종 판단을 내렸는지
- 각 차단 의견을 어떤 역할이 제기했는지
- 어떤 반대 의견이 기각되었고 왜 그랬는지
- 논리적 역할 분리가 하나의 물리적 에이전트로 합쳐졌는지 여부

### 저장 위치 기준

artifact 저장 위치와 파일명 규칙의 정식 기준은 doc 09를 따른다.
이 문서의 `record.json`, `self-check.json`, `evidence/{agent}.json` 표기는 모두 task root 기준이다.
