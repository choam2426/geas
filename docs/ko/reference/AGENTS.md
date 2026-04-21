# Agents Reference

Geas는 **slot 기반 역할 아키텍처**를 사용한다. 프로토콜이 추상적인 **slot**을 정의하고, 구체 agent 타입이 frontmatter에서 자신이 어떤 slot을 채우는지 선언한다. 이 분리 덕분에 동일한 거버넌스 파이프라인이 contract 계층 수정 없이 소프트웨어 엔지니어링, 연구, 앞으로 추가될 어떤 profile에도 적용된다.

**정식 slot 정의:** [`docs/protocol/01_AGENTS_AND_AUTHORITY.md`](../../protocol/01_AGENTS_AND_AUTHORITY.md)
**Agent 파일:** `plugin/agents/`

## Slot Family

**Authority (4 slots)** — orchestrator, decision-maker, design-authority, challenger. 도메인과 무관하게 항상 존재한다.

**Specialist (5 slots)** — implementer, verifier, risk-assessor, operator, communicator. 도메인을 가로지르는 최소 공통 분류다. Profile은 각 slot을 도메인에 맞는 구체 agent 타입으로 채우며, 같은 slot에 여러 구체 타입을 매핑할 수도 있다 (예: research profile의 implementer 2종).

Slot은 역할 위치이다. Evidence, reviewer routing, gate 규칙은 모두 구체 agent 이름이 아니라 slot을 참조하기 때문에 같은 파이프라인이 여러 도메인에서 동작한다.

**Orchestrator**는 미션 skill(메인 세션 드라이버)이지 스폰 가능한 agent가 아니다. Phase를 조율하고, specialist를 디스패치하고, task 종결 결정을 기록한다. `plugin/agents/`에는 등장하지 않는다.

---

## Authority Agents

Authority agent는 모든 profile에 공유된다. 도메인과 무관하게 거버넌스, 구조적 리뷰, 적대적 검증을 담당한다.

