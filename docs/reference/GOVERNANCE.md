# Governance & Evaluation

This document covers the quality assurance and governance systems in Geas: the Evidence Gate, rubric scoring, Implementation Contract, worker self-check, stateful QA, vote rounds, decision records, and escalation paths.

---

## Evidence Gate (3-Tier)

The Evidence Gate is the mechanism that enforces "done means contract fulfilled," not "agent says done." Every task passes through the gate before it can proceed to Nova's product review. Compass invokes the gate after collecting an EvidenceBundle from a worker.

```
Tier 1: Mechanical  →  Tier 2: Semantic + Rubric  →  Tier 3: Product
(build/lint/test)       (criteria + scoring)           (Nova ship/iterate/cut)
```

### Tier 1: Mechanical

Tier 1 executes the `eval_commands` defined in the TaskContract and checks exit codes.

For each command:
- **pass** — command exits 0
- **fail** — command exits non-zero (error output captured)
- **skip** — command not applicable or not configured

The gate stops on first failure. Running semantic checks against code that does not build wastes verification cycles. If the EvidenceBundle contains `verify_results` from a prior run, the gate re-runs the commands and trusts the fresh result.

Failure to execute eval_commands when they exist is itself a gate violation. If no commands are configured, all results record as `"skip"`.

### Tier 2: Semantic + Rubric

Tier 2 has two parts: acceptance criteria check and rubric scoring. Both must pass.

**Part A: Acceptance Criteria**

For each criterion in the TaskContract's `acceptance_criteria`:
1. Read the worker's evidence (summary, files_changed, criteria_results if present).
2. If the worker provided `criteria_results`, verify their self-assessment against the evidence.
3. If not provided, infer from files changed, test results, and code inspection.
4. Record: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

All criteria must be met to proceed to Part B.

**Part B: Rubric Scoring**

Evaluators (Sentinel, Forge) read the rubric dimensions from the TaskContract and score each one 1-5. The gate reads those scores from the evaluators' EvidenceBundles and compares each score against the dimension's threshold.

If any dimension is below its threshold, Tier 2 fails. The `blocking_dimensions` list in the gate verdict tells the verify-fix-loop exactly which dimensions the fixer must address.

```json
{
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "evaluator": "sentinel", "threshold": 3, "pass": true },
    { "dimension": "code_quality", "score": 3, "evaluator": "forge", "threshold": 4, "pass": false }
  ],
  "rubric_pass": false,
  "blocking_dimensions": ["code_quality"]
}
```

**Threshold Adjustment (Low Confidence)**

If the worker's `self_check.confidence` is 2 or below, the gate adds +1 to every rubric threshold before comparison. A worker who rates their own implementation as uncertain receives a stricter review as a result. This is automatic — the gate applies it without requiring manual configuration.

**Stub Check**

If the worker's `self_check.possible_stubs` is non-empty, the gate verifies those files are not left as placeholder implementations. Any confirmed stub caps `feature_completeness` at a score of 2, regardless of what the evaluator reported.

### Tier 3: Product

Nova is spawned for a ship/iterate/cut judgment. Tier 3 runs only for:
- Feature completion (a task that delivers user-visible functionality)
- Phase completion (end of MVP, Polish, or Evolution)
- Pivot decisions

Nova receives the task goal, all evidence bundles for the task, criteria results from Tier 2, and the mission context from seed.json.

Nova's verdict:
- **Ship** — meets all criteria, good quality, aligned with mission
- **Iterate** — partially meets criteria; Nova provides specific feedback that becomes the worker's next ContextPacket. Counts against retry budget.
- **Cut** — fundamentally misaligned or not worth fixing

### Gate Levels

Not every task needs all three tiers:

| Situation | Tiers to Run |
|-----------|-------------|
| Implementation task (code change) | Tier 1 + Tier 2 |
| Design spec (no code) | Tier 2 only |
| Feature completion (ready for release) | Tier 1 + Tier 2 + Tier 3 |
| Code review (Forge reviewing) | Tier 2 only |
| QA testing (Sentinel) | Tier 1 + Tier 2 |
| Security review (Shield) | Tier 2 only |
| Phase completion | Tier 1 + Tier 2 + Tier 3 |

### Gate Verdict Structure

