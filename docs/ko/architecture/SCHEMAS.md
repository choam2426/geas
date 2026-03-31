# 스키마 참조

JSON Schema(draft 2020-12) 파일 여섯 개가 Geas 컴포넌트 간 데이터 계약을 정의한다. 각 스키마는 에이전트가 무엇을 만들고, 무엇을 받고, 무엇을 넘기는지를 강제하는 기계 판독 가능한 합의다. 이 문서가 여섯 스키마 전체의 공식 참조다.

---

## 개요

| 스키마 | 파일 | 생성 주체 | 소비 주체 |
|---|---|---|---|
| Seed | `seed.schema.json` | intake skill | task-compiler |
| TaskContract | `task-contract.schema.json` | task-compiler | context-packet, implementation-contract, evidence-gate |
| ContextPacket | `context-packet.schema.json` | context-packet skill | worker agents |
| ImplementationContract | `implementation-contract.schema.json` | worker agent | Sentinel, Forge (승인) |
| EvidenceBundle | `evidence-bundle.schema.json` | worker/reviewer agents | evidence-gate |
| DecisionRecord | `decision-record.schema.json` | vote-round / debate skill | 영구 결정 로그 |

모든 스키마는 `"additionalProperties": false`(해당되는 경우)를 써서 문서화되지 않은 필드가 파이프라인에 몰래 들어오는 걸 막는다.

---

## 스키마 관계도

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

**목적:** intake skill이 만든 미션 스펙을 실행 시작 전에 동결한다.

Seed는 사람 이해관계자와 에이전트 팀 사이의 계약이다. 유효한 Seed가 디스크에 없으면 task compilation을 시작할 수 없다. 범위를 의식적으로 검토했는지(`scope_out` 항목 최소 1개 필수), 인수 기준이 구체적인지(최소 3개), 모든 섹션을 `completeness_checklist`로 리뷰했는지를 강제한다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `mission` | `string` | 정제된 명확한 미션 선언문 |
| `acceptance_criteria` | `array<string>` | "완료"를 정의하는 측정 가능한 기준. 최소 3개. |
| `scope_in` | `array<string>` | 명시적으로 포함하는 기능. 최소 1개. |
| `scope_out` | `array<string>` | 명시적으로 제외하는 기능. 최소 1개. 범위를 의식적으로 검토했다는 증거다. |
| `completeness_checklist` | `object` | 각 섹션을 사용자가 리뷰 및 승인했는지 확인하는 boolean 체크리스트 |
| `created_at` | `string` (date-time) | seed 동결 시점의 ISO 8601 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `target_user` | `string` | 주요 사용자 페르소나 또는 대상 |
| `constraints` | `array<string>` | 기술적/비즈니스 제약 (예: "관계형 DB 필수") |
| `assumptions` | `array<string>` | intake 중 사용자가 확인한 가정 |
| `ambiguity_notes` | `array<string>` | 인정했지만 보류한 모호한 점 + 근거 |
| `source` | `string` (enum) | 이 seed를 만든 모드. 아래 enum 참조. |
| `readiness_override` | `boolean` | 사용자가 intake을 건너뛰었으면 true ("그냥 만들어") |

#### `completeness_checklist` 속성

| 필드 | 타입 | 설명 |
|---|---|---|
| `mission` | `boolean` | 미션 섹션 리뷰 여부 |
| `acceptance_criteria` | `boolean` | 인수 기준 리뷰 여부 |
| `scope_out` | `boolean` | scope-out 섹션 리뷰 여부 |
| `target_user` | `boolean` | 대상 사용자 리뷰 여부 |
| `constraints` | `boolean` | 제약 사항 리뷰 여부 |

#### Enum과 제약

- `source`: `"initiative"` | `"sprint"` -- 어떤 모드가 seed를 만들었는지 추적한다. `"sprint"`는 최소한으로 자동 생성된 seed라는 뜻이다. Initiative 실행 시 sprint에서 만든 seed를 덮어쓸 수 있다.
- `acceptance_criteria`: 최소 3개
- `scope_in`: 최소 1개
- `scope_out`: 최소 1개

#### 주요 관계

