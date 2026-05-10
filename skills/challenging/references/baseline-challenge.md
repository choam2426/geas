# Baseline Challenge

Use this reference for specifying-stage baseline challenges. This output is conversation input for the caller to brief the User. It is not Challenger Evidence, not User Judgment, and not a runtime artifact.

## Return Packet

Return:

- Challenged draft type: Mission Spec, Mission Design, or Task Contract.
- Challenge focus.
- Findings with basis.
- Suggested draft changes.
- Risk if ignored.
- Recommended verdict: `passed`, `changes_requested`, or `escalated`.

## Shape

```text
**Baseline Challenge**
Mission: {mission_goal}
Decision needed: decide which challenge findings should return to the current artifact author.

**Challenged Draft**
- {draft_type}: {summary_or_ref}

**Challenge Focus**
- {focus_item}

**Findings**
- {finding}: Basis: {basis}. Suggested draft change: {change}. Risk if ignored: {risk}

**Recommendation**
I recommend {incorporating_or_discarding_findings} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. incorporate - send the selected findings to the current artifact author for a revised draft.
2. revise finding - adjust the finding or proposed draft change before sending it to the author.
3. challenge deeper - request another focused challenger role pass before recording the current draft.
4. discard - leave the current draft unchanged for this finding.
```

## Boundaries

- During specifying, return findings to the calling context for User briefing and draft revision.
- The calling context does not write these findings itself; it receives them from the `challenger` role context.
- Do not record Challenger Evidence during specifying.
- If a finding affects an already recorded baseline artifact, return to that artifact's revision path before building.
