# 13. Migration and Implementation Roadmap

## 목표

이 번들의 split docs와 schemas를 실제 코드베이스에 단계적으로 이식한다.

## Phase 1 — 최소 집행 가능 상태

**의존성**: 없음 (시작 phase)

먼저 구현할 것:
1. `task.json` / `implementation-contract.json` validator
2. `worker-self-check.json` validator
3. `ready -> implementing` admission hook
4. `specialist-review.json` / `integration-result.json` / `gate-result.json`
5. `closure-packet.json` completeness check
6. `final-verdict.json` 없이는 `passed` 금지

**완료 기준 deliverables**:
- schemas: `task.schema.json`, `implementation-contract.schema.json`, `worker-self-check.schema.json`, `specialist-review.schema.json`, `integration-result.schema.json`, `gate-result.schema.json`, `closure-packet.schema.json`, `final-verdict.schema.json`
- hooks: `pre_implementation` admission hook, `post_implementation` self-check hook, `pre_verdict_submission` completeness hook
- artifacts: 각 schema에 대한 validator 구현체

## Phase 2 — baseline, stale, parallelism

**의존성**: Phase 1 완료 필수

1. `base_commit` 검사
2. `revalidation-record.json`
3. lock manifest
4. integration lane serialization
5. bounded parallel dispatch

**완료 기준 deliverables**:
- schemas: `revalidation-record.schema.json`, `lock-manifest.schema.json`
- hooks: `stale_start` detection hook, `lock_conflict` detection hook, `integration_lane` serialization hook
- artifacts: base_commit 비교 로직, parallel dispatch scheduler

## Phase 3 — evolution core

**의존성**: Phase 2 완료 필수

1. `retrospective.json`
2. `rules-update.json`
3. `debt-register.json`
4. `gap-assessment.json`
5. phase review / mission summary wiring

**완료 기준 deliverables**:
- schemas: `retrospective.schema.json`, `rules-update.schema.json`, `debt-register.schema.json`, `gap-assessment.schema.json`, `phase-review.schema.json`
- hooks: `post_pass_learning` hook (retrospective 생성 강제), `phase_transition_review` hook (gap/debt/rules 존재 검사)
- artifacts: debt rollup 집계 로직, gap assessment 비교 로직

## Phase 4 — memory core

**의존성**: Phase 3 완료 필수

1. `memory-candidate.json`
2. `memory-entry.json`
3. `memory-review.json`
4. `memory-packet.json`
5. application log 기반 reinforcement / weakening
6. rules + agent_memory retrieval wiring

**완료 기준 deliverables**:
- schemas: `memory-candidate.schema.json`, `memory-entry.schema.json`, `memory-review.schema.json`, `memory-packet.schema.json`, `memory-application-log.schema.json`, `memory-index.schema.json`
- hooks: memory promotion gate hook, superseded memory injection 경고 hook
- artifacts: retrieval scoring 로직, packet builder, confidence/freshness 계산 로직

## Phase 5 — recovery and context engine

**의존성**: Phase 4 완료 필수

1. extended `run.json`
2. `recovery-packet.json`
3. `session-latest.md` / `task-focus` summary maintenance
4. packet stale regeneration hook
5. post-compact restore flow

**완료 기준 deliverables**:
- schemas: `run.schema.json` (확장), `recovery-packet.schema.json`
- hooks: `session_checkpoint` hook, `packet_stale` regeneration hook, post-compact restore hook
- artifacts: recovery decision table 구현, checkpoint two-phase write 로직, recovery incident record 생성기

## Phase 6 — refinement

**의존성**: Phase 1-5 모두 완료 필수

1. conformance suite 자동화
2. chaos exercise
3. memory review cadence tooling
4. policy registry tuning
5. debt/gap dashboard

**완료 기준 deliverables**:
- conformance suite: doc 12의 모든 conformance scenario를 자동화한 test suite
- chaos exercise 시나리오 구현 (아래 참조)
- memory review 주기 관리 도구 (review_after 만료 감지 및 알림)
- policy registry: `.geas/rules.md` 기반 override 관리 도구
- debt/gap dashboard: debt-register 및 gap-assessment 시각화

### Chaos Exercise 범위

chaos exercise는 아래 5개 시나리오를 테스트한다:
1. **mid-task interruption recovery**: task `implementing` 상태에서 세션 강제 종료 후 복구
2. **stale worktree recovery**: worktree의 base_commit이 현재 main보다 뒤처진 상태에서 재개
3. **lock orphan detection**: task가 종료됐으나 lock이 해제되지 않은 상태 감지 및 정리
4. **contradictory memory handling**: 동일 주제에 대해 상충하는 memory entry가 있을 때 packet builder의 동작 검증
5. **missing specialist review gate**: required specialist review가 누락된 상태에서 gate 진입 시도 차단 검증

## Phase 실패 시 대응

각 phase의 완료 기준 deliverables가 충족되지 않는 경우:

1. **validator/hook 구현 실패**: 해당 phase를 완료로 mark하지 않는다. 다음 phase에 진입할 수 없다.
2. **schema 변경이 기존 artifact와 호환되지 않는 경우**: migration script를 작성하여 기존 `.geas/` artifact를 새 schema로 변환한다. 변환 불가능한 artifact는 `_legacy/` 하위 디렉토리로 이동하고, 해당 artifact를 참조하는 task는 revalidation을 수행한다.
3. **이전 phase의 결함이 이후 phase에서 발견된 경우**: 결함이 발생한 phase로 돌아가 수정한다. 이미 완료된 이후 phase의 deliverables 중 결함의 영향을 받는 항목을 재검증한다.

