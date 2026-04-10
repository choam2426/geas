use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::models::RunState;
use crate::commands::read_json_file;

/// Event name emitted when a watched project's .geas/ directory changes.
pub const PROJECT_CHANGED_EVENT: &str = "geas://project-changed";

/// Event name emitted for toast notifications classified from run.json changes.
pub const TOAST_EVENT: &str = "geas://toast";

/// Payload sent with the project-changed event.
#[derive(Clone, Debug, Serialize)]
pub struct ProjectChangedPayload {
    pub path: String,
}

/// Payload sent with the toast event.
#[derive(Clone, Debug, Serialize)]
pub struct ToastEvent {
    pub toast_type: String,
    pub title: String,
    pub message: String,
}

/// Holds the debounced watcher and the set of currently watched project roots.
pub struct WatcherState {
    debouncer: Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    watched_roots: HashSet<PathBuf>,
}

/// Subdirectories inside .geas/ that we monitor for changes.
const GEAS_WATCH_SUBDIRS: &[&str] = &["state", "missions", "ledger", "memory"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Create a new `WatcherState`, start watching the given project paths, and
/// return the state wrapped in a `Mutex` suitable for `app.manage()`.
pub fn start_watching(app_handle: AppHandle, paths: &[String]) -> Mutex<WatcherState> {
    let handle = app_handle.clone();

    // Store previous RunState per project root for toast classification.
    let prev_states: std::sync::Arc<Mutex<HashMap<PathBuf, RunState>>> =
        std::sync::Arc::new(Mutex::new(HashMap::new()));

    // Seed prev_states with current run.json for each project so that
    // the first file-change event can produce a meaningful delta.
    {
        let mut map = prev_states.lock().expect("Failed to lock prev_states for seeding");
        for project_path in paths {
            let root = PathBuf::from(project_path);
            let run_path = root.join(".geas").join("state").join("run.json");
            if let Ok(Some(rs)) = read_json_file::<RunState>(&run_path) {
                map.insert(root, rs);
            }
        }
    }

    let prev_states_clone = prev_states.clone();

    let mut debouncer = new_debouncer(Duration::from_millis(200), move |res| {
        handle_debounced_event(&handle, &prev_states_clone, res);
    })
    .expect("Failed to create file watcher");

    let mut watched_roots = HashSet::new();

    for project_path in paths {
        let root = PathBuf::from(project_path);
        watch_project(&mut debouncer, &root);
        watched_roots.insert(root);
    }

    Mutex::new(WatcherState {
        debouncer,
        watched_roots,
    })
}

/// Register a new project path with the watcher.
pub fn register_path(state: &mut WatcherState, path: &str) {
    let root = PathBuf::from(path);
    if state.watched_roots.contains(&root) {
        return;
    }
    watch_project(&mut state.debouncer, &root);
    state.watched_roots.insert(root);
}

/// Unregister a project path from the watcher.
pub fn unregister_path(state: &mut WatcherState, path: &str) {
    let root = PathBuf::from(path);
    if !state.watched_roots.remove(&root) {
        return;
    }
    unwatch_project(&mut state.debouncer, &root);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Start watching the .geas/ subdirectories for a single project root.
fn watch_project(
    debouncer: &mut Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    root: &Path,
) {
    let geas_dir = root.join(".geas");
    for subdir in GEAS_WATCH_SUBDIRS {
        let target = geas_dir.join(subdir);
        if target.is_dir() {
            if let Err(e) = debouncer
                .watcher()
                .watch(&target, RecursiveMode::Recursive)
            {
                log::warn!(
                    "Failed to watch {}: {e}",
                    target.display()
                );
            }
        } else {
            log::info!(
                "Skipping non-existent watch target: {}",
                target.display()
            );
        }
    }
}

/// Stop watching the .geas/ subdirectories for a single project root.
fn unwatch_project(
    debouncer: &mut Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    root: &Path,
) {
    let geas_dir = root.join(".geas");
    for subdir in GEAS_WATCH_SUBDIRS {
        let target = geas_dir.join(subdir);
        // Unwatch even if the directory no longer exists — notify handles it gracefully.
        let _ = debouncer.watcher().unwatch(&target);
    }
}

/// Called by the debouncer when file events arrive. Resolves changed paths
/// back to their project root and emits `PROJECT_CHANGED_EVENT`.
/// Also detects run.json changes and emits classified `TOAST_EVENT`.
fn handle_debounced_event(
    app_handle: &AppHandle,
    prev_states: &Mutex<HashMap<PathBuf, RunState>>,
    result: notify_debouncer_mini::DebounceEventResult,
) {
    match result {
        Ok(events) => {
            // Collect unique project roots that were affected.
            let mut notified_roots: HashSet<PathBuf> = HashSet::new();
            // Track which project roots had run.json changes
            let mut run_json_roots: HashSet<PathBuf> = HashSet::new();

            for event in &events {
                // Check if the changed path is a run.json file
                if event.path.file_name().map(|n| n == "run.json").unwrap_or(false) {
                    if let Some(root) = resolve_project_root(&event.path) {
                        run_json_roots.insert(root.clone());
                    }
                }
                if let Some(root) = resolve_project_root(&event.path) {
                    if notified_roots.insert(root.clone()) {
                        let payload = ProjectChangedPayload {
                            path: normalize_path(&root),
                        };
                        if let Err(e) = app_handle.emit(PROJECT_CHANGED_EVENT, &payload) {
                            log::warn!("Failed to emit {PROJECT_CHANGED_EVENT}: {e}");
                        }
                    }
                }
            }

            // Classify run.json changes and emit toast events
            for root in run_json_roots {
                let run_path = root.join(".geas").join("state").join("run.json");
                let new_state: RunState = match read_json_file(&run_path) {
                    Ok(Some(rs)) => rs,
                    _ => continue,
                };

                let toasts = if let Ok(mut map) = prev_states.lock() {
                    let prev = map.get(&root).cloned();
                    let toasts = classify_run_change(prev.as_ref(), &new_state);
                    map.insert(root.clone(), new_state);
                    toasts
                } else {
                    vec![]
                };

                for toast in toasts {
                    if let Err(e) = app_handle.emit(TOAST_EVENT, &toast) {
                        log::warn!("Failed to emit {TOAST_EVENT}: {e}");
                    }
                }
            }
        }
        Err(err) => {
            log::warn!("File watcher error: {err:?}");
        }
    }
}

/// Compare previous and current RunState to classify changes into toast events.
fn classify_run_change(prev: Option<&RunState>, current: &RunState) -> Vec<ToastEvent> {
    let mut toasts = Vec::new();

    match prev {
        None => {
            // First time seeing this project — no toasts to emit
        }
        Some(prev) => {
            // Check for mission_completed: status changed to "complete"
            if current.status.as_deref() == Some("complete")
                && prev.status.as_deref() != Some("complete")
            {
                toasts.push(ToastEvent {
                    toast_type: "mission_completed".to_string(),
                    title: "Mission Completed".to_string(),
                    message: format!(
                        "Mission {} has completed",
                        current.mission.as_deref().unwrap_or("unknown")
                    ),
                });
            }

            // Check for phase_changed
            if current.phase != prev.phase {
                if let Some(ref phase) = current.phase {
                    toasts.push(ToastEvent {
                        toast_type: "phase_changed".to_string(),
                        title: "Phase Changed".to_string(),
                        message: format!("Entered {} phase", phase),
                    });
                }
            }

            // Check for task_started: current_task_id changed to a different value
            if current.current_task_id.is_some()
                && current.current_task_id != prev.current_task_id
            {
                toasts.push(ToastEvent {
                    toast_type: "task_started".to_string(),
                    title: "Task Started".to_string(),
                    message: format!(
                        "Started {}",
                        current.current_task_id.as_deref().unwrap_or("unknown")
                    ),
                });
            }

            // Check for task_completed: new task added to completed_tasks
            let prev_completed: HashSet<&str> =
                prev.completed_tasks.iter().map(|s| s.as_str()).collect();
            for task_id in &current.completed_tasks {
                if !prev_completed.contains(task_id.as_str()) {
                    toasts.push(ToastEvent {
                        toast_type: "task_completed".to_string(),
                        title: "Task Completed".to_string(),
                        message: format!("{} has been completed", task_id),
                    });
                }
            }
        }
    }

    toasts
}

/// Normalize a path for cross-platform consistency:
/// - Strip the `\\?\` extended-length prefix that Windows `canonicalize()` produces
/// - Convert backslashes to forward slashes
fn normalize_path(p: &Path) -> String {
    let s = p.to_string_lossy().to_string();
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    s.replace('\\', "/")
}

/// Walk up from a changed path to find the project root.
/// The project root is the parent of the `.geas` directory.
fn resolve_project_root(changed_path: &Path) -> Option<PathBuf> {
    let mut current = changed_path;
    loop {
        if current.file_name().map(|n| n == ".geas").unwrap_or(false) {
            return current.parent().map(|p| p.to_path_buf());
        }
        match current.parent() {
            Some(parent) => current = parent,
            None => return None,
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_project_root_unix_style() {
        let p = PathBuf::from("/home/user/project/.geas/state/run.json");
        assert_eq!(
            resolve_project_root(&p),
            Some(PathBuf::from("/home/user/project"))
        );
    }

    #[test]
    fn resolve_project_root_windows_style() {
        let p = PathBuf::from("C:\\Users\\foo\\project\\.geas\\missions\\m1\\tasks\\t1.json");
        assert_eq!(
            resolve_project_root(&p),
            Some(PathBuf::from("C:\\Users\\foo\\project"))
        );
    }

    #[test]
    fn resolve_project_root_no_geas() {
        let p = PathBuf::from("/home/user/project/src/main.rs");
        assert_eq!(resolve_project_root(&p), None);
    }

    #[test]
    fn resolve_project_root_geas_itself() {
        let p = PathBuf::from("/home/user/project/.geas");
        assert_eq!(
            resolve_project_root(&p),
            Some(PathBuf::from("/home/user/project"))
        );
    }

    #[test]
    fn normalize_path_strips_extended_prefix() {
        let p = PathBuf::from(r"\\?\C:\Users\foo\project");
        assert_eq!(normalize_path(&p), "C:/Users/foo/project");
    }

    #[test]
    fn normalize_path_converts_backslashes() {
        let p = PathBuf::from(r"C:\Users\foo\project");
        assert_eq!(normalize_path(&p), "C:/Users/foo/project");
    }

    #[test]
    fn normalize_path_unix_noop() {
        let p = PathBuf::from("/home/user/project");
        assert_eq!(normalize_path(&p), "/home/user/project");
    }
}
