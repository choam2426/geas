# .geas/ Directory Migration — Mission-Scoped Path Unification

## Problem

The `.geas/` runtime directory scatters mission-scoped artifacts across multiple top-level directories (`spec/`, `tasks/`, `evidence/`, `contracts/`, `packets/`, `decisions/`, `evolution/`). This prevents concurrent mission execution (name collisions) and makes it hard to reason about which artifacts belong to which mission.

The Specifying phase enhancement (previous change) introduced `.geas/missions/{mission_id}/` for `design-brief.json` and `phase-reviews/`, creating a hybrid state where some artifacts use mission-scoped paths and others use legacy flat paths.

## Goal

Unify all mission-scoped artifacts under `.geas/missions/{mission_id}/`. Cross-mission and session-scoped artifacts stay at their current locations.

## Path Mapping

### Migrated (mission-scoped → `.geas/missions/{mission_id}/`)

| Old path | New path |
|----------|----------|
| `.geas/spec/mission-{n}.json` | `.geas/missions/{mission_id}/spec.json` |
| `.geas/tasks/{task-id}.json` | `.geas/missions/{mission_id}/tasks/{task-id}.json` |
| `.geas/tasks/{task-id}/` (sub-artifacts) | `.geas/missions/{mission_id}/tasks/{task-id}/` |
| `.geas/evidence/{task-id}/` | `.geas/missions/{mission_id}/evidence/{task-id}/` |
| `.geas/evidence/polishing/` | `.geas/missions/{mission_id}/evidence/polishing/` |
| `.geas/contracts/{task-id}.json` | `.geas/missions/{mission_id}/contracts/{task-id}.json` |
| `.geas/packets/{task-id}/` | `.geas/missions/{mission_id}/packets/{task-id}/` |
| `.geas/decisions/{dec-id}.json` | `.geas/missions/{mission_id}/decisions/{dec-id}.json` |
| `.geas/decisions/pending/` | `.geas/missions/{mission_id}/decisions/pending/` |
| `.geas/evolution/debt-register.json` | `.geas/missions/{mission_id}/evolution/debt-register.json` |
| `.geas/evolution/gap-assessment-*.json` | `.geas/missions/{mission_id}/evolution/gap-assessment-*.json` |
| `.geas/evolution/phase-review-*.json` | `.geas/missions/{mission_id}/phase-reviews/*.json` |
| `.geas/evolution/rules-update-*.json` | `.geas/missions/{mission_id}/evolution/rules-update-*.json` |
| `.geas/summaries/mission-summary.md` | `.geas/missions/{mission_id}/mission-summary.md` |

### Unchanged (cross-mission or session-scoped)

| Path | Reason |
|------|--------|
| `.geas/state/` (run.json, locks.json, health-check.json, memory-index.json, session-latest.md, task-focus/) | session-scoped |
| `.geas/memory/` | cross-mission |
| `.geas/ledger/` | cross-mission |
| `.geas/rules.md` | cross-mission |
| `.geas/recovery/` | session-scoped |
| `.geas/summaries/run-summary-*.md` | session-scoped |

### New directory structure

```
.geas/
├── state/                              # session-scoped (unchanged)
│   ├── run.json
│   ├── locks.json
│   ├── health-check.json
│   ├── memory-index.json
│   ├── session-latest.md
│   └── task-focus/{task-id}.md
├── memory/                             # cross-mission (unchanged)
│   ├── _project/conventions.md
│   ├── agents/{type}.md
│   ├── candidates/{memory-id}.json
│   ├── entries/{memory-id}.json
│   ├── logs/{task-id}-{memory-id}.json
│   ├── retro/{task-id}.json
│   └── incidents/{id}.json
├── ledger/                             # cross-mission (unchanged)
│   └── events.jsonl
├── recovery/                           # session-scoped (unchanged)
│   └── recovery-{id}.json
├── summaries/                          # session-scoped only
│   └── run-summary-{timestamp}.md
├── rules.md                            # cross-mission (unchanged)
│
└── missions/                           # NEW: all mission-scoped artifacts
    └── {mission_id}/
        ├── spec.json
        ├── design-brief.json
        ├── mission-summary.md
        ├── tasks/
        │   ├── {task-id}.json
        │   └── {task-id}/
        │       ├── worker-self-check.json
        │       ├── closure-packet.json
        │       ├── gate-result.json
        │       ├── challenge-review.json
        │       ├── final-verdict.json
        │       ├── retrospective.json
        │       ├── revalidation-record.json
        │       ├── failure-record-{seq}.json
        │       └── integration-result.json
        ├── evidence/
        │   ├── {task-id}/
        │   │   ├── architecture-authority-review.json
        │   │   ├── qa-engineer.json
        │   │   └── product-authority-verdict.json
        │   └── polishing/
        │       ├── security-engineer.json
        │       └── technical-writer.json
        ├── contracts/
        │   └── {task-id}.json
        ├── packets/
        │   └── {task-id}/
        │       └── {agent-type}.md
        ├── decisions/
        │   ├── {dec-id}.json
        │   └── pending/
        ├── evolution/
        │   ├── debt-register.json
        │   ├── gap-assessment-*.json
        │   └── rules-update-*.json
        └── phase-reviews/
            ├── specifying-to-building.json
            ├── building-to-polishing.json
            ├── polishing-to-evolving.json
            └── evolving-to-close.json
```

## Mission directory convention

All skills that read/write mission-scoped artifacts must derive the base path as:

```
.geas/missions/{mission_id}/
```