```json
{
  "task_id": "task-003",
  "verdict": "pass | fail | iterate",
  "tiers": {
    "mechanical": { "status": "pass", "results": {} },
    "semantic": {
      "status": "pass",
      "criteria_met": 5,
      "criteria_total": 5,
      "rubric_pass": true,
      "rubric_scores": [],
      "blocking_dimensions": []
    },
    "product": { "status": "ship", "nova_notes": "..." }
  },
  "failures": [],
  "timestamp": "..."
}
```

---

## Rubric System

The rubric system provides structured quality scoring for every task. Scores are produced by designated evaluators and compared against per-dimension thresholds before the gate passes Tier 2.

### Default Dimensions

These dimensions apply to all implementation tasks:

| Dimension | Evaluator | Default Threshold | Scale |
|-----------|-----------|:-----------------:|-------|
| `core_interaction` | Sentinel | 3 | 1-5 |
| `feature_completeness` | Sentinel | 4 | 1-5 |
| `code_quality` | Forge | 4 | 1-5 |
| `regression_safety` | Sentinel | 4 | 1-5 |

### UI Dimensions

These dimensions are added for tasks that involve user interface work:

| Dimension | Evaluator | Default Threshold | Scale |
|-----------|-----------|:-----------------:|-------|
| `ux_clarity` | Sentinel | 3 | 1-5 |
| `visual_coherence` | Sentinel | 3 | 1-5 |

### Who Scores What

**Sentinel** scores all dimensions except `code_quality`: `core_interaction`, `feature_completeness`, `regression_safety`, `ux_clarity`, and `visual_coherence`. These are QA-domain assessments based on E2E testing, user perspective testing, and state verification.

**Forge** scores `code_quality` exclusively. Forge's rubric scores come from the mandatory code review that follows every implementation. The score anchors to a specific scale:
- **5**: Clean, well-structured, follows conventions, no issues
- **4**: Good quality, minor suggestions only
- **3**: Acceptable but notable issues
- **2**: Significant quality concerns
- **1**: Fundamental problems

### Threshold Enforcement

Each dimension in the TaskContract's `rubric` array carries a `threshold` field. The Evidence Gate compares each evaluator's score against that threshold. A dimension where `score < threshold` is blocking. The `blocking_dimensions` array in the gate verdict lists every failing dimension.

A task cannot reach Tier 3 (Nova product review) until all rubric dimensions meet their thresholds.

### Threshold Adjustment

When a worker's `self_check.confidence` is 2 or below, every threshold in the rubric increases by 1. This creates a stricter review for work the worker themselves rates as uncertain. The adjustment is applied by the Evidence Gate, not by the evaluators.

Example: if a worker reports confidence=2 on a task with `code_quality` threshold=4, the gate evaluates against threshold=5 instead.

### Scorecard from Auction Platform Test

The following scorecard is from the real-time auction platform test run (US-01, bidding engine implementation):

| Dimension | Score | Threshold | Evaluator | Pass |
|-----------|:-----:|:---------:|-----------|:----:|
| `core_interaction` | 4 | 3 | Sentinel | yes |
| `feature_completeness` | 4 | 4 | Sentinel | yes |
| `code_quality` | 4 | 4 | Forge | yes |
| `regression_safety` | 3 | 4 | Sentinel | no |

`blocking_dimensions: ["regression_safety"]` — the task entered the verify-fix-loop targeting regression safety before proceeding to Tier 3.

---

## Implementation Contract

### Purpose

The Implementation Contract eliminates the rework cycle that occurs when a worker misunderstands a requirement, builds the wrong thing, and QA catches it. Before any code is written, the assigned worker states explicitly what they plan to do and how they will prove it is done. Sentinel and Forge approve the plan before implementation begins.

Compass invokes the implementation-contract skill after Tech Guide (Forge) and before Implementation, for every task. There are no exceptions for "simple" tasks.

### Flow

```
Worker drafts contract
        ↓
Sentinel reviews (QA perspective)
        ↓
Forge reviews (technical perspective)
        ↓
Both approve?  ──yes──→  status: approved  →  Implementation begins
     ↓ no
Concerns returned to worker
        ↓
Worker revises and resubmits
        ↓
Forge makes final call  →  Implementation begins
```

