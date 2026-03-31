# 스키마 참조

여섯 개의 JSON 스키마(draft 2020-12) 파일이 Geas 컴포넌트 간의 데이터 계약을 정의합니다. 각 스키마는 에이전트가 생성하고, 소비하며, 서로에게 전달하는 것을 강제하는 기계가 읽을 수 있는 합의입니다. 이 문서는 여섯 가지 스키마 모두에 대한 권위 있는 참조입니다.

---

## 개요

| 스키마 | 파일 | 생성 주체 | 소비 주체 |
|---|---|---|---|
| Seed | `seed.schema.json` | intake 스킬 | task-compiler |
| TaskContract | `task-contract.schema.json` | task-compiler | context-packet, implementation-contract, evidence-gate |
| ContextPacket | `context-packet.schema.json` | context-packet 스킬 | worker 에이전트 |
| ImplementationContract | `implementation-contract.schema.json` | worker 에이전트 | Sentinel, Forge (승인) |
| EvidenceBundle | `evidence-bundle.schema.json` | worker/reviewer 에이전트 | evidence-gate |
| DecisionRecord | `decision-record.schema.json` | vote-round / debate 스킬 | 영구 결정 로그 |

모든 스키마는 문서화되지 않은 필드가 파이프라인에 조용히 진입하는 것을 방지하기 위해 `"additionalProperties": false`를 사용합니다(해당되는 경우).

---

## 스키마 관계 다이어그램

```
사용자 대화
      |
      v
  [ intake ] ──────────────── 생성 ──────> seed.json (Seed)
      |
      v
[ task-compiler ] ──────────── 생성 ──────> task-contract.json (TaskContract)
      |                                              |
      |──── 공급 ──────> [ context-packet ] ──────> context-packet.json (ContextPacket)
      |                                              |
      |                                              v
      |                                         worker 에이전트
      |                                              |
      |──── 공급 ──────> [ implementation-contract ] <── worker 제안
      |                          |
      |                    Sentinel + Forge 승인
      |                          |
      |                          v
      |                     worker 구현
      |                          |
      |                          v
      |               evidence-bundle.json (EvidenceBundle)
      |                          |
      |──── 공급 ──────> [ evidence-gate ] ──────> GateVerdict (pass / fail / escalate)
      |                                                    |
      |                                             에스컬레이션 시
      |                                                    |
      |──── 공급 ──────> [ vote-round / debate ] ──────> decision-record.json (DecisionRecord)
```

---

## 스키마 세부 사항

### 1. Seed

**위치:** `plugin/skills/intake/schemas/seed.schema.json`

**목적:** 실행이 시작되기 전에 intake 스킬이 생성한 미션 명세를 동결합니다.

Seed는 인간 이해관계자와 에이전트 팀 간의 계약입니다. 유효한 Seed가 디스크에 있을 때까지 어떤 작업 컴파일도 시작할 수 없습니다. 범위가 의식적으로 고려되었음을 강제합니다(최소 하나의 `scope_out` 항목 필요), 인수 기준이 구체적임을 요구합니다(최소 3개), 그리고 `completeness_checklist`를 통해 모든 섹션이 검토되었음을 확인합니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `mission` | `string` | 정제된, 명확한 미션 진술 |
| `acceptance_criteria` | `array<string>` | 완료를 정의하는 측정 가능한 기준. 최소 3개 항목. |
| `scope_in` | `array<string>` | 명시적으로 포함된 기능. 최소 1개 항목. |
| `scope_out` | `array<string>` | 명시적으로 제외된 기능. 최소 1개 항목. 범위가 고려되었음을 증명. |
| `completeness_checklist` | `object` | 각 섹션이 사용자에 의해 검토되고 승인되었음을 확인하는 이진 체크리스트 |
| `created_at` | `string` (date-time) | seed가 동결된 ISO 8601 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `target_user` | `string` | 주요 사용자 페르소나 또는 대상 |
| `constraints` | `array<string>` | 기술적 또는 비즈니스 제약 (예: "관계형 데이터베이스를 사용해야 함") |
| `assumptions` | `array<string>` | intake 중에 표면화되어 사용자가 확인한 가정들 |
| `ambiguity_notes` | `array<string>` | 근거와 함께 인정되었지만 연기된 남은 모호성들 |
| `source` | `string` (enum) | 이 seed를 생성한 모드. 아래 열거형 참조. |
| `readiness_override` | `boolean` | 사용자가 명시적으로 intake를 건너뛴 경우 true ("그냥 만들어") |