where `mission_id` is read from `.geas/state/run.json`. This is the single source of truth for the current mission context.

## Setup changes

The `setup/SKILL.md` mkdir command changes from creating flat directories to creating only cross-mission directories. Since setup runs before intake (before `mission_id` is known), mission-specific directories are created by intake when the mission spec is frozen.

**setup creates (cross-mission only):**
```bash
mkdir -p .geas/state .geas/state/task-focus .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/memory/retro .geas/memory/incidents .geas/recovery
```

Setup no longer creates `debt-register.json`. It is created lazily by the orchestrator when first needed (orchestrating/SKILL.md already has "create with initial schema if missing" logic).

**intake creates (after mission_id is determined):**
```bash
mkdir -p .geas/missions/{mission_id}/tasks .geas/missions/{mission_id}/evidence .geas/missions/{mission_id}/contracts .geas/missions/{mission_id}/packets .geas/missions/{mission_id}/decisions/pending .geas/missions/{mission_id}/evolution .geas/missions/{mission_id}/phase-reviews
```

## rules.md template update

The rules.md template in setup and session-init.sh currently says:
```
Write results to .geas/evidence/{task-id}/{your-name}.json
```

This must be updated to:
```
Write results to .geas/missions/{mission_id}/evidence/{task-id}/{your-name}.json (read mission_id from .geas/state/run.json)
```

## Affected files

### Tier 1: Canonical definitions (6 files)

| File | Change |
|------|--------|
| `plugin/skills/setup/SKILL.md` | mkdir rewrite, debt-register path, rules.md template |
| `docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` | All artifact path columns |
| `docs/protocol/03_TASK_MODEL_AND_LIFECYCLE.md` | Task artifact paths in examples |
| `docs/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` | Task/evidence paths in recovery |
| `docs/architecture/DESIGN.md` | Section 9 directory structure |

### Tier 2: Core execution (10 files)

| File | Change |
|------|--------|
| `plugin/skills/orchestrating/SKILL.md` | All .geas/tasks/, .geas/evidence/, .geas/evolution/, .geas/contracts/, .geas/packets/, .geas/decisions/, .geas/spec/ paths |
| `plugin/skills/orchestrating/references/pipeline.md` | Per-task pipeline paths (tasks, evidence, contracts, packets, task-focus) |
| `plugin/skills/orchestrating/references/building.md` | Task scan path, debt/gap paths, phase-review path (evolution/ → phase-reviews/) |
| `plugin/skills/orchestrating/references/polishing.md` | Evidence paths, phase-review path (evolution/ → phase-reviews/) |
| `plugin/skills/orchestrating/references/evolving.md` | Spec, tasks, evolution paths |
| `plugin/skills/orchestrating/references/specifying.md` | spec path (currently .geas/spec/) |
| `plugin/skills/intake/SKILL.md` | Output path + mkdir |
| `plugin/skills/task-compiler/SKILL.md` | Spec input path, task output path |
| `plugin/skills/scheduling/SKILL.md` | Task scan path |
| `plugin/skills/context-packet/SKILL.md` | All read paths |

### Tier 3: Supporting skills + docs + hooks (23 files)

| File | Change |
|------|--------|
| `plugin/skills/evidence-gate/SKILL.md` | task, evidence, debt paths |
| `plugin/skills/verify-fix-loop/SKILL.md` | task, decisions paths |
| `plugin/skills/implementation-contract/SKILL.md` | contracts path |
| `plugin/skills/vote-round/schemas/vote-round.schema.json` | description text |
| `plugin/skills/memorizing/SKILL.md` | evidence, tasks paths |
| `plugin/skills/briefing/SKILL.md` | packets, evidence paths |
| `plugin/skills/reporting/SKILL.md` | evolution paths |
| `plugin/skills/run-summary/SKILL.md` | decisions, summaries paths |
| `plugin/skills/ledger-query/SKILL.md` | path table |
| `plugin/skills/pivot-protocol/SKILL.md` | decisions path |
| `plugin/skills/decision/SKILL.md` | decisions path |
| `plugin/skills/cleanup/SKILL.md` | evolution path |
| `plugin/skills/conformance-checking/SKILL.md` | multiple paths |
| `plugin/skills/chaos-exercising/SKILL.md` | inline script paths |
| `plugin/skills/policy-managing/SKILL.md` | evolution path |
| `plugin/hooks/scripts/memory-superseded-warning.sh` | packets pattern |
| `docs/reference/SKILLS.md` | path references |
| `docs/reference/HOOKS.md` | path references |
| `docs/ko/reference/SKILLS.md` | sync |
| `docs/ko/reference/HOOKS.md` | sync |
| `docs/ko/architecture/DESIGN.md` | sync |
| `docs/ko/protocol/03_TASK_MODEL_AND_LIFECYCLE.md` | sync |
| `docs/ko/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` | sync |
| `docs/ko/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` | sync |
| `README.md` | .geas/ structure display |
| `README.ko.md` | sync |

## What this does NOT change

- **run.json schema or fields** — `current_task_id` stays as task ID, the orchestrator resolves the full path
- **Lock manifest paths** — locks.json stays at `.geas/state/`, lock `targets` contain relative scope paths (src/...), not .geas/ paths
- **Memory system** — entirely cross-mission, unchanged
- **Ledger format** — events.jsonl format unchanged
- **Hook logic** — only `memory-superseded-warning.sh` pattern match changes; `session-init.sh` only reads `.geas/state/` which is unchanged
- **Task IDs** — remain `task-001`, `task-002` etc., scoped within a mission
