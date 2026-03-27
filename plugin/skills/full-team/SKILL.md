---
name: full-team
description: Start a new product with the full Geas team — Genesis, MVP Build, Polish, Evolution.
user-invocable: true
---

# Full Team Mode

4 phases: Genesis → MVP Build → Polish → Evolution.

---

## Phase 1: Genesis

### 1.1 Seed Check
- `.geas/spec/seed.json` should exist from intake. If not, invoke `/geas:intake`.
- If readiness_score < 60 and no override: ask the user, re-run intake.

### 1.2 Linear Bootstrap (if enabled)
- Check `.geas/config.json` for `linear_enabled`.
- If enabled: create project, milestones (Genesis, MVP, Polish, Evolution), discover IDs.
- Save to `.geas/memory/_project/linear-config.json`.
- **Update `.geas/rules.md`**: Linear 섹션의 enabled를 true로, linear-cli 경로와 팀/프로젝트 ID를 실제 값으로 채움.

### 1.3 Vision (Nova)
```
Agent(agent: "nova", prompt: "Read .geas/rules.md first. Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/genesis/nova.json")
```
Verify `.geas/evidence/genesis/nova.json` exists.

### 1.4 Architecture (Forge)
```
Agent(agent: "forge", prompt: "Read .geas/rules.md first. Then read .geas/spec/seed.json and .geas/evidence/genesis/nova.json. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/genesis/forge.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

### 1.5 Vote Round
```
Agent(agent: "circuit", prompt: "Read .geas/rules.md first. Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-circuit.json")
Agent(agent: "palette", prompt: "Read .geas/rules.md first. Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-palette.json")
```
If any disagree: run debate, then re-vote.

### 1.6 Compile TaskContracts
- Create 5-10 granular tasks. For each, invoke `/geas:task-compiler`.
- If Linear enabled: create issues, store IDs in TaskContracts.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 1.7 MCP 서버 추천

Forge의 아키텍처 결정에서 기술 스택을 분석하고, 도움이 될 MCP 서버를 사용자에게 추천한다.

| 감지 | 추천 MCP | 설치 명령 | 이유 |
|------|---------|----------|------|
| PostgreSQL | PostgreSQL MCP | `claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>` | Vault가 스키마 직접 조회 |
| MongoDB | MongoDB MCP | `claude mcp add mongodb -- npx -y mongodb-mcp-server --readOnly` | Vault가 컬렉션 탐색 |
| 웹 프론트엔드 | MDN MCP | `claude mcp add --transport http mdn https://mcp.mdn.mozilla.net/` | Pixel이 웹 표준 참조 |
| 배포 대상 있음 | Lighthouse MCP | `claude mcp add lighthouse -- npx -y @anthropic/lighthouse-mcp` | Lens가 성능/접근성 감사 |
| GitHub 호스팅 | GitHub MCP | `claude mcp add --transport http github https://mcp.github.com/anthropic` | Keeper가 PR/이슈 관리 |

추천 형식:
```
프로젝트 기술 스택에 맞는 MCP 서버를 추천합니다:
- [PostgreSQL MCP] → Vault가 DB 스키마를 직접 조회할 수 있습니다
  설치: claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>

연결하시겠습니까? (선택 사항, 없어도 진행 가능)
```

사용자가 연결하면 `.geas/config.json`의 `connected_mcp` 필드에 기록.

### 1.8 Close Genesis
- Update run state: `{ "phase": "mvp", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "genesis", "timestamp": "<actual>"}`

---

## Phase 2: MVP Build

**EVERY task gets the full pipeline. Do NOT batch-ship. Do NOT skip steps for later tasks.
Even if all tests pass, Code Review (Forge) and Testing (Sentinel) are MANDATORY for EVERY task — not just the first one.
Process each task completely before starting the next.**

For **each** TaskContract in `.geas/tasks/` (ordered by dependencies):