#### `completeness_checklist` 속성

| 필드 | 유형 | 설명 |
|---|---|---|
| `mission` | `boolean` | 미션 섹션 검토됨 |
| `acceptance_criteria` | `boolean` | 인수 기준 검토됨 |
| `scope_out` | `boolean` | Scope-out 섹션 검토됨 |
| `target_user` | `boolean` | 대상 사용자 검토됨 |
| `constraints` | `boolean` | 제약 검토됨 |

#### 열거형 및 제약

- `source`: `"initiative"` | `"sprint"` — seed를 생성한 모드를 추적합니다. `"sprint"`는 최소한으로 자동 생성된 seed를 나타냅니다(전체 Initiative intake가 아님). Initiative 실행은 sprint가 생성한 seed를 덮어쓸 수 있습니다.
- `acceptance_criteria`: 최소 3개 항목
- `scope_in`: 최소 1개 항목
- `scope_out`: 최소 1개 항목

#### 주요 관계

- `intake` 스킬이 생성하고 `.geas/memory/_project/seed.json`에 작성됩니다
- `task-compiler`가 미션, 제약, 인수 기준의 진실 원천으로 읽습니다
- `source` 필드는 sprint vs initiative 출처를 구분하기 위해 v0.2.0에 추가되었습니다

---

### 2. TaskContract

**위치:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

**목적:** worker가 전달해야 하는 것을 정의하는 기계가 읽을 수 있는 계약으로, 모호한 이슈 설명을 검증 가능한 합의로 대체합니다.

TaskContract는 Geas에서 작업의 중심 단위입니다. 모든 하위 아티팩트 — ContextPacket, ImplementationContract, EvidenceBundle — 는 TaskContract의 `task_id`를 참조합니다. `rubric` 필드(v0.2.0부터 필수)는 작업이 Evidence Gate의 Tier 3 검사를 통과하기 전에 점수를 매겨야 하는 품질 차원을 정의합니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 작업 식별자 (예: `"task-001"`) |
| `title` | `string` | 사람이 읽을 수 있는 작업 제목 |
| `goal` | `string` | 이 작업이 달성해야 하는 것, 검증 가능한 결과로 명시 |
| `assigned_worker` | `string` | 구현을 담당한 에이전트 이름 (예: `"pixel"`, `"circuit"`) |
| `acceptance_criteria` | `array<string>` | seed와 스토리에서 상속된 구체적이고 검증 가능한 기준 |
| `eval_commands` | `array<string>` | 작업을 기계적으로 검증하는 쉘 명령어 |
| `rubric` | `array<object>` | 점수 임계값이 있는 품질 rubric 차원. 모두 Tier 3 진입을 위해 통과해야 함. |
| `status` | `string` (enum) | 작업의 현재 생명주기 상태 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `reviewer` | `string` | 리뷰를 담당한 에이전트 이름 (예: `"forge"`) |
| `prohibited_paths` | `array<string>` | worker가 수정해서는 안 되는 파일/디렉토리 경로 |
| `dependencies` | `array<string>` | 이 작업이 시작되기 전에 완료되어야 하는 작업 ID |
| `scope_out` | `array<string>` | 이 작업이 구현하지 않을 기능 수준 제외사항. 파일 수준인 `prohibited_paths`를 보완. |
| `retry_budget` | `integer` | 에스컬레이션 전 최대 수정-검증 반복 횟수. 기본값: `3`. 범위: 1–5. |
| `escalation_policy` | `string` (enum) | 재시도 예산이 소진될 때 발생하는 일. 기본값: `"forge-review"`. |

