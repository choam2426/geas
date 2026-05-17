import { parseMarkdownArtifact, type MarkdownArtifact, type MarkdownArtifactKind } from '../../src/lib/artifacts';

function artifact(kind: MarkdownArtifactKind, text: string): MarkdownArtifact {
  const parsed = parseMarkdownArtifact(text, kind);
  if (!parsed.ok) {
    throw new Error(`${kind} fixture invalid: ${parsed.code}: ${parsed.detail}`);
  }
  return parsed.artifact;
}

export function missionSpec(name = 'Demo'): MarkdownArtifact {
  return artifact('mission-spec', `---
name: ${name}
---
## Goal
Demo goal.

## Background
Context.

## Scope
### Included
Demo scope.

### Excluded
None.

## Acceptance Criteria
AC-001: Done.

## Constraints
None.

## Assumptions
None.

## Risks
None.
`);
}

export function missionDesign(name = 'Demo'): MarkdownArtifact {
  return artifact('mission-design', `---
name: ${name}
---
## Plan Summary
Plan summary.

## Approach Strategy
Use the smallest viable runtime update.

## Alternatives Considered
None.

## Key Concepts
None.

## Scope
### In
CLI runtime.

### Out
Dashboard.

## Plan Outline
Prepare baseline artifacts.

## Decision Points
None.

## Assumptions
None.

## Risks
None.

## Change Triggers
None.
`);
}

export function taskContract(taskId = 'task-001', dependsOn: string[] = [], riskLevel = 'low', name = 'Demo'): MarkdownArtifact {
  const deps = dependsOn.length === 0 ? '[]' : `[${dependsOn.map((d) => `"${d}"`).join(', ')}]`;
  return artifact('task-contract', `---
name: ${name}
task_id: ${taskId}
mission_acceptance_refs: ["AC-001"]
depends_on: ${deps}
risk_level: ${riskLevel}
---
## Description
Task description.

## Mission Relation
Supports AC-001.

## Scope
### In
Task scope.

### Out
None.

## Deliverables
Deliverable.

## Acceptance Criteria
TC-AC-001: Done.

## Verification Checks
VC-001: Check result.

## Review Focus
Review scope.

## Assumptions
None.

## Constraints
None.

## Risks
None.

## Change Triggers
None.
`);
}

export function implementationEvidence(taskId = 'task-001', name = 'Demo'): MarkdownArtifact {
  return artifact('implementation-evidence', `---
name: ${name}
task_id: ${taskId}
evidence_type: implementation
task_contract_ref: task-contract-001.md
---
## Summary
Implemented work.

## Changed Outputs
None.

## Affected Scope
Task scope.

## Implementation Decisions
None.

## Assumptions
None.

## Contract Deltas
None.

## Self Checks
None.

## Limits
None.

## Reflection Candidates
None.
`);
}

export function verificationEvidence(
  verdict: 'passed' | 'changes_requested' | 'escalated',
  taskId = 'task-001',
  name = 'Demo',
): MarkdownArtifact {
  return artifact('verification-evidence', `---
name: ${name}
task_id: ${taskId}
evidence_type: verification
task_contract_ref: task-contract-001.md
implementation_evidence_ref: implementation-evidence-001.md
verdict: ${verdict}
---
## Summary
Verification summary.

## Environment
Test environment.

## Target
Target.

## Checks Performed
VC-001: Checked.

## Criteria Results
TC-AC-001: passed.

## Outputs
None.

## Deviations
None.

## Unverified Scope
None.

## Recheck Needed
None.
`);
}

export function reviewEvidence(taskId = 'task-001', name = 'Demo'): MarkdownArtifact {
  return artifact('review-evidence', `---
name: ${name}
task_id: ${taskId}
evidence_type: review
task_contract_ref: task-contract-001.md
implementation_evidence_ref: implementation-evidence-001.md
verification_evidence_ref: verification-evidence-001.md
verdict: passed
---
## Summary
Review summary.

## Target
Target.

## Review Focus Used
Focus.

## Review Coverage
### Covered
Scope.

### Not Covered
None.

## Review Methods
Read artifacts.

## Findings
None.

## Remaining Risks
None.

## Overall Recommendation
Accept.
`);
}

export function taskEvidence(taskId = 'task-001', name = 'Demo'): MarkdownArtifact {
  return artifact('task-evidence', `---
name: ${name}
task_id: ${taskId}
evidence_type: task
task_contract_ref: task-contract-001.md
user_judgment_ref: user-judgment-result-001.md
---
## Summary
Task summary.

## User Judgment Summary
Accepted.

## Criteria Results
TC-AC-001: satisfied.

## Accepted Unverified Scope
None.

## Accepted Remaining Risks
None.
`);
}

export function taskJudgment(
  decision: 'accepted' | 'accepted_with_limits' | 'revise' | 'deferred' | 'stopped' = 'accepted',
  taskId = 'task-001',
  name = 'Demo',
): MarkdownArtifact {
  return artifact('user-judgment', `---
name: ${name}
judgment_type: task-result
task_id: ${taskId}
decision: ${decision}
---
## Decision Trail
User accepted the task result.

## Accepted Unverified Scope
None.

## Accepted Remaining Risks
None.

## Requested Actions
None.

## Notes
None.
`);
}

export function missionJudgment(
  decision: 'accepted' | 'accepted_with_limits' | 'revise' | 'deferred' | 'stopped' = 'accepted',
  name = 'Demo',
): MarkdownArtifact {
  return artifact('user-judgment', `---
name: ${name}
judgment_type: mission-result
decision: ${decision}
---
## Decision Trail
User accepted the mission result.

## Accepted Unverified Scope
None.

## Accepted Remaining Risks
None.

## Requested Actions
None.

## Notes
None.
`);
}

export function missionEvidence(
  name = 'Demo',
  refs: { missionSpecRef?: string; missionDesignRef?: string; userJudgmentRef?: string } = {},
): MarkdownArtifact {
  return artifact('mission-evidence', `---
name: ${name}
evidence_type: mission
mission_spec_ref: ${refs.missionSpecRef ?? 'mission-spec-001.md'}
mission_design_ref: ${refs.missionDesignRef ?? 'mission-design-001.md'}
user_judgment_ref: ${refs.userJudgmentRef ?? 'user-judgment-result-001.md'}
---
## Summary
Mission summary.

## User Judgment Summary
Accepted.

## Mission Criteria Results
AC-001: satisfied.

## Mission Design Deltas
None.

## Accepted Unverified Scope
None.

## Accepted Remaining Risks
None.

## Gaps
None.

## Debts
None.

## Follow Ups
None.

## Reflection Summary
None.

## Memory Updates
None.
`);
}
