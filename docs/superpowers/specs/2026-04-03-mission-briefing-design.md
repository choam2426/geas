# Mission Completion Briefing — Design Spec

**Date:** 2026-04-03
**Scope:** Evolving phase에 상세 미션 브리핑 단계 추가

## Problem Statement

현재 Evolving 단계의 product-authority 브리핑은 "what shipped, what was cut, product health" 수준의 전략적 요약만 제공. 테스트 모니터링에서 실제로 필요했던 정보 — 태스크별 파이프라인 실행 결과, 시간/토큰 메트릭, 잔여 이슈 — 는 events.jsonl과 여러 아티팩트를 직접 파싱해야만 알 수 있었음.

## Design

### 위치

`plugin/skills/orchestrating/references/evolving.md`의 "Product-authority Final Briefing" 이후, "Repository-manager Release Management" 이전에 새 섹션 추가.

### 작성자

orchestration_authority가 직접 작성 (에이전트 스폰 아님). 모든 `.geas/` 아티팩트를 읽어서 조립.

### 출력

1. **`.geas/summaries/mission-briefing.md`** — 사람이 읽는 마크다운 파일
2. **콘솔 요약** — 터미널에 핵심 메트릭 출력

### 브리핑 내용

#### Section 1: Task Execution Summary

각 태스크의 파이프라인 실행 결과를 테이블로:

```markdown
## Task Execution Summary

| Task | Title | Risk | Gate | Retries | Critical Reviewer | Verdict |
|------|-------|------|------|---------|-------------------|---------|
| task-005 | Team DB layer | high | pass | 0 | in-pipeline | ship |
| task-006 | Team HTTP handlers | high | pass | 0 | in-pipeline | ship |
| task-007 | Team CLI | normal | pass | 0 | in-pipeline | ship |
```

데이터 소스:
- 태스크 목록: events.jsonl에서 이번 미션의 `run_started` 타임스탬프 이후 `task_compiled` 이벤트가 있는 태스크만 필터 (이전 미션 태스크 제외)
- risk_level, gate 결과: 각 TaskContract + `gate-result.json`
- retry 횟수: gate-result의 iteration 필드 또는 events.jsonl의 gate_result 이벤트 카운트
- critical_reviewer 판별 기준:
  - `step_complete(critical_reviewer)` 타임스탬프가 `gate_result` 이후 ~ `task_resolved` 이전 → **in-pipeline**
  - `step_complete(critical_reviewer)` 타임스탬프가 `task_resolved` 이후 → **post-backfill**
  - `step_complete(critical_reviewer)` 이벤트 없음 → **skipped**
- verdict: `final-verdict.json`

#### Section 2: Metrics

```markdown
## Metrics

- **Total duration:** 1h 33m
- **Phase breakdown:** specifying 14m | building 68m | polishing 7m | evolving 5m
- **Subagents spawned:** 24
- **Token usage:** input 450K | output 120K (from token-summary.json)
- **Git commits:** 5
- **Memory candidates:** 2 new (mem-005-escalation-pattern, mem-005-sqlite-pragma)
```

데이터 소스:
- Duration: events.jsonl의 `run_started` ~ `phase_complete(complete)` 타임스탬프 차이
- Phase breakdown: `phase_complete` 이벤트 간 시간 차이
- Subagents: `costs.jsonl`의 `agent_stop` 이벤트 카운트
- Token usage: `ledger/token-summary.json`
- Git commits: `task_resolved` 이벤트 중 `commit` 필드가 있는 것 카운트
- Memory: `memory/candidates/` 디렉토리의 이번 미션 관련 파일

#### Section 3: Open Items

```markdown
## Open Items

### Technical Debt
- DEBT-008 (high): Missing input validation on team invite endpoint
- DEBT-009 (medium): No rate limiting on auth endpoints

### Risks
- task-006: [non-blocking] No pagination on team member list

### Recommended Follow-ups
- Add WebSocket notifications for team invite events
- Implement team deletion with cascade
```

데이터 소스:
- Debt: `.geas/evolution/debt-register.json`의 `status: "open"` 항목
- Risks: 각 태스크의 `closure-packet.json` → `open_risks.items`
- Follow-ups: `.geas/evolution/gap-assessment-evolving.json` → `recommended_followups`

### 콘솔 출력

브리핑 파일 작성 후 터미널에 요약:

```
[Orchestrator] Mission briefing written to .geas/summaries/mission-briefing.md

  Tasks: 3/3 passed | Duration: 1h 33m | Commits: 5
  Debt: 2 open (1 high) | Memory: 2 new candidates
```

### 기존 아티팩트와의 관계

- `mission-summary.md` (product-authority 작성) — 제품 관점 전략 요약. 유지.
- `mission-briefing.md` (orchestrator 작성) — 실행 관점 상세 메트릭. **신규.**
- `run-summary` (run-summary 스킬) — 세션 감사 추적. 유지.

세 파일은 서로 다른 관점을 커버하며 중복 아님.

## 변경 파일

- `plugin/skills/orchestrating/references/evolving.md` — 새 섹션 추가
- `plugin/skills/setup/SKILL.md` — `.geas/summaries/` 디렉토리는 이미 생성됨 (변경 불필요)

## Out of Scope

- resume 스킬 — 기존 session-init + recovery table로 충분
- conformance-checking 확장 — 미션 브리핑에 프로토콜 준수 정보가 자연스럽게 포함 (critical_reviewer 실행 여부 등)
- seed/run 구조 개선 — 다음 사이클
