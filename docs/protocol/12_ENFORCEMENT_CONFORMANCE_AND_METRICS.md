# 12. Enforcement, Conformance, and Metrics

## Enforcement Event Timeline

Default sequence:
1. `task_admission`
2. `pre_implementation`
3. `post_implementation`
4. `pre_integration`
5. `post_integration`
6. `pre_gate`
7. `post_gate`
8. `pre_verdict_submission`
9. `final_verdict`
10. `session_checkpoint`
11. `post_pass_learning`
12. `phase_transition_review`

## Hook Responsibilities

### Allowed
- artifact completeness checks
- enum / invariant checks
- stale start blocking
- lock conflict blocking
- missing required reviewer blocking
- missing worker self-check blocking
- incomplete closure packet submission blocking
- packet stale detection
- summary/recovery artifact synchronization
- checking for gap/debt/rules artifacts existence before phase transition

### Not allowed
- hooks deciding product verdicts
- hooks replacing specialist reviews
- hooks arbitrarily generating missing evidence
- hooks covering ambiguous states by marking them as pass

### Hook Failure Handling

Hooks execute external commands and can fail. The following rules apply:

- **timeout**: hooks have a default 30-second timeout (overridable in `.geas/rules.md`). On timeout, the hook is treated as `error`.
- **error handling**: on hook error, the transition does not proceed. One automatic retry is allowed. If the retry also fails, transition the task to `blocked` and notify the `orchestration_authority`.
- **hook side-effect failure**: if a hook creates or modifies an artifact and fails, the partial artifact left behind is preserved with a `_partial` suffix and is not treated as a valid artifact.

## Conformance Scenarios

### State Integrity
- attempting `ready -> implementing` without an implementation contract -> blocked
- attempting `implementing -> reviewed` without a worker self-check -> blocked
- attempting `verified -> passed` without a final verdict -> blocked

### Drift / Revalidation
- forced revalidation on stale task start
- baseline mismatch detection on paused task resume

### Parallelism / Locking
- blocking parallel execution with overlapping path locks
- blocking simultaneous integration lane entry

### Gate / Rubric
- worker self-check `confidence <= 2` (1-5 scale) but evidence gate threshold adjustment is missing -> blocked
- possible_stubs exist but stub cap verification is missing -> blocked
  - **stub cap definition**: the maximum number of stub/placeholder implementations allowed in a single task. Defaults: `risk_level=critical` -> 0, `risk_level=high` -> 0, `risk_level=normal` -> 2, `risk_level=low` -> 3. Enforced during evidence gate tier 2 stub check

### Memory Evolution
- attempting to directly promote a single low-quality incident to stable memory -> blocked
  - **low-quality incident definition**: (1) `evidence_refs` count is less than 2, or (2) the original artifact's gate score is below 3 on any dimension, or (3) candidate extracted from a `failed`/`cancelled` task
- superseded memory (`state = "superseded"`) included in `memory-packet.json`'s `applicable_memory_ids[]` -> warning on first occurrence, blocked on second consecutive occurrence
- accumulated harmful reuse (2 or more entries with `effect = "negative"` in `memory-application-log.json`) for a memory that remains `stable` or `canonical` -> must transition to `under_review` (see doc 08 Harmful Reuse Rollback Procedure)

### Evolution Loop
- passed task without retrospective -> warning on first occurrence, block on second consecutive occurrence. To override this default policy, an explicit entry in `.geas/rules.md` is required
- attempting to close evolving phase without gap assessment -> blocked
- attempting to close polishing/evolving phase without debt register -> blocked
- rules update exists but packet builder did not incorporate it -> conformance failure

### Recovery
- gate result missing but `verified` is claimed -> rewind
- dirty worktree + missing checkpoint -> exact resume prohibited

## Metrics

### Core
- stale start blocks
- revalidation count
- integration drift rate
- gate fail rate
- readiness round rate
- average closure latency
- worker low-confidence rate
- debt introduced per task
- debt resolved per phase
- gap closure ratio
- memory promotion count
- memory successful reuse count
- memory harmful reuse count
- recovery exact-resume rate
- recovery rewind rate
- packet stale regeneration count

### Run Summary

At the end of every session, generate a `run-summary.md` to maintain a session audit trail.

Included items:
- list of tasks completed during the session and each verdict
- list of failures/rewinds that occurred
- list of newly created/promoted memories
- changes to `rules.md`
- changes to debt-register
- total elapsed time and key milestone timestamps

Storage location: `.geas/summaries/run-summary-{timestamp}.md`

### Health Signals

| signal | specific threshold | meaning |
|---|---|---|
| memory bloat | `memory-index.json` entries > 100 with 0 reuses in the last 10 tasks | memory is accumulating but not being utilized |
| review gap | required specialist review miss rate > 20% in the last 5 tasks | the review process is being ignored |
| gate quality issue | final verdict `iterate` rate > 30% (based on last 10 tasks) | specialist gate quality is low or criteria are unclear |
| contradiction accumulation | 2 or more stable memories with `contradiction_count >= 3` | insufficient memory review cadence. Since doc 08 Decay Rules transition to `decayed` when `contradiction_count >= 3`, this signal indicates decay rule enforcement was missed |
| repeated failure class | same `failure_class` repeated 3 or more times | memory promotion or process rule needed |
| debt stagnation | `accepted` debt is 2x or more than `resolved` debt (per phase) | polishing/evolving phase is ineffective |
| scope control weakness | scope changes after `implementation_contract` approval in > 30% of last 5 tasks | scope control is weak |
| worker low-confidence | `confidence <= 2` rate > 25% (based on last 10 tasks) | task splitting or context packet improvement needed |

### Health Signal Detection Owner and Timing

Health signals are calculated by the `orchestration_authority` at the following points:
1. on every `learning` runtime phase entry
2. on every phase transition review
3. on session start (state check after recovery)

Results are recorded in `.geas/state/health-check.json`, including each signal's current value and whether it exceeds the threshold. When any signal exceeds its threshold, the corresponding mandatory response is executed immediately.

### Mandatory Responses on Health Signal Detection

When a health signal exceeds its threshold, the following responses **must** be performed:

1. **memory bloat**: `process_lead` batch-reviews memories with 0 reuses at the next retrospective. Items past their `review_after` date are transitioned to `decayed`.
2. **review gap**: `orchestration_authority` activates blocking at the `pre_gate` hook for specialist review omissions starting from the next task.
3. **gate quality issue**: `process_lead` creates a rule candidate for rubric criteria clarification. Adjusts evidence gate thresholds if needed.
4. **contradiction accumulation**: immediately transition the affected memory to `under_review` and apply doc 08 decay rules.
5. **repeated failure class**: automatically register the failure pattern as a memory candidate and trigger the Retrospective to Rule Update process from doc 14.
6. **debt stagnation**: `process_lead` creates a debt resolution plan during phase review. Prioritize debt resolution tasks in the next phase scheduling.
7. **scope control weakness**: `orchestration_authority` strengthens the implementation contract approval process. Makes re-approval mandatory on scope changes.
8. **worker low-confidence**: `orchestration_authority` reviews task granularity and improves L1/L2 memory quality in context packets.
