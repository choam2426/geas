---
name: intake
description: >
  Specifying-phase mission intake — collaborative exploration that freezes
  the mission spec and produces the initial task set. One question at a
  time; section-by-section approval.
---

# Intake (specifying phase)

You are driving the specifying phase of a Geas mission. The purpose is
to turn a natural-language request into (1) an approved mission spec,
(2) an approved mission design, and (3) an approved initial task set —
then hand off to building.

Protocol reference: `docs/ko/protocol/02` §specifying. Schema reference:
`docs/schemas/mission-spec.schema.json`.

---

## Operating principle

Mission spec is immutable after the user approves it. Every question
you ask should lead toward something the user will be willing to sign
off on as a fixed contract. If you do not know, ask. Do not invent.

---

## Step 1 — Size the request

Read the raw mission. Decide:

- **Single mission?** If the request fits one mission spec, continue.
- **Too large?** If the user is describing multiple independent
  subsystems, say so. Propose a decomposition (what is one mission,
  what is another, which order). Then run this intake for the first
  mission.

---

## Step 2 — Pick the operating mode (mandatory)

Ask the user explicitly. Do not infer. The three modes in protocol 02
are:

| mode          | use when                                                          |
|---|---|
| `lightweight` | scope is clear, existing patterns apply, low risk                 |
| `standard`    | moderate scope, some architectural choices, normal risk (default) |
| `full_depth`  | multiple viable approaches, cross-module impact, or high risk     |

Recommend one based on what you can read off the request, explain why,
and ask.

---

## Step 3 — Explore requirements, one question at a time

Use the AskUserQuestion tool with single-select options whenever you
can. The checklist to cover:

1. Scope boundary — what is in, what is out
2. Target user / consumer of the outcome
3. Definition of done — the one-sentence success criterion
4. Acceptance criteria — at least three observable, falsifiable items
   derived from definition of done
5. Constraints — technical, business, or temporal
6. Affected surfaces — existing files, systems, contracts this will
   touch
7. Risks — things the user can already see that could go wrong

Rules:
- One question at a time. Do not batch.
- Prefer multiple-choice over open-ended. Multiple-choice lowers the
  user's load and gives you cleaner answers.
- Skip items that are unambiguous in the raw request.
- Stop when every checklist item is settled.
- If the user says "just build it", respect that: fill best-effort
  values, note the spec as intake-skipped in its description, and move
  on.

---

## Step 4 — Approve section by section

Before writing the spec, get the user's explicit OK on each section.
Present one at a time:

1. "Name: `{…}`. Does this capture the mission?"
2. "Description: `{…}`. Sound right?"
3. "Scope — in: `[…]`, out: `[…]`. Any changes?"
4. "Definition of done: `{…}`. Correct?"
5. "Acceptance criteria: `[…]`. Anything missing or to remove?"
6. "Constraints: `[…]`. Confirmed?"
7. "Risks: `[…]`. Seeing any others?"

When all sections are approved, move to the CLI call.

---

## Step 5 — Create the mission spec

Build a JSON payload that matches `mission-spec.schema.json`:

```json
{
  "name": "<approved name>",
  "description": "<approved description>",
  "mode": "<lightweight|standard|full_depth>",
  "definition_of_done": "<one sentence>",
  "scope": { "in": ["..."], "out": ["..."] },
  "acceptance_criteria": ["...", "...", "..."],
  "constraints": ["..."],
  "affected_surfaces": ["..."],
  "risks": ["..."]
}
```

The CLI injects `id`, `user_approved: false`, `created_at`, and
`updated_at`. Do not set them.

Run:

```bash
geas mission create <<'EOF'
{ ... }
EOF
```

The response contains the generated `mission_id`. Use it for every
following command.

Show the user a single summary block of what was written (name, mode,
scope in/out, DoD, acceptance criteria) and ask for one final
confirmation. When they agree:

```bash
geas mission approve --mission <mission_id>
```

After this call, the mission spec is immutable.

---

## Step 6 — Mission design

The mission design (`mission-design.md`) is written next. For
`lightweight`, write it yourself (orchestrator = design-authority is
acceptable in this mode). For `standard` / `full_depth`, spawn the
`design-authority` sub-agent (`plugin/agents/authority/design-authority.md`)
with the approved mission spec as input.

The design must contain every required section listed in protocol 02
(Strategy, Architecture & Integration, Task Breakdown Rationale,
Verification Plan, Key Design Decisions, Assumptions, Unknowns, Risks,
Failure Modes, Migration / Rollout). Sections that do not apply say
`해당 없음 ({reason})`.

Mode-specific review chain before user approval:
- `lightweight`: straight to user approval.
- `standard`: decision-maker review, then user approval.
- `full_depth`: decision-maker + challenger + 1 specialist
  deliberation (mission-level), then user approval.

The CLI commands for deliberation arrive with G4. For now, capture the
decision-maker / challenger review as conversation that the user
explicitly signs off on.

---

## Step 7 — Initial task set

Write the initial task-contract files under
`.geas/missions/{mission_id}/tasks/{task_id}/contract.json` (G3 ships
the task-compiler skill that automates this). The approval chain is
the same as mission design — decision-maker reviews for `standard`,
deliberation for `full_depth`, then user approval.

Each approved task contract has `approved_by` set. That is the gate
condition the phase advance checks.

---

## Step 8 — Close specifying

When mission spec is approved + mission design approved + at least one
approved task contract exists:

1. Append a phase-review:

   ```bash
   geas phase-review append --mission <mission_id> <<'EOF'
   {
     "mission_phase": "specifying",
     "status": "passed",
     "summary": "...",
     "next_phase": "building"
   }
   EOF
   ```

2. Advance the phase:

   ```bash
   geas mission-state update --mission <mission_id> --phase building
   ```

Return control to the mission skill.

---

## Notes

- The CLI validates every payload against its schema. If it rejects,
  the hint tells you which field is off. Fix and retry; do not
  bypass.
- Intake artefacts (spec, state, empty wrappers) live under
  `.geas/missions/{mission_id}/`. The CLI creates the directory and
  wrappers on `mission create`.
- You never write directly to `.geas/`. Always go through the CLI.