- `intake` skill이 생성하여 `.geas/memory/_project/seed.json`에 기록한다
- `task-compiler`가 미션, 제약, 인수 기준의 진실 공급원으로 읽는다
- `source` 필드는 v0.2.0에서 sprint와 initiative 출처 구분용으로 추가되었다

---

### 2. TaskContract

**위치:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

**목적:** worker가 무엇을 납품해야 하는지 정의하는 기계 판독 가능한 계약이다. 모호한 이슈 설명 대신 검증 가능한 합의를 쓴다.

TaskContract는 Geas의 작업 중심 단위다. 이후의 모든 산출물 -- ContextPacket, ImplementationContract, EvidenceBundle -- 이 TaskContract의 `task_id`를 참조한다. `rubric` 필드(v0.2.0부터 필수)는 태스크가 Evidence Gate의 Tier 3를 통과하기 전에 점수를 매겨야 할 품질 차원을 정의한다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 태스크 식별자 (예: `"task-001"`) |
| `title` | `string` | 사람이 읽을 수 있는 태스크 제목 |
| `goal` | `string` | 이 태스크가 달성해야 할 것. 검증 가능한 결과로 기술한다 |
| `assigned_worker` | `string` | 구현 담당 에이전트 (예: `"pixel"`, `"circuit"`) |
| `acceptance_criteria` | `array<string>` | seed와 스토리에서 파생된 구체적이고 검증 가능한 기준 |
| `eval_commands` | `array<string>` | 태스크를 기계적으로 검증하는 셸 명령어 |
| `rubric` | `array<object>` | 품질 rubric 차원 + 점수 임곗값. 전부 통과해야 Tier 3에 진입한다. |
| `status` | `string` (enum) | 태스크의 현재 생명주기 상태 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `reviewer` | `string` | 리뷰 담당 에이전트 (예: `"forge"`) |
| `prohibited_paths` | `array<string>` | worker가 수정하면 안 되는 파일/디렉토리 경로 |
| `dependencies` | `array<string>` | 이 태스크 시작 전에 완료되어야 하는 태스크 ID |
| `scope_out` | `array<string>` | 이 태스크에서 구현하지 않을 기능 수준 제외 사항. `prohibited_paths`(파일 수준)와 상호 보완한다. |
| `retry_budget` | `integer` | 에스컬레이션 전 최대 수정-검증 반복 횟수. 기본값: `3`. 범위: 1-5. |
| `escalation_policy` | `string` (enum) | 재시도 예산 소진 시 취할 조치. 기본값: `"forge-review"`. |

#### `rubric` 항목 구조

rubric 배열의 각 항목은 다음 필수 필드를 갖는다:

| 필드 | 타입 | 설명 |
|---|---|---|
| `dimension` | `string` | 품질 차원 이름 (예: `"core_interaction"`, `"code_quality"`) |
| `evaluator` | `string` (enum) | 점수를 매기는 에이전트: `"sentinel"` \| `"forge"` \| `"nova"` |
| `threshold` | `integer` | 통과에 필요한 최소 점수 (1-5). 이 값 미만이면 Tier 3 진입이 차단된다. |

#### Enum과 제약

- `status`: `"pending"` | `"in_progress"` | `"in_review"` | `"testing"` | `"passed"` | `"failed"` | `"escalated"`
- `escalation_policy`: `"forge-review"` | `"nova-decision"` | `"pivot"`
- `rubric[].evaluator`: `"sentinel"` | `"forge"` | `"nova"`
- `rubric[].threshold`: 정수, 1-5
- `retry_budget`: 정수, 1-5, 기본값 3

#### 주요 관계

- `task-compiler` skill이 Seed로부터 파생하여 생성한다
- `id`가 ContextPacket, ImplementationContract, EvidenceBundle의 `task_id`가 참조하는 외래 키다
- `acceptance_criteria`와 `eval_commands`가 ContextPacket에 복사된다
- `prohibited_paths`가 ContextPacket에 복사된다
- `rubric` 임곗값은 EvidenceBundle의 `rubric_scores`와 대조하여 평가한다
- `scope_out`은 v0.2.0에서 seed 수준 `scope_out`과 함께 추가되었다

---

### 3. ContextPacket

**위치:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

