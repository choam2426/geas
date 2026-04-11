# Context Packet for software-engineer — task-002

## Task
**Title:** 검증 에러 메시지에 스키마 힌트 추가
**Goal:** validationError() 함수를 개선하여 검증 실패 시 에러 메시지에 올바른 필드명, 허용 enum 값, 필수/선택 여부를 포함시킨다.

## Acceptance Criteria
1. VALIDATION_ERROR 응답에 해당 스키마의 required 필드 목록이 포함된다
2. enum 위반 시 허용되는 값 목록이 에러에 포함된다
3. additionalProperties 위반 시 허용되는 필드명 목록이 에러에 포함된다
4. missing required property 에러 시 해당 필드의 타입과 설명이 포함된다
5. 기존 에러 구조(error, code, schema, details)는 유지되며 hints 필드가 추가된다

## Architecture Context
- output.ts의 validationError(schemaName, errors) 함수가 현재 에러를 출력
- schema.ts에서 validate(schemaName, data) 호출 후 errors를 전달
- SCHEMAS[schemaName]에서 스키마 원본에 접근 가능
- Ajv allErrors:true 설정이므로 모든 에러가 반환됨
- Ajv 에러 객체: {keyword, instancePath, schemaPath, params, message}

## Current validationError output format
```json
{
  "error": "Validation failed against schema task-contract",
  "code": "VALIDATION_ERROR",
  "schema": "task-contract",
  "details": [/* Ajv error objects */]
}
```

## Design Decision
기존 에러 구조를 유지하면서 hints 필드를 추가. hints는 스키마에서 추출한 보조 정보.

## Scope Surfaces
- src/cli/src/lib/output.ts (modify validationError)
- src/cli/src/lib/schema.ts (may need to pass schema info)