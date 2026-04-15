# 01. 에이전트, 권한, 그리고 Evidence

> **기준 문서.**
> 역할 분류 체계, 권한 경계, 직무 분리 원칙, 리뷰어 라우팅, specialist evidence 의무, 에스컬레이션 모델을 정의한다.

## 1. 역할 구조

Geas는 에이전트를 이름이 아니라 **타입**으로 정의한다. 타입에는 다음이 딸려온다:

- 결정 권한
- 필수 산출물
- 차단 권한
- 금지 사항
- 이해충돌 제약
- 감사 요건

구현체는 모든 task에 대해 다음 질문에 답할 수 있어야 한다: **누가 작업했고, 누가 리뷰했고, 누가 반론을 제기했고, 누가 결정했으며, 어떤 권한으로 그랬는가.**

### 직무 분리

프로토콜이 강제하는 분리 원칙:

1. 작업을 조율하는 역할과 제품 종결을 내리는 역할은 구분되어야 한다.
2. 주 구현을 맡은 역할이 빠진 외부 리뷰를 조용히 대체할 수 없다.
3. 비판적 검증을 맡은 역할은 묵살되지 않고 차단 의견을 낼 수 있어야 한다.
4. 고위험 작업은 final verdict 전에 둘 이상의 평가 관점이 반드시 관여한다.
5. 하나의 물리적 에이전트가 여러 타입을 겸할 수 있지만, artifact에는 논리적 역할 분리가 반드시 드러나야 한다.

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
| Orchestrator | `orchestration-authority` |
| Decision Maker | `product-authority` |
| Design Authority | `design-authority` |
| Challenger | `challenger` |

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

도메인 프로필은 specialist 슬롯을 구체 역할 타입에 매핑한다. 프로토콜은 소프트웨어 개발, 연구, 콘텐츠 제작의 세 가지 프로필을 예시로 함께 제공한다. 프로젝트는 활성 도메인 프로필을 반드시 선언해야 한다.

#### 소프트웨어 개발 프로필

| 슬롯 | 구체 타입 | 전문 영역 | 검토 초점 |
|---|---|---|---|
| Implementer | `software-engineer` | 풀스택 구현 — UI, API, 서비스, 영속성, 비즈니스 로직, 인터랙션 디자인 | 변경된 UI 경로, 인터랙션 상태, 반응형 동작, 접근성, API 계약, 데이터 흐름, 마이그레이션 안전, 오류 처리, 멱등성 |
| Quality Specialist | `qa-engineer` | 인수 기준, 테스트, 실패 경로, 회귀 위험 | 기준 대비 테스트 커버리지, 부정 경로, 시연 검증 |
| Risk Specialist | `security-engineer` | 인증, 권한, 비밀 관리, 남용 경로 | 인증/인가 경계, 비밀 관리, 인젝션 표면, 남용 경로 |
| Operations Specialist | `platform-engineer` | CI/CD, 환경, 배포 가능성, 런타임 운영 | CI 안정성, 배포 영향, 설정 드리프트, 출처 관리 |
| Communication Specialist | `technical-writer` | 문서, 마이그레이션, 운영자 가이드 | 문서 완전성, 마이그레이션 안내, 운영자 주의사항 |

#### 연구 프로필 (예시)

| 슬롯 | 구체 타입 | 전문 영역 | 검토 초점 |
|---|---|---|---|
| Implementer | `literature-analyst`, `research-analyst` | 문헌 검색 및 종합; 실험 설계, 데이터 분석, 모델링, 시뮬레이션 | 방법론 타당성, 데이터 수집 유효성, 분석 재현성 |
| Quality Specialist | `methodology-reviewer` | 통계적 엄밀성, 재현성, 방법론적 타당성 | 통계적 엄밀성, 표본 적정성, 발견 재현 가능성 |
| Risk Specialist | `research-integrity-reviewer` | 연구 윤리, 데이터 프라이버시, 편향 평가, 타당성 위협 | 윤리 준수, 데이터 프라이버시, 편향 평가 |
| Operations Specialist | `research-engineer` | 데이터 파이프라인, 컴퓨팅 인프라, 재현성 환경 | 데이터 파이프라인 안정성, 컴퓨팅 재현성, 환경 일관성 |
| Communication Specialist | `research-writer` | 논문 작성, 보고서, 프레젠테이션, 독자 수준에 맞는 커뮤니케이션 | 논문 명확성, 인용 정확성, 독자 수준에 맞는 발표 |

