# 스키마 참조

JSON Schema(draft 2020-12) 파일 6개가 Geas 컴포넌트 사이의 데이터 계약을 정의합니다. 각 스키마는 에이전트가 무엇을 만들고, 무엇을 소비하고, 무엇을 넘겨줘야 하는지 강제하는 기계 판독 가능한 합의입니다.

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

모든 스키마는 `"additionalProperties": false`를 씁니다(해당하는 경우). 문서에 없는 필드가 파이프라인에 몰래 들어오는 걸 막기 위해서입니다.

---

## 스키마 관계 다이어그램

```
User conversation
      |
      v
  [ intake ] ──────────────── produces ──────> seed.json (Seed)
      |
      v
[ task-compiler ] ──────────── produces ──────> task-contract.json (TaskContract)
      |                                              |
      |──── feeds ──────> [ context-packet ] ──────> context-packet.json (ContextPacket)
      |                                              |
      |                                              v
      |                                         worker agent
      |                                              |
      |──── feeds ──────> [ implementation-contract ] <── worker proposes
      |                          |
      |                    Sentinel + Forge approve
      |                          |
      |                          v
      |                     worker implements
      |                          |
      |                          v
      |               evidence-bundle.json (EvidenceBundle)
      |                          |
      |──── feeds ──────> [ evidence-gate ] ──────> GateVerdict (pass / fail / escalate)
      |                                                    |
      |                                             if escalated
      |                                                    |
      |──── feeds ──────> [ vote-round / debate ] ──────> decision-record.json (DecisionRecord)
```

---

## 스키마 상세

### 1. Seed

**위치:** `plugin/skills/intake/schemas/seed.schema.json`

**목적:** 실행이 시작되기 전에 intake 스킬이 만든 미션 명세를 동결합니다.

Seed는 사람(이해관계자)과 에이전트 팀 사이의 계약입니다. 유효한 Seed가 디스크에 있어야 task compilation을 시작할 수 있습니다. `scope_out` 항목을 최소 1개 요구해서 범위를 의식적으로 고려했는지 강제합니다. `acceptance_criteria`는 최소 3개여야 합니다. `completeness_checklist`로 모든 섹션의 검토 여부를 확인합니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `mission` | `string` | 정제된 명확한 미션 선언문 |
| `acceptance_criteria` | `array<string>` | "완료"를 정의하는 측정 가능한 기준입니다. 최소 3개입니다. |
| `scope_in` | `array<string>` | 명시적으로 포함하는 기능입니다. 최소 1개입니다. |
| `scope_out` | `array<string>` | 명시적으로 제외하는 기능입니다. 최소 1개입니다. 범위를 고려했다는 증거입니다. |
| `completeness_checklist` | `object` | 각 섹션을 사용자가 검토하고 승인했는지 확인하는 boolean 체크리스트 |
| `created_at` | `string` (date-time) | seed를 동결한 시점의 ISO 8601 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `target_user` | `string` | 주요 사용자 페르소나 또는 대상 |
| `constraints` | `array<string>` | 기술적/비즈니스 제약 (예: "관계형 DB 필수") |
| `assumptions` | `array<string>` | intake 중에 나온 가정 중 사용자가 확인한 것 |
| `ambiguity_notes` | `array<string>` | 인정했지만 나중으로 미룬 모호한 부분과 그 이유 |
| `source` | `string` (enum) | seed를 만든 모드. 아래 enum 참고. |
| `readiness_override` | `boolean` | 사용자가 intake을 명시적으로 건너뛴 경우 true ("그냥 만들어") |

#### `completeness_checklist` 속성

| 필드 | 타입 | 설명 |
|---|---|---|
| `mission` | `boolean` | 미션 섹션 검토 여부 |
| `acceptance_criteria` | `boolean` | 인수 기준 검토 여부 |
| `scope_out` | `boolean` | scope_out 섹션 검토 여부 |
| `target_user` | `boolean` | 대상 사용자 검토 여부 |
| `constraints` | `boolean` | 제약 사항 검토 여부 |

#### enum과 제약

