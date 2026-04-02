# Hooks 레퍼런스

Geas hook은 Claude Code 하네스가 수명 주기 이벤트마다 자동 실행하는 셸 스크립트입니다. 거버넌스 불변 조건을 강제하고, 에이전트 컨텍스트를 주입하며, 텔레메트리를 기록합니다. 오케스트레이터가 기억해서 호출할 필요 없습니다.

설정: `plugin/hooks/hooks.json`
스크립트: `plugin/hooks/scripts/`

---

## Hook 목록

7개 수명 주기 이벤트에 걸쳐 18개 hook.

| # | 이벤트 | 매처 | 스크립트 | 목적 |
|---|--------|------|----------|------|
| 1 | SessionStart | (전체) | session-init.sh | 세션 초기화 |
| 2 | SessionStart | (전체) | memory-review-cadence.sh | 만료된 메모리 review_after 날짜 감지 |
| 3 | PreToolUse | Write | checkpoint-pre-write.sh | 쓰기 전 run.json 백업 (2단계 체크포인트) |
| 4 | PostToolUse | Write\|Edit | protect-geas-state.sh | .geas/ 상태 파일 보호 |
| 5 | PostToolUse | Write\|Edit | verify-task-status.sh | 작업 상태 전환 검증 |
| 6 | PostToolUse | Write\|Edit | check-debt.sh | 부채 임계값 경고 |
| 7 | PostToolUse | Write\|Edit | stale-start-check.sh | 작업 시작 시 오래된 base_commit 경고 |
| 8 | PostToolUse | Write\|Edit | lock-conflict-check.sh | 충돌하는 잠금 대상 감지 |
| 9 | PostToolUse | Write\|Edit | memory-promotion-gate.sh | 메모리 승격 조건 검증 |
| 10 | PostToolUse | Write\|Edit | memory-superseded-warning.sh | 패킷 내 오래된 메모리 경고 |
| 11 | PostToolUse | Write\|Edit | checkpoint-post-write.sh | 쓰기 후 대기 중인 체크포인트 정리 |
| 12 | PostToolUse | Write\|Edit | packet-stale-check.sh | 오래된 컨텍스트 패킷 경고 |
| 13 | PostToolUse | Bash | integration-lane-check.sh | 통합 잠금 없이 병합 시 경고 |
| 14 | SubagentStart | (전체) | inject-context.sh | 하위 에이전트에 컨텍스트 주입 |
| 15 | SubagentStop | (전체) | agent-telemetry.sh | 에이전트 실행 텔레메트리 기록 |
| 16 | Stop | (전체) | verify-pipeline.sh | 파이프라인 완료 검증 |
| 17 | Stop | (전체) | calculate-cost.sh | 세션 비용 계산 |
| 18 | PostCompact | (전체) | restore-context.sh | 컨텍스트 압축 후 상태 복원 |

---

## Hook 수명 주기

Geas 세션에서 hook이 실행되는 순서입니다.

```
세션 시작
│
├─► SessionStart       → session-init.sh
│     .geas/ 상태 확인, rules.md 컨텍스트 주입
│
├─► SessionStart       → memory-review-cadence.sh
│     review_after 날짜가 지난 메모리 항목 경고
│
│   [하위 에이전트 생성마다]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     rules.md + 에이전트 메모리를 하위 에이전트에 주입
│   │
│   │   [run.json에 Write 도구 호출 전]
│   │   │
│   │   ├─► PreToolUse (Write) → checkpoint-pre-write.sh
│   │   │     덮어쓰기 전 run.json 백업 (2단계 체크포인트)
│   │   │
│   │   [Write 또는 Edit 도구 호출 후]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     타임스탬프 주입, 금지 경로 경고, seed.json 보호
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → verify-task-status.sh
│   │   │     5개 필수 evidence 파일 + rubric_scores 검증
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → check-debt.sh
│   │   │     HIGH 부채 항목 3개 이상이면 경고
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → stale-start-check.sh
│   │   │     작업 base_commit과 통합 tip이 다르면 경고
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → lock-conflict-check.sh
│   │   │     작업 간 겹치는 잠금 대상 감지
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → memory-promotion-gate.sh
│   │   │     메모리 상태 승격을 위한 evidence/신호 임계값 검증
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → memory-superseded-warning.sh
│   │   │     대체/무효화된 메모리가 컨텍스트 패킷에 있으면 경고
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → checkpoint-post-write.sh
│   │   │     성공적 쓰기 후 대기 중인 체크포인트 백업 제거
│   │   │
│   │   └─► PostToolUse (Write|Edit) → packet-stale-check.sh
│   │         세션 복구 후 컨텍스트 패킷이 오래되었을 수 있으면 경고
│   │
│   │   [Bash 도구 호출 후]
│   │   │
│   │   └─► PostToolUse (Bash) → integration-lane-check.sh
│   │         통합 잠금 없이 git merge/rebase 실행 시 경고
│   │
│   │   [컨텍스트 압축 발생 시]
│   │   │
│   │   └─► PostCompact → restore-context.sh
│   │         run.json 상태, remaining_steps, NEXT STEP 재주입
│   │
│   └─► SubagentStop   → agent-telemetry.sh
│         에이전트 생성 메타데이터를 costs.jsonl에 기록
│
세션 종료
│
├─► Stop               → verify-pipeline.sh   [BLOCKING]
│     완료된 모든 작업에 필수 evidence가 있는지 확인
│
└─► Stop               → calculate-cost.sh
      토큰 사용량 + 예상 비용 요약
```

