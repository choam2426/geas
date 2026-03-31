# Changelog

All notable changes to the Geas project are documented here.

## v0.2.0 (2026-03-30)

### New Features

- **Implementation Contract**: Pre-implementation agreement where worker proposes action plan (planned_actions, edge_cases, non_goals, demo_steps) and Sentinel+Forge approve before coding begins.
- **Rubric Evaluation**: Quality dimension scoring with hard thresholds in Evidence Gate Tier 2. Default dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). UI tasks add ux_clarity(3), visual_coherence(3). Below threshold blocks Tier 3 entry.
- **Worker Self-Check**: Mandatory self_check in EvidenceBundle — known_risks, untested_paths, possible_stubs, what_i_would_test_next, confidence (1-5). Confidence ≤ 2 triggers stricter thresholds.
- **Stateful QA**: Sentinel expanded beyond UI to API endpoint verification and DB state checks. Dev server lifecycle management.
- **Pipeline Resilience (remaining_steps)**: Full pipeline step list tracked in run.json checkpoint. Survives context compaction via restore-context hook.
- **Step Event Logging**: step_complete events logged for every pipeline step transition.
- **Sprint Seed Versioning**: Sprint mode creates versioned seed snapshots for feature-specific scope tracking.

### Improvements

- **Tool-agnostic Core Skills**: All core skills reference conventions.md instead of hardcoded tool names (npm, Playwright, PostgreSQL, etc.).
- **seed.json Redesign**: Project identity (immutable) separated from execution scope. Sprint reads seed for context, feature scope goes to TaskContract.
- **TaskContract Scope Management**: New scope_out field for feature-level exclusions (complements file-level prohibited_paths).
- **MCP Recommendations**: Category-based instead of tool-specific.
- **Hook Enhancements**: restore-context includes remaining_steps + NEXT STEP; verify-task-status checks rubric_scores.
- **Dev Server Lifecycle Management**: Improved handling of server startup, operation, and teardown within verification pipeline.
- **Cost Tracking Improvements**: Real cost tracking via session JSONL parsing; agent-telemetry hook replaces track-cost.
- **Tech Debt Tracking**: Mandatory tech_debt reporting from Forge, Critic, Scrum agents; check-debt hook enforces severity thresholds.
- **Positive Framing**: All instruction sets replaced with positive framing (focus on what agents should do, not restrictions).
- **Documentation Rewrite**: Complete documentation restructure with new architecture/, guides/, and reference/ sections.

### Breaking Changes

- **TaskContract Schema**: `rubric` is now a required field.
- **Sprint Mode**: No longer overwrites existing seed.json; falls back to prior Initiative seed when available.
- **seed.schema.json**: New `source` field (initiative|sprint) to distinguish execution mode.
- **Linear Integration Removal**: All Linear references removed from skills, agents, hooks, and schemas; linear_issue_id and linear_url deprecated.
- **Hook Standardization**: track-cost renamed to agent-telemetry; cost calculation moved to calculate-cost hook.
- **Terminology**: path_boundaries → prohibited_paths across all schemas and skills.

### Bug Fixes

- **Tool-agnostic Cleanup**: Resolved remaining tool-specific violations in core skills.
- **Sprint Seed Fallback**: Sprint mode now correctly falls back to seed.json when no prior Initiative exists.
- **TaskContract Validation**: Ensure rubric field is always present and properly structured.
- **Path Whitelist**: Strengthen allowed_paths prohibition in task-compiler with explicit field whitelist.
- **Evidence Gate**: Fixed 5 critical bugs from v0.2 test session analysis affecting verification flow.

## v0.1.0 (2026-03-28)

### Initial Release

- **12 Specialist Agents**: Nova, Forge, Palette, Pixel, Circuit, Keeper, Sentinel, Pipeline, Shield, Critic, Scroll, Scrum.
- **20 Core Skills**: Contract Engine (intake, task-compiler, evidence-gate, verify-fix-loop, vote-round), execution protocols (initiative, sprint, debate), and supporting skills.
- **3 Execution Modes**: Initiative (new product), Sprint (feature addition), Debate (structured discussion).
- **6 JSON Schemas**: seed, task-contract, evidence-bundle, decision-record, context-packet, run-state.
- **9 Automation Hooks**: session-init, inject-context, protect-geas-state, verify-task-status, restore-context, agent-telemetry, verify-pipeline, check-debt, calculate-cost.
- **Structured Vote Round**: Mandatory Critic participation with debate protocol on disagreement.
- **Runtime State Management**: .geas/ directory for ledger, evidence, decisions, and memory tracking.
- **Evidence-Based Verification**: 3-tier Evidence Gate (mechanical, semantic, product) for all outputs.
- **Contract-First Workflow**: TaskContract with acceptance criteria before implementation.
