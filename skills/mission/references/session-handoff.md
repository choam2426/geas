# Session Handoff

Use this reference after the User accepts a Mission baseline and before building starts when specifying consumed enough context that a fresh session would lower execution risk.

This utility supports continuity. It does not create a runtime artifact, replace Evidence, or replace User Judgment.

## Recommend Fresh Building Session When

- Specifying required substantial research, long discussion, or many revisions.
- The baseline contains five or more initial Tasks.
- The first Task is high risk, broad, or depends on many baseline decisions.
- The session has accumulated enough context that critical decisions may be hard to keep visible.
- The User asks to preserve state before implementation.

## Procedure

1. Record accepted Mission Spec, Mission Design, and initial Task Contracts through the CLI.
2. Present Baseline Readiness with a choice to start building here or hand off to a fresh session.
3. If the User chooses `handoff session`, prepare a Session Handoff Briefing from `briefings.md` and do not transition to `building` in the current session.
4. If the User chooses `start building`, transition to `building` with the first Task and dispatch `building` from recorded runtime state.

## Boundaries

- Do not create a separate handoff runtime artifact.
- Use recorded Mission Spec, Mission Design, Task Contracts, Run State, Task State when present, Evidence, User Judgment, and Memory as the recovery basis.
- Do not leave important baseline decisions only in conversation.
- Do not treat the handoff recommendation as User Judgment.

