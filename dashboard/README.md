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
│   ├── index.css           # Tailwind CSS entry
│   └── components/
│       ├── Sidebar.tsx           # Project list sidebar
│       ├── AddProjectDialog.tsx  # Project path registration dialog
│       ├── ProjectOverview.tsx   # Mission status summary view
│       ├── KanbanBoard.tsx       # Task cards organized by state
│       ├── TaskCard.tsx          # Individual task card
│       ├── DebtPanel.tsx         # Tech debt severity breakdown
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
- **Mission overview** -- See mission name, current phase, task progress, debt count, and last activity time for each registered project.
- **Kanban board** -- View tasks organized by their 7 primary states (drafted, ready, implementing, reviewed, integrated, verified, passed). Cards display title, assignee type, and risk level.
- **Debt tracking** -- Severity breakdown (low, medium, high, critical) per project from `debt-register.json`.
- **Error handling** -- Graceful display when a registered project path is missing or has no `.geas/` directory.

## Configuration

App data (registered project paths and preferences) is stored as JSON in the OS-standard application data directory:

| OS      | Location                                                    |
|---------|-------------------------------------------------------------|
| Windows | `%APPDATA%\com.geas.dashboard\`                             |
| macOS   | `~/Library/Application Support/com.geas.dashboard/`         |
| Linux   | `~/.local/share/com.geas.dashboard/`                        |

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Shell    | Tauri v2                    |
| Frontend | React 19, TypeScript 5      |
| Bundler  | Vite 6                      |
| Styling  | Tailwind CSS v4             |
| Backend  | Rust (2021 edition), serde  |

## Limitations (MVP)

- Read-only -- the app never writes to `.geas/` directories.
- Manual refresh only -- no file watching or auto-refresh.
- Shows the current/latest mission only -- no mission history browsing.
- Dark theme only -- no light mode toggle.
- No installer signing or distribution packaging.
