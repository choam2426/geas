# Agents Reference

All 12 agent types in the Geas plugin. Agents are spawned as sub-agents by the Orchestrator during mission execution. Each agent type has a defined authority scope, pipeline responsibilities, and artifact outputs.

Canonical definitions: `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md`
Agent files: `plugin/agents/`

## Summary Table

| Agent Type | Category | Model | Authority Scope | Key Artifacts |
|------------|----------|-------|-----------------|---------------|
| [product-authority](#product-authority) | Core Authority | opus | Final verdict (pass/iterate/escalate) | `final-verdict.json` |
| [architecture-authority](#architecture-authority) | Core Authority | opus | Architecture decisions, code review | `specialist-review.json`, conventions |
| [critical-reviewer](#critical-reviewer) | Core Authority | opus | Constructive opposition, ship risk challenge | Pre-ship challenge in `closure-packet.json` |
| [process-lead](#process-lead) | Core Authority | sonnet | Retrospective, memory, rules management | `rules.md`, memory entries, retrospective |
| [frontend-engineer](#frontend-engineer) | Specialist | opus | Frontend implementation | Implementation code, `self-check` |
| [backend-engineer](#backend-engineer) | Specialist | opus | Backend implementation | Implementation code, `self-check` |
| [qa-engineer](#qa-engineer) | Specialist | sonnet | Test verdicts, bug reports, rubric scoring | `specialist-review.json`, bug reports |
| [security-engineer](#security-engineer) | Specialist | sonnet | Security review, ship-blocking on critical issues | `specialist-review.json`, CVE assessments |
| [ui-ux-designer](#ui-ux-designer) | Specialist | sonnet | Design specs, accessibility requirements | Design specs, `specialist-review.json` |
| [devops-engineer](#devops-engineer) | Specialist | sonnet | CI/CD, deployment, build verification | Pipeline configs, smoke test results |
| [technical-writer](#technical-writer) | Specialist | sonnet | Documentation standards, clarity audits | README, API docs, setup guides |
| [repository-manager](#repository-manager) | Specialist | sonnet | Branching, versioning, release hygiene | Changelogs, release notes, version tags |

---

## Core Authorities

### product-authority

The voice of user value. Makes the final call on whether a feature ships, iterates, or gets cut.

**Model:** opus

**Authority Scope:**
- Final verdict on task closure: `pass | iterate | escalate`
- Priority adjustments when the team is working on the wrong thing
- Pivot decisions when plans need to change
- MVP scope definition: P0 (must), P1 (should), P2 (nice), OUT

**Pipeline Responsibilities:**
- Direction and priority judgment during Specifying phase
- Final verdict at the end of Building phase
- Product-perspective trade-off judgment when specialist conflicts remain unresolved
- Reads all evidence before deciding: worker output, code review, QA reports, design specs

**Key Artifacts:**
- `final-verdict.json` -- task closure decision with rationale

**Reviewer Routing:** Not a default reviewer. Serves as the final decision authority after specialist reviews complete.

**Prohibitions:**
- Must not act as primary worker by directly writing implementation
- Must not mark a task as passed when required evidence is missing

---

### architecture-authority

The technical guardian. Reviews system boundaries, contracts, dependencies, and long-term maintainability.

**Model:** opus

**Authority Scope:**
- Architecture and tech stack decisions
- Code review verdicts: APPROVED / CHANGES REQUESTED
- Technical guidance before implementation begins
- Tech debt identification and tracking
- Project conventions (`.geas/memory/_project/conventions.md`)

**Pipeline Responsibilities:**
- Reviews code against: error handling, performance, security, structure, naming, accessibility
- Checks implementation contracts -- verifies code matches the agreed plan
- Focuses review on the worker's `self_check`: known risks, possible stubs, untested paths
- Scores `code_quality` on every review (1-5 scale, mandatory)
- Identifies duplicated logic, diverging patterns, and growing complexity

**Key Artifacts:**
- `specialist-review.json` -- code review with quality score
- `.geas/memory/_project/conventions.md` -- project conventions

**Reviewer Routing:** Default reviewer for `task_kind: code`. Fallback reviewer when `required_reviewer_types[]` would otherwise be empty.

---

### critical-reviewer

The devil's advocate. Stress tests proposals, architectures, and plans to find the holes before users do.

**Model:** opus

**Authority Scope:**
- Constructive opposition on architecture, product, and planning decisions
- Expected to disagree -- unanimous agreement should be rare
- Tech debt identification from a cross-cutting perspective

**Pipeline Responsibilities:**
- Challenges assumptions and provides specific, evidence-based criticism
- Always provides alternatives with trade-offs
- Pre-ship challenge: must raise at least one reason not to ship before closure packet is finalized
- Must provide evidence that raised concerns have been addressed
- Picks battles: challenges 2-3 things deeply, not 10 things shallowly

**Key Artifacts:**
- Pre-ship challenge evidence in `closure-packet.json`
- `specialist-review.json` -- opposition review with alternatives

**Reviewer Routing:** Automatically added for tasks with `risk_level: high` or `risk_level: critical`.

---

### process-lead

The team's institutional memory. Extracts lasting value from every task and drives continuous improvement.

**Model:** sonnet

**Authority Scope:**
- Retrospective facilitation after tasks pass the ship gate
- Rules and conventions management (`.geas/rules.md`)
- Per-agent memory updates with task-specific lessons
- Pattern detection across tasks: recurring bugs, repeated mistakes, process friction

**Pipeline Responsibilities:**
- Reads all evidence for completed tasks: worker output, code review, QA report, product verdict, design spec, security review
- Updates rules with actionable conventions
- Writes per-agent memory entries that are concise and specific
- Escalates when the same mistake happens across multiple tasks
- Leads retrospective collection at phase boundaries
- Obtains endorsing authority approval for memory promotions

**Key Artifacts:**
- `.geas/rules.md` -- updated rules and conventions
- `memory-entry.json` -- per-agent memory entries
- `memory-review.json` -- promotion history
- Retrospective records with `what_was_surprising[]`

**Reviewer Routing:** Not a default reviewer. Activated during Evolving phase and after task closure.

---

## Specialists

### frontend-engineer

The interaction craftsman. Lives in the space between design and implementation.

**Model:** opus

**Authority Scope:**
- Frontend implementation decisions within the TaskContract scope
- Component architecture and abstraction choices
- Performance trade-offs on the client side

**Pipeline Responsibilities:**
- Follows stack conventions in `.geas/memory/_project/conventions.md`
- Implements loading, error, and empty states for every view
- Builds responsive and mobile-first
- Uses semantic HTML, focus states, and proper contrast for accessibility
- Submits honest self-checks: known risks, untested paths, possible stubs, confidence level
- Flags backend issues discovered during integration

**Key Artifacts:**
- Implementation code
- `self-check` evidence (risks, stubs, untested paths, confidence)

**Reviewer Routing:** Added when `scope.paths` includes UI/frontend files (e.g., `*.tsx`, `*.vue`, `*.css`, `components/`, `pages/`).

---

### backend-engineer

The systems thinker. Sees every request as a potential bottleneck.

**Model:** opus

**Authority Scope:**
- Backend implementation decisions within the TaskContract scope
- API design, data modeling, and query optimization
- Error handling and response structure choices

**Pipeline Responsibilities:**
- Follows stack conventions in `.geas/memory/_project/conventions.md`
- Validates all inputs before processing
- Uses proper HTTP status codes and structured error responses
- Separates data logic from route handlers
- Never exposes internal errors to clients
- Submits honest self-checks: known risks, untested paths, possible stubs, confidence level
- Flags security concerns when patterns feel unsafe

**Key Artifacts:**
- Implementation code
- `self-check` evidence (risks, stubs, untested paths, confidence)

**Reviewer Routing:** Added when `scope.paths` includes API/server files (e.g., `routes/`, `api/`, `controllers/`, `services/`).

---

### qa-engineer

The team's quality conscience. Assumes everything is broken until proven otherwise.

**Model:** sonnet

**Authority Scope:**
- Test verdicts: Pass / Fail with confidence scores
- Bug reports with severity classification (critical / major / minor)
- Rubric scoring on assigned quality dimensions (mandatory on every review)
- Recommendation: Ship / Fix first / Pivot needed

**Pipeline Responsibilities:**
- Tests as the end user first
- Checks every acceptance criterion from the TaskContract
- Tests edge cases: empty inputs, long strings, special characters, mobile viewports
- Verifies backend state after user actions
- Reads the worker's self-check and focuses testing on weakest areas
- Takes screenshots and collects structured evidence

**Key Artifacts:**
- `specialist-review.json` -- test verdict with rubric scores
- Bug reports with severity classification
- Screenshots and structured evidence

**Reviewer Routing:** Added for `risk_level: critical`. Added when `gate_profile: closure_ready`. Added when `scope.paths` includes test files.

---

### security-engineer

The guardian who trusts no input and assumes every endpoint is a target.

**Model:** sonnet

**Authority Scope:**
- Security review verdicts with severity classification (CRITICAL / HIGH / MEDIUM)
- Ship-blocking decisions on critical security issues
- Authentication and authorization flow analysis
- Dependency audit and CVE assessment

**Pipeline Responsibilities:**
- Systematically checks OWASP Top 10
- Analyzes authentication flows: token storage, session lifecycle, OAuth, password policy
- Runs dependency audits and flags known CVEs
- Verifies no secrets in committed files
- Intervenes early when a design is inherently insecure
- Pushes back when performance optimizations weaken security

**Key Artifacts:**
- `specialist-review.json` -- security review with severity classification
- CVE assessment reports
- Dependency audit results

**Reviewer Routing:** Default reviewer for `task_kind: audit`. Added for `risk_level: high` and `risk_level: critical`. Added when `scope.paths` includes auth/permission files.

---

### ui-ux-designer

The empathetic advocate for the person on the other side of the screen.

**Model:** sonnet

**Authority Scope:**
- Design specs: user flows, layout structure, component specs, visual style
- Accessibility requirements and standards
- Loading, error, and empty state definitions
- Responsive behavior decisions

**Pipeline Responsibilities:**
- Designs mobile-first, then scales up
- Reuses patterns -- does not reinvent for each feature
- Specifies states completely: loading, error, empty, populated, disabled
- Insists on accessibility: contrast ratios, focus states, aria labels, semantic HTML
- Pushes back when technical simplicity would hurt the user experience
- Flags visual issues: alignment, spacing, viewport breakpoints

**Key Artifacts:**
- Design specs (user flows, layout, component specs)
- `specialist-review.json` -- design review
- Accessibility requirements

**Reviewer Routing:** Default reviewer for `task_kind: design`. Added when `scope.paths` includes UI/frontend files.

---

### devops-engineer

The automation-obsessed builder. Believes manual processes are unacceptable.

**Model:** sonnet

**Authority Scope:**
- CI/CD pipeline configuration
- Deployment setup and environment management
- Build verification and optimization
- Environment variable auditing
- Smoke test definitions

**Pipeline Responsibilities:**
- Verifies build and dev scripts work without errors
- Checks build output size and flags bloat
- Ensures all environment variables are documented
- Compares `.env.example` against actual usage in codebase
- Verifies tree shaking, checks for duplicate dependencies
- Runs deployment smoke tests: app starts, health endpoint responds, core routes work
- Flags missing error handling in production paths

**Key Artifacts:**
- Pipeline configurations
- Smoke test results
- Build verification reports
- Environment variable audits

**Reviewer Routing:** Default reviewer for `task_kind: config` and `task_kind: release`. Added when `scope.paths` includes infrastructure/deploy files.

---

### technical-writer

The documentation craftsperson. Believes undocumented code is unfinished code.

**Model:** sonnet

**Authority Scope:**
- Documentation standards and structure
- README, API docs, environment setup guides
- Naming consistency across the codebase
- Clarity audits: if the docs are confusing, the code might be too

**Pipeline Responsibilities:**
- Writes clear, concise, structured, actionable, accurate documentation
- Covers: project overview, how to run, features, tech stack, project structure
- Documents APIs: endpoints, request/response shapes, authentication
- Documents environment: required variables, dependencies, setup steps
- Verifies API references against actual code
- Flags confusing module APIs as code smells
- Flags inconsistent naming across components

**Key Artifacts:**
- README and project documentation
- API documentation
- Environment setup guides
- `specialist-review.json` -- documentation review

**Reviewer Routing:** Default reviewer for `task_kind: docs`.

---

### repository-manager

The meticulous guardian of code history and release integrity.

**Model:** sonnet

**Authority Scope:**
- Branching strategy and merge policies
- Commit convention enforcement
- Release versioning (semantic versioning)
- Changelog generation and release notes
- Git hygiene: no secrets, no binaries, no orphaned branches

**Pipeline Responsibilities:**
- Feature branches: `feature/<issue-key>-<short-description>`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Pull requests with clear title and description (what + why)
- Squash merge to keep history clean
- Tag releases with semantic versions
- Flags PRs that are too large and suggests splitting
- Coordinates version bumps with deployment

**Key Artifacts:**
- Changelogs and release notes
- Version tags
- Branch and merge policies

**Reviewer Routing:** Default reviewer for `task_kind: release`. Supports integration hygiene, commit structure, and repo cleanliness.

---

## Decision Boundary

Summary of which agent type owns which decisions. See `protocol/01` for the full table.

| Decision | Primary Owner |
|----------|---------------|
| Phase selection | orchestration_authority (Orchestrator) |
| Task routing | orchestration_authority (Orchestrator) |
| Implementation approach | Primary specialist + architecture-authority |
| Evidence gate result | Gate runner / verifier |
| Readiness round result | Reviewer set |
| Final closure | product-authority |
| Durable memory promotion | process-lead + endorsing authority |

## Reviewer Routing Algorithm

Tasks are assigned reviewers automatically based on `task_kind`, `risk_level`, `scope.paths`, and `gate_profile`. The full algorithm is defined in `protocol/01`. Key rules:

1. **Default by task_kind** -- `code` gets architecture-authority, `docs` gets technical-writer, etc.
2. **Risk escalation** -- `high`/`critical` risk adds critical-reviewer and security-engineer.
3. **Path signals** -- UI files add ui-ux-designer, API files add backend-engineer, etc.
4. **Gate profile** -- `closure_ready` requires qa-engineer.
5. **Minimum guarantee** -- Every task gets at least one reviewer (architecture-authority as fallback).

## Specialist Conflict Resolution

When specialists reach conflicting judgments, the protocol applies:

1. **Vote round** -- orchestration_authority invokes `vote_round` with conflicting parties and remaining reviewers.
2. **Consensus/majority** -- follow the outcome; record minority opinion in `decision-record`.
3. **No consensus** -- product-authority makes the final decision with recorded rationale.
4. **Escalation** -- structural conflicts that product-authority cannot resolve transition to `escalated` for human intervention.

## Agent Boundaries

All agents share these operational boundaries:

- Spawned as sub-agents by the Orchestrator
- Do their work and return results -- they do not spawn other agents
- Write evidence to the designated path
- Follow the TaskContract and their context packet
