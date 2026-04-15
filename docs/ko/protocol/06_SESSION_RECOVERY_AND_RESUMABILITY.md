# 08. Session Recovery and Resumability

> **기준 문서.**
> 이 문서는 Geas가 중단된 작업을 재개할 때 사용하는 checkpoint, safe boundary, recovery class, recovery packet, 보수적 규칙을 정의한다. 확실하지 않은 상태를 확실한 것처럼 취급하지 않는 것이 핵심 원칙이다.

## 목적

구조화된 작업 세션은 오래 걸리고, 도구에 의존하며, 실패에 취약하다. Recovery는 다음 원인으로 중단이 발생했을 때 무결성을 보존하기 위해 존재한다:

- 세션 compaction
- sub-agent 유실
- 도구 타임아웃
- 크래시 또는 연결 끊김
- 손상된 workspace
- 모호한 부분 진행

Recovery의 목적은 어떤 대가를 치르든 연속성을 극대화하는 것이 **아니다**. 가능한 한 많은 유효한 작업을 복구하되, 정확성을 보존하는 것이 목적이다.

## Recovery Classes

각 recovery class는 세션 중단 유형과 그에 따른 복구 방침을 정의한다. 프로젝트가 추가 하위 유형을 정의할 수 있으나, 아래 정규 class는 항상 인식 가능해야 한다.

| class | 설명 |
|---|---|
| `post_compact_resume` | 호스트 플랫폼이 세션을 compaction함. 컨텍스트가 일부 또는 전부 유실되었으나 디스크의 artifact는 온전할 수 있음 |
| `warm_session_resume` | 세션이 정상 또는 거의 정상으로 종료됨. 대부분의 컨텍스트가 유지되고 artifact가 일관된 상태 |
| `interrupted_subagent_resume` | 위임된 sub-agent가 실행 중 유실됨. 부모 세션은 온전하나 sub-agent의 작업 결과는 불확실 |
| `dirty_state_recovery` | 커밋되지 않았거나 모호한 로컬 변경이 존재함. workspace 상태가 어떤 checkpoint와도 일치하지 않음 |
| `manual_repair_required` | 자동 복구로는 안전하게 진행할 수 없음. 작업 재개 전 사용자 개입 필요 |

## Recovery Anchor

Recovery anchor는 엔진이 상황을 판단하고 복구 경로를 결정하는 데 필요한 최소 정보 집합이다. Recovery 시도 시 최소한 다음을 수집해야 한다:

- `run.json` (`checkpoint` 필드로 마지막 진행 상황 확인)
- 활성 task의 `record.json` (섹션 존재 여부로 task별 진행도 판단)
- `state/`의 `events.jsonl` (최근 이벤트 이력)
- 최신 `recovery-packet.json` (존재하는 경우)
- 활성 task artifact
- workspace 상태

Anchor가 불완전하면 엔진은 더 보수적으로 동작해야 한다. 결코 덜 보수적이어서는 안 된다.

## Checkpoint Protocol

Checkpoint는 진행 상황을 기록하여, recovery 시 작업이 어디서 중단되었는지 식별할 수 있게 한다. 프로토콜은 두 가지 checkpoint 시점과 권장 two-phase 패턴을 정의한다.

### `write-before-launch`

위험한 단계나 위임 sub-agent 실행이 시작되기 전, 런타임은 의도된 다음 단계의 메타데이터를 기록해야 한다.

### `write-after-step`

단계가 실제로 완료되고 artifact가 존재하는 것을 확인한 후, 런타임은 checkpoint를 갱신해야 한다.

### Two-phase checkpoint

권장 흐름:

1. intent write
2. 단계 수행 및 artifact 생성
3. checkpoint를 완료로 commit

Phase 2가 실패하면, artifact의 존재와 유효성이 달리 증명하지 않는 한 해당 transition을 미완료로 처리해야 한다.

## Step-Level Progress

런타임은 `remaining_steps[]` 또는 동등한 개념을 유지해야 한다. 이 목록은 sub-pipeline에서 아직 완료가 확인되지 않은 단계를 추적한다.

| 규칙 | 설명 |
|---|---|
| 실행 전 추가 | 단계 시작 전에 목록에 추가 |
| 확인 후 제거 | 성공이 확인된 후에만 목록에서 제거 |
| 다음 미완료 단계부터 재개 | recovery는 다음 미완료 단계부터 시작 |
| 빈 목록은 완료를 의미 | 목록이 비어 있으면 해당 sub-pipeline은 완료된 것 |

## Safe Boundary와 Unsafe Boundary

