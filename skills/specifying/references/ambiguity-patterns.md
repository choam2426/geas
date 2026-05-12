# Ambiguity Patterns

Use this reference to detect ambiguity before it becomes silent scope expansion.

## Pattern Catalog

| Pattern | Signal | Resolution Move |
| --- | --- | --- |
| Outcome ambiguity | The request names an activity, not the desired final state. | Ask what should be true after the Mission. |
| Audience ambiguity | The result has multiple possible judges or users. | Ask who will inspect or depend on the result. |
| Scope boundary ambiguity | Adjacent work sounds useful but was not requested. | Draft scope in/out together and ask for confirmation. |
| Surface ambiguity | The likely files, APIs, docs, UI, or runtime artifacts are unclear. | Inspect context, propose affected surfaces, ask confirm-this. |
| Quality ambiguity | "Good", "complete", "clean", or "perfect" appears without criteria. | Translate into observable acceptance criteria and review focus. |
| Verification ambiguity | Success is claimed without a check method. | Pair each criterion with a verification check, review method, observable signal, expected unverified scope, or User decision point. |
| Decision ownership ambiguity | Agent could make product, risk, or tradeoff decisions silently. | Ask which decisions are delegated and which require User review. |
| Irreversibility ambiguity | Work may affect data, permissions, migration, deployment, or public behavior. | Add constraints, rollback expectations, and consider Challenger. |
| Dependency ambiguity | A Task may depend on another baseline or accepted result. | Represent Mission-level reset triggers in Mission Design and Task dependencies in Task Contracts. |
| Terminology ambiguity | Same word may mean different things across docs, code, or User intent. | Define the term in Mission Design key concepts. |
| Completion ambiguity | Task done and Mission done can be confused. | Separate Task acceptance criteria from Mission completion criteria. |
| Evidence ambiguity | The User may not know what proof they need. | Propose verification checks, review focus, and Evidence expectations. |

## Resolution Moves

### Ask

Ask when the ambiguity changes scope, acceptance criteria, verification, User responsibility, irreversible choices, or runtime records.

Good questions name the consequence:

```text
If we include packaging now, the Mission will move beyond the current procedure changes into release work. Should packaging stay out of this Mission?
```

### Draft an Assumption

Draft an assumption when the ambiguity is low risk and easy for the User to correct in review.

```text
Assumption: The first implementation target is the procedure and role-prompt files, while packaging work remains outside this Mission.
```

### Split the Mission

Propose splitting when one request contains independent outcomes with different acceptance criteria, reviewers, risk levels, or release timing.

### Split the Task

Propose splitting when one Task would require multiple independent User judgments or would mix implementation with unrelated verification, docs, packaging, or migration work.

### Recommend Challenger

Recommend Challenger during specifying when ambiguity remains around:

- Mission importance or cost of being wrong.
- Scope boundaries.
- Security, permissions, data, migration, or deployment.
- Weak acceptance criteria.
- User delegation depth.
- Long-term maintenance cost.

The User decides whether the added challenge pass is worth the extra depth.

## Ambiguity Review Checklist

Before presenting a baseline draft, check:

- Each acceptance criterion has an observable basis.
- Each scope-in item maps to a surface or artifact.
- Each surface maps to included scope.
- Excluded scope captures tempting adjacent work.
- Task boundaries align with User judgment boundaries.
- Dependencies are explicit.
- Assumptions are reviewable.
- Risks identify what could make acceptance expensive.
- Unverified scope is not hidden as success.
