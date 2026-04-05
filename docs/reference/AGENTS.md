# Agents Reference

Geas uses a **slot-based role architecture**. The contract engine defines abstract **slots** (decision_maker, design_authority, challenger, implementer, quality_specialist, risk_specialist, operations_specialist, communication_specialist). Domain **profiles** map each slot to a concrete agent type. This separation lets the same governance pipeline serve different domains — software engineering, research, or any future profile — without changing the contract engine.

The **Orchestrator** (`orchestration_authority`) is the mission skill that coordinates phases, spawns agents, and manages task flow. It is not a spawnable agent and does not appear in profile definitions.

Canonical definitions: `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
Agent files: `plugin/agents/`

---

## Authority Agents

Authority agents are **shared across all profiles**. They provide governance, structural review, and adversarial challenge regardless of the domain.

| Agent Type | Slot | Model | Key Responsibility |
|---|---|---|---|
| [product-authority](#product-authority) | `decision_maker` | opus | Final verdict on task closure (pass / iterate / escalate) |
| [design-authority](#design-authority) | `design_authority` | opus | Structural coherence, interface review, contract approval |
| [challenger](#challenger) | `challenger` | opus | Adversarial pre-ship challenge, blocking concerns |

### product-authority

The voice of user value. Makes the final call on whether work ships, iterates, or gets cut.

- **Authority:** Final verdict (pass/iterate/escalate), priority adjustments, scope definition (P0/P1/P2/OUT), trade-off resolution when specialist consensus fails.
- **Judgment:** Reads all evidence before deciding. A passing gate does not automatically mean ship — product fit matters. Challenges over-engineering, scope creep, and features disguised as must-haves.
- **Artifacts:** `final-verdict.json`

### design-authority

The guardian of structural coherence. Reviews boundaries, interfaces, dependencies, and maintainability.

- **Authority:** Structural review and approval of implementation contracts, interface and dependency decisions, blocking power when structural integrity is at risk.
- **Judgment:** Evaluates whether the approach creates maintainable boundaries. Checks for brittle coupling, unsafe complexity, hidden dependencies. Stubs and placeholders must be explicitly bounded.
- **Artifacts:** `specialist-review.json`, project conventions

### challenger

The adversarial reviewer who asks "why might this be wrong?" while everyone else asks "is this correct?"

- **Authority:** Blocking power on high/critical risk tasks, mandatory pre-ship challenge for high/critical risk.
- **Judgment:** Looks for hidden assumptions, overconfidence, fragile complexity, unexamined negative cases, scope leaks, trust boundary violations. Every challenge review must include at least one substantive concern.
- **Artifacts:** `challenge-review.json`, `specialist-review.json`

---

## Software Profile

For software engineering missions. Defined in `plugin/agents/software/`.

| Slot | Agent Type | Key Responsibility |
|---|---|---|
| `implementer` | [software-engineer](#software-engineer) | Full-stack implementation (frontend, backend, design) |
| `quality_specialist` | [qa-engineer](#qa-engineer) | Verification, acceptance criteria, rubric scoring |
| `risk_specialist` | [security-engineer](#security-engineer) | Trust boundaries, attack surfaces, security assessment |
| `operations_specialist` | [platform-engineer](#platform-engineer) | CI/CD, deployment, environment, operational readiness |
| `communication_specialist` | [technical-writer](#technical-writer) | Documentation completeness, accuracy, audience fit |

### software-engineer

Full-stack implementer handling frontend, backend, and design implementation. Thinks in data flows, failure modes, user interactions, and system boundaries. Follows stack conventions, validates inputs, separates concerns. Submits honest self-checks.

### qa-engineer

Quality gatekeeper who verifies that what was built actually works. Starts from acceptance criteria, prioritizes negative paths, targets the worker's `untested_paths[]` and `possible_stubs[]`. Reports findings as rubric scores with specific evidence.

### security-engineer

Risk assessor focused on trust boundaries and attack surfaces. Maps trust boundaries, checks auth and authorization, inspects secret handling, evaluates injection surfaces and OWASP Top 10. Classifies findings by actual exploitability.

### platform-engineer

Operational backbone ensuring what gets built can be deployed, run, and maintained. Checks deployment implications, CI/CD impact, rollback capability, configuration drift, and operational visibility.

### technical-writer

Clarity specialist ensuring what gets built can be understood. Checks documentation impact, accuracy against implementation, audience fit, completeness for new features and breaking changes, and findability.

---

## Research Profile

For research and analysis missions. Defined in `plugin/agents/research/`.

| Slot | Agent Type | Key Responsibility |
|---|---|---|
| `implementer` | [literature-analyst](#literature-analyst) | Systematic literature search, source evaluation, synthesis |
| `implementer` | [research-analyst](#research-analyst) | Experiment design, data analysis, reproducible evidence |
| `quality_specialist` | [methodology-reviewer](#methodology-reviewer) | Methodological soundness, statistical validity, reproducibility |
| `risk_specialist` | [research-integrity-reviewer](#research-integrity-reviewer) | Ethics, data privacy, bias, validity threats |
| `operations_specialist` | [research-engineer](#research-engineer) | Data pipelines, compute resources, environment reproducibility |
| `communication_specialist` | [research-writer](#research-writer) | Research documentation, citation accuracy, audience-appropriate writing |

Note: The research profile has two `implementer` types. The Orchestrator routes tasks to the appropriate implementer based on `task_kind` and scope.

### literature-analyst

Systematic researcher who finds, evaluates, and synthesizes published knowledge. Prefers primary sources, assesses source credibility, identifies contradictions explicitly, notes knowledge gaps, and covers at least 3 independent sources for major claims.

### research-analyst

Hands-on researcher who designs experiments, analyzes data, builds models, and runs simulations. Starts from clear falsifiable hypotheses, documents every transformation for reproducibility, reports negative results honestly, quantifies uncertainty.

### methodology-reviewer

Rigor guardian verifying research methods are sound and results reproducible. Checks internal and external validity, statistical appropriateness, common pitfalls (p-hacking, multiple comparisons, selection bias), and that conclusions match evidence strength.

### research-integrity-reviewer

Ethical and validity guardian ensuring responsible research conduct. Checks data privacy and consent, bias risks, responsible reporting, validity threats, and potential for misinterpretation or misuse. Data privacy issues are always blocking.

### research-engineer

Infrastructure specialist ensuring research can be executed, reproduced, and scaled. Verifies data pipeline documentation, environment capture, data versioning, scalability, and delivery logistics.

### research-writer

Communication specialist ensuring research findings are presented clearly and accurately. Matches writing to audience, verifies claims are evidence-supported, ensures proper citation, and checks that limitations are prominently placed.

---

## Slot Resolution

The Orchestrator resolves abstract slots to concrete agent types at mission startup:

1. The mission's `profiles.json` declares which domain profile to use (e.g., `software`, `research`).
2. Each profile maps slots to agent types (e.g., `implementer` -> `software-engineer`).
3. Authority agents (product-authority, design-authority, challenger) are shared across all profiles.
4. When spawning an agent, the Orchestrator looks up the slot in the active profile and spawns the corresponding agent type.

This means the contract engine, evidence gate, and verification flow never reference specific agent types — they reference slots. A `quality_specialist` review works identically whether it comes from a qa-engineer or a methodology-reviewer.

---

## Decision Boundary

Who owns which decisions. See `protocol/01` for the full table.

| Decision | Owner |
|---|---|
| Phase selection and task routing | Orchestrator (mission skill) |
| Implementation approach | Implementer + design-authority |
| Structural review | design-authority |
| Evidence gate result | Gate runner / verifier |
| Adversarial challenge | challenger |
| Final closure verdict | product-authority |
| Specialist conflict resolution | Vote round, then product-authority |
| Durable memory promotion | Orchestrator + endorsing authority |

---

## Reviewer Routing

Tasks are assigned reviewers based on `task_kind`, `risk_level`, `scope`, and `gate_profile`. The full algorithm is in `protocol/01`. Summary:

1. **Default by task_kind** -- each task kind has a default reviewer slot (e.g., `code` -> design-authority, `docs` -> communication-specialist).
2. **Risk escalation** -- `high`/`critical` risk adds challenger and risk-specialist.
3. **Scope signals** -- file paths and scope markers add relevant specialist slots.
4. **Gate profile** -- `closure_ready` requires quality-specialist.
5. **Minimum guarantee** -- every task gets at least one reviewer (design-authority as fallback).

Routing uses **slot names**, not agent types. The active profile resolves slots to concrete agents.

---

## Agent Boundaries

All spawnable agents share these operational constraints:

- Spawned as sub-agents by the Orchestrator -- agents do not spawn other agents.
- Do their work and return results to the Orchestrator.
- Write evidence to the designated artifact path.
- Follow the TaskContract and their context packet.
- Base judgments on evidence, not assumptions.
- Surface `memory_suggestions` for patterns worth remembering across sessions.
