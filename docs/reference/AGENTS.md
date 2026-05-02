# Agents Reference

Geas uses a **slot-based role architecture**. The protocol defines abstract **slots**; concrete agent types are cataloged by path and role body, and task routing binds a concrete type to a slot at runtime. This separation lets the same governance pipeline serve different domains — software engineering, research, or any future profile — without rewriting the contract layer.

**Canonical slot definitions:** [`docs/protocol/01_AGENTS_AND_AUTHORITY.md`](../protocol/01_AGENTS_AND_AUTHORITY.md)
**Agent files:** `plugins/geas/agents/`

## Slot Families

**Authority (4 slots)** — orchestrator, decision-maker, design-authority, challenger. Always present regardless of domain.

**Specialist (5 slots)** — implementer, verifier, risk-assessor, operator, communicator. Minimum shared classification across domains. A concrete profile fills each slot with a domain-appropriate agent type, and may have multiple concrete types mapped to the same slot (for example, two implementer types in the research profile).

Slots are role positions. Evidence, review routing, and gate rules refer to slots — not concrete agent names — so the same pipeline works across domains.

The **Orchestrator** is the mission skill (the main-session driver), not a spawnable agent. It coordinates phases, dispatches specialists, and records task closure decisions. It does not appear under `plugins/geas/agents/`.

---

## Authority Agents

Authority agents are shared across all profiles. They provide governance, structural review, and adversarial challenge regardless of the domain.

