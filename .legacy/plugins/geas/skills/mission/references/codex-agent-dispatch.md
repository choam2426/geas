# Codex Agent Dispatch

Codex installs `agents/` as plugin files, but it does not auto-register them as runtime agents from `.codex-plugin/plugin.json`. Any Geas main-session skill that spawns an agent must therefore load the portable agent file explicitly and include it in the spawned prompt.

## Required Dispatch Steps

1. Resolve the Geas plugin root. From any Geas skill file, walk up to the ancestor directory that contains `.codex-plugin/plugin.json`.
2. Resolve the concrete agent file:
   - Authority slots: `agents/authority/{slot}.md`.
   - Software specialists: `agents/software/{concrete_agent_type}.md`.
   - Research specialists: `agents/research/{concrete_agent_type}.md`.
3. Read the full agent file before spawning. The full Markdown body is the spawned agent's role prompt.
4. Build the spawned prompt with, in this order:
   - the full agent file body,
   - the concrete agent type and protocol slot,
   - the Geas skill procedure the spawn must run,
   - mission/task ids and supporting artifact paths,
   - any memory paths that should be read first.
5. If the agent file cannot be found or read, do not spawn a generic agent. Return `missing_agent_prompt` to the dispatcher with the expected path.

## Spawned Skill Guard

Every spawned-only Geas skill expects its spawn context to include the loaded agent file body. If a spawned skill starts without that role prompt, it must stop and return `missing_agent_prompt` instead of improvising the missing stance.

## Notes

- Claude can use `.claude-plugin/plugin.json` agent registration directly. This adapter rule is for Codex.
- `agents/` files are portable source prompts, not Codex skills.
- The orchestrator remains the main session and has no agent file.
