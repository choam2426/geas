# 01. Agent Types and Authority

> **기준 문서.**
> 역할 분류 체계, 권한 경계, 직무 분리 원칙, 리뷰어 라우팅 규칙, 에스컬레이션 모델을 정의한다.

## 목적

Geas는 에이전트를 이름이 아니라 **타입**으로 정의한다. 타입에는 다음이 딸려온다:

- 결정 권한
- 필수 산출물
- 차단 권한
- 금지 사항
- 이해충돌 제약
- 감사 요건

모든 task에 대해 구현체는 이 질문에 답할 수 있어야 한다: **누가 작업했고, 누가 리뷰했고, 누가 반론을 제기했고, 누가 결정했으며, 어떤 권한으로 그랬는가.**

## 직무 분리

프로토콜이 강제하는 분리 원칙:

1. 작업을 조율하는 역할과 제품 종결을 내리는 역할은 구분되어야 한다.
2. 주 구현을 맡은 역할이 빠진 외부 리뷰를 조용히 대체할 수 없다.
3. 비판적 검증을 맡은 역할은 묵살되지 않고 차단 의견을 낼 수 있어야 한다.
4. 고위험 작업은 final verdict 전에 둘 이상의 평가 관점이 반드시 관여한다.
5. 하나의 물리적 에이전트가 여러 타입을 겸할 수 있지만, artifact에는 논리적 역할 분리가 반드시 드러나야 한다.

## 역할 구조

Geas 역할은 두 계층으로 나뉜다:

- **Authority 슬롯** — 프로토콜이 정의하는 도메인 무관 역할. 모든 구현체에 존재한다.
- **Specialist 슬롯** — 기능별 분류. 도메인 프로필이 구체 역할 타입으로 채운다.

하나의 물리적 에이전트가 여러 슬롯을 맡을 수 있다. 슬롯 배정은 **주 책임**을 뜻하지 독점권을 뜻하지 않는다.

### Authority 슬롯

Authority 슬롯은 프로토콜이 고정하며 도메인에 따라 바뀌지 않는다.

| 슬롯 | 주 기능 | 스케줄링 | 계약 승인 | 차단 | final verdict |
|---|---|---:|---:|---:|---:|
| **Orchestrator** | 미션 제어, 라우팅, 순서 조정, 패킷 조립, 복구, 메모리 관리 | O | O | O | X |
| **Decision Maker** | 제품 수준 수용, 트레이드오프 판단, final verdict | X | specifying만 | O | O |
| **Design Authority** | 구조적 일관성, 방법론 리뷰, 계약 승인 | X | O | O | X |
| **Challenger** | 비판적 사전 검증, 숨겨진 리스크 탐지 | X | X | O | X |

Authority 슬롯의 정규 타입 이름:

| 슬롯 | 정규 타입명 |
|---|---|
| Orchestrator | `orchestration_authority` |
| Decision Maker | `product_authority` |
| Design Authority | `design_authority` |
| Challenger | `critical_reviewer` |

### Specialist 슬롯

Specialist 슬롯은 도메인 전문성의 **기능 범주**를 정의한다. 도메인 프로필이 이 슬롯에 구체 역할 타입을 매핑한다.

| 슬롯 | 기능 | 산출물 |
|---|---|---|
| **Implementer** | 주 산출물 생산 | 결과물 — 코드, 리서치 결과, 콘텐츠 초안, 분석 |
| **Quality Specialist** | 수용 기준 대비 산출물 검증 | 커버리지 evidence, 부정 경로 분석, 재현성 노트 |
| **Risk Specialist** | 도메인별 리스크·신뢰 경계 평가 | 리스크 노트, 위협 분석, 준수 관찰 |
| **Operations Specialist** | 전달, 배포, 운영 준비 | 운영 준비 노트, 전달 검증, 롤백 방안 |
| **Communication Specialist** | 문서화, 사용자 대면 콘텐츠, 명확성 | 문서 완전성, 대상 적합 안내, 명확성 리뷰 |