**목적:** worker를 위한 역할별 브리핑이다. "댓글 전부 읽어"가 아니라 초점이 맞춰진 압축된 컨텍스트 윈도우를 준다.

ContextPacket은 worker가 태스크를 시작하기 직전에 `context-packet` skill이 생성한다. TaskContract에서 관련 부분만 뽑아 -- 인수 기준, eval_commands, prohibited_paths -- 디자인 발췌, 기술 접근법 노트, 이전 근거 경로와 합친다. Worker는 ContextPacket과 자기 에이전트 정의만으로 태스크를 수행할 수 있어야 한다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `target_worker` | `string` | 이 패킷의 대상 에이전트 |
| `issue_summary` | `string` | 태스크가 뭔지 1-3문장 요약 |
| `acceptance_criteria` | `array<string>` | TaskContract에서 상속 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `design_excerpt` | `string` | Palette의 관련 디자인 결정 (해당 시) |
| `tech_approach` | `string` | Forge의 기술 접근법 (해당 시) |
| `prohibited_paths` | `array<string>` | TaskContract에서 상속 |
| `eval_commands` | `array<string>` | TaskContract에서 상속 |
| `known_risks` | `array<string>` | worker가 알아야 할 리스크나 엣지 케이스 |
| `prior_evidence` | `array<string>` | 파이프라인 이전 worker의 EvidenceBundle 파일 경로 |

#### Enum과 제약

별도 enum 없다. 스키마 수준에서 `additionalProperties`가 제한되지 않지만, 모든 필드가 명시적으로 정의되어 있다.

#### 주요 관계

- `context-packet` skill이 TaskContract를 읽어 생성한다
- `task_id`로 TaskContract에 연결된다
- `prior_evidence`에 EvidenceBundle 파일 경로가 들어있어, worker가 이전 산출물을 이어받을 수 있다
- 협업 스레드의 사람 댓글이 이 패킷을 채울 때 최우선 순위다

---

### 4. ImplementationContract

**위치:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

**목적:** 코드 작성 전에 worker와 리뷰어 사이에 맺는 사전 합의다. Worker가 제안한 접근법, 엣지 케이스 대응, 데모 절차를 담는다.

ImplementationContract는 구현 시작 전 게이트다. Worker가 구체적 행동 계획을 제안하고 리뷰어(Sentinel, Forge)가 승인한다. 가정이 어긋나서 구현을 헛되이 낭비하는 걸 막는다. TaskContract와는 다르다: TaskContract는 *무엇*을 해야 하는지, ImplementationContract는 *어떻게* 할 계획인지를 담는다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `worker` | `string` | 구현할 에이전트 (예: `"pixel"`, `"circuit"`) |
| `planned_actions` | `array<string>` | Worker가 수행할 구체적 행동. 최소 1개. |
| `edge_cases` | `array<string>` | Worker가 처리할 엣지 케이스. 최소 1개. |
| `non_goals` | `array<string>` | 이 구현에서 명시적으로 하지 않을 것. 범위 이탈 방지용. 최소 1개. |
| `demo_steps` | `array<string>` | 완료를 시연하고 검증하는 단계별 절차. 최소 1개. |
| `status` | `string` (enum) | 현재 승인 상태. 기본값: `"draft"`. |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `state_transitions` | `array<string>` | 구현이 도입할 상태 전이 (예: `"unauthenticated -> authenticated"`) |
| `approved_by` | `array<string>` | 계약을 승인한 에이전트 (예: `["sentinel", "forge"]`) |
| `approval_notes` | `string` | 승인 과정에서 리뷰어가 남긴 메모 |

#### Enum과 제약

- `status`: `"draft"` | `"in_review"` | `"approved"` | `"revision_requested"`
- `planned_actions`: 최소 1개
- `edge_cases`: 최소 1개
- `non_goals`: 최소 1개
- `demo_steps`: 최소 1개

#### 주요 관계

- `task_id`로 상위 TaskContract에 연결된다
- `status: "approved"` 상태에 도달해야 worker가 구현을 시작할 수 있다
- `demo_steps`는 Sentinel이 QA 시 완료 검증에 재사용한다
- `non_goals`는 구현 전략 수준에서 TaskContract의 `scope_out` 및 `prohibited_paths`를 보완한다
- v0.2.0에서 새 스키마로 도입되었다

