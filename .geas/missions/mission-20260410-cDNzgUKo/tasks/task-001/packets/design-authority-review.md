# Review Context for design-authority — task-001

## Task
geas schema 명령 그룹 구현 (template, list)

## Files Changed
- src/cli/src/lib/schema-template.ts (NEW — 217 lines)
- src/cli/src/commands/schema.ts (NEW — 37 lines)
- src/cli/src/main.ts (modified — added import + register)

## Design Guide Decisions to Verify
1. Separate schema-template.ts (not in schema.ts) — NO Ajv imports
2. Recursive single-pass $ref resolution with depth guard at 10
3. Required-only fields at every nesting level
4. Placeholder format: const->value, enum->first, string->"<string>", int->0/min
5. --role for evidence conditional schemas (allOf/if/then merge)
6. oneOf -> first variant

## Self-Check Summary
Confidence: 4/5. All 9 verification scenarios pass. Known risks: tsc-only build in eval_commands, record template minimal output.

## Review Focus
Read the implementation files and verify they follow the design guide. Check code quality, edge case handling, and correctness of $ref resolution logic.