**[English](GOVERNANCE.md)** | **한국어**

# Geas의 governance

## 1. 개요

Geas에서 governance란 어떤 결정도 암묵적이지 않다는 것을 의미합니다. 모든 architecture 선택, 범위 결정, 출시/미출시 판단은 구조화된 입력, 기록된 근거, 추적 가능한 결과를 갖춘 정해진 process를 따릅니다.

harness는 특정 agent가 작업이 "완료"되었거나 결정이 "올바르다"고 주장하는 것에 의존하지 않습니다. 대신 검증 system을 강제합니다: 제안은 투표를 거치고, 이견은 토론을 발동시키며, 품질은 다계층 Evidence Gate를 통해 검증되고, 제품 방향은 지정된 의사결정자가 판정합니다. 모든 governance event는 영구적인 아티팩트 -- 투표 파일, 결정 기록, gate 판정 -- 를 생성하므로 어떤 결과의 이유든 사후에 재구성할 수 있습니다.

Geas governance를 뒷받침하는 세 가지 원칙:

- **구조화된 결정.** 주요 선택은 암묵적 합의가 아닌 투표 round를 거칩니다.
- **추적 가능성.** 모든 투표, 토론, review, 판정이 증거 트레일에 기록됩니다.
- **선언보다 검증.** "agent가 완료했다고 함"은 충분하지 않습니다. Evidence Gate가 확인해야 합니다.

---

## 2. 투표 round

### 발생 시점

투표 round는 project 방향에 영향을 미치는 주요 제안 이후에 트리거됩니다. 표준 트리거는 다음과 같습니다:

| 제안 | 투표자 |
|------|--------|
| Forge가 architecture/기술 stack을 제안 (Genesis) | Circuit, Palette, **Critic** |
| Palette가 전체 design system을 게시 | Forge, Pixel, **Critic** |
| 여러 agent에 영향을 미치는 횡단적 결정 (예: 상태 관리, API 형태, 배포 전략) | 영향받는 2-3개 agent + **Critic** |

투표 round는 개별 기능 사양, 기능별 기술 가이드, 단일 agent 도메인 내의 구현 세부사항, bug 수정, 사소한 리팩토링에는 사용되지 **않습니다**. 이러한 결정은 담당 agent에게 위임됩니다.

### 참여자

제안의 영향을 받는 도메인의 2-3명의 agent와 Critic이 참여합니다. 제안자는 투표할 수 없습니다. Critic은 모든 투표 round에서 **필수** 참여자입니다 -- Critic이 참여하지 않으면 투표는 무효입니다.

### Critic의 특별한 역할

Critic은 단순한 투표자가 아닙니다. 제안에 동의하더라도 Critic은 위험, 맹점, trade-off를 식별해야 합니다. Critic이 단순히 "좋아 보입니다"라고 말하는 투표 round는 목적을 달성하지 못한 것입니다. Critic의 역할은 제안을 stress test하여 팀이 거짓 자신감이 아닌 열린 눈으로 진행하도록 하는 것입니다.

### 결의 규칙

- **만장일치 동의** -- 즉시 진행합니다. 추가 논의가 필요 없습니다.
- **반대 의견 존재** -- 구조화된 토론이 발동됩니다 (section 3 참조).

### 증거

각 투표자는 자신의 투표를 파일에 기록합니다:

```
.geas/evidence/genesis/vote-circuit.json
.geas/evidence/genesis/vote-palette.json
.geas/evidence/genesis/vote-critic.json
```

이 파일에는 agent의 투표(동의/반대), 근거, 우려 사항이 포함됩니다. project의 결정 트레일의 일부로 영구 보존됩니다.

---

## 3. 토론 protocol

### 발동 시점

토론은 세 가지 상황에서 발생합니다:

1. **투표 이견.** 투표 round에서 반대 투표가 있으면 자동으로 토론이 발동됩니다.
2. **명시적 호출.** 사용자나 Compass가 구조화된 논의가 필요한 결정에 대해 토론 skill을 직접 호출할 수 있습니다.
3. **복잡한 결정.** 여러 실행 가능한 옵션이 있는 기술 또는 제품 결정은 사전 이견 없이도 공식 토론의 이점을 얻을 수 있습니다.

