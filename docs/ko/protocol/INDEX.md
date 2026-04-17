# INDEX

**Version**: v1  
**Status**: 프로토콜 문서 세트의 기준 읽기 안내

## 0. 읽는 순서

프로토콜은 lifecycle 흐름을 따른다. 00 → 10 순차 읽기를 권장한다.

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENTS_AND_EVIDENCE.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
6. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
7. `06_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `07_MEMORY_AND_RETROSPECTIVE.md`
9. `08_DEBT_AND_GAP.md`
10. `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
11. `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`

구현 참고 자료:
- `docs/protocol/schemas/` — JSON Schema 계약
- `docs/protocol/examples/` — artifact 예시

## 1. 문서 맵

- `00_PROTOCOL_FOUNDATIONS.md` — 통제 목표, invariant, conformance 단위, 우선순위 규칙, 위협 모델
- `01_AGENTS_AND_EVIDENCE.md` — 역할 분류, 권한, reviewer routing, specialist evidence 의무, 충돌 규칙
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission 모델, mission mode, 4-phase, phase gate, runtime anchor
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task 메타데이터, contract 품질, lifecycle 상태, 상태 복원, retry/iterate 규칙
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline 최신성, 재검증, workspace lifecycle, lock/scheduler 모델
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate 의미론, rubric 채점, vote round, closure packet, task closure decision, mission final verdict
- `06_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpoint, safe boundary, recovery 결정, replay vs restore
- `07_MEMORY_AND_RETROSPECTIVE.md` — memory 저장소, retrospective 루프, rule/agent-memory 흐름, 검색, 개인정보
- `08_DEBT_AND_GAP.md` — debt 추적, debt lifecycle, gap 평가, gap 해석
- `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract 철학, canonical artifact 패밀리, 디렉토리 구조, 검증 실패 처리
- `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hook, conformance 시나리오, transition guard, phase guard, observability, health signal

## 2. 용도별 권장 읽기

### Geas를 구현하려는 경우

읽기: `00`, `01`, `02`, `03`, `04`, `05`, `09`, `10`

### 프로덕션 AI 작업을 위해 강화하려는 경우

읽기: `00`, `05`, `07`, `10`

### 학습 시스템을 이해하려는 경우

읽기: `07`, `08`

### 문제가 발생한 세션을 감사하려는 경우

읽기: `03`, `04`, `05`, `06`, `09`, `10`

## 3. 구조 최적화

현재 프로토콜 구조는 일련의 통합 작업 결과를 반영한다:

- per-task artifact를 `record.json`으로 통합 (단일 파일, 섹션 누적)
- 역할 기반 evidence 도입 (`evidence/{agent}.json`)
- memory를 9-state lifecycle에서 2-state로 단순화 (draft / active)
- Session Recovery와 Runtime Artifacts를 별도 문서로 분리
- Agents와 Specialist Evidence를 단일 문서로 통합
- Memory와 Retrospective를 단일 문서로 통합
- Debt와 Gap을 독립된 문서로 분리
- 기계적 transition guard 추가 (task별 6개 + phase별 3개)
- convention과 rules를 `rules.md`로 통합
- event log를 `state/events.jsonl`로 통합
