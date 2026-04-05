# 10. Session Recovery and Resumability

> **기준 문서.**
> 이 문서는 Geas가 중단된 작업을 확실성을 가장하지 않으면서 재개하기 위해 사용하는 checkpoint, safe boundary, recovery class, recovery packet, 그리고 보수적 규칙을 정의한다.

## 목적

구조화된 작업 세션은 길고, 도구에 의존적이며, 실패에 취약하다. Recovery는 다음과 같은 원인으로 중단이 발생했을 때 무결성을 보존하기 위해 존재한다:

- 세션 compaction
- sub-agent 유실
- 도구 타임아웃
- 크래시 또는 연결 끊김
- 손상된 workspace
- 모호한 부분 진행

Recovery의 목적은 어떤 대가를 치르더라도 연속성을 극대화하는 것이 **아니다**. 그 목적은 가능한 한 많은 유효한 작업을 복구하면서 정확성을 보존하는 것이다.

## Recovery Classes

각 recovery class는 세션 중단의 범주와 기대되는 복구 자세를 설명한다. 프로젝트는 추가 하위 유형을 정의할 수 있지만, 아래의 정규 class는 인식 가능하게 유지해야 한다.

| class | 설명 |
|---|---|
| `post_compact_resume` | 호스트 플랫폼에 의해 세션이 compaction됨. 컨텍스트는 일부 또는 전부 유실되었으나 디스크의 artifact는 온전할 수 있음 |
| `warm_session_resume` | 세션이 정상적으로 또는 거의 정상적으로 종료됨. 대부분의 컨텍스트가 유지되고 artifact가 일관된 상태 |
| `interrupted_subagent_resume` | 위임된 sub-agent가 실행 중 유실됨. 부모 세션은 온전하나 sub-agent의 작업은 불확실 |
| `dirty_state_recovery` | 커밋되지 않았거나 모호한 로컬 변경이 존재함. workspace 상태가 알려진 어떤 checkpoint와도 일치하지 않음 |
| `manual_repair_required` | 자동 복구가 안전하게 진행될 수 없음. 작업 재개 전 사용자 개입이 필요 |

## Recovery Anchor

Recovery anchor는 엔진이 상황을 판단하고 복구 경로를 결정하는 데 필요한 최소 정보 집합이다. Recovery 시도 시 최소한 다음을 수집해야 한다:

- `run.json`
- 최신 세션 요약
- 활성 task에 대한 최신 task-focus 요약
- 사용 가능한 경우 최신 `recovery-packet.json`
- 활성 task artifact
- workspace 상태

Anchor가 불완전하면, 엔진은 덜 보수적이 아니라 더 보수적으로 동작해야 한다.

## Checkpoint Protocol

Checkpoint는 진행 상황을 기록하여 recovery가 작업이 중단된 지점을 식별할 수 있게 한다. 프로토콜은 두 가지 checkpoint 시점과 권장 two-phase 패턴을 정의한다.

### `write-before-launch`

위험한 단계나 위임된 sub-agent 실행이 시작되기 전에, 런타임은 의도된 다음 단계 메타데이터를 기록해야 한다.

### `write-after-step`

단계가 실제로 완료되고 artifact가 존재한 후, 런타임은 checkpoint를 갱신해야 한다.

### Two-phase checkpoint

권장 흐름:

1. intent write
2. 단계 수행 및 artifact 생성
3. checkpoint를 완료로 commit

Phase 2가 실패하면, 런타임은 artifact의 존재와 유효성이 달리 증명하지 않는 한 해당 transition을 미완료로 처리해야 한다.

## Step-Level Progress

런타임은 `remaining_steps[]` 개념 또는 동등한 것을 유지해야 한다. 이 목록은 sub-pipeline에서 아직 완료가 확인되지 않은 단계를 추적한다.

| 규칙 | 설명 |
|---|---|
| 실행 전 추가 | 단계가 시작되기 전에 목록에 추가 |
| 확인 후 제거 | 성공이 확인된 후에만 단계를 제거 |
| 다음 미완료 단계부터 재개 | recovery는 다음 확인된 미완료 단계부터 시작 |
| 빈 목록은 완료를 의미 | 목록이 비어 있으면 로컬 sub-pipeline이 완료된 것 |

## Safe Boundary와 Unsafe Boundary

Exact resume는 safe boundary에서만 허용된다. Safe boundary란 이전의 모든 작업이 완전히 저장되어 있고 완료된 내용에 대한 모호함이 없는 지점이다.

### Safe boundary

