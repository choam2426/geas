# 09. Runtime Artifacts and Schemas

> Geas의 runtime artifact, 저장 위치, 정규 스키마 사이의 연결 기준을 정의한다.

## 이 문서의 역할

이 문서는 runtime artifact를 찾는 기준 문서다. 다른 문서가 artifact의 의미, 책임, 판단 기준을 설명한다면, 이 문서는 각 artifact가 어디에 저장되고 어떤 정규 스키마를 따르는지를 한곳에서 연결한다.

## 문서와 스키마를 잇는 방식

Geas는 artifact를 읽을 때 다음 계층을 함께 본다. 한 계층이 다른 계층의 역할을 대신해서는 안 된다.

| 계층 | 책임 |
|---|---|
| 산문 문서 | 왜 필요한지, 언제 쓰는지, 누가 책임지는지 설명 |
| doc 09 | artifact, 정규 경로, 정규 스키마, 관련 문서를 연결 |
| 스키마 | 필드, enum, 구조 제약을 정의 |
| validator | 스키마 적합성과 일부 기계 검증 규칙을 집행 |

## 읽는 법

1. artifact의 목적과 책임은 관련 문서에서 먼저 읽는다.
2. 저장 위치와 정규 스키마는 이 문서에서 찾는다.
3. 정확한 필드와 enum은 각 스키마에서 확인한다.

## Artifact Registry

먼저 어떤 artifact가 어디에 있고 어떤 스키마를 따르는지 본다. 세부 섹션 규칙과 phase별 맥락은 뒤의 패밀리별 규칙에서 확인한다.
아래 표는 관련 문서 순서대로 정렬한다.

### 정규 스키마가 있는 artifact

| artifact | 정규 경로 | 정규 스키마 | 관련 문서 |
|---|---|---|---|
| evidence (dispatch) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence.schema.json` | doc 01 |
| evidence (implementation) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-implementation.schema.json` | doc 01 |
| evidence (review) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-review.schema.json` | doc 01 |
| evidence (verification) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-verification.schema.json` | doc 01 |
| evidence (challenge) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-challenge.schema.json` | doc 01 |
| evidence (decision) | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json` | `docs/schemas/evidence-decision.schema.json` | doc 01 |
| mission spec | `.geas/missions/{mission_id}/spec.json` | `docs/schemas/mission-spec.schema.json` | doc 02 |
| design brief | `.geas/missions/{mission_id}/design-brief.json` | `docs/schemas/design-brief.schema.json` | doc 02 |
| phase review | `.geas/missions/{mission_id}/phase-reviews/*.json` | `docs/schemas/phase-review.schema.json` | doc 02 |
| run state | `.geas/state/run.json` | `docs/schemas/run-state.schema.json` | doc 02 |
| task contract | `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` | `docs/schemas/task-contract.schema.json` | doc 03 |
| execution record | `.geas/missions/{mission_id}/tasks/{task_id}/record.json` | `docs/schemas/record.schema.json` | doc 03, 05 |
| worker self-check | `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json` | `docs/schemas/self-check.schema.json` | doc 03 |
| lock manifest | `.geas/state/locks.json` | `docs/schemas/lock-manifest.schema.json` | doc 04 |
| vote round | `.geas/missions/{mission_id}/decisions/*.json` | `docs/schemas/vote-round.schema.json` | doc 05 |
| recovery packet | `.geas/recovery/*.json` | `docs/schemas/recovery-packet.schema.json` | doc 06 |
| rules update | `.geas/missions/{mission_id}/evolution/rules-update.json` | `docs/schemas/rules-update.schema.json` | doc 07 |
| debt register | `.geas/missions/{mission_id}/evolution/debt-register.json` | `docs/schemas/debt-register.schema.json` | doc 08 |
| gap assessment | `.geas/missions/{mission_id}/evolution/gap-assessment.json` | `docs/schemas/gap-assessment.schema.json` | doc 08 |
| health check | `stdout` | `docs/schemas/health-check.schema.json` | doc 10 |