하나의 역할이 여러 슬롯에 참여할 수 있다. 예를 들어 Quality Specialist가 테스트를 직접 작성하면 Implementer 역할도 겸하고, Communication Specialist가 문서를 새로 쓰면 Implementer 역할도 한다.

### 도메인 프로필

도메인 프로필은 specialist 슬롯을 구체 역할 타입에 매핑한다. 프로토콜은 **소프트웨어 개발** 프로필을 참조 예시로 정의한다. 프로젝트는 활성 도메인 프로필을 반드시 선언해야 한다.

#### 소프트웨어 개발 프로필 (참조)

| 슬롯 | 구체 타입 | 전문 영역 |
|---|---|---|
| Implementer | `frontend_engineer`, `backend_engineer` | UI 코드, 브라우저 동작 / API, 서비스, 영속성, 비즈니스 로직 |
| Quality Specialist | `qa_engineer` | 수용 기준, 테스트, 실패 경로, 회귀 리스크 |
| Risk Specialist | `security_engineer` | 인증, 권한, 비밀 관리, 남용 경로 |
| Operations Specialist | `devops_engineer` | CI/CD, 환경, 배포 가능성, 런타임 운영 |
| Communication Specialist | `technical_writer`, `ui_ux_designer` | 문서, 마이그레이션, 운영자 안내 / 사용자 흐름, 시각적 의도, 인터랙션 명확성 |

#### 리서치 프로필 (예시)

| 슬롯 | 구체 타입 | 전문 영역 |
|---|---|---|
| Implementer | `literature_analyst`, `experiment_runner` | 문헌 검색·종합 / 실험 설계·수행 |
| Quality Specialist | `methodology_reviewer` | 통계 엄밀성, 재현 가능성, 방법론 건전성 |
| Risk Specialist | `ethics_reviewer` | 연구 윤리, 데이터 프라이버시, 편향 평가 |
| Operations Specialist | `data_engineer` | 데이터 파이프라인, 저장소, 계산 인프라 |
| Communication Specialist | `academic_writer` | 논문 작성, 인용 관리, 대상 적합 표현 |

#### 콘텐츠 제작 프로필 (예시)

| 슬롯 | 구체 타입 | 전문 영역 |
|---|---|---|
| Implementer | `writer`, `designer` | 콘텐츠 초안 작성 / 시각 디자인, 레이아웃 |
| Quality Specialist | `fact_checker` | 출처 검증, 주장 정확성, 일관성 |
| Risk Specialist | `legal_reviewer` | 저작권, 법적 책임, 규제 준수 |
| Operations Specialist | `publishing_ops` | CMS, 배포, 일정, 포맷 변환 |
| Communication Specialist | `editor` | 톤, 명확성, 독자 적합성, 스타일 일관성 |

프로젝트가 추가 도메인 프로필을 정의하거나 기존 것을 확장할 수 있지만, authority 모델을 약화해서는 안 된다.

## 상세 책임과 금지 사항

### Orchestrator (`orchestration_authority`)

책임:

- 사용자 의도를 미션으로 정규화
- 미션 모드와 현재 단계 선택
- task 컴파일과 라우팅 배정
- 동시성, 잠금, 재검증, 복구 관리
- 필요시 vote round 호출
- closure packet 조립
- 단계 경계에서 학습 artifact 조율
- 메모리 생명주기 관리: 추출, 승격 리뷰, 감쇠 모니터링, 적용 로깅

금지:

- 제품 final verdict를 내릴 수 없다
- 필수 리뷰를 조용히 낮출 수 없다
- 정책 편의를 위해 빠진 evidence를 통과시킬 수 없다
- 해소 안 된 갈등을 closure packet에서 숨길 수 없다

### Decision Maker (`product_authority`)

책임:

- specifying과 최종 종결 시 제품 트레이드오프 판단
- full-depth 미션의 디자인 브리프 승인·거부
- `pass | iterate | escalate` final verdict 발행
- 전문가 합의가 안 될 때 환원 불가 트레이드오프 해소

금지:

- 불완전한 closure packet으로 `passed` task를 승인할 수 없다
- 기록된 차단 의견을 근거 없이 지울 수 없다
- 주 구현 작업자가 되지 않는 게 좋다
- 명시적이고 감사 가능한 오버라이드 없이 무결성 규칙을 약화할 수 없다

