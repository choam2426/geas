# Task Environment Reference

## Purpose

Use this reference before Task work starts and before role handoff. Environment readiness defines the toolchain, verification support, runtime services, secrets, connectors, and setup mutation boundary for the Task. It is operational context, not Evidence, User Judgment, Task Evidence, or Task completion.

## Environment Briefing Shape

```markdown
Task environment readiness:
- Toolchain:
  - existing environment
  - install or activate required toolchain
  - stop if unavailable
- Verification support:
  - use existing checks
  - add verification tool, MCP, or connector
  - mark unavailable support as unverified scope
- Runtime services:
  - local service
  - container or devcontainer
  - hosted service
  - no service; disclose limits
- Setup mutation boundary:
  - local environment only
  - repo dev dependency or config allowed by Task Contract
  - route to `specifying`
- Required User inputs:
  - <secrets, credentials, external accounts, service decisions, or none>
- Environment gaps:
  - <unavailable tools, services, verification support, or none>
```

## Role Handoff Context

Add this context to role handoffs when it affects implementation, verification, review, or challenge:

```markdown
Environment context:
- Toolchain: <selected toolchain and version if known>
- Verification tools: <checks, browser tools, MCP, connector, or none>
- Runtime services: <local service, container, hosted service, or none>
- Secrets and connectors: <provided, needed, unavailable, or not required>
- Setup limits: <local-only, repo config allowed, or route to specifying>
- Environment gaps:
  - <unverified scope caused by unavailable setup>
```

## Rules

- Ask before installing tools, adding MCP or connectors, starting services, or changing repo configuration.
- If setup changes tracked project files and the Task Contract does not cover that setup, stop and route to `specifying`.
- If secrets, credentials, external accounts, or hosted services are needed, ask the User or stop.
- Do not invent secrets, credentials, service URLs, or connector availability.
- If verification support is unavailable, pass that limitation to role handoff and Task judgment input as unverified scope.
- Keep environment readiness out of Evidence unless a role later verifies behavior and records Evidence.

## Short Examples

- Rust Task: confirm `cargo` or the required Rust toolchain is available, or ask whether to install or stop.
- Web app Task: ask whether browser or Playwright-style verification support is needed before verification handoff.
- Local service Task: ask whether to start a local service, use a container, use a hosted service, or proceed with limits.

## Stop Conditions

- Required environment choice is missing.
- Required toolchain cannot be found or prepared.
- Required verification support, MCP, connector, secret, or external service is unavailable.
- Setup would mutate tracked project files outside the accepted Task Contract.
- User declines the setup needed for the selected Task route.
