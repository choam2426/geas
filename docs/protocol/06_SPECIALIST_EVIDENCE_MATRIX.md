# 06. Specialist Evidence Matrix

## Principle

The protocol does not end at "who must participate." It must also define **what type of participation produces what artifact, and how it is included in the closure packet.**

## Common Specialist Review Artifact

All specialist reviews follow this common format:
- `artifact_type = specialist_review`
- `reviewer_type`
- `review_target`: identifier of the review subject (task_id or artifact path)
- `status`: `approved | changes_requested | blocked` (see doc 05 Closure Packet)
- `summary`
- `blocking_concerns[]`: empty array means no blocking issues. Each item has the structure `{ concern, severity, resolved }`
- `recommended_reentry`: recommended re-entry point on rewind. `null` if there are no blocking concerns
- `debt_flags[]` (optional): discovered technical debt items
- `memory_candidates[]` (optional): candidate items to pass to the evolution pipeline

## Matrix

| reviewer_type | When mandatory | Primary concerns | closure inclusion | evolution inclusion |
|---|---|---|---|---|
| architecture_authority | `task_kind=code` and `risk_level` is one of `normal`, `high`, `critical` | boundary, coupling, technical fit | specialist_reviews[] | architecture precedent / debt / rules candidate |
| frontend_engineer | scope.paths includes UI/frontend files (see doc 01 Step 3) | component structure, rendering, browser compatibility | specialist_reviews[] | frontend pattern / debt |
| backend_engineer | scope.paths includes API/server files (see doc 01 Step 3) | API design, data flow, service boundary | specialist_reviews[] | backend pattern / debt |
| qa_engineer | All `task_kind=code` tasks, `gate_profile=closure_ready` | acceptance, demo, failure path, rubric | specialist_reviews[] + verification_result | qa recipe / risk memory |
| critical_reviewer | Tasks with `risk_level` `high` or `critical`, readiness round | weak assumptions, ship risk | specialist_reviews[] + readiness_round | challenge precedent / risk memory |
| security_engineer | When auth/permission/secret/public input paths are modified, when `risk_level` is `high` or `critical`, `task_kind=audit` | abuse path, authz, secret leak | specialist_reviews[] | security warning / debt |
| devops_engineer | `task_kind=config` or `task_kind=release`, when env/service/deploy/migration paths are modified | runtime readiness, bootstrap, rollout | specialist_reviews[] | environment fact / ops debt |
| ui_ux_designer | `task_kind=design`, when user-facing UI paths are modified | UX consistency, user flow | specialist_reviews[] | design precedent |
| technical_writer | `task_kind=docs` or when docs-impact changes are included | operator/user docs completeness | specialist_reviews[] | docs rule / style memory |
| product_authority | every task final closure, phase boundary | user value, scope fit, ship/iterate | final_verdict / phase review | product precedent / scope decisions |

## Worker Artifacts Consumed by Specialists

`worker-self-check.json` must be readable by at least the following specialists:
- `architecture_authority`
- `qa_engineer`
- `critical_reviewer`
- `frontend_engineer` (when included as a required reviewer for the task)
- `backend_engineer` (when included as a required reviewer for the task)

### Rule When Worker Self-Check Is Absent

If `worker-self-check.json` does not exist at the time a specialist review begins, the specialist must record this as a `blocking_concern`. In this case, the review result cannot be `status = approved`.

## Required Reviewer Resolution

For the full algorithm, see doc 01 "Required Reviewer Routing Algorithm" (Steps 1-6). Below is a summary:

1. Examine `task_kind`, `risk_level`, `scope.paths`, and touched surfaces (see doc 01 Steps 1-3).
2. Derive the base reviewer set.
3. Add conditional reviewers if any of the following apply:
   - Task modifies auth/crypto/secrets paths -> add `security_engineer`
   - Task modifies CI/CD/deploy configuration -> add `devops_engineer`
   - Task adds/removes API endpoints -> add `architecture_authority`
   - Task modifies user-facing UI -> add `ui_ux_designer`
4. Include all actually performed specialist review artifacts in the closure packet.

## Rule

A task missing a required reviewer cannot transition to `reviewed`. Specifically:
- For every type in `required_reviewer_types[]`, a specialist review artifact with `status` of `approved` or `changes_requested` (with all concerns resolved) must exist.
- If even 1 review has `status = blocked`, the task cannot transition to `reviewed`.
- If an agent corresponding to a required reviewer type is unavailable, the task transitions to `blocked`, and the unavailable reviewer type is recorded in `blocking_reason`.

## Evolution Handoff Rule

Specialist reviews do not end at helping with closure. If any of the following are present, the `orchestration_authority` passes them to the evolution pipeline as input:
- Reusable lesson
- Repeated risk pattern
- Debt flag
- Test recipe
- Environment fact
- Design precedent
- Product precedence signal

### Memory Candidate Priority

When a single specialist review contains multiple types of memory candidates, the `orchestration_authority` processes them in the following priority order:
1. Safety/security items (security warning, abuse path, secret leak, etc.)
2. Architectural precedent (boundary decision, coupling rule, technical fit judgment)
3. Operational lesson (environment fact, ops debt, runtime readiness)
4. Optimization tip (performance improvement, efficiency suggestion)
