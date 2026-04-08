# 05. Gate, Vote, and Final Verdict

> **Normative document.**
> This document defines the evidence gate, rubric scoring, vote rounds, closure packet completeness, critical-review challenge, and final-verdict semantics.

## Purpose

Geas separates three mechanisms that are often incorrectly merged:

- **Evidence Gate** — objective verification
- **Vote Round** — structured deliberation when judgment is contested or shipping risk is material
- **Final Verdict** — product closure decision

This separation is mandatory. A conformant implementation MUST NOT allow any one of the three to substitute for the others.

## Core Separation Rules

1. A gate MUST verify evidence, not product strategy.
2. A vote round MUST deliberate disagreement or readiness, not fabricate missing evidence.
3. A final verdict MUST judge the complete packet, not intuition in isolation.
4. `iterate` belongs to the final-verdict layer, not to the gate layer.
5. A passing gate MUST NOT automatically imply `passed`.

## Evidence Gate

The evidence gate is an ordered, three-tier verification mechanism that determines whether a task's outputs meet the required standard. It runs after implementation and review are complete, and its result (`pass | fail | block | error`) decides whether the task can advance toward closure. The gate does not judge product strategy — it verifies that evidence exists and meets thresholds.

The gate result is stored as the `gate_result` section in the task's `record.json` (via `geas task record add --section gate_result`).

### Gate profiles

| gate_profile | Tier 0 | Tier 1 | Tier 2 | expected use |
|---|---|---|---|---|
| `implementation_change` | run | run | run | standard implementation-bearing task |
| `artifact_only` | run | skip or narrow | run | documentation, design, review, or analysis work without primary implementation change |
| `closure_ready` | run | optional | simplified completeness + readiness checks | cleanup, delivery, or closure-assembly task |

A project MAY tighten a profile, but it MUST NOT silently weaken one without policy documentation.

## Tier 0 — Precheck

Tier 0 verifies that the task is even eligible for gating.

It MUST check:

- required artifact presence
- task state eligibility
- baseline / integration prerequisites
- required review set presence
- worker self-check presence where required
- packet freshness where relevant

### Tier 0 outcomes

- missing required artifact -> `block`
- ineligible state -> `error`
- stale or mismatched baseline -> `block`
- validator or environment failure -> `error`

Tier 0 MUST short-circuit subsequent tiers on non-pass outcomes.

## Tier 1 — Mechanical Verification

Tier 1 verifies that objective, repeatable checks pass.

Examples by domain:

- **Software**: build, lint, tests, type-check
- **Research**: source verification, citation validation, statistical reproducibility check
- **Content**: grammar check, style lint, fact verification, link validation
- **General**: schema validation, generated artifact validation, reproducible command execution, benchmark or eval harness execution when the task requires it

Tier 1 MAY be narrowed for `artifact_only` work, but not skipped entirely when domain-appropriate mechanical checks exist (e.g., citation validation for research, fact-checking for content, schema validation for data). Full skip is allowed only when no repeatable verification is applicable.

### Mechanical evidence requirements

Tier 1 evidence SHOULD record:

- commands or harnesses run
- exit status
- timestamps
- important environment qualifiers
- failed checks and locations

## Tier 2 — Contract and Rubric Verification

Tier 2 verifies that the submitted work fulfills the approved contract and acceptance story.

Tier 2 MUST consider:

- acceptance criteria
- scope violations
- required checks and demo steps
- handling of known risks
- review outcomes
- rubric thresholds
- stub or placeholder verification
- whether the change remains materially faithful to the approved plan

### Known-risk handling

Every item from `known_risks` MUST have one of the following statuses at closure:

| status | description |
|---|---|
| mitigated | a countermeasure was executed |
| accepted | the risk is consciously carried, with recorded rationale |
| deferred | the risk is registered as debt for future handling, with recorded rationale |

A risk that appeared in the contract MUST NOT be absent from closure without explanation.

## Gate Verdict Enum

Canonical outcomes:

- `pass`
- `fail`
- `block`
- `error`

### Meaning

| verdict | meaning | retry budget impact |
|---|---|---:|
| `pass` | required gate conditions passed | 0 |
| `fail` | implementation or verification quality problem | 1 |
| `block` | structural prerequisite missing or unresolved | 0 |
| `error` | gate execution itself failed or became unreliable | 0 by default |

## `fail` vs `block`

This distinction is critical.

### `fail`
Use when the implementation can realistically be improved and re-submitted.

Examples:

- tests failing
- threshold below rubric minimum
- regression behavior observed
- acceptance criterion unmet

### `block`
Use when forward motion would be structurally invalid.

Examples:

- missing artifact
- missing required specialist review
- baseline mismatch
- stub cap exceeded where policy forbids it
- incomplete packet dependency

A team MUST NOT label a `block` as `fail` merely to consume retry budget and keep moving.

## Gate Error Handling

If the gate returns `error`:

1. record the execution problem
2. do not consume retry budget by default
3. resolve the environment or tool cause
4. re-run conservatively

