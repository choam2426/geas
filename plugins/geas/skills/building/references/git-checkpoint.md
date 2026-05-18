# Git Work Options and Checkpoint Reference

## Purpose

Use this reference before starting a Task loop and when the User asks for a git checkpoint during `building`. Work options define where the Task is performed, how branches are handled, and whether each accepted Task should be committed. Git operations are operational support; they are not Evidence, User Judgment, Task Evidence, or Mission completion.

## Work Options Briefing

Ask for these choices before Task work starts:

```markdown
Task work options:
- Work location:
  - current worktree
  - separate git worktree
- Branch policy:
  - keep current branch
  - if on `main`, create or switch to a Task branch
  - always use a Task branch
- Task boundary checkpoint:
  - commit after each accepted Task
  - do not commit automatically
  - ask at each Task boundary
- Scope rule:
  - include only changed outputs owned by this Task
  - surface unrelated changes before any git action
```

## Option Rules

- If current branch is `main`, ask before starting Task work there.
- If the User chooses a separate git worktree, preserve the selected worktree path and branch name in the Task briefing.
- If the User chooses a Task branch, use a branch name tied to the Task id when the User has not provided a name.
- Apply the selected options for the current Task loop unless the User changes them.
- Preserve selected options in stop briefings so the Task can resume consistently.

## Checkpoint Preconditions

- The User selected commit-after-accepted-Task or explicitly asks for a checkpoint, commit, stash, tag, or comparable git preservation step.
- Current Task Contract and Task State are known.
- The checkpoint scope can be described in terms of files or outputs changed during the Task.
- Task result User Judgment and Task Evidence are recorded before a Task boundary commit.
- Role Evidence, Task Evidence, or current briefing still carries the verification and unverified scope context.

## Checkpoint Briefing

```markdown
Git checkpoint:
- Task: <task-id>
- Requested action: <commit | stash | tag | other>
- Work location: <current worktree | separate worktree path>
- Branch policy: <selected policy and branch>
- Task boundary policy: <commit after accepted Task | no automatic commit | ask at boundary>
- Included scope: <files or outputs>
- Excluded scope: <known unrelated or untracked scope>
- Evidence status: <refs or not yet recorded>
- User Judgment status: <not requested | pending | recorded>
- Boundary: checkpoint is not Evidence or acceptance.
```

## Rules

- Keep checkpoint action separate from Task Evidence and User Judgment.
- Do not claim a checkpoint proves correctness.
- Do not use a checkpoint to skip Implementation, Verification, Review, Challenge, or User Judgment.
- Do not commit before Task result User Judgment and Task Evidence are recorded.
- Do not include unrelated work without surfacing it to the User.
- Do not start Task work on `main` without explicit User decision.
- Preserve command output as operational context when the checkpoint succeeds or fails.
- If the checkpoint command fails, report the failure and continue only if the Task route itself remains valid.

## Stop Conditions

- Required Task work options are not selected.
- The checkpoint scope is unclear and could include unrelated work.
- Current branch is `main` and the User has not selected a branch policy.
- A separate worktree or Task branch was selected but cannot be prepared.
- The checkpoint would require changing files outside the Task scope.
- The checkpoint command fails in a way that affects Task continuation or User decision.
