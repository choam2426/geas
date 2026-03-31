# 거버넌스와 평가

Geas의 품질 보증과 거버넌스 시스템을 다룬다: Evidence Gate, rubric 채점, Implementation Contract, worker self-check, 상태 기반 QA, vote round, decision record, 에스컬레이션 경로.

---

## Evidence Gate (3단계)

Evidence Gate는 "완료 = 계약 이행"을 강제하는 장치다. "에이전트가 다 했다고 말했다"로는 부족하다. 모든 작업은 Nova의 제품 리뷰로 넘어가기 전에 이 게이트를 통과해야 한다. Compass가 worker로부터 EvidenceBundle을 수집한 뒤 게이트를 호출한다.

```
Tier 1: Mechanical  →  Tier 2: Semantic + Rubric  →  Tier 3: Product
(build/lint/test)       (criteria + 채점)              (Nova ship/iterate/cut)
```

### Tier 1: Mechanical

TaskContract에 정의된 `eval_commands`를 실행하고 exit 코드를 확인한다.

각 명령에 대해:
- **pass** — exit 0
- **fail** — exit 0이 아님 (에러 출력 캡처)
- **skip** — 해당 없거나 미설정

첫 실패에서 멈춘다. 빌드조차 안 되는 코드에 semantic 검사를 돌리는 건 낭비다. EvidenceBundle에 이전 실행의 `verify_results`가 있으면, 게이트가 명령을 새로 실행하고 그 결과를 쓴다.

eval_commands가 있는데 실행하지 않는 것 자체가 게이트 위반이다. 명령이 설정되지 않았으면 모든 결과를 `"skip"`으로 기록한다.

### Tier 2: Semantic + Rubric

두 부분으로 나뉜다: acceptance criteria 검사와 rubric 채점. 둘 다 통과해야 한다.

**Part A: Acceptance Criteria**

TaskContract의 `acceptance_criteria` 각 항목에 대해:
1. Worker의 evidence(summary, files_changed, criteria_results가 있으면)를 읽는다.
2. Worker가 `criteria_results`를 제출했으면, evidence와 대조해 자체 평가를 검증한다.
3. 제출하지 않았으면, 변경 파일, 테스트 결과, 코드 검사로 추론한다.
4. 기록: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

모든 criterion이 충족돼야 Part B로 넘어간다.

**Part B: Rubric 채점**

평가자(Sentinel, Forge)가 TaskContract의 rubric 차원을 읽고 각각 1~5점을 매긴다. 게이트가 평가자의 EvidenceBundle에서 그 점수를 읽어 차원별 임계값과 비교한다.

어느 차원이든 임계값 미달이면 Tier 2가 실패한다. 게이트 판정의 `blocking_dimensions` 목록이 verify-fix-loop에 수정자가 어디를 고쳐야 하는지 알려준다.

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

**임계값 조정 (Low Confidence)**

Worker의 `self_check.confidence`가 2 이하면, 비교 전 모든 rubric 임계값에 +1을 더한다. 자기 구현에 확신이 없는 worker는 더 엄격한 리뷰를 받는다는 뜻이다. 자동 적용이며 수동 설정이 필요 없다.

**Stub 검사**

Worker의 `self_check.possible_stubs`가 비어 있지 않으면, 게이트가 해당 파일이 placeholder 구현으로 남아 있지 않은지 확인한다. 확인된 stub이 있으면 평가자가 뭐라고 했든 `feature_completeness` 점수를 2로 제한한다.

### Tier 3: Product

Nova가 ship/iterate/cut 판정을 내린다. Tier 3는 다음 경우에만 실행된다:
- 기능 완료 (사용자에게 보이는 기능을 전달하는 작업)
- 단계 완료 (MVP, Polish, Evolution 종료)
- Pivot 결정

Nova는 작업 목표, 해당 작업의 모든 evidence bundle, Tier 2의 criteria 결과, seed.json의 미션 컨텍스트를 받는다.

Nova의 판정:
- **Ship** — 모든 criteria 충족, 품질 양호, 미션에 부합
- **Iterate** — 부분적으로 criteria 충족. Nova가 구체적 피드백을 제공하고, 이것이 worker의 다음 ContextPacket이 된다. Retry budget에서 차감.
- **Cut** — 근본적으로 방향이 맞지 않거나 고칠 가치가 없음

### Gate 수준

모든 작업이 세 tier를 전부 거칠 필요는 없다:

| 상황 | 실행할 Tier |
|------|------------|
| 구현 작업 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 스펙 (코드 없음) | Tier 2만 |
| 기능 완료 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge 검토) | Tier 2만 |
| QA 테스트 (Sentinel) | Tier 1 + Tier 2 |
| 보안 검토 (Shield) | Tier 2만 |
| 단계 완료 | Tier 1 + Tier 2 + Tier 3 |

### Gate 판정 구조

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

Rubric 시스템은 모든 작업에 구조화된 품질 채점을 한다. 지정된 평가자가 점수를 매기고, 차원별 임계값과 비교한 뒤 게이트가 Tier 2 통과 여부를 결정한다.

### 기본 차원

모든 구현 작업에 적용되는 차원:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|--------|:---------:|------|
| `core_interaction` | Sentinel | 3 | 1-5 |
| `feature_completeness` | Sentinel | 4 | 1-5 |
| `code_quality` | Forge | 4 | 1-5 |
| `regression_safety` | Sentinel | 4 | 1-5 |

### UI 차원

사용자 인터페이스 작업에 추가되는 차원:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|--------|:---------:|------|
| `ux_clarity` | Sentinel | 3 | 1-5 |
| `visual_coherence` | Sentinel | 3 | 1-5 |

### 누가 무엇을 채점하는가

**Sentinel**은 `code_quality`를 제외한 모든 차원을 채점한다: `core_interaction`, `feature_completeness`, `regression_safety`, `ux_clarity`, `visual_coherence`. E2E 테스트, 사용자 관점 테스트, 상태 검증에 기반한 QA 영역 평가다.

**Forge**는 `code_quality`만 채점한다. 모든 구현에 뒤따르는 필수 코드 리뷰에서 rubric 점수가 나온다. 점수 기준:
- **5**: 깔끔하고, 잘 구조화됐고, 규칙을 따르며, 문제 없음
- **4**: 좋은 품질, 사소한 제안만 있음
- **3**: 수용 가능하지만 눈에 띄는 문제 있음
- **2**: 상당한 품질 우려
- **1**: 근본적 문제

### 임계값 강제

TaskContract의 `rubric` 배열에 있는 각 차원에 `threshold` 필드가 있다. Evidence Gate가 평가자의 점수를 이 임계값과 비교한다. `score < threshold`인 차원은 차단 사유다. 게이트 판정의 `blocking_dimensions` 배열에 모든 미달 차원이 나열된다.

모든 rubric 차원이 임계값을 충족할 때까지 Tier 3(Nova 제품 리뷰)에 도달할 수 없다.

### 임계값 조정

Worker의 `self_check.confidence`가 2 이하면 rubric의 모든 임계값이 1씩 올라간다. Worker 스스로 확신이 없다고 한 작업에 대해 더 엄격한 리뷰가 적용된다는 뜻이다. 평가자가 아닌 Evidence Gate가 이 조정을 적용한다.

예시: worker가 confidence=2를 보고했고, `code_quality` 임계값이 4인 작업이면, 게이트는 임계값 5를 기준으로 평가한다.

### 실제 테스트 스코어카드

아래 스코어카드는 실시간 경매 플랫폼 테스트(US-01, 입찰 엔진 구현)에서 나온 것이다:

| 차원 | 점수 | 임계값 | 평가자 | 통과 |
|------|:----:|:-----:|--------|:----:|
| `core_interaction` | 4 | 3 | Sentinel | O |
| `feature_completeness` | 4 | 4 | Sentinel | O |
| `code_quality` | 4 | 4 | Forge | O |
| `regression_safety` | 3 | 4 | Sentinel | X |

`blocking_dimensions: ["regression_safety"]` — regression safety를 타겟으로 verify-fix-loop에 들어간 뒤 Tier 3로 진행했다.

---

## Implementation Contract

### 목적

Implementation Contract는 worker가 요구사항을 잘못 이해하고 엉뚱한 것을 만들어 QA에서 걸리는 재작업 사이클을 제거한다. 코드를 한 줄도 쓰기 전에, 배정된 worker가 뭘 할 건지와 어떻게 완료를 증명할 건지를 명시적으로 밝힌다. Sentinel과 Forge가 계획을 승인해야 구현이 시작된다.

Compass가 Tech Guide(Forge) 이후, Implementation 전에 implementation-contract skill을 호출한다. 모든 작업에 대해 실행하며 "간단한" 작업이라고 예외는 없다.