### Design Authority (`design_authority`)

책임:

- 구조적 결정, 인터페이스, 의존성, 유지보수성 리뷰
- 숨겨진 복잡성, 계층 위반, 계약 모호성에 문제 제기
- 구현 계약 승인·거부

소프트웨어에서는 아키텍처 리뷰, 리서치에서는 방법론 리뷰, 콘텐츠에서는 편집 방향 리뷰가 된다.

금지:

- 품질, 리스크, 제품 승인을 당연히 포함한다고 가정할 수 없다
- 실행 evidence가 없는데 설계 확신만으로 대체할 수 없다

### Challenger (`critical_reviewer`)

책임:

- 출시 전에 반대 입장에서 검증한다
- 주 구현 경로가 놓친 가정을 찾아낸다
- "왜 이걸 내보내면 안 되는가"를 구체적으로 짚어내게 만든다

금지:

- 리뷰를 형식적 요약으로 때울 수 없다
- task가 명시적으로 취소되지 않는 한 `high`·`critical` 작업의 challenge를 빠뜨릴 수 없다

## Specialist 슬롯별 최소 리뷰 의무

아래는 슬롯별 최소 기대치이며 완전한 목록이 아니다. 도메인 프로필이 이를 구체 체크리스트로 세분화한다.

### Implementer (동료 작업 리뷰 시)

반드시 고려할 것:

- 접근법이 승인된 계약과 일치하는지
- 인터페이스 정확성과 경계 동작
- 변경에 따른 회귀 리스크
- 다른 specialist 슬롯의 참여가 필요한지

### Quality Specialist

반드시 고려할 것:

- 수용 기준에서 검증 evidence까지의 추적성
- 부정 경로와 회귀
- 미검증 경로가 중요한지 여부
- 제출된 evidence의 재현 가능성

### Risk Specialist

반드시 고려할 것:

- 신뢰 경계와 권한 처리
- 민감 데이터 노출이나 오용
- 도메인에 해당하는 남용 경로와 적대적 시나리오
- 관련 정책 준수 여부

### Operations Specialist

반드시 고려할 것:

- 전달 파이프라인 영향
- 운영 준비 상태와 롤백 능력
- 설정 드리프트
- 환경이나 인프라 영향

### Communication Specialist

반드시 고려할 것:

- 변경 사항이 적절한 대상 수준으로 문서화되었는지
- 마이그레이션, 업그레이드, 전환 안내
- 사용자 대면 콘텐츠의 명확성과 정확성
- 예시나 참고 자료가 낡지 않았는지

## task 종류 분류

정규 `task_kind` 값은 도메인에 묶이지 않는다:

| task_kind | 의미 | 주 작업자 슬롯 |
|---|---|---|
| `implementation` | task의 핵심 산출물 생산 | Implementer |
| `documentation` | 문서, 가이드, 참고자료 작성·갱신 | Communication Specialist |
| `configuration` | 파라미터, 환경, 템플릿 설정·변경 | Operations Specialist |
| `design` | 구조적, 시각적, 방법론적 설계 생성·수정 | Implementer 또는 Design Authority |
| `review` | 기존 작업물에 대한 평가, 감사, 검토 수행 | Risk Specialist 또는 Quality Specialist |
| `analysis` | 데이터, 시스템, 소스를 조사·탐색하여 인사이트 도출 | Implementer 또는 Quality Specialist |
| `delivery` | 릴리스, 발행, 최종 산출물 패키징·전달 | Operations Specialist |

프로젝트가 하위 분류(예: `implementation:frontend`, `review:security`)를 추가로 정의할 수 있지만, 상위 종류는 반드시 식별 가능해야 한다.

## 결정 경계