### 구조

토론 skill은 코드가 아닌 **DecisionRecord**를 생성합니다. 흐름:

1. **질문 프레이밍.** 결정을 2-3개의 구체적 옵션이 있는 명확한 선택으로 공식화하고 사용자와 확인합니다.
2. **토론자 생성.** agent들이 각 옵션에 대해 도메인 관점에서 찬반을 논합니다:
   - Forge는 각 옵션의 기술적 장점을 주장합니다.
   - Critic은 가정에 도전하고 선두 옵션에 반대 주장을 합니다.
   - Circuit은 백엔드/확장성 관점에서 평가합니다.
   - Palette는 UX/프론트엔드 관점에서 평가합니다.
3. **제안자 응답.** 투표 이견으로 토론이 발동된 경우, 원래 제안자가 반대 주장에 응답합니다 -- 증거로 반론하거나, 논점을 인정하거나, 수정된 접근법을 제안합니다.
4. **round 계속** 한쪽이 양보하거나, 하이브리드가 제안되어 수용되거나, 3round가 해결 없이 지날 때까지.
5. **tiebreaker.** 3round 후에도 해결되지 않으면 Nova가 최종 중재자로 생성됩니다. Nova는 모든 주장을 읽고 추론과 수용된 trade-off를 담은 구속력 있는 결정을 게시합니다.

### 출력

모든 토론은 `.geas/decisions/{dec-id}.json`에 기록되는 DecisionRecord를 생성합니다. 이 기록은 맥락, 검토된 옵션, 최종 결정, 추론, trade-off를 담고 있습니다. 전체 형식은 section 6을 참조하세요.

### 해결로 인정되는 것

| 해결 유형 | 예시 |
|-----------|------|
| 한쪽이 이유를 들어 양보 | "좋은 지적입니다 -- 지연 비용이 실재하네요, 반대 의견을 철회합니다." |
| 하이브리드가 제안되어 수용 | "당신의 API 형태와 제 캐싱 접근법을 결합하면 두 가지 이점을 모두 얻을 수 있습니다." |
| Nova가 최종 결정 | 3round 미해결 후 Nova가 명시적 추론으로 결정합니다. |

---

## 4. Critic의 역할

Critic은 harness의 제도적 회의론자입니다. 이 역할은 집단 사고를 방지하고 실행 전에 결정이 stress test를 거치도록 합니다.

### 필수 참여

- **모든 투표 round.** Critic은 투표해야 하며, 전체 투표가 "동의"인 경우에도 위험이나 맹점을 제시해야 합니다.
- **모든 출시 전 review.** Nova가 작업에 대해 ship/iterate/cut 판정을 내리기 전에, Critic은 모든 증거를 검토하고 준비 상태에 이의를 제기합니다. 이 review는 `.geas/evidence/{task-id}/critic-review.json`에 기록됩니다.

### Critic이 하는 일

- 제안된 architecture에서 가장 큰 기술적 위험을 식별합니다.
- 기능이 실제 문제를 해결하는 것인지, 필수로 위장한 있으면 좋은 것인지 질문합니다.
- 계획 추정치에 도전합니다 -- 어떤 작업이 예상보다 3배 오래 걸릴까요?
- 누락된 의존성, 검증되지 않은 가정, 과잉 엔지니어링을 지적합니다.
- 팀이 방향에 commit하기 전에 "틀리면 어떻게 되나요?"라고 묻습니다.

### 비평 형식

Critic의 출력은 구조화된 형식을 따릅니다:

```
[Critic] Challenge -- <질문 대상>

Risk: <무엇이 잘못될 수 있는가>
Evidence: <왜, 데이터/비유/선례 포함>
Alternative: <대안으로 무엇을 할 수 있는가>
Trade-off: <대안에서 잃게 되는 것>

Verdict: Disagree -- needs reconsideration
         OR Caution -- proceed but watch for X
         OR Grudging Agree -- concerns noted but not blocking
```

