# Context Packet for design-authority — task-003

## Task
**Title:** envelope 필드 자동 주입
**Goal:** task create, mission write-spec, mission write-brief, phase write 등 주요 CLI 명령에서 version, artifact_type, producer_type 등 const 필드와 artifact_id를 자동 생성하여, 에이전트가 반복적 메타데이터를 전달하지 않아도 되게 한다.

## Risk Level: HIGH

## Acceptance Criteria
1. task create에서 version, artifact_type, producer_type가 자동 주입되어 에이전트가 생략 가능
2. mission write-spec/write-brief에서 동일하게 자동 주입
3. phase write에서 동일하게 자동 주입
4. 에이전트가 명시적으로 전달한 값은 유지 (하위 호환)
5. evidence 명령의 기존 force-overwrite 패턴은 변경하지 않음 (trust boundary 유지)
6. artifact_id는 명령별 규칙으로 자동 생성 (예: tc-{task_id}, spec-{mission_id})
7. created_at은 enrichTimestamp()가 단독 소유하며 envelope에서 주입하지 않음
8. geas task create에서 status 필드가 없거나 drafted 외의 값이면 drafted로 강제 설정

## Architecture Context

### Current command flow (e.g., task create):
1. readInputData() parses JSON from --data/--file
2. validate(schema, data) checks against schema
3. writeJsonFile() calls enrichTimestamp() (adds created_at/updated_at)
4. writeJsonFile() writes atomically, then runs post-write checks

### Schemas with const fields:
- task-contract.schema.json: version (const "1.0"), artifact_type (const "task_contract")
- mission-spec.schema.json: needs checking
- design-brief.schema.json: needs checking
- phase-review.schema.json: needs checking
- evidence.schema.json: version (const "1.0") — DO NOT auto-inject (trust boundary)

### Key constraint: enrichTimestamp() already owns created_at
enrichTimestamp() in post-write-checks.ts injects created_at when missing and updated_at on updates. Envelope injection must NOT touch created_at.

### Trust boundary
evidence commands force-overwrite certain fields (agent, task_id, role) from CLI flags. This trust model must not change.

## Your Task
Provide a design guide for where to put the envelope injection logic:
1. Should it be a shared helper or per-command inline?
2. When should it run (before validation, after validation, or custom)?
3. How to handle the artifact_id generation per command?
4. How to enforce status=drafted on task create?
5. How to make this backward-compatible (if agent sends all fields, everything still works)?