# Dashboard

## Overview

Geas Dashboard is a desktop application for visually monitoring mission progress, task states, technical debt, event timelines, and more. Built on Tauri v2, it uses a Rust backend that reads state files from the `.geas/` directory and serves data to a React frontend.

You can register and manage multiple projects simultaneously. The dashboard detects file system changes and refreshes the display automatically.

## Installation and Running

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18 or later |
| Rust | stable |
| Tauri CLI | 2.x |

### Development Mode

```bash
cd src/dashboard
npm install
npm run tauri dev
```

The `tauri dev` command starts both the Vite dev server (port 5173) and the Tauri native window.

### Production Build

```bash
cd src/dashboard
npm run tauri build
```

Build artifacts are produced in platform-specific formats:

| Platform | Package Format |
|----------|---------------|
| Windows | MSI, NSIS |
| macOS | DMG |
| Linux | DEB, AppImage |

### Default Window Settings

- Default size: 1200 x 800
- Minimum size: 800 x 600
- Resizable; fullscreen disabled

## UI Layout

The Dashboard is divided into a left sidebar and a right main area. Selecting a project in the sidebar displays that project's information in the main area.

### Sidebar

The left panel showing the project list.

- **Project list**: Lists registered projects. The selected project is highlighted with an accent border on the left.
- **Status icons**: Projects without a `.geas/` directory show a warning icon. Projects with read errors show an error icon.
- **Phase badge**: Displays each project's current mission phase as a colored badge.
- **Collapse/expand**: The sidebar can be collapsed to icon mode. When collapsed, it shows the first letter of the project name and a phase-colored dot. The sidebar collapses automatically when the window width is below 1024px.
- **Add project**: The "Add Project" button at the bottom registers a new project.
- **Remove project**: Hovering over a project reveals an X button to remove it. A confirmation dialog is shown.
- **Refresh**: The refresh button at the top reloads the entire project list.
- **Mission history**: The clock icon at the top navigates to the Mission History screen.

### Project Dashboard

The main screen displayed when a project is selected.

**Header Area**

Shows the project name and path.

**Shortcut Buttons**

- **Timeline**: Navigate to the event timeline
- **Memory**: Navigate to the agent memory browser
- **Rules**: Navigate to the project rules viewer

**Health Alert Banner**

When `health-check.json` in the `.geas/` directory contains triggered signals, they are displayed in a red banner. Each signal shows its name, details, and required remediation actions.

**Currently Working Card**

Displays information about the task currently being worked on. A green pulsing dot indicates active status.

- Single task: Shows the task ID, agent name, and pipeline step
- Parallel tasks: Lists all tasks in the parallel batch; completed tasks are marked with a checkmark

**Active Mission Card**

Shows the name, phase badge, and progress bar of the currently active mission. Provides View Tasks, View Debt, and Detail buttons.

**Statistics Cards**

| Item | Description |
|------|-------------|
| Total Tasks | Sum of tasks across all missions |
| Debt Items | Number of technical debt items |
| Last Activity | Time of last activity (shown as relative time) |

**Mission List**

Lists all registered missions. The active mission is distinguished by a left accent border. Inactive missions where all tasks are complete are displayed with reduced opacity. Clicking a mission navigates to the Kanban Board.

### Kanban Board

A screen that organizes tasks into columns by status.

![Kanban Board](../../images/kanvanboard.png)

**Primary Columns (7 main states)**

| Column | Color | Description |
|--------|-------|-------------|
| Drafted | Gray | Draft created |
| Ready | Blue | Ready for implementation |
| Implementing | Green | Implementation in progress |
| Reviewed | Yellow | Review complete |
| Integrated | Blue | Integrated |
| Verified | Green | Verified |
| Passed | Light green | Final pass |

**Auxiliary States**

Tasks not belonging to any primary column are shown in an auxiliary states section at the bottom.

| State | Icon | Description |
|-------|------|-------------|
| Blocked | Prohibited | Blocked |
| Escalated | Warning | Escalated |
| Cancelled | X | Cancelled |
| Paused | Pause | Paused |

