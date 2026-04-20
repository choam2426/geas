# 00. Protocol Foundations

> Defines the design axes, major risks, and scope addressed by Geas.

## Design Axes

Geas is built on four design axes: Governance, Traceability, Verification, and Evolution. Each axis defines what questions this protocol must answer and what principles an implementation must uphold. Every later mechanism in the protocol flows from these four axes.

### Governance - who decides what, and on what basis?

1. **Only tasks count as units of final completion.** Natural-language claims such as "implemented" or "verification is done" do not change protocol state. A mission is a higher-level unit that groups task outcomes; it is not a separate unit of completion.
2. **Verification and final approval are separate.** Passing verification does not automatically mean the result is approved. Verification shows that the required checks are complete; final approval decides whether to accept the result.
3. **Prefer simple, explicit flows over unnecessary autonomy.** The protocol chooses direct, composable flows before adding autonomy. Autonomy is introduced only when it provides a clear advantage.

### Traceability - can we still explain what happened in this mission later?

1. **Decisions must remain explainable after the fact.** Records must preserve what changed, who approved it, and what evidence supported the judgment.
2. **Scope, debt, and evidence must stay continuous across phase changes.** Even when work moves into the next phase, it must still be possible to trace what was agreed, what remains, and what was used to confirm the result.

### Verification - what proves the work is actually finished?

1. **Without evidence, it is not finished.** Work with missing evidence or skipped review cannot be treated as complete.
2. **Each stage has its own required checks.** Implementation, review, verification, and final completion all require different confirmation, and later stages cannot bypass earlier ones.
3. **People directly involved must not wave through missing review or evidence.** If required review or evidence is missing, the parties closest to the work must not quietly approve it anyway.
4. **Higher-risk work requires stricter handling.** Work with greater impact requires stronger review, stronger verification, and more conservative judgment.
5. **If evidence is missing, stopping is the right choice.** When there is no conservative way to recover, the protocol does not pretend missing evidence exists.

### Evolution - how does the next piece of work get better?

1. **Memory is only worth keeping if it improves future action.** If revisiting memory does not lead to better judgment or execution, it is just archived noise.
2. **Both success and failure must feed the next piece of work.** Repeated problems and repeated strengths should flow into rules, memory, and debt management.
3. **Outdated memory must not be left in place.** Memory that no longer matches current principles should be deleted or corrected.

## Major Risks

Geas focuses on the following failure modes.

| Risk | Description | Response |
|---|---|---|
| Completion without evidence | Work is treated as finished even though required review or evidence is missing | Judge completion only through state transitions and evidence completeness |
| Treating verification success as approval | Passing verification is mistaken for final approval | Separate the gate from the final verdict |
| Understating risk | High-impact work is handled too lightly | Scale review and traceability in proportion to risk |
| Parallel work collisions | Interdependent changes proceed at the same time and interfere with each other | Manage a baseline state and apply coordination plus revalidation |
| Scope drift | Unapproved work slips in, or promised work quietly drops out | Control it through contract updates, scope reassessment, and phase review |
| Approval without review | Something is approved without substantive review | Require separation of responsibilities, independent review, and challenge |
| Resuming from uncertain state | Work continues after interruption or failure even though state is unclear | Resume only from safe boundaries; otherwise roll back or stop |
| Context loss during handoff | The links between summaries, artifacts, and decisions get broken | Preserve them through traceability, explicit handoffs, and decision records |
| Hiding unresolved issues at the end | Remaining risk or dissent is blurred during closure | Keep residual risk, debt, and disagreement visible through the end |

Geas does not aim to eliminate risk. Its goal is to expose risk, leave behind accountability and rationale, and make it harder to wave problems through.

## Scope

Geas focuses on coordinating, reviewing, and verifying mission-level multi-agent work within a single workspace or project. It also covers the operating principles that support that flow, including safe parallel execution, runtime state and resumption, memory and retrospective handling, and mission-by-mission phase progression.

The canonical records and artifacts produced along the way are stored under `.geas/`, and the directory structure and file rules for those artifacts are defined in [08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md](./08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md).