| 결정 | 주 소유자 | 필수 참여자 / 비고 |
|---|---|---|
| 미션 단계 선택 | Orchestrator | 미션 의도, 미션 모드, 현재 evidence 반영 |
| task 분해와 라우팅 | Orchestrator | 크거나 횡단적 작업엔 Design Authority 의견 권장 |
| 디자인 브리프 승인 | Decision Maker | full-depth 작업엔 Design Authority 리뷰 필수 |
| 구현 계약 승인 | Design Authority가 이끄는 리뷰어 세트 | 도메인 specialist 서명 포함 가능 |
| evidence gate 판결 | 게이트 실행자 / 검증기 | 객관적 메커니즘이며 제품 트레이드오프 결정이 아님 |
| readiness vote | 리뷰 참여자 | task 리스크와 vote 정책에 따름 |
| final verdict | Decision Maker | 직관이 아닌 closure packet에 근거 |
| 메모리 승격 | Orchestrator + 보증 권한 | doc 07, 08 참조 |
| 정책 오버라이드 | 로컬 거버넌스 경로 | doc 12 참조; 반드시 명시적이고 감사 가능해야 함 |

## 리뷰어 라우팅 알고리즘

task의 `required_reviewer_types[]`는 누적 방식으로 계산한다.

### 0단계 — 단계·미션 온전성 확인

리뷰어를 배정하기 전에 Orchestrator가 확인할 것:

- task가 현재 미션과 단계에 속하는지
- task kind와 risk level이 설정되어 있는지
- task 범위가 영향받는 표면을 추론할 만큼 구체적인지

빠진 게 있으면 리뷰어 라우팅을 차단한다.

### 1단계 — `task_kind`별 기본 리뷰어

| task_kind | 최소 필수 리뷰어 슬롯 |
|---|---|
| `implementation` | Design Authority |
| `documentation` | Communication Specialist |
| `configuration` | Operations Specialist |
| `design` | Design Authority |
| `review` | Risk Specialist |
| `analysis` | Design Authority, Quality Specialist |
| `delivery` | Operations Specialist, Quality Specialist |

도메인 프로필이 각 슬롯을 구체 리뷰어 타입에 매핑한다.

### 2단계 — 리스크 확장

| risk_level | 추가 필수 리뷰어 |
|---|---|
| `low` | 없음 |
| `normal` | 없음 |
| `high` | Challenger, Risk Specialist |
| `critical` | Challenger, Risk Specialist, Quality Specialist |

### 3단계 — 표면 신호 확장

다음 범위 신호가 감지되면 리뷰어 슬롯을 추가한다:

| 신호 | 추가할 리뷰어 슬롯 |
|---|---|
| 사용자 대면 표면, 인터랙션 흐름, 표현 | Implementer (프론트엔드 도메인), Communication Specialist |
| 핵심 로직, 도메인 모델, 데이터 처리, 인터페이스 | Implementer (백엔드 도메인), Design Authority |
| 신뢰 경계, 인증 정보, 민감 데이터, 권한 | Risk Specialist |
| 전달 파이프라인, 인프라, 환경, 런타임 설정 | Operations Specialist |
| 검증 artifact, 수용 기준, 테스트 표면 | Quality Specialist |
| 문서, 가이드, 사용자 대면 텍스트 | Communication Specialist |

### 4단계 — 게이트 프로필·미션 모드 조정

- `closure_ready`에는 Quality Specialist를 반드시 포함한다.
- `artifact_only`는 구현 표면에 영향이 없으면 Implementer 리뷰어를 생략할 수 있다.
- `recovery_first` 미션에서는 손상된 표면을 담당하는 specialist를 추가해야 한다.

### 5단계 — 횡단 변경 확장

표면 휴리스틱에 걸리지 않아도 추가 리뷰를 촉발해야 하는 조건:

- 공개 인터페이스나 계약 변경
- 데이터 모델이나 schema 변경
- 마이그레이션, 백필, 대량 변환
- 신뢰 경계나 권한 변경
- 사용자에게 보이는 콘텐츠나 흐름 변경
- 전달 파이프라인이나 버전 관리 변경

### 6단계 — 중복 제거와 전문성 보존

중복 리뷰어 타입을 제거한다. `primary_worker_type`이 리뷰 세트에도 나타나면 해당 전문성이 필요하다는 뜻이지 자기 리뷰로 충분하다는 뜻이 아니다.