`evidence_kind`는 `evidence (dispatch)`에서 어떤 하위 스키마로 분기할지 결정하는 기준이다. enum 값은 `docs/schemas/evidence.schema.json`이 직접 정의한다.

### 공통 정의 스키마

| 스키마 | 용도 | 관련 문서 |
|---|---|---|
| `docs/schemas/_defs.schema.json` | slot enum, timestamp, 공통 식별자 같은 공통 정의를 모아 둔 기반 스키마 | doc 01, 03, 09 |

### 스키마가 없는 artifact

| artifact | 정규 경로 | 형식 | 관련 문서 |
|---|---|---|---|
| context packet | `.geas/missions/{mission_id}/tasks/{task_id}/packets/{agent}.md` | markdown | doc 03 |
| rules | `.geas/rules.md` | markdown | doc 07 |
| agent memory | `.geas/memory/agents/{agent}.md` | markdown | doc 07 |

## Artifact 패밀리별 세부 규칙

Geas는 실행의 모든 단계에서 artifact를 생성한다. 아래 테이블은 artifact를 생성 phase 또는 하위 시스템별로 분류한다.

### Specifying artifact

Specifying phase에서 생성되는 artifact로, mission을 정의하고 task로 분해하는 과정의 산출물이다.

| artifact | 설명 |
|---|---|
| mission spec | mission의 범위, 목표, 제약 정의 |
| design brief | 구조적 접근 방식과 핵심 결정 기술 |
| decision record | 구조화된 결정과 그 근거 기록 |
| 초기 task compilation 출력 | mission spec과 design brief에서 생성된 task contract |
| phase review | Specifying phase 종료 평가 |

### Per-task pipeline artifact

각 task의 canonical 저장 위치는 `.geas/missions/{mission_id}/tasks/{task_id}/`다. 아래 파일명은 모두 이 task root를 기준으로 쓴다.

| artifact | task root 기준 파일 | 설명 |
|---|---|---|
| task contract | `contract.json` | task의 달성 목표, 분류, 수락 기준 정의 |
| context packet | `packets/{agent}.md` | 작업 시작 전 에이전트에게 전달되는 역할별 브리핑 |
| execution record | `record.json` | task 진행 중 생성되는 기록성 섹션을 축적하는 단일 파일 (아래 참조) |
| worker self-check | `self-check.json` | 주 worker의 자체 평가 artifact |
| evidence 파일 | `evidence/{agent}.json` | `evidence_kind`별 에이전트 기록 |

#### record.json 섹션

Execution record는 pipeline이 진행됨에 따라 섹션을 축적한다.

| 섹션 | 추가 시점 | 주요 필드 |
|---|---|---|
| `implementation_contract` | implementation contract 승인 | planned_actions, edge_cases, status |
| `gate_result` | evidence gate | verdict (pass/fail/block/error), tier_results, rubric_scores, blocking_dimensions |
| `challenge_review` | challenger review (high/critical) | concerns, blocking |
| `verdict` | final verdict | verdict (`approved`/`changes_requested`/`escalated`), rationale |
| `closure` | closure 조립 | change_summary, reviews, open_risks |
| `retrospective` | task 회고 | what_went_well, what_broke, memory_candidates |

#### self-check.json

worker self-check는 `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json`에 저장한다. 정규 형식은 `self-check.schema.json`을 따른다.

| 주요 필드 | 설명 |
|---|---|
| `confidence` | worker의 자기 평가 점수 (1-5) |
| `known_risks` | 이미 인지한 리스크 |
| `unverified_cases` | 아직 검증하지 못한 경우 |
| `summary` | 구현 결과와 남은 우려 요약 |

#### Evidence 종류

Evidence 파일은 `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.json`에 저장한다. 공통 진입점은 `evidence.schema.json`이고, 실제 구조는 `evidence_kind`에 따라 하위 스키마로 갈라진다. `evidence_kind`는 slot이 아니라 evidence 형식이다.

