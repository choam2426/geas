# 13. Assurance Profiles and Standards Alignment

> **Normative + informative document.**
> This document defines Geas assurance profiles and explains how the protocol aligns with external standards and official guidance commonly used in AI-assisted structured work.

## Purpose

Geas is an internal operating protocol, but teams doing serious structured work need to understand how it maps to broader industry controls. This document serves two purposes:

1. define **assurance profiles** that bundle minimum rigor expectations
2. document alignment with well-known external standards and guidance

This document does not claim formal certification under those standards. It provides a practical control mapping for implementation and audit planning.

## Why Assurance Profiles Exist

Not all missions need the same rigor. The protocol should scale with risk without abandoning core invariants.

Assurance profiles allow a project to answer:

- what is the minimum review rigor for this mission?
- what traceability and evaluation are required?
- what provenance or security controls are expected?
- when is user approval required?

## Assurance Profiles

Geas defines four assurance profiles that represent increasing levels of rigor. Each profile builds on the previous one, adding controls appropriate to higher-risk or higher-consequence work.

### `prototype`

Best for exploratory, internal, low-risk work.

Minimum expectations:

- task lifecycle preserved
- at least one independent review path
- evidence gate present
- closure packet and final verdict present
- retrospective and debt surfaces preserved

### `delivery`

Best for ordinary product development.

Minimum expectations:

- full baseline conformance
- reviewer routing by task kind and risk
- health signal monitoring
- explicit recovery and packet freshness handling
- memory and rules feedback loop active

### `hardened`

Best for security-sensitive, user-impacting, or operationally risky work.

Minimum expectations:

- stronger multi-perspective review
- explicit critical-review challenge on high-risk work
- evaluation evidence for agentic-control changes
- stronger provenance and delivery-readiness expectations
- policy overrides recorded and audited

### `regulated`

Best for high-consequence environments or projects subject to strong organizational governance.

Minimum expectations:

- all hardened controls
- tighter approval and change documentation
- strong user review on critical decisions
- explicit provenance and retention policy
- heightened recovery conservatism
- stricter evidence retention and auditability

Projects MAY rename profiles locally, but the functional distinction SHOULD remain visible.

## Recommended Profile Selection

| situation | recommended minimum profile |
|---|---|
| small internal experiment with low blast radius | `prototype` |
| standard product work | `delivery` |
| auth, permissions, finance, PII, production ops, public output | `hardened` |
| regulated or high-consequence environment | `regulated` |

The selected profile SHOULD be visible at mission start.

## Profile Control Matrix

The control matrix shows how each profile scales enforcement across key control surfaces.

| control surface | prototype | delivery | hardened | regulated |
|---|---|---|---|---|
| task contract and gate | required | required | required | required |
| independent review | 1 reviewer | routing-based | routing + stronger challenge | stronger + user-involved where policy requires |
| critical review for high risk | recommended | required | required | required |
| recovery packet and safe-boundary discipline | required | required | required | required |
| health signals | basic | required | required | required |
| eval evidence for agentic changes | optional | recommended | required | required |
| provenance / delivery attestation | optional | recommended | required | required |
| explicit override logging | required if used | required | required | required |
| user sign-off on critical exceptions | optional | recommended | recommended / policy-based | required by policy |

## Alignment Themes

Geas intentionally aligns with several recurring themes in modern AI and structured work guidance:

- explicit governance rather than implicit prompt behavior
- structured handoffs and tool contracts
- tracing and observability
- eval-driven improvement
- secure development controls
- provenance and supply-chain integrity
- protection against LLM-specific threat classes
- just-in-time context rather than unbounded prompt stuffing

## Standards and Guidance Mapping

The following sections describe how Geas aligns with broad categories of external guidance. Geas does not target any single standard, but its design reflects principles common across many.

### AI risk management

Geas aligns with the governance, mapping, measurement, and management cycle by requiring explicit roles, risk-scaled review, measurable gate outcomes, health signals, and feedback loops.

