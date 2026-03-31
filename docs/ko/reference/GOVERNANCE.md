# 거버넌스 및 평가

이 문서는 Geas의 품질 보증 및 거버넌스 시스템을 다룹니다: Evidence Gate, rubric 점수 매기기, Implementation Contract, worker self-check, 상태 기반 QA, vote round, decision record, 에스컬레이션 경로.

---

## Evidence Gate (3단계)

Evidence Gate는 "완료는 계약 이행을 의미한다"를 강제하는 메커니즘으로, "에이전트가 완료했다고 말한다"가 아닙니다. 모든 작업은 Nova의 제품 검토로 진행하기 전에 게이트를 통과해야 합니다. Compass는 worker로부터 EvidenceBundle을 수집한 후 게이트를 호출합니다.

```
Tier 1: 기계적  →  Tier 2: 시맨틱 + Rubric  →  Tier 3: 제품
(build/lint/test)    (기준 + 점수 매기기)        (Nova ship/iterate/cut)
```

### Tier 1: 기계적

Tier 1은 TaskContract에 정의된 `eval_commands`를 실행하고 exit 코드를 확인합니다.

각 명령에 대해:
- **pass** — 명령이 0으로 종료
- **fail** — 명령이 0이 아닌 값으로 종료 (오류 출력 캡처)
- **skip** — 명령이 적용되지 않거나 설정되지 않음

게이트는 첫 번째 실패에서 중단합니다. 빌드되지 않는 코드에 대해 시맨틱 검사를 실행하는 것은 검증 사이클을 낭비합니다. EvidenceBundle에 이전 실행에서 `verify_results`가 포함되어 있으면, 게이트는 명령을 다시 실행하고 최신 결과를 신뢰합니다.

eval_commands가 있을 때 실행하지 못하는 것 자체가 게이트 위반입니다. 명령이 설정되지 않은 경우 모든 결과는 `"skip"`으로 기록됩니다.

### Tier 2: 시맨틱 + Rubric

Tier 2에는 두 부분이 있습니다: 인수 기준 확인과 rubric 점수 매기기. 둘 다 통과해야 합니다.

**파트 A: 인수 기준**

TaskContract의 `acceptance_criteria`의 각 기준에 대해:
1. worker의 evidence를 읽습니다 (요약, files_changed, 있으면 criteria_results).
2. worker가 `criteria_results`를 제공한 경우, evidence에 대한 자체 평가를 검증합니다.
3. 제공되지 않은 경우, 변경된 파일, 테스트 결과, 코드 검사에서 추론합니다.
4. 기록: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

파트 B로 진행하려면 모든 기준을 충족해야 합니다.

**파트 B: Rubric 점수 매기기**

평가자 (Sentinel, Forge)는 TaskContract에서 rubric 차원을 읽고 각각에 1-5점을 매깁니다. 게이트는 평가자의 EvidenceBundle에서 해당 점수를 읽고 각 점수를 차원의 임계값과 비교합니다.

차원이 임계값 미만이면 Tier 2가 실패합니다. 게이트 판정의 `blocking_dimensions` 목록은 verify-fix-loop에 수정 담당자가 어떤 차원을 다루어야 하는지 정확히 알려줍니다.

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

**임계값 조정 (낮은 신뢰도)**

worker의 `self_check.confidence`가 2 이하이면, 게이트는 비교 전에 모든 rubric 임계값에 +1을 추가합니다. 자신의 구현을 불확실하다고 평가하는 worker는 결과적으로 더 엄격한 검토를 받습니다. 이것은 자동적입니다 — 게이트는 수동 설정 없이 이를 적용합니다.

**스텁 확인**

worker의 `self_check.possible_stubs`가 비어 있지 않으면, 게이트는 해당 파일이 플레이스홀더 구현으로 남아 있지 않은지 확인합니다. 확인된 스텁은 평가자가 보고한 것에 관계없이 `feature_completeness`를 최대 2점으로 제한합니다.

### Tier 3: 제품