| evidence_kind | 하위 스키마 | verdict | 대표 슬롯 |
|---|---|---|---|
| `implementation` | `evidence-implementation.schema.json` | 없음 | Implementer |
| `review` | `evidence-review.schema.json` | `approved`, `changes_requested`, `blocked` | Risk Assessor, Operator, Communicator, Design Authority |
| `verification` | `evidence-verification.schema.json` | `approved`, `changes_requested`, `blocked` | Verifier |
| `challenge` | `evidence-challenge.schema.json` | `approved`, `changes_requested`, `blocked` | Challenger |
| `decision` | `evidence-decision.schema.json` | `approved`, `changes_requested`, `escalated` | Decision Maker |

모든 evidence_kind는 선택 필드 `memory_suggestions[]`를 공통으로 둘 수 있다.
역할은 파일명이 아니라 내부 필드로 식별한다.

Decision Maker의 최종 판단은 `decision` evidence로 남기고, task 수준 종결 상태는 `record.json`의 `verdict` 섹션에 함께 기록한다.

### Session and orchestration artifact

Task와 세션 간 런타임 실행을 조율하는 artifact이다.

| artifact | 파일 | 설명 |
|---|---|---|
| `run.json` | `state/run.json` | phase, 활성 task, checkpoint를 포함한 mission 수준 런타임 상태 |
| `events.jsonl` | `state/events.jsonl` | 모든 pipeline 이벤트의 append-only 이벤트 로그 (단일 소스) |
| recovery packet | `recovery/` | 다음 세션을 위한 중단 상태 평가 |
| health check | (stdout) | 주기적 health signal 수집 |
| lock / lane state | `state/locks.json` | workspace lock 소유권과 병렬 lane 할당 |

### Evolution artifact

Evolving phase에서 생성되는 artifact로, 팀이 성과를 돌아보고 프로세스를 갱신하는 산출물이다.

| artifact | 파일 | 설명 |
|---|---|---|
| retrospective | `record.json` retrospective 섹션 | 무엇이 잘 되었고, 무엇이 실패했고, 무엇을 바꿀지에 대한 구조화된 회고 |
| rules update | `evolution/rules-update.json` | 프로젝트 규칙에 대한 제안 또는 적용된 변경 |
| debt register | `evolution/debt-register.json` | 추적 중인 기술적 또는 프로세스 부채 항목 |
| gap assessment | `evolution/gap-assessment.json` | 프로토콜 요구사항과 실제 관행 간 식별된 격차 |

### Memory artifact

두 파일로 구성된 memory 시스템: 프로젝트 지식을 위한 `rules.md`, 역할별 노트를 위한 에이전트 마크다운 파일.

| artifact | 파일 | 설명 |
|---|---|---|
| rules | `.geas/rules.md` | 프로젝트 관례 + 학습 규칙 + 역할별 규칙 (통합) |
| agent memory | `memory/agents/{agent}.md` | 에이전트별 마크다운 노트, 에이전트 맥락에 주입 |

## Canonical Metadata

모든 canonical artifact는 공유 메타데이터를 노출하여 validator, recovery 엔진, reviewer가 해당 artifact를 식별하고 신뢰할 수 있어야 한다. 정확한 필드명은 스키마가 관리하며, 의미론은 프로토콜이 관리한다.

| 필드 | 설명 |
|---|---|
| `artifact_type` | artifact의 종류 식별 |
| `version` | 호환성 검사를 위한 스키마 또는 artifact 버전 |
| 생성 타임스탬프 | artifact 생성 시점 |
| 생산 역할 또는 하위 시스템 | artifact 내용을 판단·생산한 에이전트 |
| 관련 id | `mission_id`, `task_id`, `memory_id` 등 연결 식별자 |
| 소스 또는 lineage 참조 | 부모 artifact나 트리거 이벤트에 대한 포인터 (해당 시) |