| boundary | 설명 |
|---|---|
| task 승인됨, implementation 미시작 | task contract는 존재하나 workspace 변경이 없는 상태 |
| implementation 완료, self-check 저장됨 | implementation이 끝나고 worker의 self-check artifact가 저장됨 |
| review 세트 완료 및 저장됨 | 모든 필수 specialist review가 저장됨 |
| integration result 저장됨 | integration result artifact가 작성되고 유효한 상태 |
| gate result 저장됨 | evidence gate result artifact가 작성되고 유효한 상태 |
| closure packet 저장됨, final verdict 미발행 | closure packet은 조립되었으나 Decision Maker가 아직 verdict를 내리지 않은 상태 |

### Unsafe boundary

| boundary | 설명 |
|---|---|
| 부분 편집된 workspace, 신뢰할 수 있는 checkpoint 없음 | workspace에 변경이 있으나 의도되거나 완료된 내용을 확인하는 checkpoint가 없음 |
| gate 실행 중, 확인된 결과 없음 | evidence gate가 실행 중이나 저장된 결과가 없음 |
| integration 진행 중, 모호한 상태 | integration이 시도되었으나 성공 여부가 불분명 |
| final verdict 주장되었으나 packet 누락 | verdict가 기록되었으나 이를 뒷받침하는 closure packet이 존재하지 않음 |

Unsafe boundary는 replay 또는 상태 복원이 필요하다. 완료로 표현해서는 안 된다.

## Recovery Decision Table

이 테이블은 관찰된 상태를 권장 recovery 결과에 매핑한다. 상황이 어떤 행과도 정확히 일치하지 않으면 가장 보수적인 호환 가능한 결과를 선택한다.

| 관찰된 상태 | artifact completeness | 기본 결과 |
|---|---|---|
| implementation 진행 중, workspace 깨끗, contract 존재 | high | `resume_with_revalidation` |
| implementation 진행 중, workspace dirty, 부분 artifact | medium | `replay_current_step` 또는 `restore_to_safe_boundary` |
| integration 주장, result artifact 누락 | low | `restore_to_safe_boundary` |
| verified 주장, gate result 누락 | low | `restore_to_safe_boundary` |
| passed 주장, final verdict 누락 | invalid | hard block |
| 여러 in-flight task, 상충하는 신호 | varies | task별로 평가하여 가장 보수적인 호환 가능한 결과 선택 |
| 런타임 anchor 누락 또는 손상 | none | `manual_repair_required` |

## Artifact Completeness Classification

Artifact completeness는 recovery 엔진이 주장된 상태를 얼마나 신뢰할 수 있는지를 결정한다. 다음 등급은 recovery 결정을 위한 공유 어휘를 제공한다.

| 등급 | 의미 |
|---|---|
| `high` | 주장된 상태에 필요한 모든 artifact가 존재하고 검증을 통과 |
| `medium` | 많은 필수 artifact가 존재하지만 연속성이 불완전 |
| `low` | 필수 artifact가 거의 없거나 일부가 검증 실패 |
| `none` | 신뢰할 수 있는 task evidence가 없음 |
| `invalid` | artifact가 존재하지만 손상, 모순, 또는 파싱 불가 |

## Recovery Matching Rules

가능한 해석이 여러 개 존재할 때, recovery 엔진은 가정이 가장 적은 해석을 선택해야 한다.

예:

- integration 성공이 불분명하면, integration이 완료되지 **않았다**고 가정
- gate 출력이 누락되면, 검증이 완료되지 **않았다**고 가정
- workspace에 편집이 있지만 self-check가 없으면, implementation이 미완료라고 가정

## Recovery Packet

`recovery-packet`은 중단된 상태에 대한 엔진의 판단을 캡처하여 다음 세션이 충분한 정보를 바탕으로 결정할 수 있게 한다. Recovery packet 또는 동등한 것은 다음을 포함해야 한다:

| 필드 | 설명 |
|---|---|
| recovery class | 적용되는 정규 recovery class |
| 관찰된 상태 요약 | 엔진이 상황을 평가했을 때 발견한 내용 |
| 활성 task와 마지막 safe boundary | task별 안전한 재개가 가능한 지점 기록 |
| 부실 또는 손상된 artifact 노트 | 어떤 artifact가 의심스러운지와 그 이유 |
| 권장 다음 행동 | 엔진이 제안하는 복구 경로 |
| 누락되거나 의심스러운 evidence | 예상되는 artifact 중 부재하거나 신뢰할 수 없는 것 |
| 수동 개입 필요 여부 | 작업 재개 전 사용자 개입이 필요한지 여부 |