Nova가 ship/iterate/cut 판정을 위해 생성됩니다. Tier 3는 다음 경우에만 실행됩니다:
- 기능 완성 (사용자에게 보이는 기능을 제공하는 작업)
- 단계 완성 (MVP, Polish, 또는 Evolution의 종료)
- Pivot 결정

Nova는 작업 목표, 작업의 모든 evidence bundle, Tier 2의 기준 결과, seed.json의 미션 컨텍스트를 받습니다.

Nova의 판정:
- **Ship** — 모든 기준 충족, 좋은 품질, 미션에 부합
- **Iterate** — 기준을 부분적으로 충족; Nova가 worker의 다음 ContextPacket이 될 구체적인 피드백을 제공합니다. 재시도 예산에서 차감됩니다.
- **Cut** — 근본적으로 일치하지 않거나 수정할 가치가 없음

### 게이트 수준

모든 작업에 3단계 모두가 필요한 것은 아닙니다:

| 상황 | 실행할 단계 |
|------|-----------|
| 구현 작업 (코드 변경) | Tier 1 + Tier 2 |
| 디자인 spec (코드 없음) | Tier 2만 |
| 기능 완성 (릴리스 준비) | Tier 1 + Tier 2 + Tier 3 |
| 코드 리뷰 (Forge 검토) | Tier 2만 |
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

Rubric 시스템은 모든 작업에 대해 구조화된 품질 점수를 제공합니다. 점수는 지정된 평가자가 생성하고, 게이트가 Tier 2를 통과시키기 전에 차원별 임계값과 비교됩니다.

### 기본 차원

이 차원들은 모든 구현 작업에 적용됩니다:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|-------|:---------:|------|
| `core_interaction` | Sentinel | 3 | 1-5 |
| `feature_completeness` | Sentinel | 4 | 1-5 |
| `code_quality` | Forge | 4 | 1-5 |
| `regression_safety` | Sentinel | 4 | 1-5 |

### UI 차원

이 차원들은 사용자 인터페이스 작업을 포함하는 작업에 추가됩니다:

| 차원 | 평가자 | 기본 임계값 | 척도 |
|------|-------|:---------:|------|
| `ux_clarity` | Sentinel | 3 | 1-5 |
| `visual_coherence` | Sentinel | 3 | 1-5 |

### 누가 무엇을 점수 매기는가

**Sentinel**은 `code_quality`를 제외한 모든 차원에 점수를 매깁니다: `core_interaction`, `feature_completeness`, `regression_safety`, `ux_clarity`, `visual_coherence`. 이것들은 E2E 테스팅, 사용자 관점 테스팅, 상태 검증을 기반으로 한 QA 도메인 평가입니다.

**Forge**는 `code_quality`만 점수를 매깁니다. Forge의 rubric 점수는 모든 구현 후에 뒤따르는 필수 코드 리뷰에서 나옵니다. 점수는 특정 척도에 기반합니다:
- **5**: 깔끔하고, 잘 구조화되어 있으며, 규칙을 따르고, 문제 없음
- **4**: 좋은 품질, 사소한 제안만 있음
- **3**: 허용 가능하지만 주목할 만한 이슈 있음
- **2**: 상당한 품질 우려 사항
- **1**: 근본적인 문제

### 임계값 강제

TaskContract의 `rubric` 배열의 각 차원에는 `threshold` 필드가 있습니다. Evidence Gate는 각 평가자의 점수를 해당 임계값과 비교합니다. `score < threshold`인 차원은 차단 요소입니다. 게이트 판정의 `blocking_dimensions` 배열은 실패한 모든 차원을 나열합니다.

모든 rubric 차원이 임계값을 충족할 때까지 작업은 Tier 3 (Nova 제품 검토)에 도달할 수 없습니다.

### 임계값 조정

worker의 `self_check.confidence`가 2 이하이면, rubric의 모든 임계값이 1 증가합니다. 이것은 worker 자신이 불확실하다고 평가한 작업에 대해 더 엄격한 검토를 만듭니다. 조정은 평가자가 아닌 Evidence Gate에 의해 적용됩니다.

