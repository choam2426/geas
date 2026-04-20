# Geas Dashboard

Desktop viewer for [Geas](https://github.com/choam2426/geas)-managed projects. Reads the v3 `.geas/` artifact tree and renders mission progress, task lifecycle, evidence gate status, debts, gap, memory, and events. Built with Tauri v2; the app is strictly read-only and never mutates project data.

## Prerequisites

- **Node.js** (v18+)
- **Rust toolchain** (install via [rustup](https://rustup.rs/))
- **Tauri CLI** -- installed automatically as a dev dependency (`@tauri-apps/cli`)

## Getting Started

```bash
cd src/dashboard
npm install
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri desktop window simultaneously.

## Build

```bash
npm run tauri build
```

Produces a native installer in `src-tauri/target/release/bundle/`.

## Project Structure

```
src/dashboard/
├── src/                         # React frontend (TypeScript)
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component, routing between views
│   ├── types.ts                 # v3 types mirroring Rust models
│   ├── colors.ts                # Shared color constants (severity, risk, phase, status)
│   ├── index.css                # Tailwind CSS entry
│   ├── lib/
│   │   └── geasClient.ts        # Typed Tauri invoke wrapper — single data-access point
│   └── components/
│       ├── Sidebar.tsx          # Project list sidebar (collapsible, responsive)
│       ├── AddProjectDialog.tsx # Project path registration dialog
│       ├── ProjectDashboard.tsx # Project summary + mission list
│       ├── MissionHistory.tsx   # Mission browser
│       ├── MissionDetailView.tsx# Mission spec + phase reviews + gap + consolidation packet
│       ├── KanbanBoard.tsx      # 9-state task board
│       ├── TaskCard.tsx         # Individual task card
│       ├── TaskDetailModal.tsx  # Task detail + evidence gate status view
│       ├── DebtDetailPanel.tsx  # Project-level debts table with filters
│       ├── DebtDetailModal.tsx  # Debt item detail
│       ├── MemoryBrowser.tsx    # shared.md + agent memory + memory-update changelog
│       ├── TimelineView.tsx     # events.jsonl viewer
│       ├── PhaseBadge.tsx       # Mission phase indicator
│       ├── ProgressBar.tsx      # Task progress visualization
│       ├── EmptyState.tsx       # Empty data placeholder
│       └── ErrorState.tsx       # Error / missing project placeholder
├── src-tauri/                   # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs              # Tauri app entry point
│   │   ├── lib.rs               # Command registration
│   │   ├── config.rs            # Registered-project persistence
│   │   ├── models.rs            # Rust structs for v3 artifacts
│   │   ├── watcher.rs           # Debounced file watcher on .geas/
│   │   └── commands/
│   │       └── mod.rs           # Tauri commands (filesystem reads, per DASHBOARD.md)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Views (per `docs/reference/DASHBOARD.md`)

- **Mission overview** — `spec.json` + `mission-state.json` + `mission-design.md` + `mission-verdicts.json`.
- **Task table / Kanban** — `tasks/*/contract.json` + `tasks/*/task-state.json` grouped by 9-state lifecycle (drafted, ready, implementing, reviewed, verified, passed, plus aux blocked / escalated / cancelled).
- **Evidence gate status** — per-task view combining `contract.json` routing, `self-check.json`, `gate-results.json` latest run, and the `evidence/{agent}.{slot}.json` file index with required-reviewer slot coverage.
- **Phase review history** — ordered entries of `phase-reviews.json`.
- **Debt register** — project-level `.geas/debts.json`, filterable by severity and status.
- **Gap signals** — `consolidation/gap.json` grouped by fully-delivered / partially-delivered / not-delivered / unexpected-additions.
- **Memory panel** — `memory/shared.md` + `memory/agents/*.md` + the latest mission's `consolidation/memory-update.json` changelog.
- **Events timeline** — `.geas/events.jsonl` with per-actor badges.
- **Consolidation packet** — side-by-side of `consolidation/candidates.json` vs the promoted debt / gap / memory-update artifacts.

All views degrade gracefully on missing or malformed artifacts (explicit empty states, never fatal).

## Data Access

Every frontend component imports the typed wrapper at `src/lib/geasClient.ts` instead of calling `invoke` directly. The Rust side exposes v3-aligned commands (`get_project_summary`, `get_mission_detail`, `list_tasks`, `get_task_detail`, `get_gate_results`, `read_evidence_file`, `get_debts`, `get_events`, `get_shared_memory`, and so on). The file watcher emits `geas://project-changed` debounced events on any change inside `.geas/`.

## Configuration

App data (registered project paths) is stored as JSON in the OS-standard application data directory:

| OS      | Location                                                    |
|---------|-------------------------------------------------------------|
| Windows | `%APPDATA%\com.geas.dashboard\`                             |
| macOS   | `~/Library/Application Support/com.geas.dashboard/`         |
| Linux   | `~/.local/share/com.geas.dashboard/`                        |

## Tech Stack

| Layer    | Technology                                         |
|----------|---------------------------------------------------|
| Shell    | Tauri v2                                           |
| Frontend | React 19, TypeScript 5, lucide-react, react-markdown |
| Bundler  | Vite 6                                             |
| Styling  | Tailwind CSS v4                                    |
| Font     | Inter via @fontsource (self-hosted)                |
| Backend  | Rust (2021 edition), serde, notify, chrono         |

## Limitations

- Read-only — the dashboard never writes to `.geas/`.
- Dark theme only.
- No installer signing or distribution packaging.
- Rust compile is validated by the user's local toolchain; the CI-visible check is the `vite build` step only.