---

## Hook 1 — session-init.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SessionStart` |
| 스크립트 | `plugin/hooks/scripts/session-init.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

Claude Code 세션 시작 시 한 번 실행됩니다.

1. **hook 입력 JSON에서 `cwd`를 읽습니다.** `cwd`가 없으면 즉시 종료합니다.
2. **`.geas/` 디렉토리를 확인합니다.** 없으면 Geas 프로젝트가 아닙니다. 조용히 종료합니다.
3. **`.geas/state/run.json`을 확인합니다.** 없으면 stderr에 경고를 출력합니다: `[Geas] .geas/ directory exists but no run.json. Run setup first.`
4. **run.json에서 세션 상태를 로드합니다.** stderr에 재개 요약을 출력합니다:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
   checkpoint가 있으면 추가로 출력합니다:
   ```
   [Geas] Checkpoint: task=<task_id>, step=<pipeline_step>, agent=<agent_in_flight>
   ```
5. **`.geas/rules.md`가 없으면 만듭니다.** evidence 형식 요구사항과 금지 경로 규칙이 포함된 내장 템플릿을 씁니다.

### 조건

- `cwd`가 비어 있으면 건너뜁니다.
- `.geas/`가 없으면 건너뜁니다 (Geas 프로젝트가 아님).
- `run.json`이 없으면 로딩을 건너뛰지만 경고는 출력합니다.

---

## Hook 2 — memory-review-cadence.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SessionStart` |
| 스크립트 | `plugin/hooks/scripts/memory-review-cadence.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (메모리 시스템) |

### 동작

세션 시작 시 session-init 이후 한 번 실행됩니다. 메모리 인덱스에서 `review_after` 날짜가 지난 항목을 검색합니다.

1. **`.geas/state/memory-index.json`을 읽습니다.** 파일이 없으면 조용히 종료합니다.
2. **`provisional`, `stable`, `canonical` 상태인 모든 항목을 순회합니다.**
3. **각 항목의 `review_after` 날짜를** 현재 UTC 시간과 비교합니다.
4. **만료된 항목이 있으면 최대 10개까지 경고합니다:**
   ```
   Warning: MEMORY REVIEW DUE: 3 entries past review_after date:
     - mem-001 (stable, due 2026-03-15T00:00:00Z)
     - mem-002 (provisional, due 2026-03-20T00:00:00Z)
   Run batch review via /geas:memorizing.
   ```

### 조건

- `.geas/state/memory-index.json`이 없으면 건너뜁니다.
- 활성 상태(provisional, stable, canonical)인 항목만 확인합니다.
- 만료 항목은 최대 10개까지 표시하고 나머지는 개수로 알려줍니다.

---

## Hook 3 — checkpoint-pre-write.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PreToolUse` |
| 매처 | `Write` |
| 스크립트 | `plugin/hooks/scripts/checkpoint-pre-write.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (체크포인트 시스템) |

### 동작

모든 `Write` 도구 호출 전에 실행됩니다. `run.json`을 위한 2단계 체크포인트의 전반부를 구현합니다.

1. **쓰기 대상이 `.geas/state/run.json`인지 확인합니다.** 다른 쓰기는 무시합니다.
2. **`run.json`을 `_checkpoint_pending`으로 복사합니다.** 후속 쓰기가 실패하거나 파일이 손상되면 이 백업을 복구에 사용할 수 있습니다.

이 hook은 `checkpoint-post-write.sh`와 함께 동작합니다. 후자는 쓰기 성공 후 대기 파일을 제거합니다.

### 조건

- `.geas/state/run.json`에 쓸 때만 동작합니다.
- `run.json`이 아직 없으면(첫 쓰기) 건너뜁니다.

---

## Hook 4 — protect-geas-state.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/protect-geas-state.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 세 가지 책임이 있습니다.

**1. 금지 경로 경고**

`.geas/tasks/<current_task_id>.json`에서 현재 작업의 `prohibited_paths`를 읽습니다. 쓰여진 파일이 해당 glob 패턴과 일치하면(`fnmatch` 사용) stderr에 경고합니다:
```
[Geas] WARNING: Write to <rel_path> matches prohibited path "<pattern>" in <task_id>
```
`.geas/` 내부 경로는 이 검사에서 항상 제외됩니다.

**2. 자동 타임스탬프 주입**

쓰여진 파일 경로가 `*/.geas/*.json`과 일치하면, `created_at` 필드를 검사합니다. 다음 경우에 실제 UTC 타임스탬프(`YYYY-MM-DDTHH:MM:SSZ`)를 주입합니다:
- `created_at`이 없거나 비어 있을 때
- `created_at`이 더미 값(`:00:00Z` 또는 `:00:00.000Z`로 끝남)일 때

에이전트가 `created_at`을 직접 설정할 필요 없습니다. hook이 쓰기 후 자동으로 수정합니다.

**3. seed.json 동결 보호**

쓰여진 파일이 `*/.geas/spec/seed.json`이면 stderr에 경고합니다:
```
[Geas] Warning: seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes.
```

### 조건

- hook 입력에서 `cwd`나 `file_path`를 파싱할 수 없으면 즉시 건너뜁니다.
- `run.json`에 활성 `current_task_id`가 없거나 작업 파일이 없으면 금지 경로 검사를 건너뜁니다.
- 타임스탬프 주입은 `.geas/` 아래 `.json` 파일에만 적용됩니다.
- seed.json 경고는 내용과 무관하게 해당 경로에 쓸 때마다 발생합니다.

---

## Hook 5 — verify-task-status.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/verify-task-status.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 작업 파일이 쓰여질 때만 동작합니다.

1. **`.geas/tasks/*.json` 파일에만 반응합니다.** 나머지는 무시합니다.
2. **작업 파일을 읽습니다.** `status`가 `"passed"`이면 5개 필수 evidence 파일이 있는지 확인합니다:

   | 파일 | 역할 |
   |---|---|
   | `.geas/evidence/<tid>/architecture-authority-review.json` | Code Review (Architecture Authority) |
   | `.geas/evidence/<tid>/qa-engineer.json` | QA Testing (QA Engineer) |
   | `.geas/evidence/<tid>/challenge-review.json` | Critical Reviewer Pre-ship Challenge |
   | `.geas/evidence/<tid>/product-authority-verdict.json` | Final Verdict (Product Authority) |
   | `.geas/tasks/<tid>/retrospective.json` | Process Lead 회고 |

   누락 파일마다 stderr에 경고합니다.

3. **sentinel과 forge-review evidence에서 `rubric_scores`를 검증합니다.** `qa-engineer.json`이나 `architecture-authority-review.json`이 있는데 비어 있지 않은 `rubric_scores` 필드가 없으면:
   ```
   [Geas] Warning: <tid> qa-engineer.json is missing rubric_scores
   [Geas] Warning: <tid> architecture-authority-review.json is missing rubric_scores
   ```

### 조건

- `.geas/tasks/*.json`에 쓸 때만 동작합니다.
- 작업 `status`가 `"passed"`일 때만 evidence를 확인합니다.
- rubric_scores 검사는 해당 evidence 파일이 이미 있을 때만 실행합니다.

---

## Hook 6 — check-debt.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/check-debt.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 부채 원장에만 반응합니다.

1. **`.geas/state/debt-register.json`에만 반응합니다.** 나머지는 무시합니다.
2. **부채 파일을 읽고** `severity == "HIGH"`이고 `status == "open"`인 항목을 셉니다.
3. **3개 이상이면 경고합니다:**
   ```
   [Geas] <N> HIGH tech debts open. Consider addressing before new features.
   ```
   stderr에 출력합니다. 파이프라인은 차단하지 않습니다.

### 조건

- `.geas/state/debt-register.json`에 쓸 때만 동작합니다.
- 경고 임계값은 열린 HIGH 항목 3개입니다.

---

## Hook 7 — stale-start-check.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/stale-start-check.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (worktree/병렬화) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 작업이 `implementing`으로 전환될 때만 동작합니다.

1. **`.geas/tasks/*.json` 파일에만 반응합니다.** 나머지는 무시합니다.
2. **작업 파일을 읽습니다.** `status`가 `"implementing"`일 때만 진행합니다.
3. **작업의 `base_commit`을** 현재 `git rev-parse HEAD`와 비교합니다.
4. **다르면 경고합니다:**
   ```
   STALE BASE_COMMIT: Task base_commit (<hash>) differs from integration tip (<hash>). Run revalidation before proceeding.
   ```

작업이 컴파일된 이후 다른 작업이 통합되어 워커가 오래된 코드베이스에서 작업할 수 있는 상황을 감지합니다.

### 조건

- `.geas/tasks/*.json`에 쓸 때만 동작합니다.
- `status`가 `"implementing"`일 때만 확인합니다.
- `base_commit`이 비어 있거나 git을 사용할 수 없으면 건너뜁니다.

---

## Hook 8 — lock-conflict-check.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/lock-conflict-check.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (worktree/병렬화) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 잠금 파일에만 반응합니다.

1. **`.geas/state/locks.json`을 확인합니다.** 없으면 조용히 종료합니다.
2. **보유 중인 모든 잠금을 `lock_type`별로 그룹화합니다.**
3. **같은 잠금 유형 내에서** 다른 작업이 보유한 잠금 간에 겹치는 대상을 감지합니다.
4. **충돌 시 경고합니다:**
   ```
   LOCK CONFLICT DETECTED:
   edit: TASK-001 vs TASK-002 on ['src/auth.ts']
   ```

두 병렬 작업이 동일한 파일을 조용히 수정하는 것을 방지합니다.

### 조건

- `.geas/state/locks.json`이 있을 때만 동작합니다.
- `status == "held"`인 잠금만 확인합니다.
- 같은 `lock_type` 내에서만 비교합니다.

---

## Hook 9 — memory-promotion-gate.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/memory-promotion-gate.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (메모리 시스템) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 메모리 항목 파일에만 반응합니다.

1. **`.geas/memory/entries/*.json` 파일에만 반응합니다.** 나머지는 무시합니다.
2. **메모리 항목을 읽고** 현재 `state`에 따라 승격 조건을 확인합니다:

   | 상태 | 필수 조건 |
   |---|---|
   | `provisional` | 2개 이상의 `evidence_refs` 또는 `evidence_count >= 2` |
   | `stable` | 3회 이상의 `successful_reuses`와 `contradiction_count` 0 |
   | `canonical` | 5회 이상의 `successful_reuses` |

3. **조건이 충족되지 않으면 경고합니다:**
   ```
   Warning: MEMORY PROMOTION: stable promotion requires 3+ successful_reuses (has 1)
   Warning: MEMORY PROMOTION: stable promotion requires 0 contradictions (has 2)
   ```

### 조건

- `.geas/memory/entries/*.json`에 쓸 때만 동작합니다.
- 검사는 상태별로 다릅니다 — 각 승격 단계마다 고유한 임계값이 있습니다.

---

## Hook 10 — memory-superseded-warning.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/memory-superseded-warning.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (메모리 시스템) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. 컨텍스트 패킷 파일에만 반응합니다.

1. **`.geas/packets/*.md` 파일에만 반응합니다.** 나머지는 무시합니다.
2. **`.geas/state/memory-index.json`을 읽어** 메모리 ID와 현재 상태의 맵을 만듭니다.
3. **패킷 내용을 스캔하여** 메모리 ID 참조(패턴: `[mem-*]`)를 찾습니다.
4. **참조된 메모리가 비활성 상태**(superseded, under_review, decayed, archived, rejected)이면 경고합니다:
   ```
   Warning: STALE MEMORY: mem-003 has state "superseded" — should not be in active packet
   ```

에이전트가 대체되거나 무효화된 오래된 메모리에 기반해 행동하는 것을 방지합니다.

### 조건

- `.geas/packets/*.md`에 쓸 때만 동작합니다.
- `.geas/state/memory-index.json`이 없으면 건너뜁니다.
- 비활성 상태의 메모리만 플래그합니다.

---

## Hook 11 — checkpoint-post-write.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/checkpoint-post-write.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (체크포인트 시스템) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. `run.json`을 위한 2단계 체크포인트의 후반부를 구현합니다.

1. **쓰기 대상이 `.geas/state/run.json`인지 확인합니다.** 다른 쓰기는 무시합니다.
2. **`.geas/state/_checkpoint_pending`이 있으면 제거합니다.** 쓰기가 성공적으로 완료되었음을 확인합니다.

이 hook은 `checkpoint-pre-write.sh`와 함께 동작합니다. 두 hook이 함께 `run.json`에 대한 쓰기가 중간에 실패하면 백업이 복구에 사용 가능하도록 보장합니다.

### 조건

- `.geas/state/run.json`에 쓸 때만 동작합니다.
- 대기 중인 체크포인트가 없으면 아무것도 하지 않습니다.

---

## Hook 12 — packet-stale-check.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Write\|Edit` |
| 스크립트 | `plugin/hooks/scripts/packet-stale-check.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (세션 복구) |

### 동작

모든 `Write` 또는 `Edit` 도구 호출 후에 실행됩니다. `run.json`이 쓰여질 때만 동작합니다.

1. **`.geas/state/run.json`에만 반응합니다.** 나머지는 무시합니다.
2. **`run.json`을 읽고** `recovery_class`가 설정되어 있는지 확인합니다(복구된 세션을 나타냄).
3. **현재 작업의 컨텍스트 패킷이** `.geas/packets/<task_id>/` 아래에 있는지 확인합니다.
4. **복구된 세션에서 패킷이 있으면 경고합니다:**
   ```
   Warning: STALE PACKETS: Session recovered (<recovery_class>). Context packets for <task_id> may be stale. Regenerate before spawning agents.
   ```

세션 복구 후, 이전에 생성된 컨텍스트 패킷은 오래된 상태를 참조할 수 있습니다. 이 hook은 에이전트가 오래된 브리핑으로 생성되지 않도록 합니다.

### 조건

- `.geas/state/run.json`에 쓸 때만 동작합니다.
- `current_task_id`가 설정되지 않았으면 건너뜁니다.
- 현재 작업의 컨텍스트 패킷이 없으면 건너뜁니다.
- `recovery_class`가 null이 아닐 때만 경고합니다.

---

## Hook 13 — integration-lane-check.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostToolUse` |
| 매처 | `Bash` |
| 스크립트 | `plugin/hooks/scripts/integration-lane-check.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |
| 추가 시점 | Phase 1 (worktree/병렬화) |

### 동작

모든 `Bash` 도구 호출 후에 실행됩니다. 단일 비행 통합 레인 규칙을 강제합니다.

1. **Bash 명령에 `git merge` 또는 `git rebase`가 포함되어 있는지 확인합니다.** 다른 명령은 무시합니다.
2. **`.geas/state/locks.json`을 읽고** 보유 중인 `integration` 잠금을 찾습니다.
3. **통합 잠금이 없으면 경고합니다:**
   ```
   INTEGRATION LANE: No integration_lock held. Acquire integration_lock before merging to ensure single-flight integration.
   ```

통합 브랜치를 손상시킬 수 있는 동시 병합 작업을 방지합니다.

### 조건

- `git merge` 또는 `git rebase`가 포함된 Bash 명령에만 동작합니다.
- `locks.json`이 없으면 경고합니다(차단하지는 않음).
- `integration` 유형이고 `status`가 `held`인 잠금이 없으면 경고합니다.

---

## Hook 14 — inject-context.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SubagentStart` |
| 스크립트 | `plugin/hooks/scripts/inject-context.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

하위 에이전트가 생성될 때마다 실행됩니다. 프로젝트 규칙과 에이전트별 메모리를 하위 에이전트의 시작 컨텍스트에 주입합니다.

1. **hook 입력 JSON에서 `cwd`와 `agent_type`을 읽습니다.** `agent_type`에 플러그인 접두사(예: `geas:nova`)가 있으면 제거해서 에이전트 이름(`nova`)만 씁니다.
2. **`.geas/` 디렉토리를 확인합니다.** 없으면 조용히 종료합니다.
3. **`.geas/rules.md`를 읽습니다.** `--- PROJECT RULES (.geas/rules.md) ---` 헤더 아래 컨텍스트 블록에 포함합니다.
4. **`.geas/memory/agents/<agent_name>.md`가 있으면 읽습니다.** `--- YOUR MEMORY (.geas/memory/agents/<agent_name>.md) ---` 헤더 아래 포함합니다. 에이전트별 메모리가 세션을 넘어 유지됩니다.
5. **stdout에 JSON 객체를 출력합니다:**
   ```json
   { "additionalContext": "..." }
   ```
   하네스가 하위 에이전트의 첫 메시지 전에 시스템 컨텍스트에 머지합니다.

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뜁니다.
- 해당 에이전트의 메모리 파일이 없으면 메모리 주입을 건너뜁니다.
- rules.md와 메모리 파일 모두 없으면 아무것도 출력하지 않습니다.

---

## Hook 15 — agent-telemetry.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `SubagentStop` |
| 스크립트 | `plugin/hooks/scripts/agent-telemetry.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

하위 에이전트가 끝날 때마다 실행됩니다. 에이전트 생성 메타데이터를 원장에 기록합니다. 실제 토큰 수는 기록하지 **않습니다**. 그건 세션 종료 시 `calculate-cost.sh`가 합니다.

1. **hook 입력에서 `cwd`와 `agent_type`을 읽습니다.** 플러그인 접두사를 제거합니다 (예: `geas:nova` -> `nova`).
2. **`run.json`에서 현재 `task_id`와 `phase`를 가져옵니다.**
3. **하드코딩된 매핑에서 모델을 결정합니다:**
   - `opus`: nova, forge, circuit, pixel, critic
   - `sonnet`: 나머지 에이전트
4. **`.geas/ledger/costs.jsonl`에 JSONL 항목을 추가합니다:**
   ```json
   {
     "event": "agent_complete",
     "agent": "nova",
     "task_id": "TASK-001",
     "phase": "build",
     "model": "opus",
     "timestamp": "2026-03-30T12:00:00Z"
   }
   ```
   디렉토리가 없으면 만듭니다.

### 조건

- `cwd`가 비어 있거나 `run.json`이 없으면 건너뜁니다.
- 활성 작업이 없어도 `costs.jsonl`에 추가합니다 (`task_id`는 빈 문자열일 수 있습니다).

---

## Hook 16 — verify-pipeline.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/verify-pipeline.sh` |
| **차단** | **함 — exit 2로 세션 종료를 차단합니다** |
| 타임아웃 | 30초 |

### 동작

세션이 종료되려 할 때 실행됩니다. 시스템에서 **파이프라인을 차단할 수 있는 유일한 hook**입니다. exit code 2를 반환합니다.

1. **`.geas/`와 `run.json`을 확인합니다.** 없으면 exit 0 (허용). Geas 프로젝트가 아니면 영향 없습니다.
2. **완료된 작업이 없으면 건너뜁니다** (`completed_tasks`가 비어 있음). 검증할 것이 없습니다.
3. **`completed_tasks`의 모든 작업 ID**를 돌면서 5개 필수 evidence 파일을 확인합니다:

   | 파일 | 설명 |
   |---|---|
   | `.geas/evidence/<tid>/architecture-authority-review.json` | Code Review |
   | `.geas/evidence/<tid>/qa-engineer.json` | QA Testing |
   | `.geas/evidence/<tid>/challenge-review.json` | Critical Reviewer Pre-ship Challenge |
   | `.geas/evidence/<tid>/product-authority-verdict.json` | Final Verdict (Product Authority) |
   | `.geas/tasks/<tid>/retrospective.json` | Process Lead 회고 |

4. **파일이 빠져 있으면** stderr에 출력합니다:
   ```
   [Geas] Pipeline incomplete. MANDATORY evidence missing:
     - TASK-001: qa-engineer.json (QA Testing) missing
     - TASK-001: tasks/TASK-001/retrospective.json (Process Lead Retrospective) missing

   Execute the missing steps before completing the session.
   ```
   **exit code 2**로 종료합니다. 하네스가 세션 종료를 차단합니다.

5. **모든 evidence가 있으면** exit 0. 세션이 정상 종료됩니다.

### Exit code

| 코드 | 의미 |
|---|---|
| 0 | 파이프라인 완료 — 세션 종료 허용 |
| 2 | evidence 누락 — 세션 종료 차단 |

### 조건

- Geas 프로젝트가 아니면 (`.geas/` 없음) 절대 차단하지 않습니다.
- 완료된 작업이 없으면 절대 차단하지 않습니다.

---

## Hook 17 — calculate-cost.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `Stop` |
| 스크립트 | `plugin/hooks/scripts/calculate-cost.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 30초 |

### 동작

세션 종료 시 실행됩니다 (`verify-pipeline.sh` 이후). `~/.claude/projects/`의 하위 에이전트 세션 JSONL 파일을 파싱해 실제 토큰 사용량과 예상 비용을 계산합니다.

1. **Claude 프로젝트 디렉토리를 찾습니다.** `cwd`를 Claude의 프로젝트 해시 형식으로 정규화합니다 (예: `A:\geas-test3` -> `A--geas-test3`). `~/.claude/projects/` 아래에서 매칭합니다.
2. **`subagents/` 하위 디렉토리가 있는 가장 최근 세션을 찾습니다.**
3. **해당 디렉토리의 모든 하위 에이전트 JSONL 파일을 파싱합니다.** `assistant` 메시지마다 누적합니다:
   - `input_tokens`
   - `output_tokens`
   - `cache_creation_input_tokens`
   - `cache_read_input_tokens`
4. **`.meta.json` 사이드카 파일에서 에이전트 유형을 읽어** 역할별 토큰 수를 집계합니다.
5. **Opus 가격을 상한으로 예상 비용을 계산합니다:**
   - 입력: $15 / 1M 토큰
   - 출력: $75 / 1M 토큰
   - 캐시 생성: $3.75 / 1M 토큰
   - 캐시 읽기: $1.50 / 1M 토큰
6. **`.geas/ledger/cost-summary.json`에 전체 분석을 씁니다:**
   ```json
   {
     "session_cost_usd": 1.23,
     "tokens": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "cost_breakdown_usd": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "agent_count": 8,
     "agents": { "nova": { "input": 0, "output": 0, "spawns": 2 }, ... },
     "calculated_at": "2026-03-30T12:00:00Z"
   }
   ```
   에이전트는 output 토큰 내림차순으로 정렬됩니다.
7. **stderr에 요약을 출력합니다:**
   ```
   [Geas] Session cost: $1.23 (8 agents, 12,345 output tokens)
   ```

### 조건

- `cwd`가 비어 있거나 `.geas/`가 없으면 건너뜁니다.
- `~/.claude/projects/`에서 Claude 프로젝트 디렉토리를 못 찾으면 건너뜁니다.
- `subagents/` 디렉토리가 있는 세션을 못 찾으면 건너뜁니다.
- 개별 JSONL 파싱 오류는 조용히 무시합니다. 이 hook은 best-effort입니다.

---

## Hook 18 — restore-context.sh

| 필드 | 값 |
|---|---|
| 이벤트 | `PostCompact` |
| 스크립트 | `plugin/hooks/scripts/restore-context.sh` |
| 차단 | 안 함 (항상 exit 0) |
| 타임아웃 | 10초 |

### 동작

Claude Code 하네스가 컨텍스트 창을 압축할 때마다 실행됩니다. 압축이 대화 기록을 버리면 오케스트레이터가 현재 작업과 파이프라인 위치를 잃습니다. 이 hook이 핵심 상태를 다시 주입합니다.

1. **`.geas/`와 `run.json`을 확인합니다.** 없으면 조용히 종료합니다.
2. **`run.json`에서 컨텍스트 블록을 만듭니다:**
   - `Mode | Phase | Status`
   - `Mission`
   - `Current task ID`
   - `Completed tasks` (마지막 5개)
3. **checkpoint가 있으면 포함합니다:**
   - `Pipeline step` (진행 중이던 단계)
   - `Agent in flight` (실행 중이던 에이전트)
   - **`Remaining steps`** — 남은 파이프라인 단계 목록
   - **`NEXT STEP`** — `remaining_steps`의 첫 번째 항목. 오케스트레이터가 바로 다음에 뭘 할지 알 수 있습니다
4. **활성 작업이 있으면 현재 task contract** (목표 + acceptance criteria)를 포함합니다.
5. **`.geas/rules.md`의 처음 30줄**을 `--- KEY RULES ---` 헤더 아래 포함합니다.
6. **stdout에 JSON 객체를 출력합니다:**
   ```json
   { "additionalContext": "..." }
   ```

**배치 복구:** `parallel_batch`가 null이 아니면 배치 작업 목록과 `completed_in_batch` 수를 출력합니다. Compass가 재실행이 필요한 작업을 결정하는 데 사용합니다.

### 조건

- `cwd`가 비어 있거나 `.geas/run.json`이 없으면 건너뜁니다.
- checkpoint가 없으면 checkpoint 섹션을 생략합니다.
- `current_task_id`가 없거나 작업 파일이 없으면 task contract 섹션을 생략합니다.
- `rules.md`가 없으면 규칙 섹션을 생략합니다.

---

## Hook 커스터마이징

hook은 `plugin/hooks/hooks.json`에 선언합니다. 스키마:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<tool_name_regex_or_empty>",
        "hooks": [
          {
            "type": "command",
            "command": "<absolute_path_or_env_var_path>",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**주요 필드:**

| 필드 | 설명 |
|---|---|
| `EventName` | `SessionStart`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `PostCompact`, `Stop` 중 하나 |
| `matcher` | `PreToolUse`/`PostToolUse`용: 파이프로 구분된 도구 이름 정규식 (예: `Write\|Edit`). 빈 문자열은 전부 매칭 |
| `command` | 실행할 셸 명령. `${CLAUDE_PLUGIN_ROOT}`는 플러그인 디렉토리로 해석됩니다 |
| `timeout` | hook이 종료되기까지 최대 초 수 |

**새 hook 추가 방법:**

1. `plugin/hooks/scripts/`에 스크립트를 만듭니다.
2. 실행 가능하게 만듭니다 (`chmod +x`).
3. 적절한 이벤트 아래 `hooks.json`에 항목을 추가합니다.
4. 스크립트는 stdin으로 hook 페이로드를 JSON으로 받습니다. stdout에 `{"additionalContext": "..."}`를 출력하면 컨텍스트가 주입됩니다 (SubagentStart와 PostCompact만 해당).

**Exit code 규칙:**

| 코드 | 효과 |
|---|---|
| 0 | 성공, 계속 |
| 1 | 오류 (기록되지만 차단 안 함) |
| 2 | 파이프라인 차단 (`Stop` hook에서만 의미 있음) |

Hook 실패 처리, 적합성 검사, 메트릭 수집에 대한 프로토콜 상세는 `docs/ko/protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` 참조.

---

## Hook이 참조하는 상태 파일

| 경로 | 사용하는 hook |
|---|---|
| `.geas/state/run.json` | session-init, restore-context, verify-pipeline, agent-telemetry, checkpoint-pre-write, checkpoint-post-write, packet-stale-check |
| `.geas/state/_checkpoint_pending` | checkpoint-pre-write (생성), checkpoint-post-write (제거) |
| `.geas/state/memory-index.json` | memory-review-cadence, memory-superseded-warning |
| `.geas/state/locks.json` | lock-conflict-check, integration-lane-check |
| `.geas/state/debt-register.json` | check-debt |
| `.geas/rules.md` | session-init (생성), inject-context (읽기), restore-context (읽기) |
| `.geas/memory/agents/<name>.md` | inject-context |
| `.geas/memory/entries/<id>.json` | memory-promotion-gate |
| `.geas/tasks/<tid>.json` | protect-geas-state, verify-task-status, stale-start-check |
| `.geas/evidence/<tid>/architecture-authority-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/qa-engineer.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/challenge-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/product-authority-verdict.json` | verify-task-status, verify-pipeline |
| `.geas/tasks/<tid>/retrospective.json` | verify-task-status, verify-pipeline |
| `.geas/spec/seed.json` | protect-geas-state (동결 보호) |
| `.geas/packets/<tid>/*.md` | memory-superseded-warning, packet-stale-check |
| `.geas/ledger/costs.jsonl` | agent-telemetry |
| `.geas/ledger/cost-summary.json` | calculate-cost |
