# Context Packet for software-engineer — task-001

## Task
**Title:** geas schema 명령 그룹 구현 (template, list)
**Goal:** geas schema template <type> 명령으로 모든 스키마 타입에 대한 fill-in JSON 템플릿을 생성하고, geas schema list로 사용 가능한 스키마 목록을 출력하는 명령 그룹을 구현한다.

## Acceptance Criteria
1. geas schema list가 모든 16개 스키마 타입 이름을 JSON 배열로 출력
2. geas schema template <type>이 각 스키마에 대해 required 필드가 채워진 유효한 JSON 템플릿 출력
3. $ref 참조(_defs.schema.json의 agentType, isoUtcTimestamp)가 실제 타입/enum 값으로 치환
4. record.schema.json의 자기참조 $defs/tierResult가 정상 처리
5. evidence.schema.json의 조건부 스키마는 --role 파라미터로 해당 variant 템플릿 생성
6. 존재하지 않는 스키마 타입 요청 시 사용 가능한 타입 목록과 함께 에러 반환

## Eval Commands
- cd src/cli && npm run build
- node plugin/bin/geas schema list
- node plugin/bin/geas schema template task-contract

## Design Guide (from design-authority)
1. **$ref Resolution**: Single-pass recursive walk via resolveSchema(node, rootSchema, defsSchema, depth). External refs: look up DEFS_SCHEMA.$defs[X]. Self-refs: look up rootSchema.$defs[X]. Max depth 10.
2. **Placeholder Format**: const -> const value, enum -> first value, string -> "<string>", isoUtcTimestamp -> "<iso-utc-timestamp>", integer -> 0 (or minimum), boolean -> false, array minItems>=1 -> one item, array minItems 0 -> [], object -> recurse
3. **Required Only**: Only include required fields at every nesting level. Optional fields omitted.
4. **Conditional Schemas**: --role parameter for evidence. Merge base required with role-specific then.required from matching allOf/if/then.
5. **Module Placement**: NEW src/cli/src/lib/schema-template.ts for template logic (separate from Ajv validation in schema.ts). NEW src/cli/src/commands/schema.ts for command registration.
6. **Edge Cases**: oneOf -> first variant. additionalProperties with type -> {}. type array -> null.

## Architecture Context
- CLI: commander.js, 15 command groups in main.ts
- Schemas embedded at build time in schemas-embedded.ts via esbuild JSON imports
- SCHEMAS: Record<string, unknown> with 15 entries
- DEFS_SCHEMA: shared definitions (_defs.schema.json)
- Output: success(data), validationError(schema, errors), fileError(path, op, cause)
- Existing command pattern: see src/cli/src/commands/task.ts for reference

## Scope Surfaces
- src/cli/src/commands/schema.ts (NEW)
- src/cli/src/main.ts (add import + register call)
- src/cli/src/lib/schema-template.ts (NEW)