### 참여 규칙

- 항상 대안을 제시합니다. 대안 없는 비판은 유용하지 않습니다.
- 구체적으로 합니다. "이 인증 흐름에는 속도 제한이 없어서 몇 시간 내에 무차별 대입 공격을 당할 것입니다"가 "뭔가 느낌이 별로입니다"보다 낫습니다.
- 전투를 선택합니다. 10가지를 얕게 도전하기보다 2-3가지를 깊이 도전합니다.
- 우려가 해소되면 우아하게 양보합니다.
- 목표는 더 나은 결정이지, 자신이 옳은 것이 아닙니다.

---

## 5. Nova의 제품 판단

Nova는 제품 방향에 대한 최종 권한입니다. Compass가 process를 orchestration하고 Forge가 기술 architecture를 소유하는 반면, Nova는 "이것을 출시해야 하는가?"라는 질문을 소유합니다.

### 판정

Nova는 작업당 세 가지 판정 중 하나를 내립니다:

- **Ship.** 기능이 수용 기준을 충족하고, 사용자 가치를 제공하며, release 준비가 되었습니다.
- **Iterate.** 기능이 기준을 부분적으로 충족합니다. Nova는 개선해야 할 점에 대해 구체적인 feedback을 제공합니다. 작업은 Nova의 feedback을 새로운 context로 받아 재디스패치됩니다. 이는 재시도 예산에서 차감됩니다.
- **Cut.** 기능이 미션과 근본적으로 어긋나거나, 수정 비용이 가치를 초과합니다. 작업 상태가 `"failed"`로 이동하고 DecisionRecord가 기록됩니다.

### Nova가 호출되는 시점

1. **작업별 제품 review.** 모든 작업이 Evidence Gate(Tier 1-2)와 Critic의 출시 전 review를 통과한 후, Nova는 모든 증거를 검토하고 판정을 내립니다. 이것은 MVP Build 단계의 2.8단계이며 필수입니다.
2. **escalation 결정.** 작업이 재시도 예산을 소진하고 escalation 정책이 `"nova-decision"`을 요구하면, Nova는 전체 context를 받고 결정합니다: 범위 축소, 기능 제거, 대체 접근법, 또는 밀고 나가기.
3. **토론 tiebreaker.** 3round 미해결 토론 후 Nova가 모든 주장을 읽고 최종 결정을 내립니다.
4. **최종 briefing (Evolution).** project 종료 시 Nova는 출시된 모든 기능을 검토하고, 전체 제품 품질을 평가하며, 권장 사항을 제시하는 전략적 요약을 전달합니다.

### Nova가 고려하는 것

- **사용자 가치.** 이 기능이 대상 사용자의 실제 문제를 해결하는가?
- **수용 기준.** Evidence Gate에서 검증한 대로 모든 계약 기준이 충족되었는가?
- **품질 신호.** 코드 review(Forge), QA 결과(Sentinel), 보안 review(Shield).
- **위험 평가.** Critic의 출시 전 review -- 알려진 위험은 무엇이며 수용 가능한가?
- **미션 정렬.** 이 기능이 Genesis에서 정의한 핵심 가치 제안에 기여하는가?

### 최종성

Nova의 결정은 제품 방향에 대해 최종적입니다. 다른 agent가 동의하지 않고 증거를 제시할 수 있지만, Nova가 판정을 내리면 팀은 이를 실행합니다. 이는 끝없는 심의를 방지합니다. 나중에 새로운 정보가 발견되면 업데이트된 context로 Nova를 다시 호출할 수 있습니다.

---

## 6. DecisionRecord 형식

모든 중요한 governance event -- escalation, 피벗, 토론 해결, 주요 범위 변경 -- 는 DecisionRecord를 생성합니다. 이 기록은 project의 제도적 기억을 형성합니다.

### 구조