---

### 5. EvidenceBundle

**위치:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`

**목적:** worker의 구조화된 산출물이다. 리뷰어와 Evidence Gate가 태스크 완료를 판정하는 데 필요한 모든 근거를 담는다.

EvidenceBundle은 파이프라인에서 작업하는 모든 에이전트 역할의 주요 산출물이다. 구현자, 리뷰어, QA, 보안 감사 등 작업을 수행하는 에이전트는 전부 EvidenceBundle을 제출한다. Evidence Gate가 번들을 모아 세 단계 검증을 돌린다. v0.2.0 추가 필드(`self_check`, `rubric_scores`, `state_verification`)가 gate에 더 풍부한 신호를 준다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `task_id` | `string` | 상위 TaskContract 참조 |
| `worker` | `string` | 이 근거를 작성한 에이전트 |
| `type` | `string` (enum) | 근거 카테고리 |
| `summary` | `string` | 수행 내용과 주요 결정 요약 |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `files_changed` | `array<string>` | 생성 또는 수정한 파일 경로 목록 |
| `verify_results` | `object` | 기계적 검증 결과 (build, lint, test, typecheck) |
| `criteria_results` | `array<object>` | TaskContract 인수 기준 대비 항목별 평가 |
| `screenshots` | `array<string>` | 스크린샷 파일 경로 (UI 작업 시) |
| `issues_found` | `array<object>` | 리뷰, QA, 보안 감사 중 발견한 이슈 |
| `tech_debt` | `array<object>` | 식별한 기술 부채 -- 차단 사항은 아니지만 추적 필요 |
| `self_check` | `object` | Worker의 솔직한 자기 평가. Sentinel이 테스트 초점을 잡는 데 참고한다 |
| `rubric_scores` | `array<object>` | 평가자가 매긴 rubric 차원별 점수 |
| `state_verification` | `object` | 상태 기반 QA 결과 -- UI 표면 테스트 너머의 API 응답과 DB 상태 |
| `notes` | `string` | 추가 맥락이나 관찰 |

#### `verify_results` 속성

네 가지 검사 필드 모두 동일한 enum을 쓴다:

| 필드 | 값 | 설명 |
|---|---|---|
| `build` | `"pass"` \| `"fail"` \| `"skip"` | 빌드 검사 결과 |
| `lint` | `"pass"` \| `"fail"` \| `"skip"` | 린트 검사 결과 |
| `test` | `"pass"` \| `"fail"` \| `"skip"` | 테스트 스위트 결과 |
| `typecheck` | `"pass"` \| `"fail"` \| `"skip"` | 타입 검사 결과 |

#### `criteria_results` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `criterion` | `string` | O | 인수 기준 텍스트 |
| `met` | `boolean` | O | 기준 충족 여부 |
| `evidence` | `string` | X | 판정을 뒷받침하는 구체적 근거 |

#### `issues_found` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | O | `"critical"` \| `"major"` \| `"minor"` \| `"suggestion"` |
| `description` | `string` | O | 이슈 설명 |
| `file` | `string` | X | 이슈가 발견된 파일 경로 |
| `line` | `integer` | X | 이슈의 줄 번호 |

#### `tech_debt` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `severity` | `string` (enum) | O | `"HIGH"` \| `"MEDIUM"` \| `"LOW"` |
| `title` | `string` | O | 부채 항목의 짧은 라벨 |
| `description` | `string` | X | 부채에 대한 설명 |

#### `self_check` 구조 (v0.2.0)

`self_check`는 `additionalProperties: false`인 선택 객체다. 내부 필수 필드: `known_risks`, `untested_paths`, `confidence`.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `known_risks` | `array<string>` | O | Worker가 구현에서 인지한 리스크 |
| `untested_paths` | `array<string>` | O | Worker가 테스트하지 않은 코드 경로 |
| `confidence` | `integer` (1-5) | O | Worker의 자기 확신도. 2 이하이면 Evidence Gate에서 rubric 임곗값이 올라간다. |
| `possible_stubs` | `array<string>` | X | 스텁이나 플레이스홀더로 남긴 구현 |
| `what_i_would_test_next` | `array<string>` | X | QA가 우선 테스트하면 좋을 영역 제안 |

#### `rubric_scores` 항목 구조 (v0.2.0)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `dimension` | `string` | O | 차원 이름. TaskContract rubric의 dimension과 대응한다 |
| `score` | `integer` (1-5) | O | 평가자가 매긴 점수 |
| `rationale` | `string` | X | 점수에 대한 간단한 근거 |

Evidence Gate가 각 `score`를 TaskContract `rubric`의 해당 `threshold`와 비교한다. 임곗값 미만인 차원이 하나라도 있으면 Tier 3 진입이 차단된다.

#### `state_verification` 구조 (v0.2.0)

`state_verification`은 `additionalProperties: false`인 선택 객체다. UI 표면에서 관찰할 수 없는 상태 기반 QA 결과를 담는다.

**`api_checks` 항목:**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `endpoint` | `string` | O | 테스트한 API 엔드포인트 |
| `expected_status` | `integer` | O | 기대 HTTP 상태 코드 |
| `actual_status` | `integer` | O | 실제 반환된 HTTP 상태 코드 |
| `pass` | `boolean` | O | 검사 통과 여부 |
| `notes` | `string` | X | 응답에 대한 추가 메모 |

**`db_checks` 항목:**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `description` | `string` | O | 검증 대상 |
| `pass` | `boolean` | O | 검사 통과 여부 |
| `query` | `string` | X | 실행한 읽기 전용 쿼리 |
| `expected` | `string` | X | 기대 결과 |
| `actual` | `string` | X | 실제 결과 |

#### `type` Enum 값

`"design"` | `"implementation"` | `"review"` | `"qa"` | `"security"` | `"performance"` | `"documentation"` | `"product-review"`

#### 주요 관계

- `task_id`로 상위 TaskContract에 연결된다
- `rubric_scores`는 TaskContract의 `rubric`과 대조하여 평가한다
- `self_check.confidence`가 Evidence Gate 점수 임곗값에 영향을 준다
- `state_verification`은 `verify_results`(기계적)와 `criteria_results`(의미적)를 보완한다
- 하나의 `task_id`에 여러 EvidenceBundle이 있을 수 있다. 에이전트 역할마다 하나씩 생성한다

---

### 6. DecisionRecord

**위치:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

**목적:** 아키텍처, 제품, 에스컬레이션 결정의 영구 기록이다. 휘발되는 토론 댓글 대신 구조화되고 추적 가능한 결정을 남긴다.

DecisionRecord는 vote-round이나 debate skill 실행이 끝나면 작성된다. 무엇을 결정했는지, 왜, 누가 결정했는지를 담는다. 대화 스레드에만 존재하던 결정의 영구 감사 추적을 만든다. 팀이 방향을 뒤집으면 이전 DecisionRecord를 대체(supersede)할 수 있다.

#### 필수 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `version` | `string` (const `"1.0"`) | 스키마 버전 |
| `id` | `string` | 고유 결정 식별자 (예: `"dec-001"`) |
| `title` | `string` | 결정을 설명하는 짧은 제목 |
| `context` | `string` | 이 결정이 필요했던 이유 -- 문제나 트리거 |
| `decision` | `string` | 선택한 옵션과 그것이 구체적으로 뜻하는 바 |
| `reasoning` | `string` | 다른 대안 대신 이 옵션을 선택한 이유 |
| `decided_by` | `string` | 최종 결정을 내린 에이전트 (예: `"nova"`, `"forge"`) |
| `created_at` | `string` (date-time) | ISO 8601 생성 타임스탬프 |

#### 선택 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `options` | `array<object>` | 결정 전 검토한 선택지 |
| `trade_offs` | `string` | 팀이 포기하거나 리스크로 감수하는 것 |
| `participants` | `array<string>` | 토론에 참여한 에이전트 |
| `related_task_id` | `string` | 이 결정과 관련된 TaskContract ID (있으면) |
| `supersedes` | `string` | 이 결정이 대체하는 이전 DecisionRecord ID |

#### `options` 항목 구조

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `name` | `string` | O | 선택지의 짧은 라벨 |
| `description` | `string` | O | 선택지 설명 |
| `pros` | `array<string>` | X | 찬성 근거 |
| `cons` | `array<string>` | X | 반대 근거 |

#### Enum과 제약

별도 enum 없다. 스키마 수준에서 `additionalProperties`가 제한되지 않는다.

#### 주요 관계

- `related_task_id`로 TaskContract에 선택적으로 연결된다. 보통 Evidence Gate의 에스컬레이션이 결정을 촉발한 경우다
- `supersedes`로 번복된 결정의 이력을 추적할 수 있다
- `.geas/memory/_project/decisions/`에 영구 프로젝트 히스토리로 기록된다
- `vote-round`과 `debate` skill이 생성한다

---

## v0.2.0에서 추가된 필드

아래 필드들이 v0.2.0 스키마에 추가되었다. rubric 기반 품질 채점, worker 자기 평가, 상태 기반 QA 검증, 멀티 모드 seed 추적을 구현한다.

### TaskContract의 `rubric` (필수)

**스키마:** TaskContract
**타입:** `array<object>`
**상태:** 필수

v0.2.0에서 필수 필드로 추가되었다. 모든 TaskContract는 이제 하나 이상의 품질 차원을 정의해야 하며, 각 차원에 평가 에이전트와 최소 통과 임곗값을 지정한다. Evidence Gate가 이 임곗값으로 Tier 3 승인을 결정한다. 이 필드가 필수화되기 전에 컴파일된 태스크는 재생성해야 한다.

### EvidenceBundle의 `self_check` (선택 객체)

**스키마:** EvidenceBundle
**타입:** `object`
**상태:** 선택이지만 구현 번들에서는 강력 권장

Worker가 근거를 제출하기 전에 작성하는 솔직한 자기 평가다. `confidence`(self_check 내 필수)가 Evidence Gate 동작에 직접 영향을 준다: 2 이하이면 Sentinel에게 rubric 임곗값을 올리라는 신호다. `untested_paths`와 `what_i_would_test_next`는 Sentinel이 독자적으로 찾지 않아도 QA 초점을 잡을 수 있게 안내한다.

### EvidenceBundle의 `rubric_scores` (선택 배열)

**스키마:** EvidenceBundle
**타입:** `array<object>`
**상태:** 선택이지만 Tier 3 gate 통과에는 필수

평가자(QA 차원은 Sentinel, 코드 품질 차원은 Forge)가 작업 채점 후 이 배열을 채운다. Evidence Gate가 모든 `rubric_scores`를 모아 TaskContract `rubric`의 해당 `threshold`와 비교한다. 필수 차원의 점수가 빠져 있으면 gate 실패로 처리한다.

### EvidenceBundle의 `state_verification` (선택 객체)

**스키마:** EvidenceBundle
**타입:** `object`
**상태:** 선택이지만 API나 DB 인수 기준이 있는 태스크에서는 필수

`verify_results`(셸 명령어 실행)나 `criteria_results`(에이전트 관찰 기반)로 잡을 수 없는 상태 기반 QA의 구조화된 기록이다. `api_checks`는 실제 HTTP 응답을, `db_checks`는 읽기 전용 DB 쿼리와 결과를 기록한다. 둘 다 Evidence Gate에 감사 가능하고 기계 판독 가능한 시스템 상태 근거를 준다.

### TaskContract의 `scope_out` (선택 배열)

**스키마:** TaskContract
**타입:** `array<string>`
**상태:** 선택

태스크 수준에서 seed의 `scope_out`을 반영한다. `prohibited_paths`가 파일 수준 접근을 제한하는 반면, `scope_out`은 이 특정 태스크의 기능 수준 제외를 표현한다. Worker가 전체 seed를 다시 읽지 않아도 태스크 내 범위 이탈을 방지한다.

### Seed의 `source` (선택 string enum)

**스키마:** Seed
**타입:** `string` enum: `"initiative"` | `"sprint"`
**상태:** 선택

어떤 실행 모드가 seed를 만들었는지 추적한다. `"sprint"` seed는 자동 생성된 최소 버전이며, 전체 `"initiative"` 실행이 덮어쓸 수 있다. 스프린트로 시작한 프로젝트가 제대로 된 intake을 거쳐야 하는지 시스템이 감지할 수 있게 한다.
