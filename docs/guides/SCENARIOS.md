# Real-World Scenarios

## Scenario 1: Building a Real-Time Auction Platform (Initiative)

### Mission
"실시간 경매 플랫폼 — WebSocket bidding, anti-sniping, optimistic locking, admin dashboard"

### Timeline
| Time | Event |
|------|-------|
| 0:00 | Session start, .geas/ initialized |
| 0:03 | Seed frozen (6 criteria, 7 scope_in) |
| 0:04 | Genesis: Nova vision + PRD + Stories |
| 0:08 | Forge architecture (19KB document) |
| 0:12 | Vote round: 3/3 agree |
| 0:15 | 15 TaskContracts compiled |
| 0:20 | MVP Build starts, US-01 with Implementation Contract |
| 2:10 | 15/15 tasks passed |
| 2:25 | Polish + Evolution complete, v0.1.0 tagged |

### Key Observations
- 56 subagents spawned across the full Initiative
- Implementation Contract for US-01: 24 planned actions, 7 edge cases, 8 non-goals
- Worker self-check: all workers included confidence scores (4-5)
- Forge rubric: consistent code_quality=4 across all tasks
- Sentinel rubric: scores ranged from 1-5, highlighting real quality differences
- US-15 (Admin Suspend Bidder): catastrophic scores (core=2, feat=2, regr=1) — shipped as "conditional"

### Rubric Scorecard
| Task | core(≥3) | feat(≥4) | regr(≥4) | code(≥4) |
|------|----------|----------|----------|----------|
| US-01 | 5 | 5 | 4 | 4 |
| US-02 | 5 | 5 | 4 | 4 |
| US-03 | 5 | 5 | 4 | 4 |
| US-04 | 5 | 4 | **2** | 4 |
| US-05 | 4 | 5 | **2** | 4 |
| US-15 | **2** | **2** | **1** | **3** |

3 out of 6 scored tasks had threshold violations.

## Scenario 2: Adding Settlement + Dispute (Sprint)

### Mission
"Add settlement history view and dispute system to the auction platform"

### What Changed vs Initiative
- seed.json was read-only (not overwritten)
- Rubric generated: 6 dimensions
- Implementation Contract: 21 actions, 10 edge cases, 15 demo steps
- All remaining_steps tracked and popped correctly
- Rubric scores: all dimensions ≥ 4 (regression_safety=5)

### Key Metrics
| Metric | Initiative (before fixes) | Sprint (after fixes) |
|--------|------------------------|---------------------|
| TaskContract rubric | 0% | 100% |
| Implementation Contract | 6.7% | 100% |
| Sentinel rubric | 40% | 100% |
| remaining_steps | N/A | All 11 steps tracked |

## Lessons Learned

### What Works
1. Agent definitions are followed 100% — the most reliable place for instructions
2. Self-check and Forge rubric work without intervention
3. Implementation Contract prevents misunderstood requirements

### What Needed Fixing
1. Pipeline steps in SKILL.md get lost after context compaction → remaining_steps solved this
2. Optional schema fields are ignored by agents → make critical fields required
3. Tool-specific hardcoding in core skills → conventions.md reference pattern
