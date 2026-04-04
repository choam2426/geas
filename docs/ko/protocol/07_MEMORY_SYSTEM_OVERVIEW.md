# 07. Memory System Overview

## 목적

Geas의 memory는 단순한 노트 저장소가 아니다. **반복되는 실수, 좋은 구현 패턴, 환경 주의점, product decision precedent를 구조화해 future task의 품질과 속도를 동시에 높이는 적응형 운영 시스템**이다.

핵심 목표:
1. 동일 실패 재발 방지
2. 좋은 패턴의 재사용
3. recovery/compaction 이후 빠른 재개
4. specialist review 품질 향상
5. context window 낭비 감소
6. retrospective가 실제 행동을 바꾸도록 만들기

## 핵심 원칙

### 1) memory는 진화한다
memory item은 처음부터 durable truth가 아니다. observation → candidate → provisional → stable → superseded / archived 를 거친다.

### 2) memory는 근거를 잃으면 약해진다
artifact ref, evidence count, successful reuse, failed reuse, contradiction history가 없는 memory는 강한 규칙으로 승격되지 않는다.

**Confidence Scoring Model:**
- 초기 confidence는 evidence count로 결정한다:
  - evidence_refs 1개 → `confidence = 0.4`
  - evidence_refs 2개 → `confidence = 0.6`
  - evidence_refs 3개 이상 → `confidence = 0.8`
- 이후 적용 결과에 따라 조정한다 (modifiers):
  - successful reuse 1회당 → `+0.1`
  - failed reuse 1회당 → `-0.1`
  - contradiction 발생 1회당 → `-0.2`
- confidence 상한은 `1.0`, 하한은 `0.0`
- `confidence < 0.3`이면 decay review가 자동 trigger된다 (orchestration_authority + domain authority가 유지/archive/supersede 판단)
- decay review가 trigger됐으나 orchestration_authority 또는 domain authority가 해당 세션에 없는 경우: memory의 state를 `"under_review"`로 변경하고, retrieval에서 일시 제외한다. 다음 세션에서 해당 authority가 복귀하면 review를 수행한다

### 3) memory는 scope를 가진다
모든 memory는 적용 범위를 가진다. 아래 scope는 `_defs.schema.json`의 `memoryScope` enum과 동기화된다.
- `task` — 단일 task에만 적용
- `mission` — 현재 mission 전체에 적용
- `project` — 프로젝트 전체에 적용
- `agent` — 특정 agent type에 적용
- `global` — 모든 프로젝트에 적용

### 4) memory는 retrieval budget 안에서만 들어간다
무한정 주입하지 않는다. applicable하고 검증된 memory만 context로 들어간다. 구체적 budget은 doc 09의 Role-Specific Budgets를 참조한다.

### 5) memory는 적용 결과로 다시 평가된다
memory를 실제 task에 적용한 뒤 결과를 `memory-application-log.json`에 기록하고, 그 결과가 future confidence를 바꾼다. 구체적 confidence 변동 규칙은 위 Confidence Scoring Model을 참조한다.

### 6) memory는 행동 표면으로 연결돼야 한다
memory가 저장만 되고 future behavior를 바꾸지 않으면 evolution이 아니다. Geas는 아래 표면을 통해 memory를 행동으로 연결한다.
- `.geas/rules.md`
- project_memory
- agent_memory
- risk_memory
- packet builder
- task admission / gate / readiness review focus

## Memory Layer Model

Memory layer는 memory entry의 저장/검색 범위를 나타내는 논리적 분류다. `_defs.schema.json`의 `memoryScope` enum(`task`, `mission`, `project`, `agent`, `global`)과는 별도의 개념으로, layer는 memory의 용도와 수명을 정의하고 scope는 적용 범위를 정의한다.

### `session_memory`
현재 세션의 요약과 최근 흐름. compaction/recovery의 핵심 anchor. `session-latest.md`로 persist된다.