```json
{
  "version": "1.0",
  "id": "dec-003",
  "title": "Escalation: Auth flow failed 3 fix attempts",
  "context": "Evidence gate failed repeatedly. Tier 1 passed but Tier 2 failed on criterion 'OAuth token refresh handles expired tokens gracefully'.",
  "options": [
    "Rewrite the token refresh logic from scratch",
    "Switch to a well-tested OAuth library",
    "Drop OAuth support and use API keys only"
  ],
  "decision": "Switch to a well-tested OAuth library",
  "reasoning": "The custom implementation has failed 3 times on edge cases. A battle-tested library eliminates this class of bugs. The integration cost is ~1 task.",
  "trade_offs": "Adds a dependency. Less control over token storage strategy. Library may not support all planned OAuth providers.",
  "decided_by": "nova",
  "participants": ["sentinel", "circuit", "forge"],
  "related_task_id": "task-007",
  "created_at": "2026-03-25T14:30:00Z"
}
```

### field

| field | 설명 |
|------|------|
| `id` | 고유 식별자 (예: `dec-001`, `dec-002`) |
| `title` | 결정의 한 줄 요약 |
| `context` | 이 결정을 촉발한 상황 |
| `options` | 검토된 대안들 |
| `decision` | 선택된 옵션 |
| `reasoning` | 다른 옵션 대신 이 옵션이 선택된 이유 |
| `trade_offs` | 희생되거나 위험으로 수용된 것 |
| `decided_by` | 최종 결정을 내린 agent (또는 사람) |
| `participants` | 결정 과정에 참여한 모든 agent |
| `related_task_id` | 이 결정을 트리거한 작업 (있는 경우) |
| `created_at` | ISO 8601 timestamp |

### 저장

DecisionRecord는 `.geas/decisions/{dec-id}.json`에 기록되며 `schemas/decision-record.schema.json`을 따릅니다. 또한 `.geas/ledger/events.jsonl`에 event로 기록됩니다.

---

## 7. escalation 경로

작업이 Evidence Gate에 실패하면 Geas는 조용히 재시도하거나 조용히 포기하지 않습니다. 범위가 제한되고 추적 가능한 escalation 경로를 따릅니다.

### level 1: Verify-Fix Loop

Evidence Gate가 실패하면 수정 loop에 진입합니다:

1. 적절한 수정 담당자를 식별합니다 -- 프론트엔드 bug는 Pixel, 백엔드 bug는 Circuit, 또는 둘 다.
2. 수정 담당자는 구체적인 실패 사항, 원래 수용 기준, 변경된 파일이 포함된 ContextPacket을 받습니다.
3. 수정 후 Evidence Gate가 Tier 1과 2를 다시 실행합니다.
4. gate를 통과하면 작업은 Nova의 제품 review(Tier 3)로 진행됩니다.
5. gate가 다시 실패하면 작업의 `retry_budget`(기본값: 3)까지 loop가 반복됩니다.

각 반복은 `.geas/state/run.json`에서 추적됩니다. 모든 수정 시도는 자체 증거 파일을 생성합니다(예: `.geas/evidence/{task-id}/circuit-fix-2.json`).

### level 2: escalation 정책

재시도 예산이 소진되면 system은 작업의 `escalation_policy`를 따릅니다:

#### `"forge-review"` (기본값)

Forge가 architecture 근본 원인 분석을 위해 생성됩니다. Forge는 TaskContract과 모든 증거를 읽은 다음, 실패가 근본적인 설계 문제에서 비롯된 것인지 수정 가능한 구현 bug인지 판단합니다. Forge가 수정 가능한 근본 원인을 식별하면 한 번 더 수정 시도가 부여됩니다. Forge가 접근법 자체가 깨졌다고 판단하면 escalation이 Nova로 이동합니다.

#### `"nova-decision"`

Nova는 전체 context -- TaskContract, 모든 증거 bundle, 모든 gate 판정 -- 를 받고 전략적 결정을 내립니다:
- **범위 축소.** 작업의 요구사항을 달성 가능한 수준으로 줄입니다.
- **기능 제거.** 기능을 완전히 제거합니다.
- **대체 접근법.** 다른 구현 전략으로 전환합니다.
- **밀고 나가기.** 팀이 거의 완료에 가까운 경우 추가 재시도 예산을 부여합니다.

