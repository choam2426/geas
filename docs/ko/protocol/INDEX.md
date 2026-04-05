# INDEX

**Version**: v2  
**Status**: 프로토콜 문서 세트의 규범적 읽기 안내

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
9. `13_ASSURANCE_PROFILES_AND_STANDARDS_ALIGNMENT.md`
10. `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### 구현 지향 경로

1. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
2. `06_SPECIALIST_EVIDENCE_MATRIX.md`
3. `08_EVOLVING_MEMORY_LIFECYCLE.md`
4. `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md`
5. `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
6. `docs/protocol/schemas/`
7. `docs/protocol/examples/`

## 1. 문서 맵

- `00_PROTOCOL_FOUNDATIONS.md` — control objective, invariant, conformance unit, 우선순위 규칙, threat model
- `01_AGENT_TYPES_AND_AUTHORITY.md` — role 분류, 권한 분리, reviewer routing, conflict 규칙
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission 모델, mission mode, 4개 phase, runtime phase, phase gate
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task metadata, contract 품질, lifecycle 상태, 상태 복원, retry 및 iterate 규칙
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline freshness, revalidation, workspace lifecycle, lock 및 scheduler 모델
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate 의미론, rubric scoring, vote round, closure packet, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md` — specialist별 최소 evidence 의무 및 inclusion 규칙
- `07_MEMORY_SYSTEM_OVERVIEW.md` — memory 목적, admissibility, confidence, behavior surface
- `08_EVOLVING_MEMORY_LIFECYCLE.md` — candidate-to-canonical lifecycle, decay, supersession, harmful reuse rollback
- `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md` — context packet 조립, provenance, stale packet 규칙, injection hygiene
- `10_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpointing, safe boundary, recovery 결정, replay vs restore
- `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract 철학, canonical artifact family, validation failure
- `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hook, conformance 시나리오, observability, health signal, 필수 response
- `13_ASSURANCE_PROFILES_AND_STANDARDS_ALIGNMENT.md` — assurance profile, 외부 표준 정렬, override 자세
- `14_EVOLUTION_DEBT_AND_GAP_LOOP.md` — retrospective, debt, gap assessment, mission carry-forward

## 2. 용도별 권장 읽기

### Geas를 구현하려는 경우

읽기: `00`, `01`, `02`, `03`, `04`, `05`, `10`, `11`, `12`, `13`

### 프로덕션 AI 개발을 위해 Geas를 강화하려는 경우

읽기: `00`, `05`, `09`, `10`, `12`, `13`, `14`

### 학습 시스템을 이해하려는 경우

읽기: `07`, `08`, `09`, `14`

### 고장난 세션을 감사하려는 경우

읽기: `03`, `04`, `05`, `10`, `11`, `12`

## 3. 호환성 참고

v2 프로토콜은 canonical artifact-first 모델을 의도적으로 보존하면서 아래를 추가한다:

- 더 강력한 normative 언어
- assurance profile
- 더 명확한 conformance 및 override 기대치
- 더 강력한 context 및 recovery hygiene
- schema-minimum 필드와 hardening 권고 사항 사이의 더 명확한 구분
