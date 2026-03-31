# 거버넌스와 평가

Geas의 품질 보증과 거버넌스 시스템을 다룹니다. Evidence Gate, rubric 채점, Implementation Contract, worker self-check, 상태 기반 QA, vote round, decision record, 에스컬레이션 경로.

---

## Evidence Gate (3단계)

Evidence Gate는 "완료 = 계약 이행"을 강제합니다. "에이전트가 했다고 말한다"가 아닙니다. 모든 작업은 Nova의 제품 검토로 넘어가기 전에 게이트를 통과해야 합니다. Compass가 worker의 EvidenceBundle을 수집한 후 게이트를 호출합니다.

```
Tier 1: Mechanical  →  Tier 2: Semantic + Rubric  →  Tier 3: Product
(build/lint/test)       (criteria + 채점)              (Nova ship/iterate/cut)
```

### Tier 1: Mechanical

TaskContract에 정의된 `eval_commands`를 실행하고 exit code를 확인합니다.

각 명령에 대해:
- **pass** — exit 0
- **fail** — exit 0이 아님 (에러 출력 캡처)
- **skip** — 해당 없음 또는 미설정

첫 실패에서 멈춥니다. 빌드가 안 되는 코드에 semantic 검사를 돌리는 건 낭비입니다. EvidenceBundle에 이전 실행의 `verify_results`가 있으면 명령을 다시 돌리고 최신 결과를 씁니다.

`eval_commands`가 있는데 실행하지 않는 것 자체가 게이트 위반입니다. 명령이 없으면 모든 결과를 `"skip"`으로 기록합니다.

### Tier 2: Semantic + Rubric

두 파트로 나뉩니다. 둘 다 통과해야 합니다.

**파트 A: Acceptance Criteria**

TaskContract의 `acceptance_criteria` 각 항목에 대해:
1. worker의 evidence를 읽습니다 (summary, files_changed, criteria_results).
2. worker가 `criteria_results`를 제공했으면 evidence와 대조해 자기 평가를 검증합니다.
3. 없으면 변경된 파일, 테스트 결과, 코드 검사에서 추론합니다.
4. 기록: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

모든 기준을 충족해야 파트 B로 넘어갑니다.

**파트 B: Rubric 채점**

평가자(Sentinel, Forge)가 TaskContract의 rubric 차원을 읽고 각각 1~5점을 매깁니다. 게이트가 평가자의 EvidenceBundle에서 점수를 읽어 차원별 임계값과 비교합니다.

임계값 미만인 차원이 있으면 Tier 2가 실패합니다. 게이트 판정의 `blocking_dimensions`가 verify-fix-loop에 어떤 차원을 고쳐야 하는지 정확히 알려줍니다.

```json
{
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "evaluator": "sentinel", "threshold": 3, "pass": true },
    { "dimension": "code_quality", "score": 3, "evaluator": "forge", "threshold": 4, "pass": false }
  ],
  "rubric_pass": false,
  "blocking_dimensions": ["code_quality"]
}
```

**임계값 조정 (낮은 confidence)**

worker의 `self_check.confidence`가 2 이하면 모든 rubric 임계값에 +1을 더합니다. 자기 구현을 불확실하다고 평가한 worker는 더 엄격한 검토를 받습니다. 자동으로 적용됩니다. 수동 설정이 필요 없습니다.

**Stub 확인**

worker의 `self_check.possible_stubs`가 비어 있지 않으면 해당 파일이 플레이스홀더로 남아 있지 않은지 확인합니다. 확인된 stub이 있으면 `feature_completeness`를 최대 2점으로 제한합니다. 평가자가 뭐라고 했든 상관없습니다.

### Tier 3: Product

Nova를 생성해 ship/iterate/cut 판정을 받습니다. 다음 경우에만 실행합니다:
- 기능 완성 (사용자에게 보이는 기능을 내놓는 작업)
- 단계 완성 (MVP, Polish, Evolution 종료)
- pivot 결정

Nova는 작업 목표, 모든 evidence bundle, Tier 2의 criteria 결과, seed.json의 미션 컨텍스트를 받습니다.

Nova의 판정:
- **Ship** — 모든 기준 충족, 좋은 품질, 미션에 부합
- **Iterate** — 부분적으로 충족. Nova가 구체적 피드백을 줍니다. worker의 다음 ContextPacket이 됩니다. retry budget에서 차감됩니다.
- **Cut** — 근본적으로 맞지 않거나 고칠 가치가 없음