Exact resume는 safe boundary에서만 허용된다. Safe boundary란 이전 작업이 모두 저장되어 있고, 완료 여부에 모호함이 없는 지점이다.

### Safe boundary

| boundary | 설명 |
|---|---|
| task 승인됨, implementation 미시작 | task contract는 존재하나 workspace 변경 없음 |
| implementation 완료, self-check 저장됨 | implementation이 끝나고 worker의 self-check artifact가 저장됨 |
| review 세트 완료 및 저장됨 | 모든 필수 specialist review가 저장됨 |
| integration result 저장됨 | integration result artifact가 작성되고 유효함 |
| gate result 저장됨 | evidence gate result artifact가 작성되고 유효함 |
| closure packet 저장됨, final verdict 미발행 | closure packet은 조립되었으나 Decision Maker가 아직 verdict를 내리지 않음 |

### Unsafe boundary

| boundary | 설명 |
|---|---|
| 부분 편집된 workspace, 신뢰할 checkpoint 없음 | workspace에 변경이 있으나 의도나 완료 내용을 확인할 checkpoint가 없음 |
| gate 실행 중, 확인된 결과 없음 | evidence gate가 실행 중이나 저장된 결과 없음 |
| integration 진행 중, 상태 모호 | integration을 시도했으나 성공 여부가 불분명 |
| final verdict 주장되었으나 packet 누락 | verdict가 기록되었으나 이를 뒷받침하는 closure packet이 없음 |

Unsafe boundary는 replay 또는 상태 복원이 필요하다. 완료로 표시해서는 안 된다.

## Recovery Decision Table

이 테이블은 관찰된 상태를 권장 recovery 결과에 매핑한다. 상황이 어떤 행과도 정확히 일치하지 않으면 가장 보수적인 호환 가능한 결과를 선택한다.

| 관찰된 상태 | artifact completeness | 기본 결과 |
|---|---|---|
| implementation 진행 중, workspace 깨끗, contract 존재 | high | `resume_with_revalidation` |
| implementation 진행 중, workspace dirty, 부분 artifact | medium | `replay_current_step` 또는 `restore_to_safe_boundary` |
| integration 주장, result artifact 누락 | low | `restore_to_safe_boundary` |
| verified 주장, gate result 누락 | low | `restore_to_safe_boundary` |
| passed 주장, final verdict 누락 | invalid | hard block |
| 여러 in-flight task, 상충하는 신호 | varies | task별로 평가하여 가장 보수적인 호환 결과 선택 |
| 런타임 anchor 누락 또는 손상 | none | `manual_repair_required` |

## Artifact Completeness Classification

Artifact completeness는 recovery 엔진이 주장된 상태를 얼마나 신뢰할 수 있는지를 결정한다. 아래 등급은 recovery 결정에 사용하는 공통 어휘를 제공한다.

| 등급 | 의미 |
|---|---|
| `high` | 주장된 상태에 필요한 모든 artifact가 존재하고 검증 통과 |
| `medium` | 상당수의 필수 artifact가 존재하나 연속성이 불완전 |
| `low` | 필수 artifact가 거의 없거나 일부가 검증 실패 |
| `none` | 신뢰할 수 있는 task evidence가 없음 |
| `invalid` | artifact가 존재하나 손상, 모순, 또는 파싱 불가 |

## Recovery Matching Rules

가능한 해석이 여러 개일 때, recovery 엔진은 가정이 가장 적은 해석을 선택해야 한다.

예:

- integration 성공 여부가 불분명하면 integration이 완료되지 **않았다**고 가정
- gate 출력이 누락되면 검증이 완료되지 **않았다**고 가정
- workspace에 편집이 있으나 self-check가 없으면 implementation이 미완료라고 가정

## Recovery Packet

`recovery-packet`은 중단된 상태에 대한 엔진의 판단을 기록하여, 다음 세션이 이를 토대로 결정을 내릴 수 있게 한다.

recovery packet은 엔진이 관찰한 내용과 취해야 할 조치를 기록한다. 정규 형식은 `recovery-packet.schema.json`에 있다. 필수 필드는 다음과 같다:

- `recovery_id` — 이 복구 시도의 식별자
- `recovery_class` — 정규 class (`post_compact_resume`, `warm_session_resume`, `interrupted_subagent_resume`, `dirty_state_recovery`, `manual_repair_required`)
- `focus_task_id` — 복구 대상으로 집중 중인 task
- `detected_problem` — 복구를 촉발한 엔진의 발견 내용
- `recommended_action` — 취해야 할 복구 경로
- `artifacts_found` — 존재하고 유효성 검증을 통과한 artifact
- `artifacts_missing` — 예상했으나 부재하는 artifact

