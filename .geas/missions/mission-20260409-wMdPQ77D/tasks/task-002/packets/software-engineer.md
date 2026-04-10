Task: [T4a] Schema enums + agent YAML name to hyphens

## Goal
Change all agentType enum values from underscores to hyphens across the entire codebase.

## Scope
1. docs/protocol/schemas/_defs.schema.json — agentType enum values underscore->hyphen
2. All 14 agent YAML files in plugin/agents/ — name field underscore->hyphen
3. plugin/skills/mission/references/profiles.json — slot_mapping values underscore->hyphen
4. plugin/cli/src/ — any hardcoded agent type literals
5. plugin/cli/test/integration.js — test literals

## Pattern
Old: product_authority, software_engineer, qa_engineer, etc.
New: product-authority, software-engineer, qa-engineer, etc.

## Constraints
- BOTH schema copies must match (docs/protocol/schemas/ and plugin/cli/schemas/ via build)
- Integration tests must pass after changes
- Agent personality content in agent files must NOT change — only the YAML name field

## Acceptance Criteria
1. docs/protocol/schemas/_defs.schema.json agentType enum uses hyphens
2. plugin/cli/schemas/_defs.schema.json matches after build
3. All inline schema enums updated
4. All 14 agent YAML name fields use hyphens  
5. profiles.json values use hyphens
6. CLI hardcoded literals updated
7. Integration test literals updated
8. Zero grep hits for underscore agent types in plugin/ and docs/protocol/schemas/
9. npm run typecheck passes
10. node test/integration.js passes