### 게이트 수준

모든 작업에 3단계 전부가 필요하지는 않습니다:

| 상황 | 실행 tier |
|------|----------|
| 구현 작업 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 spec (코드 없음) | Tier 2만 |
| 기능 완성 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge) | Tier 2만 |
| QA 테스팅 (Sentinel) | Tier 1 + Tier 2 |
| 보안 검토 (Shield) | Tier 2만 |
| 단계 완성 | Tier 1 + Tier 2 + Tier 3 |

### 게이트 판정 구조

```json
{
  "task_id": "task-003",
  "verdict": "pass | fail | iterate",
  "tiers": {
    "mechanical": { "status": "pass", "results": {} },
    "semantic": {
      "status": "pass",
      "criteria_met": 5,
      "criteria_total": 5,
      "rubric_pass": true,
      "rubric_scores": [],
      "blocking_dimensions": []
    },
    "product": { "status": "ship", "nova_notes": "..." }
  },
  "failures": [],
  "timestamp": "..."
}
```

---

## Rubric 시스템

모든 작업에 구조화된 품질 점수를 매기는 시스템입니다. 지정된 평가자가 점수를 매기고, 게이트가 Tier 2 통과 전에 차원별 임계값과 비교합니다.

### 기본 차원

모든 구현 작업에 적용됩니다:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|-------|:---------:|------|
| `core_interaction` | Sentinel | 3 | 1-5 |
| `feature_completeness` | Sentinel | 4 | 1-5 |
| `code_quality` | Forge | 4 | 1-5 |
| `regression_safety` | Sentinel | 4 | 1-5 |

### UI 차원

UI 작업에 추가됩니다:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|-------|:---------:|------|
| `ux_clarity` | Sentinel | 3 | 1-5 |
| `visual_coherence` | Sentinel | 3 | 1-5 |

### 누가 뭘 채점하는가

**Sentinel**은 `code_quality`를 뺀 전부를 채점합니다: `core_interaction`, `feature_completeness`, `regression_safety`, `ux_clarity`, `visual_coherence`. E2E 테스팅, 사용자 관점 테스팅, 상태 검증 기반의 QA 도메인 평가입니다.

**Forge**는 `code_quality`만 채점합니다. 모든 구현 후 필수 코드 리뷰에서 나옵니다. 점수 기준:
- **5**: 깔끔하고, 잘 구조화되어 있고, 컨벤션을 따르고, 문제 없음
- **4**: 좋은 품질, 사소한 제안만
- **3**: 허용 가능하지만 눈에 띄는 이슈
- **2**: 상당한 품질 우려
- **1**: 근본적인 문제

### 임계값 적용

TaskContract의 `rubric` 배열에서 각 차원에 `threshold` 필드가 있습니다. Evidence Gate가 평가자 점수와 비교합니다. `score < threshold`인 차원은 차단 요소입니다. 게이트 판정의 `blocking_dimensions` 배열에 실패한 차원이 나열됩니다.

모든 rubric 차원이 임계값을 넘어야 Tier 3(Nova 제품 검토)에 도달합니다.

### 임계값 조정

worker의 `self_check.confidence`가 2 이하면 모든 임계값이 1 올라갑니다. 자기가 불확실하다고 평가한 작업에 더 엄격한 검토가 적용됩니다. 평가자가 아닌 Evidence Gate가 적용합니다.

예: worker가 `code_quality` 임계값=4인 작업에 confidence=2를 보고하면, 게이트는 임계값=5로 평가합니다.

### 경매 플랫폼 테스트 성적표

실시간 경매 플랫폼 테스트(US-01, 입찰 엔진 구현)의 성적표입니다:

| 차원 | 점수 | 임계값 | 평가자 | 통과 |
|------|:----:|:------:|-------|:----:|
| `core_interaction` | 4 | 3 | Sentinel | yes |
| `feature_completeness` | 4 | 4 | Sentinel | yes |
| `code_quality` | 4 | 4 | Forge | yes |
| `regression_safety` | 3 | 4 | Sentinel | no |

`blocking_dimensions: ["regression_safety"]` — Tier 3로 가기 전에 regression safety를 목표로 verify-fix-loop에 진입했습니다.

---

## Implementation Contract

### 목적

