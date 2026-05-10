# Git Checkpoint

Use this reference after Task User Judgment and Task Evidence are recorded for an `accepted` or `accepted_with_limits` Task.

The checkpoint supports continuity. It is not Evidence and not User Judgment.

## Purpose

- Preserve the accepted Task result and its runtime records at a repository checkpoint.
- Make later review and rollback cheaper.
- Keep unrelated work out of the Task checkpoint.

## Procedure

1. Confirm Task Evidence recording succeeded and the Task phase is closed.
2. Inspect repository status and changed paths.
3. Compare changed paths with the Task Contract, Task Evidence, and runtime artifacts recorded for the Task.
4. If all changed paths belong to the Task result or its runtime records, prepare a commit.
5. If unrelated changes are present, brief the User and ask what to stage.
6. Use a commit message that includes the Task id and concise result.
7. Use the Git Checkpoint briefing in `briefings.md` with state `recommended`, `created`, `skipped`, or `blocked`.
8. If commit succeeds, include the commit hash and any uncommitted changes.
9. If commit is only recommended, skipped, or blocked, brief the reason and the next safe runtime step before moving to another Task or consolidating.

## Default Behavior

- Recommend a checkpoint after each accepted Task.
- Commit automatically only when the User has explicitly requested task-end commits for the Mission or asks for a commit in the current turn.

## Boundaries

- A git commit is not Evidence and not User Judgment.
- A commit does not make an unaccepted Task complete.
- Do not stage unrelated changes without User direction.
- Do not rewrite history or amend prior commits unless the User explicitly asks.
- If the repository is not a git repository, brief that no git checkpoint is available.
