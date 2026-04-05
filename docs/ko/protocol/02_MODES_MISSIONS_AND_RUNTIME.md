# 02. Missions and Runtime

> **기준 문서.**
> 이 문서는 미션 구조, 미션 운영 모드, 4-phase 모델, 런타임 phase, phase 전이 제어를 정의한다.

## 목적

미션은 사용자 요청을 실행 가능한 프로토콜 객체로 변환한다. 미션 계층은 구현을 시작하기 전에 다음 질문 전부에 답할 수 있도록 존재한다:

- 어떤 문제를 해결하는가
- 어떤 범위가 약속되었는가
- 작업이 어떤 phase에 있는가
- 어떤 엄격도 수준이 적절한가
- 현재 어떤 작업이 활성, 일시 정지, 완료 상태인가
- phase를 떠나기 전에 어떤 evidence가 필요한가

이 질문은 소프트웨어 개발, 연구 조율, 콘텐츠 제작, 데이터 파이프라인 구축 등 작업 유형에 관계없이 동일하게 적용된다.

## 미션 모델

미션은 여러 task에 걸쳐 일관된 사용자 목적을 전달할 수 있는 가장 작은 프로토콜 객체다.

### 필수 필드

미션은 최소한 다음 필드를 포함해야 한다:

| 필드 | 설명 |
|---|---|
| `mission_id` | 미션의 고유 식별자 |
| `intent` | 미션의 목적을 나타내는 canonical intent enum 값 |
| `goal` | 기대 결과에 대한 사람이 읽을 수 있는 설명 |
| `done_when` | 이 조건이 참이면 미션 완료라고 판단할 수 있는 검증 가능한 조건 |
| `constraints` | 작업 범위를 한정하는 경계와 제약 |
| `source_request` | 미션을 발생시킨 원본 사용자 요청 |
| `entry_signals` | 미션 생성 시점에 참이었던 조건 |
| `scope_in` | specifying 중 약속된 범위 |
| `current_phase` | 활성 미션 phase |

### 추가 권장 메타데이터

Assurance profile(doc 13)에 따라 포함 여부가 달라진다. `prototype`에서는 생략 가능, `delivery` 이상에서는 포함 권장. Recovery, traceability, scope 관리에 필요한 맥락을 담는다.

| 필드 | 설명 |
|---|---|
| 제외 범위 / 비목표 | scope creep 방지를 위한 명시적 제외 항목 |
| 리스크 요약 | 알려진 리스크와 대응 방안 |
| 외부 의존성 요약 | 팀 통제 밖의 의존성 |
| 활성 assurance profile 참조 | 이 미션을 관할하는 assurance profile 링크 |
| phase 소유자 노트 | Orchestrator의 phase별 맥락 메모 |
| 초기 부채 또는 알려진 제약 | 기존 기술 또는 프로세스 부채 |
| 롤백 / 범위 축소 전략 | 필요 시 통제된 후퇴 계획 |

프로젝트는 schema가 확장될 때까지 이를 동반 artifact에 저장할 수 있다.

## Mission Intent Enum

Intent enum은 미션의 근본적 목적을 분류한다. 프로젝트는 이를 기반으로 기본 엄격도, reviewer 라우팅, phase 동작을 선택한다.

| intent | 설명 |
|---|---|
| `explore` | 출시 약속 없이 조사, 연구, 프로토타이핑 |
| `plan` | 구현 없이 계획, 설계, 아키텍처 수립 |
| `build` | 새로운 기능이나 산출물 생성 |
| `fix` | 결함, 회귀, 인시던트 수정 |
| `review` | 기존 작업의 품질, 준수, 개선 검토 |
| `decide` | 논쟁적이거나 모호한 주제에 대한 구조화된 결정 |
| `recover` | 세션 무결성 복원 또는 중단된 작업 재개 |

프로젝트는 이 값들로부터 로컬 하위 모드를 파생할 수 있지만, 상호 운용성을 위해 canonical enum을 유지해야 한다.

## 미션 운영 모드

미션 mode는 기본적으로 적용되는 엄격도를 결정한다. Mode 선택은 반드시 명시적이어야 한다. Mode는 기본 phase 순서를 변경하지 않으면서 phase 깊이, reviewer 라우팅, evidence 임계값을 제어한다.