worker가 요구사항을 오해해서 잘못 만들고 QA가 잡아내는 재작업 사이클을 없앱니다. 코드를 쓰기 전에 worker가 뭘 할 건지, 어떻게 완료를 증명할 건지 명시합니다. Sentinel과 Forge가 구현 시작 전에 승인합니다.

Compass가 모든 작업에 대해 Tech Guide(Forge) 이후, Implementation 전에 implementation-contract skill을 호출합니다. "단순한" 작업이라도 예외 없습니다.

### 흐름

```
Worker가 계약 초안 작성
        ↓
Sentinel 검토 (QA 관점)
        ↓
Forge 검토 (기술 관점)
        ↓
둘 다 승인?  ──yes──→  status: approved  →  구현 시작
     ↓ no
우려 사항을 worker에게 반환
        ↓
Worker가 수정 후 재제출
        ↓
Forge가 최종 결정  →  구현 시작
```

수정은 1회가 최대입니다. 수정 요청 후 재제출에 대한 Forge의 평가가 최종이며, 남은 우려가 있어도 구현이 진행됩니다.

### 검토 기준

**Sentinel은 QA 관점에서 봅니다:**
- demo_steps가 모든 acceptance criteria를 커버하는가?
- 빠진 edge_cases가 있는가?
- non_goals가 합리적인가? 중요한 걸 빼는 건 아닌가?
- 설명된 내용으로 테스팅이 가능한가?

**Forge는 기술 관점에서 봅니다:**
- planned_actions가 tech guide와 일치하는가?
- non_goals가 적절한가? 중요한 걸 빼는 건 아닌가?
- worker가 놓친 기술적 edge_cases가 있는가?
- 이 접근이 실행 가능한가, 아니면 막다른 길인가?

### 스키마 필드

| 필드 | 필수 | 설명 |
|------|:----:|------|
| `planned_actions` | yes | worker가 할 구체적 단계 |
| `edge_cases` | yes | worker가 처리할 엣지 케이스 |
| `non_goals` | yes | 구현이 명시적으로 안 하는 것 |
| `demo_steps` | yes | 완료를 검증하는 단계별 절차 |
| `state_transitions` | no | 구현이 도입하는 상태 변경 |
| `approved_by` | no | 승인한 에이전트 (승인 후 설정) |
| `approval_notes` | no | 승인 중 검토자 메모 |
| `status` | yes | `draft` / `in_review` / `approved` / `revision_requested` |

`demo_steps`는 모든 acceptance criterion을 커버해야 합니다. 빠진 criterion이 있으면 계약이 불완전합니다. 승인되지 않습니다.

### 경매 플랫폼 테스트의 계약

실시간 경매 플랫폼 테스트의 US-01 implementation contract(입찰 엔진)입니다:
- **24개 planned_actions** — WebSocket 이벤트 처리, 입찰 검증, 상태 지속성, 브로드캐스트 로직을 포함하는 세분화된 단계
- **7개 edge_cases** — 같은 밀리초에 동시 입찰, 현재 가격 미만 입찰, 경매 종료 후 제출, 제출 중 연결 끊김 등
- **8개 non_goals** — 결제 처리, 입찰 내역 UI, 최저가 시행, 관리자 경매 관리를 명시적으로 제외

이 수준의 구체성 덕분에 Sentinel이 구현 완료 전에 계약에서 바로 테스트 케이스를 쓸 수 있었습니다.

---

## Worker Self-Check

### 목적

모든 구현 worker(프론트엔드 Pixel, 백엔드 Circuit)는 제출 전 EvidenceBundle에 `self_check` 객체를 넣어야 합니다. 이미 되는 걸 재검증하는 대신, Sentinel의 테스팅을 가장 약한 영역으로 유도하기 위한 솔직한 자기 평가입니다.

### 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `known_risks` | string[] | worker가 인식하는 구현 위험 |
| `untested_paths` | string[] | worker가 테스트 안 한 코드 경로 |
| `possible_stubs` | string[] | stub이나 플레이스홀더로 남긴 구현 |
| `what_i_would_test_next` | string[] | QA가 우선순위를 둬야 할 테스트 영역 |
| `confidence` | integer (1-5) | 자기 평가 confidence. 1=매우 불확실, 5=매우 확신 |

`known_risks`, `untested_paths`, `confidence`는 필수입니다. 나머지는 사소하지 않은 구현에서 강하게 기대됩니다.

### Sentinel이 Self-Check를 쓰는 방법

