# Geas v3 Product Protocol Contract

- Status: draft for user review
- Date: 2026-05-02
- Scope: Geas v3.0.0 rework planning
- Primary reader: implementers. Secondary readers are users and runtime agents.

## 1. Why v3 Exists

Geas v3 exists because the v2.x system accumulated too much protocol weight, runtime state, and implementation debt. The current system has strong ideas, but too many of those ideas became first-class procedure. The result is a product that can feel ceremonial to users and costly to maintain for implementers.

The v3 rework starts from this constraint:

> Existing v2.x code, docs, schemas, skills, and dashboard behavior are reference material, not binding design constraints.

The rework is not a compatibility-preserving feature release. It is a product and protocol redesign that should keep only the parts that directly support the v3 core promise.

### Problems v3 Must Remove

- Heavy user flow: the user should not feel like they are operating a process engine.
- Overgrown protocol model: phases, task states, gates, verdicts, memory, and debt should not all be mandatory top-level concepts.
- Artifact sprawl: the runtime tree should not require many files to represent one understandable mission.
- Split-brain design: user-visible flow and internal protocol should not be documented as separate realities.
- Debt accumulation: v3 planning must explicitly delete, reinterpret, or defer v2.x concepts before implementation begins.

## 2. Core Promise

Geas v3 should provide one product promise:

> A user can hand Geas a non-trivial goal, and Geas will shape it into a small explicit contract, execute work against that contract, preserve evidence, and make the final decision understandable.

This promise has five implications.

- The user flow must remain lightweight enough to use repeatedly.
- The protocol must be small enough for agents to follow without ceremony.
- Every required artifact must justify itself by supporting user understanding, execution safety, or recovery.
- Evidence remains central, but the evidence workflow should be simpler than the v2.x gate model.
- Final decisions should be readable as product outcomes, not just protocol verdicts.

## 3. Product Flow

The user-visible flow is the first-class flow. Protocol exists to support this flow, not to compete with it.

```text
intent -> shape -> approve -> work -> review -> close
```

### intent

The user expresses what they want. Geas captures the goal, constraints, known risks, and preferred strictness. It should ask only the questions needed to avoid unsafe guessing.

Success state: Geas can restate the goal in terms the user recognizes.

### shape

Geas turns the intent into a proposed contract and execution shape. This is where scope is reduced, ambiguous work is split, and unnecessary process is removed.

Success state: the user can see what will be done, what will not be done, and how completion will be judged.

### approve

The user approves the contract or asks for changes. Approval should be a meaningful checkpoint, not a repeated ritual.

Success state: work starts only after the current contract is understandable and accepted.

### work

Geas executes the approved work. The implementation path may involve one agent or multiple agents, but the product flow should not expose internal dispatch complexity unless it matters to the user.

Success state: work is traceable to the contract.

### review

Geas compares the result against the contract and gathers evidence. Review can be automatic, manual, or agent-assisted, but it should resolve into a simple user-facing assessment.

Success state: the user can see what was checked, what passed, what remains uncertain, and what changed.

### close

Geas closes the mission with a decision, a concise result summary, and any follow-up items that genuinely matter.

Success state: the mission can be understood later without replaying the conversation.

## 4. Protocol Kernel

The v3 protocol kernel mirrors the product flow with fewer concepts.

```text
intent -> contract -> execution -> evidence -> decision
```

### intent

The captured user goal and constraints. This is not a large mission spec. It is the minimum stable description needed to produce a contract.

### contract

The approved agreement for the work. It includes scope, acceptance checks, known exclusions, risk level, and the evidence expected at review time.

### execution

The active work record. It tracks what is being attempted and by whom, without exposing a large task lifecycle by default.

### evidence

The proof record. Evidence should answer: what was inspected, what was run, what changed, and what confidence remains.

### decision

The closure record. It states whether the contract was satisfied, whether follow-up is needed, and what the user should know next.

## 5. Product/Protocol Mapping

| User moment | Protocol concept | Required artifact | User decision | Success check |
|---|---|---|---|---|
| intent | intent | `intent` record | clarify or proceed | goal is restated accurately |
| shape | contract draft | draft `contract` record | narrow scope or accept shape | scope and checks are explicit |
| approve | contract | approved `contract` record | approve or revise | no work starts before approval |
| work | execution | `execution` record | usually none | work is linked to contract |
| review | evidence | `evidence` record | accept uncertainty or request more work | checks and limits are visible |
| close | decision | `decision` record | accept close or reopen | outcome is understandable later |

The mapping is the v3 design anchor. A protocol concept that cannot be placed in this table is not part of the v3 kernel. It may become an implementation detail, an optional extension, or a deferred feature.

## 6. Product Surface

### CLI

The CLI is the write actuator for the runtime model. In v3 it should be smaller than the v2.x command surface and centered on the kernel records.

Responsibilities:

- create, update, and validate kernel records;
- preserve atomic writes and basic recovery;
- provide structured output for agents and tools;
- avoid owning product judgment.

Non-responsibilities:

- running a large phase machine;
- hiding product decisions inside automatic transitions;
- exposing many one-off commands for rare protocol branches.

### Skills And Agents

Skills and agents are execution aids, not the protocol itself. v3 should reduce required roles and make specialist dispatch optional based on risk and scope.

Responsibilities:

- keep user intake concise;
- produce and revise contracts;
- execute work against contracts;
- produce evidence in a consistent shape;
- summarize decisions in user-readable language.

Non-responsibilities:

- preserving the v2.x roster size;
- forcing every mission through the same multi-agent structure;
- making internal role separation visible when it adds no value.

### Dashboard

The dashboard should present the product flow and runtime records, not a separate protocol universe.

Responsibilities:

- show the current mission state in the same terms the user experienced;
- expose contracts, evidence, and decisions;
- make follow-up/debt visible without turning it into mandatory ceremony.

Non-responsibilities:

- preserving v2.x tab structure;
- visualizing every internal state transition;
- becoming the primary source of truth.

### Docs

Docs should be layered from product contract to implementation details.

Responsibilities:

- keep product flow and protocol kernel in the same document layer;
- document runtime records only after the kernel is stable;
- mark v2.x concepts as deleted, reinterpreted, or deferred.

Non-responsibilities:

- maintaining parallel product and protocol narratives;
- documenting every old behavior before deciding whether it survives.

## 7. Runtime Model

The v3 runtime model should start from kernel records, not from the v2.x `.geas/` tree.

Initial runtime hypothesis:

```text
.geas/
  missions/
    {mission_id}/
      intent.*
      contract.*
      execution.*
      evidence.*
      decision.*
  project.*
```

The exact file formats are intentionally left for the runtime design phase, but the record set is constrained here. The default v3 mission should not require separate first-class files for phase reviews, gate runs, deliberations, memory updates, gap analysis, and task states.

Those concepts may reappear only if they pass one of these tests:

- They make the user flow clearer.
- They materially improve safety for high-risk work.
- They are required for reliable recovery.
- They replace more complexity than they add.

## 8. Complexity Budget

The v3 design needs a complexity budget so the rework does not recreate v2.x with new names.

Initial budget:

| Area | v3 budget |
|---|---|
| User-visible flow moments | 6 or fewer |
| Kernel protocol concepts | 5 or fewer |
| Required mission records | 5 or fewer |
| Default user approval checkpoints | 1 before work, 1 at close |
| Default lifecycle states | 5 or fewer |
| Required agent roles | 3 or fewer |
| Default CLI write command families | 5 or fewer |

Budgets are not feature requirements. They are pressure limits. Exceeding one requires an explicit written reason in the relevant follow-up design.

## 9. Delete, Reinterpret, Defer

### Delete From The v3 Kernel

- Four mandatory mission phases.
- Large task lifecycle as the default mental model.
- Evidence gate as a separate mandatory protocol machine.
- Always-on deliberation flow.
- Mandatory memory and gap analysis at mission close.

### Reinterpret

- Task contract becomes contract. It may describe one unit of work or several, but the default user experience is one mission contract.
- Evidence gate becomes review. The review still cares about evidence, but the protocol surface is smaller.
- Verdict becomes decision. The language should read like a product outcome.
- Debt becomes follow-up. It should be captured when useful, not required as a close ritual.
- Agents become optional execution roles selected by risk, not a fixed team ceremony.

### Defer Beyond The First v3 Kernel

- Rich project memory.
- Multi-party deliberation.
- Detailed dashboard analytics.
- Migration tooling from v2.x `.geas/` missions.
- Full compatibility adapters for every existing client surface.

Deferred does not mean rejected. It means the concept must prove itself against the v3 kernel after the core flow is small and usable.

## 10. Rework Roadmap

### Stage 0: Debt Map And Deletion List

Goal: identify v2.x concepts that survive, change, or disappear.

Checks:

- every major v2.x protocol concept is classified;
- no implementation work starts before deletion candidates are explicit;
- the classification is tied to the v3 core promise.

### Stage 1: Product Protocol Kernel

Goal: finalize the product flow, protocol kernel, mapping table, and complexity budget.

Checks:

- product flow and protocol flow live in the same document layer;
- every kernel record maps to a user moment;
- the default mission path can be explained without v2.x jargon.

### Stage 2: Runtime Record Design

Goal: design the v3 `.geas/` records and schemas from the kernel.

Checks:

- required mission records fit the complexity budget or document why not;
- runtime recovery can reconstruct the current mission;
- artifacts can be read without conversation context.

### Stage 3: CLI Redesign

Goal: build a smaller CLI around kernel records.

Checks:

- command families map to kernel records;
- writes remain validated and atomic;
- the CLI does not encode product judgment that belongs in the contract or decision.

### Stage 4: Skills And Agents Redesign

Goal: make the agent workflow follow the product flow.

Checks:

- default path works with minimal roles;
- higher-risk paths can add review without changing the kernel;
- user-facing language matches the product flow.

### Stage 5: Dashboard Reframe

Goal: make the dashboard display v3 records and user moments.

Checks:

- dashboard navigation mirrors the product flow;
- contracts, evidence, and decisions are inspectable;
- optional follow-up/debt does not dominate the default view.

### Stage 6: Release And Migration Decision

Goal: decide how v3 ships and how much v2.x compatibility exists.

Checks:

- release notes clearly state breaking changes;
- migration is either intentionally supported or intentionally not supported for v3.0.0;
- docs, plugin metadata, CLI, and dashboard agree on the same v3 model.

## 11. Success Criteria

The v3 rework succeeds when these checks pass:

- A new contributor can explain the default mission flow in under two minutes.
- A user can tell where they are in the mission without knowing internal state names.
- The default mission path uses fewer required records than v2.x.
- The CLI command surface is organized around kernel records, not every protocol branch.
- Evidence remains available without requiring a large gate ritual.
- Follow-up debt is captured when useful, not forced into every close.
- Product docs, protocol docs, skills, CLI, and dashboard all use the same core vocabulary.

## 12. Immediate Next Step

After this document is reviewed, the next document should be a focused v3 kernel design that freezes the first version of:

- the exact user-visible flow;
- the exact kernel records;
- the runtime record names and required fields;
- the reduced default agent roles;
- the first CLI command family list.

That follow-up design should be small enough to become an implementation plan without reopening the entire v3 product direction.
