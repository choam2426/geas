# Agent Rules

## Evidence
- Write evidence via CLI: `geas evidence add --task {tid} --agent {name} --role {role} --set key=value`
- Evidence is stored at .geas/missions/{mission_id}/tasks/{task-id}/evidence/{agent}.json
- created_at is auto-injected by the CLI. No manual timestamp needed.

## Code
- Plugin project: TypeScript CLI (`plugin/cli/`) with Node.js >= 18
- Build: `cd plugin/cli && npm run build`
- Typecheck: `cd plugin/cli && npm run typecheck`
- Test: `cd plugin/cli && npm test`
- Skills are Markdown files in `plugin/skills/`
- Agents are Markdown files in `plugin/agents/`
- Protocol docs in `docs/protocol/`
- Schemas in `docs/protocol/schemas/`
- Respect scope.surfaces from the TaskContract — only modify files within the declared scope
