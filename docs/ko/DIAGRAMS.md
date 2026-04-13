# Geas 프로토콜 다이어그램

이 문서는 Geas 프로토콜의 핵심 흐름을 Mermaid 다이어그램으로 시각화한다. 각 다이어그램은 해당 프로토콜 문서 번호를 명시한다.

## 목차

1. [미션 라이프사이클](#1-미션-라이프사이클)
2. [태스크 상태머신](#2-태스크-상태머신)
3. [에비던스 게이트 플로우](#3-에비던스-게이트-플로우)
4. [에이전트 상호작용](#4-에이전트-상호작용)
5. [파이프라인 실행 흐름](#5-파이프라인-실행-흐름)

---

## 1. 미션 라이프사이클

> 참조: `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`

미션은 4개의 페이즈를 순서대로 통과한다. 각 페이즈 전환에는 페이즈 게이트가 존재하며, 필수 산출물이 충족되어야 다음 페이즈로 진입할 수 있다.

```mermaid
flowchart LR
    subgraph 페이즈_흐름["미션 페이즈 흐름"]
        direction LR
        S["1. Specifying\n(명세화)"]
        B["2. Building\n(구현)"]
        P["3. Polishing\n(다듬기)"]
        E["4. Evolving\n(진화)"]
        C["완료"]
    end

    S -->|"페이즈 게이트 1\n- spec.json\n- design-brief.json (승인됨)\n- 1개 이상 태스크 계약"| B
    B -->|"페이즈 게이트 2\n- 모든 태스크 passed/cancelled\n- gap-assessment-building.json"| P
    P -->|"페이즈 게이트 3\n- gap-assessment-polishing.json\n- debt-register.json\n- blocked/escalated 태스크 없음"| E
    E -->|"페이즈 게이트 4\n- gap-assessment-evolving.json\n- mission-summary.md"| C

    style S fill:#4a90d9,color:#fff
    style B fill:#e67e22,color:#fff
    style P fill:#27ae60,color:#fff
    style E fill:#8e44ad,color:#fff
    style C fill:#2c3e50,color:#fff
```

### 페이즈별 핵심 활동

| 페이즈 | 핵심 활동 | 주요 산출물 |
|--------|----------|------------|
| Specifying | 요구사항 정규화, 스코프 확정, 태스크 분해 | 미션 스펙, 디자인 브리프, 태스크 계약 |
| Building | 핵심 가치 경로 구현, 태스크 클로저 순환 | 구현 계약, 게이트 결과, 클로저 패킷, 최종 판정 |
| Polishing | 전달 준비 경화, 전문가 슬롯 리뷰 | 전문가 리뷰, 부채 레지스터 갱신 |
| Evolving | 교훈 추출, 부채 정리, 메모리 시스템 반영 | 갭 평가, 규칙 갱신, 미션 요약 |

---

## 2. 태스크 상태머신

> 참조: `protocol/03_TASK_MODEL_AND_LIFECYCLE.md`

태스크는 7개의 주요 상태와 3개의 보조 상태를 가진다. 각 전환에는 필수 조건이 존재하며, 상태를 건너뛸 수 없다.

```mermaid
stateDiagram-v2
    [*] --> drafted

    drafted --> ready : contract.json 존재

    ready --> implementing : 구현 계약 승인됨\n(implementation_contract.status=approved)

    implementing --> reviewed : 자체점검 완료 +\nimplementer 에비던스

    reviewed --> integrated : 게이트 결과 pass +\nreviewer/tester 에비던스

    integrated --> verified : 에비던스 게이트 통과\n(통합 후 검증)

    verified --> passed : 최종 판정 pass +\nclosure + retrospective +\nchallenge_review (high/critical)

    passed --> [*]

    %% 되감기 경로
    integrated --> implementing : 게이트 실패\n(verify-fix 루프)
    integrated --> reviewed : 통합 실패/불일치
    verified --> ready : 최종 판정 iterate\n(명시적 복원 대상)
    verified --> implementing : 최종 판정 iterate
    verified --> reviewed : 최종 판정 iterate

    %% 보조 상태
    state "blocked\n(진행 불가)" as blocked
    state "escalated\n(권한 부족)" as escalated
    state "cancelled\n(작업 취소)" as cancelled

    ready --> blocked : 외부/구조적 장애
    implementing --> blocked : 외부/구조적 장애
    reviewed --> blocked : 외부/구조적 장애
    integrated --> blocked : 외부/구조적 장애

    ready --> escalated : 권한 경계 도달
    implementing --> escalated : 권한 경계 도달

    ready --> cancelled : 명시적 취소 (사유 기록)
    implementing --> cancelled : 명시적 취소 (사유 기록)

    blocked --> ready : 차단 원인 해결 +\n재검증 통과
    escalated --> ready : 에스컬레이션 해결 +\n의도적 재진입
```

### 대표 경로

| 경로 | 상태 흐름 |
|------|----------|
| 정상 경로 | drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed |
| 검증-수정 경로 | integrated(fail) -> implementing -> reviewed -> integrated -> verified -> passed |
| 제품-반복 경로 | verified -> iterate -> implementing/reviewed -> ... -> verified -> passed |

---

## 3. 에비던스 게이트 플로우

> 참조: `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`

에비던스 게이트는 3단계(Tier 0/1/2) 검증 메커니즘이다. 게이트, 투표 라운드, 최종 판정은 반드시 분리되어야 한다.

```mermaid
flowchart TD
    Start["게이트 시작"]

    subgraph Tier0["Tier 0 - 사전검사 (Precheck)"]
        T0_1["필수 산출물 존재 확인"]
        T0_2["태스크 상태 적격성"]
        T0_3["베이스라인/통합 전제조건"]
        T0_4["필수 리뷰셋 존재"]
        T0_5["워커 자체점검 존재"]
    end

    subgraph Tier1["Tier 1 - 기계적 검증 (Mechanical)"]
        T1_1["반복 가능한 검사 실행\n(빌드, 린트, 테스트, 타입검사 등)"]
        T1_2["실행 결과 기록\n(명령어, 종료 상태, 타임스탬프)"]
    end

    subgraph Tier2["Tier 2 - 계약/루브릭 검증 (Contract + Rubric)"]
        T2_1["인수 기준 충족 여부"]
        T2_2["스코프 위반 검사"]
        T2_3["알려진 위험 처리 상태"]
        T2_4["리뷰 결과 반영"]
        T2_5["루브릭 점수 평가\n(각 차원별 임계값)"]
        T2_6["스텁/플레이스홀더 검증"]
    end

    Start --> T0_1
    T0_1 --> T0_2 --> T0_3 --> T0_4 --> T0_5

    T0_5 -->|"모두 통과"| T1_1
    T1_1 --> T1_2

    T1_2 -->|"검사 통과"| T2_1
    T2_1 --> T2_2 --> T2_3 --> T2_4 --> T2_5 --> T2_6

    %% 결과 분기
    T0_5 -->|"산출물 누락"| BLOCK["block\n(구조적 전제조건 미충족)"]
    T0_5 -->|"부적격 상태"| ERROR["error\n(게이트 실행 자체 실패)"]
    T1_2 -->|"검사 실패"| FAIL["fail\n(구현/검증 품질 문제)"]
    T2_6 -->|"기준 미달"| FAIL
    T2_6 -->|"모두 충족"| PASS["pass\n(게이트 통과)"]

    PASS --> Closure["클로저 패킷 조립"]
    FAIL --> Rewind["되감기\n(retry_budget 1 소모)"]
    BLOCK --> Blocked["태스크 blocked 전환"]
    ERROR --> Resolve["원인 해결 후 재실행"]

    Closure --> Challenge{"챌린저 리뷰\n(high/critical 필수)"}
    Challenge -->|"차단 우려 없음"| Verdict["최종 판정\n(product-authority)"]
    Challenge -->|"차단 우려 있음"| VoteRound["투표 라운드\n(readiness_round)"]
    VoteRound -->|"ship"| Verdict
    VoteRound -->|"iterate"| Rewind2["되감기 후 재작업"]
    VoteRound -->|"escalate"| Escalated["태스크 escalated"]

    Verdict -->|"pass"| Done["태스크 passed"]
    Verdict -->|"iterate"| Rewind3["복원 대상 지정 후 재작업\n(retry_budget 미소모)"]
    Verdict -->|"escalate"| Escalated2["사용자에게 에스컬레이션"]

    style PASS fill:#27ae60,color:#fff
    style FAIL fill:#e74c3c,color:#fff
    style BLOCK fill:#f39c12,color:#fff
    style ERROR fill:#95a5a6,color:#fff
    style Done fill:#27ae60,color:#fff
```

### 게이트 프로필별 적용 범위

| 게이트 프로필 | Tier 0 | Tier 1 | Tier 2 | 사용 시점 |
|--------------|--------|--------|--------|----------|
| implementation_change | 실행 | 실행 | 실행 | 구현 변경이 있는 표준 태스크 |
| artifact_only | 실행 | 생략/축소 | 실행 | 문서, 설계, 리뷰, 분석 작업 |
| closure_ready | 실행 | 선택적 | 간소화 | 정리, 전달, 클로저 조립 태스크 |

---

## 4. 에이전트 상호작용

> 참조: `protocol/01_AGENT_TYPES_AND_AUTHORITY.md`

Geas는 권한 슬롯(Authority Slots)과 전문가 슬롯(Specialist Slots) 2계층 구조로 역할을 조직한다. 물리적 에이전트 하나가 여러 슬롯을 담당할 수 있으나, 산출물에서 역할 분리를 유지해야 한다.

```mermaid
flowchart TB
    subgraph Authority["권한 슬롯 (Authority Slots)"]
        direction TB
        OA["Orchestrator\n(orchestration_authority)\n\n미션 제어, 라우팅,\n시퀀싱, 복구, 메모리"]
        PA["Decision Maker\n(product_authority)\n\n제품 수락, 트레이드오프,\n최종 판정 (pass/iterate/escalate)"]
        DA["Design Authority\n(design_authority)\n\n구조적 일관성,\n계약 승인, 방법론 리뷰"]
        CH["Challenger\n(challenger)\n\n적대적 챌린지,\n숨겨진 위험 탐지"]
    end

    subgraph Specialist["전문가 슬롯 (Specialist Slots)"]
        direction TB
        IMP["Implementer\n1차 산출물 생산"]
        QS["Quality Specialist\n인수 기준 검증"]
        RS["Risk Specialist\n도메인 위험 평가"]
        OS["Operations Specialist\n전달/배포 준비"]
        CS["Communication Specialist\n문서/사용자 콘텐츠"]
    end

    %% 권한 흐름
    OA -->|"태스크 분해/라우팅\n미션 페이즈 선택"| IMP
    OA -->|"투표 라운드 소집\n클로저 패킷 조립"| PA
    OA -->|"계약 리뷰 요청\n설계 가이드 요청"| DA
    OA -->|"챌린저 리뷰 요청\n(high/critical 필수)"| CH

    DA -->|"구현 계약 승인/거부\n구조 리뷰"| IMP
    DA -->|"설계 피드백"| QS

    IMP -->|"자체점검 제출\n에비던스 생산"| QS
    IMP -->|"에비던스 생산"| DA

    QS -->|"테스트 결과\n인수 기준 검증"| OA
    RS -->|"위험 평가\n보안 리뷰"| OA
    OS -->|"운영 준비 확인"| OA
    CS -->|"문서 완전성 리뷰"| OA

    CH -->|"챌린지 결과\n(차단/비차단)"| PA

    PA -->|"최종 판정"| OA

    %% 스타일
    style OA fill:#2c3e50,color:#fff
    style PA fill:#8e44ad,color:#fff
    style DA fill:#2980b9,color:#fff
    style CH fill:#c0392b,color:#fff
    style IMP fill:#27ae60,color:#fff
    style QS fill:#16a085,color:#fff
    style RS fill:#d35400,color:#fff
    style OS fill:#7f8c8d,color:#fff
    style CS fill:#f39c12,color:#fff
```

### 의사결정 경계

| 의사결정 | 주 소유자 | 비고 |
|----------|----------|------|
| 미션 페이즈 선택 | Orchestrator | 미션 의도, 모드, 현재 에비던스 기반 |
| 태스크 분해/라우팅 | Orchestrator | 대규모 작업 시 Design Authority 자문 |
| 디자인 브리프 승인 | Decision Maker | full_depth 시 Design Authority 리뷰 필수 |
| 구현 계약 승인 | Design Authority 주도 리뷰어셋 | 도메인 전문가 서명 포함 가능 |
| 에비던스 게이트 판정 | 게이트 실행기 | 객관적 메커니즘 |
| 최종 판정 | Decision Maker | 클로저 패킷 기반 |

---

## 5. 파이프라인 실행 흐름

> 참조: `pipeline.md` (per-task pipeline reference)

documentation 종류(task_kind) 태스크의 파이프라인 실행 흐름이다. design, design_guide, implementation(워크트리 격리), integration 단계가 생략된다.

```mermaid
flowchart TD
    TaskStart["태스크 시작\n- TaskContract 읽기\n- 의존성 확인\n- ready 전환"]

    IC["1. 구현 계약\n(Implementation Contract)\n\n워커가 행동 계획 작성\nQA + Design Authority 승인"]

    Impl["2. 구현\n(Implementation)\n\n직접 편집 (워크트리 격리 없음)\n문서 작성/수정"]

    SC["3. 자체점검\n(Worker Self-Check)\n\n신뢰도(1-5), 알려진 위험,\n미테스트 경로, 요약"]

    subgraph Parallel["병렬 실행 가능"]
        direction LR
        SR["4a. 전문가 리뷰\n(Specialist Review)\n\nDesign Authority가\n구현 리뷰"]
        TEST["4b. 테스팅\n(Testing)\n\nQuality Specialist가\n인수 기준 검증"]
    end

    Reviewed["reviewed 전환\n(4a + 4b 모두 완료 후)"]

    EG["5. 에비던스 게이트\n(Evidence Gate)\n\nTier 0: 사전검사\nTier 1: 생략/축소 (artifact_only)\nTier 2: 계약/루브릭 검증"]

    EGResult{게이트 결과}

    VFL["verify-fix 루프\n(retry_budget 소모)"]

    CP["6. 클로저 패킷 조립\n(Closure Packet)\n\nchange_summary, reviews[],\nopen_risks, debt_items"]

    CHL{"7. 챌린저 리뷰\n(risk_level 기반)"}

    CHLRun["챌린저 리뷰 실행\n최소 1건 실질적 챌린지 필수"]

    FV["8. 최종 판정\n(Final Verdict)\n\nproduct-authority가\npass / iterate / escalate"]

    FVResult{판정 결과}

    Retro["9. 회고\n(Retrospective)\n\nwhat_went_well, what_broke,\nrule_candidates, memory_candidates"]

    Mem["10. 메모리 추출\n(Memory Extraction)\n\n규칙 갱신, 에이전트 메모리 반영"]

    Resolve["11. 완료\n(Resolve)\n\npassed 전환"]

    TaskStart --> IC
    IC -->|"승인됨"| Impl
    IC -->|"거부됨"| IC
    Impl -->|"implementing 전환"| SC
    SC --> Parallel
    SR --> Reviewed
    TEST --> Reviewed
    Reviewed --> EG

    EG --> EGResult
    EGResult -->|"pass"| CP
    EGResult -->|"fail"| VFL
    EGResult -->|"block"| TaskBlocked["blocked 전환"]
    EGResult -->|"error"| ErrorResolve["원인 해결 후 재실행"]
    VFL --> EG

    CP --> CHL
    CHL -->|"low 위험: 생략"| FV
    CHL -->|"high/critical: 필수"| CHLRun
    CHLRun -->|"비차단"| FV
    CHLRun -->|"차단 우려"| VoteRound["투표 라운드"]
    VoteRound -->|"ship"| FV
    VoteRound -->|"iterate/escalate"| Rewind["되감기/에스컬레이션"]

    FV --> FVResult
    FVResult -->|"pass"| Retro
    FVResult -->|"iterate"| IterRewind["복원 대상으로 되감기\n(retry_budget 미소모)"]
    FVResult -->|"escalate"| Escalate["에스컬레이션"]

    Retro --> Mem --> Resolve

    style TaskStart fill:#34495e,color:#fff
    style Resolve fill:#27ae60,color:#fff
    style TaskBlocked fill:#f39c12,color:#fff
    style Escalate fill:#e74c3c,color:#fff
```

### documentation 태스크 생략 규칙

| 단계 | 상태 |
|------|------|
| design | 생략 |
| design_guide | 생략 |
| implementation (워크트리 격리) | 생략 (직접 편집) |
| integration | 생략 |
| implementation_contract ~ resolve | 필수 (생략 불가) |

### 절대 생략 불가 단계

다음 단계는 task_kind에 관계없이 반드시 실행해야 한다:

- implementation_contract
- self_check
- specialist_review
- testing
- evidence_gate
- closure_packet
- final_verdict
- retrospective
- memory_extraction
- resolve
