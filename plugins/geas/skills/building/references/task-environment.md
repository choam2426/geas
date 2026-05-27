# Task Environment Reference

Use this reference before role handoff when a Task depends on tools, services, secrets, generated files, or local setup.

This is operational context for the handoff. It is not Evidence or User Judgment.

## Environment Briefing Shape

```markdown
## Environment

- Workspace root: <path>
- Required tools: <commands, versions, package managers>
- Required services: <local servers, databases, APIs, or none>
- Required secrets: <names only, never values>
- Generated outputs: <where generated files may appear>
- Writable targets: <paths the Task may write>
- Read-only targets: <paths to inspect only>
- Setup changes allowed: <yes/no and boundary>
- Known constraints: <offline, sandbox, OS, permissions, or none>
```

## Rules

- Do not request broad setup changes when the Task can run with existing tools.
- Do not expose secret values.
- If required environment cannot be prepared, return the missing dependency and suggested route.
- Mention environment limits in Role Evidence when they affect verification or implementation confidence.
