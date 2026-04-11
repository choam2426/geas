# Context Packet for design-authority — task-001

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

## Architecture Context
- CLI uses commander.js with 15 command groups registered in src/cli/src/main.ts
- Schemas are embedded at build time in src/cli/src/lib/schemas-embedded.ts (esbuild inlines JSON imports)
- SCHEMAS registry: Record<string, unknown> with 15 entries (keys like "task-contract", "evidence", etc.)
- DEFS_SCHEMA contains shared $defs (agentType enum, isoUtcTimestamp pattern)
- schema.ts provides validate(), getValidator() using Ajv with allErrors, strict:false, allowUnionTypes
- Output via output.ts: success(data), validationError(schema, errors), fileError(path, op, cause)

## $ref Patterns in Schemas
1. External $ref: "_defs.schema.json#/$defs/agentType" → enum of 15 agent types
2. External $ref: "_defs.schema.json#/$defs/isoUtcTimestamp" → string with ISO pattern
3. Self-ref: "record.schema.json" has "$defs/tierResult" referenced by gate_result.tier_results
4. Conditional: evidence.schema.json uses allOf/if/then for role-based required fields (4 roles: implementer, reviewer, tester, authority)

## Design Brief Decision
- New geas schema command group with template and list subcommands
- Template generation reads from SCHEMAS registry, resolves $refs, generates fill-in JSON
- --role parameter for evidence schema to select role variant

## Scope Surfaces
- src/cli/src/commands/schema.ts (NEW)
- src/cli/src/main.ts (add import + registerSchemaCommands)
- src/cli/src/lib/schema.ts (add template generation helpers)

## Your Task
Review this design and provide a design guide. Focus on: $ref resolution strategy, template placeholder format, how to handle conditional schemas, and integration with existing schema.ts vs separate module.