# Context Packet for software-engineer — task-004

## Task
**Title:** 스킬 인라인 스키마 정리 + 회귀 테스트
**Goal:** 스킬에서 인라인 스키마 템플릿/필드 설명을 확인하고, CLI template 명령 호출 안내로 대체한다. 이전 세션 실패 패턴을 기반으로 회귀 테스트를 작성한다.

## Acceptance Criteria
1. 스킬에서 인라인 스키마 필드 설명이 제거되고 geas schema template 호출 안내로 대체
2. 이전 세션 실패 패턴(잘못된 필드명, enum 값, 누락 필드)을 커버하는 테스트 작성
3. 빌드 후 전체 테스트가 통과
4. envelope 자동 주입이 적용된 상태에서 기존 스킬의 CLI 호출 예시가 호환

## Files with Inline Schemas (7 files)
1. plugin/skills/intake/SKILL.md — tells agents to include version, artifact_type, artifact_id, producer_type
2. plugin/skills/task-compiler/SKILL.md — has example with full envelope fields
3. plugin/skills/task-compiler/references/examples.md — has examples with full envelope
4. plugin/skills/evidence-gate/SKILL.md — has inline gate_result template
5. plugin/skills/verify-fix-loop/SKILL.md — has decision record template
6. plugin/skills/mission/references/specifying.md — has phase review template
7. plugin/skills/mission/references/evolving.md — has phase review template

## What to Do in Skills
For each skill with inline schema templates:
- Where it tells agents to manually include envelope fields (version, artifact_type, artifact_id, producer_type), add a note that these are auto-injected by CLI
- Remove the requirement for agents to manually provide these fields
- Add a reference: "Run geas schema template <type> for the full template"
- Keep examples that show the content fields (goal, title, etc.) — only remove/update the envelope fields
- Do NOT remove examples entirely — update them to show only the fields agents need to provide

## What to Do for Tests
Create src/cli/test/ directory and write tests for:
1. schema template generation (all schema types)
2. envelope auto-injection (no-clobber, status=drafted)
3. validation error hints (required fields, enum hints, additionalProperties hints)

## Eval Commands
- cd src/cli && npm run build && npm test

## Scope Surfaces
- plugin/skills/ (7 files)
- src/cli/test/