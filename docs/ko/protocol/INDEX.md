# INDEX

**Version**: v2  
**Status**: 프로토콜 문서 세트의 읽기 안내

## 0. 읽는 순서

### 프로토콜을 가장 빠르게 이해하는 경로

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
9. `13_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### 구현 중심 경로

1. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
2. `06_SPECIALIST_EVIDENCE_MATRIX.md`
3. `08_EVOLVING_MEMORY_LIFECYCLE.md`
4. `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md`
5. `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
6. `docs/protocol/schemas/`
7. `docs/protocol/examples/`

## 1. 문서 맵

- `00_PROTOCOL_FOUNDATIONS.md` — 통제 목표, invariant, conformance 단위, 우선순위 규칙, 위협 모델
- `01_AGENT_TYPES_AND_AUTHORITY.md` — 역할 분류, 직무 분리, reviewer routing, 충돌 규칙
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission 모델, mission mode, 4-phase, 런타임 phase, phase gate
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task 메타데이터, contract 품질, lifecycle 상태, 상태 복원, retry/iterate 규칙
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline 최신성, 재검증, workspace lifecycle, lock/scheduler 모델
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate 의미론, rubric 채점, vote round, closure packet, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md` — specialist별 최소 evidence 의무와 포함 규칙
- `07_MEMORY_SYSTEM_OVERVIEW.md` — memory 목적, 수용 기준, confidence, 행동 표면
- `08_EVOLVING_MEMORY_LIFECYCLE.md` — candidate에서 canonical까지의 lifecycle, decay, supersession, harmful reuse rollback
- `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md` — context packet 조립, 출처, stale packet 규칙, injection hygiene
- `10_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpoint, safe boundary, recovery 결정, replay vs restore
- `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract 철학, canonical artifact 패밀리, 검증 실패 처리
- `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hook, conformance 시나리오, observability, health signal, policy override
- `13_EVOLUTION_DEBT_AND_GAP_LOOP.md` — retrospective, debt, gap assessment, mission 간 carry-forward

## 2. 용도별 권장 읽기

### Geas를 구현하려는 경우

읽기: `00`, `01`, `02`, `03`, `04`, `05`, `10`, `11`, `12`

### 프로덕션 AI 작업을 위해 강화하려는 경우

읽기: `00`, `05`, `09`, `10`, `12`, `13`

### 학습 시스템을 이해하려는 경우

읽기: `07`, `08`, `09`, `13`

### 문제가 발생한 세션을 감사하려는 경우

읽기: `03`, `04`, `05`, `10`, `11`, `12`

## 3. 호환성 참고

v2 프로토콜은 canonical artifact 중심 모델을 유지하면서 다음을 추가한다:

- 더 강한 규범적 표현
- 도메인 무관 역할 구조 (authority slot + specialist slot)
- 더 명확한 conformance 및 override 기대치
- 더 강한 context 및 recovery hygiene
- 필수 필드와 권장 필드의 명확한 구분