| mode | 예상 용도 | 기본 엄격도 |
|---|---|---|
| `lightweight` | 작고, 국지적이며, 저위험 변경 | 호환 가능한 최소 엄격도; phase가 압축될 수 있으나 의미적으로 건너뛸 수 없음 |
| `standard` | 일반 구조화된 작업 | 정상 reviewer 라우팅을 포함한 전체 task 생명주기 |
| `full_depth` | 교차적, 위험한, 또는 모호한 작업 | 명시적 design brief, 광범위 리뷰, 강력한 evolution 산출물 |
| `recovery_first` | 중단되거나 손상된 세션 | 새로운 구현보다 recovery 및 무결성 복원이 우선 |
| `audit_only` | 의도된 구현 변경 없이 진단, 리뷰, evidence 수집 | 강력한 traceability 및 리뷰, 가벼운 구현 경로 |

규칙:

- 미션 mode는 doc 00의 기본 불변 조건을 약화시켜서는 안 된다.
- `full_depth`는 새로운 아키텍처, 주요 리팩토링, 보안 민감 변경, 불명확한 요구사항에 대해 기본값이어야 한다.
- `recovery_first`는 상태 무결성이 복원될 때까지 정상 처리량 최적화를 중단해야 한다.

## Initiative 4-Phase 모델

모든 미션은 다음 phase를 순서대로 거친다. 작은 미션은 필수 evidence가 여전히 생산되는 한 일부 phase를 빠르게 통과할 수 있지만, 어떤 phase도 의미적으로 건너뛸 수 없다.

1. `specifying`
2. `building`
3. `polishing`
4. `evolving`

### Phase 흐름

```text
specifying --[phase gate 1]--> building --[phase gate 2]--> polishing --[phase gate 3]--> evolving --[phase gate 4]--> close
```

### Phase-gate 원칙

Phase gate는 phase 간의 엄격한 경계다. 조기 전이로 인해 후속 품질이 저하되는 것을 방지하기 위해 존재한다.

- Phase gate는 artifact와 의미적 준비 상태를 모두 검사해야 한다.
- 필수 gate evidence 없이 phase를 떠나는 것은 프로토콜 위반이다.
- Phase gate는 형식적인 절차가 아니라 집행 지점이다.

## Phase 상세

### 1) `specifying`

사용자 요청을 구조화된 미션 정의로 변환하는 단계. 작업을 안전하게 시작할 수 있을 만큼 충분히 명확해지면 종료된다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 요청을 미션 언어로 정규화 / `scope_in` 확정 / 주요 설계 결정 해소 또는 기록 / 초기 task 컴파일 / 필요한 엄격도 결정 |
| **산출물** | mission spec, design brief (필요 시), task contract, vote-round result (full_depth 시), phase review |
| **종료 조건** | 미션 정의가 실행에 충분히 안정적 / task 목록이 실행 가능 / 해소 안 된 모호성이 명시적 탐색 task로 전환됨 / 필요 시 design brief 승인 기록됨 |

### 2) `building`

미션의 핵심 가치를 실현하는 단계. Task가 `ready`에서 `passed`까지 전체 생명주기를 거치는 주요 phase다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 핵심 가치 경로 구현 / task를 반복적으로 종결 / 의도를 검증된 변경으로 전환 |
| **산출물** | task별: implementation contract, worker self-check, specialist review, gate result, closure packet, challenge review (high/critical), final verdict, retrospective · phase 수준: gap assessment, debt register, phase review |
| **종료 조건** | 모든 MVP-critical task가 `passed` / 미해결 blocking 충돌 없음 / critical debt가 없거나 공식 escalation됨 / scope creep가 숨겨지지 않고 가시적으로 평가됨 |

### 3) `polishing`

결과물을 전달·채택·신뢰에 적합한 수준으로 강화하는 단계. 모든 관련 품질 차원에 걸쳐 specialist slot 리뷰를 적용한다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 전달 준비를 위한 결과 강화 / 전 specialist slot에 걸친 품질 리뷰 / 불필요한 artifact, boilerplate, drift, 숨겨진 지름길 식별 |
| **산출물** | specialist slot별 리뷰 (security, documentation, entropy), debt register 갱신, gap assessment, phase review |
| **종료 조건** | high·critical debt가 분류됨 / 전달 표면에 대한 필수 specialist 리뷰 완료 / 알려진 리스크에 근거 기록 / 문서·운영 준비가 낡지 않음 |

### 4) `evolving`

미션에서 배운 것을 포착하고 시스템을 다음 작업에 대비시키는 단계. 교훈 추출, 부채 통합, memory 피드를 통해 미션이 배운 것 없이 끝나는 것을 방지한다.