Sentinel이 EvidenceBundle을 받으면 `self_check` 필드가 QA 방향을 잡아줍니다:

- **known_risks** — 이 시나리오를 먼저, 깊게 테스트합니다
- **untested_paths** — 이 코드 경로를 집중 공략합니다. 여기서 실패가 나오면 worker의 자기 평가와 연결해서 버그 보고서에 기록합니다
- **possible_stubs** — 나열된 파일이 stub으로 남아 있는지 확인합니다. 확인된 stub은 rubric에서 `feature_completeness`를 2점으로 제한합니다
- **what_i_would_test_next** — E2E 시나리오의 우선순위 큐로 씁니다

### Confidence와 임계값 조정

confidence 2 이하는 Rubric 시스템 섹션에서 설명한 자동 임계값 상향을 트리거합니다. worker는 낙관적이기보다 솔직해야 합니다. 취약한 작업에 거짓 confidence=5를 매기면 QA에서 실패할 때 retry budget만 태웁니다. Sentinel의 버그 보고서에 self-check와의 교차 참조가 포함되므로, 보고한 confidence와 실제 실패 사이의 괴리가 evidence에 드러납니다.

---

## 상태 기반 QA

### 정의

표준 E2E 테스팅은 UI 표면을 검증합니다. 버튼이 응답하고, 폼이 제출되고, 페이지가 렌더링됩니다. 상태 기반 QA는 더 나아갑니다. API 엔드포인트를 직접 호출하고 데이터베이스를 쿼리해서 사용자 액션 후 실제 시스템 상태를 검증합니다.

Sentinel은 작업이 백엔드 상태 변경을 포함할 때 상태 기반 QA를 합니다.

### Dev 서버 수명 주기

상태 검증이나 E2E 테스트 전에 Sentinel이 dev 서버를 직접 관리합니다:

1. `.geas/memory/_project/conventions.md`에서 dev 서버 명령을 읽습니다
2. 백그라운드에서 dev 서버를 시작합니다
3. 준비 상태를 기다립니다 (포트 또는 헬스 엔드포인트 확인)
4. 라이브 서버에서 테스트를 돌립니다
5. QA 완료 후 서버를 종료합니다

dev 서버를 못 띄우면(의존성 없음, DB 접근 불가, 환경 미설정) `state_verification: { "skipped": true, "reason": "..." }`을 기록하고 정적 확인만 합니다. 건너뜀 이유가 EvidenceBundle과 게이트 판정에 드러납니다.

### state_verification 필드

결과는 EvidenceBundle의 `state_verification` 필드에 기록됩니다:

**api_checks** — 엔드포인트 직접 검증:

```json
{
  "endpoint": "POST /api/bids",
  "expected_status": 201,
  "actual_status": 201,
  "pass": true,
  "notes": "Bid created, auction state updated"
}
```

**db_checks** — 읽기 전용 DB 상태 검증:

```json
{
  "description": "Bid row persisted with correct auction_id and amount",
  "query": "SELECT * FROM bids WHERE auction_id = 'test-001' ORDER BY created_at DESC LIMIT 1",
  "expected": "bid with amount=500, status='active'",
  "actual": "bid with amount=500, status='active'",
  "pass": true
}
```

DB 확인은 읽기 전용 쿼리여야 합니다. Sentinel은 검증 중 데이터베이스 상태를 변경하지 않습니다.

### 한계

상태 기반 QA는 실행 중인 dev 서버와 접근 가능한 데이터베이스가 필요합니다. 이것들이 안 되는 환경에서는 건너뛰고 기록합니다. 게이트는 상태 검증 없이도 진행하지만, 부재가 evidence에 남습니다.

---

## Vote Round

### 트리거 시점

프로젝트 방향에 영향을 미치는 주요 제안에만 씁니다. 구현 세부 사항, 기능별 spec, 버그 수정, 단일 에이전트 도메인 내 결정에는 안 씁니다.

| 제안 | 지정된 Critic |
|------|-------------|
| Forge가 아키텍처/기술 스택 제안 (Genesis) | Circuit 또는 Palette (가장 영향받는 도메인) |
| Palette가 전체 디자인 시스템 게시 (기능별 spec 아님) | Forge 또는 Pixel |
| 여러 에이전트에 영향을 주는 횡단 관심사 (상태 관리, API 형태, 배포 전략) | 가장 영향받는 도메인의 에이전트 |