One revision cycle is the maximum. After a revision is requested, Forge's assessment on the resubmission is final and implementation proceeds regardless of remaining concerns.

### Review Focus

**Sentinel reviews from a QA perspective:**
- Are demo_steps sufficient to verify all acceptance criteria?
- Are there missing edge_cases that should be handled?
- Are non_goals reasonable — anything critical being excluded?
- Would testing be possible based on what is described?

**Forge reviews from a technical perspective:**
- Are planned_actions consistent with the tech guide?
- Are non_goals appropriate — nothing critical being excluded?
- Are there technical edge_cases the worker missed?
- Is the approach viable or heading toward a dead end?

### Schema Fields

| Field | Required | Description |
|-------|:--------:|-------------|
| `planned_actions` | yes | Concrete steps the worker will take |
| `edge_cases` | yes | Edge cases the worker plans to handle |
| `non_goals` | yes | What the implementation explicitly will not do |
| `demo_steps` | yes | Step-by-step procedure to verify completion |
| `state_transitions` | no | State changes the implementation introduces |
| `approved_by` | no | Agents who approved (set after approval) |
| `approval_notes` | no | Notes from reviewers during approval |
| `status` | yes | `draft` / `in_review` / `approved` / `revision_requested` |

The `demo_steps` field must cover every acceptance criterion. If a criterion has no corresponding demo step, the contract is incomplete and will not be approved.

### Contract from the Auction Platform Test

The US-01 implementation contract (bidding engine) from the real-time auction platform test contained:
- **24 planned_actions** — granular steps covering WebSocket event handling, bid validation, state persistence, and broadcast logic
- **7 edge_cases** — including concurrent bids arriving within the same millisecond, bid below current price, user submitting after auction close, and connection drop mid-submit
- **8 non_goals** — explicitly excluding payment processing, bid history UI, reserve price enforcement, and admin auction management

This level of specificity allowed Sentinel to write test cases directly from the contract before implementation completed.

---

## Worker Self-Check

### Purpose

Every implementation worker (Pixel for frontend, Circuit for backend) must include a `self_check` object in their EvidenceBundle before submitting. The self-check is the worker's honest assessment of their own output — written to guide Sentinel's testing toward the weakest areas rather than re-verifying what is already known to work.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `known_risks` | array of strings | Risks the worker is aware of in their implementation |
| `untested_paths` | array of strings | Code paths the worker did not test |
| `possible_stubs` | array of strings | Implementations left as stubs or placeholders |
| `what_i_would_test_next` | array of strings | Suggested test areas for QA to prioritize |
| `confidence` | integer (1-5) | Self-assessed confidence; 1=very uncertain, 5=very confident |

`known_risks`, `untested_paths`, and `confidence` are required. The remaining fields are strongly expected for any non-trivial implementation.

### How Sentinel Uses Self-Check

When Sentinel receives an EvidenceBundle, the `self_check` fields direct QA effort:

- **known_risks** — Sentinel tests these scenarios first and covers them in detail
- **untested_paths** — Sentinel targets these code paths; if failures appear here, the connection to the worker's self-assessment is noted in the bug report
- **possible_stubs** — Sentinel verifies that files listed are not left as stubs; a confirmed stub caps `feature_completeness` at 2 in the rubric
- **what_i_would_test_next** — Sentinel treats this as a priority queue for E2E scenarios

### Confidence and Threshold Adjustment

A confidence rating of 2 or below triggers the automatic threshold increase described in the Rubric System section. Workers are expected to be honest rather than optimistic. A false confidence=5 on fragile work that fails QA burns retry budget. Sentinel's bug reports include cross-references to the self-check, so discrepancies between stated confidence and actual failures are visible in the evidence trail.

---

## Stateful QA

### What It Is

Standard E2E testing verifies the UI surface: buttons respond, forms submit, pages render. Stateful QA goes further: it verifies the actual system state after user actions by calling API endpoints directly and querying the database.

Sentinel performs stateful QA when the task involves backend state changes.

### Dev Server Lifecycle

Before running state verification or E2E tests, Sentinel manages the development server explicitly:

1. Read `.geas/memory/_project/conventions.md` for the dev server command
2. Start the development server in background
3. Wait for ready state (check port or health endpoint)
4. Run tests against the live server
5. Shut down the server after QA is complete