#### 콘텐츠 제작 프로필 (예시)

| 슬롯 | 구체 타입 | 전문 영역 | 검토 초점 |
|---|---|---|---|
| Implementer | `content-writer`, `content-designer` | 콘텐츠 작성; 시각 디자인 및 레이아웃 | 사실 정확성, 톤 일관성, 출처 명시 |
| Quality Specialist | `fact-checker` | 출처 검증, 주장 정확성, 일관성 | 주장 검증, 출처 신뢰도, 교차 참조 일관성 |
| Risk Specialist | `legal-reviewer` | 저작권, 책임, 규정 준수 | 저작권 준수, 책임 노출, 규정 적합성 |
| Operations Specialist | `publishing-engineer` | CMS, 배포, 스케줄링, 포맷 변환 | CMS 통합, 포맷 변환, 배포 준비 |
| Communication Specialist | `editor` | 톤, 명확성, 독자 적합성, 스타일 일관성 | 독자 적합성, 스타일 일관성, 명확성 |

프로젝트가 추가 도메인 프로필을 정의하거나 기존 것을 확장할 수 있지만, authority 모델을 약화해서는 안 된다.

## 2. Authority 상세 책임

### Orchestrator (`orchestration-authority`)

책임:

- 사용자 의도를 미션으로 정규화
- 미션 모드와 현재 단계 선택
- task 컴파일과 라우팅 배정
- 동시성, 잠금, 재검증, 복구 관리
- 필요시 vote round 호출
- closure packet 조립
- 단계 경계에서 학습 artifact 조율
- 메모리 관리: 회고와 리뷰에서 교훈을 추출해 rules.md와 agent memory에 반영
- retrospective의 next_time_guidance를 기반으로 자신의 agent memory 파일 갱신

금지:

- 제품 final verdict를 내릴 수 없다
- 필수 리뷰를 조용히 낮출 수 없다
- 정책 편의를 위해 빠진 evidence를 통과시킬 수 없다
- 해소 안 된 갈등을 closure packet에서 숨길 수 없다

### Decision Maker (`product-authority`)

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

### Design Authority (`design-authority`)

책임:

- 구조적 결정, 인터페이스, 의존성, 유지보수성 리뷰
- 숨겨진 복잡성, 계층 위반, 계약 모호성에 문제 제기
- 구현 계약 승인·거부

소프트웨어에서는 아키텍처 리뷰, 리서치에서는 방법론 리뷰, 콘텐츠에서는 편집 방향 리뷰가 된다.

금지:

- 품질, 리스크, 제품 승인을 당연히 포함한다고 가정할 수 없다
- 실행 evidence가 없는데 설계 확신만으로 대체할 수 없다

### Challenger (`challenger`)

책임:

- 출시 전에 반대 입장에서 검증한다
- 주 구현 경로가 놓친 가정을 찾아낸다
- "왜 이걸 내보내면 안 되는가"를 구체적으로 짚어내게 만든다

금지:

- 리뷰를 형식적 요약으로 때울 수 없다
- task가 명시적으로 취소되지 않는 한 `high`·`critical` 작업의 challenge를 빠뜨릴 수 없다

## 3. Specialist Evidence 의무

Specialist 참여는 evidence 품질을 바꿀 때에만 의미가 있다. Task에 이름이 올라가 있다고 충족되는 것이 아니라, 해당 표면을 실제로 검토하고 리뷰 결과를 기록했을 때 충족된다.

### Specialist 리뷰 공통 Artifact