### `task_focus_memory`
현재 task를 위해 압축한 locally relevant memory. `task-focus/<task-id>.md`로 persist된다.

### `mission_memory`
이번 mission 전용 전략, constraints, temporary decisions. `mission-summary.md`로 persist된다.

### `episodic_memory`
개별 task/incident/recovery에서 얻은 사건 중심 기억. `memory-entry.json`(`memory_type = "failure_lesson"` 또는 `"decision_precedent"`)으로 persist된다.

### `project_memory`
반복적으로 검증된 프로젝트 규칙, 환경 팁, architecture precedent. `memory-entry.json`(`memory_type = "project_rule"`, `"architecture_precedent"`, `"integration_pattern"` 등)으로 persist된다.

### `agent_memory`
특정 agent type이 반복적으로 참고하는 역할별 기억. `memory-entry.json`(`memory_type = "agent_rule"`, `"test_strategy"`, `"security_pattern"` 등)으로 persist된다.

### `risk_memory`
과거 실패 패턴, rollback cause, false green incident, drift hotspot. `memory-entry.json`(`memory_type = "risk_pattern"`, `"failure_lesson"`)으로 persist된다.

## Canonical Memory Artifact Types

- `memory-candidate.json`
- `memory-entry.json`
- `memory-review.json`
- `memory-application-log.json`
- `memory-packet.json`
- `memory-index.json`
- `retrospective.json`
- `rules-update.json`

### Empty Memory Index

`memory-index.json`이 비어 있거나 존재하지 않는 경우 (첫 세션, 초기 프로젝트):
1. retrieval engine은 L2 (applicable memory) 단계를 skip하고 L0/L1만으로 packet을 구성한다.
2. packet의 `applicable_memory_ids[]`는 빈 배열이 된다.
3. 이 상태는 정상이며, 첫 번째 `passed` task의 retrospective에서 memory candidate가 생성되면서 index가 초기화된다.

## Ownership Rules

- `orchestration_authority`: candidate 추출, retrieval orchestration
- `orchestration_authority`: retrospective 정리, rules update hygiene, promotion cadence
- `product_authority`: product/priority/UX precedent 승인
- `architecture_authority`: architecture/system precedent 승인
- `qa_engineer`: QA recipe / failure-path memory 승인
- `security_engineer`: security warning / abuse pattern 승인

## Memory Types (권장)

아래 타입은 `_defs.schema.json`의 `memoryType` enum과 동기화된다.

- `project_rule` — 프로젝트 전체에 적용되는 규칙/convention
- `agent_rule` — 특정 agent type에만 해당하는 heuristic
- `decision_precedent` — 과거 의사결정의 근거와 결과
- `failure_lesson` — 실패에서 추출한 교훈 (구 `incident`)
- `security_pattern` — 보안 관련 경고/패턴 (구 `security_warning`)
- `performance_tip` — 성능 관련 최적화 지침
- `test_strategy` — QA/테스트 전략 (구 `qa_recipe`)
- `integration_pattern` — 통합/빌드/배포 관련 패턴
- `ux_pattern` — UI/UX 관련 패턴과 접근성 규칙
- `architecture_precedent` — 아키텍처 의사결정 선례
- `process_improvement` — 프로세스 개선 (구 `gap_pattern`, `debt_pattern`)
- `risk_pattern` — 반복되는 위험 패턴

## Behavior Change Mechanisms

memory는 아래 5개 경로를 통해 다음 task의 행동을 바꾼다.

1. `rules.md` 업데이트 → 모든 packet의 L0 pinned invariants에 반영
2. `agent_memory` layer 업데이트 (`memory_type = "agent_rule"` 등) → type-specific subagent spawn 시 주입
3. `risk_memory` layer 업데이트 (`memory_type = "risk_pattern"`, `"failure_lesson"`) → readiness round auto trigger 강화
4. `project_memory` layer 업데이트 (`memory_type = "project_rule"` 등) → task compiler와 implementation contract에서 default checks 강화
5. harmful reuse 감지 → memory weakening (doc 08 Harmful Reuse Rollback Procedure) / rule rollback (doc 14 Harmful Reuse Feedback Loop)

