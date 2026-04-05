# 06. Specialist Evidence Matrix

> **기준 문서.**
> 각 specialist 슬롯이 어떤 evidence를 검토해야 하고, 리뷰 산출물에 무엇을 포함해야 하며, specialist evidence가 종결과 진화에 어떻게 흘러가는지를 정의한다.

## 원칙

Specialist 참여는 evidence 품질을 바꿀 때에만 의미가 있다. Task에 이름이 올라가 있다고 충족되는 것이 아니라, 해당 표면을 실제로 검토하고 리뷰 결과를 기록했을 때 충족된다.

## Specialist 리뷰 공통 artifact

모든 specialist 리뷰에 포함해야 할 필드:

| 필드 | 설명 |
|---|---|
| `reviewer_type` | 리뷰를 작성한 specialist 슬롯 |
| `status` | `approved`, `changes_requested`, 또는 `blocked` |
| `summary` | 리뷰 결과와 판단 근거 |
| `blocking_concerns[]` | 개별 대응 가능한 차단 사안 |
| `evidence_refs[]` | 리뷰 과정에서 검토한 artifact |
| `notes_on_risk[]` | 해당 슬롯의 관할에 해당하는 리스크 관찰 |
| `rubric_scores[]` | 루브릭 차원별 점수 (선택) |

Evidence 참조가 없는 리뷰도 존재할 수 있지만, 신뢰도가 낮은 입력으로 취급해야 하며 높은 assurance 수준에서는 단독으로 종결 근거가 될 수 없다.

## Status 의미

| status | 의미 |
|---|---|
| `approved` | 리뷰어의 관할 내에서 task를 수용할 수 있다고 판단 |
| `changes_requested` | 수용 전에 추가 작업이 필요하다 |
| `blocked` | 명시적 에스컬레이션 없이는 진행을 막아야 할 구조적 문제를 발견 |

## 슬롯별 최소 evidence 기대치

### Authority 슬롯

| 슬롯 | 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|---|
| Design Authority | 구조적 결정, 인터페이스, 의존성, 유지보수성 | 설계 리뷰 요약, 구조 적합성 평가 | 경계 비호환, 취약한 결합, 불안전한 복잡성 |
| Challenger | 종결 전체 과정을 반대 입장에서 | 실질적 문제 제기가 포함된 challenge review | 숨겨진 가정, 검토 안 된 리스크, 성급한 종결 논리 |

### Specialist 슬롯

| 슬롯 | 검토 대상 | 산출물 | 주요 차단 사유 |
|---|---|---|---|
| Implementer (동료 리뷰) | 접근법과 계약의 일치, 인터페이스 정확성, 회귀 리스크 | 구현 리뷰 노트, 경계 관찰 | 계약 위반, 인터페이스 파손, 회귀 발생 |
| Quality Specialist | 수용 기준, 검증 커버리지, 부정 경로 | 커버리지 분석, 누락 경로 노트, 재현성 평가 | 기준 미충족, 미검증 부정 경로, 재현 불가 evidence |
| Risk Specialist | 신뢰 경계, 민감 데이터 처리, 도메인별 위협 | 리스크 노트, 위협 관찰 | 권한 상승, 데이터 노출, 안전하지 않은 신뢰 가정 |
| Operations Specialist | 전달 파이프라인, 환경 준비, 롤백 능력 | 운영 준비 노트 | 배포 장애, 설정 드리프트, 롤백 경로 누락 |
| Communication Specialist | 문서 영향, 사용자 대면 변경, 명확성 | 문서 완전성 노트, 대상 적합성 평가 | 낡은 안내, 누락된 가이드, 오해를 유발하는 콘텐츠 |

### 소프트웨어 도메인 예시

소프트웨어 개발 프로필을 사용하는 프로젝트에서 슬롯이 구체적으로 검토하는 것:

| 슬롯 | 구체 타입 | 도메인별 검토 초점 |
|---|---|---|
| Implementer | `frontend_engineer` | 변경된 UI 경로, 인터랙션 상태, 반응형 동작, 접근성 |
| Implementer | `backend_engineer` | API 계약, 데이터 흐름, 마이그레이션 안전, 오류 처리, 멱등성 |
| Quality Specialist | `qa_engineer` | 기준 대비 테스트 커버리지, 부정 경로, 시연 검증 |
| Risk Specialist | `security_engineer` | 인증/인가 경계, 비밀 관리, 인젝션 표면, 남용 경로 |
| Operations Specialist | `devops_engineer` | CI 안정성, 배포 영향, 설정 드리프트, 출처 관리 |
| Communication Specialist | `technical_writer` | 문서 완전성, 마이그레이션 안내, 운영자 주의사항 |
| Communication Specialist | `ui_ux_designer` | 사용자 흐름 일관성, 문구 명확성, 시각적 일관성 |

## Task 종류별 매트릭스

