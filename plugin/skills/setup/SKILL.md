---
name: setup
description: First-time setup — initialize the .geas/ runtime tree via `geas setup`.
---

# Setup

Call `geas setup` once at the project root. The command bootstraps the
`.geas/` tree described in protocol doc 08 (Runtime Artifacts and
Schemas) and is a safe no-op on re-run.

## When to invoke

- First turn in a fresh project, before any mission is created.
- The orchestrator may also invoke this defensively when `.geas/` is
  missing — setup will leave existing files alone.

## Command

```bash
geas setup
```

`geas setup` creates the following structure in the current working
directory:

```
.geas/
  config.json
  debts.json
  events.jsonl
  candidates.json
  memory/
    shared.md
    agents/
  missions/
  .tmp/
```

Existing files are preserved. The response lists which paths were
created and which already existed.

## Output

Standard envelope: `{ "ok": true, "data": { project_root, geas_dir,
created[], existed[] } }`.

## Follow-up

After setup, the orchestrator moves on to mission intake. Nothing in
this skill reaches beyond `geas setup`; the v3 `.geas/` tree is fixed
by protocol 08 and contains no legacy policy, lock, or recovery
artifacts.
