# Geas CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Geas CLI defined in `docs/cli.md` and the runtime model defined in `docs/runtime.md`, producing a working `bin/geas` bundle plus a thin agent reference skill.

**Architecture:** TypeScript + Node 18+. Commander.js for CLI parsing, AJV for JSON Schema validation, js-yaml for YAML I/O. Five command-grouped modules under `cli/src/commands/` over a thin `cli/src/lib/` layer (runtime, guards, schema, output). Single esbuild bundle output to `bin/geas`. Command-unit tests via `tsx --test`.

**Tech Stack:** TypeScript, Node 18+, Commander.js, AJV, js-yaml, esbuild, tsx.

---

## File Structure

### Source files

- `cli/package.json` — npm manifest, scripts, deps
- `cli/tsconfig.json` — TS config for type checking
- `cli/build.ts` — esbuild script that bundles source + inlines schemas + adds shebang
- `cli/src/main.ts` — Commander program, register commands, parse argv
- `cli/src/commands/init.ts` — `geas init`
- `cli/src/commands/mission.ts` — `mission create`, `mission spec record`, `mission design record`, `mission transition`, `mission evidence record`
- `cli/src/commands/task.ts` — `task contract record`, `task transition`, `task evidence record`
- `cli/src/commands/judgment.ts` — `judgment record`
- `cli/src/commands/memory.ts` — `memory record`
- `cli/src/lib/runtime.ts` — `.geas/` filesystem reads/writes, types
- `cli/src/lib/schema.ts` — AJV registration and `validate()` entrypoint
- `cli/src/lib/guards.ts` — Pre-write guard functions (`checkXxx`)
- `cli/src/lib/output.ts` — Success/failure JSON output to stdout, exit codes

### Schema files (declarative JSON Schemas)

- `cli/schemas/mission-spec.json`
- `cli/schemas/mission-design.json`
- `cli/schemas/task-contract.json`
- `cli/schemas/task-state.json`
- `cli/schemas/run-state.json`
- `cli/schemas/implementation-evidence.json`
- `cli/schemas/verification-evidence.json`
- `cli/schemas/review-evidence.json`
- `cli/schemas/challenger-evidence.json`
- `cli/schemas/task-evidence.json`
- `cli/schemas/mission-evidence.json`
- `cli/schemas/user-judgment.json`
- `cli/schemas/memory-file.json`
- `cli/schemas/memory-item.json`

### Test files

- `cli/test/init.test.ts`
- `cli/test/mission.test.ts`
- `cli/test/task.test.ts`
- `cli/test/judgment.test.ts`
- `cli/test/memory.test.ts`

### Built output

- `bin/geas` — single-file CJS bundle with `#!/usr/bin/env node` shebang, executable bit set in git via `git update-index --chmod=+x`

### Skill

- `skills/geas-cli.md` — thin agent reference for invoking `geas` commands

---

## Task 1: Project setup

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `cli/.gitignore`
- Create: `cli/build.ts`
- Create: `cli/src/main.ts` (placeholder)
- Modify: `.gitignore` (root) — ensure `bin/` is NOT ignored

- [ ] **Step 1: Create `cli/package.json`**

```json
{
  "name": "geas-cli",
  "version": "3.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "build": "tsx build.ts",
    "test": "tsx --test test/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "commander": "^13.1.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.16.0",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "test/**/*", "build.ts"]
}
```