예: worker가 `code_quality` 임계값=4인 작업에 confidence=2를 보고하면, 게이트는 임계값=5로 평가합니다.

### 경매 플랫폼 테스트의 성적표

다음 성적표는 실시간 경매 플랫폼 테스트 실행 (US-01, 입찰 엔진 구현)에서 가져온 것입니다:

| 차원 | 점수 | 임계값 | 평가자 | 통과 |
|------|:----:|:------:|-------|:----:|
| `core_interaction` | 4 | 3 | Sentinel | 예 |
| `feature_completeness` | 4 | 4 | Sentinel | 예 |
| `code_quality` | 4 | 4 | Forge | 예 |
| `regression_safety` | 3 | 4 | Sentinel | 아니오 |

`blocking_dimensions: ["regression_safety"]` — 작업은 Tier 3로 진행하기 전에 regression safety를 목표로 하는 verify-fix-loop에 진입했습니다.

---

## Implementation Contract

### 목적

Implementation Contract는 worker가 요구사항을 잘못 이해하여 잘못된 것을 만들고 QA가 잡아내는 재작업 사이클을 제거합니다. 코드가 작성되기 전에, 할당된 worker는 무엇을 할 계획이고 어떻게 완료를 증명할지 명시적으로 기술합니다. Sentinel과 Forge는 구현이 시작되기 전에 계획을 승인합니다.

Compass는 모든 작업에 대해 Tech Guide (Forge) 이후와 구현 이전에 implementation-contract skill을 호출합니다. "단순한" 작업에 대한 예외는 없습니다.

### 흐름

```
Worker가 계약 초안 작성
        ↓
Sentinel이 검토 (QA 관점)
        ↓
Forge가 검토 (기술적 관점)
        ↓
둘 다 승인?  ──예──→  status: approved  →  구현 시작
     ↓ 아니오
우려 사항이 worker에게 반환
        ↓
Worker가 수정하고 재제출
        ↓
Forge가 최종 결정  →  구현 시작
```

최대 한 번의 수정 사이클이 허용됩니다. 수정이 요청된 후, 재제출에 대한 Forge의 평가는 최종적이며 남은 우려 사항에 관계없이 구현이 진행됩니다.

### 검토 집중

**Sentinel은 QA 관점에서 검토합니다:**
- demo_steps가 모든 인수 기준을 검증하기에 충분한가?
- 처리되어야 할 누락된 edge_cases가 있는가?
- non_goals가 합리적인가 — 중요한 것이 제외되고 있는가?
- 설명된 내용을 바탕으로 테스팅이 가능한가?

**Forge는 기술적 관점에서 검토합니다:**
- planned_actions가 tech guide와 일치하는가?
- non_goals가 적절한가 — 중요한 것이 제외되고 있지 않은가?
- worker가 놓친 기술적 edge_cases가 있는가?
- 접근 방식이 실행 가능한가 아니면 막다른 길로 향하는가?

### 스키마 필드

| 필드 | 필수 | 설명 |
|------|:----:|------|
| `planned_actions` | 예 | worker가 취할 구체적인 단계 |
| `edge_cases` | 예 | worker가 처리할 엣지 케이스 |
| `non_goals` | 예 | 구현이 명시적으로 하지 않을 것 |
| `demo_steps` | 예 | 완료를 검증하는 단계별 절차 |
| `state_transitions` | 아니오 | 구현이 도입하는 상태 변경 |
| `approved_by` | 아니오 | 승인한 에이전트 (승인 후 설정) |
| `approval_notes` | 아니오 | 승인 중 검토자의 메모 |
| `status` | 예 | `draft` / `in_review` / `approved` / `revision_requested` |

`demo_steps` 필드는 모든 인수 기준을 포함해야 합니다. 기준에 해당하는 demo 단계가 없으면, 계약은 불완전하며 승인되지 않습니다.

