# INDEX

**Version**: v3

## 0. 읽는 순서

### 빠르게 구조를 잡고 싶을 때
1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `08_EVOLVING_MEMORY_LIFECYCLE.md`
8. `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
9. `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### 구현하려고 할 때
1. `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
2. `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
3. `schemas/`
4. `examples/`

## 1. 문서 맵

- `00_PROTOCOL_FOUNDATIONS.md`
  - 설계 원칙, 4 Pillars, scope/non-scope, 용어, canonical ownership
- `01_AGENT_TYPES_AND_AUTHORITY.md`
  - type-only agent model, 권한 경계, specialist 참여 원칙
- `02_MODES_MISSIONS_AND_RUNTIME.md`
  - mission 기반 4-phase model (specifying/building/polishing/evolving), runtime phase
- `03_TASK_MODEL_AND_LIFECYCLE.md`
  - task classification, lifecycle, implementation contract, worker self-check, transition invariants
- `04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md`
  - base_commit, worktree, stale/revalidation, lock model, parallel 처리
- `05_GATE_VOTE_AND_FINAL_VERDICT.md`
  - evidence gate, rubric scoring, vote round, closure packet, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md`
  - specialist type × artifact × closure/evolution inclusion 매트릭스
- `07_MEMORY_SYSTEM_OVERVIEW.md`
  - memory architecture, behavior-change surfaces, ownership, promotion pipeline 개요
- `08_EVOLVING_MEMORY_LIFECYCLE.md`
  - memory candidate → provisional → stable → superseded lifecycle 상세
- `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md`
  - retrieval scoring, packet assembly, context budget, stale packet 정책
- `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
  - checkpoint, recovery packet(필드 상세 포함), safe boundary, dirty state recovery, recovery → evolution feedback loop, evidence 보존 원칙
- `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
  - runtime artifact 및 memory artifact 계약 요약, drift 구체 사례, phase_targeting/review_after 필드 상세
- `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
  - hook/enforcement, conformance suite, metrics, health signal threshold 정의, low-quality incident/stub cap 정의
- `13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`
  - phase 간 의존성 명시, phase별 deliverables, chaos exercise 5개 시나리오 정의
- `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`
  - retrospective, rules.md update, role-specific lesson 판별 기준, debt lifecycle(scheduled→resolved 전환 조건), gap assessment forward-feeding, harmful reuse feedback loop
- `schemas/` — 13개 JSON Schema (draft 2020-12) + `_defs.schema.json` 공유 정의
- `examples/` — 9개 예제 파일 (각 schema에 대응)