**Task Card**

Each card displays the task title, ID, and risk level badge. The currently active task is highlighted with a green border and pulse effect, with the agent name and pipeline step shown additionally. Tasks completed within a parallel batch are distinguished by a green check background.

**Task Detail Modal**

Clicking a task card opens a detail modal with the following information:

- **Basic info**: Task ID, status, risk level, task kind, worker type
- **Goal**: Purpose of the task
- **Acceptance criteria**: List of pass conditions
- **Scope surfaces**: Affected scope areas
- **Dependencies**: List of prerequisite tasks
- **Implementation contract**: Planned work items, edge cases, non-goals, demo steps
- **Self check**: Confidence level, summary, known risks, untested paths
- **Gate result**: Results by tier (Tier 0/1/2), rubric scores, blocking items
- **Challenge review**: Block status, summary
- **Verdict**: Final verdict, rationale, revert targets
- **Closure**: Change summary, review list, unresolved risks, debt items
- **Retrospective**: What went well, problems, lessons learned, rule/memory/debt candidates
- **Evidence**: Evidence list by role (agent, summary, verdict, changed files)

**Debt Panel**

Displays a technical debt summary for the mission at the bottom of the Kanban Board. Severity counts are color-coded.

### Debt Detail Panel

A screen for filtering and viewing detailed information about technical debt items.

**Filters**

- **Severity filter**: Select from critical, high, normal, low (multi-select supported)
- **Kind display**: Shows counts by output quality, verification gap, structural, risk, process, documentation, operations
- **Status filter**: Select from all, open, resolved

**Debt Item Card**

Each card shows a severity badge, kind badge, status badge, title, description, debt ID, and related task ID. Clicking a card opens a detail modal with the full information.

### Mission History

A screen that lists all missions in a project as cards.

Each mission card shows the mission name, ID, phase badge, active status, task progress, and creation date. Clicking a card navigates to that mission's Kanban Board. Each card also provides a Detail button for the mission detail view and a Timeline button for the timeline.

### Mission Detail View

A screen that consolidates a mission's full specification, design, and review information.

| Section | Content |
|---------|---------|
| Mission Spec | Mission purpose, completion criteria, scope, acceptance criteria, constraints, risks, assumptions, ambiguities, impact surfaces |
| Design Brief | Selected approach, non-goals, verification strategy, alternatives, architecture decisions, risks, preservation list, unresolved assumptions |
| Vote Rounds | Participants, individual votes with rationale, results |
| Phase Reviews | Review results per mission phase, met/unmet criteria, risks |
| Gap Assessment | Scope delivery status (complete/partial/undelivered), intentional cuts, unexpected additions, follow-up recommendations |

Meta information includes the domain profile, mode, target audience, and source.

### Timeline View

A screen that displays event logs in chronological order, scoped to a mission or an entire project.

![Toast Notification](../../images/toast.png)

- Each event consists of a type badge, task ID, agent badge, message, and timestamp
- Agents are assigned unique icons and colors (software-engineer, design-authority, qa-engineer, challenger, product-authority, orchestration-authority)
- Events are color-coded by type: task_started (blue), task_resolved (green), gate_result (yellow), phase_complete (purple), etc.
- Paginated at 50 events per page

### Memory Browser

A screen for browsing agent memory files in a project.

The left side shows a list of agents; the right side shows the memory content of the selected agent. Content is read from the `.geas/memory/agents/` directory.

### Rules Viewer

A screen that renders the project's `.geas/rules.md` file as formatted markdown. Supports GFM (GitHub Flavored Markdown) syntax.

## Live Updates

The Dashboard refreshes the display automatically through two channels:

1. **File system watching**: When the Tauri backend detects changes in the `.geas/` directory, it sends a `geas://project-changed` event to the frontend. All screens -- the sidebar project summary, dashboard mission list, Kanban Board tasks, timeline events -- react to this event and refresh.

2. **Toast notifications**: The backend classifies events and sends them as `geas://toast` events. Duplicate notifications within 2 seconds are deduplicated.

