# 00. Protocol Foundations

## 목적

이 프로토콜은 **single-session + worktree 기반 멀티 agent 코딩 운영 규칙**을 정의한다. 핵심 목표는 아래 7가지다.

1. task를 유일한 closure 단위로 고정한다.
2. 구현, 통합, 검증, 종료 판단을 분리한다.
3. stale baseline, integration drift, false green, incomplete closure를 구조적으로 막는다.
4. 팀이 세션을 거듭할수록 나아지게 만든다 — retrospective, rule update, memory promotion, debt tracking, gap assessment가 하나의 **Evolution 루프**를 이룬다.
5. 긴 세션, compaction, 서브에이전트 실행 이후에도 복구 가능하게 만든다.
6. phase 종료 시 범위·부채·학습 상태를 다시 측정한다.
7. 프로토콜의 모든 메커니즘을 **4 Pillars** 아래 정렬한다.

## Four Pillars as Control Objectives

Geas의 프로토콜은 단순한 절차 모음이 아니라 네 가지 제어 목적을 만족해야 한다.

### 1) Governance
누가 어떤 결정을 내려도 되는지, 어떤 결정은 어떤 순서를 강제하는지 명확해야 한다.

Protocol binding:
- agent authority matrix
- transition invariants
- vote rounds
- final verdict ownership
- phase review / escalation

### 2) Traceability
모든 중요한 행위는 나중에 다시 설명 가능해야 한다.

Protocol binding:
- append-only ledger events
- runtime artifacts
- specialist reviews
- failure / revalidation / recovery records
- debt register / gap assessment / retrospective

### 3) Verification
"됐음"이 아니라 **계약 fulfilled**가 되어야 한다.

Protocol binding:
- implementation contract
- worker self-check
- evidence gate
- rubric scoring
- specialist review matrix
- closure packet + final verdict

### 4) Evolution
팀은 세션이 끝날수록 더 나아져야 한다.

Protocol binding:
- per-task retrospective
- rules.md update loop
- agent_memory / project_memory / risk_memory
- memory promotion / weakening / supersession
- debt tracking
- gap assessment
- initiative evolution phase

## 설계 원칙

### 1) Task가 유일한 closure 단위다
지금 프로토콜은 issue/epic/initiative closure를 first-class entity로 모델링하지 않는다. 닫히는 것은 task뿐이다.

### 2) 오케스트레이션과 최종 제품 판단은 분리한다
- `orchestration_authority`는 흐름을 설계하고, 조립하고, 강제한다.
- `product_authority`는 제품 관점의 최종 verdict를 내린다.

### 3) 상태 전이는 artifact 기반이다
자연어 선언으로 상태를 바꾸지 않는다. 각 전이는 필요한 artifact, evidence, review, verdict가 있어야 한다.

### 4) Git이 live baseline의 source of truth다
live HEAD를 runtime artifact에 중복 저장하지 않는다. task는 `base_commit`을 갖고, 현재 기준은 Git에서 읽는다.

### 5) memory는 저장소가 아니라 행동 변경 장치다
memory는 future packet, reviewer focus, gate strictness, scheduling caution, rules.md를 통해 다음 행동을 바꿔야 한다.

### 6) 테스트 통과와 종료는 다르다
`verified`는 기술적 검증 통과, `passed`는 protocol상 종료 가능 상태다.

### 7) 시작 전 stale에는 엄격하고 구현 중 drift에는 관대하다
- 시작 전: stale task는 반드시 revalidate
- 구현 중: upstream 이동만으로 즉시 중단하지 않음
- 통합 전: 반드시 재정산

### 8) gate는 검증 장치, vote round는 결정 장치다
- evidence gate는 objective verification
- vote round는 disagreement resolution / ship readiness deliberation
- final verdict는 product closure decision

### 9) specialist 참여는 evidence에 반영되어야 한다
누가 참여했는지는 closure packet과 artifact matrix에 남아야 한다.

## Scope / Non-Scope

### Scope
- single-session orchestration
- worktree-based task execution
- bounded parallelism
- task lifecycle / gate / verdict / recovery / memory / context management
- initiative 4-phase mission progression
- retrospective / debt / gap assessment feedback loops

### Non-Scope
- multi-session distributed scheduler
- human issue tracker sync
- multi-repo federation
- global knowledge graph

## 용어 정리

- **Task**: 닫히는 유일한 작업 단위
- **Mission**: 세션이 해결하려는 상위 목적. 하나 이상의 task를 낳을 수 있음
- **Mode**: `discovery | delivery | decision`
- **Runtime Phase**: `bootstrap | planning | scheduling | executing | integrating | verifying | learning | idle`
- **Mission Phase**: `discovery | build | polish | evolution`
- **Baseline**: task가 마지막으로 유효하다고 확인된 통합 브랜치 기준 커밋
- **Worktree**: task 전용 작업 공간
- **Gate**: objective verification. 결과는 `pass | fail | block | error` 중 하나 (doc 05 참조)
- **Gate Profile**: task의 gate 검증 방식을 결정하는 분류. `code_change | artifact_only | closure_ready`
- **Vote Round**: specialist 간 합의 또는 readiness 확인. `proposal_round`과 `readiness_round` 두 종류가 있음
- **Vote Round Policy**: task별 vote round 실행 조건. `never | auto | always`
- **Closure Packet**: final verdict를 위한 압축 증거 묶음
- **Final Verdict**: product_authority가 closure packet을 기반으로 내리는 최종 판단. `pass | iterate | escalate`
- **FailureRecord**: task 실패 시 생성하는 기록. 실패 원인, rewind target, 시점을 포함. 실패는 별도 state가 아니라 이 record로 추적
- **Decision Record**: decision mode에서 논쟁/충돌/피벗을 정리한 결과 artifact
- **Memory**: task/mission/project 수준에서 재사용되는 구조화된 운영 지식
- **Debt**: 지금 막지 않지만 future cost를 발생시키는 known compromise
- **Gap Assessment**: 원래 scope_in과 실제 delivered scope_out 사이의 차이를 평가하는 절차
- **Implementation Contract**: 코드 작성 전 worker와 reviewer가 합의하는 구현 계획 (doc 03 참조)
- **Worker Self-Check**: primary worker가 구현 완료 주장 전에 남기는 자기 점검 artifact (doc 03 참조)
- **Specialist Review**: specialist가 task에 대해 수행한 검토 결과 artifact (doc 06 참조)

## Canonical Ownership

- canonical 문서: `docs/`
- canonical 스키마: `schemas/`
- runtime/output: `.geas/`
- reference only: `reference/`