### 경매 플랫폼 테스트의 계약

실시간 경매 플랫폼 테스트의 US-01 implementation contract (입찰 엔진)에는 다음이 포함되어 있었습니다:
- **24개의 planned_actions** — WebSocket 이벤트 처리, 입찰 검증, 상태 지속성, 브로드캐스트 로직을 포함하는 세분화된 단계
- **7개의 edge_cases** — 동일한 밀리초 내에 동시에 도착하는 입찰, 현재 가격 미만의 입찰, 경매 종료 후 사용자 제출, 제출 중 연결 끊김 포함
- **8개의 non_goals** — 결제 처리, 입찰 내역 UI, 최저가 시행, 관리자 경매 관리를 명시적으로 제외

이 수준의 구체성 덕분에 Sentinel은 구현이 완료되기 전에 계약에서 직접 테스트 케이스를 작성할 수 있었습니다.

---

## Worker Self-Check

### 목적

모든 구현 worker (프론트엔드는 Pixel, 백엔드는 Circuit)는 제출 전에 EvidenceBundle에 `self_check` 객체를 포함해야 합니다. Self-check는 이미 작동하는 것을 재검증하는 대신 Sentinel의 테스팅을 가장 약한 영역으로 안내하기 위해 작성된 worker 자신의 출력에 대한 솔직한 평가입니다.

### 필드

| 필드 | 유형 | 설명 |
|------|------|------|
| `known_risks` | 문자열 배열 | worker가 구현에서 인식하는 위험 |
| `untested_paths` | 문자열 배열 | worker가 테스트하지 않은 코드 경로 |
| `possible_stubs` | 문자열 배열 | 스텁 또는 플레이스홀더로 남겨진 구현 |
| `what_i_would_test_next` | 문자열 배열 | QA가 우선순위를 두어야 할 제안된 테스트 영역 |
| `confidence` | 정수 (1-5) | 자체 평가된 신뢰도; 1=매우 불확실, 5=매우 확신 |

`known_risks`, `untested_paths`, `confidence`는 필수입니다. 나머지 필드들은 사소하지 않은 구현에 강력히 기대됩니다.

### Sentinel이 Self-Check를 사용하는 방법

Sentinel이 EvidenceBundle을 받으면, `self_check` 필드가 QA 노력을 안내합니다:

- **known_risks** — Sentinel이 이 시나리오들을 먼저 테스트하고 세부적으로 다룸
- **untested_paths** — Sentinel이 이 코드 경로를 목표로 함; 여기서 실패가 나타나면, worker의 자체 평가와의 연관성이 버그 보고서에 기록됨
- **possible_stubs** — Sentinel이 나열된 파일이 스텁으로 남아 있지 않은지 확인함; 확인된 스텁은 rubric에서 `feature_completeness`를 2점으로 제한함
- **what_i_would_test_next** — Sentinel이 이를 E2E 시나리오의 우선순위 대기열로 취급

### 신뢰도와 임계값 조정

신뢰도 평가 2 이하는 Rubric 시스템 섹션에서 설명한 자동 임계값 증가를 트리거합니다. Worker는 낙관적이기보다 솔직할 것이 기대됩니다. QA에서 실패하는 취약한 작업에 대한 거짓 confidence=5는 재시도 예산을 소진합니다. Sentinel의 버그 보고서는 self-check에 대한 교차 참조를 포함하므로, 기술된 신뢰도와 실제 실패 사이의 불일치가 evidence 추적에서 보입니다.

---

## 상태 기반 QA

### 정의

표준 E2E 테스팅은 UI 표면을 검증합니다: 버튼이 응답하고, 폼이 제출되며, 페이지가 렌더링됩니다. 상태 기반 QA는 더 나아가: API 엔드포인트를 직접 호출하고 데이터베이스를 쿼리하여 사용자 액션 후의 실제 시스템 상태를 검증합니다.

Sentinel은 작업이 백엔드 상태 변경을 포함할 때 상태 기반 QA를 수행합니다.