### 2.0 Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- Update status to `"in_progress"`. Log `task_started` event.

### 2.1 Design (Palette) [DEFAULT — skip-if: 사용자 인터페이스가 전혀 없는 태스크 (DB, API, CI, Docker 등)]
**프론트엔드 페이지, 폼, 대시보드 등 사용자가 보는 화면이 있으면 반드시 실행할 것.**
Generate ContextPacket, then:
```
Agent(agent: "palette", prompt: "Read .geas/rules.md first. Read .geas/packets/{task-id}/palette.md. Write design spec to .geas/evidence/{task-id}/palette.json")
```
Verify `.geas/evidence/{task-id}/palette.json` exists.

### 2.2 Tech Guide (Forge) [DEFAULT — skip-if: trivial task (config, version bump)]
Generate ContextPacket, then:
```
Agent(agent: "forge", prompt: "Read .geas/rules.md first. Read .geas/packets/{task-id}/forge.md. Write tech guide to .geas/evidence/{task-id}/forge.json")
```
Verify `.geas/evidence/{task-id}/forge.json` exists.

### 2.3 Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/rules.md first. Read .geas/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence exists. Merge worktree branch.

### 2.4 Code Review (Forge) [MANDATORY]
Generate ContextPacket, then:
```
Agent(agent: "forge", prompt: "Read .geas/rules.md first. Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify `.geas/evidence/{task-id}/forge-review.json` exists.

### 2.5 Testing (Sentinel) [MANDATORY]
Generate ContextPacket, then:
```
Agent(agent: "sentinel", prompt: "Read .geas/rules.md first. Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```
Verify `.geas/evidence/{task-id}/sentinel.json` exists.

### 2.6 Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence.
Log detailed result with tier breakdown.
If fail → invoke `/geas:verify-fix-loop`. After fix, re-run gate.

### 2.7 Nova Product Review [MANDATORY]
```
Agent(agent: "nova", prompt: "Read .geas/rules.md first. Read all evidence at .geas/evidence/{task-id}/. Verdict: Ship, Iterate, or Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

### 2.8 Ship Gate — verify before marking passed
**Before marking any task as "passed", verify:**
- `.geas/evidence/{task-id}/forge-review.json` exists (Read it)
- `.geas/evidence/{task-id}/sentinel.json` exists (Read it)
- `.geas/evidence/{task-id}/nova-verdict.json` exists (Read it)
**If ANY is missing: go back and execute the missing step. Do NOT proceed without all three.**

### Rules Update
After task completion, check evidence for `suggested_rules` and merge into `.geas/rules.md`. Also add any project-specific conventions discovered during this task (patterns, constraints, naming).

### 2.9 Resolve
- **Ship**: status → `"passed"`.
- **Iterate**: re-dispatch with Nova's feedback.
- **Cut**: status → `"failed"`. Write DecisionRecord.

### Close Phase 2
Log: `{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}`

---

## Phase 3: Polish [MANDATORY — do not skip]

```
Agent(agent: "shield", prompt: "Read .geas/rules.md first. Security review of the project. Write to .geas/evidence/polish/shield.json")
```
Verify `.geas/evidence/polish/shield.json` exists.

```
Agent(agent: "scroll", prompt: "Read .geas/rules.md first. Write README and docs. Write to .geas/evidence/polish/scroll.json")
```
Verify `.geas/evidence/polish/scroll.json` exists.

Fix issues found. Log phase complete.

---

## Phase 4: Scoped Evolution [MANDATORY — do not skip]

Assess remaining work within seed's `scope_in`. Reject `scope_out` features.
Spawn agents as needed for improvements.

**Nova 최종 브리핑은 반드시 실행:**
```
Agent(agent: "nova", prompt: "Read .geas/rules.md first. Final product review. Read all evidence. Deliver strategic summary and recommendations. Write to .geas/evidence/evolution/nova-final.json")
```

Close out. Log: `{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}`