#### `rubric` 항목 구조

`rubric` 배열의 각 항목은 다음 필수 필드를 가집니다:

| 필드 | 유형 | 설명 |
|---|---|---|
| `dimension` | `string` | 품질 차원 이름 (예: `"core_interaction"`, `"code_quality"`) |
| `evaluator` | `string` (enum) | 점수를 담당하는 에이전트: `"sentinel"` \| `"forge"` \| `"nova"` |
| `threshold` | `integer` | 통과에 필요한 최소 점수 (1–5). 임계값 미만 점수는 Tier 3 진입을 차단. |

#### 열거형 및 제약

- `status`: `"pending"` | `"in_progress"` | `"in_review"` | `"testing"` | `"passed"` | `"failed"` | `"escalated"`
- `escalation_policy`: `"forge-review"` | `"nova-decision"` | `"pivot"`
- `rubric[].evaluator`: `"sentinel"` | `"forge"` | `"nova"`
- `rubric[].threshold`: 정수, 1–5
- `retry_budget`: 정수, 1–5, 기본값 3

#### 주요 관계

- `task-compiler` 스킬이 Seed에서 파생합니다
- `id`는 ContextPacket, ImplementationContract, EvidenceBundle이 참조하는 외래 키입니다 (`task_id`)
- `acceptance_criteria`와 `eval_commands`는 ContextPacket에 복사됩니다
- `prohibited_paths`는 ContextPacket에 복사됩니다
- `rubric` 임계값은 EvidenceBundle의 `rubric_scores`에 대해 평가됩니다
- `scope_out`은 seed 수준의 `scope_out`과 함께 v0.2.0에 추가되었습니다

---

### 3. ContextPacket

**위치:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

**목적:** worker를 위한 역할별 브리핑으로, "모든 댓글 읽기"를 집중되고 압축된 컨텍스트 창으로 대체합니다.

ContextPacket은 worker가 작업을 시작하기 직전에 `context-packet` 스킬이 생성합니다. TaskContract의 관련 부분 — 인수 기준, eval 명령어, 금지된 경로 — 을 디자인 발췌, 기술 접근 방식 메모, 이전 증거에 대한 포인터와 함께 통합합니다. worker는 ContextPacket과 에이전트 정의만 사용하여 작업을 실행할 수 있어야 합니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract에 대한 참조 |
| `target_worker` | `string` | 이 패킷이 작성된 에이전트 이름 |
| `issue_summary` | `string` | 작업이 무엇인지에 대한 1–3문장 요약 |
| `acceptance_criteria` | `array<string>` | TaskContract에서 상속됨 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `design_excerpt` | `string` | Palette의 관련 디자인 결정 (해당되는 경우) |
| `tech_approach` | `string` | Forge의 기술적 접근 방식 (해당되는 경우) |
| `prohibited_paths` | `array<string>` | TaskContract에서 상속됨 |
| `eval_commands` | `array<string>` | TaskContract에서 상속됨 |
| `known_risks` | `array<string>` | worker가 알아야 할 위험 또는 엣지 케이스 |
| `prior_evidence` | `array<string>` | 파이프라인의 이전 worker에서 가져온 EvidenceBundle 파일 경로 |

#### 열거형 및 제약

열거형 없음. `additionalProperties`는 이 문서의 스키마 수준에서 제한되지 않지만 모든 필드는 명시적으로 정의됩니다.

#### 주요 관계

- TaskContract를 읽는 `context-packet` 스킬이 생성합니다
- `task_id`가 TaskContract로 역링크됩니다
- `prior_evidence`에는 EvidenceBundle 파일 경로가 포함되어 worker가 이전 산출물을 기반으로 작업할 수 있게 합니다
- 협업 스레드에서의 인간 댓글은 이 패킷을 채울 때 최우선 순위를 가집니다

---

### 4. ImplementationContract