### 4단계 프로세스

**1단계 — 제안자 제출**

제안자(보통 Forge 또는 Palette)가 구조화된 제안을 씁니다:
- 무엇을 제안하는가
- 왜 (어떤 문제를 푸는가)
- 트레이드오프와 왜 허용 가능한가
- 고려한 대안과 왜 거부했는가

`.geas/decisions/pending/{proposal-id}.md`에 저장됩니다.

**2단계 — Critic 도전**

Compass가 지정된 Critic을 생성해 제안을 검토합니다. Critic은 구조화된 도전을 써야 합니다:
- 평가: `agree` 또는 `challenge`
- 우려 사항 (있으면)
- 대안 (도전하는 경우)
- 권고: 그대로 진행 / 구체적으로 수정해서 진행 / 대안으로 교체

같은 제안 파일에 추가됩니다.

Critic은 반드시 참여합니다. 제안이 뻔해 보여도 건너뛸 수 없습니다. 두 번째 시선이 제안자가 못 보는 맹점을 잡습니다.

**3단계 — Compass 종합**

Compass가 제안과 도전 양쪽을 읽고, 구체적 옵션과 함께 사용자에게 요약을 보여줍니다:
1. 제안 그대로 수락
2. Critic 우려를 반영해 수정 수락
3. Critic 대안 수락
4. 거부 — 정보 부족

Compass가 프로젝트 맥락 기반의 자체 권고를 포함합니다.

**4단계 — 사용자 확인**

사용자가 옵션을 선택합니다. 자율 모드에서 사용자가 응답하지 않으면 Compass가 권고대로 진행하고 DecisionRecord에 자동 결정을 기록합니다.

### 해결 옵션

| 해결 | 설명 |
|------|------|
| 제안 수락 | 제출 그대로 진행 |
| 수정 수락 | Critic 우려에서 나온 구체적 변경을 반영해 진행 |
| 대안 수락 | Critic이 제안한 대안으로 진행 |
| 거부 | 정보 부족. 제안 철회 |
| Compass 자동 결정 | 사용자 부재. Compass가 가장 강한 옵션 선택 |

모든 vote round는 결과와 무관하게 DecisionRecord를 만듭니다.

---

## Decision Records

### 생성 시점

중요한 거버넌스 이벤트마다 DecisionRecord를 씁니다:

- 에스컬레이션: 작업이 retry budget을 소진하고 `forge-review`, `nova-decision`, `pivot`으로 넘어갈 때
- vote round 해결: 구조화된 검토 후
- debate 해결: 구조화된 토론 후
- pivot: 프로젝트 범위나 방향이 크게 바뀔 때

거버넌스 이벤트가 조용히 넘어가지 않습니다. 기록이 있어야 사람이든 에이전트든 모든 대화를 읽지 않고도 왜 그 결정을 내렸는지 알 수 있습니다.

### 스키마 필드

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 (`dec-001`, `dec-002`, ...) |
| `title` | 결정의 한 줄 요약 |
| `context` | 이 결정을 촉발한 상황 |
| `options` | 고려한 대안들 |
| `decision` | 선택한 옵션 |
| `reasoning` | 왜 이 옵션을 골랐는가 |
| `trade_offs` | 희생하거나 위험으로 감수하는 것 |
| `decided_by` | 최종 결정을 내린 에이전트 또는 사람 |
| `participants` | 결정 프로세스에 참여한 모든 에이전트 |
| `related_task_id` | 이 결정을 촉발한 작업 (있으면) |
| `created_at` | ISO 8601 타임스탬프 |

### 저장

`schemas/decision-record.schema.json`을 따르는 `.geas/decisions/{dec-id}.json`에 씁니다. 모든 에스컬레이션 이벤트가 `.geas/ledger/events.jsonl`에도 기록됩니다.

### 근거의 가치

`reasoning` 필드가 핵심입니다. 뭘 결정했느냐가 아니라, 왜 다른 옵션 대신 이걸 골랐는지를 담습니다. 6개월 뒤에 새 세션이 재개되거나 사람이 프로젝트를 감사할 때, 대화 기록을 뒤지지 않고도 결정 배경을 알 수 있습니다.

---

## 에스컬레이션 경로

작업이 Evidence Gate에서 실패하면 경계가 있고 추적 가능한 에스컬레이션 시퀀스에 진입합니다. 실패가 조용히 넘어가지 않습니다.