| Agent | Slot | Model | Key Responsibility |
|---|---|---|---|
| [decision-maker](#decision-maker) | `decision-maker` | opus | Mission-level approval and the final mission verdict |
| [design-authority](#design-authority) | `design-authority` | opus | Mission design, structural review of contracts, gap analysis |
| [challenger](#challenger) | `challenger` | opus | Adversarial review on high-risk tasks and mission-level deliberations |

### decision-maker

The final judgment authority. Issues the mission verdict after reading the spec, design, task closures, gap analysis, and any deliberations.

- **Authority:** Mission-level approval checkpoints (scope-in task contracts during building, mission verdict at the end of consolidating). Resolves deliberations when participants disagree.
- **Judgment:** Weighs whether acceptance criteria were met, whether gaps are acceptable, and whether residual risks are within mission scope. A passing evidence gate does not automatically mean the mission ships — product judgment is separate from objective verification.
- **Artifacts:** `.geas/missions/{mission_id}/mission-verdicts.json`, deliberation verdicts.

### design-authority

The guardian of structural coherence. Authors the mission design, structurally reviews task and implementation contracts, and assembles the mission's gap analysis during consolidating.

- **Authority:** Writes the mission design during specifying. Structurally reviews task contracts and implementation contracts (verdict: approved / changes_requested / blocked). Writes the gap payload during consolidating.
- **Judgment:** Boundaries, interfaces, dependencies, justified complexity, bounded stubs. Flags overlaps with in-flight tasks and surface contention.
- **Artifacts:** `.geas/missions/{mission_id}/mission-design.md`, review-kind evidence under `tasks/{task_id}/evidence/design-authority.design-authority.json`, `consolidation/gap.json`.

### challenger

The adversarial reviewer who asks "why might this still be wrong?" while everyone else asks "is this correct?"

- **Authority:** Review slot on high- and critical-risk tasks; mission-level deliberation participant under full_depth.
- **Judgment:** Hidden assumptions, overconfidence, fragile complexity, unexamined negative cases, scope leaks, trust boundary violations. Every challenge review must include at least one substantive concern — empty approval is not allowed.
- **Artifacts:** Review-kind evidence under `tasks/{task_id}/evidence/challenger.challenger.json`; deliberation evidence during mission-level deliberations.

---

## Software Profile

For software engineering missions. Defined in `plugins/geas/agents/software/`.

| Slot | Agent | Key Responsibility |
|---|---|---|
| `implementer` | [software-engineer](#software-engineer) | Full-stack implementation (frontend, backend, design) |
| `implementer` | [platform-engineer](#platform-engineer) | Infrastructure, deployment, environment, operational readiness |
| `verifier` | [qa-engineer](#qa-engineer) | Independent acceptance verification |
| `risk-assessor` | [security-engineer](#security-engineer) | Trust boundaries, attack surfaces, security assessment |
| `communicator` | [technical-writer](#technical-writer) | Documentation completeness, accuracy, audience fit |

The software profile has two `implementer` types. The orchestrator routes the task to the appropriate one based on its nature (feature code versus platform/operational work) and records the chosen type in `contract.routing.primary_worker_type`.

### software-engineer

Full-stack implementer handling frontend, backend, and design implementation. Thinks in data flows, failure modes, user interactions, and system boundaries. Follows stack conventions, validates inputs, separates concerns. Submits honest self-checks.

### platform-engineer

Operational-backbone implementer. Handles deployment, CI/CD, environment setup, rollback capability, configuration drift, and operational visibility. Lives in the implementer slot because its output is still implementation work; review of operability concerns from other tasks comes via the `operator` review slot when explicitly required.

### qa-engineer

Independent verifier who checks that what was built actually holds against the contract. Starts from acceptance criteria, prioritizes negative paths, targets the implementer's stated `known_risks` and untested areas. Evidence is `verification`-kind, not `review`-kind — every task has an implicit verifier regardless of `required_reviewers`.

### security-engineer

Risk assessor focused on trust boundaries and attack surfaces. Maps trust boundaries, checks auth and authorization, inspects secret handling, evaluates injection surfaces and OWASP Top 10 classes. Classifies findings by actual exploitability.

### technical-writer

Clarity specialist ensuring the deliverable can be understood. Checks documentation impact, accuracy against implementation, audience fit, completeness for new features and breaking changes, and findability.

---

## Research Profile

For research and analysis missions. Defined in `plugins/geas/agents/research/`.

| Slot | Agent | Key Responsibility |
|---|---|---|
| `implementer` | [literature-analyst](#literature-analyst) | Systematic literature search, source evaluation, synthesis |
| `implementer` | [research-analyst](#research-analyst) | Experiment design, data analysis, reproducible evidence |
| `verifier` | [methodology-reviewer](#methodology-reviewer) | Methodological soundness, statistical validity, reproducibility |
| `risk-assessor` | [research-integrity-reviewer](#research-integrity-reviewer) | Ethics, data privacy, bias, validity threats |
| `operator` | [research-engineer](#research-engineer) | Data pipelines, compute resources, environment reproducibility |
| `communicator` | [research-writer](#research-writer) | Research documentation, citation accuracy, audience-appropriate writing |

The research profile has two `implementer` types. The orchestrator routes tasks based on whether the work is a literature synthesis or hands-on experimental work.

### literature-analyst

Systematic researcher who finds, evaluates, and synthesizes published knowledge. Prefers primary sources, assesses source credibility, identifies contradictions explicitly, notes knowledge gaps, and covers at least three independent sources for major claims.

### research-analyst

Hands-on researcher who designs experiments, analyzes data, builds models, and runs simulations. Starts from falsifiable hypotheses, documents every transformation for reproducibility, reports negative results honestly, quantifies uncertainty.

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

Slots resolve to concrete agent types through two simple mechanisms:

1. **Authority slots** map one-to-one to a single agent type. The slot name is the agent name: `decision-maker.md`, `design-authority.md`, `challenger.md`.
2. **Specialist slots** are filled from the domain catalog under `plugins/geas/agents/software/` or `plugins/geas/agents/research/`. The orchestrator picks a concrete agent type for the slot from the mission profile and task routing; the agent body documents its normal slot responsibilities, but slot and domain are not frontmatter fields.

Evidence files encode both ends: `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.{slot}.json`. `agent` is the concrete type (for example, `qa-engineer` or `design-authority`); `slot` is the protocol role (`verifier`, `design-authority`, `risk-assessor`, …). The pipeline routes and reads by slot; the filename records who actually held the slot for auditing.

Orchestration logic references slots exclusively. A `verifier` review works identically whether it comes from a qa-engineer or a methodology-reviewer.

---

## Decision Boundary

Who owns which decisions. See [`docs/protocol/01_AGENTS_AND_AUTHORITY.md`](../protocol/01_AGENTS_AND_AUTHORITY.md) for the full table.

| Decision | Owner |
|---|---|
| Phase selection and task routing | Orchestrator (mission skill) |
| Implementation approach (plan) | Implementer alone. Writes the implementation contract during the `implementing` state; reviewers see it post-work, not before |
| Structural review of contracts | design-authority |
| Evidence gate verdict | Gate runner (Tier 0 / Tier 1 / Tier 2 over existing evidence) |
| Adversarial challenge | challenger |
| Task closure decision | Orchestrator, after evidence gate passes |
| Mission verdict | decision-maker |
| Specialist conflict resolution | Deliberation, resolved by decision-maker |
| Durable memory promotion | Orchestrator, subject to authority endorsement during consolidating |

---

## Reviewer Routing

The task contract's `routing` field fixes the reviewer composition for each task:

- `routing.primary_worker_type` — the concrete implementer type selected by the orchestrator at contract time.
- `routing.required_reviewers` — a list of **review slots** (not agent names) drawn from a restricted enum: `challenger`, `risk-assessor`, `operator`, `communicator`.

`verifier` is always required implicitly for every task and does not appear in `required_reviewers` — its evidence is `verification`-kind, not `review`-kind.

Concrete reviewer types are resolved at dispatch time from the mission's domain profile. A `risk-assessor` review slot on a software mission dispatches to `security-engineer`; the same slot on a research mission dispatches to `research-integrity-reviewer`. The contract records slots so the same mission design is portable across profiles.

---

## Agent Boundaries

All spawnable agents share these operational constraints:

- Agents are spawned as sub-agents by the orchestrator. Agents do not spawn other agents.
- Agents do their work and return results to the orchestrator.
- Agents write evidence only through the CLI; no agent touches `.geas/` directly.
- Agents follow the task contract and their context briefing.
- Agents base judgments on evidence, not assumptions.
- Agents surface `memory_suggestions` on evidence entries for patterns worth remembering across sessions — promotion into memory is a separate decision owned by the orchestrator.