Repeated `error` on the same cause SHOULD escalate to `blocked` or `escalated` depending on whether the cause is operational or jurisdictional.

## Rubric Scoring

Rubrics are the tool Tier 2 uses to quantify output quality. Each dimension receives a 1–5 score, and any dimension below its threshold causes Tier 2 failure. Where Tier 1 asks "does it run?", rubrics ask "is it well made?"

### Default dimensions

| dimension | what it evaluates | typical primary evaluator | default threshold |
|---|---|---|---:|
| `core_interaction` | does the core behavior work as intended | Quality Specialist | 3 |
| `output_completeness` | are all acceptance criteria satisfied | Quality Specialist | 4 |
| `output_quality` | is the structural and methodological quality sufficient | Design Authority | 4 |
| `regression_safety` | does the change avoid harming existing behavior | Quality Specialist | 4 |

### Common optional dimensions

Projects MAY add dimensions based on domain and need:

| dimension | what it evaluates |
|---|---|
| `ux_clarity` | clarity of user flows and interfaces |
| `visual_coherence` | visual consistency and design intent alignment |
| `security_posture` | soundness of security boundaries and trust model |
| `operational_readiness` | deployment, operations, and rollback readiness |
| `documentation_completeness` | documentation coverage and accuracy |
| `migration_safety` | safety of migrations and transitions |
| `evaluation_quality` | quality of evaluation evidence for agentic changes |

### Scoring rules

- score range is 1–5
- any dimension below threshold causes Tier 2 failure unless a documented profile exception exists
- dimensions that caused failure SHOULD be recorded in `blocking_dimensions[]` for the verify-fix loop
- threshold changes MUST be attributable to explicit policy, not ad hoc mood

## Low-Confidence Adjustment

When worker self-check `confidence <= 2`, the gate SHOULD tighten scrutiny.

Default policy:

- add +1 to all rubric thresholds for that gate run, capped at 5

A project MAY adopt a per-dimension confidence model later, but until then the scalar rule applies globally.

## Stub and Placeholder Policy

A stub is an incomplete, temporary implementation — a TODO function, a hardcoded return value, a dummy response standing in for real logic. The gate MUST explicitly inspect declared `possible_stubs[]` and SHOULD search for undeclared placeholders where practical.

### Default stub cap by risk level

| risk_level | default stub cap |
|---|---:|
| `low` | 3 |
| `normal` | 2 |
| `high` | 0 |
| `critical` | 0 |

Rules:

- confirmed stubs SHOULD cap completeness scoring
- exceeding the allowed cap SHOULD produce `block`
- undeclared confirmed stubs are worse than declared stubs and SHOULD be treated as trust-reducing evidence

## Evaluation Discipline for Agentic Work

If the task changes prompts, tools, memory behavior, routing logic, or other agentic control surfaces, Tier 1 or Tier 2 SHOULD include representative evaluations rather than relying only on unit tests.

At minimum, the verifier SHOULD ask:

- did target success improve?
- did regressions appear on known hard cases?
- did safety or policy failures increase?
- did cost or latency change materially?

This does not require a vendor-specific eval system, but it does require explicit measured evidence.

## Worker Self-Check Consumption

The system MUST consume the `self_check` section of `record.json` as more than a note. It directly informs:

- review focus
- Quality Specialist verification plan
- stub verification
- threshold tightening
- debt and memory extraction
- agent memory extraction

Ignoring the self-check while still collecting it is non-conformant review theater.

## Vote Rounds

A vote round is a structured deliberation where multiple roles weigh in on a contested decision. It exists for situations where evidence alone cannot settle the question — when judgment, trade-offs, or conflicting perspectives must be resolved explicitly rather than by one authority acting alone.

Vote rounds do not replace evidence. They decide what to do with the evidence.

### Two types of vote rounds

| type | when to use | typical participants |
|---|---|---|
| `proposal_round` | before work begins — to approve a design brief, settle a major structural or methodological choice, or adopt a cross-cutting proposal | Design Authority, relevant specialists, Decision Maker |
| `readiness_round` | before closure — to confirm high-risk ship readiness, formally handle a blocking challenge, or resolve a completeness-vs-urgency trade-off | Orchestrator, Decision Maker, Challenger, relevant specialists |

### `vote_round_policy`

Each task declares when vote rounds occur:

| value | behavior |
|---|---|
| `never` | skip discretionary rounds (mandatory conflict handling still applies) |
| `auto` | run when trigger conditions are met |
| `always` | always run a readiness round before final verdict |

### Trigger conditions for `auto`

A readiness round triggers when any of the following are true:

- `risk_level` is `high` or `critical`
- required reviewers disagree materially
- open risks remain unresolved
- an out-of-scope change was introduced
- the task is being resubmitted after failure or iterate
- Decision Maker or Orchestrator explicitly requests deliberation

### Vote result

| result | meaning |
|---|---|
| `ship` | the participants agree the task may proceed to verdict |
| `iterate` | the participants agree additional work is needed before proceeding |
| `escalate` | the participants cannot reach resolution at the current authority level |

A vote result MUST include the participant list. If consensus was not unanimous, dissenting positions MUST be recorded.