### 개발 서버 수명 주기

상태 검증 또는 E2E 테스트를 실행하기 전에, Sentinel은 개발 서버를 명시적으로 관리합니다:

1. dev 서버 명령을 위해 `.geas/memory/_project/conventions.md`를 읽음
2. 백그라운드에서 개발 서버를 시작
3. 준비 상태를 대기 (포트 또는 헬스 엔드포인트 확인)
4. 라이브 서버에 대해 테스트를 실행
5. QA 완료 후 서버를 종료

dev 서버가 시작할 수 없으면 (의존성 없음, 데이터베이스 사용 불가, 환경 설정되지 않음), Sentinel은 `state_verification: { "skipped": true, "reason": "..." }`을 기록하고 정적 확인만으로 진행합니다. 건너뜀 이유는 EvidenceBundle과 게이트 판정에서 보입니다.

### state_verification 필드

결과는 EvidenceBundle의 `state_verification` 필드에 기록됩니다:

**api_checks** — 직접 엔드포인트 검증:

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

DB 확인은 읽기 전용 쿼리여야 합니다. Sentinel은 검증 중에 데이터베이스 상태를 변경하지 않습니다.

### 제한사항

상태 기반 QA는 실행 중인 개발 서버와 접근 가능한 데이터베이스가 필요합니다. 이것들이 사용 불가능한 환경에서는 상태 검증을 건너뛰고 기록합니다. 게이트는 이 없이 진행하지만, 상태 검증의 부재가 evidence 추적에 표시됩니다.

---

## Vote Round

### 트리거 시점

Vote round는 프로젝트 방향에 영향을 미치는 주요 제안에 사용됩니다. 구현 세부 사항, 기능별 spec, 버그 수정, 또는 단일 에이전트의 도메인 내 결정에는 사용되지 않습니다.

| 제안 | 지정된 Critic |
|------|-------------|
| Forge가 아키텍처 또는 기술 스택 제안 (Genesis) | Circuit 또는 Palette (가장 영향받는 도메인) |
| Palette가 전체 디자인 시스템 게시 (기능별 spec 아님) | Forge 또는 Pixel |
| 여러 에이전트에 영향을 미치는 횡단 관심사 결정 (상태 관리, API 형태, 배포 전략) | 도메인이 가장 영향받는 에이전트 |

### 4단계 프로세스

**1단계 — 제안자 제출**

제안자 (일반적으로 Forge 또는 Palette)가 구조화된 제안을 작성합니다:
- 무엇이 제안되는가
- 왜 (이것이 어떤 문제를 해결하는가)
- 트레이드오프와 그것이 왜 허용 가능한가
- 고려된 대안과 왜 거부되었는가

제안은 `.geas/decisions/pending/{proposal-id}.md`에 저장됩니다.

**2단계 — Critic의 도전**

Compass가 지정된 Critic을 생성하여 제안을 검토합니다. Critic은 구조화된 도전을 작성해야 합니다:
- 평가: `agree` 또는 `challenge`
- 우려 사항 (있는 경우)
- 대안 (도전하는 경우)
- 권고: 그대로 진행 / 구체적인 사항을 수정하여 진행 / 대안으로 교체

도전은 동일한 제안 파일에 추가됩니다.

Critic은 반드시 참여해야 합니다. 제안이 명확해 보여도 Critic 단계를 건너뛰는 것은 허용되지 않습니다 — 두 번째 관점은 제안자가 자신의 작업에서 볼 수 없는 맹점을 잡아냅니다.

**3단계 — Compass의 종합**

Compass는 제안과 도전 모두를 읽고, 구체적인 옵션과 함께 요약을 사용자에게 제시합니다:
1. 제안을 그대로 수락
2. 수정을 포함하여 수락 (Critic의 우려 사항으로부터)
3. Critic의 대안을 수락
4. 거부 — 더 많은 정보가 필요

Compass는 프로젝트 컨텍스트를 기반으로 자체 권고를 포함합니다.