- `source`: `"initiative"` | `"sprint"` -- seed를 만든 모드를 추적합니다. `"sprint"`는 최소한의 자동 생성 seed입니다. Initiative 실행이 sprint seed를 덮어쓸 수 있습니다.
- `acceptance_criteria`: 최소 3개
- `scope_in`: 최소 1개
- `scope_out`: 최소 1개

#### 주요 관계

- `intake` 스킬이 만들어서 `.geas/memory/_project/seed.json`에 씁니다.
- `task-compiler`가 미션, 제약, 인수 기준의 원본으로 읽습니다.
- `source` 필드는 v0.2.0에서 sprint/initiative 출처를 구분하기 위해 추가됐습니다.

---

### 2. TaskContract

**위치:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

**목적:** worker가 무엇을 만들어야 하는지 기계 판독 가능한 계약으로 정의합니다. 모호한 이슈 설명 대신 검증 가능한 합의입니다.

TaskContract는 Geas의 작업 단위입니다. 모든 하위 산출물(ContextPacket, ImplementationContract, EvidenceBundle)이 TaskContract의 `task_id`를 참조합니다. `rubric` 필드(v0.2.0부터 필수)는 Evidence Gate의 Tier 3을 통과하기 위해 채점해야 하는 품질 차원을 정의합니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 태스크 식별자 (예: `"task-001"`) |
| `title` | `string` | 사람이 읽을 수 있는 태스크 제목 |
| `goal` | `string` | 이 태스크가 달성해야 하는 것. 검증 가능한 결과로 적습니다. |
| `assigned_worker` | `string` | 구현 담당 에이전트 이름 (예: `"pixel"`, `"circuit"`) |
| `acceptance_criteria` | `array<string>` | seed와 스토리에서 가져온 검증 가능한 기준 |
| `eval_commands` | `array<string>` | 태스크를 기계적으로 검증하는 셸 명령어 |
| `rubric` | `array<object>` | 품질 rubric 차원과 통과 기준입니다. 전부 통과해야 Tier 3에 들어갑니다. |
| `status` | `string` (enum) | 태스크의 현재 상태 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `reviewer` | `string` | 리뷰 담당 에이전트 이름 (예: `"forge"`) |
| `prohibited_paths` | `array<string>` | worker가 수정하면 안 되는 파일/디렉토리 경로 |
| `dependencies` | `array<string>` | 이 태스크 시작 전에 완료돼야 하는 태스크 ID |
| `scope_out` | `array<string>` | 이 태스크에서 구현하지 않을 기능입니다. 파일 단위인 `prohibited_paths`와 달리 기능 단위 제외입니다. |
| `retry_budget` | `integer` | 에스컬레이션 전 최대 수정-검증 반복 횟수입니다. 기본값 `3`, 범위 1-5. |
| `escalation_policy` | `string` (enum) | 재시도 예산 소진 시 행동입니다. 기본값 `"forge-review"`. |

#### `rubric` 항목 구조

`rubric` 배열의 각 항목에는 아래 필수 필드가 있습니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `dimension` | `string` | 품질 차원 이름 (예: `"core_interaction"`, `"code_quality"`) |
| `evaluator` | `string` (enum) | 채점 담당 에이전트: `"sentinel"` \| `"forge"` \| `"nova"` |
| `threshold` | `integer` | 통과 최소 점수 (1-5)입니다. 미달이면 Tier 3 진입이 막힙니다. |

#### enum과 제약

- `status`: `"pending"` | `"in_progress"` | `"in_review"` | `"testing"` | `"passed"` | `"failed"` | `"escalated"`
- `escalation_policy`: `"forge-review"` | `"nova-decision"` | `"pivot"`
- `rubric[].evaluator`: `"sentinel"` | `"forge"` | `"nova"`
- `rubric[].threshold`: 정수, 1-5
- `retry_budget`: 정수, 1-5, 기본값 3

#### 주요 관계

- `task-compiler` 스킬이 Seed에서 파생합니다.
- `id`는 ContextPacket, ImplementationContract, EvidenceBundle이 참조하는 외래 키입니다(`task_id`).
- `acceptance_criteria`와 `eval_commands`는 ContextPacket에 복사됩니다.
- `prohibited_paths`도 ContextPacket에 복사됩니다.
- `rubric` threshold는 EvidenceBundle의 `rubric_scores`와 비교합니다.
- `scope_out`은 seed 수준의 `scope_out`과 함께 v0.2.0에서 추가됐습니다.

