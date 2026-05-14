import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseMarkdownArtifact } from '../src/lib/artifacts';
import { missionSpec } from './helpers/artifacts';

test('markdown artifact parser rejects missing frontmatter', () => {
  const result = parseMarkdownArtifact('## Goal\nText', 'mission-spec');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'frontmatter_missing');
});

test('markdown artifact parser rejects missing required section', () => {
  const text = `---
name: Demo
---
## Goal
Only one section.
`;
  const result = parseMarkdownArtifact(text, 'mission-spec');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'section_missing');
});

test('markdown artifact parser rejects H1 headings', () => {
  const valid = missionSpec().text;
  const result = parseMarkdownArtifact(valid.replace('## Goal', '# Title\n\n## Goal'), 'mission-spec');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'body_section_start_invalid');
});

test('markdown artifact parser rejects duplicate sections', () => {
  const valid = missionSpec().text;
  const result = parseMarkdownArtifact(`${valid}\n## Goal\nDuplicate.\n`, 'mission-spec');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'section_duplicate');
});

test('markdown artifact parser rejects wrong enum before command use', () => {
  const text = `---
name: Demo
task_id: task-001
mission_acceptance_refs: []
depends_on: []
risk_level: critical
---
## Description
Text.

## Mission Relation
Text.

## Scope
Text.

## Deliverables
Text.

## Acceptance Criteria
Text.

## Verification Checks
Text.

## Review Focus
Text.

## Assumptions
Text.

## Constraints
Text.

## Risks
Text.

## Change Triggers
Text.
`;
  const result = parseMarkdownArtifact(text, 'task-contract');
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'frontmatter_enum_invalid');
});