수동 개입이 필요한 경우, `recovery_class`를 반드시 `manual_repair_required`로 설정해야 한다. 별도의 boolean 플래그는 필요 없다 — class 자체가 그 신호를 전달한다.

## Workspace Recovery Rules

Workspace recovery는 workspace 청결도와 checkpoint 품질의 조합에 따라 달라진다. 이 규칙은 recovery class와 무관하게 적용된다.

### 깨끗한 workspace, 양호한 checkpoint

Freshness 확인 후 resume가 가능할 수 있다.

### Dirty workspace, 일관된 변경

시스템이 변경사항을 보존할 수 있으나, 이미 진행이 이루어졌다고 주장해서는 안 된다. 해당 변경을 기반으로 다음 공식 artifact를 replay하거나 재도출해야 한다.

### Dirty workspace, 비일관적이거나 상충하는 변경

마지막 safe boundary로 복원하거나 수동 복구를 진행한다.

### 누락된 workspace

Artifact가 뒷받침하는 경우, baseline에서 재생성하고 마지막 safe boundary부터 replay한다.

## Recovery Safety Rules

이 규칙은 타협의 여지가 없다. Class나 컨텍스트와 관계없이 모든 recovery 시도에 적용된다.

1. Recovery는 낙관적 속행보다 보수적 상태 복원을 우선해야 한다.
2. Recovery는 이미 검증된 evidence를 가능한 한 보존해야 한다.
3. Recovery는 부분 artifact를 canonical로 간주하지 말고 격리해야 한다.
4. Recovery는 알려진 blocker, 위험, debt를 삭제해서는 안 된다.
5. Recovery는 불확실성을 명시적으로 표시해야 한다.

## Partial Artifact Quarantine

Hook이나 에이전트가 부분 artifact를 남긴 경우:

- 격리 표시자 또는 보조 노트와 함께 보존한다
- 유효한 canonical evidence로 취급하지 않는다
- 보조 recovery 정보로만 참고한다

## Nested Recovery

Recovery 시도 자체가 실패할 수 있다. 이 경우:

- recovery 실패를 기록한다
- 무한 재귀 recovery를 방지한다
- 수동 복구나 더 넓은 범위의 상태 복원으로 격하한다
- 읽을 수 있는 모든 evidence를 보존한다

## Dirty State Recovery

Dirty state란 커밋되지 않았거나 모호한 로컬 변경이 존재하는 상태다. Workspace가 어떤 checkpoint와도 일치하지 않으므로, 가장 흔하면서도 가장 위험한 recovery 상황이다.

규칙:

- dirty state에서 exact resume는 checkpoint와 artifact가 다음 단계를 명확히 가리키는 경우에만 허용
- 그 외에는 replay 또는 safe boundary로 복원
- high-risk dirty state는 수동 검사가 가능하지 않은 한 상태 복원을 우선한다

## Manual Repair Required

수동 복구가 적절한 경우:

- 런타임 anchor 누락
- artifact 손상이 심각
- 안전하게 해결할 수 없는 여러 모순된 상태 주장 존재
- 로컬 정책이 계속하기 전 사용자 review를 요구

수동 복구 시에는 다음 세션이 결정 내용을 알 수 있도록 간단한 복구 노트를 남겨야 한다.

## Recovery to Evolution Feedback

Recovery incident는 귀중한 학습 자료다. 중요한 recovery 이벤트는 다음에 반영되어야 한다:

- retrospective 노트
- memory candidate
- rule candidate
- scheduler 또는 checkpoint 강화

같은 실패를 반복 복구하면서 프로세스를 바꾸지 않는 팀은 학습하고 있지 않은 것이다.

## 대표 시나리오

### Scenario 1 -- gate 실행 중 중단

명령 출력이 불완전하고 검증된 gate artifact가 없으면:

- `verified`를 주장하지 않는다
- 명령을 안전하게 재실행할 수 있는지 확인한다
- 대부분의 경우 gate를 replay한다

### Scenario 2 -- 로컬에서 integration 완료, verdict 미생성

Integration 결과가 존재하고 유효하면:

- post-integration, pre-verdict safe boundary에서 복구한다
- 기본적으로 implementation을 재실행하지 않는다
- baseline이 다시 변경되었으면 packet freshness를 갱신한다

### Scenario 3 -- checkpoint가 누락된 dirty workspace

Exact resume는 금지된다. Artifact에서 보수적 경로를 재구성하거나 safe boundary로 복원한다.

## 핵심 선언

Geas의 recovery는 의도적으로 회의적이다. 나중에 디버깅 불가능한 false green이 될 모호함을 승인하느니, 단계를 replay하는 쪽을 택한다.
