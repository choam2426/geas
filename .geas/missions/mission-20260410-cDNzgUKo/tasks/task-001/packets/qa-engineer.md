# Test Context for qa-engineer — task-001

## Task
geas schema 명령 그룹 구현 (template, list)

## Acceptance Criteria
1. geas schema list outputs all 15 schema type names as JSON array
2. geas schema template <type> outputs fill-in JSON template with required fields
3. $ref references resolved to actual types/enum values
4. record.schema.json self-ref $defs/tierResult handled correctly
5. evidence.schema.json conditional schemas handled with --role parameter
6. Non-existent schema type produces error with available types list

## Eval Commands
- cd src/cli && npm run build
- node plugin/bin/geas schema list
- node plugin/bin/geas schema template task-contract

## Files to Review
- src/cli/src/lib/schema-template.ts
- src/cli/src/commands/schema.ts
- src/cli/src/main.ts

## Test Focus
Run the eval commands. Test all schema types with template command. Test evidence with all 4 roles. Test error cases (invalid type, invalid role). Verify output format is JSON via success().