Task 종류별 최소 리뷰 기대치 (specialist 슬롯 기준):

| task_kind | 필수 리뷰 슬롯 | 자주 추가되는 슬롯 |
|---|---|---|
| `implementation` | Design Authority | Quality, Risk, Implementer (동료), Operations, Communication |
| `documentation` | Communication Specialist | Quality, Design Authority (구조적 의미가 바뀐 경우) |
| `configuration` | Operations Specialist | Risk, Quality, Design Authority |
| `design` | Design Authority | Communication, Implementer, Quality |
| `review` | Risk Specialist | Design Authority, Quality, Operations |
| `analysis` | Design Authority, Quality Specialist | Risk, Communication |
| `delivery` | Operations Specialist, Quality Specialist | Communication, Risk |

## Risk level별 매트릭스

| risk_level | 최소 독립 리뷰 기대치 |
|---|---|
| `low` | 독립 리뷰어 최소 1명 |
| `normal` | 독립 리뷰어 최소 1명 + 영향받는 표면에 따라 도메인 확장 |
| `high` | 독립 리뷰어 세트 + Challenger + 해당되는 경우 Risk Specialist |
| `critical` | 다관점 리뷰 (Challenger 포함). 단일 관점에만 의존한 종결은 허용하지 않는다 |

## Evidence 출처 우선순위

Specialist는 가능하면 다음 순서로 직접적인 evidence를 선호한다:

| 우선순위 | 출처 | 신뢰 수준 |
|---|---|---|
| 1 | 현재 task를 위해 생산된 정규 artifact | 최고 |
| 2 | 재현 가능한 명령, 검증, 테스트 결과 | 높음 |
| 3 | 산출물 직접 검토 | 높음 |
| 4 | 요약 및 메모리 패킷 | 중간 |
| 5 | artifact에 연결되지 않은 서술 주장 | 최저 |

낮은 우선순위의 evidence가 높은 우선순위의 모순되는 evidence를 근거 없이 무효화할 수 없다.

## Worker artifact 활용

모든 specialist가 worker artifact를 참고할 수 있지만, 다음 조합이 특히 중요하다:

| worker artifact | 주 소비 슬롯 | 기대 효과 |
|---|---|---|
| `known_risks[]` | Design Authority, Risk Specialist, Challenger | worker 자신이 불확실한 지점에 리뷰를 집중 |
| `untested_paths[]` | Quality Specialist | 검증 우선순위 결정 |
| `possible_stubs[]` | Quality Specialist, Design Authority, Challenger | 미완성 구현의 명시적 확인 강제 |
| `what_to_test_next[]` | Quality Specialist | 검증 시나리오 설계 가속 |
| `summary` | 전체 리뷰어 | 리뷰 방향 설정용. 리뷰 자체를 대체하지 않는다 |

## Worker Self-Check 부재 시 규칙

Worker self-check가 필요한데 없으면:

- 리뷰 세트가 task를 리뷰 가능 상태로 취급해서는 안 된다
- Task는 리뷰 전 단계에 머물거나 상태를 복원해야 한다
- Specialist가 부재를 기록할 수 있지만, 부재 자체가 대체 artifact가 되지 않는다

## 필수 리뷰어 해소

라우팅 규칙에 따라 필수 리뷰 세트가 충족되어야 task의 리뷰가 완료된다:

- 모든 필수 리뷰어 타입이 리뷰를 제출했거나
- 공식 문서화된 대체 경로가 존재하거나
- Task가 에스컬레이션되었거나

Orchestrator가 비활동을 묵시적 승인으로 간주하는 것은 허용하지 않는다.

## Closure 포함 규칙

Specialist가 실질적으로 참여했으면 closure packet에 해당 리뷰나 추적 가능한 요약 참조를 포함해야 한다. 결정에 영향을 준 참여는 나중에 감사할 수 있어야 한다.

## 진화 연계 규칙

Specialist는 다음을 관찰할 때 메모리와 규칙 후보를 생성해야 한다:

| 관찰 내용 | 우선순위 |
|---|---|
| 반복되는 차단 실패 | 최고 — 즉시 규칙 후보 |
| 반복되는 예방 가능 회귀 | 높음 — 패턴으로 포착할 가치 |
| 재사용 가치가 높은 성공 패턴 | 높음 — 표준화할 가치 |
| 리뷰어 체크리스트 빈틈 | 중간 — 향후 리뷰 품질 개선 |
| 도메인별 안티패턴 | 중간 — 재발 방지 |
| 낮은 가치의 조언성 관찰 | 낮음 — evidence가 강할 때만 포착 |

## 핵심 선언

Specialist 리뷰는 evidence에 기반하고, 관할을 인식하며, 나중에 다른 리뷰어가 기억이 아닌 기록으로 감사할 수 있는 형태로 보존될 때에만 가치가 있다.