## File Naming and Path Discipline

일관된 명명 규칙과 경로 구조는 artifact의 검색 가능성을 높이고 잘못된 식별을 줄인다.

- mission root: `.geas/missions/{mission_id}/`
- task root: `.geas/missions/{mission_id}/tasks/{task_id}/`

| 규칙 | 설명 |
|---|---|
| 안정적이고 유형 지향적인 파일명 | canonical artifact 파일명은 예측 가능하고 artifact 유형을 반영해야 한다 |
| 명확한 소유 경로 | 경로 레이아웃만으로 artifact가 속한 mission이나 task를 파악할 수 있어야 한다 |
| 유연한 요약, 예측 가능한 JSON | 요약은 유연한 명명이 가능하나, canonical JSON artifact는 예측 가능해야 한다 |
| 파일명보다 메타데이터 | 파일명만으로 의미를 판단해서는 안 되며, 내부 메타데이터와 일치해야 한다 |

## Directory Structure

canonical `.geas/` 런타임 디렉터리 레이아웃:

```
.geas/
  state/
    run.json                          # mission 런타임 상태
    events.jsonl                      # append-only 이벤트 로그
  rules.md                            # 관례 + 규칙 + 역할별 규칙
  recovery/                           # 세션 recovery packet
  memory/
    agents/{agent}.md                 # 에이전트별 memory 노트
  missions/{mission_id}/
    spec.json                         # mission spec
    design-brief.json                 # design brief
    decisions/                        # vote round 결과
    phase-reviews/                    # phase 전이 review
    polishing/                        # polishing phase evidence
      evidence/{agent}.json
    evolution/                        # gap-assessment, debt-register, rules-update
      evidence/{agent}.json           # evolving phase evidence
    tasks/{task_id}/
      contract.json                   # task contract (정의)
      packets/{agent}.md              # context packet (에이전트 브리핑)
      self-check.json                 # worker self-check
      record.json                     # execution record (pipeline 출력)
      evidence/{agent}.json           # 에이전트 evidence 파일
```

## Schema Inventory

`docs/schemas/` 아래의 canonical JSON 스키마가 기계 검증을 위한 구조적 진실의 출처다. 이 문서는 스키마를 대체하지 않으며, 올바른 사용법을 설명한다.
위 registry는 사람이 자주 찾는 artifact와 공통 정의를 연결한 표다. `policy-override.schema.json`처럼 보조 스키마는 inventory에서 관리하고, 관련 본문 연결은 별도로 추가한다.

## Artifact Immutability and Replacement

Artifact가 완료된 단계를 나타내면 불변으로 취급해야 한다. 수정이 필요하면 원본을 변경하지 말고 새 버전이나 대체 레코드를 생성한다.

| 정책 | 설명 |
|---|---|
| 완료된 artifact는 불변 | artifact가 완료된 단계를 기록하면 원위치 수정 금지 |
| 수정 시 대체 레코드 생성 | 수정이 필요하면 원본을 참조하는 새 버전 생성 |
| 변경 시 재구성 메타데이터 보존 | 로컬 정책이 원위치 변경을 허용하면 이전 상태를 재구성할 수 있는 메타데이터를 보존 |

이력 재작성은 추적성을 약화시킨다.

## Recommended Hardening Patterns

아래는 모든 canonical 스키마에 존재하지 않더라도 권장되는 패턴이다. 숨겨진 임시 필드가 아닌 스키마 확장이나 동반 메타데이터로 구현해야 한다.

| 패턴 | 설명 |
|---|---|
| artifact lineage 또는 부모 참조 | 이 artifact를 트리거했거나 선행한 artifact에 대한 링크 |
| 명시적 생산자 역할 | artifact를 생성한 에이전트 유형이나 하위 시스템 기록 |
| 체크섬 또는 콘텐츠 해시 | 중요 artifact의 무결성 검증 수단 |
| 관련 evidence 링크 | 명령 출력, 테스트 결과, evidence 번들에 대한 포인터 |
| staleness 또는 freshness 마커 | 파생 packet의 소스 데이터가 마지막으로 확인된 시점 표시 |
| redaction 마커 | 민감 콘텐츠가 제거된 경우 redaction 발생 사실 표시 |