### Conflict Resolution Priority

서로 다른 behavior surface에서 상충하는 지침이 발생할 경우 아래 우선순위를 따른다 (높은 것이 우선):

1. **`rules.md`** — project-wide 확정 규칙. 최고 우선순위.
2. **`project_memory`** — 반복 검증된 프로젝트 수준 지식.
3. **`agent_memory`** — 역할별 축적 지식.
4. **`risk_memory`** — 과거 실패 기반 경고.

상충 발생 시 낮은 우선순위 memory에 `conflict_with` 필드로 상위 memory_id를 기록하고, 해당 memory는 retrieval에서 suppressed 처리한다. orchestration_authority가 다음 retrospective에서 상충을 해소한다.

### Harmful Reuse 정의

harmful reuse란 memory entry가 task에 적용되었으나 task 결과가 악화된 경우를 말한다. 구체적으로:
- evidence gate failure가 해당 memory의 guidance와 관련된 경우
- 적용 후 technical debt가 증가한 경우
- 적용 후 regression이 발생한 경우

탐지 기준: `memory-application-log.json`의 `effect` 필드가 `"negative"` 또는 `"neutral_but_risky"`인 경우 harmful reuse로 분류한다.

## Memory Verification

memory의 신뢰도는 단계적 검증(promotion)을 거쳐야 한다. promotion 경로는 `candidate → provisional → stable → canonical`이다.

각 단계의 상세 승격 조건은 **08_EVOLVING_MEMORY_LIFECYCLE.md의 Promotion Rules**가 canonical authority다. 요약:
- `candidate → provisional`: evidence_refs 2개 이상, 또는 동일 유형 incident 2회 이상, 또는 domain authority의 explicit approval
- `provisional → stable`: successful application 3건 이상 + contradiction 0건 + domain authority review
- `stable → canonical`: successful application 5건 이상 (3개 이상 다른 task) + joint approval

## Core Constraint

memory는 **사실·규칙·경고·precedent**를 저장할 수 있지만, 근거 없는 stylistic preference를 durable memory로 올려선 안 된다.

## Failure Modes and Recovery

### 1. memory-index.json이 손상되거나 누락된 경우

`memory-index.json`은 모든 memory entry의 요약 색인이다. 이 파일이 손상(JSON parse 실패)되거나 삭제된 경우:

- **감지**: memory retrieval 시 `memory-index.json` 로드 실패로 감지된다.
- **복구 절차**: `.geas/memory/` 하위의 개별 `memory-entry.json` 파일들을 순회하여 index를 재구축한다. 각 entry의 `memory_id`, `type`, `scope`, `status`, `confidence`를 수집하여 새 `memory-index.json`을 생성한다.
- **제약**: 재구축 중 memory retrieval은 일시 중단된다. 재구축 완료 후 `orchestration_authority`에게 검증을 요청한다.
- **기록**: 재구축 이벤트를 `memory-application-log.json`에 `effect = "index_rebuild"` 항목으로 기록한다.

### 2. memory-packet.json이 존재하지 않는 memory_id를 참조할 때

context packet 생성 시 `memory-packet.json`에 포함된 `memory_id`가 실제 memory entry로 존재하지 않는 경우:

- **동작**: 해당 entry를 skip하고 경고를 기록한다. **task 실행을 block하지 않는다.**
- **경고 기록**: `memory-application-log.json`에 `effect = "reference_miss"`, 누락된 `memory_id`, 참조 시점을 기록한다.
- **후속 조치**: `orchestration_authority`가 다음 retrospective에서 누락 원인을 조사한다. 가능한 원인: memory entry가 archived/superseded 처리되었으나 packet에서 제거되지 않음, 또는 파일 시스템 오류로 entry가 소실됨.
- **예방**: memory entry의 status가 `archived` 또는 `superseded`로 변경될 때, 해당 `memory_id`를 참조하는 packet을 갱신하는 것을 권장한다.