### Secure development

Geas aligns with secure development thinking through reviewer routing, risk-area review, artifact validation, recovery conservatism, and explicit debt handling rather than hidden shortcuts.

### Supply-chain integrity and provenance

Geas aligns with provenance-oriented delivery by treating integration, artifact lineage, delivery readiness, and serialized base_snapshot mutation as first-class concerns.

### LLM-application security

Geas aligns with LLM security guidance by treating tool outputs, repository text, memory, and summaries as potentially untrusted context; by preserving least-privilege and explicit policy boundaries; and by making review and logging mandatory around risky surfaces.

### Tool and context interoperability

Geas aligns with structured tool ecosystems by preferring explicit contracts, schemas, and attributable handoffs over free-form hidden tool invocation.

### Observability

Geas aligns with trace-first practice by treating gates, hooks, slot actions, artifacts, and recovery events as telemetry-worthy events that should be correlated.

### Eval-driven AI development

Geas aligns with eval-driven practice by requiring representative evidence for changes to prompts, routing, tools, memory behavior, or other agentic control surfaces when risk or assurance profile warrants it.

## Practical Mapping to Geas Documents

| external control theme | primary Geas docs |
|---|---|
| governance and authority | 00, 01, 02 |
| task contracts and lifecycle | 03, 05 |
| parallelism and safe integration | 04 |
| review evidence and challenge | 05, 06 |
| memory and context governance | 07, 08, 09 |
| recovery and resumability | 10 |
| artifacts and validation | 11 |
| enforcement, health, and observability | 12 |
| debt, retrospectives, and continuous improvement | 14 |

## Policy Overrides

An override exists when a project intentionally weakens a normal hard-stop or requirement for a limited circumstance.

Override rules:

- MUST be explicit
- MUST have owner and rationale
- MUST state scope and expiration
- MUST NOT erase evidence obligations
- SHOULD trigger follow-up debt or review work

Stronger assurance profiles SHOULD make overrides rarer and more visible, not easier.

## Delivery and Shipping Guidance by Profile

Each profile implies different expectations for what must be true before work is shipped or delivered.

### Prototype

Shipping MAY tolerate some documented debt, but should still avoid unknown blockers.

### Delivery

Shipping SHOULD require coherent packet completeness and review coverage.

### Hardened

Shipping SHOULD additionally require explicit treatment of open risks, challenge output, and representative eval evidence for agentic changes.

### Regulated

Shipping SHOULD also require stronger user governance, retention, and provenance discipline in accordance with local obligations.

## Implementation Guidance

A project adopting assurance profiles SHOULD:

1. declare the default profile
2. define how profile upgrades occur
3. define which local hooks or checks map to each profile
4. document who may authorize overrides
5. ensure profile selection is reflected in mission planning, not only at delivery time

## External Reference Set (Informative)

The following official materials strongly informed this alignment model:

- Anthropic — *Building Effective AI Agents*
- Anthropic — *Effective Context Engineering for AI Agents*
- Anthropic — *Introducing the Model Context Protocol*
- Anthropic — *Harness design for long-running application development*
- OpenAI — *Agents SDK* documentation
- OpenAI — *Tracing* documentation for Agents SDK
- OpenAI — *Evaluation best practices*
- OpenAI — *Working with evals*
- OpenAI — *Eval Driven System Design — From Prototype to Production*
- OpenAI — *Using PLANS.md for multi-hour problem solving*
- NIST — *AI Risk Management Framework (AI RMF 1.0)*
- NIST — *Secure Software Development Framework (SP 800-218)*
- SLSA — build and provenance levels
- OWASP — *Top 10 for LLM Applications 2025*
- OpenTelemetry — semantic conventions for traces, logs, and metrics

## Key Statement

Geas is strongest when it is not just internally consistent, but externally legible. Assurance profiles turn abstract rigor into selectable operating posture, and standards alignment turns local process into organization-grade discipline.