## Redaction and Sensitive Content

Artifact는 다음을 불필요하게 보존하지 않아야 한다:

- 원시 비밀
- 자격 증명
- 운영상 필요 이상의 고위험 익스플로잇 세부사항
- task 수행에 불필요한 개인 정보

Redaction이 발생한 경우, artifact에 redaction 사실을 표시하여 이후 독자가 누락을 부재로 오해하지 않도록 한다.

## Drift 유형

Drift는 artifact를 관리하는 계층 간 정렬이 어긋날 때 발생한다. 아래 테이블은 정규 drift 유형과 그 증상을 정리한다.

| drift 유형 | 설명 | 예시 |
|---|---|---|
| schema-artifact drift | 생성된 artifact가 해당 스키마와 일치하지 않음 | 스키마가 요구하는 필드가 실제 artifact에 없음 |
| validator-protocol drift | validator가 프로토콜이 더 이상 요구하지 않는 규칙을 강제하거나, 현재 요구하는 규칙을 놓침 | 프로토콜이 더 이상 요구하지 않는 artifact에 대해 validator가 차단 |
| doc-schema drift | 산문 문서가 canonical 스키마에 없는 필드나 enum을 언급 | 프로토콜 문서가 어떤 스키마에도 정의되지 않은 `task_kind` 값을 참조 |
| runtime-summary drift | 요약이 canonical artifact로 뒷받침되지 않는 상태나 verdict를 주장 | 세션 요약은 task 통과를 말하나 final verdict artifact가 없음 |

## Drift Handling

Drift가 감지되면:

1. drift가 발생한 surface를 canonical로 신뢰하지 않는다
2. 해당 질문에 대해 실제로 권위 있는 계층을 식별한다
3. 약하거나 오래된 계층을 수정한다
4. 기존 artifact가 영향을 받으면 migration을 문서화한다

각 관심사에 대한 기본 권위:

| 관심사 | 권위 계층 |
|---|---|
| 의미론 | 산문 문서 |
| 구조 | 스키마 |
| 실행된 evidence | 런타임 artifact |

## Artifact Validation Failure Modes

Artifact가 검증에 실패하면 실패 유형에 따라 대응이 달라진다. 아래 테이블은 각 실패 모드와 기대되는 대응을 요약한다.

| 실패 모드 | 대응 |
|---|---|
| **required field 누락** | artifact를 거부 또는 격리하고, 재생성 또는 수정을 요청하며, 수정 전까지 의존 전이를 차단 |
| **`artifact_type` 불일치** | 불일치를 기록하고, 모호성이 중요하면 다운스트림 소비를 차단하며, artifact를 수정 또는 대체 |
| **version 비호환** | 차이가 명시적으로 하위 호환되는 경우에만 허용하고, 그 외에는 거부하거나 migration 요구 |
| **파싱 가능하지만 의미론적으로 불가능** | 다운스트림 진행을 차단하고, JSON 파싱이 되더라도 의미론적 무효로 처리 (예: final verdict가 `approved`인데 task가 `verified`가 아님, gate result가 `pass`인데 필수 검사가 없음) |

## Compatibility Guidance

로컬 artifact 확장을 추가하는 프로젝트는 다음을 준수해야 한다:

- 로컬 스키마에 버전을 부여한다
- 확장 소유권을 문서화한다
- canonical 의미론과 충돌하지 않도록 한다
- 필수 invariant를 약화시키지 않는다
- 필요 시 migration 노트를 제공한다

## 핵심 선언

Artifact는 워크플로우의 강제 가능한 기억이다. Artifact가 약하거나 일관되지 않거나 모호하면, 나머지 프로토콜은 추측에 불과해진다.
