---
name: cleanup
description: Entropy scan — detect AI slop, unused code, convention drift. Records findings in .geas/debt.json. Invoke after Build or during Evolution.
---

# Cleanup

Entropy management. Codebases degrade over rapid iteration — especially when multiple agents write code in parallel. This skill systematically finds the rot and creates actionable issues.

**KEY PRINCIPLE: Entropy is inevitable. Managing it is not optional.**

---

## When

Compass invokes this:
- After **Phase 2 (Build)** — the first wave of code is done, clean it up before polish
- During **Phase 4 (Evolution)** — ongoing hygiene as the product matures
- On **explicit request** from the human or Forge

---

## Who

**Forge** runs this. Architecture awareness is required to distinguish genuine problems from intentional patterns.

---

## What to Scan

Scan all source files in the project (respect `.gitignore`, skip `node_modules`, `vendor`, `target`, `dist`, `build`, `.git`).

### 1. Unnecessary Comments

Comments that restate what the code already says:

```
// BAD — restates the code
counter++; // increment counter

// BAD — obvious from context
const user = await getUser(id); // get the user

// GOOD — explains WHY
counter++; // offset by 1 because the API returns 0-indexed pages
```

Flag comments where removing them loses zero information.

### 2. Dead Code

- **Unused exports**: Functions, classes, or constants exported but never imported elsewhere
- **Unreachable branches**: `if (false)`, conditions that can never be true based on types
- **Commented-out code blocks**: More than 3 lines of commented-out code. Comments are for explanations, not code storage — that is what git is for.
- **Unused variables/imports**: Anything declared but never referenced (linters catch some of this, but not all)

### 3. Duplication

- Similar logic in 2+ files that should be a shared utility
- Copy-pasted patterns with minor variations (e.g. two API routes with identical validation logic)
- Threshold: 10+ lines of substantially similar code across files

### 4. Over-Abstraction

- Classes or interfaces created for a single use case with no realistic second consumer
- Premature generalization: config objects with 15 options when only 2 are ever used
- Wrapper functions that add no logic — they just call another function with the same arguments
- Factory patterns for things that are instantiated exactly once

### 5. Convention Drift

Read `.geas/memory/_project/conventions.md` and check for divergence:

- **Naming inconsistencies**: Mixed casing styles (camelCase in some files, snake_case in others)
- **Import pattern changes**: Some files use absolute imports, others use relative
- **File structure divergence**: New files placed in unexpected directories
- **Style inconsistencies**: Mixed formatting patterns not caught by linters

### 6. AI Boilerplate

Patterns common in AI-generated code:

- **Verbose error handling**: Try-catch blocks that catch, log, and re-throw without adding context
- **Redundant type annotations**: Types that TypeScript can infer perfectly well (`const x: string = "hello"`)
- **Unnecessary wrapper functions**: `async function fetchData() { return await fetch(...) }` — the wrapper adds nothing
- **Over-commented obvious code**: Every line has a comment explaining what it does
- **Defensive checks on non-nullable values**: Null checks on values that are guaranteed by the type system
- **Template remnants**: TODO comments with boilerplate text, placeholder error messages ("Something went wrong")

---

## Output

### Per Finding: debt.json Entry

For each finding, append an entry to `.geas/debt.json`:

```json
{
  "id": "debt-<NNN>",
  "title": "[Tech Debt] <short description>",
  "location": "<file:line> (or <file> for file-level issues)",
  "issue": "<what's wrong, in one sentence>",
  "fix": "<suggested approach, in one sentence>",
  "impact": "low | medium | high",
  "created_at": "<ISO 8601 timestamp>"
}
```

**Priority mapping**:
- `high` impact — affects correctness, maintainability of core modules
- `medium` impact — code smell, moderate duplication
- `low` impact — cosmetic, minor inconsistency

**Batching**: Group related findings into a single entry when they share the same root cause. Do not create 20 entries for 20 unnecessary comments in the same file -- create one entry: "[Tech Debt] Remove unnecessary comments in <module>".

### Summary

Print a summary to console:

```
[Forge] Entropy Scan Results

Files scanned: <X>
Issues found: <Y> (<Z> high, <W> medium, <V> low)

Top priorities:
  1. <highest impact finding>
  2. <second highest>
  3. <third highest>

Tech debt items recorded in .geas/debt.json
```

---

## Scan Strategy

### For Small Projects (~50 files)
Read every source file. Full entropy scan.

### For Medium Projects (50-500 files)
Focus on:
- Files changed during the current Sprint/phase (check git log)
- Core modules identified in conventions.md
- Entry points and shared utilities

### For Large Projects (500+)
Focus exclusively on:
- Files created or modified by the team during this run
- Files flagged during code review (check evidence bundles for review feedback)
- Shared utilities and core business logic directories

---

## What NOT to Flag

- **Intentional patterns**: If conventions.md documents a pattern, do not flag it as drift
- **Third-party code**: Do not scan vendored dependencies or generated files
- **Test verbosity**: Tests can be more verbose than production code — this is acceptable
- **Config files**: Do not flag config files for style issues unless they are clearly broken
- **TODOs with issue references**: `// TODO(MY-42): handle pagination` is fine — it links to a tracked issue. Flag only orphaned TODOs with no reference.

---

## Integration

After the entropy scan:
1. Forge reviews the created issues and assigns estimates (1-3 points each, typically)
2. Compass prioritizes them against remaining feature work
3. High-impact issues may get scheduled into the current cycle
4. Low-impact issues stay in backlog for Evolution phase cleanup
