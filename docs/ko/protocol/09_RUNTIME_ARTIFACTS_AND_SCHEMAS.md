# 09. Runtime Artifacts and Schemas

> **기준 문서.**
> 이 문서는 canonical 런타임 artifact 패밀리, 계약 철학, 버전 관리 기대치, 검증 실패 처리를 요약한다.

## 목적

Artifact는 Geas가 일시적인 모델 행동을 감사 가능하고 evidence 기반인 프로세스로 변환하는 수단이다. 이 문서가 artifact 계층을 정의하는 이유는 다음과 같다:

- 상태 전이가 evidence 기반으로 유지되도록
- validator가 무엇을 강제해야 하는지 알도록
- reviewer가 무엇을 기대해야 하는지 알도록
- 문서, 스키마, hook 간 drift가 드러나도록

## Artifact Contract Philosophy

Geas는 artifact를 관리하기 위해 세 가지 상호 보완 계층을 사용한다. 각 계층은 고유한 책임을 지며, 한 계층이 다른 계층의 역할을 대신해서는 안 된다.

| 계층 | 책임 |
|---|---|
| 산문 문서 | 의미론과 invariant를 사람이 읽을 수 있는 형태로 정의 |
| 스키마 | 구조와 기계 검증 가능한 제약을 정의 |
| hook / validator | 존재 여부, 순서, 선택된 invariant를 런타임에 강제 |

## Core Runtime Artifacts

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

각 task는 `tasks/{tid}/` 아래에 세 가지 artifact 그룹을 생성한다:

| artifact | 파일 | 설명 |
|---|---|---|
| task contract | `contract.json` | task의 달성 목표, 분류, 수락 기준 정의 |
| context packet | `packets/{agent}.md` | 작업 시작 전 에이전트에게 전달되는 역할별 브리핑 |
| execution record | `record.json` | 모든 pipeline 단계 출력을 축적하는 단일 파일 (아래 참조) |
| evidence 파일 | `evidence/{agent}.json` | 역할별 에이전트 산출물 (implementer, reviewer, tester, authority) |

#### record.json 섹션

Execution record는 pipeline이 진행됨에 따라 섹션을 축적한다. 각 섹션은 CLI(`geas task record add --section {name}`)로 추가하며, 중복 추가 시 덮어쓴다.

| 섹션 | 추가 시점 | 주요 필드 |
|---|---|---|
| `implementation_contract` | implementation contract 승인 | planned_actions, edge_cases, status |
| `self_check` | worker 자체 평가 | confidence (1-5), known_risks, summary |
| `gate_result` | evidence gate | verdict (pass/fail/block/error), tier_results, rubric_scores, blocking_dimensions |
| `challenge_review` | challenger review (high/critical) | concerns, blocking |
| `verdict` | final verdict | verdict (pass/iterate/escalate), rationale |
| `closure` | closure 조립 | change_summary, reviews, open_risks |
| `retrospective` | task 회고 | what_went_well, what_broke, memory_candidates |

#### Evidence 역할

Evidence 파일은 역할별 필수 필드를 사용한다:

| 역할 | 필수 필드 | 일반적 에이전트 |
|---|---|---|
| implementer | summary, artifacts | software-engineer, platform-engineer |
| reviewer | summary, verdict, concerns | design-authority, security-engineer, challenger |
| tester | summary, verdict, criteria_results | qa-engineer |
| authority | summary, verdict, rationale | product-authority |

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
  missions/{mid}/
    spec.json                         # mission spec
    design-brief.json                 # design brief
    decisions/                        # vote round 결과
    phase-reviews/                    # phase 전이 review
    polishing/                        # polishing phase evidence
      evidence/{agent}.json
    evolution/                        # gap-assessment, debt-register, rules-update
      evidence/{agent}.json           # evolving phase evidence
    tasks/{tid}/
      contract.json                   # task contract (정의)
      packets/{agent}.md              # context packet (에이전트 브리핑)
      record.json                     # execution record (pipeline 출력)
      evidence/{agent}.json           # 에이전트 evidence 파일
```

## Schema Inventory

`docs/protocol/schemas/` 아래의 canonical JSON 스키마가 기계 검증을 위한 구조적 진실의 출처다. 이 문서는 스키마를 대체하지 않으며, 올바른 사용법을 설명한다.

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
| hook-protocol drift | hook이 프로토콜이 더 이상 요구하지 않는 규칙을 강제하거나, 현재 요구하는 규칙을 놓침 | 프로토콜이 더 이상 요구하지 않는 artifact에 대해 hook이 차단 |
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
| **파싱 가능하지만 의미론적으로 불가능** | 다운스트림 진행을 차단하고, JSON 파싱이 되더라도 의미론적 무효로 처리 (예: final verdict가 `pass`인데 task가 `verified`가 아님, gate result가 `pass`인데 필수 검사가 없음) |

## Compatibility Guidance

로컬 artifact 확장을 추가하는 프로젝트는 다음을 준수해야 한다:

- 로컬 스키마에 버전을 부여한다
- 확장 소유권을 문서화한다
- canonical 의미론과 충돌하지 않도록 한다
- 필수 invariant를 약화시키지 않는다
- 필요 시 migration 노트를 제공한다

## 핵심 선언

Artifact는 워크플로우의 강제 가능한 기억이다. Artifact가 약하거나 일관되지 않거나 모호하면, 나머지 프로토콜은 추측에 불과해진다.