Specialist 리뷰는 `evidence/{agent}.json`에 역할 기반 evidence 파일로 저장한다 (`geas evidence add`). 모든 specialist 리뷰에 포함해야 할 최소 필드:

| 필드 | 설명 |
|---|---|
| `agent` | 리뷰를 작성한 agent |
| `task_id` | 리뷰 대상 task |
| `role` | 해당 task에서의 agent 역할: `implementer`, `reviewer`, `tester`, 또는 `authority` |
| `summary` | 리뷰 결과와 판단 근거 |
| `verdict` | `approved`, `changes_requested`, 또는 `blocked` |
| `concerns[]` | 개별 대응 가능한 차단 사안 |
| `criteria_results[]` | 기준별 pass/fail 평가 |
| `rationale` | 전체 verdict에 대한 설명 |
| `artifacts[]` | 리뷰 과정에서 검토 또는 수정한 artifact |

Evidence 참조가 없는 리뷰도 존재할 수 있지만, 신뢰도가 낮은 입력으로 취급해야 하며 높은 엄격도 수준에서는 단독으로 종결 근거가 될 수 없다.

### Status 의미

| status | 의미 |
|---|---|
| `approved` | 리뷰어의 관할 내에서 task를 수용할 수 있다고 판단 |
| `changes_requested` | 수용 전에 추가 작업이 필요하다 |
| `blocked` | 명시적 에스컬레이션 없이는 진행을 막아야 할 구조적 문제를 발견 |

### 슬롯별 의무

아래는 슬롯별 최소 기대치이며 완전한 목록이 아니다. 도메인 프로필이 이를 구체 체크리스트로 세분화한다.

#### Implementer (동료 작업 리뷰 시)

| 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|
| 접근법과 계약의 일치, 인터페이스 정확성, 회귀 리스크 | 구현 리뷰 노트, 경계 관찰 | 계약 위반, 인터페이스 파손, 회귀 발생 |

추가 고려 사항:
- 다른 specialist 슬롯의 참여가 필요한지

#### Quality Specialist

| 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|
| 수용 기준, 검증 커버리지, 부정 경로 | 커버리지 분석, 누락 경로 노트, 재현성 평가 | 기준 미충족, 미검증 부정 경로, 재현 불가 evidence |

추가 고려 사항:
- 수용 기준에서 검증 evidence까지의 추적성
- 미검증 경로가 중요한지 여부

#### Risk Specialist

| 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|
| 신뢰 경계, 민감 데이터 처리, 도메인별 위협 | 리스크 노트, 위협 관찰 | 권한 상승, 데이터 노출, 안전하지 않은 신뢰 가정 |

추가 고려 사항:
- 도메인에 해당하는 남용 경로와 적대적 시나리오
- 관련 정책 준수 여부

#### Operations Specialist

| 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|
| 전달 파이프라인, 환경 준비, 롤백 능력 | 운영 준비 노트 | 배포 장애, 설정 드리프트, 롤백 경로 누락 |

추가 고려 사항:
- 설정 드리프트
- 환경이나 인프라 영향

#### Communication Specialist

| 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|
| 문서 영향, 사용자 대면 변경, 명확성 | 문서 완전성 노트, 대상 적합성 평가 | 낡은 안내, 누락된 가이드, 오해를 유발하는 콘텐츠 |

추가 고려 사항:
- 마이그레이션, 업그레이드, 전환 안내
- 예시나 참고 자료가 낡지 않았는지

### 슬롯과 Evidence 역할

**슬롯**은 에이전트가 수행하는 조직적 기능(예: Design Authority, Challenger)이다. **Evidence 역할**은 CLI로 evidence를 작성할 때 필요한 필드를 결정한다.

| 슬롯 | Evidence 역할 | 근거 |
|------|--------------|-----------|
| Design Authority | `reviewer` | 구조적 품질을 리뷰. evidence에 verdict + concerns 필요 |
| Challenger | `authority` | 차단/비차단 결정을 내림. evidence에 verdict + rationale 필요 |
| Product Authority | `authority` | final verdict 발행. evidence에 verdict + rationale 필요 |