## Skill Alignment Roadmap

현재 스킬 구현과 프로토콜 사이에 gap이 존재한다. 프로토콜이 목표이며, 스킬을 프로토콜에 맞춰 올린다.

### Phase 1 대상 (최소 집행)

| Gap | 현재 스킬 | 프로토콜 목표 | 영향 스킬 |
|-----|----------|-------------|----------|
| Worker Self-Check 생성 | 소비만 함, 생성 스킬 없음 | worker가 구현 완료 시 `worker-self-check.json` 생성 필수 | `evidence-gate`, `context-packet` |
| Closure Packet 조립 | 없음 | gate 통과 후 `closure-packet.json` 조립 | `initiative`, `sprint` |
| Task 상태 모델 | 5-state (`pending → in_progress → in_review → testing → passed`) | 7-state (`drafted → ready → implementing → reviewed → integrated → verified → passed`) | `task-compiler`, `initiative`, `sprint` |
| Tier 0 (Precheck) | 없음 | artifact 존재·상태·baseline 사전 확인 | `evidence-gate` |
| `block` gate verdict | `pass \| fail \| iterate` | `pass \| fail \| block` (block = 구조적 결함) | `evidence-gate` |
| Final Verdict 분리 | `product_authority` Tier 3가 gate와 verdict를 겸함 | Evidence Gate(객관 검증)와 Final Verdict(제품 판단) 분리 | `evidence-gate`, `initiative`, `sprint` |

### Phase 2 대상 (baseline, parallelism)

| Gap | 현재 스킬 | 프로토콜 목표 | 영향 스킬 |
|-----|----------|-------------|----------|
| `base_commit` 기록 | TaskContract에 없음 | task 메타데이터에 `base_commit` 필수 | `task-compiler` |
| `gate_profile` 분류 | 상황 기술로 대체 | `code_change \| artifact_only \| closure_ready` enum | `task-compiler`, `evidence-gate` |
| `task_kind`, `risk_level` | 미사용 | task 분류 필드로 routing·budget·gate 결정 | `task-compiler` |
| `vote_round_policy` | 미사용 | `never \| auto \| always` per task | `task-compiler`, `vote-round` |

### Phase 3 대상 (evolution core)

| Gap | 현재 스킬 | 프로토콜 목표 | 영향 스킬 |
|-----|----------|-------------|----------|
| `readiness_round` | 없음 | `ship \| iterate \| escalate` vote + quorum | `vote-round` |
| Vote severity | 없음 | `minor \| major` disagree 분류 | `vote-round` |
| Debt Register 구조화 | `.geas/debt.json` (비정형) | `debt-register.json` with severity/kind/status | `initiative` |
| Evolution Exit Gate | 없음 | gap-assessment + debt-register + rules-update + mission summary 필수 | `initiative` |
| Retrospective 시점 | task passed 전에 실행 | task passed 후에 실행 | `initiative`, `sprint` |

### Phase 4 대상 (memory core)

| Gap | 현재 스킬 | 프로토콜 목표 | 영향 스킬 |
|-----|----------|-------------|----------|
| Memory Evolution Pipeline | 없음 | 9-state lifecycle + 6-stage promotion | 신규 스킬 필요 |
| Memory candidate extraction | 수동 | 자동 추출 규칙 (2+ 반복 실패 등) | 신규 스킬 필요 |
| Rules.md update 조건 | 직접 수정 | evidence refs ≥ 2 또는 authority 승인 + `rules-update.json` | `initiative`, `sprint` |
| Application logging | 없음 | memory 적용 시 효과 기록 | 신규 메커니즘 필요 |
| Confidence per-dimension 조정 | global (전체 threshold +1) | per-dimension (해당 dimension만 +1) | `evidence-gate` |

### Phase 5 대상 (recovery, context)

| Gap | 현재 스킬 | 프로토콜 목표 | 영향 스킬 |
|-----|----------|-------------|----------|
| `remaining_steps` 체크포인트 | 스킬에 있지만 프로토콜에 없음 | 프로토콜에 반영 필요 (역방향 정합) | doc 10 업데이트 |
| Repeated partial delivery forward-feed | 없음 | 2+ gap assessment에 나타난 항목 → seed.json constraints | `initiative` |

### 프로토콜에 반영해야 할 스킬 고유 메커니즘

아래 항목은 스킬에 존재하지만 프로토콜에 없다. 프로토콜에 추가하거나 명시적으로 비범위로 선언해야 한다.

| 스킬 고유 항목 | 설명 | 권장 조치 |
|--------------|------|----------|
| Critical Reviewer Pre-ship Challenge | gate와 verdict 사이 challenge 단계 | 프로토콜에 추가 (closure packet → critical_reviewer challenge → final verdict) |
| Ship Gate (4-file check) | evidence bundle 존재 확인 | Tier 0 (Precheck)로 통합 |
| `remaining_steps` 체크포인트 | 세션 복구 핵심 메커니즘 | doc 10에 반영 |
| Entropy Scan / Cleanup | polish phase dead code 정리 | doc 02 polish phase에 추가 |
| Run Summary | 세션 감사 추적 | doc 12 observability에 추가 |

## Migration Rule

- 기존 단일 상세 문서는 reference로 보존한다.
- 새 논의와 구현은 split docs + schemas를 canonical로 삼는다.
- monolith의 의미 충돌이 보이면 canonical split docs가 우선한다.
- migration 진행 중 split docs 자체에 모순이 발견되면, 해당 모순을 `gap-assessment.json`에 기록하고 doc 14의 gap forward-feed 절차에 따라 해소한다.
