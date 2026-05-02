# Geas Protocol Diagrams

This document presents the core flows defined by the Geas protocol (`docs/protocol/`, 9 docs) and the JSON schemas (`docs/schemas/`, 14 schemas) as Mermaid diagrams. Each diagram names its source document at the top.

## Table of Contents

1. [Mission Phase Flow](#1-mission-phase-flow)
2. [Specifying Approval Flow](#2-specifying-approval-flow)
3. [Task Lifecycle](#3-task-lifecycle)
4. [Evidence Gate](#4-evidence-gate)
5. [Agent Slots and Responsibilities](#5-agent-slots-and-responsibilities)
6. [Artifact Relationships](#6-artifact-relationships)

---

## 1. Mission Phase Flow

> Reference: [protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md)

A mission moves through four phases in sequence and ends in `complete`. Each phase ends with a phase gate, and the next phase opens only when the phase review is `passed`. Limited rollback is allowed only from polishing and consolidating; returning to specifying is not allowed.

```mermaid
flowchart LR
    S["specifying"]
    B["building"]
    P["polishing"]
    CS["consolidating"]
    C(["complete"])

    S -->|phase review passed| B
    B -->|phase review passed| P
    P -->|phase review passed<br/>no additional tasks| CS
    CS -->|mission verdict<br/>approved / cancelled| C

    P -.->|new task required<br/>rollback| B
    CS -.->|closeout incomplete<br/>rollback| P
    CS -.->|new task execution required<br/>rollback| B
```

A mission verdict is one of `approved`, `changes_requested`, `escalated`, or `cancelled`. When the verdict is `changes_requested` or `escalated`, additional work is performed and a new verdict is appended to the array. `cancelled` is terminal. If the mission is abandoned before spec approval, it goes straight to `complete` without entering consolidating.

---

## 2. Specifying Approval Flow

> Reference: [protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) (`Operating mode requirements` + `specifying` phase)

The mission spec is always approved by the user alone. The mission design and the initial set of task contracts follow different approval paths depending on the operating mode.

```mermaid
flowchart TD
    A["Orchestrator drafts<br/>the mission spec through user dialogue"]
    B["User approval<br/>(mission spec)"]
    C["Design Authority drafts<br/>the mission design"]
    D{mission mode?}
    D1["User approval"]
    D2["Decision Maker review<br/>then user approval"]
    D3["Deliberation<br/>DM + Challenger + 1 specialist<br/>then user approval"]
    E["Design Authority drafts<br/>the initial task contract set"]
    F{mission mode?}
    F1["User approval"]
    F2["Decision Maker review<br/>then user approval"]
    F3["Deliberation<br/>DM + Challenger + 1 specialist<br/>then user approval"]
    G(["Enter building phase"])

    A --> B --> C --> D
    D -->|lightweight| D1
    D -->|standard| D2
    D -->|full_depth| D3
    D1 --> E
    D2 --> E
    D3 --> E
    E --> F
    F -->|lightweight| F1
    F -->|standard| F2
    F -->|full_depth| F3
    F1 --> G
    F2 --> G
    F3 --> G
```

The `approved_by` field on a task contract records the final approver (`user` or `decision-maker`; the initial task set uses `user`). In-scope tasks added during building or polishing may move to `ready` with Decision Maker approval alone. Work outside the mission scope is not handled within the current mission. If the user wants to expand scope, they must either escalate the current mission or open a follow-up mission.

---

## 3. Task Lifecycle

> Reference: [protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md](protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md)

A task has six primary states (`drafted` -> `ready` -> `implementing` -> `reviewing` -> `deciding` -> `passed`) and three held or terminal states (`blocked`, `escalated`, `cancelled`). `blocked` and `escalated` are temporary; once resolved, the task returns to the appropriate point in the lifecycle or terminates.

```mermaid
stateDiagram-v2
    [*] --> drafted
    drafted --> ready: approved_by set<br/>+ phase gate
    ready --> implementing: dependency tasks passed<br/>+ baseline valid
    implementing --> reviewing: self-check submitted
    reviewing --> deciding: evidence gate passed
    deciding --> passed: closure approved

    implementing --> blocked: blocking reason
    reviewing --> blocked: blocking reason
    deciding --> blocked: blocking reason
    blocked --> ready: blocking cause resolved
    blocked --> implementing: blocking cause resolved
    blocked --> reviewing: blocking cause resolved

    blocked --> escalated: higher-level judgment required
    deciding --> escalated: higher-level judgment required
    escalated --> passed: higher-level approved<br/>(escalated from deciding)
    escalated --> ready: higher-level changes_requested
    escalated --> implementing: higher-level changes_requested
    escalated --> reviewing: higher-level changes_requested

    drafted --> cancelled
    ready --> cancelled
    implementing --> cancelled
    reviewing --> cancelled
    deciding --> cancelled
    blocked --> cancelled
    escalated --> cancelled

    passed --> [*]
    cancelled --> [*]
```

A closure verdict is one of `approved`, `changes_requested`, `escalated`, or `cancelled`. `changes_requested` is a rewind, and the Orchestrator records both the restore target and the rationale. When a task ends as `cancelled` and is replaced by another contract, the new task contract points back through its `supersedes` field.

---

## 4. Evidence Gate

> Reference: [protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md](protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md) (`Evidence Gate` section)

The Evidence Gate runs in order from Tier 0 to Tier 1 to Tier 2. At any tier, `fail`, `block`, or `error` immediately becomes the verdict for the whole gate. Tier 2 aggregates reviewer verdicts.

```mermaid
flowchart TD
    Start(["Gate start<br/>(task = reviewing)"])

    T0["Tier 0<br/>required artifacts + required reviewer<br/>evidence submitted?"]
    T1["Tier 1<br/>repeatable objective verification<br/>defined by verification_plan<br/>(automated or manual)"]
    T2["Tier 2<br/>aggregate reviewer verdicts<br/>+ compare against contract"]

    Out0["gate = Tier 0 result<br/>(fail/block/error)"]
    Out1["gate = Tier 1 result<br/>(fail/block/error)"]
    OutPass(["gate pass<br/>-> task deciding"])
    OutFail["gate fail"]
    OutBlock["gate block"]

    Delib{"Verdicts hard to reconcile?"}
    DelibRun["task-level deliberation"]

    Start --> T0
    T0 -->|pass| T1
    T0 -->|otherwise| Out0

    T1 -->|pass| T2
    T1 -->|otherwise| Out1

    T2 --> Delib
    Delib -->|yes| DelibRun
    DelibRun --> T2
    Delib -->|no| Agg["Aggregate<br/>if any blocked -> block<br/>if any changes_requested<br/>and none blocked -> fail<br/>if all approved -> pass"]

    Agg -->|pass| OutPass
    Agg -->|fail| OutFail
    Agg -->|block| OutBlock
```

The gate verdict is appended as an immutable object in the `runs` array of `gate-results.json`. Retries accumulate as new runs; earlier runs are never overwritten.

---

## 5. Agent Slots and Responsibilities

> Reference: [protocol/01_AGENTS_AND_AUTHORITY.md](protocol/01_AGENTS_AND_AUTHORITY.md)

A slot is a protocol role, not an implementation identity. Implementations map slots to concrete agent types, but the protocol is always read in terms of slot names. One concrete agent may cover multiple slots, but the role switch must be explicit.

```mermaid
flowchart TB
    subgraph Authority["Authority slots"]
        O["orchestrator<br/>task state management<br/>closure decisions<br/>memory updates"]
        DM["decision-maker<br/>mission final verdict<br/>in-scope task approval<br/>standard reviews"]
        DA["design-authority<br/>mission design<br/>task decomposition<br/>gap authoring"]
        CH["challenger<br/>counterarguments<br/>deliberation participant<br/>(required in full_depth)"]
    end

    subgraph Specialist["Specialist slots"]
        IM["implementer<br/>implementation + self-check<br/>implementation evidence"]
        V["verifier<br/>independent verification<br/>verification evidence"]
        RA["risk-assessor<br/>risk review"]
        OP["operator<br/>operational review"]
        CM["communicator<br/>documentation review"]
    end
```

Default ownership by evidence kind:

| kind | Primary producer |
|---|---|
| `implementation` | `implementer` |
| `review` | `risk-assessor`, `operator`, `communicator`, `challenger` |
| `verification` | `verifier` |
| `closure` | `orchestrator` |

---

## 6. Artifact Relationships

> Reference: [protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md](protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md)

Mission-level and task-level artifacts accumulate as a hierarchy. Append-only logs (`phase-reviews`, `mission-verdicts`, `gate-results`, `deliberations`, `evidence`) never overwrite prior entries; they append new array items.

```mermaid
flowchart LR
    subgraph Project["Project-level"]
        D["debts<br/>(cross-mission ledger)"]
    end

    subgraph Mission["Mission-level"]
        MS["mission-spec<br/>(spec.json)"]
        MD["mission-design<br/>(mission-design.md)"]
        MState["mission-state"]
        PR["phase-reviews<br/>(append)"]
        MDel["deliberations<br/>(mission-level, append)"]
        MV["mission-verdicts<br/>(append)"]
        G["gap"]
        MU["memory-update"]
    end

    subgraph Task["Task-level (per task_id)"]
        TC["task-contract"]
        IC["implementation-contract"]
        SC["self-check"]
        TDel["deliberations<br/>(task-level, append)"]
        TE["evidence/{agent}.{slot}<br/>(entries append)"]
        GR["gate-results<br/>(runs append)"]
        TS["task-state"]
    end

    MS --> MD --> TC
    TC --> IC --> SC
    SC --> TE
    TE --> GR
    TE --> PR
    PR --> MV

    TE --> D
    TE --> G
    TE --> MU
    D --> MV
    G --> MV
    MU --> MV
```

During consolidating, the Orchestrator reads `debt_candidates`, `memory_suggestions`, and `gap_signals` from task evidence, updates the project-level `debts.json` (registering new items and updating the status of debts touched in the mission), and writes the mission-level `memory-update.json`. The Design Authority writes the mission-level `gap.json`. The Decision Maker reads all of them before issuing the mission verdict.