### 7단계 — 최소 보장

모든 task에는 독립 리뷰어 타입이 최소 하나 있어야 한다. 계산 결과가 빈 집합이면 Design Authority를 추가한다.

## 갈등 해소

필수 리뷰어들이 실질적으로 양립 불가능한 결론을 내면 프로토콜 갈등이 존재한다. 예:

- `approved` 대 `blocked`
- 상호 배타적인 조건부 승인
- 서로 다른 수용 결과를 함축하는 범위 해석
- Challenger가 차단 의견을 냈는데 다른 리뷰어가 수용 가능한 리스크로 취급

갈등 처리 순서:

1. **탐지** — 양립 불가 입장을 기록한다.
2. **명확화** — 의견 차이가 사실 문제인지, 평가 문제인지, 관할 문제인지 확인한다.
3. **심의** — doc 05에 따라 필요하면 vote round를 진행한다.
4. **반대 의견 기록** — 소수 의견이 의사결정 기록에 반드시 남아 있어야 한다.
5. **해소 또는 에스컬레이션** — 해소 안 되는 구조적 갈등은 `escalated`가 된다.

Orchestrator가 처리량을 선호한다고 갈등이 사라져서는 안 된다.

## 최소 참여 인원

### 제안 라운드

최소: 제안자 + 독립 리뷰어 1명.
횡단 변경 권장: 제안자 + Design Authority + 영향받는 도메인 specialist 1명.

### 준비 상태 라운드

`high` 또는 `critical` 리스크 최소:

- Orchestrator
- Decision Maker
- 독립 specialist 최소 1명
- 리스크에 따라 Challenger

두 번 시도해도 최소 인원이 안 모이면 task를 `escalated`로 전환해야 한다. 단, 로컬 정책이 근거를 기록한 유예 결정을 명시적으로 허용하는 경우는 예외.

## 단일 에이전트·소규모 팀 운영

하나의 물리적 에이전트가 여러 논리적 타입을 맡을 수 있지만, artifact에 명시적 역할 전환이 드러나야 한다. 단일 에이전트 모드에서:

- 구현 역할과 리뷰 역할을 별도로 기록해야 한다
- 자기 갈등은 의사결정 기록에 포착해야 한다
- `high`·`critical` 갈등은 사용자에게 에스컬레이션하는 게 좋다
- final verdict는 명시적 Decision Maker 역할 전환 아래에서 내려야 한다
- 독립 리뷰가 실제로 일어나지 않았는데 일어난 것처럼 가장할 수 없다

## 사용자 에스컬레이션 경계

다음 중 하나라도 발생하면 사용자에게 에스컬레이션해야 한다:

- 법적, 프라이버시, 정책 불확실성
- 불확실성이 좁혀지지 않는 반복적 `iterate` 또는 반복적 복구 실패
- 해소 안 되는 critical 리스크 의견 대립
- 사용자 승인이 필요한 프로필 하에서 규제·안전 관련 산출물 전달
- 정상적 hard-stop을 약화하는 정책 오버라이드

## 추적 요건

artifact로부터 다음을 재구성할 수 있어야 한다:

- 주 작업자가 누구였는지
- 누가 리뷰했는지
- 누가 반론을 제기했는지
- 누가 final verdict를 내렸는지
- 각 차단 의견을 어떤 역할이 제기했는지
- 어떤 반대 의견이 기각되었고 왜 그랬는지
- 논리적 역할 분리가 하나의 물리적 에이전트로 합쳐졌는지 여부

## Artifact 타입 명명 규칙

정규 artifact 파일명은 타입 중립적이다:

- `specialist-review.json`
- `challenge-review.json`
- `vote-round.json`
- `final-verdict.json`
- `decision-record.json`

역할 정체는 파일명이 아니라 검증된 필드 안에 담는다.

## 핵심 선언

Geas에서 권한은 장식이 아니다. 역할은 누가 결정할 수 있는지, 어떤 evidence를 봐야 하는지, 미래 감사자가 결정의 정당성을 어떻게 확인할 수 있는지를 제한하기 위해 존재한다.