### Vote round repetition cap

A single vote round topic MUST NOT exceed 3 rounds of deliberation. If consensus is not reached within 3 rounds, the vote result MUST be `escalate`.

## Closure Packet

The closure packet is the compressed evidence bundle that tells the full story of a task. The Decision Maker renders the final verdict based solely on this packet. If the packet is incomplete, no verdict may be issued.

The closure packet is stored as the `closure` section in the task's `record.json` (via `geas task record add --section closure`). The required fields below become subsections of this record section.

### Required fields

| field | description |
|---|---|
| `change_summary` | what changed and where |
| `reviews[]` | review outputs from all required specialist slots |
| `open_risks` | risks acknowledged but not fully resolved |
| `debt_items` | debt introduced or carried by this task |

### Completeness rules

A closure packet is complete only if:

- all required fields exist
- required reviewer outputs are present
- unresolved blocking concerns are either actually resolved or explicitly carried as acknowledged risk through the correct path
- artifact references are coherent
- packet contents refer to the current verified submission, not a stale one

A packet MUST NOT be called “complete enough” by prose if the formal completeness rules are not met.

## Specialist Review Requirements Inside the Packet

Each specialist review SHOULD include at minimum:

| field | description |
|---|---|
| `reviewer_type` | which specialist slot produced this review |
| `status` | `approved`, `changes_requested`, or `blocked` |
| `summary` | review findings and rationale |
| `blocking_concerns[]` | individually addressable blocking issues |
| `evidence_refs[]` | artifacts examined during review |
| `rubric_scores[]` | optional rubric dimension scores |

Blocking concerns SHOULD remain individually addressable. “Many concerns” is not enough.

## Critical Review Challenge

Normal reviewers ask "is this correct?" The Challenger asks the opposite: "why might this be wrong?" Cooperative review tends to assume success, so a role that deliberately takes the opposing stance is necessary.

What the Challenger must look for:

| target | example |
|---|---|
| hidden assumptions | "this API always returns 200" is assumed but never verified |
| overconfidence | worker confidence is 5 but test coverage is low |
| fragile complexity | it works, but would break if a single condition changes |
| premature shipping logic | "ship now, fix later" adopted without supporting evidence |
| unexamined negative cases | only the happy path was tested; failure paths were not checked |

### Rules

- mandatory for `high` and `critical` tasks
- MUST include at least one substantive challenge
- MUST distinguish blocking concerns from advisory concerns
- MUST record output as the `challenge_review` section in the task's `record.json` (via `geas task record add --section challenge_review`). Fields: `concerns[]` (array), `blocking` (boolean).

### When a blocking concern is raised

The system MUST resolve it through one of the following:

| resolution | description |
|---|---|
| resolve before verdict | fix the issue or provide additional evidence, then resubmit |
| carry to readiness round | when multiple perspectives must deliberate via vote round |
| escalate | when the current authority level cannot make the call |

A blocking concern MUST NOT be omitted from the closure packet.

## Final Verdict

The final verdict is the only mechanism in the protocol that can close a task. Where the evidence gate asks "did verification pass?", the final verdict asks "should the product accept this result?" Only the Decision Maker may issue this verdict, and it must be based on the closure packet.

The final verdict is stored as the `verdict` section in the task's `record.json` (via `geas task record add --section verdict`). Fields: `verdict` (pass/iterate/escalate), `rationale`, `rewind_target` (optional).

### Verdict types

| verdict | effect | retry budget impact |
|---|---|---|
| `pass` | task becomes `passed` — done | none |
| `iterate` | explicit restoration target assigned and additional work required | does not consume (but counts toward iterate repetition cap) |
| `escalate` | local decision authority is insufficient — escalated to user | none |

### Forbidden `pass` conditions

`pass` is prohibited when any of the following are true:

| condition | reason |
|---|---|
| closure packet incomplete | insufficient basis for judgment |
| gate did not pass | unverified result cannot be accepted |
| required review missing | required perspectives are absent |
| active unresolved blocker not resolved through an allowed process | known issues cannot be silently ignored |
| task state is not `verified` | state transition invariant violation |
| evidence refers to stale or mismatched submission | judgment must be based on the current result |

### `iterate` semantics

`iterate` is a product judgment, not a gate failure. It means "verification passed, but the result is not good enough for the product." It does not consume retry budget, but MUST record:

| record | description |
|---|---|
| rejection reason | why the current result is not acceptable |
| restoration target | which state to restore to for rework |
| new expectations | what must change in the next submission |

Repeated `iterate` without narrowing uncertainty SHOULD trigger escalation.

## After Closure

A task reaching `passed` does not end interpretation. Information surfaced during closure must feed into the system's future behavior.

| what surfaced | where it goes |
|---|---|
| unresolved compromises | debt registration |
| unexpected over-delivery or under-delivery | gap assessment |
| repeated verdict patterns | rules and memory |

## Key Statement

A mature workflow does not ask one mechanism to do every job. Evidence gates verify, vote rounds deliberate, and final verdicts decide. When these boundaries blur, trust collapses.