If the dev server cannot start (missing dependencies, database not available, environment not configured), Sentinel records `state_verification: { "skipped": true, "reason": "..." }` and proceeds with static checks only. The skip reason is visible in the EvidenceBundle and the gate verdict.

### state_verification Field

Results are recorded in the `state_verification` field of the EvidenceBundle:

**api_checks** — Direct endpoint verification:

```json
{
  "endpoint": "POST /api/bids",
  "expected_status": 201,
  "actual_status": 201,
  "pass": true,
  "notes": "Bid created, auction state updated"
}
```

**db_checks** — Read-only database state verification:

```json
{
  "description": "Bid row persisted with correct auction_id and amount",
  "query": "SELECT * FROM bids WHERE auction_id = 'test-001' ORDER BY created_at DESC LIMIT 1",
  "expected": "bid with amount=500, status='active'",
  "actual": "bid with amount=500, status='active'",
  "pass": true
}
```

DB checks must be read-only queries. Sentinel does not mutate database state during verification.

### Limitations

Stateful QA requires a running development server and an accessible database. In environments where these are not available, state verification is skipped and logged. The gate proceeds without it, but the lack of state verification is surfaced in the evidence trail.

---

## Vote Round

### When Triggered

Vote rounds are for major proposals that affect project direction. They are not used for implementation details, per-feature specs, bug fixes, or decisions within a single agent's domain.

| Proposal | Designated Critic |
|----------|-------------------|
| Forge proposes architecture or tech stack (Discovery) | Circuit or Palette (most affected domain) |
| Palette posts the overall design system (not per-feature specs) | Forge or Pixel |
| Cross-cutting decision affecting multiple agents (state management, API shape, deployment strategy) | The agent whose domain is most affected |

### 4-Step Process

**Step 1 — Proposer submits**

The proposer (typically Forge or Palette) writes a structured proposal:
- What is being proposed
- Why (what problem does this solve)
- Trade-offs and why they are acceptable
- Alternatives considered and why they were rejected

The proposal is saved to `.geas/decisions/pending/{proposal-id}.md`.

**Step 2 — Critic challenges**

Compass spawns the designated Critic to review the proposal. The Critic must produce a structured challenge:
- Assessment: `agree` or `challenge`
- Concerns (if any)
- Alternative (if challenging)
- Recommendation: proceed as-is / modify with specifics / replace with alternative

The challenge is appended to the same proposal file.

The Critic must participate. Skipping the Critic step is not permitted — even when the proposal appears straightforward. A second perspective catches blind spots that the proposer cannot see in their own work.

**Step 3 — Compass synthesizes**

