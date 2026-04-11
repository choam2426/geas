# Context Packet for software-engineer — task-003

## Task
**Title:** envelope 필드 자동 주입
**Goal:** task create, mission write-spec, write-brief, phase write에서 version, artifact_type, producer_type, artifact_id를 자동 주입. status=drafted 강제.

## Acceptance Criteria
1. task create에서 version, artifact_type, producer_type 자동 주입
2. mission write-spec/write-brief에서 자동 주입
3. phase write에서 자동 주입
4. 명시적 값은 유지 (no-clobber)
5. evidence 명령은 변경 없음
6. artifact_id 자동 생성 (tc-{task_id}, spec-{mission_id}, etc.)
7. created_at은 enrichTimestamp()가 단독 소유
8. task create에서 status=drafted 강제

## Design Guide Summary
1. Create src/cli/src/lib/envelope.ts with ENVELOPE_REGISTRY and injectEnvelope()
2. Registry maps artifact type to const values + artifact_id_fn
3. Inject BEFORE validate() so const fields pass validation
4. No-clobber: only set when undefined in input
5. status=drafted enforcement is command-level in task create, not in envelope
6. Evidence excluded from registry (trust boundary)
7. Never touch created_at/updated_at

## artifact_id Rules
- task create: tc-{task_id}
- mission write-spec: spec-{mission_id}
- mission write-brief: brief-{mission_id}
- phase write: phase-{mission_phase}-{timestamp}

## Files to Change
- src/cli/src/lib/envelope.ts (NEW)
- src/cli/src/commands/task.ts (modify create action)
- src/cli/src/commands/mission.ts (modify write-spec, write-brief)
- src/cli/src/commands/phase.ts (modify write action)

## Eval Commands
- cd src/cli && npm run build && npm run bundle