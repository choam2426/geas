# 06. Memory

> Defines Geas memory structure, change history, retrieval, and rollback. Retrospective inputs emitted from tasks are owned by [03_TASK_LIFECYCLE_AND_EVIDENCE.md](./03_TASK_LIFECYCLE_AND_EVIDENCE.md), and unresolved debt and gap are owned by [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md).

## Purpose

Memory is the record that helps the next mission do better. This document is not about the work log for a single task. It defines how lessons accumulated across missions are promoted into memory.

## Memory structure

Memory is stored in two scopes.

| scope | path | role |
|---|---|---|
| shared | `.geas/memory/shared.md` | Rules, conventions, prohibitions, and baseline procedures the whole team should follow |
| agent | `.geas/memory/agents/{agent_type}.md` | Personalized lessons for a specific agent type. The namespace is the concrete agent type name: authority roles use the slot name itself (for example, `decision-maker.md`), while specialist roles use the concrete type chosen by the domain profile (for example, `software-engineer.md`) |

Shared memory is normative. It is used as reusable behavioral guidance and may be cited in enforcement or review. Agent memory is advisory. It helps role-specific judgment, but it should be discarded easily if it conflicts with a new mission's contract or evidence.

Task evidence `memory_suggestions` and the retrospective fields in closure evidence (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`) are only candidate inputs. This document governs how those inputs are promoted into memory. Debt and gap signals are owned by [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md).

## Shared Memory

Shared memory (`.geas/memory/shared.md`) collects rules worth reusing over the long term. The protocol does not prescribe an exact document format, but each entry must at least make the following identifiable.

- A unique `memory_id` that `memory-update.json` can reference
- The body of the rule or lesson
- The source mission or evidence that produced it

Shared memory should contain repeatable behavioral guidance, not one-off situational notes. An implementation may group entries into readable categories, or leave them ungrouped, for example by project convention, learned rule, or role-specific rule.

## Agent Memory

Agent memory (`.geas/memory/agents/{agent_type}.md`) stores notes that a specific concrete agent type can reuse in later missions. The namespace key is the agent type name. Authority slots map one-to-one to a single agent, so the slot name is also the type name, for example `challenger.md`. Specialist slots use the concrete type chosen by the mission spec's `domain_profile`, such as `software-engineer.md` or `security-engineer.md`. Slot names are not used as memory namespaces, because the same specialist slot can be filled by different concrete types in different domains, and slot-level accumulation would blur those domain-specific lessons together.

Good agent memory has the following qualities.

- It captures a repeatable lesson, not a coincidence that happened to work once.
- It summarizes role-appropriate judgment points briefly.
- It can be discarded easily if it conflicts with the current mission's contract or evidence.

Like shared memory, agent memory is promoted during the `consolidating` phase by the Orchestrator. The result is recorded in the `agents` section of `memory-update.json`. In that array, each entry's `agent` key uses the concrete type name.

## Memory Update

This mission's changes to memory are recorded in `memory-update.json`. The path is `.geas/missions/{mission_id}/consolidation/memory-update.json`, and the exact structure is governed by `memory-update.schema.json`.

`memory-update.json` has two sections.

- `shared` — changes made to `.geas/memory/shared.md` (`added`, `modified`, `removed`)
- `agents` — per-agent-type changes made to `.geas/memory/agents/{agent_type}.md`; only agent types with changes appear in the array

Each `added` or `modified` item records `memory_id`, `reason`, and the supporting `evidence_refs`. Each `removed` item records only `memory_id` and `reason`.

Suggested changes that were discussed but not adopted do not belong in `memory-update.json`. If a proposal is important enough that the adoption decision itself should be recorded, it belongs in deliberation; once that deliberation is resolved, only the resulting adopted change should appear in `memory-update.json`.

The Orchestrator writes this artifact during the `consolidating` phase. It takes task evidence `memory_suggestions` and closure retrospective fields as input, then decides for each candidate whether to:

1. promote it to shared memory
2. promote it to a specific agent type's memory
3. discard it

Only the promoted results are recorded in this artifact.

### Criteria for a shared-memory candidate

- The same failure or confusion keeps recurring.
- Adding the entry would actually change behavior.
- It is not a temporary trick that applies only to one mission.
- There is concrete evidence behind it, such as a repeated pattern surfaced in evidence or during resume handling.

## Retrieval

Memory exists to support better judgment, not simply because implementations find it convenient to auto-inject into context.

- At mission start, read the shared memory and agent memory relevant to the mission spec's scope and `affected_surfaces`.
- When a new task opens in `ready`, pull in only the memory relevant to that task contract's scope and `surfaces`, because applicability differs by task.
- If older memory conflicts with the current mission spec or task contract, the current contract takes priority.

## Rollback

If existing memory starts hurting quality or reinforcing the wrong pattern, it must be reversible. This applies to both shared memory and agent memory.

- Only repeatable lessons should accumulate in memory. A one-off accident or short-term situation must not be promoted.
- Remove entries that are no longer valid as soon as they are recognized. The concrete procedure is defined by the Memory Update section.
- Record the reason for the rollback as well. If the rollback pattern itself starts recurring, for example "we often promote this kind of memory too early," promote that lesson as its own separate entry.