| 구분 | 내용 |
|---|---|
| **하는 일** | 약속 범위와 전달 범위 비교 / 교훈·memory·규칙 추출 / 부채 통합 / 다음 작업에 필요한 이월 준비 |
| **산출물** | gap assessment, rules update, debt register (최종), mission summary, phase review, memory promotion 기록 |
| **종료 조건** | gap assessment 존재 / retrospective 묶음 존재 / rules·memory 조치 기록됨 / debt snapshot 캡처됨 / mission summary 존재 |

## 런타임 Phase

런타임 phase는 미션 phase와 무관하게 세션이 **현재** 무엇을 하고 있는지를 기술한다. 세션은 단일 미션 phase 내에서 런타임 phase를 여러 번 순환한다.

| 런타임 phase | 주요 허용 작업 |
|---|---|
| `bootstrap` | 상태 로드, recovery 조건 감지, 환경 및 앵커 검증 |
| `planning` | 미션 명확화, task 정제, contract 검토, 허용 시 scope 수정 |
| `scheduling` | ready task 선택, 동시성 윈도우 계산, lock 할당 |
| `executing` | workspace 내 구현 또는 편집, 로컬 evidence 생산 |
| `integrating` | 직렬화된 integration lane 진입, baseline 재조정, 변경 통합 |
| `verifying` | gate 실행, packet 조립, vote / verdict 흐름 실행 |
| `learning` | retrospective, memory 추출, debt 및 rule 업데이트 |
| `idle` | 활성 진행 중 작업 없음; 대기, 일시 정지, 또는 미션 완료 |

## `run.json` 핵심 필드

런타임 앵커는 세션 진행 상황을 추적하는 영속 상태 객체다. 최소한 다음 필드를 노출해야 한다:

| 필드 | 설명 |
|---|---|
| `session_start_ref` | 세션 시작을 표시하는 참조점 (커밋, 스냅샷, 타임스탬프) |
| `integration_target` | 통합된 작업을 수신하는 대상 브랜치, 환경, artifact 모음 |
| `phase` | 현재 런타임 phase |
| `mission_phase` | 현재 미션 phase |
| `focus_task_id` | 현재 실행 중인 task |
| `checkpoint_seq` | 단조 증가하는 checkpoint 시퀀스 번호 |
| `recovery_state` | recovery 상태 (none, detecting, restoring 등) |
| `active_locks` | 현재 보유 중인 리소스 lock |
| `packet_refs` | 조립된 closure packet에 대한 참조 |

### 추가 권장 필드

Assurance profile(doc 13)은 미션에 필요한 엄격도를 정한다: `prototype`(가장 가벼움) → `delivery` → `hardened` → `regulated`(가장 엄격). 아래 필드는 `prototype`에서는 생략 가능, `delivery`에서는 포함 권장, `hardened`·`regulated`에서는 사실상 필수.

| 필드 | 설명 |
|---|---|
| 선택된 미션 mode | 이 미션을 관할하는 운영 mode |
| assurance profile | 활성 assurance profile 참조 |
| 현재 integration lane 소유자 | integration lane을 보유한 에이전트 |
| 남은 단계 | phase 또는 미션 완료까지의 추정 단계 |
| 마지막 safe boundary | 가장 최근의 안전한 recovery 지점 |
| 마지막 성공 검증 타임스탬프 | 마지막 gate 또는 검증이 통과한 시점 |
| 현재 blocking 원인 | 작업이 blocked된 사유 (해당 시) |

## Phase 진입 규칙

Phase 진입 규칙은 미션이 각 phase로 전이하기 전에 충족되어야 할 전제조건을 정의한다. 품질이 낮은 후속 작업을 초래하는 조기 전진을 방지한다.

### `specifying` 진입

새 미션은 다음 조건에서 `specifying`에 진입한다:

- 사용자 의도가 존재
- 대상 workspace 또는 전달 표면이 식별 가능
- 미해결 이전 recovery 조건이 안전한 planning을 방해하지 않음

### `building` 진입

미션은 design brief와 task set이 선택된 엄격도 수준에서 실행에 적합할 때까지 `building`에 진입해서는 안 된다.

### `polishing` 진입

미션은 핵심 가치 경로가 기능적으로 존재할 때에만 `polishing`에 진입해야 한다. 미션이 명시적으로 재범위화되지 않는 한, `polishing`이 미완성 핵심 구현의 대체가 되어서는 안 된다.

### `evolving` 진입