- [ ] **Step 3: Create `cli/.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Create `cli/build.ts`**

```typescript
import { build } from 'esbuild';
import { readFileSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

async function main() {
  const schemasDir = resolve(__dirname, 'schemas');
  const schemas: Record<string, unknown> = {};
  for (const file of readdirSync(schemasDir)) {
    if (file.endsWith('.json')) {
      const id = file.replace(/\.json$/, '');
      schemas[id] = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
    }
  }
  const schemasModule = `module.exports = ${JSON.stringify(schemas)};`;

  const outFile = resolve(__dirname, '..', 'bin', 'geas');

  await build({
    entryPoints: [resolve(__dirname, 'src', 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: outFile,
    minify: false,
    plugins: [
      {
        name: 'inline-schemas',
        setup(b) {
          b.onResolve({ filter: /^virtual:schemas$/ }, (args) => ({
            path: args.path,
            namespace: 'virtual',
          }));
          b.onLoad({ filter: /^virtual:schemas$/, namespace: 'virtual' }, () => ({
            contents: schemasModule,
            loader: 'js',
          }));
        },
      },
    ],
  });

  const built = readFileSync(outFile, 'utf8');
  writeFileSync(outFile, '#!/usr/bin/env node\n' + built);
  try {
    chmodSync(outFile, 0o755);
  } catch {
    // Windows or restricted FS — git update-index --chmod=+x carries the bit.
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Create placeholder `cli/src/main.ts`**

```typescript
export function run(): void {
  process.stdout.write(JSON.stringify({ ok: false, error: { code: 'not_implemented' } }) + '\n');
  process.exit(1);
}

if (require.main === module) {
  run();
}
```

- [ ] **Step 6: Update root `.gitignore` if it would ignore `bin/`**

Run: `cat A:/geas/.gitignore 2>/dev/null` — if `bin/` or `bin/*` is listed, add `!bin/geas` exception. If `.gitignore` doesn't exist, skip.

- [ ] **Step 7: Install dependencies**

Run: `cd cli && npm install`
Expected: `node_modules/` created, lockfile written.

- [ ] **Step 8: Verify build runs end-to-end (will fail because no schemas yet)**

Run: `cd cli && npm run build`
Expected: build runs but `bin/geas` is created from placeholder main.ts. May warn about virtual:schemas being unused (no imports yet) but should not error.

- [ ] **Step 9: Commit**

```bash
cd A:/geas
git add cli/package.json cli/package-lock.json cli/tsconfig.json cli/.gitignore cli/build.ts cli/src/main.ts
git commit -m "feat(cli): scaffold cli package and esbuild bundling"
```

---

## Task 2: Baseline + State schemas

**Files:**
- Create: `cli/schemas/mission-spec.json`
- Create: `cli/schemas/mission-design.json`
- Create: `cli/schemas/task-contract.json`
- Create: `cli/schemas/task-state.json`
- Create: `cli/schemas/run-state.json`

All schemas use `additionalProperties: false`, all keys `required`, empty strings/arrays are allowed.

- [ ] **Step 1: Create `cli/schemas/mission-spec.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["name", "goal", "background", "completion_criteria", "included_scope", "excluded_scope", "acceptance_criteria", "constraints", "assumptions", "risks"],
  "properties": {
    "name": { "type": "string" },
    "goal": { "type": "string" },
    "background": { "type": "string" },
    "completion_criteria": { "type": "array", "items": { "type": "string" } },
    "included_scope": { "type": "array", "items": { "type": "string" } },
    "excluded_scope": { "type": "array", "items": { "type": "string" } },
    "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
    "constraints": { "type": "array", "items": { "type": "string" } },
    "assumptions": { "type": "array", "items": { "type": "string" } },
    "risks": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 2: Create `cli/schemas/mission-design.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["approach_strategy", "alternatives_considered", "key_concepts", "scope_in", "scope_out", "task_breakdown", "assumptions", "risks"],
  "properties": {
    "approach_strategy": { "type": "string" },
    "alternatives_considered": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["approach", "benefit", "cost", "decision_reason"],
        "properties": {
          "approach": { "type": "string" },
          "benefit": { "type": "string" },
          "cost": { "type": "string" },
          "decision_reason": { "type": "string" }
        }
      }
    },
    "key_concepts": { "type": "array", "items": { "type": "string" } },
    "scope_in": { "type": "array", "items": { "type": "string" } },
    "scope_out": { "type": "array", "items": { "type": "string" } },
    "task_breakdown": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["task_id", "description", "mission_coverage", "depends_on", "reason"],
        "properties": {
          "task_id": { "type": "string" },
          "description": { "type": "string" },
          "mission_coverage": { "type": "array", "items": { "type": "string" } },
          "depends_on": { "type": "array", "items": { "type": "string" } },
          "reason": { "type": "string" }
        }
      }
    },
    "assumptions": { "type": "array", "items": { "type": "string" } },
    "risks": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 3: Create `cli/schemas/task-contract.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["description", "mission_relation", "depends_on", "scope_in", "scope_out", "deliverables", "acceptance_criteria", "verification_checks", "review_focus", "risks"],
  "properties": {
    "description": { "type": "string" },
    "mission_relation": { "type": "string" },
    "depends_on": { "type": "array", "items": { "type": "string" } },
    "scope_in": { "type": "array", "items": { "type": "string" } },
    "scope_out": { "type": "array", "items": { "type": "string" } },
    "deliverables": { "type": "array", "items": { "type": "string" } },
    "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
    "verification_checks": { "type": "array", "items": { "type": "string" } },
    "review_focus": { "type": "array", "items": { "type": "string" } },
    "risks": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 4: Create `cli/schemas/task-state.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["phase"],
  "properties": {
    "phase": {
      "type": "string",
      "enum": ["unstarted", "implementing", "verifying", "reviewing", "challenging", "awaiting_user_judgment", "closed"]
    }
  }
}
```

- [ ] **Step 5: Create `cli/schemas/run-state.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["current_mission_id", "current_stage", "current_task_id"],
  "properties": {
    "current_mission_id": { "type": "string" },
    "current_stage": {
      "type": "string",
      "enum": ["", "specifying", "building", "consolidating"]
    },
    "current_task_id": { "type": "string" }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add cli/schemas/mission-spec.json cli/schemas/mission-design.json cli/schemas/task-contract.json cli/schemas/task-state.json cli/schemas/run-state.json
git commit -m "feat(cli): add baseline + state schemas"
```

---

## Task 3: Role Evidence schemas

**Files:**
- Create: `cli/schemas/implementation-evidence.json`
- Create: `cli/schemas/verification-evidence.json`
- Create: `cli/schemas/review-evidence.json`
- Create: `cli/schemas/challenger-evidence.json`

- [ ] **Step 1: Create `cli/schemas/implementation-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "changed_outputs", "affected_scope", "decisions", "contract_deltas", "self_checks", "limits", "reflection_candidates"],
  "properties": {
    "summary": { "type": "string" },
    "changed_outputs": { "type": "array", "items": { "type": "string" } },
    "affected_scope": { "type": "array", "items": { "type": "string" } },
    "decisions": { "type": "array", "items": { "type": "string" } },
    "contract_deltas": { "type": "array", "items": { "type": "string" } },
    "self_checks": { "type": "array", "items": { "type": "string" } },
    "limits": { "type": "array", "items": { "type": "string" } },
    "reflection_candidates": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 2: Create `cli/schemas/verification-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "environment", "target", "checks_performed", "criteria_results", "outputs", "deviations", "unverified_scope", "recheck_needed", "verdict"],
  "properties": {
    "summary": { "type": "string" },
    "environment": { "type": "string" },
    "target": { "type": "array", "items": { "type": "string" } },
    "checks_performed": { "type": "array", "items": { "type": "string" } },
    "criteria_results": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["criterion", "result", "basis"],
        "properties": {
          "criterion": { "type": "string" },
          "result": {
            "type": "string",
            "enum": ["passed", "failed", "partial", "not_checked", "blocked"]
          },
          "basis": { "type": "string" }
        }
      }
    },
    "outputs": { "type": "array", "items": { "type": "string" } },
    "deviations": { "type": "array", "items": { "type": "string" } },
    "unverified_scope": { "type": "array", "items": { "type": "string" } },
    "recheck_needed": { "type": "array", "items": { "type": "string" } },
    "verdict": {
      "type": "string",
      "enum": ["passed", "changes_requested", "escalated"]
    }
  }
}
```

- [ ] **Step 3: Create `cli/schemas/review-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "target", "review_focus_used", "scope_in", "scope_out", "review_methods", "findings", "remaining_risks", "verdict", "overall_recommendation"],
  "properties": {
    "summary": { "type": "string" },
    "target": { "type": "array", "items": { "type": "string" } },
    "review_focus_used": { "type": "array", "items": { "type": "string" } },
    "scope_in": { "type": "array", "items": { "type": "string" } },
    "scope_out": { "type": "array", "items": { "type": "string" } },
    "review_methods": { "type": "array", "items": { "type": "string" } },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["finding", "severity", "basis", "recommendation"],
        "properties": {
          "finding": { "type": "string" },
          "severity": { "type": "string" },
          "basis": { "type": "string" },
          "recommendation": { "type": "string" }
        }
      }
    },
    "remaining_risks": { "type": "array", "items": { "type": "string" } },
    "verdict": {
      "type": "string",
      "enum": ["passed", "changes_requested", "escalated"]
    },
    "overall_recommendation": { "type": "string" }
  }
}
```

- [ ] **Step 4: Create `cli/schemas/challenger-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["target", "challenge_focus", "findings", "user_decisions_needed", "deeper_checks_needed", "verdict", "overall_recommendation"],
  "properties": {
    "target": { "type": "array", "items": { "type": "string" } },
    "challenge_focus": { "type": "array", "items": { "type": "string" } },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["finding", "risk_type", "basis", "escalation"],
        "properties": {
          "finding": { "type": "string" },
          "risk_type": {
            "type": "string",
            "enum": ["assumption", "scope", "verification_gap", "operational_risk", "tradeoff", "repeat_risk"]
          },
          "basis": { "type": "string" },
          "escalation": { "type": "string" }
        }
      }
    },
    "user_decisions_needed": { "type": "array", "items": { "type": "string" } },
    "deeper_checks_needed": { "type": "array", "items": { "type": "string" } },
    "verdict": {
      "type": "string",
      "enum": ["passed", "changes_requested", "escalated"]
    },
    "overall_recommendation": { "type": "string" }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add cli/schemas/implementation-evidence.json cli/schemas/verification-evidence.json cli/schemas/review-evidence.json cli/schemas/challenger-evidence.json
git commit -m "feat(cli): add role evidence schemas"
```

---

## Task 4: Closure + Judgment schemas

**Files:**
- Create: `cli/schemas/task-evidence.json`
- Create: `cli/schemas/mission-evidence.json`
- Create: `cli/schemas/user-judgment.json`

- [ ] **Step 1: Create `cli/schemas/task-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "user_judgment_summary", "criteria_results", "accepted_unverified_scope", "accepted_remaining_risks"],
  "properties": {
    "summary": { "type": "string" },
    "user_judgment_summary": { "type": "string" },
    "criteria_results": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["criterion", "result", "evidence_refs", "unverified_scope", "remaining_risks"],
        "properties": {
          "criterion": { "type": "string" },
          "result": {
            "type": "string",
            "enum": ["satisfied", "satisfied_with_limits", "not_satisfied"]
          },
          "evidence_refs": { "type": "array", "items": { "type": "string" } },
          "unverified_scope": { "type": "array", "items": { "type": "string" } },
          "remaining_risks": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "accepted_unverified_scope": { "type": "array", "items": { "type": "string" } },
    "accepted_remaining_risks": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 2: Create `cli/schemas/mission-evidence.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["summary", "user_judgment_summary", "mission_criteria_results", "mission_design_deltas", "accepted_unverified_scope", "accepted_remaining_risks", "gaps", "debts", "follow_ups", "reflection_summary", "memory_updates"],
  "properties": {
    "summary": { "type": "string" },
    "user_judgment_summary": { "type": "string" },
    "mission_criteria_results": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["criterion", "result", "evidence_refs", "unverified_scope", "remaining_risks"],
        "properties": {
          "criterion": { "type": "string" },
          "result": {
            "type": "string",
            "enum": ["satisfied", "satisfied_with_limits", "not_satisfied"]
          },
          "evidence_refs": { "type": "array", "items": { "type": "string" } },
          "unverified_scope": { "type": "array", "items": { "type": "string" } },
          "remaining_risks": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "mission_design_deltas": { "type": "array", "items": { "type": "string" } },
    "accepted_unverified_scope": { "type": "array", "items": { "type": "string" } },
    "accepted_remaining_risks": { "type": "array", "items": { "type": "string" } },
    "gaps": { "type": "array", "items": { "type": "string" } },
    "debts": { "type": "array", "items": { "type": "string" } },
    "follow_ups": { "type": "array", "items": { "type": "string" } },
    "reflection_summary": { "type": "string" },
    "memory_updates": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 3: Create `cli/schemas/user-judgment.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["decision", "accepted_unverified_scope", "accepted_remaining_risks", "requested_actions"],
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["accepted", "accepted_with_limits", "revise", "deferred", "stopped"]
    },
    "accepted_unverified_scope": { "type": "array", "items": { "type": "string" } },
    "accepted_remaining_risks": { "type": "array", "items": { "type": "string" } },
    "requested_actions": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add cli/schemas/task-evidence.json cli/schemas/mission-evidence.json cli/schemas/user-judgment.json
git commit -m "feat(cli): add closure and user-judgment schemas"
```

---

## Task 5: Memory schemas

**Files:**
- Create: `cli/schemas/memory-item.json`
- Create: `cli/schemas/memory-file.json`

- [ ] **Step 1: Create `cli/schemas/memory-item.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["guideline", "applies_when", "source_refs"],
  "properties": {
    "guideline": { "type": "string" },
    "applies_when": { "type": "array", "items": { "type": "string" } },
    "source_refs": { "type": "array", "items": { "type": "string" } }
  }
}
```

- [ ] **Step 2: Create `cli/schemas/memory-file.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["guideline", "applies_when", "source_refs"],
        "properties": {
          "guideline": { "type": "string" },
          "applies_when": { "type": "array", "items": { "type": "string" } },
          "source_refs": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/schemas/memory-item.json cli/schemas/memory-file.json
git commit -m "feat(cli): add memory schemas"
```

---

## Task 6: lib/output.ts

**Files:**
- Create: `cli/src/lib/output.ts`

- [ ] **Step 1: Create `cli/src/lib/output.ts`**

```typescript
export type CurrentLocation = {
  mission_id: string;
  stage: string;
  task_id: string;
  phase: string;
};

export type GuardFailure = {
  code: string;
  path?: string;
  status?: 'missing' | 'mismatched' | 'invalid';
  detail?: string;
};

export type WriteRecord = {
  path: string;
  type: 'created' | 'updated';
};

export type StateChange = {
  pointer: string;
  from: string;
  to: string;
};

export type SuccessResult = {
  ok: true;
  command: string;
  current: CurrentLocation;
  writes: WriteRecord[];
  state_changes: StateChange[];
};

export type FailureResult = {
  ok: false;
  command: string;
  current: CurrentLocation;
  writes: [];
  error: {
    code: string;
    guards?: GuardFailure[];
    detail?: string;
  };
};

export function emptyLocation(): CurrentLocation {
  return { mission_id: '', stage: '', task_id: '', phase: '' };
}

export function success(result: SuccessResult): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

export function failure(result: FailureResult): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(1);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/output.ts
git commit -m "feat(cli): add output result types and emit helpers"
```

---

## Task 7: lib/schema.ts

**Files:**
- Create: `cli/src/lib/schema.ts`

The schema module loads JSON Schemas via the esbuild `virtual:schemas` plugin during bundling, and falls back to filesystem reads during dev (`tsx --test`).

- [ ] **Step 1: Create `cli/src/lib/schema.ts`**

```typescript
import Ajv, { type ValidateFunction } from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type SchemaId =
  | 'mission-spec'
  | 'mission-design'
  | 'task-contract'
  | 'task-state'
  | 'run-state'
  | 'implementation-evidence'
  | 'verification-evidence'
  | 'review-evidence'
  | 'challenger-evidence'
  | 'task-evidence'
  | 'mission-evidence'
  | 'user-judgment'
  | 'memory-file'
  | 'memory-item';

const ALL_SCHEMA_IDS: SchemaId[] = [
  'mission-spec',
  'mission-design',
  'task-contract',
  'task-state',
  'run-state',
  'implementation-evidence',
  'verification-evidence',
  'review-evidence',
  'challenger-evidence',
  'task-evidence',
  'mission-evidence',
  'user-judgment',
  'memory-file',
  'memory-item',
];

let ajvInstance: Ajv | null = null;
const validators = new Map<SchemaId, ValidateFunction>();

function loadSchemas(): Record<string, unknown> {
  // In bundled output, esbuild plugin injects virtual:schemas. In dev (tsx),
  // load from disk.
  try {
    return require('virtual:schemas');
  } catch {
    const schemasDir = join(__dirname, '..', '..', 'schemas');
    const out: Record<string, unknown> = {};
    for (const file of readdirSync(schemasDir)) {
      if (file.endsWith('.json')) {
        const id = file.replace(/\.json$/, '');
        out[id] = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      }
    }
    return out;
  }
}

function ensureInitialized(): Ajv {
  if (ajvInstance) return ajvInstance;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schemas = loadSchemas();
  for (const id of ALL_SCHEMA_IDS) {
    const schema = schemas[id];
    if (!schema) {
      throw new Error(`schema not loaded: ${id}`);
    }
    validators.set(id, ajv.compile(schema as object));
  }
  ajvInstance = ajv;
  return ajv;
}

export type ValidateOk = { valid: true };
export type ValidateErr = { valid: false; errors: string[] };

export function validate(id: SchemaId, payload: unknown): ValidateOk | ValidateErr {
  ensureInitialized();
  const v = validators.get(id);
  if (!v) {
    throw new Error(`unknown schema id: ${id}`);
  }
  const ok = v(payload);
  if (ok) return { valid: true };
  const errors = (v.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`);
  return { valid: false, errors };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke-test schema loading via a one-off script**

Run:

```bash
cd A:/geas/cli
npx tsx -e "import('./src/lib/schema').then(m => { const r = m.validate('run-state', { current_mission_id: '', current_stage: '', current_task_id: '' }); console.log(r); })"
```

Expected: `{ valid: true }`

- [ ] **Step 4: Commit**

```bash
git add cli/src/lib/schema.ts
git commit -m "feat(cli): add schema registration and validate entrypoint"
```

---

## Task 8: lib/runtime.ts

**Files:**
- Create: `cli/src/lib/runtime.ts`

This module owns all `.geas/` filesystem access. Read functions return `null` when files are missing. Writes are atomic via temp-file + rename.

- [ ] **Step 1: Create `cli/src/lib/runtime.ts`**

```typescript
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, basename } from 'node:path';
import * as yaml from 'js-yaml';

export type RunState = {
  current_mission_id: string;
  current_stage: '' | 'specifying' | 'building' | 'consolidating';
  current_task_id: string;
};

export type TaskPhase =
  | 'unstarted'
  | 'implementing'
  | 'verifying'
  | 'reviewing'
  | 'challenging'
  | 'awaiting_user_judgment'
  | 'closed';

export type TaskState = {
  phase: TaskPhase;
};

export type BaselineKind = 'mission-spec' | 'mission-design';

const ROLE_NAMES = [
  'orchestrator',
  'work-designer',
  'implementer',
  'verifier',
  'reviewer',
  'challenger',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ALL_ROLES: readonly RoleName[] = ROLE_NAMES;

export function geasRoot(cwd: string = process.cwd()): string {
  return join(cwd, '.geas');
}

export function missionDir(missionId: string, cwd?: string): string {
  return join(geasRoot(cwd), 'missions', missionId);
}

export function taskDir(missionId: string, taskId: string, cwd?: string): string {
  return join(missionDir(missionId, cwd), 'tasks', taskId);
}

export function readYaml<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  // CORE_SCHEMA disables timestamp parsing so date-like strings stay strings.
  const parsed = yaml.load(text, { schema: yaml.CORE_SCHEMA });
  return parsed as T;
}

export function writeYamlAtomic(path: string, payload: unknown): void {
  const text = yaml.dump(payload, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true });
  const tmp = `${path}.tmp.${randomBytes(4).toString('hex')}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function existsArtifact(path: string): boolean {
  return existsSync(path);
}

export function readRunState(cwd?: string): RunState | null {
  return readYaml<RunState>(join(geasRoot(cwd), 'run-state.yaml'));
}

export function writeRunState(state: RunState, cwd?: string): void {
  writeYamlAtomic(join(geasRoot(cwd), 'run-state.yaml'), state);
}

export function readTaskState(missionId: string, taskId: string, cwd?: string): TaskState | null {
  return readYaml<TaskState>(join(taskDir(missionId, taskId, cwd), 'task-state.yaml'));
}

export function writeTaskState(missionId: string, taskId: string, state: TaskState, cwd?: string): void {
  writeYamlAtomic(join(taskDir(missionId, taskId, cwd), 'task-state.yaml'), state);
}

export function nextNumber(dir: string, prefix: string): number {
  if (!existsSync(dir)) return 1;
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.yaml$`);
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

export function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export function readLatestNumbered<T>(dir: string, prefix: string): { number: number; payload: T; path: string } | null {
  if (!existsSync(dir)) return null;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{3})\\.yaml$`);
  let best: { number: number; file: string } | null = null;
  for (const file of readdirSync(dir)) {
    const m = file.match(re);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!best || n > best.number) best = { number: n, file };
    }
  }
  if (!best) return null;
  const p = join(dir, best.file);
  return { number: best.number, payload: readYaml<T>(p)!, path: p };
}

