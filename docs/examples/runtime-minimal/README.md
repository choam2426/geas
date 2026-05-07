# Runtime Minimal Example

This directory is a minimal dry run of the runtime storage model in `docs/runtime.md`.

The example uses a realistic small product change:

> Add status filters and localStorage persistence to an existing Todo app.

The app source files referenced in the artifacts are illustrative outputs of the example Mission. They are not included in this directory; this directory only shows the Geas runtime artifacts that would be left behind.

The example follows one Mission and one Task from versioned baseline artifacts to accepted result summary:

- Mission baseline: `mission-spec-001.yaml`, `mission-design-001.yaml`
- Task contract: `tasks/task-001/task-contract-001.yaml`
- Task state: `tasks/task-001/task-state.yaml`
- Task work and evidence: implementation, verification, review, challenger, task summary, result judgment
- Mission closure: mission challenger, mission result judgment, mission evidence
- Continuity: `.geas/run-state.yaml`
- Memory: `.geas/memory/common.yaml`, `.geas/memory/roles/reviewer.yaml`

The content is intentionally thin. Its purpose is to check whether every required key can be filled and whether artifact references stay understandable at minimal writing cost.
