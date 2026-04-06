# Agents Reference

Geas는 **slot 기반 역할 아키텍처**를 사용한다. Contract engine은 추상적인 **slot**(decision_maker, design_authority, challenger, implementer, quality_specialist, risk_specialist, operations_specialist, communication_specialist)을 정의하고, 도메인 **profile**이 각 slot을 구체적인 agent 타입에 매핑한다. 이 분리 덕분에 동일한 거버넌스 파이프라인이 소프트웨어 엔지니어링, 연구, 또는 향후 추가되는 어떤 profile에도 contract engine 변경 없이 적용된다.

**Orchestrator**(`orchestration_authority`)는 phase를 조율하고, agent를 스폰하며, task 흐름을 관리하는 mission skill이다. 스폰 가능한 agent가 아니며 profile 정의에 포함되지 않는다.

정식 정의: `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
Agent 파일: `plugin/agents/`

---

## Authority Agent

Authority agent는 **모든 profile에 공유**된다. 도메인과 무관하게 거버넌스, 구조적 리뷰, 적대적 검증을 담당한다.

| Agent 타입 | Slot | 모델 | 핵심 책임 |
|---|---|---|---|
| [product-authority](#product-authority) | `decision_maker` | opus | Task 종결 최종 판정 (pass / iterate / escalate) |
| [design-authority](#design-authority) | `design_authority` | opus | 구조적 일관성, 인터페이스 리뷰, contract 승인 |
| [challenger](#challenger) | `challenger` | opus | 적대적 사전 출시 검증, 차단 사유 제기 |

### product-authority

사용자 가치의 대변인. 작업물의 출시, 반복, 제거에 대한 최종 결정권을 가진다.

- **권한:** 최종 판정(pass/iterate/escalate), 우선순위 조정, 범위 정의(P0/P1/P2/OUT), 전문가 합의 실패 시 트레이드오프 판단.
- **판단 기준:** 결정 전 모든 evidence를 검토한다. Gate 통과가 곧 출시를 의미하지 않으며, 제품 적합성이 중요하다. 과잉 설계, 범위 확장, 필수 기능으로 위장한 부수 기능에 도전한다.
- **산출물:** `final-verdict.json`

### design-authority

구조적 일관성의 수호자. 경계, 인터페이스, 의존성, 유지보수성을 리뷰한다.

- **권한:** implementation contract의 구조적 리뷰 및 승인, 인터페이스와 의존성 결정, 구조적 무결성이 위협받을 때 차단 권한.
- **판단 기준:** 접근 방식이 유지보수 가능한 경계를 만드는지 평가한다. 취약한 결합, 과도한 복잡성, 숨겨진 의존성을 점검한다. Stub과 placeholder는 범위가 명시적으로 한정되어야 한다.
- **산출물:** `specialist-review.json`, 프로젝트 관례

### challenger

"왜 이것이 틀릴 수 있는가?"를 묻는 적대적 리뷰어. 다른 모든 이가 "이것이 맞는가?"를 물을 때 반대 방향에서 검증한다.

- **권한:** high/critical risk task에 대한 차단 권한, high/critical risk에 대한 필수 사전 출시 검증.
- **판단 기준:** 숨겨진 가정, 과신, 취약한 복잡성, 검토되지 않은 실패 케이스, 범위 유출, trust boundary 위반을 탐색한다. 모든 challenge review에는 최소 하나의 실질적 우려가 포함되어야 한다.
- **산출물:** `challenge-review.json`, `specialist-review.json`

---

## Software Profile

소프트웨어 엔지니어링 mission용. `plugin/agents/software/`에 정의되어 있다.

| Slot | Agent 타입 | 핵심 책임 |
|---|---|---|
| `implementer` | [software-engineer](#software-engineer) | 풀스택 구현 (프론트엔드, 백엔드, 디자인) |
| `quality_specialist` | [qa-engineer](#qa-engineer) | 검증, 인수 기준, 루브릭 채점 |
| `risk_specialist` | [security-engineer](#security-engineer) | Trust boundary, 공격 면, 보안 평가 |
| `operations_specialist` | [platform-engineer](#platform-engineer) | CI/CD, 배포, 환경, 운영 준비도 |
| `communication_specialist` | [technical-writer](#technical-writer) | 문서 완전성, 정확성, 대상 적합성 |

### software-engineer

프론트엔드, 백엔드, 디자인 구현을 담당하는 풀스택 구현자. 데이터 흐름, 실패 모드, 사용자 인터랙션, 시스템 경계를 기준으로 사고한다. 스택 관례를 따르고, 입력을 검증하며, 관심사를 분리한다. 정직한 self-check를 제출한다.

### qa-engineer

구현된 결과물이 실제로 동작하는지 검증하는 품질 관문. 인수 기준에서 출발하여 부정 경로를 우선시하며, 작업자의 `untested_paths[]`와 `possible_stubs[]`를 집중 공략한다. 결과를 구체적 evidence와 함께 루브릭 점수로 보고한다.

### security-engineer

Trust boundary와 공격 면에 집중하는 위험 평가자. Trust boundary를 매핑하고, 인증과 인가를 점검하며, secret 처리를 검사하고, 인젝션 면과 OWASP Top 10을 평가한다. 발견 사항을 실제 악용 가능성 기준으로 분류한다.

### platform-engineer

구현된 결과물이 배포, 운영, 유지보수될 수 있도록 보장하는 운영 기반. 배포 영향, CI/CD 영향, 롤백 가능성, 설정 드리프트, 운영 가시성을 점검한다.

### technical-writer

구현된 결과물을 이해할 수 있도록 보장하는 명확성 전문가. 문서 영향, 구현 대비 정확성, 대상 적합성, 신규 기능 및 파괴적 변경에 대한 완전성, 검색 가능성을 점검한다.

---

## Research Profile

연구 및 분석 mission용. `plugin/agents/research/`에 정의되어 있다.

| Slot | Agent 타입 | 핵심 책임 |
|---|---|---|
| `implementer` | [literature-analyst](#literature-analyst) | 체계적 문헌 탐색, 출처 평가, 종합 |
| `implementer` | [research-analyst](#research-analyst) | 실험 설계, 데이터 분석, 재현 가능한 evidence |
| `quality_specialist` | [methodology-reviewer](#methodology-reviewer) | 방법론적 건전성, 통계적 타당성, 재현성 |
| `risk_specialist` | [research-integrity-reviewer](#research-integrity-reviewer) | 윤리, 데이터 프라이버시, 편향, 타당성 위협 |
| `operations_specialist` | [research-engineer](#research-engineer) | 데이터 파이프라인, 컴퓨팅 자원, 환경 재현성 |
| `communication_specialist` | [research-writer](#research-writer) | 연구 문서화, 인용 정확성, 대상에 맞는 기술 |

참고: Research profile에는 두 가지 `implementer` 타입이 있다. Orchestrator가 `task_kind`와 scope에 따라 적절한 implementer에 task를 라우팅한다.

### literature-analyst

기존 지식을 탐색, 평가, 종합하는 체계적 연구자. 1차 자료를 선호하고, 출처 신뢰도를 평가하며, 모순을 명시적으로 식별하고, 지식 공백을 기록한다. 주요 주장에 대해 최소 3개의 독립 출처를 확보한다.

### research-analyst

실험을 설계하고, 데이터를 분석하며, 모델을 구축하고, 시뮬레이션을 실행하는 실증 연구자. 명확한 반증 가능 가설에서 출발하며, 재현성을 위해 모든 변환을 기록하고, 부정적 결과를 정직하게 보고하며, 불확실성을 정량화한다.

### methodology-reviewer

연구 방법의 건전성과 결과의 재현 가능성을 검증하는 엄밀성 수호자. 내적·외적 타당성, 통계적 적절성, 흔한 함정(p-hacking, 다중 비교, 선택 편향)을 점검하고, 결론이 evidence 강도에 부합하는지 확인한다.

### research-integrity-reviewer

책임있는 연구 수행을 보장하는 윤리 및 타당성 수호자. 데이터 프라이버시와 동의, 편향 위험, 책임있는 보고, 타당성 위협, 오해석 또는 오용 가능성을 점검한다. 데이터 프라이버시 문제는 항상 차단 사유이다.

### research-engineer

연구가 실행, 재현, 확장될 수 있도록 보장하는 인프라 전문가. 데이터 파이프라인 문서화, 환경 캡처, 데이터 버전 관리, 확장성, 산출물 전달 체계를 검증한다.

### research-writer

연구 결과가 명확하고 정확하게 전달되도록 보장하는 커뮤니케이션 전문가. 대상에 맞는 문체를 적용하고, 주장이 evidence에 뒷받침되는지 확인하며, 적절한 인용을 보장하고, 한계점이 눈에 띄는 위치에 배치되었는지 점검한다.

---

## Slot Resolution

Orchestrator는 mission 시작 시 추상적 slot을 구체적 agent 타입으로 해석한다:

1. Mission spec이 `domain_profile`을 선언한다 (예: `"software"`, `"research"`).
2. Orchestrator가 `profiles.json`(`plugin/skills/core/mission/references/` 내)을 읽어 해당 profile의 slot-agent 매핑을 가져온다.
3. Authority agent(product-authority, design-authority, challenger)는 모든 profile에 공유된다.
4. Agent 스폰 시, Orchestrator는 활성 profile에서 slot을 조회하여 대응하는 agent 타입을 스폰한다.

이 구조 덕분에 contract engine, evidence gate, 검증 흐름은 특정 agent 타입을 참조하지 않고 slot만 참조한다. `quality_specialist` 리뷰는 qa-engineer가 수행하든 methodology-reviewer가 수행하든 동일하게 동작한다.

---

## Decision Boundary

어떤 결정을 누가 소유하는지 요약한다. 전체 테이블은 `protocol/01` 참조.

| 결정 | 소유자 |
|---|---|
| Phase 선택 및 task 라우팅 | Orchestrator (mission skill) |
| 구현 접근법 | Implementer + design-authority |
| 구조적 리뷰 | design-authority |
| Evidence gate 결과 | Gate 실행자 / 검증자 |
| 적대적 검증 | challenger |
| 최종 종결 판정 | product-authority |
| 전문가 충돌 해결 | Vote round, 이후 product-authority |
| 영구 memory 승격 | Orchestrator + 승인 authority |

---

## Reviewer Routing

Task에는 `task_kind`, `risk_level`, `scope`, `gate_profile`에 따라 리뷰어가 할당된다. 전체 알고리즘은 `protocol/01`에 정의되어 있다. 핵심 규칙:

1. **task_kind 기본값** -- 각 task kind에 기본 reviewer slot이 지정된다 (예: `implementation` → design_authority, `documentation` → communication_specialist).
2. **리스크 에스컬레이션** -- `high`/`critical` risk는 challenger와 risk_specialist를 추가한다.
3. **Scope 시그널** -- 영향 범위와 scope 마커에 따라 관련 specialist slot이 추가된다.
4. **Gate profile** -- `closure_ready`는 quality_specialist를 필수로 한다.
5. **최소 보장** -- 모든 task는 primary worker와 다른 타입의 리뷰어를 최소 하나 가진다 (design_authority가 폴백).

라우팅은 agent 타입이 아닌 **slot 이름**을 사용한다. 활성 profile이 slot을 구체적 agent로 해석한다.

---

## Agent Boundary

모든 스폰 가능 agent가 공유하는 운영 제약:

- Orchestrator에 의해 서브 에이전트로 스폰된다 -- agent가 다른 agent를 스폰하지 않는다.
- 작업을 수행하고 결과를 Orchestrator에 반환한다.
- 지정된 artifact 경로에 evidence를 기록한다.
- TaskContract와 context packet을 따른다.
- 가정이 아닌 evidence에 기반하여 판단한다.
- 세션 간 기억할 가치가 있는 패턴을 `memory_suggestions`로 제안한다.