Challenger는 `record.json:challenge_review`에도 기록한다(이중 기록). `verified→passed` 전환 가드가 이 섹션을 직접 확인하기 때문이다.

## 4. 필수 리뷰어 라우팅

### Task 종류 분류

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

정규 열거형: `docs/protocol/schemas/task-contract.schema.json`.

### 라우팅 알고리즘

task의 `required_reviewer_types[]`는 누적 방식으로 계산한다.

#### 0단계 — 단계·미션 온전성 확인

리뷰어를 배정하기 전에 Orchestrator가 확인할 것:

- task가 현재 미션과 단계에 속하는지
- task kind와 risk level이 설정되어 있는지
- task 범위가 영향받는 표면을 추론할 만큼 구체적인지

빠진 게 있으면 리뷰어 라우팅을 차단한다.

#### 1단계 — `task_kind`별 기본 리뷰어

| task_kind | 최소 필수 리뷰어 슬롯 | 자주 추가되는 슬롯 |
|---|---|---|
| `implementation` | Design Authority | Quality, Risk, Implementer (동료), Operations, Communication |
| `documentation` | Communication Specialist | Quality, Design Authority (구조적 의미가 바뀐 경우) |
| `configuration` | Operations Specialist | Risk, Quality, Design Authority |
| `design` | Design Authority | Communication, Implementer, Quality |
| `review` | Risk Specialist | Design Authority, Quality, Operations |
| `analysis` | Design Authority, Quality Specialist | Risk, Communication |
| `delivery` | Operations Specialist, Quality Specialist | Communication, Risk |

도메인 프로필이 각 슬롯을 구체 리뷰어 타입에 매핑한다.

#### 2단계 — 리스크 확장

| risk_level | 추가 필수 리뷰어 | 최소 독립 리뷰 기대치 |
|---|---|---|
| `low` | 없음 | 독립 리뷰어 최소 1명 |
| `normal` | 없음 | 독립 리뷰어 최소 1명 + 영향받는 표면에 따라 도메인 확장 |
| `high` | Challenger, Risk Specialist | 독립 리뷰어 세트 + Challenger + 해당되는 경우 Risk Specialist |
| `critical` | Challenger, Risk Specialist, Quality Specialist | 다관점 리뷰 (Challenger 포함). 단일 관점에만 의존한 종결은 허용하지 않는다 |

#### 3단계 — 표면 신호 확장

다음 범위 신호가 감지되면 리뷰어 슬롯을 추가한다:

| 신호 | 추가할 리뷰어 슬롯 |
|---|---|
| 프레젠테이션 표면 — 사용자 대면 출력, 인터랙션 흐름, 시각 설계 | Implementer (프레젠테이션 도메인), Communication Specialist |
| 핵심 로직 — 도메인 모델, 데이터 처리, 알고리즘, 인터페이스 | Implementer (로직 도메인), Design Authority |
| 신뢰 경계 — 인증 정보, 민감 데이터, 권한 | Risk Specialist |
| 운영 설정 — 전달 파이프라인, 인프라, 환경, 런타임 설정 | Operations Specialist |
| 검증 표면 — 수용 기준, 커버리지 artifact, 재현성 | Quality Specialist |
| 문서, 가이드, 사용자 대면 텍스트 | Communication Specialist |

#### 4단계 — 게이트 프로필·미션 모드 조정

- `closure_ready`에는 Quality Specialist를 반드시 포함한다.
- `artifact_only`는 구현 표면에 영향이 없으면 Implementer 리뷰어를 생략할 수 있다.

#### 5단계 — 횡단 변경 확장

표면 휴리스틱에 걸리지 않아도 추가 리뷰를 촉발해야 하는 조건:

- 공개 인터페이스나 계약 변경
- 데이터 모델이나 schema 변경
- 마이그레이션, 백필, 대량 변환
- 신뢰 경계나 권한 변경
- 사용자에게 보이는 콘텐츠나 흐름 변경
- 전달 파이프라인이나 버전 관리 변경