**4단계 — 사용자 확인**

사용자가 옵션을 선택합니다. 자율 모드에서 사용자가 응답하지 않으면, Compass는 권고로 진행하고 DecisionRecord에 자동 결정을 기록합니다.

### 해결 옵션

| 해결 | 설명 |
|------|------|
| 제안 수락 | 제출된 그대로 제안을 진행 |
| 수정을 포함하여 수락 | Critic의 우려 사항에서 구체적인 변경 사항을 포함하여 진행 |
| 대안 수락 | Critic의 제안된 대안으로 진행 |
| 거부 | 더 많은 정보 필요; 제안이 철회됨 |
| Compass 자동 결정 | 사용자 사용 불가; Compass가 가장 강한 옵션을 선택 |

모든 vote round는 결과에 관계없이 DecisionRecord를 생성합니다.

---

## Decision Records

### 생성 시점

DecisionRecord는 모든 중요한 거버넌스 이벤트에 대해 작성됩니다:

- 에스컬레이션: 작업이 재시도 예산을 소진하고 `forge-review`, `nova-decision`, 또는 `pivot`으로 이동할 때
- Vote round 해결: 모든 구조화된 검토 후
- Debate 해결: 모든 구조화된 토론 후
- Pivot: 프로젝트 범위나 방향이 상당히 변경될 때마다

거버넌스 이벤트는 침묵하지 않습니다. 기록은 참여자 — 사람이든 에이전트든 — 누구나 모든 에이전트 상호작용을 읽지 않고도 결정이 왜 내려졌는지 재구성할 수 있도록 존재합니다.

### 스키마 필드

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 (`dec-001`, `dec-002`, ...) |
| `title` | 결정의 한 줄 요약 |
| `context` | 이 결정을 촉발한 상황 |
| `options` | 고려된 대안들 |
| `decision` | 선택된 옵션 |
| `reasoning` | 왜 이 옵션이 대안들보다 선택되었는가 |
| `trade_offs` | 희생되거나 위험으로 수용되는 것 |
| `decided_by` | 최종 결정을 내린 에이전트 또는 사람 |
| `participants` | 결정 프로세스에 관여한 모든 에이전트 |
| `related_task_id` | 이 결정을 촉발한 작업 (있는 경우) |
| `created_at` | ISO 8601 타임스탬프 |

### 저장

DecisionRecord는 `schemas/decision-record.schema.json`에 부합하여 `.geas/decisions/{dec-id}.json`에 작성됩니다. 모든 에스컬레이션 이벤트는 `.geas/ledger/events.jsonl`에도 기록됩니다.

### 지속 가능한 근거

`reasoning` 필드는 결정된 내용뿐만 아니라 다른 옵션들보다 한 옵션이 왜 선택되었는지를 담습니다 — 이것이 기록의 주요 가치입니다. 6개월 후, 새 세션이 재개되거나 사람이 프로젝트를 감사할 때, 근거는 독자가 대화 기록에서 컨텍스트를 재구성할 필요 없이 결정을 설명합니다.

---

## 에스컬레이션 경로

작업이 Evidence Gate에서 실패하면, 시스템은 경계가 있고 추적 가능한 에스컬레이션 시퀀스에 진입합니다. 어떤 실패도 침묵하지 않습니다.

### Verify-Fix Loop (레벨 1)

게이트 실패 후, verify-fix-loop skill이 경계가 있는 재시도 시퀀스를 관리합니다:

1. 실패 유형에 따라 수정 담당자가 식별됩니다 — 프론트엔드 버그는 Pixel, 백엔드 버그는 Circuit, 또는 명시적인 소유권 분할로 둘 다.
2. 수정 담당자는 구체적인 게이트 실패, 원래 인수 기준, 이전 시도에서 변경된 파일, rubric 평가의 `blocking_dimensions`가 포함된 ContextPacket을 받습니다.
3. 수정 후 Evidence Gate가 Tier 1과 Tier 2를 다시 실행합니다.
4. 게이트가 통과하면, 작업은 Tier 3 (Nova 제품 검토)로 진행합니다.
5. 게이트가 다시 실패하면, 루프가 반복됩니다.