---

### 3. ContextPacket

**위치:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

**목적:** worker에게 주는 역할별 브리핑입니다. "댓글 전부 읽어라" 대신, 핵심만 압축한 컨텍스트를 줍니다.

ContextPacket은 worker가 작업을 시작하기 직전에 `context-packet` 스킬이 만듭니다. TaskContract에서 인수 기준, eval 명령어, 금지 경로를 가져오고, 디자인 발췌, 기술 접근 방식, 이전 근거 파일 경로를 합칩니다. worker는 ContextPacket과 에이전트 정의만으로 작업할 수 있어야 합니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `target_worker` | `string` | 이 패킷 대상 에이전트 이름 |
| `issue_summary` | `string` | 태스크 요약 1-3문장 |
| `acceptance_criteria` | `array<string>` | TaskContract에서 가져옴 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `design_excerpt` | `string` | Palette의 관련 디자인 결정 (해당 시) |
| `tech_approach` | `string` | Forge의 기술 접근 방식 (해당 시) |
| `prohibited_paths` | `array<string>` | TaskContract에서 가져옴 |
| `eval_commands` | `array<string>` | TaskContract에서 가져옴 |
| `known_risks` | `array<string>` | worker가 알아야 할 위험이나 엣지 케이스 |
| `prior_evidence` | `array<string>` | 이전 worker의 EvidenceBundle 파일 경로 |

#### enum과 제약

enum 없습니다. `additionalProperties`는 스키마 수준에서 제한하지 않지만, 모든 필드를 명시적으로 정의합니다.

#### 주요 관계

- `context-packet` 스킬이 TaskContract를 읽어서 만듭니다.
- `task_id`로 TaskContract에 연결됩니다.
- `prior_evidence`에 이전 worker의 EvidenceBundle 경로가 들어갑니다. worker가 이전 산출물을 참고할 수 있습니다.
- 협업 스레드의 사람 댓글은 이 패킷을 채울 때 최우선입니다.

---

### 4. ImplementationContract

**위치:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

**목적:** 구현 전에 worker와 리뷰어가 맺는 합의입니다. 코드를 쓰기 전에 접근 방식, 엣지 케이스 처리, 데모 단계를 확정합니다.

ImplementationContract는 구현 시작 전의 gate입니다. worker가 구체적 행동을 제안하면 Sentinel과 Forge가 승인합니다. 잘못된 가정으로 구현 시간을 낭비하는 걸 막습니다. TaskContract와 역할이 다릅니다. TaskContract는 *무엇*을 해야 하는지, ImplementationContract는 *어떻게* 할 건지를 정합니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `worker` | `string` | 구현 담당 에이전트 (예: `"pixel"`, `"circuit"`) |
| `planned_actions` | `array<string>` | worker가 취할 구체적 행동입니다. 최소 1개입니다. |
| `edge_cases` | `array<string>` | worker가 처리할 엣지 케이스입니다. 최소 1개입니다. |
| `non_goals` | `array<string>` | 이 구현에서 명시적으로 하지 않을 것입니다. 범위 확대를 막습니다. 최소 1개입니다. |
| `demo_steps` | `array<string>` | 완료를 시연하고 검증하는 단계별 절차입니다. 최소 1개입니다. |
| `status` | `string` (enum) | 현재 승인 상태입니다. 기본값 `"draft"`. |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `state_transitions` | `array<string>` | 구현이 도입할 상태 전환 (예: `"unauthenticated -> authenticated"`) |
| `approved_by` | `array<string>` | 계약을 승인한 에이전트 (예: `["sentinel", "forge"]`) |
| `approval_notes` | `string` | 승인 중 리뷰어의 메모 |

#### enum과 제약

- `status`: `"draft"` | `"in_review"` | `"approved"` | `"revision_requested"`
- `planned_actions`: 최소 1개
- `edge_cases`: 최소 1개
- `non_goals`: 최소 1개
- `demo_steps`: 최소 1개

#### 주요 관계