#### `"pivot"`

전체 피벗 protocol이 호출됩니다. 이는 실패가 단일 작업이 아닌 project 방향의 근본적인 문제를 나타내는 상황에 예약됩니다.

### 모든 escalation은 DecisionRecord를 생성

escalation은 조용하지 않습니다. system이 level 1에서 level 2로 이동할 때마다 `.geas/decisions/`에 맥락, 검토된 옵션, 내린 결정, 추론을 담은 DecisionRecord가 기록됩니다. 이를 통해 실패조차 추적 가능해집니다.

### 시각적 요약

```
Evidence Gate PASS?
  YES --> Critic 출시 전 review --> Nova 제품 review
  NO  --> 수정 (Pixel/Circuit) --> 재검증
          PASS? --> Critic --> Nova review
          NO    --> 수정 --> 재검증 (반복 2)
                    ...retry_budget까지...
                    예산 소진?
                    --> escalation_policy:
                       forge-review --> Forge 근본 원인 분석
                       nova-decision --> Nova 전략적 결정
                       pivot --> 전체 피벗 protocol
                    --> DecisionRecord 기록
```

---

## 8. 사람의 개입

Geas는 사람이 loop 밖에 있는 것이 아니라 loop 안에 있는 운영을 위해 설계되었습니다. governance system은 사람 이해관계자가 존재하며 최종 권한을 갖는다고 가정합니다.

### 사람의 comment가 최우선

agent가 ContextPacket 작성을 위해 Linear 스레드를 읽을 때, 사람의 comment는 가장 높은 우선순위의 입력으로 취급됩니다. 사람의 comment는 agent의 이전 분석이나 권장 사항보다 우선합니다. 사람이 "이 접근법은 잘못되었다"고 말하면, system은 이를 어떤 agent의 평가보다 강한 신호로 취급합니다.

### ContextPacket에 사람의 feedback 포함

agent를 위해 생성되는 모든 ContextPacket에는 Linear 스레드의 관련 사람 feedback이 포함됩니다. agent는 사람의 입력과 격리되어 운영되지 않으며, 표준 briefing의 일부로 이를 받습니다.

### 사람은 어떤 agent 결정이든 오버라이드 가능

이 문서에서 설명하는 governance 메커니즘 -- 투표 round, 토론, Nova의 판정, escalation 정책 -- 은 모두 사람의 판단에 종속됩니다. 사람은:

- Nova의 판정을 오버라이드할 수 있습니다(Nova가 제거하려는 것을 출시하거나, Nova가 승인한 것을 제거).
- agent round를 기다리지 않고 토론을 직접 해결할 수 있습니다.
- 재시도 예산을 우회하고 추가 시도를 부여할 수 있습니다.
- 언제든지 작업 우선순위, 수용 기준, 범위를 변경할 수 있습니다.
- 투표 round를 통과한 architecture 결정에 거부권을 행사할 수 있습니다.

### system은 사람의 판단을 보조하지, 대체하지 않음

agent governance는 사람 이해관계자를 배제하기 위해서가 아니라 인지적 부담을 줄이기 위해 존재합니다. 구조화된 process 덕분에 사람이 개입할 때 다음에 접근할 수 있습니다:

- 전체 결정 트레일 (DecisionRecord).
- 모든 agent의 추론 (투표 파일, 증거 bundle).
- 사람의 입력이 가장 가치 있는 명확한 escalation 지점.
- 원시 대화 로그가 아닌 구조화된 요약 (Nova briefing, Compass 투표 요약).

목표는 사람이 어느 시점에서든 개입하여, 무슨 일이 왜 일어났는지 이해하고, 처음부터 모든 agent 상호작용을 읽을 필요 없이 정보에 기반한 결정을 내릴 수 있도록 하는 것입니다.
