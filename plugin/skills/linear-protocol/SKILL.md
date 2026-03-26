---
name: linear-protocol
description: Startup-specific conventions for using Linear — labels, comment format, workflow rules
---

# Linear Communication Rules

Use the Linear-Agent-Skills plugin CLI for all Linear operations.
IDs are discovered dynamically at startup — see Compass bootstrap step.

## Labels — When to Use What

**Type labels**:
| Label | Use for |
|-------|---------|
| feature | New functionality being built |
| bug | Something broken that needs fixing |
| design-spec | UI/UX specifications from Palette |
| architecture | Technical decisions from Forge |
| review | Work that needs review from another agent |
| pivot | Strategic direction change decided by Nova |
| blocked | Cannot proceed without resolution |
| tech-debt | Code quality or refactoring work |
| improvement | Enhancement to existing feature |

**Area labels**:
| Label | Use for |
|-------|---------|
| frontend | UI/client-side work |
| backend | API/server-side work |
| infra | DevOps, CI/CD, deployment |

**Role labels**:
| Label | Use for |
|-------|---------|
| needs-review | Awaiting code review from Forge |
| needs-qa | Awaiting QA from Sentinel |

## Comment Format

Always prefix comments with your agent codename:
```
[Compass] Moving this to In Progress. Pixel will handle frontend.
[Sentinel] Found edge case: empty form submission crashes the app.
[Nova] Pivoting: drop real-time charts, use static summary cards instead.
```

## Issue Title Format

```
[Label] Short description
```

Examples:
- `[Feature] User authentication with email/password`
- `[Bug] Dashboard chart overlaps on mobile`
- `[architecture] Choose database: SQLite vs Supabase`

## Priority

- **1 (Urgent)**: Blocks all other work
- **2 (High)**: Core MVP feature
- **3 (Normal)**: Important but not blocking
- **4 (Low)**: Nice to have

## Workflow

**Backlog → Todo → Waiting → In Progress → In Review → Testing → Done**

- **Backlog**: identified, not yet planned
- **Todo**: planned for current cycle
- **Waiting**: blocked on another agent or dependency (use with Relations)
- **In Progress**: agent actively working on it
- **In Review**: code review by Forge, or spec review by Compass
- **Testing**: Sentinel running Playwright E2E tests
- **Done**: reviewed, tested, accepted

## Sub-Issues

Break a feature into sub-issues when:
- Frontend + Backend work in parallel
- 3+ agents involved in one feature
- Design/implement/test phases are clearly separable

**Don't use sub-issues** for:
- Single-agent work (API-only, simple UI change)
- Bug fixes

**Structure**:
```
Parent: [Feature] User authentication
  ├─ Sub: [Design] Auth flow wireframe (Palette)
  ├─ Sub: [Backend] Auth API endpoints (Circuit)
  ├─ Sub: [Frontend] Auth form components (Pixel)
  └─ Sub: [QA] Auth E2E tests (Sentinel) — created after impl
```

Create with: `create-issue --title "..." --team-id UUID --parent-id <PARENT_UUID>`

## Relations

Track dependencies between issues:

| Type | Meaning | Example |
|------|---------|---------|
| `blocks` | This issue blocks the related issue | Backend API blocks Frontend UI |
| `blocked_by` | This issue is blocked by the related issue | Frontend UI is blocked_by Backend API |
| `related` | Issues are related but not dependent | Design spec is related to architecture decision |
| `duplicate` | Same issue filed twice | |

Create with: `create-issue-relation --issue-id UUID --related-issue-id UUID --type blocks`

When an issue is blocked, move it to **Waiting** status until the blocker resolves.

## Documents

Use Linear Documents for **project-level artifacts** that outlive individual issues:

| Document | When | Author |
|----------|------|--------|
| PRD | Genesis phase, after Nova's vision | Compass |
| Architecture Decision | Genesis, after Forge proposes + Vote Round | Compass |
| Phase Summary (Genesis) | After Phase 1 completes | Compass |
| Phase Summary (MVP) | After Phase 2 completes | Compass |
| Phase Summary (Polish) | After Phase 3 completes | Compass |

Create with: `create-document --title "..." --content "..." --project-id UUID`

**Keep as comments** (not documents): per-feature design specs, code review feedback, QA reports, vote results.

## Milestones

Map project milestones to execution phases:

| Milestone | Phase | Criteria |
|-----------|-------|----------|
| Genesis | Phase 1 | Vision set, architecture decided, backlog created |
| MVP | Phase 2 | Core features shipped and Nova-approved |
| Polish | Phase 3 | Deployed, security reviewed, documented |
| Evolution | Phase 4 | Refined, bugs fixed, within scope |

Create with: `save-milestone --input '{"name":"MVP","projectId":"UUID"}'`

## Estimates

Use Fibonacci scale (1, 2, 3, 5, 8, 13) for story points:

| Points | Meaning | Example |
|--------|---------|---------|
| 1-2 | Trivial | Config change, copy fix |
| 3 | Small | Design spec, simple form |
| 5 | Medium | CRUD API, auth flow |
| 8 | Large | Dashboard with charts, real-time feature |
| 13 | Very large | Complex state management, multi-service integration |

Add with: `create-issue --title "..." --team-id UUID --estimate 5`

Parent issue estimate = sum of sub-issue estimates.