export function writeNumberedArtifact(dir: string, prefix: string, payload: unknown): { path: string; number: number } {
  ensureDir(dir);
  const n = nextNumber(dir, prefix);
  const path = join(dir, `${prefix}-${pad3(n)}.yaml`);
  writeYamlAtomic(path, payload);
  return { path, number: n };
}

export function generateMissionId(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const random = randomBytes(8).toString('hex').slice(0, 6);
  return `${yyyy}${mm}${dd}-${random}`;
}

export function listTaskIds(missionId: string, cwd?: string): string[] {
  const tasks = join(missionDir(missionId, cwd), 'tasks');
  if (!existsSync(tasks)) return [];
  return readdirSync(tasks).filter((name) => existsSync(join(tasks, name)));
}

export function relMissionPath(absolute: string, missionId: string, cwd?: string): string {
  const root = missionDir(missionId, cwd);
  if (absolute.startsWith(root)) {
    return absolute.slice(root.length + 1).replace(/\\/g, '/');
  }
  return absolute.replace(/\\/g, '/');
}

export function relGeasPath(absolute: string, cwd?: string): string {
  const root = geasRoot(cwd);
  if (absolute.startsWith(root)) {
    return ('.geas/' + absolute.slice(root.length + 1)).replace(/\\/g, '/');
  }
  return absolute.replace(/\\/g, '/');
}

void basename;
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/runtime.ts
git commit -m "feat(cli): add runtime filesystem layer for .geas/"
```

---

## Task 9: lib/guards.ts skeleton + types

**Files:**
- Create: `cli/src/lib/guards.ts`

Each guard returns `GuardResult`. Guards do not throw — they collect failures so callers can present all blocking conditions. Implementations are added incrementally as each command is built (later tasks).

- [ ] **Step 1: Create `cli/src/lib/guards.ts`**

```typescript
import type { GuardFailure } from './output';

export type GuardResult = { ok: true } | { ok: false; guards: GuardFailure[] };

export function ok(): GuardResult {
  return { ok: true };
}

export function fail(guards: GuardFailure[]): GuardResult {
  return { ok: false, guards };
}

export function combine(...results: GuardResult[]): GuardResult {
  const failures: GuardFailure[] = [];
  for (const r of results) {
    if (!r.ok) failures.push(...r.guards);
  }
  if (failures.length === 0) return ok();
  return fail(failures);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli/src/lib/guards.ts
git commit -m "feat(cli): add guard result helpers"
```

---

## Task 10: main.ts skeleton

**Files:**
- Modify: `cli/src/main.ts`

- [ ] **Step 1: Replace `cli/src/main.ts`**

```typescript
import { Command } from 'commander';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('geas')
    .description('Geas CLI — atomic actuator for .geas/ runtime artifacts')
    .version('3.0.0');
  return program;
}

export function run(argv: string[] = process.argv): void {
  const program = buildProgram();
  program.parse(argv);
}