- `task_id`로 상위 TaskContract에 연결됩니다.
- worker가 구현을 시작하려면 `status: "approved"`여야 합니다.
- `demo_steps`는 QA 때 Sentinel이 완료 검증에 재사용합니다.
- `non_goals`는 구현 전략 수준에서 TaskContract의 `scope_out`, `prohibited_paths`를 보완합니다.
- v0.2.0에서 새 스키마로 도입됐습니다.

---

### 5. EvidenceBundle

**위치:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`

**목적:** worker의 구조화된 산출물입니다. 리뷰어와 Evidence Gate가 태스크 완료를 판단하는 데 필요한 모든 근거를 담습니다.

EvidenceBundle은 파이프라인에서 작업하는 모든 에이전트의 주요 산출물입니다. 구현자, 리뷰어, QA, 보안 감사자 등 작업하는 에이전트는 전부 EvidenceBundle을 냅니다. Evidence Gate가 번들을 모아서 3단계 검증을 돌립니다. v0.2.0에서 추가된 `self_check`, `rubric_scores`, `state_verification`이 gate에 더 풍부한 신호를 줍니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `worker` | `string` | 이 근거를 만든 에이전트 이름 |
| `type` | `string` (enum) | 근거 카테고리 |
| `summary` | `string` | 한 일과 주요 결정에 대한 간략한 요약 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `files_changed` | `array<string>` | 생성하거나 수정한 파일 경로 |
| `verify_results` | `object` | 기계적 검증 결과 (build, lint, test, typecheck) |
| `criteria_results` | `array<object>` | TaskContract 인수 기준별 평가 |
| `screenshots` | `array<string>` | 스크린샷 파일 경로 (UI 작업 시) |
| `issues_found` | `array<object>` | 리뷰, QA, 보안 감사 중 발견한 이슈 |
| `tech_debt` | `array<object>` | 발견한 기술 부채입니다. 차단 요소는 아니지만 추적이 필요합니다. |
| `self_check` | `object` | worker의 솔직한 자기 평가입니다. Sentinel이 어디에 집중할지 참고합니다. |
| `rubric_scores` | `array<object>` | 평가자가 매긴 rubric 차원 점수 |
| `state_verification` | `object` | 상태 기반 QA 결과입니다. UI 표면 너머의 API 응답, DB 상태를 확인합니다. |
| `notes` | `string` | 추가 컨텍스트나 관찰 사항 |

#### `verify_results` 속성

네 가지 검사 필드가 같은 enum을 씁니다.

| 필드 | 값 | 설명 |
|---|---|---|
| `build` | `"pass"` \| `"fail"` \| `"skip"` | 빌드 검사 결과 |
| `lint` | `"pass"` \| `"fail"` \| `"skip"` | 린트 검사 결과 |
| `test` | `"pass"` \| `"fail"` \| `"skip"` | 테스트 스위트 결과 |
| `typecheck` | `"pass"` \| `"fail"` \| `"skip"` | 타입 검사 결과 |

#### `criteria_results` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `criterion` | `string` | 예 | 인수 기준 텍스트 |
| `met` | `boolean` | 예 | 기준 충족 여부 |
| `evidence` | `string` | 아니오 | 판단을 뒷받침하는 구체적 근거 |

#### `issues_found` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | 예 | `"critical"` \| `"major"` \| `"minor"` \| `"suggestion"` |
| `description` | `string` | 예 | 이슈 설명 |
| `file` | `string` | 아니오 | 이슈가 있는 파일 경로 |
| `line` | `integer` | 아니오 | 이슈가 있는 라인 번호 |

#### `tech_debt` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | 예 | `"HIGH"` \| `"MEDIUM"` \| `"LOW"` |
| `title` | `string` | 예 | 부채 항목의 짧은 레이블 |
| `description` | `string` | 아니오 | 부채 설명 |

#### `self_check` 구조 (v0.2.0)

`self_check`는 `additionalProperties: false`인 선택 객체입니다. 안에 있는 필수 필드는 `known_risks`, `untested_paths`, `confidence`입니다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `known_risks` | `array<string>` | 예 | worker가 인식하는 구현상 위험 |
| `untested_paths` | `array<string>` | 예 | worker가 테스트하지 않은 코드 경로 |
| `confidence` | `integer` (1-5) | 예 | worker의 자기 평가 신뢰도입니다. 2 이하이면 Evidence Gate가 rubric threshold를 더 엄격하게 적용합니다. |
| `possible_stubs` | `array<string>` | 아니오 | 스텁이나 플레이스홀더로 남겨둔 구현 |
| `what_i_would_test_next` | `array<string>` | 아니오 | QA가 우선 확인할 만한 테스트 영역 |

#### `rubric_scores` 항목 구조 (v0.2.0)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `dimension` | `string` | 예 | 차원 이름입니다. TaskContract rubric의 차원과 일치해야 합니다. |
| `score` | `integer` (1-5) | 예 | 평가자가 부여한 점수 |
| `rationale` | `string` | 아니오 | 점수에 대한 간략한 근거 |

Evidence Gate는 각 `score`를 TaskContract `rubric`의 `threshold`와 비교합니다. threshold 미달인 차원이 있으면 Tier 3 진입이 막힙니다.

#### `state_verification` 구조 (v0.2.0)

`state_verification`은 `additionalProperties: false`인 선택 객체입니다. UI 표면으로 확인할 수 없는 상태 기반 QA 결과를 기록합니다.

**`api_checks` 항목:**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `endpoint` | `string` | 예 | 테스트한 API 엔드포인트 |
| `expected_status` | `integer` | 예 | 예상 HTTP 상태 코드 |
| `actual_status` | `integer` | 예 | 실제 HTTP 상태 코드 |
| `pass` | `boolean` | 예 | 통과 여부 |
| `notes` | `string` | 아니오 | 응답에 대한 추가 메모 |

**`db_checks` 항목:**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `description` | `string` | 예 | 무엇을 검증했는지 |
| `pass` | `boolean` | 예 | 통과 여부 |
| `query` | `string` | 아니오 | 실행한 읽기 전용 쿼리 |
| `expected` | `string` | 아니오 | 예상 결과 |
| `actual` | `string` | 아니오 | 실제 결과 |

#### `type` enum 값

`"design"` | `"implementation"` | `"review"` | `"qa"` | `"security"` | `"performance"` | `"documentation"` | `"product-review"`

#### 주요 관계

- `task_id`로 상위 TaskContract에 연결됩니다.
- `rubric_scores`는 TaskContract의 `rubric`과 비교합니다.
- `self_check.confidence`가 Evidence Gate 채점 threshold에 영향을 줍니다.
- `state_verification`은 `verify_results`(기계적)와 `criteria_results`(의미적)를 보완합니다.
- 하나의 `task_id`에 여러 EvidenceBundle이 있을 수 있습니다. 각각 다른 에이전트 역할에서 나옵니다.

---

### 6. DecisionRecord

**위치:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

**목적:** 아키텍처, 제품, 에스컬레이션 결정의 영구 기록입니다. 대화에서 흘러가 버리는 토론 대신 구조화된 결정을 남깁니다.

DecisionRecord는 vote-round나 debate 스킬 실행 끝에 씁니다. 무엇을, 왜, 누가 결정했는지 기록합니다. 이전 결정을 뒤집으면 `supersedes`로 이력을 추적할 수 있습니다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 결정 식별자 (예: `"dec-001"`) |
| `title` | `string` | 결정을 설명하는 짧은 제목 |
| `context` | `string` | 이 결정이 필요한 이유입니다. 문제나 트리거를 적습니다. |
| `decision` | `string` | 선택한 옵션과 구체적 의미 |
| `reasoning` | `string` | 대안 대신 이 옵션을 선택한 이유 |
| `decided_by` | `string` | 최종 결정을 내린 에이전트 (예: `"nova"`, `"forge"`) |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `options` | `array<object>` | 결정 전에 고려한 옵션 |
| `trade_offs` | `string` | 팀이 포기하거나 위험으로 받아들인 것 |
| `participants` | `array<string>` | 토론에 참여한 에이전트 |
| `related_task_id` | `string` | 관련 TaskContract ID (있는 경우) |
| `supersedes` | `string` | 이 결정이 대체하는 이전 DecisionRecord ID |

#### `options` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | `string` | 예 | 옵션의 짧은 레이블 |
| `description` | `string` | 예 | 옵션 설명 |
| `pros` | `array<string>` | 아니오 | 찬성 논거 |
| `cons` | `array<string>` | 아니오 | 반대 논거 |

#### enum과 제약

enum 없습니다. `additionalProperties`는 스키마 수준에서 제한하지 않습니다.

#### 주요 관계

- `related_task_id`로 TaskContract에 연결할 수 있습니다. 보통 Evidence Gate 에스컬레이션으로 결정이 생길 때 씁니다.
- `supersedes`로 뒤집힌 결정의 이력을 추적합니다.
- `.geas/memory/_project/decisions/`에 영구 프로젝트 기록으로 저장됩니다.
- `vote-round`과 `debate` 스킬이 만듭니다.

---

## v0.2.0 추가 필드

아래 필드들이 v0.2.0에서 추가됐습니다. rubric 기반 품질 채점, worker 자기 진단, 상태 기반 QA 검증, 다중 모드 seed 추적을 위한 것입니다.

### TaskContract의 `rubric` (필수)

**스키마:** TaskContract
**타입:** `array<object>`
**상태:** 필수

v0.2.0에서 필수 필드가 됐습니다. 모든 TaskContract는 평가 에이전트와 최소 통과 threshold가 있는 품질 차원을 1개 이상 정의해야 합니다. Evidence Gate가 이 threshold로 Tier 3 승인 여부를 판단합니다. 이 필드가 필수가 되기 전에 만든 TaskContract는 재생성해야 합니다.

### EvidenceBundle의 `self_check` (선택 객체)

**스키마:** EvidenceBundle
**타입:** `object`
**상태:** 선택입니다. 다만 구현 번들에는 강력히 권장합니다.

worker가 근거를 내기 전에 솔직하게 자기를 진단한 결과입니다. `confidence`(self_check 안에서 필수)가 Evidence Gate 동작에 직접 영향을 줍니다. 2 이하이면 Sentinel이 rubric threshold를 더 엄격하게 적용합니다. `untested_paths`와 `what_i_would_test_next`는 Sentinel이 QA 초점을 잡는 데 참고합니다.

### EvidenceBundle의 `rubric_scores` (선택 배열)

**스키마:** EvidenceBundle
**타입:** `array<object>`
**상태:** 선택입니다. Tier 3 gate 통과에는 필수입니다.

평가자(QA 차원은 Sentinel, 코드 품질 차원은 Forge)가 채점 후 이 배열을 채웁니다. Evidence Gate가 모든 `rubric_scores`를 모아서 각 `score`를 TaskContract `rubric`의 `threshold`와 비교합니다. 필수 차원의 점수가 빠져 있으면 gate 실패입니다.

### EvidenceBundle의 `state_verification` (선택 객체)

**스키마:** EvidenceBundle
**타입:** `object`
**상태:** 선택입니다. API나 DB 인수 기준이 있는 태스크에는 필수입니다.

`verify_results`(셸 명령어)나 `criteria_results`(에이전트 관찰)로 잡을 수 없는 상태 기반 QA를 구조화해서 기록합니다. `api_checks`는 실제 HTTP 응답을, `db_checks`는 읽기 전용 DB 쿼리와 결과를 담습니다. 둘 다 Evidence Gate에 감사 가능하고 기계 판독 가능한 시스템 상태 근거를 줍니다.

### TaskContract의 `scope_out` (선택 배열)

**스키마:** TaskContract
**타입:** `array<string>`
**상태:** 선택

태스크 수준에서 seed의 `scope_out`을 미러링합니다. `prohibited_paths`가 파일 수준 접근을 제한한다면, `scope_out`은 기능 수준 제외입니다. worker가 전체 seed를 다시 읽지 않아도 태스크 내 범위 확대를 막을 수 있습니다.

### Seed의 `source` (선택 문자열 enum)

**스키마:** Seed
**타입:** `string` enum: `"initiative"` | `"sprint"`
**상태:** 선택

seed를 만든 실행 모드를 추적합니다. `"sprint"` seed는 자동 생성된 최소한의 seed입니다. `"initiative"` 전체 실행으로 덮어쓸 수 있습니다. sprint로 시작한 프로젝트에 제대로 된 intake이 필요한지 시스템이 판단할 때 씁니다.