사소하지 않은 변경이라면 미션 종료 전에 반드시 `evolving`에 진입해야 한다. 프로젝트는 작은 task에서 evolving phase를 압축할 수 있지만, 교훈 / 부채 / gap 표면은 반드시 보존해야 한다.

## Phase 전이 조건

위의 Phase 상세에서 각 phase가 만들어내는 산출물을 나열했다. 이 섹션은 그 산출물 중 **다음 phase로 넘어가기 위해 반드시 존재해야 하는 것**을 정의한다. 이 조건을 충족하지 않고 전이를 시도하면 프로토콜 위반이다.

| 전이 | 반드시 있어야 하는 것 | 확인 내용 |
|---|---|---|
| `specifying` → `building` | phase review | 미션 확정, task 준비 완료, design brief 승인 (필요 시) |
| `building` → `polishing` | phase review, gap assessment | 모든 MVP task가 passed, 범위 대비 전달 현황 |
| `polishing` → `evolving` | phase review, gap assessment, debt register | specialist 리뷰 완료, 부채 분류 상태 |
| `evolving` → close | phase review, gap assessment, retrospective, debt register, mission summary | 학습 추출 완료, 부채 최종 정리, 미션 요약 |

### 추가 권장 artifact

미션의 결정 이력을 보존하는 데 유용하다. Assurance profile이 높을수록 포함을 강하게 권장한다.

| artifact | 담는 것 |
|---|---|
| decision record | 주요 범위 변경이나 갈등 해소의 근거 |
| rules update | 미션에서 도출된 규칙 변경 |
| run summary | 미션 실행을 사람이 읽을 수 있는 형태로 요약 |

## Scope In / Scope Out

Scope 추적은 전달된 작업이 약속된 작업과 은밀하게 괴리되는 흔한 실패 모드를 방지한다.

- `scope_in`은 specifying 중 약속된 범위다.
- `scope_out`은 `passed` task evidence로 뒷받침되는 전달된 범위다.

규칙:

- `scope_out`은 희망적 요약이 아니라 evidence 기반 task에서 도출되어야 한다.
- `scope_in`과 `scope_out` 사이의 실질적 차이는 gap assessment에 반영되어야 한다.
- 미승인 scope 확장은 implementation-contract amendment 또는 phase 수준 재승인을 촉발해야 한다.

## 미션 수정 규칙

미션은 통제된 조건 하에서만 수정할 수 있다. 통제되지 않은 수정은 scope drift와 책임 소실의 주요 원인이다.

다음 중 하나가 참이 될 때 수정이 필수다:

- 수용된 scope가 실질적으로 변경됨
- 설계 가정이 변경됨
- 리스크 수준이 실질적으로 상승함
- 외부 의존성이 원래 계획을 무효화함
- 선택된 assurance profile이 더 이상 작업에 맞지 않음

수정은 다음을 생산해야 한다:

| artifact | 설명 |
|---|---|
| 업데이트된 근거 | 수정이 필요한 이유 |
| 업데이트된 영향받는 task | 추가, 변경, 제거되는 task |
| 업데이트된 리스크 요약 | 신규 또는 변경된 리스크 |
| 업데이트된 phase review 노트 | 현재 phase에 대한 영향 |

## Phase 전이 실패

Phase 전이가 실패하면 프로토콜은 누락된 evidence를 넘겨짚지 않고 명시적 recovery를 요구한다.

1. Orchestrator는 어떤 종료 조건이 충족되지 않았는지 식별해야 한다.
2. 누락 항목은 임의로 넘기지 않고 명시적 작업으로 전환되어야 한다.
3. 반복 실패 시도는 재범위화, escalation, assurance-profile 재검토를 유발해야 한다.
4. 실패 이력은 phase-review 기록에 가시적으로 남아야 한다.

## 긴급 예외

프로젝트는 hotfix 또는 인시던트 대응을 위해 긴급 경로를 호출할 수 있지만, 다음은 여전히 유지되어야 한다:

- task artifact와 evidence가 존재해야 함
- 예외 근거가 기록되어야 함
- 건너뛴 강화는 부채 또는 후속 작업으로 기록되어야 함
- 미션은 진정한 종료 전에 반드시 evolving을 통과해야 함

긴급 예외는 허점이 아니라 시간 압박 하에서도 traceability를 보존하는 통제된 성능 저하 경로다.

## 핵심 선언

미션 및 런타임 구조는 대규모 AI 지원 작업이 국소 최적화의 무질서한 집합으로 와해되는 것을 막기 위해 존재한다. 명시적 phase 시맨틱이 없는 미션은 관할된 작업이 아니다.