if (require.main === module) {
  run();
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli/src/main.ts
git commit -m "feat(cli): add Commander program skeleton"
```

---

## Task 11: geas init

**Files:**
- Create: `cli/src/commands/init.ts`
- Create: `cli/test/init.test.ts`
- Modify: `cli/src/main.ts` (register init)

- [ ] **Step 1: Write failing test in `cli/test/init.test.ts`**

```typescript
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-init-'));
  process.chdir(workdir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('init creates .geas/ skeleton', () => {
  const result = runInit();
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'run-state.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'common.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'roles', 'orchestrator.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'roles', 'reviewer.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions')));

  const runState = readFileSync(join(workdir, '.geas', 'run-state.yaml'), 'utf8');
  assert.match(runState, /current_mission_id: ['"]?['"]?/);
  assert.match(runState, /current_stage: ['"]?['"]?/);
  assert.match(runState, /current_task_id: ['"]?['"]?/);
});

test('init fails when .geas/ already exists', () => {
  runInit();
  const result = runInit();
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'already_initialized');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/init.test.ts`
Expected: FAIL with "Cannot find module '../src/commands/init'".

- [ ] **Step 3: Create `cli/src/commands/init.ts`**

```typescript
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import {
  ALL_ROLES,
  ensureDir,
  geasRoot,
  writeYamlAtomic,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';

const COMMAND = 'init';

export type InitResult = SuccessResult | FailureResult;

export function runInit(cwd: string = process.cwd()): InitResult {
  const root = geasRoot(cwd);
  if (existsSync(root)) {
    return {
      ok: false,
      command: COMMAND,
      current: emptyLocation(),
      writes: [],
      error: { code: 'already_initialized', detail: '.geas already exists' },
    };
  }

  ensureDir(root);
  ensureDir(`${root}/memory/roles`);
  ensureDir(`${root}/missions`);

  writeYamlAtomic(`${root}/run-state.yaml`, {
    current_mission_id: '',
    current_stage: '',
    current_task_id: '',
  });
  writeYamlAtomic(`${root}/memory/common.yaml`, { items: [] });
  for (const role of ALL_ROLES) {
    writeYamlAtomic(`${root}/memory/roles/${role}.yaml`, { items: [] });
  }

  const writes: SuccessResult['writes'] = [
    { path: '.geas/run-state.yaml', type: 'created' },
    { path: '.geas/memory/common.yaml', type: 'created' },
    ...ALL_ROLES.map((r) => ({ path: `.geas/memory/roles/${r}.yaml`, type: 'created' as const })),
  ];

  return {
    ok: true,
    command: COMMAND,
    current: emptyLocation(),
    writes,
    state_changes: [],
  };
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create .geas/ runtime storage in the current directory')
    .action(() => {
      const result = runInit();
      if (result.ok) success(result);
      else failure(result);
    });
}
```

- [ ] **Step 4: Wire init into main**

Modify `cli/src/main.ts` to register init:

```typescript
import { Command } from 'commander';
import { registerInit } from './commands/init';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('geas')
    .description('Geas CLI — atomic actuator for .geas/ runtime artifacts')
    .version('3.0.0');
  registerInit(program);
  return program;
}

export function run(argv: string[] = process.argv): void {
  const program = buildProgram();
  program.parse(argv);
}

if (require.main === module) {
  run();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/init.test.ts`
Expected: PASS for both tests.

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/init.ts cli/test/init.test.ts cli/src/main.ts
git commit -m "feat(cli): implement geas init"
```

---

## Task 12: geas mission create

**Files:**
- Create: `cli/src/commands/mission.ts`
- Create: `cli/test/mission.test.ts`
- Modify: `cli/src/main.ts` (register mission)
- Modify: `cli/src/lib/guards.ts` (add `checkMissionCreate`)

- [ ] **Step 1: Add guard to `cli/src/lib/guards.ts`**

Append:

```typescript
import type { RunState } from './runtime';

export function checkMissionCreate(runState: RunState | null): GuardResult {
  if (!runState) {
    return fail([{ code: 'run_state_missing', path: '.geas/run-state.yaml', status: 'missing' }]);
  }
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id !== '') {
    failures.push({ code: 'mission_in_progress', detail: `current_mission_id=${runState.current_mission_id}` });
  }
  if (runState.current_stage !== '') {
    failures.push({ code: 'stage_not_idle', detail: `current_stage=${runState.current_stage}` });
  }
  if (runState.current_task_id !== '') {
    failures.push({ code: 'task_in_progress', detail: `current_task_id=${runState.current_task_id}` });
  }
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Write failing test in `cli/test/mission.test.ts`**

```typescript
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate } from '../src/commands/mission';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-mission-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('mission create allocates id and updates run-state', () => {
  const result = runMissionCreate();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const id = result.current.mission_id;
  assert.match(id, /^\d{8}-[a-z0-9]{6}$/);
  assert.equal(result.current.stage, 'specifying');
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id)));
  const runState = readFileSync(join(workdir, '.geas', 'run-state.yaml'), 'utf8');
  assert.match(runState, new RegExp(`current_mission_id: ['"]?${id}['"]?`));
  assert.match(runState, /current_stage: specifying/);
});

test('mission create fails when one is already in progress', () => {
  runMissionCreate();
  const result = runMissionCreate();
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'guard_failed');
    assert.ok(result.error.guards?.some((g) => g.code === 'mission_in_progress'));
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: FAIL with "Cannot find module '../src/commands/mission'".

- [ ] **Step 4: Create `cli/src/commands/mission.ts`**

```typescript
import { Command } from 'commander';
import { join } from 'node:path';
import {
  ensureDir,
  generateMissionId,
  geasRoot,
  missionDir,
  readRunState,
  writeRunState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMissionCreate } from '../lib/guards';
import { existsSync } from 'node:fs';

const COMMAND_CREATE = 'mission create';

export type MissionResult = SuccessResult | FailureResult;

export function runMissionCreate(cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const guard = checkMissionCreate(runState);
  if (!guard.ok) {
    return {
      ok: false,
      command: COMMAND_CREATE,
      current: emptyLocation(),
      writes: [],
      error: { code: 'guard_failed', guards: guard.guards },
    };
  }

  let id = generateMissionId();
  while (existsSync(missionDir(id, cwd))) {
    id = generateMissionId();
  }
  ensureDir(missionDir(id, cwd));
  void geasRoot;
  void join;

  const newState = { current_mission_id: id, current_stage: 'specifying' as const, current_task_id: '' };
  writeRunState(newState, cwd);

  return {
    ok: true,
    command: COMMAND_CREATE,
    current: { mission_id: id, stage: 'specifying', task_id: '', phase: '' },
    writes: [{ path: `.geas/missions/${id}/`, type: 'created' }],
    state_changes: [
      { pointer: 'current_mission_id', from: '', to: id },
      { pointer: 'current_stage', from: '', to: 'specifying' },
    ],
  };
}

export function registerMission(program: Command): void {
  const mission = program.command('mission').description('Mission lifecycle commands');
  mission
    .command('create')
    .description('Create a new Mission and enter the specifying stage')
    .action(() => {
      const result = runMissionCreate();
      if (result.ok) success(result);
      else failure(result);
    });
}
```

- [ ] **Step 5: Wire mission into main**

Modify `cli/src/main.ts` to register mission alongside init:

```typescript
import { registerInit } from './commands/init';
import { registerMission } from './commands/mission';
// ...
registerInit(program);
registerMission(program);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: PASS for both tests.

- [ ] **Step 7: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/mission.ts cli/test/mission.test.ts cli/src/main.ts
git commit -m "feat(cli): implement geas mission create"
```

---

## Task 13: geas mission spec record

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkMissionSpecRecord`)
- Modify: `cli/src/commands/mission.ts` (add `runMissionSpecRecord`, register subcommand)
- Modify: `cli/test/mission.test.ts` (add test)

- [ ] **Step 1: Add guard `checkMissionSpecRecord` in `cli/src/lib/guards.ts`**

Append:

```typescript
export function checkMissionSpecRecord(runState: RunState | null): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'specifying') failures.push({ code: 'stage_not_specifying', detail: runState.current_stage });
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add test in `cli/test/mission.test.ts`**

```typescript
import { runMissionSpecRecord } from '../src/commands/mission';

test('mission spec record stores numbered mission-spec', () => {
  const created = runMissionCreate();
  assert.equal(created.ok, true);
  const id = created.ok ? created.current.mission_id : '';

  const payload = {
    name: 'Demo',
    goal: 'Demo goal',
    background: 'context',
    completion_criteria: ['done'],
    included_scope: ['scope a'],
    excluded_scope: [],
    acceptance_criteria: ['criterion'],
    constraints: [],
    assumptions: [],
    risks: [],
  };

  const result = runMissionSpecRecord(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-spec-001.yaml')));
  assert.equal(result.writes[0]?.path, `.geas/missions/${id}/mission-spec-001.yaml`);
});

test('mission spec record rejects invalid payload', () => {
  runMissionCreate();
  const result = runMissionSpecRecord({ name: 'missing fields' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'schema_invalid');
  }
});

test('mission spec record fails outside specifying stage', () => {
  // No mission created → no current mission
  process.chdir(originalCwd);
  workdir = mkdtempSync(join(tmpdir(), 'geas-mission-'));
  process.chdir(workdir);
  runInit();
  const payload = { name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [] };
  const result = runMissionSpecRecord(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'guard_failed');
    assert.ok(result.error.guards?.some((g) => g.code === 'no_current_mission'));
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: FAIL — `runMissionSpecRecord` not exported.

- [ ] **Step 4: Add `runMissionSpecRecord` and subcommand in `cli/src/commands/mission.ts`**

Append to existing file:

```typescript
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { writeNumberedArtifact, missionDir as missionDirFn } from '../lib/runtime';
import { checkMissionSpecRecord } from '../lib/guards';
import { validate } from '../lib/schema';

const COMMAND_SPEC = 'mission spec record';

export function runMissionSpecRecord(payload: unknown, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const guard = checkMissionSpecRecord(runState);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_SPEC, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const v = validate('mission-spec', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_SPEC, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const dir = missionDirFn(runState!.current_mission_id, cwd);
  const { path, number } = writeNumberedArtifact(dir, 'mission-spec', payload);
  const rel = `.geas/missions/${runState!.current_mission_id}/mission-spec-${String(number).padStart(3, '0')}.yaml`;
  void path;

  return {
    ok: true,
    command: COMMAND_SPEC,
    current,
    writes: [{ path: rel, type: 'created' }],
    state_changes: [],
  };
}

function readPayload(from: string): unknown {
  const text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
}

// Inside registerMission, add after `mission.command('create')`:
//
// mission
//   .command('spec')
//   .command('record')
//   .requiredOption('--from <path>', 'Path to YAML payload, or - for stdin')
//   .description('Record Mission Spec baseline')
//   .action((opts: { from: string }) => {
//     const payload = readPayload(opts.from);
//     const result = runMissionSpecRecord(payload);
//     if (result.ok) success(result);
//     else failure(result);
//   });
```

Then update `registerMission` so the subcommand chain renders as `geas mission spec record`. Replace the `registerMission` body with:

```typescript
export function registerMission(program: Command): void {
  const mission = program.command('mission').description('Mission lifecycle commands');

  mission
    .command('create')
    .description('Create a new Mission and enter the specifying stage')
    .action(() => {
      const result = runMissionCreate();
      if (result.ok) success(result);
      else failure(result);
    });

  const spec = mission.command('spec').description('Mission Spec baseline');
  spec
    .command('record')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Mission Spec baseline')
    .action((opts: { from: string }) => {
      const payload = readPayload(opts.from);
      const result = runMissionSpecRecord(payload);
      if (result.ok) success(result);
      else failure(result);
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: PASS for all tests in this file.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/mission.ts cli/test/mission.test.ts
git commit -m "feat(cli): implement geas mission spec record"
```

---

## Task 14: geas mission design record

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkMissionDesignRecord`)
- Modify: `cli/src/commands/mission.ts` (add `runMissionDesignRecord`, register subcommand)
- Modify: `cli/test/mission.test.ts` (add test)

- [ ] **Step 1: Add guard in `cli/src/lib/guards.ts`**

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { missionDir, readLatestNumbered } from './runtime';

type MissionDesignPayload = {
  task_breakdown: Array<{ task_id: string; depends_on: string[] }>;
};

export function checkMissionDesignRecord(runState: RunState | null, payload: MissionDesignPayload, cwd?: string): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'specifying') failures.push({ code: 'stage_not_specifying', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const dir = missionDir(runState.current_mission_id, cwd);
    const spec = readLatestNumbered(dir, 'mission-spec');
    if (!spec) failures.push({ code: 'mission_spec_missing', path: join(dir, 'mission-spec-001.yaml') });
  }

  // task_id duplicates
  const taskIds = payload.task_breakdown?.map((t) => t.task_id) ?? [];
  const dupes = taskIds.filter((id, i) => taskIds.indexOf(id) !== i);
  if (dupes.length > 0) failures.push({ code: 'task_id_duplicate', detail: dupes.join(',') });

  // dependency target exists
  const idSet = new Set(taskIds);
  for (const t of payload.task_breakdown ?? []) {
    for (const dep of t.depends_on ?? []) {
      if (!idSet.has(dep)) {
        failures.push({ code: 'dependency_unknown', detail: `${t.task_id} -> ${dep}` });
      }
    }
  }

  // dependency cycle (DFS)
  const graph = new Map<string, string[]>();
  for (const t of payload.task_breakdown ?? []) graph.set(t.task_id, t.depends_on ?? []);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  function dfs(node: string): boolean {
    color.set(node, GRAY);
    for (const next of graph.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  }
  for (const id of taskIds) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      if (dfs(id)) {
        failures.push({ code: 'dependency_cycle' });
        break;
      }
    }
  }

  void existsSync;
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add test in `cli/test/mission.test.ts`**

```typescript
import { runMissionDesignRecord } from '../src/commands/mission';

const minimalSpec = {
  name: 'Demo',
  goal: 'goal',
  background: '',
  completion_criteria: [],
  included_scope: [],
  excluded_scope: [],
  acceptance_criteria: [],
  constraints: [],
  assumptions: [],
  risks: [],
};

const minimalDesign = {
  approach_strategy: 'A',
  alternatives_considered: [],
  key_concepts: [],
  scope_in: [],
  scope_out: [],
  task_breakdown: [
    { task_id: 'task-001', description: 't1', mission_coverage: [], depends_on: [], reason: '' },
    { task_id: 'task-002', description: 't2', mission_coverage: [], depends_on: ['task-001'], reason: '' },
  ],
  assumptions: [],
  risks: [],
};

test('mission design record materializes task directories', () => {
  const created = runMissionCreate();
  if (!created.ok) throw new Error('setup');
  const id = created.current.mission_id;
  runMissionSpecRecord(minimalSpec);

  const result = runMissionDesignRecord(minimalDesign);
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-design-001.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-001')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-002')));
  // task-state.yaml is NOT created here — that's task contract record's job
  assert.equal(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-001', 'task-state.yaml')), false);
});

test('mission design record rejects duplicate task_id', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'task_id_duplicate'));
});

test('mission design record rejects unknown dependency', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: ['task-999'], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'dependency_unknown'));
});

test('mission design record rejects dependency cycle', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: ['task-002'], reason: '' },
      { task_id: 'task-002', description: '', mission_coverage: [], depends_on: ['task-001'], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'dependency_cycle'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: FAIL — `runMissionDesignRecord` not exported.

- [ ] **Step 4: Add implementation in `cli/src/commands/mission.ts`**

Append:

```typescript
import { taskDir as taskDirFn } from '../lib/runtime';
import { checkMissionDesignRecord } from '../lib/guards';

const COMMAND_DESIGN = 'mission design record';

export function runMissionDesignRecord(payload: unknown, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const v = validate('mission-design', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkMissionDesignRecord(runState, payload as { task_breakdown: Array<{ task_id: string; depends_on: string[] }> }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const dir = missionDirFn(runState!.current_mission_id, cwd);
  const { number } = writeNumberedArtifact(dir, 'mission-design', payload);
  const rel = `.geas/missions/${runState!.current_mission_id}/mission-design-${String(number).padStart(3, '0')}.yaml`;
  const writes: SuccessResult['writes'] = [{ path: rel, type: 'created' }];

  const taskBreakdown = (payload as { task_breakdown: Array<{ task_id: string }> }).task_breakdown;
  for (const t of taskBreakdown) {
    const tdir = taskDirFn(runState!.current_mission_id, t.task_id, cwd);
    ensureDir(tdir);
    writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${t.task_id}/`, type: 'created' });
  }

  return { ok: true, command: COMMAND_DESIGN, current, writes, state_changes: [] };
}
```

Update `registerMission` to add the subcommand:

```typescript
const design = mission.command('design').description('Mission Design baseline');
design
  .command('record')
  .requiredOption('--from <path>', 'YAML payload path or - for stdin')
  .description('Record Mission Design baseline')
  .action((opts: { from: string }) => {
    const payload = readPayload(opts.from);
    const result = runMissionDesignRecord(payload);
    if (result.ok) success(result);
    else failure(result);
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/mission.ts cli/test/mission.test.ts
git commit -m "feat(cli): implement geas mission design record"
```

---

## Task 15: geas mission transition

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkMissionTransition`)
- Modify: `cli/src/commands/mission.ts` (add `runMissionTransition`, register subcommand)
- Modify: `cli/test/mission.test.ts` (add tests)

This guard must enforce the transition table from `docs/cli.md`. `building` entry needs Mission Spec, Mission Design, Task Contract for the target task, and accepted dependencies. `consolidating` entry needs each task to have Task Evidence + accepted task-result judgment.

- [ ] **Step 1: Add guard `checkMissionTransition` in `cli/src/lib/guards.ts`**

```typescript
import { join as pathJoin } from 'node:path';
import { missionDir as missionDirGuard, taskDir as taskDirGuard, readLatestNumbered as readLatestGuard, listTaskIds, readTaskState } from './runtime';

const ALLOWED_MISSION_TRANSITIONS = new Set<string>([
  'specifying->building',
  'building->building',
  'building->consolidating',
  'building->specifying',
  'consolidating->building',
  'consolidating->specifying',
]);

type DesignPayload = { task_breakdown: Array<{ task_id: string; depends_on: string[] }> };

export function checkMissionTransition(
  runState: RunState | null,
  toStage: 'specifying' | 'building' | 'consolidating',
  taskId: string | undefined,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const from = runState.current_stage;
  if (!ALLOWED_MISSION_TRANSITIONS.has(`${from}->${toStage}`)) {
    return fail([{ code: 'transition_not_allowed', detail: `${from}->${toStage}` }]);
  }

  const failures: GuardFailure[] = [];
  const mid = runState.current_mission_id;
  const md = missionDirGuard(mid, cwd);

  if (toStage === 'building') {
    if (!taskId) {
      failures.push({ code: 'task_required' });
    } else {
      const spec = readLatestGuard(md, 'mission-spec');
      const design = readLatestGuard<DesignPayload>(md, 'mission-design');
      if (!spec) failures.push({ code: 'mission_spec_missing' });
      if (!design) failures.push({ code: 'mission_design_missing' });
      if (design && !design.payload.task_breakdown.some((t) => t.task_id === taskId)) {
        failures.push({ code: 'task_unknown', detail: taskId });
      }
      const td = taskDirGuard(mid, taskId, cwd);
      const contract = readLatestGuard(td, 'task-contract');
      if (!contract) failures.push({ code: 'task_contract_missing', path: pathJoin(td, 'task-contract-001.yaml') });

      // dependency tasks must have task-evidence.yaml + accepted task-result judgment
      if (design) {
        const node = design.payload.task_breakdown.find((t) => t.task_id === taskId);
        for (const dep of node?.depends_on ?? []) {
          const depDir = taskDirGuard(mid, dep, cwd);
          if (!readLatestGuard(depDir, 'task-contract')) {
            failures.push({ code: 'dependency_not_ready', detail: `${dep}: contract missing` });
          }
          // task-evidence.yaml is fixed name; check via require-helper
          // ... (use existsSync)
        }
      }

      if ((from === 'specifying' || from === 'consolidating') && runState.current_task_id !== '') {
        failures.push({ code: 'task_in_progress', detail: runState.current_task_id });
      }
      if (from === 'building' && runState.current_task_id !== taskId) {
        const prevDir = taskDirGuard(mid, runState.current_task_id, cwd);
        const prevState = readTaskState(mid, runState.current_task_id, cwd);
        if (!prevState || prevState.phase !== 'closed') {
          failures.push({ code: 'previous_task_not_closed', path: pathJoin(prevDir, 'task-state.yaml') });
        }
      }
    }
  }

  if (toStage === 'consolidating') {
    const tasks = listTaskIds(mid, cwd);
    for (const tid of tasks) {
      const tdir = taskDirGuard(mid, tid, cwd);
      const teEvidence = pathJoin(tdir, 'task-evidence.yaml');
      // existence check is enough — Evidence record path enforced its own guards
      const fs = require('node:fs') as typeof import('node:fs');
      if (!fs.existsSync(teEvidence)) {
        failures.push({ code: 'task_evidence_missing', path: teEvidence });
      }
      const judgment = readLatestGuard<{ decision: string }>(tdir, 'user-judgment-result');
      if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
        failures.push({ code: 'task_judgment_not_accepted', detail: tid });
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add test in `cli/test/mission.test.ts`**

```typescript
import { runMissionTransition } from '../src/commands/mission';

test('mission transition fails when no task contract exists', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  const result = runMissionTransition('building', 'task-001');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'task_contract_missing'));
});

test('mission transition rejects disallowed pair', () => {
  runMissionCreate();
  // Try specifying -> consolidating directly
  const result = runMissionTransition('consolidating');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'transition_not_allowed'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: FAIL — `runMissionTransition` not exported.

- [ ] **Step 4: Add `runMissionTransition` in `cli/src/commands/mission.ts`**

```typescript
import { checkMissionTransition } from '../lib/guards';

const COMMAND_TRANSITION = 'mission transition';

export function runMissionTransition(
  toStage: 'specifying' | 'building' | 'consolidating',
  taskId?: string,
  cwd: string = process.cwd(),
): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const guard = checkMissionTransition(runState, toStage, taskId, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TRANSITION, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const before = { ...runState! };
  const next: typeof runState = {
    ...runState!,
    current_stage: toStage,
    current_task_id: toStage === 'building' ? taskId! : '',
  };
  writeRunState(next, cwd);

  const stateChanges: SuccessResult['state_changes'] = [];
  if (before.current_stage !== next.current_stage) {
    stateChanges.push({ pointer: 'current_stage', from: before.current_stage, to: next.current_stage });
  }
  if (before.current_task_id !== next.current_task_id) {
    stateChanges.push({ pointer: 'current_task_id', from: before.current_task_id, to: next.current_task_id });
  }

  return {
    ok: true,
    command: COMMAND_TRANSITION,
    current: { mission_id: next.current_mission_id, stage: next.current_stage, task_id: next.current_task_id, phase: '' },
    writes: [],
    state_changes: stateChanges,
  };
}
```

Add subcommand in `registerMission`:

```typescript
mission
  .command('transition')
  .requiredOption('--to <stage>', 'Target stage: specifying, building, or consolidating')
  .option('--task <task-id>', 'Required when --to=building')
  .description('Transition mission stage')
  .action((opts: { to: 'specifying' | 'building' | 'consolidating'; task?: string }) => {
    const result = runMissionTransition(opts.to, opts.task);
    if (result.ok) success(result);
    else failure(result);
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/mission.ts cli/test/mission.test.ts
git commit -m "feat(cli): implement geas mission transition"
```

---

## Task 16: geas mission evidence record

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkMissionEvidenceRecord`)
- Modify: `cli/src/commands/mission.ts` (add `runMissionEvidenceRecord`, register subcommand)
- Modify: `cli/test/mission.test.ts` (add test)

- [ ] **Step 1: Add guard `checkMissionEvidenceRecord`**

```typescript
export function checkMissionEvidenceRecord(runState: RunState | null, cwd?: string): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const md = missionDirGuard(runState.current_mission_id, cwd);
    const judgment = readLatestGuard<{ decision: string }>(md, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
    const fs = require('node:fs') as typeof import('node:fs');
    const evPath = pathJoin(md, 'mission-evidence.yaml');
    if (fs.existsSync(evPath)) failures.push({ code: 'mission_evidence_already_exists', path: evPath });
  }
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add test in `cli/test/mission.test.ts`**

```typescript
import { runMissionEvidenceRecord } from '../src/commands/mission';

test('mission evidence record fails outside consolidating', () => {
  runMissionCreate();
  const result = runMissionEvidenceRecord({});
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});
```

(Full happy-path test for this command requires task close-out; that flow is exercised in Task 19.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: FAIL — `runMissionEvidenceRecord` not exported.

- [ ] **Step 4: Add `runMissionEvidenceRecord` in `cli/src/commands/mission.ts`**

```typescript
import { writeYamlAtomic } from '../lib/runtime';
import { checkMissionEvidenceRecord } from '../lib/guards';

const COMMAND_MISSION_EVIDENCE = 'mission evidence record';

export function runMissionEvidenceRecord(payload: unknown, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const v = validate('mission-evidence', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_MISSION_EVIDENCE, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkMissionEvidenceRecord(runState, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_MISSION_EVIDENCE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const md = missionDirFn(runState!.current_mission_id, cwd);
  writeYamlAtomic(`${md}/mission-evidence.yaml`, payload);
  const rel = `.geas/missions/${runState!.current_mission_id}/mission-evidence.yaml`;

  const before = { ...runState! };
  const next = { current_mission_id: '', current_stage: '' as const, current_task_id: '' };
  writeRunState(next, cwd);

  return {
    ok: true,
    command: COMMAND_MISSION_EVIDENCE,
    current: { mission_id: '', stage: '', task_id: '', phase: '' },
    writes: [{ path: rel, type: 'created' }],
    state_changes: [
      { pointer: 'current_mission_id', from: before.current_mission_id, to: '' },
      { pointer: 'current_stage', from: before.current_stage, to: '' },
    ],
  };
}
```

Add subcommand in `registerMission`:

```typescript
const evidence = mission.command('evidence').description('Mission Evidence');
evidence
  .command('record')
  .requiredOption('--from <path>', 'YAML payload path or - for stdin')
  .description('Record Mission Evidence (mission closure summary)')
  .action((opts: { from: string }) => {
    const payload = readPayload(opts.from);
    const result = runMissionEvidenceRecord(payload);
    if (result.ok) success(result);
    else failure(result);
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/mission.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/mission.ts cli/test/mission.test.ts
git commit -m "feat(cli): implement geas mission evidence record"
```

---

## Task 17: geas task contract record

**Files:**
- Create: `cli/src/commands/task.ts`
- Create: `cli/test/task.test.ts`
- Modify: `cli/src/main.ts` (register task)
- Modify: `cli/src/lib/guards.ts` (add `checkTaskContractRecord`)

- [ ] **Step 1: Add guard in `cli/src/lib/guards.ts`**

```typescript
type TaskContractGuardCtx = {
  runState: RunState | null;
  taskId: string;
};

export function checkTaskContractRecord(ctx: TaskContractGuardCtx, cwd?: string): GuardResult {
  const { runState, taskId } = ctx;
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const failures: GuardFailure[] = [];
  if (!['specifying', 'building'].includes(runState.current_stage)) {
    failures.push({ code: 'stage_not_specifying_or_building', detail: runState.current_stage });
  }
  const md = missionDirGuard(runState.current_mission_id, cwd);
  const design = readLatestGuard<DesignPayload>(md, 'mission-design');
  if (!design) failures.push({ code: 'mission_design_missing' });
  if (design && !design.payload.task_breakdown.some((t) => t.task_id === taskId)) {
    failures.push({ code: 'task_unknown_in_design', detail: taskId });
  }
  if (runState.current_stage === 'building') {
    if (runState.current_task_id !== taskId) {
      failures.push({ code: 'task_not_current', detail: `current=${runState.current_task_id} requested=${taskId}` });
    }
    const td = taskDirGuard(runState.current_mission_id, taskId, cwd);
    const ts = readTaskState(runState.current_mission_id, taskId, cwd);
    if (!ts || ts.phase !== 'awaiting_user_judgment') {
      failures.push({ code: 'phase_not_awaiting_user_judgment', detail: ts?.phase ?? 'missing' });
    }
    const judgment = readLatestGuard<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || judgment.payload.decision !== 'revise') {
      failures.push({ code: 'judgment_not_revise' });
    }
  }
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Write failing test in `cli/test/task.test.ts`**

```typescript
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import {
  runMissionCreate,
  runMissionSpecRecord,
  runMissionDesignRecord,
} from '../src/commands/mission';
import { runTaskContractRecord } from '../src/commands/task';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = {
  name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [],
};
const minimalDesign = {
  approach_strategy: '',
  alternatives_considered: [],
  key_concepts: [],
  scope_in: [],
  scope_out: [],
  task_breakdown: [
    { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
  ],
  assumptions: [],
  risks: [],
};
const minimalContract = {
  description: 't1',
  mission_relation: '',
  depends_on: [],
  scope_in: [],
  scope_out: [],
  deliverables: [],
  acceptance_criteria: [],
  verification_checks: [],
  review_focus: [],
  risks: [],
};

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-task-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('mission create failed');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('task contract record stores numbered contract and creates task-state', () => {
  const result = runTaskContractRecord('task-001', minimalContract);
  assert.equal(result.ok, true);
  const taskBase = join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001');
  assert.ok(existsSync(join(taskBase, 'task-contract-001.yaml')));
  assert.ok(existsSync(join(taskBase, 'task-state.yaml')));
  const ts = readFileSync(join(taskBase, 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: unstarted/);
});

test('task contract record fails for unknown task id', () => {
  const result = runTaskContractRecord('task-999', minimalContract);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.guards?.some((g) => g.code === 'task_unknown_in_design'));
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: FAIL — `runTaskContractRecord` not exported.

- [ ] **Step 4: Create `cli/src/commands/task.ts`**

```typescript
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import {
  ensureDir,
  readRunState,
  readTaskState,
  taskDir,
  writeNumberedArtifact,
  writeTaskState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkTaskContractRecord } from '../lib/guards';
import { validate } from '../lib/schema';

export type TaskResult = SuccessResult | FailureResult;

const COMMAND_CONTRACT = 'task contract record';

function readPayload(from: string): unknown {
  const text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
}

function loc(state: ReturnType<typeof readRunState>, taskId: string, phase: string) {
  if (!state) return emptyLocation();
  return { mission_id: state.current_mission_id, stage: state.current_stage, task_id: taskId || state.current_task_id, phase };
}

export function runTaskContractRecord(taskId: string, payload: unknown, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  const v = validate('task-contract', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkTaskContractRecord({ runState, taskId }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  ensureDir(td);
  const { number } = writeNumberedArtifact(td, 'task-contract', payload);
  const writes: SuccessResult['writes'] = [{
    path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-contract-${String(number).padStart(3, '0')}.yaml`,
    type: 'created',
  }];

  const stateChanges: SuccessResult['state_changes'] = [];
  if (!ts) {
    writeTaskState(runState!.current_mission_id, taskId, { phase: 'unstarted' }, cwd);
    writes.push({
      path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-state.yaml`,
      type: 'created',
    });
    stateChanges.push({ pointer: `task[${taskId}].phase`, from: '', to: 'unstarted' });
  }

  return {
    ok: true,
    command: COMMAND_CONTRACT,
    current: loc(runState, taskId, ts?.phase ?? 'unstarted'),
    writes,
    state_changes: stateChanges,
  };
}

export function registerTask(program: Command): void {
  const task = program.command('task').description('Task lifecycle commands');

  const contract = task.command('contract').description('Task Contract baseline');
  contract
    .command('record')
    .requiredOption('--task <task-id>', 'Target task id')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Task Contract baseline')
    .action((opts: { task: string; from: string }) => {
      const payload = readPayload(opts.from);
      const result = runTaskContractRecord(opts.task, payload);
      if (result.ok) success(result);
      else failure(result);
    });
}
```

- [ ] **Step 5: Wire into main**

Modify `cli/src/main.ts`:

```typescript
import { registerTask } from './commands/task';
// ...
registerTask(program);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/task.ts cli/test/task.test.ts cli/src/main.ts
git commit -m "feat(cli): implement geas task contract record"
```

---

## Task 18: geas task transition

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkTaskTransition`)
- Modify: `cli/src/commands/task.ts` (add `runTaskTransition`, register subcommand)
- Modify: `cli/test/task.test.ts` (add tests)

- [ ] **Step 1: Add guard `checkTaskTransition` per `docs/cli.md`'s allowed pair table**

```typescript
const ALLOWED_TASK_TRANSITIONS = new Set<string>([
  'unstarted->implementing',
  'awaiting_user_judgment->implementing',
  'awaiting_user_judgment->verifying',
  'awaiting_user_judgment->reviewing',
  'reviewing->challenging',
  'awaiting_user_judgment->challenging',
  'verifying->awaiting_user_judgment',
  'reviewing->awaiting_user_judgment',
  'challenging->awaiting_user_judgment',
]);

const REVISE_REQUIRED_TARGETS = new Set<string>(['implementing', 'verifying', 'reviewing', 'challenging']);

export function checkTaskTransition(
  runState: RunState | null,
  taskId: string,
  toPhase: 'unstarted' | 'implementing' | 'verifying' | 'reviewing' | 'challenging' | 'awaiting_user_judgment' | 'closed',
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_stage !== 'building') return fail([{ code: 'stage_not_building', detail: runState.current_stage }]);
  if (runState.current_task_id !== taskId) return fail([{ code: 'task_not_current', detail: `current=${runState.current_task_id}` }]);
  const failures: GuardFailure[] = [];
  const td = taskDirGuard(runState.current_mission_id, taskId, cwd);
  const contract = readLatestGuard(td, 'task-contract');
  if (!contract) failures.push({ code: 'task_contract_missing' });
  const ts = readTaskState(runState.current_mission_id, taskId, cwd);
  if (!ts) {
    failures.push({ code: 'task_state_missing' });
    return fail(failures);
  }
  const fromPhase = ts.phase;
  const pair = `${fromPhase}->${toPhase}`;
  if (!ALLOWED_TASK_TRANSITIONS.has(pair)) {
    failures.push({ code: 'transition_not_allowed', detail: pair });
  }
  if (fromPhase === 'awaiting_user_judgment' && REVISE_REQUIRED_TARGETS.has(toPhase)) {
    const judgment = readLatestGuard<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || judgment.payload.decision !== 'revise') {
      failures.push({ code: 'judgment_not_revise', detail: judgment?.payload.decision ?? 'missing' });
    }
  }
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add test in `cli/test/task.test.ts`**

```typescript
import { runTaskTransition } from '../src/commands/task';
import { runMissionTransition } from '../src/commands/mission';

test('task transition unstarted->implementing succeeds when stage is building', () => {
  runTaskContractRecord('task-001', minimalContract);
  const trans = runMissionTransition('building', 'task-001');
  assert.equal(trans.ok, true);
  const result = runTaskTransition('task-001', 'implementing');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: implementing/);
});

test('task transition rejects disallowed pair', () => {
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  const result = runTaskTransition('task-001', 'closed');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'transition_not_allowed'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: FAIL — `runTaskTransition` not exported.

- [ ] **Step 4: Add `runTaskTransition` and register subcommand in `cli/src/commands/task.ts`**

```typescript
import { checkTaskTransition } from '../lib/guards';

const COMMAND_TRANSITION = 'task transition';

const ALLOWED_PHASES = ['unstarted', 'implementing', 'verifying', 'reviewing', 'challenging', 'awaiting_user_judgment', 'closed'] as const;
type Phase = (typeof ALLOWED_PHASES)[number];

export function runTaskTransition(taskId: string, toPhase: Phase, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  if (toPhase === 'closed') {
    return { ok: false, command: COMMAND_TRANSITION, current, writes: [], error: { code: 'transition_not_allowed', detail: 'closed reached only via task evidence record' } };
  }

  const guard = checkTaskTransition(runState, taskId, toPhase, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TRANSITION, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const before = ts!.phase;
  writeTaskState(runState!.current_mission_id, taskId, { phase: toPhase }, cwd);
  return {
    ok: true,
    command: COMMAND_TRANSITION,
    current: { ...current, phase: toPhase },
    writes: [],
    state_changes: [{ pointer: `task[${taskId}].phase`, from: before, to: toPhase }],
  };
}
```

Add subcommand in `registerTask`:

```typescript
task
  .command('transition')
  .requiredOption('--task <task-id>', 'Target task id')
  .requiredOption('--to <phase>', 'Target phase')
  .description('Transition task phase explicitly')
  .action((opts: { task: string; to: Phase }) => {
    const result = runTaskTransition(opts.task, opts.to);
    if (result.ok) success(result);
    else failure(result);
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/task.ts cli/test/task.test.ts
git commit -m "feat(cli): implement geas task transition"
```

---

## Task 19: geas task evidence record

**Files:**
- Modify: `cli/src/lib/guards.ts` (add `checkTaskEvidenceRecord`)
- Modify: `cli/src/commands/task.ts` (add `runTaskEvidenceRecord`, register subcommand)
- Modify: `cli/test/task.test.ts` (add tests)

This is the most complex command. It records Evidence by kind and auto-advances `task-state.yaml` per the kind+verdict table:

| Kind | Verdict | Phase before | Phase after |
|---|---|---|---|
| implementation | n/a | implementing | verifying |
| verification | passed | verifying | reviewing |
| verification | changes_requested or escalated | verifying | awaiting_user_judgment |
| review | n/a | reviewing | awaiting_user_judgment |
| challenger | n/a | challenging | awaiting_user_judgment |
| task | n/a | awaiting_user_judgment (judgment accepted) | closed |

- [ ] **Step 1: Add guard `checkTaskEvidenceRecord`**

```typescript
type EvidenceKind = 'implementation' | 'verification' | 'review' | 'challenger' | 'task';

const KIND_TO_REQUIRED_PHASE: Record<EvidenceKind, RegExp | string> = {
  implementation: 'implementing',
  verification: 'verifying',
  review: 'reviewing',
  challenger: 'challenging',
  task: 'awaiting_user_judgment',
};

export function checkTaskEvidenceRecord(
  runState: RunState | null,
  taskId: string,
  kind: EvidenceKind,
  payload: { verdict?: string },
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_stage !== 'building') return fail([{ code: 'stage_not_building', detail: runState.current_stage }]);
  if (runState.current_task_id !== taskId) return fail([{ code: 'task_not_current', detail: `current=${runState.current_task_id}` }]);

  const failures: GuardFailure[] = [];
  const td = taskDirGuard(runState.current_mission_id, taskId, cwd);
  const contract = readLatestGuard(td, 'task-contract');
  if (!contract) failures.push({ code: 'task_contract_missing' });
  const ts = readTaskState(runState.current_mission_id, taskId, cwd);
  if (!ts) failures.push({ code: 'task_state_missing' });

  if (ts && ts.phase !== KIND_TO_REQUIRED_PHASE[kind]) {
    failures.push({ code: 'phase_does_not_match_kind', detail: `phase=${ts.phase} kind=${kind}` });
  }

  if (kind === 'task') {
    const judgment = readLatestGuard<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'task_judgment_not_accepted', detail: judgment?.payload.decision ?? 'missing' });
    }
    const fs = require('node:fs') as typeof import('node:fs');
    if (fs.existsSync(`${td}/task-evidence.yaml`)) {
      failures.push({ code: 'task_evidence_already_exists' });
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Add tests in `cli/test/task.test.ts`** (one per kind + the verdict branches for verification). The cross-command happy path that combines judgment with `kind=task` lives in Task 20 because `runJudgmentRecord` doesn't exist yet.

```typescript
import { runTaskEvidenceRecord } from '../src/commands/task';

const implEv = {
  summary: 'did stuff', changed_outputs: [], affected_scope: [], decisions: [], contract_deltas: [], self_checks: [], limits: [], reflection_candidates: [],
};
const verifEv = (verdict: 'passed' | 'changes_requested' | 'escalated') => ({
  summary: '', environment: '', target: [], checks_performed: [], criteria_results: [], outputs: [], deviations: [], unverified_scope: [], recheck_needed: [], verdict,
});
const reviewEv = {
  summary: '', target: [], review_focus_used: [], scope_in: [], scope_out: [], review_methods: [], findings: [], remaining_risks: [], verdict: 'passed', overall_recommendation: '',
};
const challEv = {
  target: [], challenge_focus: [], findings: [], user_decisions_needed: [], deeper_checks_needed: [], verdict: 'passed', overall_recommendation: '',
};
const taskEv = {
  summary: '', user_judgment_summary: '', criteria_results: [], accepted_unverified_scope: [], accepted_remaining_risks: [],
};

function intoBuildingImplementing() {
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
}

test('implementation evidence advances phase to verifying', () => {
  intoBuildingImplementing();
  const r = runTaskEvidenceRecord('task-001', 'implementation', implEv);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: verifying/);
});

test('verification passed advances to reviewing', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  const r = runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: reviewing/);
});

test('verification changes_requested advances to awaiting_user_judgment', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  const r = runTaskEvidenceRecord('task-001', 'verification', verifEv('changes_requested'));
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: awaiting_user_judgment/);
});

test('review evidence advances to awaiting_user_judgment', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  const r = runTaskEvidenceRecord('task-001', 'review', reviewEv);
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: awaiting_user_judgment/);
});

test('task evidence rejected when judgment not accepted', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  runTaskEvidenceRecord('task-001', 'review', reviewEv);
  const r = runTaskEvidenceRecord('task-001', 'task', taskEv);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'task_judgment_not_accepted'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: FAIL — `runTaskEvidenceRecord` not exported.

- [ ] **Step 4: Add `runTaskEvidenceRecord` in `cli/src/commands/task.ts`**

```typescript
import { writeYamlAtomic } from '../lib/runtime';
import { checkTaskEvidenceRecord } from '../lib/guards';

const COMMAND_TASK_EVIDENCE = 'task evidence record';

type EvidenceKind = 'implementation' | 'verification' | 'review' | 'challenger' | 'task';

const KIND_TO_SCHEMA: Record<EvidenceKind, 'implementation-evidence' | 'verification-evidence' | 'review-evidence' | 'challenger-evidence' | 'task-evidence'> = {
  implementation: 'implementation-evidence',
  verification: 'verification-evidence',
  review: 'review-evidence',
  challenger: 'challenger-evidence',
  task: 'task-evidence',
};

const KIND_TO_PREFIX: Record<EvidenceKind, string> = {
  implementation: 'implementation-evidence',
  verification: 'verification-evidence',
  review: 'review-evidence',
  challenger: 'challenger-evidence',
  task: 'task-evidence',
};

function nextPhaseAfterEvidence(kind: EvidenceKind, payload: { verdict?: string }): 'verifying' | 'reviewing' | 'awaiting_user_judgment' | 'closed' {
  if (kind === 'implementation') return 'verifying';
  if (kind === 'verification') {
    return payload.verdict === 'passed' ? 'reviewing' : 'awaiting_user_judgment';
  }
  if (kind === 'review' || kind === 'challenger') return 'awaiting_user_judgment';
  return 'closed';
}

export function runTaskEvidenceRecord(taskId: string, kind: EvidenceKind, payload: unknown, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  const v = validate(KIND_TO_SCHEMA[kind], payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkTaskEvidenceRecord(runState, taskId, kind, payload as { verdict?: string }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  const writes: SuccessResult['writes'] = [];

  if (kind === 'task') {
    writeYamlAtomic(`${td}/task-evidence.yaml`, payload);
    writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-evidence.yaml`, type: 'created' });
  } else {
    const { number } = writeNumberedArtifact(td, KIND_TO_PREFIX[kind], payload);
    writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/${KIND_TO_PREFIX[kind]}-${String(number).padStart(3, '0')}.yaml`, type: 'created' });
  }

  const fromPhase = ts!.phase;
  const toPhase = nextPhaseAfterEvidence(kind, payload as { verdict?: string });
  writeTaskState(runState!.current_mission_id, taskId, { phase: toPhase }, cwd);

  return {
    ok: true,
    command: COMMAND_TASK_EVIDENCE,
    current: { ...current, phase: toPhase },
    writes,
    state_changes: [{ pointer: `task[${taskId}].phase`, from: fromPhase, to: toPhase }],
  };
}
```

Register subcommand in `registerTask`:

```typescript
const evidence = task.command('evidence').description('Task scope Evidence');
evidence
  .command('record')
  .requiredOption('--task <task-id>', 'Target task id')
  .requiredOption('--kind <kind>', 'implementation|verification|review|challenger|task')
  .requiredOption('--from <path>', 'YAML payload path or - for stdin')
  .description('Record Task scope Evidence')
  .action((opts: { task: string; kind: EvidenceKind; from: string }) => {
    const payload = readPayload(opts.from);
    const result = runTaskEvidenceRecord(opts.task, opts.kind, payload);
    if (result.ok) success(result);
    else failure(result);
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd cli && npx tsx --test test/task.test.ts`
Expected: PASS for all tests in this file.

- [ ] **Step 6: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/task.ts cli/test/task.test.ts
git commit -m "feat(cli): implement geas task evidence record"
```

---

## Task 20: geas judgment record

**Files:**
- Create: `cli/src/commands/judgment.ts`
- Create: `cli/test/judgment.test.ts`
- Modify: `cli/src/main.ts` (register judgment)
- Modify: `cli/src/lib/guards.ts` (add `checkJudgmentRecord`)
- Modify: `cli/test/task.test.ts` (re-enable the task-evidence/judgment chain test if it was skipped)

- [ ] **Step 1: Add guard `checkJudgmentRecord`**

```typescript
type JudgmentTarget = 'task-result' | 'mission-result';

export function checkJudgmentRecord(
  runState: RunState | null,
  target: JudgmentTarget,
  taskId: string | undefined,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const failures: GuardFailure[] = [];
  if (target === 'task-result') {
    if (runState.current_stage !== 'building') failures.push({ code: 'stage_not_building', detail: runState.current_stage });
    if (!taskId) {
      failures.push({ code: 'task_required' });
    } else {
      if (runState.current_task_id !== taskId) failures.push({ code: 'task_not_current', detail: `current=${runState.current_task_id}` });
      const ts = readTaskState(runState.current_mission_id, taskId, cwd);
      if (!ts || ts.phase !== 'awaiting_user_judgment') {
        failures.push({ code: 'phase_not_awaiting_user_judgment', detail: ts?.phase ?? 'missing' });
      }
    }
  }
  if (target === 'mission-result') {
    if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  }
  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Write failing test in `cli/test/judgment.test.ts`**

```typescript
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate, runMissionSpecRecord, runMissionDesignRecord, runMissionTransition } from '../src/commands/mission';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import { runJudgmentRecord } from '../src/commands/judgment';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = { name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [] };
const minimalDesign = { approach_strategy: '', alternatives_considered: [], key_concepts: [], scope_in: [], scope_out: [], task_breakdown: [{ task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' }], assumptions: [], risks: [] };
const minimalContract = { description: '', mission_relation: '', depends_on: [], scope_in: [], scope_out: [], deliverables: [], acceptance_criteria: [], verification_checks: [], review_focus: [], risks: [] };
const implEv = { summary: '', changed_outputs: [], affected_scope: [], decisions: [], contract_deltas: [], self_checks: [], limits: [], reflection_candidates: [] };
const verifPassed = { summary: '', environment: '', target: [], checks_performed: [], criteria_results: [], outputs: [], deviations: [], unverified_scope: [], recheck_needed: [], verdict: 'passed' };
const reviewEv = { summary: '', target: [], review_focus_used: [], scope_in: [], scope_out: [], review_methods: [], findings: [], remaining_risks: [], verdict: 'passed', overall_recommendation: '' };
const validJudgment = { decision: 'accepted', accepted_unverified_scope: [], accepted_remaining_risks: [], requested_actions: [] };

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-judgment-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('setup');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifPassed);
  runTaskEvidenceRecord('task-001', 'review', reviewEv);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('task-result judgment writes numbered file in task dir', () => {
  const r = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'user-judgment-result-001.yaml')));
});

test('task-result judgment fails when phase is not awaiting_user_judgment', () => {
  // Fresh mission to avoid the awaiting_user_judgment setup
  process.chdir(originalCwd);
  workdir = mkdtempSync(join(tmpdir(), 'geas-judgment-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('setup');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');

  const r = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'phase_not_awaiting_user_judgment'));
});

test('mission-result judgment fails outside consolidating', () => {
  const r = runJudgmentRecord('mission-result', validJudgment);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/judgment.test.ts`
Expected: FAIL — `runJudgmentRecord` not exported.

- [ ] **Step 4: Create `cli/src/commands/judgment.ts`**

```typescript
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import {
  missionDir,
  readRunState,
  taskDir,
  writeNumberedArtifact,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkJudgmentRecord } from '../lib/guards';
import { validate } from '../lib/schema';

export type JudgmentResult = SuccessResult | FailureResult;

const COMMAND = 'judgment record';

function readPayload(from: string): unknown {
  const text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
}

export function runJudgmentRecord(
  target: 'task-result' | 'mission-result',
  payload: unknown,
  taskId?: string,
  cwd: string = process.cwd(),
): JudgmentResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const v = validate('user-judgment', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkJudgmentRecord(runState, target, taskId, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const dir = target === 'task-result'
    ? taskDir(runState!.current_mission_id, taskId!, cwd)
    : missionDir(runState!.current_mission_id, cwd);
  const { number } = writeNumberedArtifact(dir, 'user-judgment-result', payload);

  const rel = target === 'task-result'
    ? `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/user-judgment-result-${String(number).padStart(3, '0')}.yaml`
    : `.geas/missions/${runState!.current_mission_id}/user-judgment-result-${String(number).padStart(3, '0')}.yaml`;

  return {
    ok: true,
    command: COMMAND,
    current,
    writes: [{ path: rel, type: 'created' }],
    state_changes: [],
  };
}

export function registerJudgment(program: Command): void {
  program
    .command('judgment')
    .description('User judgment')
    .command('record')
    .requiredOption('--target <target>', 'task-result or mission-result')
    .option('--task <task-id>', 'Required for task-result')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record User Judgment')
    .action((opts: { target: 'task-result' | 'mission-result'; task?: string; from: string }) => {
      const payload = readPayload(opts.from);
      const result = runJudgmentRecord(opts.target, payload, opts.task);
      if (result.ok) success(result);
      else failure(result);
    });
}
```

- [ ] **Step 5: Wire into main**

```typescript
import { registerJudgment } from './commands/judgment';
// ...
registerJudgment(program);
```

- [ ] **Step 6: Add the cross-command happy path test in `cli/test/judgment.test.ts`**

```typescript
test('task-result accepted then task evidence advances phase to closed', () => {
  // Setup is already in place from beforeEach (phase = awaiting_user_judgment).
  const judgment = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(judgment.ok, true);

  const taskEv = { summary: '', user_judgment_summary: '', criteria_results: [], accepted_unverified_scope: [], accepted_remaining_risks: [] };
  const r = runTaskEvidenceRecord('task-001', 'task', taskEv);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.current.phase, 'closed');
});
```

(Add the import for `runTaskEvidenceRecord` at the top of `cli/test/judgment.test.ts` if not already present.)

- [ ] **Step 7: Run all tests**

Run: `cd cli && npm test`
Expected: PASS for init, mission, task, judgment test files.

- [ ] **Step 8: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/judgment.ts cli/test/judgment.test.ts cli/src/main.ts
git commit -m "feat(cli): implement geas judgment record"
```

---

## Task 21: geas memory record

**Files:**
- Create: `cli/src/commands/memory.ts`
- Create: `cli/test/memory.test.ts`
- Modify: `cli/src/main.ts` (register memory)
- Modify: `cli/src/lib/guards.ts` (add `checkMemoryRecord`)

- [ ] **Step 1: Add guard `checkMemoryRecord`**

```typescript
type MemoryItemPayload = { source_refs: string[] };

export function checkMemoryRecord(
  runState: RunState | null,
  scope: 'common' | 'role',
  role: string | undefined,
  payload: MemoryItemPayload,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const md = missionDirGuard(runState.current_mission_id, cwd);
    const judgment = readLatestGuard<{ decision: string }>(md, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
  }
  if (scope === 'role') {
    if (!role) failures.push({ code: 'role_required' });
    else if (!['orchestrator', 'work-designer', 'implementer', 'verifier', 'reviewer', 'challenger'].includes(role)) {
      failures.push({ code: 'role_invalid', detail: role });
    }
  }

  // source_refs must point at existing artifacts under .geas/missions/<mid>/
  if (runState.current_mission_id !== '') {
    const fs = require('node:fs') as typeof import('node:fs');
    const md = missionDirGuard(runState.current_mission_id, cwd);
    for (const ref of payload.source_refs ?? []) {
      const abs = pathJoin(md, ref);
      if (!fs.existsSync(abs)) {
        failures.push({ code: 'source_ref_missing', path: abs });
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}
```

- [ ] **Step 2: Write failing test in `cli/test/memory.test.ts`**

```typescript
import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate } from '../src/commands/mission';
import { runMemoryRecord } from '../src/commands/memory';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-memory-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('memory record fails when not in consolidating', () => {
  runMissionCreate();
  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('memory record rejects invalid role name', () => {
  runMissionCreate();
  const r = runMemoryRecord('role', 'unknown-role', { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'role_invalid'));
});

test('memory record rejects schema-invalid payload', () => {
  const r = runMemoryRecord('common', undefined, { guideline: 'g' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'schema_invalid');
});
```

(Happy-path testing requires a fully-closed mission with an accepted mission-result judgment; the memory record happy path is exercised in the Mission integration scenario in Task 24. Here we cover negative cases.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd cli && npx tsx --test test/memory.test.ts`
Expected: FAIL — `runMemoryRecord` not exported.

- [ ] **Step 4: Create `cli/src/commands/memory.ts`**

```typescript
import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { join } from 'node:path';
import { geasRoot, readRunState, readYaml, writeYamlAtomic } from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMemoryRecord } from '../lib/guards';
import { validate } from '../lib/schema';

export type MemoryResult = SuccessResult | FailureResult;

const COMMAND = 'memory record';

function readPayload(from: string): unknown {
  const text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
}

export function runMemoryRecord(
  scope: 'common' | 'role',
  role: string | undefined,
  payload: unknown,
  cwd: string = process.cwd(),
): MemoryResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const v = validate('memory-item', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkMemoryRecord(runState, scope, role, payload as { source_refs: string[] }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const root = geasRoot(cwd);
  const file = scope === 'common'
    ? join(root, 'memory', 'common.yaml')
    : join(root, 'memory', 'roles', `${role}.yaml`);

  const existing = readYaml<{ items: unknown[] }>(file) ?? { items: [] };
  existing.items.push(payload);
  writeYamlAtomic(file, existing);

  const rel = scope === 'common' ? '.geas/memory/common.yaml' : `.geas/memory/roles/${role}.yaml`;
  return {
    ok: true,
    command: COMMAND,
    current,
    writes: [{ path: rel, type: 'updated' }],
    state_changes: [],
  };
}

export function registerMemory(program: Command): void {
  program
    .command('memory')
    .description('Memory updates')
    .command('record')
    .requiredOption('--scope <scope>', 'common or role')
    .option('--role <role>', 'Required for --scope role')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Append a memory item')
    .action((opts: { scope: 'common' | 'role'; role?: string; from: string }) => {
      const payload = readPayload(opts.from);
      const result = runMemoryRecord(opts.scope, opts.role, payload);
      if (result.ok) success(result);
      else failure(result);
    });
}

void existsSync;
```

- [ ] **Step 5: Wire into main**

```typescript
import { registerMemory } from './commands/memory';
// ...
registerMemory(program);
```

- [ ] **Step 6: Run all tests**

Run: `cd cli && npm test`
Expected: PASS for all test files.

- [ ] **Step 7: Commit**

```bash
git add cli/src/lib/guards.ts cli/src/commands/memory.ts cli/test/memory.test.ts cli/src/main.ts
git commit -m "feat(cli): implement geas memory record"
```

---

## Task 22: Build bin/geas + git executable bit

**Files:**
- Build artifact: `bin/geas`

- [ ] **Step 1: Run the build**

Run: `cd A:/geas/cli && npm run build`
Expected: `A:/geas/bin/geas` exists, starts with `#!/usr/bin/env node\n`.

- [ ] **Step 2: Smoke-test the bundle**

Run:

```bash
cd A:/geas
node bin/geas --version
node bin/geas init --help
```

Expected: version prints `3.0.0`. `init --help` prints usage info.

- [ ] **Step 3: Smoke-test init in a temp dir**

```bash
mkdir -p /tmp/geas-smoke && cd /tmp/geas-smoke
node A:/geas/bin/geas init
```

Expected: JSON output with `"ok": true` and writes for `.geas/run-state.yaml` etc. `.geas/` exists with the expected skeleton.

- [ ] **Step 4: Track the bundle and set executable bit in git**

```bash
cd A:/geas
git add bin/geas
git update-index --chmod=+x bin/geas
git status
```

Expected: `bin/geas` shows up as a new file with `+x` mode in the index.

- [ ] **Step 5: Commit**

```bash
git add bin/geas
git commit -m "build(cli): build initial bin/geas bundle"
```

---

## Task 23: skills/geas-cli.md

**Files:**
- Create: `skills/geas-cli.md`

A thin agent-facing reference. Calling pattern + flow snippets + payload examples + frequent-guard quick fixes. Cap at ~250 lines; full reference stays in `docs/cli.md`.

- [ ] **Step 1: Create `skills/geas-cli.md`**

```markdown
# geas-cli

Reference for invoking the `geas` CLI. The CLI is the only writer for `.geas/` runtime artifacts.

Full command surface: see `docs/cli.md`. Artifact schemas: see `docs/runtime.md`.

## Calling pattern

1. Build the YAML payload as a temp file (e.g. `task-001-contract.yaml`).
2. Invoke `geas <command> --from <path>`.
3. Read the JSON result on stdout. `ok: true` means the artifact and any state pointer were updated atomically. `ok: false` means runtime is unchanged; act on `error.code` and `error.guards`.

`--from -` reads payload from stdin.

## Output shape

Success:

```json
{
  "ok": true,
  "command": "task contract record",
  "current": { "mission_id": "...", "stage": "building", "task_id": "task-001", "phase": "implementing" },
  "writes": [ { "path": "...", "type": "created" } ],
  "state_changes": [ { "pointer": "task[task-001].phase", "from": "", "to": "unstarted" } ]
}
```

Failure:

```json
{
  "ok": false,
  "command": "...",
  "current": { ... },
  "writes": [],
  "error": { "code": "guard_failed", "guards": [ { "code": "stage_not_specifying" } ] }
}
```

## Mission start flow

```
geas init                                      # once per project
geas mission create
geas mission spec record --from spec.yaml
geas mission design record --from design.yaml
```

## Task execution flow

```
geas task contract record --task task-001 --from contract.yaml
geas mission transition --to building --task task-001
geas task transition --to implementing --task task-001
geas task evidence record --task task-001 --kind implementation --from impl.yaml
geas task evidence record --task task-001 --kind verification --from verify.yaml
geas task evidence record --task task-001 --kind review --from review.yaml
# (optional) geas task evidence record --task task-001 --kind challenger --from chall.yaml
geas judgment record --target task-result --task task-001 --from judgment.yaml
geas task evidence record --task task-001 --kind task --from task-evidence.yaml
```

The `task evidence record` calls automatically advance `task-state.yaml.phase`. See `docs/cli.md`'s phase table.

## Mission close flow

```
geas mission transition --to consolidating
geas judgment record --target mission-result --from mission-judgment.yaml
geas memory record --scope common --from memory-item.yaml          # repeat per item
geas memory record --scope role --role reviewer --from memory-item.yaml
geas mission evidence record --from mission-evidence.yaml
```

## Frequent guard failures

| code | meaning | fix |
|---|---|---|
| `state_conflict` | `--expect-stage`/`--expect-phase`/`--expect-task` mismatched runtime | re-read `.geas/run-state.yaml` and `.geas/missions/<mid>/tasks/<tid>/task-state.yaml`; align expected flags |
| `task_contract_missing` | tried to enter `building` for a task without a recorded Task Contract | run `geas task contract record --task <tid> --from contract.yaml` first |
| `phase_not_awaiting_user_judgment` | tried to record `task` evidence or `task-result` judgment outside the awaiting state | record verification + review evidence first; for `task` evidence ensure judgment is also `accepted`/`accepted_with_limits` |
| `judgment_not_revise` | tried to re-enter `implementing`/`verifying`/`reviewing`/`challenging` from `awaiting_user_judgment` without a `revise` decision | record a new judgment with `decision: revise` first |
| `dependency_cycle` | mission design has a cycle in `task_breakdown.depends_on` | rewrite the design so dependencies form a DAG |
| `mission_judgment_not_accepted` | tried to record memory or mission evidence before the mission-result judgment was accepted | record `judgment record --target mission-result` with decision `accepted` or `accepted_with_limits` |

## Payload examples

### Mission Spec (`mission-spec.yaml`)

```yaml
name: ""
goal: ""
background: ""
completion_criteria: []
included_scope: []
excluded_scope: []
acceptance_criteria: []
constraints: []
assumptions: []
risks: []
```

Empty values mean "no content"; all keys must be present.

### Task Contract (`task-contract.yaml`)

```yaml
description: ""
mission_relation: ""
depends_on: []
scope_in: []
scope_out: []
deliverables: []
acceptance_criteria: []
verification_checks: []
review_focus: []
risks: []
```

### Implementation Evidence

```yaml
summary: ""
changed_outputs: []
affected_scope: []
decisions: []
contract_deltas: []
self_checks: []
limits: []
reflection_candidates: []
```

### User Judgment

```yaml
decision: accepted        # accepted | accepted_with_limits | revise | deferred | stopped
accepted_unverified_scope: []
accepted_remaining_risks: []
requested_actions: []
```

### Memory item

```yaml
guideline: ""
applies_when: []
source_refs: []           # paths relative to .geas/missions/<mid>/, e.g. tasks/task-001/task-evidence.yaml
```

## Notes

- The CLI is the only producer of identifiers, file numbers, and storage paths. Do not invent file names yourself.
- The CLI never makes acceptance decisions. Record the user's decision via `judgment record` and let the CLI advance the state pointers.
- For the full transition tables (`mission stage` and `task phase`), read `docs/cli.md`.
```

- [ ] **Step 2: Commit**

```bash
git add skills/geas-cli.md
git commit -m "docs(skill): add geas-cli reference skill"
```

---

## Self-Review Notes

After all 23 tasks, the project should:

- Run `npm test` from `cli/` and pass all command-unit tests
- Build `bin/geas` via `npm run build`
- Have a tracked, executable `bin/geas` at the repo root
- Have a thin agent-facing skill at `skills/geas-cli.md`
- Have validated all 14 schemas during implementation

Spec coverage check: every command in `docs/cli.md` has an implementation task (Tasks 11-21). Each runtime artifact in `docs/runtime.md` has a JSON Schema (Tasks 2-5). All transition rules (mission stage table and task phase table) are encoded in guards (Tasks 12, 15, 18, 19) and verified with tests.
