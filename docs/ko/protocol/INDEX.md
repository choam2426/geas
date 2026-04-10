# INDEX

**Version**: v1  
**Status**: 프로토콜 문서 세트의 기준 읽기 안내

## 0. 읽는 순서

### 프로토콜을 가장 빠르게 이해하는 경로

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `08_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
9. `11_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### 구현 중심 경로

1. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
2. `06_SPECIALIST_EVIDENCE_MATRIX.md`
3. `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
4. `docs/protocol/schemas/`
5. `docs/protocol/examples/`

## 1. 문서 맵

- `00_PROTOCOL_FOUNDATIONS.md` — 통제 목표, invariant, conformance 단위, 우선순위 규칙, 위협 모델
- `01_AGENT_TYPES_AND_AUTHORITY.md` — 역할 분류, 직무 분리, reviewer routing, 충돌 규칙
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission 모델, mission mode, 4-phase, 런타임 phase, phase gate
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task 메타데이터, contract 품질, lifecycle 상태, 상태 복원, retry/iterate 규칙
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline 최신성, 재검증, workspace lifecycle, lock/scheduler 모델
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate 의미론, rubric 채점, vote round, closure packet, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md` — specialist별 최소 evidence 의무와 포함 규칙
- `07_MEMORY_SYSTEM_OVERVIEW.md` — memory 목적, 2-state lifecycle, entry, agent memory, rules.md, 검색
- `08_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpoint, safe boundary, recovery 결정, replay vs restore
- `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract 철학, canonical artifact 패밀리, 디렉토리 구조, 검증 실패 처리
- `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hook, conformance 시나리오, transition guard, phase guard, observability, health signal
- `11_EVOLUTION_DEBT_AND_GAP_LOOP.md` — retrospective, debt, gap assessment, mission 간 carry-forward

## 2. 용도별 권장 읽기

### Geas를 구현하려는 경우

읽기: `00`, `01`, `02`, `03`, `04`, `05`, `09`, `10`

### 프로덕션 AI 작업을 위해 강화하려는 경우

읽기: `00`, `05`, `07`, `10`

### 학습 시스템을 이해하려는 경우

읽기: `07`

### 문제가 발생한 세션을 감사하려는 경우

읽기: `03`, `04`, `05`, `08`, `09`, `10`

## 3. 호환성 참고

v3 프로토콜 최적화는 다음과 같이 단순화한다:

- per-task artifact를 `record.json`으로 통합 (단일 파일, 섹션 누적)
- 역할 기반 evidence 도입 (`evidence/{agent}.json`)
- memory를 9-state에서 2-state로 단순화 (draft/active)
- memory 문서 08+09를 문서 07로 병합
- 기계적 transition guard 추가 (task별 6개 + phase별 3개)
- convention과 rules를 `rules.md`로 통합
- event log를 `state/events.jsonl`로 통합