### 흐름

```
Worker가 계약 초안 작성
        ↓
Sentinel이 검토 (QA 관점)
        ↓
Forge가 검토 (기술 관점)
        ↓
둘 다 승인?  ──예──→  status: approved  →  구현 시작
     ↓ 아니오
우려 사항을 worker에게 반환
        ↓
Worker가 수정 후 재제출
        ↓
Forge가 최종 결정  →  구현 시작
```

수정은 최대 1회다. 수정 요청 후 재제출하면 Forge의 판단이 최종이고, 나머지 우려가 있더라도 구현이 진행된다.

### 검토 관점

**Sentinel은 QA 관점에서 검토한다:**
- demo_steps가 모든 acceptance criterion을 검증하기에 충분한가?
- 처리해야 할 edge_cases가 빠졌는가?
- non_goals가 합리적인가 — 중요한 걸 빠뜨리고 있지 않은가?
- 기술된 내용으로 테스트가 가능한가?

**Forge는 기술 관점에서 검토한다:**
- planned_actions가 기술 가이드와 일관된가?
- non_goals가 적절한가 — 중요한 걸 빠뜨리고 있지 않은가?
- Worker가 놓친 기술적 edge_cases가 있는가?
- 접근 방식이 실현 가능한가, 아니면 막다른 골목을 향하고 있는가?

### 스키마 필드

| 필드 | 필수 | 설명 |
|------|:----:|------|
| `planned_actions` | O | Worker가 취할 구체적 단계 |
| `edge_cases` | O | Worker가 처리할 엣지 케이스 |
| `non_goals` | O | 구현에서 명시적으로 하지 않을 것 |
| `demo_steps` | O | 완료를 검증하는 단계별 절차 |
| `state_transitions` | X | 구현이 도입하는 상태 전환 |
| `approved_by` | X | 승인한 에이전트 (승인 후 설정) |
| `approval_notes` | X | 승인 중 리뷰어의 메모 |
| `status` | O | `draft` / `in_review` / `approved` / `revision_requested` |

`demo_steps`는 모든 acceptance criterion을 커버해야 한다. 대응하는 demo step이 없는 criterion이 있으면 계약이 불완전한 것이며 승인되지 않는다.

### 경매 플랫폼 테스트의 실제 계약

실시간 경매 플랫폼 테스트의 US-01 implementation contract(입찰 엔진)에 포함된 내용:
- **24개의 planned_actions** — WebSocket 이벤트 처리, 입찰 검증, 상태 영속화, 브로드캐스트 로직을 다루는 세분화된 단계
- **7개의 edge_cases** — 같은 밀리초에 도착하는 동시 입찰, 현재가 미만 입찰, 경매 종료 후 제출, 제출 중 연결 끊김 등
- **8개의 non_goals** — 결제 처리, 입찰 이력 UI, 최저가 강제, 관리자 경매 관리를 명시적으로 제외

이 정도 구체성 덕분에 Sentinel이 구현 완료 전에 계약에서 직접 테스트 케이스를 작성할 수 있었다.

---

## Worker Self-Check

### 목적

모든 구현 worker(프론트엔드의 Pixel, 백엔드의 Circuit)는 evidence 제출 전에 EvidenceBundle에 `self_check` 객체를 포함해야 한다. Self-check는 worker가 자기 산출물을 솔직하게 평가한 것이다. Sentinel의 테스트 노력을 이미 작동하는 걸로 알려진 곳이 아닌 가장 약한 영역으로 유도하기 위해 존재한다.

### 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `known_risks` | array of strings | Worker가 자기 구현에서 인식하고 있는 리스크 |
| `untested_paths` | array of strings | Worker가 테스트하지 않은 코드 경로 |
| `possible_stubs` | array of strings | Stub이나 placeholder로 남겨둔 구현 |
| `what_i_would_test_next` | array of strings | QA가 우선적으로 봐야 할 테스트 영역 |
| `confidence` | integer (1-5) | 자체 평가한 확신도. 1=매우 불확실, 5=매우 확신 |

`known_risks`, `untested_paths`, `confidence`는 필수다. 나머지는 사소하지 않은 구현에서 강하게 기대된다.

### Sentinel이 Self-Check를 활용하는 방식

Sentinel이 EvidenceBundle을 받으면 `self_check` 필드가 QA 노력을 방향짓는다:

- **known_risks** — Sentinel이 이 시나리오를 먼저, 상세하게 테스트한다
- **untested_paths** — Sentinel이 이 코드 경로를 타겟한다. 여기서 실패가 나오면 버그 리포트에 worker의 자체 평가와의 연결을 기록한다
- **possible_stubs** — Sentinel이 나열된 파일이 stub으로 남아 있지 않은지 확인한다. stub이 확인되면 rubric에서 `feature_completeness`를 2로 제한한다
- **what_i_would_test_next** — Sentinel이 이걸 E2E 시나리오의 우선순위 큐로 취급한다

### Confidence와 임계값 조정

Confidence 2 이하는 Rubric 시스템 섹션에서 설명한 자동 임계값 상승을 트리거한다. Worker는 낙관적이기보다 솔직해야 한다. 불안정한 작업에 거짓으로 confidence=5를 보고하면 QA에서 실패하고 retry budget만 소모한다. Sentinel의 버그 리포트에 self-check와의 교차 참조가 포함되므로, 명시한 confidence와 실제 실패 간 불일치가 evidence 기록에 드러난다.

---

## 상태 기반 QA

### 개념

일반 E2E 테스트는 UI 표면만 검증한다: 버튼이 반응하는지, 폼이 제출되는지, 페이지가 렌더링되는지. 상태 기반 QA는 한 걸음 더 나간다: 사용자 액션 이후의 실제 시스템 상태를 API 엔드포인트 직접 호출과 데이터베이스 쿼리로 검증한다.

Sentinel은 작업이 백엔드 상태 변경을 수반할 때 상태 기반 QA를 수행한다.

### 개발 서버 수명주기

상태 검증이나 E2E 테스트를 실행하기 전에, Sentinel이 개발 서버를 명시적으로 관리한다:

1. `.geas/memory/_project/conventions.md`에서 dev server 명령을 읽는다
2. 개발 서버를 백그라운드로 시작한다
3. 준비 상태를 기다린다(포트 또는 헬스 엔드포인트 확인)
4. 라이브 서버에 대해 테스트를 실행한다
5. QA 완료 후 서버를 종료한다

Dev server를 시작할 수 없으면(의존성 누락, 데이터베이스 미가용, 환경 미설정) Sentinel이 `state_verification: { "skipped": true, "reason": "..." }`를 기록하고 정적 검사만 진행한다. 건너뛴 이유는 EvidenceBundle과 gate 판정에 표시된다.

### state_verification 필드

결과는 EvidenceBundle의 `state_verification` 필드에 기록된다:

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

**db_checks** — 읽기 전용 데이터베이스 상태 검증:

```json
{
  "description": "Bid row persisted with correct auction_id and amount",
  "query": "SELECT * FROM bids WHERE auction_id = 'test-001' ORDER BY created_at DESC LIMIT 1",
  "expected": "bid with amount=500, status='active'",
  "actual": "bid with amount=500, status='active'",
  "pass": true
}
```

DB 검사는 반드시 읽기 전용 쿼리여야 한다. Sentinel은 검증 중 데이터베이스 상태를 변경하지 않는다.

### 한계

상태 기반 QA는 실행 중인 개발 서버와 접근 가능한 데이터베이스가 필요하다. 이 환경이 갖춰지지 않으면 상태 검증은 건너뛰고 기록된다. 게이트는 상태 검증 없이 진행하지만, 검증을 하지 못했다는 사실이 evidence 기록에 남는다.

---

## Vote Round

### 트리거 조건

Vote round는 프로젝트 방향에 영향을 미치는 주요 제안에 쓴다. 구현 디테일, 기능별 스펙, 버그 수정, 단일 에이전트 영역 내 결정에는 쓰지 않는다.

| 제안 | 지정된 Critic |
|------|-------------|
| Forge가 아키텍처 또는 기술 스택을 제안 (Genesis) | Circuit 또는 Palette (가장 영향받는 영역) |
| Palette가 전체 디자인 시스템을 제시 (기능별 스펙이 아님) | Forge 또는 Pixel |
| 여러 에이전트에 걸치는 횡단적 결정 (상태 관리, API 형태, 배포 전략) | 가장 영향받는 도메인의 에이전트 |

### 4단계 프로세스

**1단계 — 제안자가 제출**

제안자(보통 Forge 또는 Palette)가 구조화된 제안을 작성한다:
- 무엇을 제안하는가
- 왜 (어떤 문제를 해결하는가)
- 트레이드오프와 그것이 수용 가능한 이유
- 검토한 대안과 기각 이유