각 반복은 `.geas/state/run.json`에 추적됩니다. 각 수정 시도는 자체 EvidenceBundle을 생성합니다 (예: `circuit-fix-2.json`).

### 재시도 예산

TaskContract의 `retry_budget` 필드는 최대 수정-검증 반복 횟수를 설정합니다. 기본값은 3입니다. 예산이 소진되면, 시스템은 TaskContract의 `escalation_policy`를 따릅니다.

### 에스컬레이션 정책 (레벨 2)

**`"forge-review"` (기본값)**

Forge가 아키텍처 근본 원인 분석을 위해 생성됩니다. Forge는 TaskContract와 모든 evidence bundle을 읽고, 반복적인 실패가 근본적인 설계 문제에서 비롯되었는지 수정 가능한 구현 버그에서 비롯되었는지 결정합니다.

- Forge가 수정 가능한 근본 원인을 식별하면: 한 번 더 수정 시도가 허용됩니다.
- Forge가 접근 방식이 잘못되었다고 판단하면: 에스컬레이션이 Nova로 이동합니다.

**`"nova-decision"`**

Nova는 전체 컨텍스트 — TaskContract, 모든 evidence bundle, 모든 게이트 판정 — 를 받고 전략적 결정을 내립니다:
- 범위 축소: 달성 가능한 것으로 작업의 요구사항 축소
- 기능 삭제: 기능을 완전히 제거
- 대안 접근: 다른 구현 전략으로 pivot
- 계속 진행: 팀이 근접해 있으면 추가 재시도 예산 부여

**`"pivot"`**

전체 pivot 프로토콜이 호출됩니다. 실패가 격리된 작업이 아닌 프로젝트 방향의 근본적인 문제를 나타낼 때를 위해 예약됩니다.

### 모든 에스컬레이션 시 DecisionRecord

시스템이 레벨 1에서 레벨 2로 이동할 때마다, 추가 조치가 취해지기 전에 DecisionRecord가 작성됩니다. 기록에는 게이트 실패 기록, 적용된 에스컬레이션 정책, 고려된 옵션, 내려진 결정, 결정한 에이전트가 담깁니다.

### 시각적 요약

```
Evidence Gate 통과?
  예 --> Nova 제품 검토 (Tier 3)
  아니오  --> 수정 (Pixel/Circuit) --> 재-게이트
          통과? --> Nova 검토
          아니오    --> 수정 --> 재-게이트 (반복 2)
                    통과? --> Nova 검토
                    아니오    --> ... (retry_budget까지)
                              예산 소진?
                              --> escalation_policy:
                                 forge-review  --> Forge 근본 원인 분석
                                                   수정 가능? --> 한 번 더 시도
                                                   잘못됨?  --> nova-decision
                                 nova-decision --> Nova 전략적 결정
                                 pivot         --> Pivot 프로토콜
                              --> DecisionRecord 작성
```

---

## 참고 자료

- `plugin/skills/evidence-gate/SKILL.md` — Evidence Gate 프로토콜
- `plugin/skills/implementation-contract/SKILL.md` — Implementation Contract 프로토콜
- `plugin/skills/vote-round/SKILL.md` — Vote Round 프로토콜
- `plugin/skills/verify-fix-loop/SKILL.md` — Verify-Fix Loop 프로토콜
- `plugin/skills/verify/SKILL.md` — 기계적 검증 체크리스트
- `plugin/agents/sentinel.md` — Sentinel 에이전트 정의 (rubric 점수 매기기, 상태 검증)
- `plugin/agents/forge.md` — Forge 에이전트 정의 (code_quality rubric)
- `docs/reference/AGENTS.md` — 모든 12개 에이전트 레퍼런스
- `docs/architecture/PIPELINE.md` — 게이트 통합 포인트가 포함된 전체 파이프라인
