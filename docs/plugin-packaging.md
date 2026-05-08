# Plugin Packaging

## Plugin Root

Geas repository root is the installable plugin root.

```text
.
  .agents/
    plugins/
      marketplace.json
  .claude-plugin/
    marketplace.json
    plugin.json
  .codex-plugin/
    plugin.json
  .mcp.json
  AGENTS.md
  CLAUDE.md
  README.md
  LICENSE

  skills/
  bin/
    geas
  assets/
  cli/
  docs/
```

The repository root follows the legacy Geas and Superpowers shape: the plugin files, client manifests, documentation, executable entrypoint, skills, role prompt references, and assets live in one plugin root.

## Marketplace Files

Geas carries both marketplace files at repository root.

```text
.agents/plugins/marketplace.json
.claude-plugin/marketplace.json
```

The local marketplace entries point at the same plugin root.

```json
{
  "name": "geas",
  "interface": {
    "displayName": "Geas"
  },
  "plugins": [
    {
      "name": "geas",
      "source": {
        "source": "local",
        "path": "./"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Coding"
    }
  ]
}
```

```json
{
  "name": "geas",
  "owner": {
    "name": "Geas"
  },
  "description": "Structure agent work as Mission, Task Contract, Evidence, User Judgment, and reflection.",
  "plugins": [
    {
      "name": "geas",
      "source": "./",
      "description": "Structure agent work as Mission, Task Contract, Evidence, User Judgment, and reflection.",
      "author": {
        "name": "Geas"
      },
      "version": "0.1.0"
    }
  ]
}
```

## Client Manifests

Codex reads `.codex-plugin/plugin.json`.

```json
{
  "name": "geas",
  "version": "0.1.0",
  "description": "Structure agent work as Mission, Task Contract, Evidence, User Judgment, and reflection.",
  "author": {
    "name": "Geas"
  },
  "homepage": "https://github.com/choam2426/geas",
  "repository": "https://github.com/choam2426/geas",
  "license": "Apache-2.0",
  "keywords": [
    "agents",
    "skills",
    "verification",
    "codex",
    "claude"
  ],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "Geas",
    "shortDescription": "Contract-driven agent work with Evidence for User Judgment",
    "longDescription": "Use Geas to run agent work through Mission, Task Contract, implementation, verification, review, Evidence, User Judgment, and reflection.",
    "developerName": "Geas",
    "category": "Coding",
    "capabilities": [
      "Interactive",
      "Read",
      "Write"
    ],
    "defaultPrompt": [
      "Start a Geas mission for this project.",
      "Resume the current Geas mission.",
      "Prepare Evidence for User Judgment."
    ],
    "websiteURL": "https://github.com/choam2426/geas",
    "privacyPolicyURL": "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    "termsOfServiceURL": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    "brandColor": "#2563EB",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png",
    "screenshots": []
  }
}
```

Claude Code reads `.claude-plugin/plugin.json`.

```json
{
  "name": "geas",
  "version": "0.1.0",
  "description": "Structure agent work as Mission, Task Contract, Evidence, User Judgment, and reflection.",
  "author": {
    "name": "Geas"
  },
  "homepage": "https://github.com/choam2426/geas",
  "repository": "https://github.com/choam2426/geas",
  "license": "Apache-2.0",
  "keywords": [
    "agents",
    "skills",
    "verification",
    "codex",
    "claude"
  ],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

## Skills

Geas exposes Skills from the plugin root.

```text
skills/
  mission/
    SKILL.md
    references/
      dispatch.md
      briefings.md
      mission-closure.md
      session-handoff.md
      agents/
        work-designer.md
        implementer.md
        verifier.md
        reviewer.md
        challenger.md

  specifying/
    SKILL.md
    references/
      interview.md
      ambiguity-patterns.md
      mission-spec.md
      mission-design.md
      task-contract.md
      baseline-review.md

  building/
    SKILL.md
    references/
      task-loop.md
      task-closure.md
      git-checkpoint.md

  implementing/
    SKILL.md
    references/
      implementation-evidence.md

  verifying/
    SKILL.md
    references/
      verification-evidence.md

  reviewing/
    SKILL.md
    references/
      review-evidence.md

  challenging/
    SKILL.md
    references/
      challenger-evidence.md

  consolidating/
    SKILL.md
    references/
      mission-judgment-input.md
      reflection-memory.md
```

Codex exposes these as plugin Skills under `geas`.

Claude Code exposes these as namespaced plugin Skills such as `/geas:mission`.

Role execution uses role prompt templates packaged under `skills/mission/references/agents/`. The `mission` Skill fills the role prompt and dispatches it with the client subagent mechanism.

## Agents

Geas packages role prompts under the `mission` Skill.

```text
skills/mission/references/agents/
  work-designer.md
  implementer.md
  verifier.md
  reviewer.md
  challenger.md
```

The template files are not client-native agent definitions. They are prompt sources used by `mission` when it spawns role subagents.

## CLI

Geas exposes the CLI executable from the plugin root.

```text
bin/
  geas
```

`bin/geas` runs the built Geas CLI.

The CLI source lives in `cli/`.

```text
cli/
  package.json
  src/
  test/
```

## Assets

Geas exposes plugin assets from the plugin root.

```text
assets/
  icon.png
  logo.png
  screenshots/
```

Codex manifest paths use the same root-relative asset paths.

```json
{
  "composerIcon": "./assets/icon.png",
  "logo": "./assets/logo.png",
  "screenshots": []
}
```

## MCP

Geas plugin-level MCP lives at the plugin root.

```text
.mcp.json
```

`.mcp.json` contains the default MCP servers.

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Client manifests reference `.mcp.json` as a root-relative path.

```json
{
  "mcpServers": "./.mcp.json"
}
```

## Client Metadata

Shared identity:

```text
plugin name: geas
version: 0.1.0
category: Coding
license: Apache-2.0
homepage: https://github.com/choam2426/geas
repository: https://github.com/choam2426/geas
```

Client-specific metadata stays in client manifest files.

```text
.codex-plugin/plugin.json
.claude-plugin/plugin.json
.agents/plugins/marketplace.json
.claude-plugin/marketplace.json
```