### 3. Confidence score가 누적 penalty로 0 이하로 하락할 때

`failed reuse`(-0.1)와 `contradiction`(-0.2)이 누적되어 confidence가 계산상 음수가 되는 경우:

- **동작**: confidence를 `0.0`으로 clamp한다 (하한 `0.0` 규칙 적용).
- **즉시 trigger**: confidence가 0.0에 도달하면 decay review를 즉시 trigger한다 (일반 threshold인 `< 0.3` 조건도 충족되므로).
- **decay review 내용**: `orchestration_authority` + 해당 domain authority가 해당 memory를 검토하여 아래 중 하나를 결정한다:
  - `archive` — memory를 보존하되 retrieval에서 제외
  - `supersede` — 새로운 memory로 대체 (superseding_memory_id 기록)
  - `retain` — 근거를 보강하여 유지 (evidence_refs 추가 필요, 추가 없이 retain은 불가)
- **기록**: decay review 결과를 `memory-review.json`에 기록하고, `memory-entry.json`의 `status`와 `confidence`를 갱신한다.

### 4. 두 memory가 서로 모순되며 둘 다 stable 상태일 때

두 개의 `status = stable` memory entry가 상충하는 지침을 포함하는 경우 (예: memory A는 "API 응답에 항상 envelope 패턴 사용"이고 memory B는 "단순 endpoint는 flat response 허용"):

- **감지**: retrieval 시 동일 scope/type의 memory가 상충하는 guidance를 제공하면 감지된다. `memory-application-log.json`에서 동일 task에 두 memory가 적용되어 하나가 `negative` effect를 기록할 때도 감지된다.
- **즉시 동작**: 두 memory 모두 `status = under_review`로 전환한다. `under_review` 상태의 memory는 retrieval에서 제외된다 (task에 주입되지 않음).
- **해소 절차**: `orchestration_authority`가 해당 domain authority와 함께 두 memory를 검토한다. 가능한 결과:
  - 하나를 `superseded`로 전환하고 다른 하나를 유지
  - 둘 다 `superseded`로 전환하고 통합된 새 memory entry 생성
  - scope를 세분화하여 각각 다른 scope에서 유효하도록 조정
- **제약**: 두 memory 중 어느 것도 `orchestration_authority`의 resolution 전에는 task context에 주입될 수 없다.
- **기록**: 각 memory entry의 `conflict_with` 필드에 상대 `memory_id`를 기록하고, resolution 결과를 `memory-review.json`에 기록한다.

### 5. Memory promotion에 필요한 authority가 부재할 때

memory의 status 승격(예: `provisional` → `stable`, `stable` → `canonical`)에 필요한 domain authority가 현재 session에 없거나 응답할 수 없는 경우:

- **동작**: promotion을 queue에 등록하고, 해당 memory를 `pending_review` 표시로 mark한다. **task 실행을 block하지 않는다.**
- **현재 status 유지**: promotion이 완료되지 않은 memory는 현재 status를 그대로 유지한다. 예: `provisional` 상태의 memory는 `provisional`로서 retrieval에 참여한다 (retrieval budget과 confidence에 따라).
- **queue 기록**: `.geas/memory/pending-promotions.json`에 `memory_id`, 요청된 `target_status`, 필요한 `required_authority`, 요청 시각을 기록한다.
- **해소**: 해당 authority가 다음 session에서 활성화되면, `orchestration_authority`가 pending promotion queue를 확인하고 순차적으로 review를 진행한다.
- **장기 미해소**: 3 session 이상 pending 상태가 지속되면, `orchestration_authority`가 retrospective에서 대체 authority 지정 또는 promotion 기준 재검토를 수행한다.