| Toast Type | Display Style |
|------------|--------------|
| task_started | Info (blue) |
| task_completed | Success (green) |
| gate_pass | Success (green) |
| gate_fail | Error (red) |
| phase_changed | Info (blue) |
| mission_completed | Success (green) |

Each toast includes a title, message, and progress bar. Toasts disappear automatically after a set duration or can be dismissed manually.

## Project Registration

### Adding a Project

1. Click the "Add Project" button at the bottom of the sidebar.
2. Enter the project path in the dialog.
3. Click "Add" -- the backend validates the path and registers the project.

Registered project paths persist across app restarts. Projects without a `.geas/` directory can still be registered but will appear with a warning status on the dashboard.

### Removing a Project

Hover over the project name in the sidebar and click the X button that appears. Confirm in the dialog to remove it from the list. The project files themselves are not deleted; only the dashboard registration is removed.

## Navigation

The Dashboard supports browser-style back navigation. Each screen transition is recorded in the navigation history, and the "Back" button returns to the previous screen. When there is no history, it navigates to the main dashboard screen.

Screen transitions include a fade-in animation.

## Technology Stack

| Area | Technology |
|------|------------|
| Framework | Tauri v2 |
| Frontend | React 19, TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Markdown | react-markdown, remark-gfm |
| Font | Inter (400, 500, 600) |
| Backend | Rust (Tauri commands) |

## Source Structure

```
src/dashboard/
├── src/
│   ├── App.tsx                  # App root, routing logic
│   ├── main.tsx                 # Entry point
│   ├── types.ts                 # TypeScript type definitions
│   ├── components/
│   │   ├── Sidebar.tsx          # Sidebar (project list)
│   │   ├── ProjectDashboard.tsx # Project main dashboard
│   │   ├── KanbanBoard.tsx      # Kanban board
│   │   ├── TaskCard.tsx         # Task card
│   │   ├── TaskDetailModal.tsx  # Task detail modal
│   │   ├── MissionHistory.tsx   # Mission history list
│   │   ├── MissionDetailView.tsx # Mission detail (spec, design, reviews)
│   │   ├── DebtDetailPanel.tsx  # Technical debt detail
│   │   ├── DebtDetailModal.tsx  # Debt item detail modal
│   │   ├── DebtPanel.tsx        # Debt summary panel
│   │   ├── DebtBadge.tsx        # Debt severity badge
│   │   ├── TimelineView.tsx     # Event timeline
│   │   ├── MemoryBrowser.tsx    # Agent memory browser
│   │   ├── RulesViewer.tsx      # Rules viewer
│   │   ├── Toast.tsx            # Toast notification component
│   │   ├── PhaseBadge.tsx       # Phase badge
│   │   ├── ProgressBar.tsx      # Progress bar
│   │   ├── AddProjectDialog.tsx # Add project dialog
│   │   ├── EmptyState.tsx       # Empty state screen
│   │   ├── ErrorState.tsx       # Error state screen
│   │   └── ProjectOverview.tsx  # Project overview
│   ├── contexts/
│   │   ├── ToastContext.tsx     # Toast notification state management
│   │   └── ProjectRefreshContext.tsx # Project auto-refresh management
│   ├── hooks/
│   │   └── useNavigationHistory.ts # Navigation history management
│   └── utils/
│       └── dates.ts             # Date formatting utilities
└── src-tauri/                   # Rust backend
    ├── tauri.conf.json          # Tauri configuration
    ├── Cargo.toml               # Rust dependencies
    └── src/                     # Tauri command implementation
```

## Screenshots

### Project Dashboard

![Dashboard Main Screen](../../images/dashboard.png)

The left sidebar shows the project list; the right side displays the selected project's dashboard. The active mission's phase, progress, statistics, and mission list are all visible at a glance.

### Kanban Board

![Kanban Board](../../images/kanvanboard.png)

Tasks are organized into 7 status columns. The currently active task is highlighted in green.

### Toast Notifications

![Toast Notifications](../../images/toast.png)

When events occur, toast notifications appear in the upper-right corner. Colors vary by type, and a progress bar indicates the remaining display time.
