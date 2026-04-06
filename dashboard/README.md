# Geas Dashboard

Desktop application for monitoring [Geas](https://github.com/choam2426/geas)-managed projects. Displays mission progress, a task kanban board, and tech debt summaries by reading `.geas/` directories from registered projects. Built with Tauri v2, the app is read-only and never modifies project data.

## Prerequisites

- **Node.js** (v18+)
- **Rust toolchain** (install via [rustup](https://rustup.rs/))
- **Tauri CLI** -- installed automatically as a dev dependency (`@tauri-apps/cli`)

## Getting Started

```bash
cd dashboard
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
dashboard/
├── src/                    # React frontend (TypeScript)
│   ├── main.tsx            # Entry point
│   ├── App.tsx             # Root component, routing between views
│   ├── types.ts            # Shared TypeScript types
│   ├── colors.ts           # Shared color constants (severity, risk, phase)
│   ├── index.css           # Tailwind CSS entry
│   └── components/
│       ├── Sidebar.tsx           # Project list sidebar (collapsible, responsive)
│       ├── AddProjectDialog.tsx  # Project path registration dialog
│       ├── ProjectOverview.tsx   # Mission status summary view
│       ├── MissionHistory.tsx    # Browse past and active missions
│       ├── KanbanBoard.tsx       # Task cards organized by state (responsive stacking)
│       ├── TaskCard.tsx          # Individual task card
│       ├── DebtPanel.tsx         # Tech debt severity breakdown (inline summary)
│       ├── DebtDetailPanel.tsx   # Full debt list with severity/status filters
│       ├── DebtDetailModal.tsx   # Debt item detail modal (focus-trapped, accessible)
│       ├── PhaseBadge.tsx        # Mission phase indicator
│       ├── DebtBadge.tsx         # Debt count indicator
│       ├── ProgressBar.tsx       # Task progress visualization
│       ├── EmptyState.tsx        # Empty data placeholder
│       └── ErrorState.tsx        # Error/missing project placeholder
├── src-tauri/              # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs         # Tauri app entry point
│   │   ├── lib.rs          # Plugin and command registration
│   │   ├── config.rs       # App config persistence (project paths)
│   │   ├── models.rs       # Rust structs mirroring .geas/ JSON schemas
│   │   ├── watcher.rs      # File system watcher (notify crate, debounced)
│   │   └── commands/
│   │       └── mod.rs      # Tauri commands (filesystem reads)
│   ├── Cargo.toml
│   └── tauri.conf.json     # Tauri window and build configuration
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Features

- **Project registration** -- Add and remove local project paths through the UI. Paths persist across app restarts.
- **Auto-refresh** -- The Rust backend watches `.geas/` directories for file changes and automatically refreshes project data. No manual reload needed.
- **Mission overview** -- See mission name, current phase, task progress, debt count, and last activity time for each registered project.
- **Mission history** -- Browse all missions for a project (past and active). Each mission card shows phase, task progress, and creation date. Selecting a mission opens its kanban board.
- **Kanban board** -- View tasks organized by their 7 primary states (drafted, ready, implementing, reviewed, integrated, verified, passed) and 4 auxiliary states (blocked, escalated, cancelled, paused). Cards display title, assignee type, and risk level. Columns scroll horizontally on wider screens with reliable overflow handling.
- **Parallel task display** -- When the orchestrator runs tasks in parallel, active batch members are highlighted with a green pulse indicator and completed-in-batch tasks show a checkmark. Single-task mode continues to display the agent name and pipeline step.
- **SVG icons** -- UI elements use lucide-react SVG icons for a polished, consistent look.
- **Debt tracking** -- Severity breakdown (low, normal, high, critical) per project from `debt-register.json`. The overview shows a summary; the debt detail panel provides a full item list with severity and status filters (all/open/resolved). Clicking any debt item opens a detail modal showing severity, kind, status, description, and the introducing task ID.
- **Responsive layout** -- Sidebar collapses to a narrow icon strip on screens below 1024px and can be manually toggled. Kanban columns stack vertically on mobile and scroll horizontally on desktop. Padding and font sizes scale with breakpoints.
- **Error handling** -- Graceful display when a registered project path is missing or has no `.geas/` directory.

## Configuration

App data (registered project paths and preferences) is stored as JSON in the OS-standard application data directory:

| OS      | Location                                                    |
|---------|-------------------------------------------------------------|
| Windows | `%APPDATA%\com.geas.dashboard\`                             |
| macOS   | `~/Library/Application Support/com.geas.dashboard/`         |
| Linux   | `~/.local/share/com.geas.dashboard/`                        |

## Tech Stack

| Layer    | Technology                                         |
|----------|---------------------------------------------------|
| Shell    | Tauri v2                                           |
| Frontend | React 19, TypeScript 5, lucide-react               |
| Bundler  | Vite 6                                             |
| Styling  | Tailwind CSS v4                                    |
| Font     | Inter via @fontsource (self-hosted, works offline) |
| Backend  | Rust (2021 edition), serde, notify, chrono         |

## Limitations

- Read-only -- the app never writes to `.geas/` directories.
- Dark theme only -- no light mode toggle.
- No installer signing or distribution packaging.