### Verify-Fix Loop (레벨 1)

게이트 실패 후 verify-fix-loop skill이 범위가 있는 재시도를 관리합니다:

1. 실패 유형에 따라 fixer를 정합니다. 프론트엔드 버그는 Pixel, 백엔드 버그는 Circuit, 또는 명시적 소유권 분할로 둘 다.
2. fixer가 ContextPacket을 받습니다. 구체적 게이트 실패, 원래 acceptance criteria, 이전 시도에서 변경된 파일, rubric의 `blocking_dimensions`가 들어 있습니다.
3. 수정 후 Evidence Gate가 Tier 1 + Tier 2를 다시 돌립니다.
4. 통과하면 Tier 3(Nova 제품 검토)로 갑니다.
5. 또 실패하면 루프를 반복합니다.

반복마다 `.geas/state/run.json`에 추적됩니다. 수정 시도마다 자기 EvidenceBundle을 만듭니다 (예: `circuit-fix-2.json`).

### Retry Budget

TaskContract의 `retry_budget` 필드가 최대 수정-검증 반복 횟수를 정합니다. 기본값 3입니다. budget 소진 시 TaskContract의 `escalation_policy`를 따릅니다.

### 에스컬레이션 정책 (레벨 2)

**`"forge-review"` (기본)**

Forge를 생성해 아키텍처 근본 원인 분석을 합니다. TaskContract와 모든 evidence bundle을 읽고, 반복 실패가 근본적 설계 문제인지 고칠 수 있는 구현 버그인지 판단합니다.

- 고칠 수 있는 근본 원인을 찾으면: 1회 추가 수정 시도를 줍니다.
- 접근이 잘못됐다고 판단하면: Nova로 넘깁니다.

**`"nova-decision"`**

Nova가 전체 맥락(TaskContract, 모든 evidence bundle, 모든 게이트 판정)을 받고 전략적 결정을 내립니다:
- 범위 축소: 달성 가능한 수준으로 요구사항 줄이기
- 기능 삭제: 기능 완전히 제거
- 대안 접근: 다른 구현 전략으로 pivot
- 계속 진행: 거의 다 됐으면 추가 retry budget 부여

**`"pivot"`**

전체 pivot 프로토콜을 호출합니다. 실패가 고립된 작업 문제가 아니라 프로젝트 방향의 근본적 문제를 가리킬 때만 씁니다.

### 모든 에스컬레이션에 DecisionRecord

시스템이 레벨 1에서 레벨 2로 넘어갈 때마다, 추가 조치 전에 DecisionRecord를 씁니다. 게이트 실패 이력, 적용된 에스컬레이션 정책, 고려한 옵션, 내린 결정, 결정한 에이전트를 기록합니다.

### 시각적 요약

```
Evidence Gate 통과?
  YES --> Nova 제품 검토 (Tier 3)
  NO  --> 수정 (Pixel/Circuit) --> 재게이트
          통과? --> Nova 검토
          NO    --> 수정 --> 재게이트 (반복 2)
                    통과? --> Nova 검토
                    NO    --> ... (retry_budget까지)
                              budget 소진?
                              --> escalation_policy:
                                 forge-review  --> Forge 근본 원인 분석
                                                   고칠 수 있음? --> 1회 추가 시도
                                                   못 고침?    --> nova-decision
                                 nova-decision --> Nova 전략적 결정
                                 pivot         --> Pivot Protocol
                              --> DecisionRecord 작성
```

---

## 같이 보기

- `plugin/skills/evidence-gate/SKILL.md` — Evidence Gate 프로토콜
- `plugin/skills/implementation-contract/SKILL.md` — Implementation Contract 프로토콜
- `plugin/skills/vote-round/SKILL.md` — Vote Round 프로토콜
- `plugin/skills/verify-fix-loop/SKILL.md` — Verify-Fix Loop 프로토콜
- `plugin/skills/verify/SKILL.md` — Mechanical 검증 체크리스트
- `plugin/agents/sentinel.md` — Sentinel 에이전트 정의 (rubric 채점, 상태 검증)
- `plugin/agents/forge.md` — Forge 에이전트 정의 (code_quality rubric)
- `docs/reference/AGENTS.md` — 12명 에이전트 레퍼런스
- `docs/architecture/PIPELINE.md` — 게이트 통합 지점이 표시된 전체 파이프라인