#### 6단계 — 중복 제거와 전문성 보존

중복 리뷰어 타입을 제거한다. `primary_worker_type`이 리뷰 세트에도 나타나면 해당 전문성이 필요하다는 뜻이지 자기 리뷰로 충분하다는 뜻이 아니다.

#### 7단계 — 최소 보장

모든 task에는 `primary_worker_type`과 다른 리뷰어 타입이 최소 하나 있어야 한다. 계산 결과가 worker 자신의 타입만 포함하거나 빈 집합이면 Design Authority를 추가한다.

## 5. 갈등 해소와 최소 참여 인원

### 결정 경계

| 결정 | 주 소유자 | 필수 참여자 / 비고 |
|---|---|---|
| 미션 단계 선택 | Orchestrator | 미션 의도, 미션 모드, 현재 evidence 반영 |
| task 분해와 라우팅 | Orchestrator | 크거나 횡단적 작업엔 Design Authority 의견 권장 |
| 디자인 브리프 승인 | Decision Maker | full-depth 작업엔 Design Authority 리뷰 필수 |
| 구현 계약 승인 | Design Authority가 이끄는 리뷰어 세트 | 도메인 specialist 서명 포함 가능 |
| evidence gate 판결 | 게이트 실행자 / 검증기 | 객관적 메커니즘이며 제품 트레이드오프 결정이 아님 |
| readiness vote | 리뷰 참여자 | task 리스크와 vote 정책에 따름 |
| final verdict | Decision Maker | 직관이 아닌 closure packet에 근거 |
| 메모리 업데이트 (rules.md, agent 노트) | Orchestrator | doc 07 참조 |
| 정책 오버라이드 | 로컬 거버넌스 경로 | doc 10 참조; 반드시 명시적이고 감사 가능해야 함 |

### 갈등 해소

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

### 최소 참여 인원

#### 제안 라운드

최소: 제안자 + 독립 리뷰어 1명.
횡단 변경 권장: 제안자 + Design Authority + 영향받는 도메인 specialist 1명.

#### 준비 상태 라운드

`high` 또는 `critical` 리스크 최소:

- Orchestrator
- Decision Maker
- 독립 specialist 최소 1명
- 리스크에 따라 Challenger

두 번 시도해도 최소 인원이 안 모이면 task를 `escalated`로 전환해야 한다. 단, 로컬 정책이 근거를 기록한 유예 결정을 명시적으로 허용하는 경우는 예외.

## 6. Evidence 흐름과 Closure 통합

모든 specialist는 재사용 가능한 지식을 발견하면 산출물에 `memory_suggestions`를 포함해야 한다. Orchestrator는 회고 과정에서 확인된 제안을 수확하고, 해당 agent memory 파일(`.geas/memory/agents/{agent_type}.md`)에 반영한다.

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
| `known_risks[]` | Design Authority, Risk Specialist, Challenger | worker 자신이 불확실한 지점에 리뷰를 집중 |
| `unverified_cases[]` | Quality Specialist | 검증 우선순위 결정 |
| `possible_stubs[]` | Quality Specialist, Design Authority, Challenger | 미완성 구현의 명시적 확인 강제 |
| `what_to_test_next[]` | Quality Specialist | 검증 시나리오 설계 가속 |
| `summary` | 전체 리뷰어 | 리뷰 방향 설정용. 리뷰 자체를 대체하지 않는다 |

### Worker Self-Check 부재 시 규칙

Worker self-check가 필요한데 없으면:

- 리뷰 세트가 task를 리뷰 가능 상태로 취급해서는 안 된다
- Task는 리뷰 전 단계에 머물거나 상태를 복원해야 한다
- Specialist가 부재를 기록할 수 있지만, 부재 자체가 대체 artifact가 되지 않는다

### 필수 리뷰어 해소

라우팅 규칙에 따라 필수 리뷰 세트가 충족되어야 task의 리뷰가 완료된다:

- 모든 필수 리뷰어 타입이 리뷰를 제출했거나
- 공식 문서화된 대체 경로가 존재하거나
- Task가 에스컬레이션되었거나

Orchestrator가 비활동을 묵시적 승인으로 간주하는 것은 허용하지 않는다.

### Closure 포함 규칙

Specialist가 실질적으로 참여했으면 closure packet에 해당 리뷰나 추적 가능한 요약 참조를 포함해야 한다. 결정에 영향을 준 참여는 나중에 감사할 수 있어야 한다.

### 진화 연계 규칙

Specialist는 다음을 관찰할 때 메모리와 규칙 후보를 생성해야 한다:

| 관찰 내용 | 우선순위 |
|---|---|
| 반복되는 차단 실패 | 최고 — 즉시 규칙 후보 |
| 반복되는 예방 가능 회귀 | 높음 — 패턴으로 포착할 가치 |
| 재사용 가치가 높은 성공 패턴 | 높음 — 표준화할 가치 |
| 리뷰어 체크리스트 빈틈 | 중간 — 향후 리뷰 품질 개선 |
| 도메인별 안티패턴 | 중간 — 재발 방지 |
| 낮은 가치의 조언성 관찰 | 낮음 — evidence가 강할 때만 포착 |

## 7. 운영 규칙

### 단일 에이전트·소규모 팀 운영

하나의 물리적 에이전트가 여러 논리적 타입을 맡을 수 있지만, artifact에 명시적 역할 전환이 드러나야 한다. 단일 에이전트 모드에서:

- 구현 역할과 리뷰 역할을 별도로 기록해야 한다
- 자기 갈등은 의사결정 기록에 포착해야 한다
- `high`·`critical` 갈등은 사용자에게 에스컬레이션하는 게 좋다
- final verdict는 명시적 Decision Maker 역할 전환 아래에서 내려야 한다
- 독립 리뷰가 실제로 일어나지 않았는데 일어난 것처럼 가장할 수 없다

### 사용자 에스컬레이션 경계

다음 중 하나라도 발생하면 사용자에게 에스컬레이션해야 한다:

- 법적, 프라이버시, 정책 불확실성
- 불확실성이 좁혀지지 않는 반복적 `iterate` 또는 반복적 복구 실패
- 해소 안 되는 critical 리스크 의견 대립
- 사용자 승인이 필요한 프로필 하에서 규제·안전 관련 산출물 전달
- 정상적 hard-stop을 약화하는 정책 오버라이드

### 추적 요건

artifact로부터 다음을 재구성할 수 있어야 한다:

- 주 작업자가 누구였는지
- 누가 리뷰했는지
- 누가 반론을 제기했는지
- 누가 final verdict를 내렸는지
- 각 차단 의견을 어떤 역할이 제기했는지
- 어떤 반대 의견이 기각되었고 왜 그랬는지
- 논리적 역할 분리가 하나의 물리적 에이전트로 합쳐졌는지 여부

### Artifact 타입 명명 규칙

artifact 타입과 저장 위치의 대응은 다음과 같다:

| artifact 타입 | 저장 위치 |
|---|---|
| evidence (specialist review, challenge, verdict) | `evidence/{agent}.json` — 역할은 파일명이 아니라 내부 필드로 식별 |
| 파이프라인 단계 산출물 (self-check, gate, closure 등) | `record.json` 섹션 — 섹션명이 타입을 식별 |
| vote round / decision | `decisions/vote-round-{topic}.json` |
| task contract | `tasks/{tid}/contract.json` |

역할 정체는 파일명이 아니라 검증된 필드 안에 담는다.

## 핵심 선언

Geas에서 권한은 장식이 아니며 specialist evidence는 형식적 절차가 아니다. 역할은 누가 결정할 수 있는지, 어떤 evidence를 봐야 하는지, 미래 감사자가 결정의 정당성을 어떻게 확인할 수 있는지를 제한하기 위해 존재한다.