**위치:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

**목적:** worker와 리뷰어 간의 구현 전 합의로, 코드를 작성하기 전에 worker의 제안된 접근 방식, 엣지 케이스 처리, 데모 단계를 포착합니다.

ImplementationContract는 구현이 시작되기 전의 게이트입니다. worker가 구체적인 행동을 제안하고 리뷰어(Sentinel, Forge)가 승인합니다. 이는 잘못 정렬된 가정으로 인한 구현 노력 낭비를 방지합니다. TaskContract와 구별됩니다: TaskContract는 *무엇*을 해야 하는지를 말하고; ImplementationContract는 worker가 *어떻게* 할 계획인지를 말합니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract에 대한 참조 |
| `worker` | `string` | 구현할 에이전트 (예: `"pixel"`, `"circuit"`) |
| `planned_actions` | `array<string>` | worker가 취할 구체적인 행동. 최소 1개 항목. |
| `edge_cases` | `array<string>` | worker가 처리할 계획인 엣지 케이스. 최소 1개 항목. |
| `non_goals` | `array<string>` | 이 구현이 명시적으로 하지 않을 것. 범위 확장 방지. 최소 1개 항목. |
| `demo_steps` | `array<string>` | 완료를 시연하고 검증하는 단계별 절차. 최소 1개 항목. |
| `status` | `string` (enum) | 현재 승인 상태. 기본값: `"draft"`. |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `state_transitions` | `array<string>` | 구현이 도입할 상태 전환 (예: `"unauthenticated -> authenticated"`) |
| `approved_by` | `array<string>` | 계약을 승인한 에이전트 (예: `["sentinel", "forge"]`) |
| `approval_notes` | `string` | 승인 중 리뷰어의 메모 |

#### 열거형 및 제약

- `status`: `"draft"` | `"in_review"` | `"approved"` | `"revision_requested"`
- `planned_actions`: 최소 1개 항목
- `edge_cases`: 최소 1개 항목
- `non_goals`: 최소 1개 항목
- `demo_steps`: 최소 1개 항목

#### 주요 관계

- `task_id`가 상위 TaskContract로 연결됩니다
- worker가 구현을 시작하기 전에 `status: "approved"`에 도달해야 합니다
- `demo_steps`는 완료를 검증하기 위해 QA 중에 Sentinel이 재사용합니다
- `non_goals`는 구현 전략 수준에서 TaskContract의 `scope_out`과 `prohibited_paths`를 보완합니다
- v0.2.0에서 새 스키마로 도입되었습니다

---

### 5. EvidenceBundle