Compass reads both the proposal and the challenge, then presents a summary to the user with concrete options:
1. Accept proposal as-is
2. Accept with modifications (from Critic's concerns)
3. Accept Critic's alternative
4. Reject — need more information

Compass includes its own recommendation based on project context.

**Step 4 — User confirms**

The user selects an option. In autonomous mode, if the user does not respond, Compass proceeds with its recommendation and notes the auto-decision in the DecisionRecord.

### Resolution Options

| Resolution | Description |
|------------|-------------|
| Accept proposal | Proceed with the proposal exactly as submitted |
| Accept with modifications | Proceed with specific changes from the Critic's concerns |
| Accept alternative | Proceed with the Critic's proposed alternative |
| Reject | More information needed; proposal is withdrawn |
| Compass auto-decision | User unavailable; Compass selects the strongest option |

Every vote round produces a DecisionRecord regardless of outcome.

---

## Decision Records

### When Created

A DecisionRecord is written for every significant governance event:

- Escalation: when a task exhausts its retry budget and moves to `forge-review`, `nova-decision`, or `pivot`
- Vote round resolution: after every structured review
- Debate resolution: after every structured debate
- Pivot: whenever project scope or direction changes substantially

No governance event is silent. The record exists so that any participant — human or agent — can reconstruct why a decision was made without reading every agent interaction.

### Schema Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (`dec-001`, `dec-002`, ...) |
| `title` | One-line summary of the decision |
| `context` | What situation prompted this decision |
| `options` | The alternatives that were considered |
| `decision` | Which option was chosen |
| `reasoning` | Why this option was chosen over the alternatives |
| `trade_offs` | What is being sacrificed or accepted as risk |
| `decided_by` | Which agent or human made the final call |
| `participants` | All agents involved in the decision process |
| `related_task_id` | The task that triggered this decision, if any |
| `created_at` | ISO 8601 timestamp |

### Storage

DecisionRecords are written to `.geas/decisions/{dec-id}.json` conforming to `schemas/decision-record.schema.json`. Every escalation event is also logged to `.geas/ledger/events.jsonl`.

### Durable Rationale

The `reasoning` field captures why one option was chosen over the others — not just what was decided. This is the record's primary value. Six months later, when a new session resumes or a human audits the project, the reasoning explains the decision without requiring the reader to reconstruct the context from conversation history.

---

## Escalation Paths

When a task fails the Evidence Gate, the system enters a bounded, traceable escalation sequence. No failure is silent.

### Verify-Fix Loop (Level 1)

After gate failure, the verify-fix-loop skill manages a bounded retry sequence:

1. The fixer is identified based on failure type — Pixel for frontend bugs, Circuit for backend bugs, or both with explicit ownership division.
2. The fixer receives a ContextPacket containing the specific gate failures, original acceptance criteria, files changed in the previous attempt, and the `blocking_dimensions` from rubric evaluation.
3. After the fix, the Evidence Gate re-runs Tiers 1 and 2.
4. If the gate passes, the task proceeds to Tier 3 (Nova product review).
5. If the gate fails again, the loop repeats.

Each iteration is tracked in `.geas/state/run.json`. Each fix attempt produces its own EvidenceBundle (e.g., `circuit-fix-2.json`).

### Retry Budget

The TaskContract's `retry_budget` field sets the maximum number of fix-verify iterations. The default is 3. When the budget is exhausted, the system follows the TaskContract's `escalation_policy`.

### Escalation Policy (Level 2)

**`"forge-review"` (default)**

Forge is spawned for architectural root-cause analysis. Forge reads the TaskContract and all evidence bundles, then determines whether the repeated failures stem from a fundamental design issue or a fixable implementation bug.

- If Forge identifies a fixable root cause: one additional fix attempt is granted.
- If Forge determines the approach is broken: the escalation moves to Nova.

**`"nova-decision"`**

Nova receives full context — TaskContract, all evidence bundles, all gate verdicts — and makes a strategic call:
- Scope cut: reduce the task's requirements to something achievable
- Feature drop: remove the feature entirely
- Alternative approach: pivot to a different implementation strategy
- Push through: grant additional retry budget if the team is close

**`"pivot"`**

The full pivot protocol is invoked. Reserved for situations where failure indicates a fundamental problem with project direction, not an isolated task.

### DecisionRecord on Every Escalation

Every time the system moves from Level 1 to Level 2, a DecisionRecord is written before any further action is taken. The record captures the gate failure history, escalation policy applied, options considered, decision made, and the agent who decided.

### Visual Summary

```
Evidence Gate PASS?
  YES --> Nova product review (Tier 3)
  NO  --> Fix (Pixel/Circuit) --> Re-gate
          PASS? --> Nova review
          NO    --> Fix --> Re-gate (iteration 2)
                    PASS? --> Nova review
                    NO    --> ... (up to retry_budget)
                              Budget exhausted?
                              --> escalation_policy:
                                 forge-review  --> Forge root-cause analysis
                                                   fixable? --> one more attempt
                                                   broken?  --> nova-decision
                                 nova-decision --> Nova strategic call
                                 pivot         --> Pivot Protocol
                              --> DecisionRecord written
```

---

## See Also

- `plugin/skills/evidence-gate/SKILL.md` — Evidence Gate protocol
- `plugin/skills/implementation-contract/SKILL.md` — Implementation Contract protocol
- `plugin/skills/vote-round/SKILL.md` — Vote Round protocol
- `plugin/skills/verify-fix-loop/SKILL.md` — Verify-Fix Loop protocol
- `plugin/skills/verify/SKILL.md` — Mechanical verification checklist
- `plugin/agents/sentinel.md` — Sentinel agent definition (rubric scoring, state verification)
- `plugin/agents/forge.md` — Forge agent definition (code_quality rubric)
- `docs/reference/AGENTS.md` — All 12 agents reference
- `docs/architecture/PIPELINE.md` — Full pipeline with gate integration points