제안은 `.geas/decisions/pending/{proposal-id}.md`에 저장된다.

**2단계 — Critic이 반박**

Compass가 지정된 Critic을 생성해 제안을 검토한다. Critic은 구조화된 반박을 작성해야 한다:
- 평가: `agree` 또는 `challenge`
- 우려 사항 (있으면)
- 대안 (반박하는 경우)
- 권고: 그대로 진행 / 구체적 수정 후 진행 / 대안으로 교체

반박은 같은 제안 파일에 추가된다.

Critic 참여는 필수다. 제안이 아무리 명백해 보여도 Critic 단계를 건너뛸 수 없다. 제안자 본인이 보지 못하는 사각지대를 두 번째 시각이 잡아낸다.

**3단계 — Compass가 종합**

Compass가 제안과 반박을 모두 읽고, 구체적 선택지와 함께 요약을 사용자에게 제시한다:
1. 제안을 그대로 수용
2. 수정 후 수용 (Critic의 우려를 반영)
3. Critic의 대안 수용
4. 기각 — 추가 정보 필요

Compass가 프로젝트 맥락에 기반한 자체 권고도 포함한다.

**4단계 — 사용자가 확정**

사용자가 선택지를 고른다. 자율 모드에서 사용자가 응답하지 않으면, Compass가 자체 권고로 진행하고 DecisionRecord에 자동 결정이었음을 기록한다.

### 해결 옵션

| 해결 | 설명 |
|------|------|
| 제안 수용 | 제출된 그대로 진행 |
| 수정 후 수용 | Critic의 우려를 반영한 구체적 변경과 함께 진행 |
| 대안 수용 | Critic이 제안한 대안으로 진행 |
| 기각 | 추가 정보 필요, 제안 철회 |
| Compass 자동 결정 | 사용자 부재 시 Compass가 가장 강한 옵션을 선택 |

모든 vote round는 결과와 무관하게 DecisionRecord를 생성한다.

---

## Decision Record

### 생성 시점

DecisionRecord는 모든 의미 있는 거버넌스 이벤트에 작성된다:

- 에스컬레이션: 작업이 retry budget을 소진하고 `forge-review`, `nova-decision`, `pivot`으로 넘어갈 때
- Vote round 해결: 모든 구조화된 리뷰 이후
- Debate 해결: 모든 구조화된 토론 이후
- Pivot: 프로젝트 범위나 방향이 크게 바뀔 때

어떤 거버넌스 이벤트도 묵음으로 지나가지 않는다. 기록이 존재하는 이유는 모든 참여자 — 사람이든 에이전트든 — 가 에이전트 간 대화를 전부 읽지 않고도 왜 그 결정이 내려졌는지 재구성할 수 있게 하기 위해서다.

### 스키마 필드

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 (`dec-001`, `dec-002`, ...) |
| `title` | 결정의 한 줄 요약 |
| `context` | 이 결정을 촉발한 상황 |
| `options` | 검토한 대안들 |
| `decision` | 선택한 옵션 |
| `reasoning` | 다른 대안 대신 이걸 선택한 이유 |
| `trade_offs` | 감수하거나 리스크로 수용하는 것 |
| `decided_by` | 최종 결정을 내린 에이전트 또는 사람 |
| `participants` | 결정 과정에 참여한 모든 에이전트 |
| `related_task_id` | 이 결정을 촉발한 작업 (있으면) |
| `created_at` | ISO 8601 타임스탬프 |

### 저장

DecisionRecord는 `schemas/decision-record.schema.json`을 따르는 `.geas/decisions/{dec-id}.json`에 작성된다. 모든 에스컬레이션 이벤트는 `.geas/ledger/events.jsonl`에도 기록된다.

### 지속되는 근거

`reasoning` 필드는 무엇을 결정했는지가 아니라 왜 그 옵션을 다른 것보다 선택했는지를 담는다. 이게 기록의 핵심 가치다. 6개월 뒤에 새 세션이 재개되거나 사람이 프로젝트를 감사할 때, 대화 이력을 재구성하지 않고도 결정을 이해할 수 있게 해준다.

---

## 에스컬레이션 경로

작업이 Evidence Gate에서 실패하면, 범위 한정되고 추적 가능한 에스컬레이션 시퀀스에 진입한다. 어떤 실패도 묵음으로 지나가지 않는다.

### Verify-Fix Loop (Level 1)