| Agent | Slot | 모델 | 핵심 책임 |
|---|---|---|---|
| [decision-maker](#decision-maker) | `decision-maker` | opus | 미션 단위 승인과 최종 mission verdict |
| [design-authority](#design-authority) | `design-authority` | opus | Mission design, contract 구조적 리뷰, gap 분석 |
| [challenger](#challenger) | `challenger` | opus | 고위험 task에 대한 적대적 리뷰, 미션 단위 deliberation 참여 |

### decision-maker

최종 판정 권한. Spec, design, task closure, gap 분석, deliberation을 모두 읽은 뒤 mission verdict를 낸다.

- **권한:** 미션 단위 승인 체크포인트(building 중 scope-in task contract, consolidating 종료 시 mission verdict). 참여자 간 의견이 엇갈릴 때 deliberation을 최종 판정한다.
- **판단 기준:** 수용 기준 충족 여부, 남은 gap의 수용 가능성, 잔여 리스크가 미션 범위 안에 있는지. Evidence gate 통과가 곧 미션 종결을 뜻하지 않는다. 객관적 검증과 제품 판단은 분리된다.
- **산출물:** `.geas/missions/{mission_id}/mission-verdicts.json`, deliberation verdict.

### design-authority

구조적 일관성의 수호자. Specifying 단계에서 mission design을 작성하고, task contract와 implementation contract를 구조적으로 리뷰하며, consolidating 단계에서 gap 분석을 조합한다.

- **권한:** Specifying 단계 mission design 작성. Task contract와 implementation contract 구조적 리뷰(판정: approved / changes_requested / blocked). Consolidating 단계 gap payload 작성.
- **판단 기준:** 경계, 인터페이스, 의존성, 정당화된 복잡성, 범위가 한정된 stub. 진행 중 다른 task와의 surface 겹침을 포착한다.
- **산출물:** `.geas/missions/{mission_id}/mission-design.md`, `tasks/{task_id}/evidence/design-authority.design-authority.json`(review-kind), `consolidation/gap.json`.

### challenger

"이게 왜 아직 틀릴 수 있지?"를 묻는 적대적 리뷰어. 다른 모두가 "이게 맞는가?"를 물을 때 반대 방향에서 검증한다.

- **권한:** High/critical risk task의 review slot. Full_depth 미션의 mission-level deliberation 참여자.
- **판단 기준:** 숨겨진 가정, 과신, 취약한 복잡성, 검토되지 않은 실패 케이스, 범위 유출, trust boundary 위반. 모든 challenge review에는 실질적 우려가 최소 하나 이상 들어가야 하며, 내용 없는 approval은 허용되지 않는다.
- **산출물:** `tasks/{task_id}/evidence/challenger.challenger.json`(review-kind), 미션 단위 deliberation 중에는 deliberation evidence.

---

## Software Profile

소프트웨어 엔지니어링 미션용. `plugin/agents/software/`에 정의되어 있다.

| Slot | Agent | 핵심 책임 |
|---|---|---|
| `implementer` | [software-engineer](#software-engineer) | 풀스택 구현 (프론트엔드, 백엔드, 디자인) |
| `implementer` | [platform-engineer](#platform-engineer) | 인프라, 배포, 환경, 운영 준비 |
| `verifier` | [qa-engineer](#qa-engineer) | 수용 기준의 독립 검증 |
| `risk-assessor` | [security-engineer](#security-engineer) | Trust boundary, 공격 면, 보안 평가 |
| `communicator` | [technical-writer](#technical-writer) | 문서 완전성, 정확성, 대상 적합성 |

Software profile에는 `implementer` 타입이 둘 있다. Task의 성격(기능 코드냐 플랫폼·운영 작업이냐)에 따라 오케스트레이터가 적절한 쪽을 고르고, 선택된 타입은 `contract.routing.primary_worker_type`에 기록된다.

### software-engineer

프론트엔드, 백엔드, 디자인 구현을 담당하는 풀스택 구현자. 데이터 흐름, 실패 모드, 사용자 인터랙션, 시스템 경계를 기준으로 사고한다. 스택 관례를 따르고, 입력을 검증하며, 관심사를 분리한다. Self-check는 정직하게 제출한다.

### platform-engineer

운영 기반을 다루는 구현자. 배포, CI/CD, 환경 설정, 롤백 가능성, 설정 드리프트, 운영 가시성을 담당한다. Output 자체가 구현 작업이므로 implementer slot에 들어간다. 다른 task의 운영 측면 리뷰가 필요할 때는 `operator` review slot을 명시적으로 요청한다.

### qa-engineer

구현 결과가 계약을 실제로 충족하는지 독립적으로 검증하는 verifier. 수용 기준에서 출발해 부정 경로를 우선적으로 검토하고, 구현자가 명시한 `known_risks`와 미검증 영역을 집중적으로 본다. 산출물은 `verification`-kind evidence이며 `review`-kind가 아니다. Verifier는 `required_reviewers`에 적히지 않더라도 모든 task에 implicit으로 존재한다.

### security-engineer

Trust boundary와 공격 면에 집중하는 risk-assessor. Trust boundary를 매핑하고, 인증과 인가를 점검하며, secret 처리를 검사하고, 인젝션 면과 OWASP Top 10 계열을 평가한다. 발견 사항은 실제 악용 가능성 기준으로 분류한다.

### technical-writer

전달물이 이해 가능하도록 보장하는 명확성 전문가. 문서 영향, 구현 대비 정확성, 대상 적합성, 신규 기능과 파괴적 변경의 완전성, 검색 가능성을 점검한다.

---

## Research Profile

연구·분석 미션용. `plugin/agents/research/`에 정의되어 있다.

| Slot | Agent | 핵심 책임 |
|---|---|---|
| `implementer` | [literature-analyst](#literature-analyst) | 체계적 문헌 탐색, 출처 평가, 종합 |
| `implementer` | [research-analyst](#research-analyst) | 실험 설계, 데이터 분석, 재현 가능한 evidence |
| `verifier` | [methodology-reviewer](#methodology-reviewer) | 방법론 건전성, 통계적 타당성, 재현성 |
| `risk-assessor` | [research-integrity-reviewer](#research-integrity-reviewer) | 윤리, 데이터 프라이버시, 편향, 타당성 위협 |
| `operator` | [research-engineer](#research-engineer) | 데이터 파이프라인, 컴퓨팅 자원, 환경 재현성 |
| `communicator` | [research-writer](#research-writer) | 연구 문서화, 인용 정확성, 대상에 맞는 기술 |

Research profile 역시 `implementer` 타입이 둘이다. 문헌 종합 작업인지 실증 실험 작업인지에 따라 오케스트레이터가 적합한 쪽을 고른다.

### literature-analyst

기존 지식을 탐색, 평가, 종합하는 체계적 연구자. 1차 자료를 선호하고, 출처 신뢰도를 평가하며, 모순을 명시적으로 식별하고, 지식 공백을 기록한다. 주요 주장에는 최소 3개의 독립 출처를 확보한다.

### research-analyst

실험을 설계하고, 데이터를 분석하며, 모델을 구축하고, 시뮬레이션을 실행하는 실증 연구자. 반증 가능한 가설에서 출발하며, 재현성을 위해 모든 변환을 기록하고, 부정 결과도 정직하게 보고하며, 불확실성을 정량화한다.

### methodology-reviewer

연구 방법의 건전성과 결과 재현성을 검증하는 엄밀성 수호자. 내적·외적 타당성, 통계적 적절성, 흔한 함정(p-hacking, 다중 비교, 선택 편향)을 점검하고, 결론이 evidence 강도에 부합하는지 확인한다.

### research-integrity-reviewer

책임 있는 연구 수행을 보장하는 윤리·타당성 수호자. 데이터 프라이버시와 동의, 편향 위험, 책임 있는 보고, 타당성 위협, 오해석·오용 가능성을 점검한다. 데이터 프라이버시 이슈는 언제나 블로킹이다.

### research-engineer

연구가 실행, 재현, 확장될 수 있도록 보장하는 인프라 전문가. 데이터 파이프라인 문서화, 환경 캡처, 데이터 버전 관리, 확장성, 산출물 전달 체계를 검증한다.

### research-writer

연구 결과를 명확하고 정확하게 전달하도록 보장하는 communication 전문가. 대상에 맞는 문체를 적용하고, 주장이 evidence에 뒷받침되는지 확인하며, 적절한 인용을 보장하고, 한계점이 눈에 띄는 위치에 있는지 점검한다.

---

## Slot Resolution

Slot은 두 단순한 경로로 구체 agent에 해석된다.

1. **Authority slot**은 agent 타입과 1:1이다. Slot 이름이 곧 파일 이름이다 — `decision-maker.md`, `design-authority.md`, `challenger.md`.
2. **Specialist slot**은 frontmatter에서 slot과 domain을 선언한 agent가 채운다 (예: `slot: verifier`, `domain: software`). 오케스트레이터는 미션 profile의 domain에 맞는 구체 agent를 선택한다.

Evidence 파일은 양쪽을 모두 담는다: `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.{slot}.json`. `agent`는 구체 타입(예: `qa-engineer`, `design-authority`), `slot`은 프로토콜 역할(`verifier`, `design-authority`, `risk-assessor`, …)이다. 파이프라인은 slot으로 라우팅하고 읽으며, 파일 이름은 "실제로 누가 그 slot을 맡았는지"를 감사용으로 남긴다.

오케스트레이션 로직은 오직 slot만 참조한다. `verifier` 리뷰는 qa-engineer가 수행하든 methodology-reviewer가 수행하든 동일하게 처리된다.

---

## Decision Boundary

어떤 결정을 누가 소유하는지 요약한다. 전체 테이블은 [`docs/protocol/01_AGENTS_AND_AUTHORITY.md`](../../protocol/01_AGENTS_AND_AUTHORITY.md)를 참고한다.

| 결정 | 소유자 |
|---|---|
| Phase 선택 및 task 라우팅 | 오케스트레이터 (미션 skill) |
| 구현 접근법(plan) | Implementer, implementation contract에 대한 리뷰어 동의와 함께 |
| Contract 구조적 리뷰 | design-authority |
| Evidence gate 판정 | Gate runner (기존 evidence에 대한 Tier 0 / Tier 1 / Tier 2) |
| 적대적 검증 | challenger |
| Task 종결 결정 | 오케스트레이터, evidence gate 통과 이후 |
| Mission verdict | decision-maker |
| 전문가 충돌 해결 | Deliberation, 최종 판정은 decision-maker |
| 영구 memory 승격 | 오케스트레이터, consolidating 단계에서 authority의 승인을 받아 |

---

## Reviewer Routing

각 task의 reviewer 구성은 task contract의 `routing` 필드가 확정한다.

- `routing.primary_worker_type` — 오케스트레이터가 contract 작성 시 고른 구체 implementer 타입.
- `routing.required_reviewers` — **review slot**(agent 이름이 아니다)의 목록. 한정된 enum에서 선택: `challenger`, `risk-assessor`, `operator`, `communicator`.

`verifier`는 모든 task에 implicit으로 필수이며 `required_reviewers`에 등장하지 않는다. 산출물이 `review`-kind가 아니라 `verification`-kind이기 때문이다.

구체 reviewer 타입은 dispatch 시점에 미션 domain profile로부터 해석된다. 소프트웨어 미션의 `risk-assessor` review slot은 `security-engineer`로, 연구 미션의 같은 slot은 `research-integrity-reviewer`로 디스패치된다. Contract가 slot을 기록하기 때문에 동일한 mission design이 profile을 넘나들어도 이식 가능하다.

---

## Agent Boundaries

스폰 가능한 모든 agent가 공유하는 운영 제약:

- Agent는 오케스트레이터가 sub-agent로 스폰한다. Agent가 다른 agent를 스폰하지 않는다.
- Agent는 작업을 수행하고 결과를 오케스트레이터에 반환한다.
- Agent는 evidence를 CLI를 통해서만 기록한다. 어떤 agent도 `.geas/`를 직접 건드리지 않는다.
- Agent는 task contract와 브리핑을 따른다.
- Agent는 가정이 아닌 evidence에 기반해 판단한다.
- Agent는 세션을 가로질러 기억할 가치가 있는 패턴을 evidence 항목의 `memory_suggestions`로 제안한다. Memory 승격은 오케스트레이터가 별도로 결정한다.