## Workspace Recovery Rules

Workspace recovery는 workspace 청결도와 checkpoint 품질의 조합에 따라 달라진다. 이 규칙은 recovery class에 관계없이 적용된다.

### 깨끗한 workspace, 양호한 checkpoint

Freshness 확인 후 resume가 가능할 수 있다.

### Dirty workspace, 일관된 변경

시스템은 변경사항을 보존할 수 있지만, 진행이 이미 이루어졌다고 주장하는 대신 해당 변경에서 다음 공식 artifact를 replay하거나 재도출해야 한다.

### Dirty workspace, 비일관적이거나 상충하는 변경

마지막 safe boundary로 상태를 복원하거나 수동 복구를 진행한다.

### 누락된 workspace

Artifact가 뒷받침하는 경우 baseline에서 재생성하고 마지막 safe boundary에서 replay한다.

## Recovery Safety Rules

이 규칙은 타협할 수 없다. Class나 컨텍스트에 관계없이 모든 recovery 시도에 적용된다.

1. Recovery는 낙관적 계속보다 보수적 상태 복원을 선호해야 한다.
2. Recovery는 이미 검증된 evidence를 가능한 한 보존해야 한다.
3. Recovery는 부분 artifact를 canonical로 간주하지 않고 격리해야 한다.
4. Recovery는 알려진 blocker, 위험, 또는 debt를 제거해서는 안 된다.
5. Recovery는 불확실성을 명시적으로 표시해야 한다.

## Partial Artifact Quarantine

Hook이나 에이전트가 부분 artifact를 남기면:

- 격리 표시자 또는 보조 노트와 함께 보존
- 유효한 canonical evidence로 취급하지 않음
- 보조 recovery 정보로만 검사

## Nested Recovery

Recovery 시도 자체가 실패할 수 있다. 이 경우:

- recovery 실패를 기록
- 무한 재귀 recovery 방지
- 수동 복구 또는 더 넓은 상태 복원과 같은 더 단순한 결과로 격하
- 여전히 읽을 수 있는 모든 evidence 보존

## Dirty State Recovery

Dirty state는 커밋되지 않았거나 모호한 로컬 변경이 존재함을 의미한다. Workspace가 알려진 어떤 checkpoint와도 일치하지 않기 때문에, 가장 흔하면서도 가장 위험한 recovery 상황 중 하나이다.

규칙:

- dirty state에서의 exact resume는 checkpoint와 artifact가 다음 단계를 명확하게 만드는 경우에만 허용
- 그 외에는 replay 또는 safe boundary로 상태 복원
- high-risk dirty state는 수동 검사가 가능하지 않는 한 상태 복원 쪽으로 기울어야 한다

## Manual Repair Required

수동 복구는 다음과 같은 경우 적절하다:

- 런타임 anchor가 누락
- artifact 손상이 심각
- 안전하게 해결할 수 없는 여러 모순된 상태 주장
- 로컬 정책이 계속하기 전 사용자의 review를 요구

수동 복구는 다음 세션이 무엇이 결정되었는지 알 수 있도록 작은 복구 노트를 생성해야 한다.

## Recovery to Evolution Feedback

Recovery incident는 가치 있는 학습 입력이다. 중요한 recovery 이벤트는 다음에 반영되어야 한다:

- retrospective 노트
- memory candidate
- 규칙 candidate
- scheduler 또는 checkpoint 강화

같은 실패에서 반복적으로 복구하면서 프로세스를 변경하지 않는 팀은 학습하지 않는 것이다.

## 대표 시나리오

### Scenario 1 — gate 실행 중 중단

명령 출력이 불완전하고 검증된 gate artifact가 없으면:

- `verified`를 주장하지 않음
- 명령을 안전하게 재실행할 수 있는지 검사
- 일반적으로 gate를 replay

### Scenario 2 — 로컬에서 integration 완료, verdict 미생성

Integration 결과가 존재하고 유효하면:

- post-integration, pre-verdict safe boundary에서 복구
- 기본적으로 implementation을 재실행하지 않음
- baseline이 다시 변경되었으면 packet freshness를 갱신

### Scenario 3 — checkpoint가 누락된 dirty workspace

Exact resume는 금지된다. Artifact에서 보수적 경로를 재구성하거나 safe boundary로 상태를 복원한다.

## 핵심 문장

Geas에서의 recovery는 의도적으로 회의적이다. 이 프로토콜은 나중에 디버깅 불가능한 false green이 되는 모호함을 승인하는 것보다 단계를 replay하는 것을 선호한다.