**위치:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`

**목적:** worker의 구조화된 산출물로, 리뷰어와 Evidence Gate가 작업 완료를 평가하는 데 필요한 모든 증거를 제공합니다.

EvidenceBundle은 파이프라인에서 작업을 수행하는 에이전트의 주요 산출 아티팩트입니다. 작업을 생성하는 모든 에이전트 역할 — 구현자, 리뷰어, QA, 보안 감사자 — 는 EvidenceBundle을 제출합니다. Evidence Gate는 번들을 집계하고 세 가지 검증 계층을 실행합니다. v0.2.0 추가 사항(`self_check`, `rubric_scores`, `state_verification`)은 gate에 더 풍부한 신호를 제공합니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract에 대한 참조 |
| `worker` | `string` | 이 증거를 생성한 에이전트 이름 |
| `type` | `string` (enum) | 증거 카테고리 |
| `summary` | `string` | 수행된 것과 주요 결정에 대한 간략한 요약 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `files_changed` | `array<string>` | 생성되거나 수정된 파일 경로 목록 |
| `verify_results` | `object` | 기계적 검증 결과 (build, lint, test, typecheck) |
| `criteria_results` | `array<object>` | TaskContract 인수 기준에 대한 기준별 평가 |
| `screenshots` | `array<string>` | 스크린샷 파일 경로 (UI 작업의 경우) |
| `issues_found` | `array<object>` | 리뷰, QA, 또는 보안 감사 중 발견된 이슈 |
| `tech_debt` | `array<object>` | 식별된 기술 부채 — 차단하지 않지만 추적해야 함 |
| `self_check` | `object` | worker의 정직한 자기 평가, Sentinel에게 어디에 집중해야 하는지 안내 |
| `rubric_scores` | `array<object>` | 평가자가 생성한 rubric 차원 점수 |
| `state_verification` | `object` | 상태 기반 QA 결과 — UI 표면 테스팅 너머의 API 응답 및 DB 상태 |
| `notes` | `string` | 추가 컨텍스트 또는 관찰 사항 |

#### `verify_results` 속성

네 가지 검사 필드 각각은 동일한 열거형을 사용합니다:

| 필드 | 값 | 설명 |
|---|---|---|
| `build` | `"pass"` \| `"fail"` \| `"skip"` | 빌드 검사 결과 |
| `lint` | `"pass"` \| `"fail"` \| `"skip"` | Lint 검사 결과 |
| `test` | `"pass"` \| `"fail"` \| `"skip"` | 테스트 스위트 결과 |
| `typecheck` | `"pass"` \| `"fail"` \| `"skip"` | 타입 검사 결과 |

#### `criteria_results` 항목 구조

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `criterion` | `string` | 예 | 인수 기준 텍스트 |
| `met` | `boolean` | 예 | 기준이 충족되었는지 여부 |
| `evidence` | `string` | 아니오 | 판단을 지지하는 구체적인 증거 |

#### `issues_found` 항목 구조

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | 예 | `"critical"` \| `"major"` \| `"minor"` \| `"suggestion"` |
| `description` | `string` | 예 | 이슈 설명 |
| `file` | `string` | 아니오 | 이슈가 발견된 파일 경로 |
| `line` | `integer` | 아니오 | 이슈의 라인 번호 |

#### `tech_debt` 항목 구조

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | 예 | `"HIGH"` \| `"MEDIUM"` \| `"LOW"` |
| `title` | `string` | 예 | 부채 항목의 짧은 레이블 |
| `description` | `string` | 아니오 | 부채 설명 |

#### `self_check` 구조 (v0.2.0)

`self_check`는 `additionalProperties: false`를 가진 선택적 객체입니다. 내부 필수 하위 필드: `known_risks`, `untested_paths`, `confidence`.

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `known_risks` | `array<string>` | 예 | worker가 자신의 구현에서 인식하는 위험 |
| `untested_paths` | `array<string>` | 예 | worker가 테스트하지 않은 코드 경로 |
| `confidence` | `integer` (1–5) | 예 | worker의 자기 평가 신뢰도. 점수 ≤ 2이면 Evidence Gate에서 더 엄격한 rubric 임계값이 적용됨. |
| `possible_stubs` | `array<string>` | 아니오 | 스텁 또는 플레이스홀더로 남겨진 구현 |
| `what_i_would_test_next` | `array<string>` | 아니오 | QA가 우선시할 제안된 테스트 영역 |

#### `rubric_scores` 항목 구조 (v0.2.0)

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `dimension` | `string` | 예 | 차원 이름, TaskContract rubric의 차원과 일치 |
| `score` | `integer` (1–5) | 예 | 평가자가 부여한 점수 |
| `rationale` | `string` | 아니오 | 점수에 대한 간략한 정당성 |

Evidence Gate는 각 `score`를 TaskContract `rubric`의 해당 `threshold`와 비교합니다. 임계값 미만의 차원은 Tier 3 진입을 차단합니다.

#### `state_verification` 구조 (v0.2.0)

`state_verification`은 `additionalProperties: false`를 가진 선택적 객체입니다. UI 표면을 통해 관찰할 수 없는 상태 기반 QA 결과를 포착합니다.

**`api_checks` 항목:**

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `endpoint` | `string` | 예 | 테스트된 API 엔드포인트 |
| `expected_status` | `integer` | 예 | 예상 HTTP 상태 코드 |
| `actual_status` | `integer` | 예 | 실제 반환된 HTTP 상태 코드 |
| `pass` | `boolean` | 예 | 검사 통과 여부 |
| `notes` | `string` | 아니오 | 응답에 대한 추가 메모 |

**`db_checks` 항목:**

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `description` | `string` | 예 | 검증된 것 |
| `pass` | `boolean` | 예 | 검사 통과 여부 |
| `query` | `string` | 아니오 | 실행된 읽기 전용 쿼리 |
| `expected` | `string` | 아니오 | 예상 결과 |
| `actual` | `string` | 아니오 | 실제 결과 |

#### `type` 열거형 값

`"design"` | `"implementation"` | `"review"` | `"qa"` | `"security"` | `"performance"` | `"documentation"` | `"product-review"`

#### 주요 관계

- `task_id`가 상위 TaskContract로 연결됩니다
- `rubric_scores`는 TaskContract의 `rubric`에 대해 평가됩니다
- `self_check.confidence`는 Evidence Gate 점수 임계값에 영향을 미칩니다
- `state_verification`은 `verify_results`(기계적)와 `criteria_results`(의미론적)를 보완합니다
- 하나의 `task_id`에 대해 여러 EvidenceBundle이 존재할 수 있으며, 각각 다른 에이전트 역할에서 옵니다

---

### 6. DecisionRecord

**위치:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

**목적:** 아키텍처, 제품, 또는 에스컬레이션 결정의 영구적인 기록으로, 일시적인 토론 댓글을 구조화되고 추적 가능한 결정으로 대체합니다.

DecisionRecord는 vote-round 또는 debate 스킬 실행 끝에 작성됩니다. 무엇이 결정되었는지, 왜, 누가 결정했는지를 포착합니다. 이는 그렇지 않으면 대화 스레드에만 존재할 결정들에 대한 영구적인 감사 추적을 만듭니다. DecisionRecord는 팀이 방향을 바꾸면 이전 것을 대체할 수 있습니다.

#### 필수 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 결정 식별자 (예: `"dec-001"`) |
| `title` | `string` | 결정을 설명하는 짧은 제목 |
| `context` | `string` | 이 결정이 필요했던 이유 — 문제 또는 트리거 |
| `decision` | `string` | 선택된 옵션과 구체적으로 무엇을 의미하는지 |
| `reasoning` | `string` | 대안들보다 이 옵션이 선택된 이유 |
| `decided_by` | `string` | 최종 결정을 내린 에이전트 (예: `"nova"`, `"forge"`) |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택적 필드

| 필드 | 유형 | 설명 |
|---|---|---|
| `options` | `array<object>` | 결정 전에 고려된 옵션들 |
| `trade_offs` | `string` | 팀이 포기하거나 위험으로 받아들이는 것 |
| `participants` | `array<string>` | 토론에 참여한 에이전트들 |
| `related_task_id` | `string` | 이 결정이 관련된 TaskContract ID (있는 경우) |
| `supersedes` | `string` | 이것이 대체하는 이전 DecisionRecord의 ID |

#### `options` 항목 구조

| 필드 | 유형 | 필수 여부 | 설명 |
|---|---|---|---|
| `name` | `string` | 예 | 옵션의 짧은 레이블 |
| `description` | `string` | 예 | 옵션 설명 |
| `pros` | `array<string>` | 아니오 | 찬성 논거 |
| `cons` | `array<string>` | 아니오 | 반대 논거 |

#### 열거형 및 제약

열거형 없음. `additionalProperties`는 이 문서의 스키마 수준에서 제한되지 않습니다.

#### 주요 관계

- `related_task_id`는 선택적으로 TaskContract로 연결되며, 일반적으로 Evidence Gate에서 에스컬레이션으로 인해 결정이 트리거될 때
- `supersedes`는 뒤집힌 결정의 역사를 추적할 수 있게 합니다
- 영구적인 프로젝트 역사로서 `.geas/memory/_project/decisions/`에 작성됩니다
- `vote-round`와 `debate` 스킬이 생성합니다

---

## v0.2.0에서 추가된 새 필드

다음 필드들은 v0.2.0에서 스키마 세트에 추가되었습니다. rubric 기반 품질 점수, worker 자기 정직성, 상태 기반 QA 검증, 다중 모드 seed 추적을 구현합니다.

### TaskContract의 `rubric` (필수)

**스키마:** TaskContract
**유형:** `array<object>`
**상태:** 필수

v0.2.0에서 필수 필드로 추가되었습니다. 이제 모든 TaskContract는 담당 평가자 에이전트와 최소 통과 임계값이 있는 하나 이상의 품질 차원을 정의해야 합니다. Evidence Gate는 Tier 3 승인을 게이팅하는 데 이 임계값들을 사용합니다. 이 필드가 필수가 되기 전에 컴파일된 작업은 재생성해야 합니다.

### EvidenceBundle의 `self_check` (선택적 객체)

**스키마:** EvidenceBundle
**유형:** `object`
**상태:** 선택적, 그러나 구현 번들에 강력히 권장

증거를 제출하기 전에 worker의 정직한 자기 평가를 포착합니다. `confidence` 하위 필드(self_check 내에서 필수)는 Evidence Gate 동작에 직접 영향을 미칩니다: 2 이하의 점수는 Sentinel에게 더 엄격한 rubric 임계값을 적용하라는 신호를 줍니다. `untested_paths`와 `what_i_would_test_next`는 Sentinel이 이 영역을 독립적으로 발견할 필요 없이 Sentinel의 QA 초점을 안내합니다.

### EvidenceBundle의 `rubric_scores` (선택적 배열)

**스키마:** EvidenceBundle
**유형:** `array<object>`
**상태:** 선택적; Tier 3 gate 통과에 필수

평가자들(QA 차원을 위한 Sentinel, 코드 품질 차원을 위한 Forge)이 작업을 채점한 후 이 배열을 채웁니다. Evidence Gate는 모든 `rubric_scores`를 집계하고 각 `score`를 TaskContract `rubric`의 해당 `threshold`와 비교합니다. 필수 차원에 대한 누락된 점수는 gate 실패로 처리됩니다.

### EvidenceBundle의 `state_verification` (선택적 객체)

**스키마:** EvidenceBundle
**유형:** `object`
**상태:** 선택적; API 또는 데이터베이스 인수 기준이 있는 작업에 필수

`verify_results`(쉘 명령어를 실행)나 `criteria_results`(에이전트 관찰에 의존)로 포착할 수 없는 상태 기반 QA의 구조화된 기록을 제공합니다. `api_checks`는 실제 HTTP 응답을 기록하고; `db_checks`는 읽기 전용 데이터베이스 쿼리와 결과를 기록합니다. 둘 다 Evidence Gate에 감사 가능하고 기계가 읽을 수 있는 시스템 상태 증거를 제공합니다.

### TaskContract의 `scope_out` (선택적 배열)

**스키마:** TaskContract
**유형:** `array<string>`
**상태:** 선택적

작업 수준에서 seed 수준의 `scope_out`을 미러링합니다. `prohibited_paths`가 파일 수준 접근을 제한하는 반면, `scope_out`은 이 특정 작업에 대한 기능 수준 제외사항을 표현합니다. 이는 worker가 전체 seed를 다시 읽을 필요 없이 작업 내 범위 확장을 방지합니다.

### Seed의 `source` (선택적 문자열 열거형)

**스키마:** Seed
**유형:** `string` 열거형: `"initiative"` | `"sprint"`
**상태:** 선택적

seed를 생성한 실행 모드를 추적합니다. `"sprint"` seed는 자동 생성되고 최소화됩니다; 전체 `"initiative"` 실행으로 덮어쓸 수 있습니다. 이는 시스템이 sprint를 통해 시작된 프로젝트에 적절한 intake 과정이 필요한지 감지할 수 있게 합니다.