Gate 실패 후, verify-fix-loop skill이 범위 한정 재시도를 관리한다:

1. 실패 유형에 따라 수정자를 식별한다 — 프론트엔드 버그는 Pixel, 백엔드 버그는 Circuit, 양쪽 다면 명시적으로 담당을 나눈다.
2. 수정자는 구체적인 gate 실패 사항, 원래 acceptance criteria, 이전 시도에서 변경한 파일, rubric 평가의 `blocking_dimensions`가 담긴 ContextPacket을 받는다.
3. 수정 후 Evidence Gate가 Tier 1 + Tier 2를 다시 돌린다.
4. 게이트를 통과하면 Tier 3(Nova 제품 리뷰)로 진행한다.
5. 다시 실패하면 루프를 반복한다.

각 반복은 `.geas/state/run.json`에 추적된다. 각 수정 시도마다 자체 EvidenceBundle이 생성된다(예: `circuit-fix-2.json`).

### Retry Budget

TaskContract의 `retry_budget` 필드가 수정-검증 반복의 최대 횟수를 정한다. 기본값은 3이다. Budget이 소진되면 TaskContract의 `escalation_policy`를 따른다.

### Escalation Policy (Level 2)

**`"forge-review"` (기본값)**

Forge를 생성해 아키텍처 수준의 근본 원인 분석을 한다. Forge가 TaskContract와 모든 evidence bundle을 읽고, 반복 실패가 근본적 설계 문제에서 비롯된 건지 수정 가능한 구현 버그인지 판단한다.

- Forge가 수정 가능한 근본 원인을 찾으면: 수정 시도를 1회 추가로 부여한다.
- Forge가 접근 방식 자체가 잘못됐다고 판단하면: Nova로 에스컬레이션한다.

**`"nova-decision"`**

Nova가 전체 컨텍스트 — TaskContract, 모든 evidence bundle, 모든 gate 판정 — 를 받고 전략적 결정을 내린다:
- 범위 축소: 작업의 요구사항을 달성 가능한 수준으로 줄인다
- 기능 제거: 기능을 아예 없앤다
- 대안 접근: 다른 구현 전략으로 피벗한다
- 밀고 나가기: 팀이 거의 다 됐으면 추가 retry budget을 부여한다

**`"pivot"`**

전체 pivot protocol을 호출한다. 실패가 개별 작업이 아닌 프로젝트 방향의 근본적 문제를 시사하는 상황에 쓴다.

### 모든 에스컬레이션에 DecisionRecord

시스템이 Level 1에서 Level 2로 넘어갈 때마다, 추가 조치를 취하기 전에 DecisionRecord를 작성한다. 기록에 gate 실패 이력, 적용된 escalation policy, 검토한 옵션, 내린 결정, 결정한 에이전트가 담긴다.

### 시각적 요약

```
Evidence Gate PASS?
  YES --> Nova 제품 리뷰 (Tier 3)
  NO  --> 수정 (Pixel/Circuit) --> 재검증
          PASS? --> Nova 리뷰
          NO    --> 수정 --> 재검증 (반복 2)
                    PASS? --> Nova 리뷰
                    NO    --> ... (retry_budget까지)
                              Budget 소진?
                              --> escalation_policy:
                                 forge-review  --> Forge 근본 원인 분석
                                                   수정 가능? --> 1회 추가 시도
                                                   설계 문제? --> nova-decision
                                 nova-decision --> Nova 전략적 결정
                                 pivot         --> Pivot Protocol
                              --> DecisionRecord 작성
```

---

## 참고

- `plugin/skills/evidence-gate/SKILL.md` — Evidence Gate 프로토콜
- `plugin/skills/implementation-contract/SKILL.md` — Implementation Contract 프로토콜
- `plugin/skills/vote-round/SKILL.md` — Vote Round 프로토콜
- `plugin/skills/verify-fix-loop/SKILL.md` — Verify-Fix Loop 프로토콜
- `plugin/skills/verify/SKILL.md` — Mechanical 검증 체크리스트
- `plugin/agents/sentinel.md` — Sentinel 에이전트 정의 (rubric 채점, 상태 검증)
- `plugin/agents/forge.md` — Forge 에이전트 정의 (code_quality rubric)
- `docs/reference/AGENTS.md` — 12명 에이전트 레퍼런스
- `docs/architecture/PIPELINE.md` — gate 통합 포인트가 포함된 전체 파이프라인
