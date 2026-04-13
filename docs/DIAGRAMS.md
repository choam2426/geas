# Geas Protocol Diagrams

This document visualizes the core flows of the Geas protocol using Mermaid diagrams. Each diagram references its corresponding protocol document number.

## Table of Contents

1. [Mission Lifecycle](#1-mission-lifecycle)
2. [Task State Machine](#2-task-state-machine)
3. [Evidence Gate Flow](#3-evidence-gate-flow)
4. [Agent Interactions](#4-agent-interactions)
5. [Pipeline Execution Flow](#5-pipeline-execution-flow)

---

## 1. Mission Lifecycle

> Reference: `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`

A mission passes through 4 phases in order. A phase gate exists at each transition, and all required artifacts must be satisfied before entering the next phase.

```mermaid
flowchart LR
    subgraph Phase_Flow["Mission Phase Flow"]
        direction LR
        S["1. Specifying"]
        B["2. Building"]
        P["3. Polishing"]
        E["4. Evolving"]
        C["Complete"]
    end

    S -->|"Phase Gate 1\n- spec.json\n- design-brief.json (approved)\n- At least 1 task contract"| B
    B -->|"Phase Gate 2\n- All tasks passed/cancelled\n- gap-assessment-building.json"| P
    P -->|"Phase Gate 3\n- gap-assessment-polishing.json\n- debt-register.json\n- No blocked/escalated tasks"| E
    E -->|"Phase Gate 4\n- gap-assessment-evolving.json\n- mission-summary.md"| C

    style S fill:#4a90d9,color:#fff
    style B fill:#e67e22,color:#fff
    style P fill:#27ae60,color:#fff
    style E fill:#8e44ad,color:#fff
    style C fill:#2c3e50,color:#fff
```

### Key Activities by Phase

| Phase | Key Activities | Primary Artifacts |
|-------|---------------|-------------------|
| Specifying | Requirements normalization, scope finalization, task decomposition | Mission spec, design brief, task contracts |
| Building | Core value path implementation, task closure cycles | Implementation contracts, gate results, closure packets, final verdicts |
| Polishing | Delivery hardening, specialist slot reviews | Specialist reviews, debt register updates |
| Evolving | Lesson extraction, debt cleanup, memory system updates | Gap assessments, rule updates, mission summary |

---

## 2. Task State Machine

> Reference: `protocol/03_TASK_MODEL_AND_LIFECYCLE.md`

A task has 7 primary states and 3 auxiliary states. Each transition has required preconditions, and states cannot be skipped.

```mermaid
stateDiagram-v2
    [*] --> drafted

    drafted --> ready : contract.json exists

    ready --> implementing : Implementation contract approved\n(implementation_contract.status=approved)

    implementing --> reviewed : Self-check complete +\nimplementer evidence

    reviewed --> integrated : Gate result pass +\nreviewer/tester evidence

    integrated --> verified : Evidence gate passed\n(post-integration verification)

    verified --> passed : Final verdict pass +\nclosure + retrospective +\nchallenge_review (high/critical)

    passed --> [*]

    %% Rewind paths
    integrated --> implementing : Gate failure\n(verify-fix loop)
    integrated --> reviewed : Integration failure/mismatch
    verified --> ready : Final verdict iterate\n(explicit restore target)
    verified --> implementing : Final verdict iterate
    verified --> reviewed : Final verdict iterate

    %% Auxiliary states
    state "blocked\n(cannot proceed)" as blocked
    state "escalated\n(insufficient authority)" as escalated
    state "cancelled\n(work cancelled)" as cancelled

    ready --> blocked : External/structural impediment
    implementing --> blocked : External/structural impediment
    reviewed --> blocked : External/structural impediment
    integrated --> blocked : External/structural impediment

    ready --> escalated : Authority boundary reached
    implementing --> escalated : Authority boundary reached

    ready --> cancelled : Explicit cancellation (reason recorded)
    implementing --> cancelled : Explicit cancellation (reason recorded)

    blocked --> ready : Blocking cause resolved +\nrevalidation passed
    escalated --> ready : Escalation resolved +\ndeliberate re-entry
```

### Representative Paths

| Path | State Flow |
|------|-----------|
| Normal path | drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed |
| Verify-fix path | integrated(fail) -> implementing -> reviewed -> integrated -> verified -> passed |
| Product-iterate path | verified -> iterate -> implementing/reviewed -> ... -> verified -> passed |

---

## 3. Evidence Gate Flow

> Reference: `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`

The Evidence Gate is a 3-tier (Tier 0/1/2) verification mechanism. The gate, vote round, and final verdict must always remain separate.

```mermaid
flowchart TD
    Start["Gate Start"]

    subgraph Tier0["Tier 0 - Precheck"]
        T0_1["Required artifacts exist"]
        T0_2["Task state eligibility"]
        T0_3["Baseline/integration prerequisites"]
        T0_4["Required review set exists"]
        T0_5["Worker self-check exists"]
    end

    subgraph Tier1["Tier 1 - Mechanical Verification"]
        T1_1["Run repeatable checks\n(build, lint, test, type-check, etc.)"]
        T1_2["Record execution results\n(command, exit status, timestamp)"]
    end

    subgraph Tier2["Tier 2 - Contract + Rubric Verification"]
        T2_1["Acceptance criteria satisfied"]
        T2_2["Scope violation check"]
        T2_3["Known risk handling status"]
        T2_4["Review findings addressed"]
        T2_5["Rubric score evaluation\n(per-dimension thresholds)"]
        T2_6["Stub/placeholder verification"]
    end

    Start --> T0_1
    T0_1 --> T0_2 --> T0_3 --> T0_4 --> T0_5

    T0_5 -->|"All passed"| T1_1
    T1_1 --> T1_2

    T1_2 -->|"Checks passed"| T2_1
    T2_1 --> T2_2 --> T2_3 --> T2_4 --> T2_5 --> T2_6

    %% Result branches
    T0_5 -->|"Artifact missing"| BLOCK["block\n(structural precondition not met)"]
    T0_5 -->|"Ineligible state"| ERROR["error\n(gate execution itself failed)"]
    T1_2 -->|"Check failed"| FAIL["fail\n(implementation/verification quality issue)"]
    T2_6 -->|"Criteria not met"| FAIL
    T2_6 -->|"All satisfied"| PASS["pass\n(gate passed)"]

    PASS --> Closure["Closure Packet Assembly"]
    FAIL --> Rewind["Rewind\n(consume 1 retry_budget)"]
    BLOCK --> Blocked["Transition task to blocked"]
    ERROR --> Resolve["Resolve cause and re-run"]

    Closure --> Challenge{"Challenger Review\n(required for high/critical)"}
    Challenge -->|"No blocking concerns"| Verdict["Final Verdict\n(product-authority)"]
    Challenge -->|"Blocking concerns"| VoteRound["Vote Round\n(readiness_round)"]
    VoteRound -->|"ship"| Verdict
    VoteRound -->|"iterate"| Rewind2["Rewind and rework"]
    VoteRound -->|"escalate"| Escalated["Task escalated"]

    Verdict -->|"pass"| Done["Task passed"]
    Verdict -->|"iterate"| Rewind3["Designate restore target and rework\n(retry_budget not consumed)"]
    Verdict -->|"escalate"| Escalated2["Escalation to user"]

    style PASS fill:#27ae60,color:#fff
    style FAIL fill:#e74c3c,color:#fff
    style BLOCK fill:#f39c12,color:#fff
    style ERROR fill:#95a5a6,color:#fff
    style Done fill:#27ae60,color:#fff
```

### Gate Profile Coverage

| Gate Profile | Tier 0 | Tier 1 | Tier 2 | When Used |
|-------------|--------|--------|--------|-----------|
| implementation_change | Run | Run | Run | Standard tasks with implementation changes |
| artifact_only | Run | Skip/reduced | Run | Documentation, design, review, analysis work |
| closure_ready | Run | Optional | Simplified | Cleanup, delivery, closure assembly tasks |

---

## 4. Agent Interactions

> Reference: `protocol/01_AGENT_TYPES_AND_AUTHORITY.md`

Geas organizes roles into a two-tier structure: Authority Slots and Specialist Slots. A single physical agent may fill multiple slots, but role separation must be maintained in artifacts.

```mermaid
flowchart TB
    subgraph Authority["Authority Slots"]
        direction TB
        OA["Orchestrator\n(orchestration_authority)\n\nMission control, routing,\nsequencing, recovery, memory"]
        PA["Decision Maker\n(product_authority)\n\nProduct acceptance, trade-offs,\nfinal verdict (pass/iterate/escalate)"]
        DA["Design Authority\n(design_authority)\n\nStructural consistency,\ncontract approval, methodology review"]
        CH["Challenger\n(challenger)\n\nAdversarial challenge,\nhidden risk detection"]
    end

    subgraph Specialist["Specialist Slots"]
        direction TB
        IMP["Implementer\nPrimary artifact production"]
        QS["Quality Specialist\nAcceptance criteria verification"]
        RS["Risk Specialist\nDomain risk assessment"]
        OS["Operations Specialist\nDelivery/deployment readiness"]
        CS["Communication Specialist\nDocumentation/user content"]
    end

    %% Authority flows
    OA -->|"Task decomposition/routing\nMission phase selection"| IMP
    OA -->|"Convene vote round\nClosure packet assembly"| PA
    OA -->|"Request contract review\nRequest design guidance"| DA
    OA -->|"Request challenger review\n(required for high/critical)"| CH

    DA -->|"Implementation contract approve/reject\nStructural review"| IMP
    DA -->|"Design feedback"| QS

    IMP -->|"Submit self-check\nProduce evidence"| QS
    IMP -->|"Produce evidence"| DA

    QS -->|"Test results\nAcceptance criteria verification"| OA
    RS -->|"Risk assessment\nSecurity review"| OA
    OS -->|"Operational readiness confirmation"| OA
    CS -->|"Documentation completeness review"| OA

    CH -->|"Challenge results\n(blocking/non-blocking)"| PA

    PA -->|"Final verdict"| OA

    %% Styles
    style OA fill:#2c3e50,color:#fff
    style PA fill:#8e44ad,color:#fff
    style DA fill:#2980b9,color:#fff
    style CH fill:#c0392b,color:#fff
    style IMP fill:#27ae60,color:#fff
    style QS fill:#16a085,color:#fff
    style RS fill:#d35400,color:#fff
    style OS fill:#7f8c8d,color:#fff
    style CS fill:#f39c12,color:#fff
```

### Decision Boundaries

| Decision | Primary Owner | Notes |
|----------|--------------|-------|
| Mission phase selection | Orchestrator | Based on mission intent, mode, and current evidence |
| Task decomposition/routing | Orchestrator | Design Authority consulted for large-scale work |
| Design brief approval | Decision Maker | Design Authority review required for full_depth |
| Implementation contract approval | Design Authority-led reviewer set | May include domain expert signatures |
| Evidence gate verdict | Gate executor | Objective mechanism |
| Final verdict | Decision Maker | Based on closure packet |

---

## 5. Pipeline Execution Flow

> Reference: `pipeline.md` (per-task pipeline reference)

This shows the pipeline execution flow for a documentation task (task_kind). The design, design_guide, implementation (worktree isolation), and integration steps are skipped.

```mermaid
flowchart TD
    TaskStart["Task Start\n- Read TaskContract\n- Check dependencies\n- Transition to ready"]

    IC["1. Implementation Contract\n\nWorker writes action plan\nQA + Design Authority approve"]

    Impl["2. Implementation\n\nDirect editing (no worktree isolation)\nWrite/modify documentation"]

    SC["3. Worker Self-Check\n\nConfidence (1-5), known risks,\nuntested paths, summary"]

    subgraph Parallel["Can Run in Parallel"]
        direction LR
        SR["4a. Specialist Review\n\nDesign Authority\nreviews implementation"]
        TEST["4b. Testing\n\nQuality Specialist\nverifies acceptance criteria"]
    end

    Reviewed["Transition to reviewed\n(after both 4a + 4b complete)"]

    EG["5. Evidence Gate\n\nTier 0: Precheck\nTier 1: Skip/reduced (artifact_only)\nTier 2: Contract/rubric verification"]

    EGResult{Gate Result}

    VFL["Verify-fix loop\n(consume retry_budget)"]

    CP["6. Closure Packet Assembly\n\nchange_summary, reviews[],\nopen_risks, debt_items"]

    CHL{"7. Challenger Review\n(based on risk_level)"}

    CHLRun["Run challenger review\nAt least 1 substantive challenge required"]

    FV["8. Final Verdict\n\nproduct-authority decides\npass / iterate / escalate"]

    FVResult{Verdict Result}

    Retro["9. Retrospective\n\nwhat_went_well, what_broke,\nrule_candidates, memory_candidates"]

    Mem["10. Memory Extraction\n\nRule updates, agent memory updates"]

    Resolve["11. Complete\n\nTransition to passed"]

    TaskStart --> IC
    IC -->|"Approved"| Impl
    IC -->|"Rejected"| IC
    Impl -->|"Transition to implementing"| SC
    SC --> Parallel
    SR --> Reviewed
    TEST --> Reviewed
    Reviewed --> EG

    EG --> EGResult
    EGResult -->|"pass"| CP
    EGResult -->|"fail"| VFL
    EGResult -->|"block"| TaskBlocked["Transition to blocked"]
    EGResult -->|"error"| ErrorResolve["Resolve cause and re-run"]
    VFL --> EG

    CP --> CHL
    CHL -->|"low risk: skip"| FV
    CHL -->|"high/critical: required"| CHLRun
    CHLRun -->|"Non-blocking"| FV
    CHLRun -->|"Blocking concerns"| VoteRound["Vote Round"]
    VoteRound -->|"ship"| FV
    VoteRound -->|"iterate/escalate"| Rewind["Rewind/Escalation"]

    FV --> FVResult
    FVResult -->|"pass"| Retro
    FVResult -->|"iterate"| IterRewind["Rewind to restore target\n(retry_budget not consumed)"]
    FVResult -->|"escalate"| Escalate["Escalation"]

    Retro --> Mem --> Resolve

    style TaskStart fill:#34495e,color:#fff
    style Resolve fill:#27ae60,color:#fff
    style TaskBlocked fill:#f39c12,color:#fff
    style Escalate fill:#e74c3c,color:#fff
```

### Documentation Task Skip Rules

| Step | Status |
|------|--------|
| design | Skipped |
| design_guide | Skipped |
| implementation (worktree isolation) | Skipped (direct editing) |
| integration | Skipped |
| implementation_contract through resolve | Required (cannot be skipped) |

### Steps That Can Never Be Skipped

The following steps must always be executed regardless of task_kind:

- implementation_contract
- self_check
- specialist_review
- testing
- evidence_gate
- closure_packet
- final_verdict
- retrospective
- memory_extraction
- resolve
