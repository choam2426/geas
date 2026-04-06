use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Event name emitted when a watched project's .geas/ directory changes.
pub const PROJECT_CHANGED_EVENT: &str = "geas://project-changed";

/// Payload sent with the project-changed event.
#[derive(Clone, Debug, Serialize)]
pub struct ProjectChangedPayload {
    pub path: String,
}

/// Holds the debounced watcher and the set of currently watched project roots.
pub struct WatcherState {
    debouncer: Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    watched_roots: HashSet<PathBuf>,
}

/// Subdirectories inside .geas/ that we monitor for changes.
const GEAS_WATCH_SUBDIRS: &[&str] = &["state", "missions"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Create a new `WatcherState`, start watching the given project paths, and
/// return the state wrapped in a `Mutex` suitable for `app.manage()`.
pub fn start_watching(app_handle: AppHandle, paths: &[String]) -> Mutex<WatcherState> {
    let handle = app_handle.clone();

    let mut debouncer = new_debouncer(Duration::from_millis(500), move |res| {
        handle_debounced_event(&handle, res);
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
fn handle_debounced_event(
    app_handle: &AppHandle,
    result: notify_debouncer_mini::DebounceEventResult,
) {
    match result {
        Ok(events) => {
            // Collect unique project roots that were affected.
            let mut notified_roots: HashSet<PathBuf> = HashSet::new();
            for event in &events {
                if let Some(root) = resolve_project_root(&event.path) {
                    if notified_roots.insert(root.clone()) {
                        let payload = ProjectChangedPayload {
                            path: root.to_string_lossy().to_string(),
                        };
                        if let Err(e) = app_handle.emit(PROJECT_CHANGED_EVENT, &payload) {
                            log::warn!("Failed to emit {PROJECT_CHANGED_EVENT}: {e}");
                        }
                    }
                }
            }
        }
        Err(err) => {
            log::warn!("File watcher error: {err:?}");
        }
    }
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
}
