use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Event name emitted when a watched project's .geas/ directory changes.
pub const PROJECT_CHANGED_EVENT: &str = "geas://project-changed";

#[derive(Clone, Debug, Serialize)]
pub struct ProjectChangedPayload {
    pub path: String,
}

/// Holds the debounced watcher and the set of currently watched project roots.
pub struct WatcherState {
    debouncer: Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    watched_roots: Arc<Mutex<HashSet<PathBuf>>>,
}

/// Subdirectories and files inside .geas/ that we monitor for changes. We watch
/// the .geas/ directory itself non-recursively for project-level JSON files
/// (debts.json, events.jsonl) and watch missions/memory recursively.
const GEAS_WATCH_SUBDIRS: &[&str] = &["missions", "memory"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub fn start_watching(app_handle: AppHandle, paths: &[String]) -> Mutex<WatcherState> {
    let handle = app_handle.clone();
    let watched_roots: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));
    let watched_roots_clone = watched_roots.clone();

    let mut debouncer = new_debouncer(Duration::from_millis(200), move |res| {
        handle_debounced_event(&handle, &watched_roots_clone, res);
    })
    .expect("Failed to create file watcher");

    {
        let mut roots = watched_roots.lock().expect("Failed to lock watched_roots");
        for project_path in paths {
            let root = PathBuf::from(project_path);
            watch_project(&mut debouncer, &root);
            roots.insert(root);
        }
    }

    Mutex::new(WatcherState {
        debouncer,
        watched_roots,
    })
}

pub fn register_path(state: &mut WatcherState, path: &str) {
    let root = PathBuf::from(path);
    let mut roots = state.watched_roots.lock().expect("Failed to lock watched_roots");
    if roots.contains(&root) {
        return;
    }
    watch_project(&mut state.debouncer, &root);
    roots.insert(root);
}

pub fn unregister_path(state: &mut WatcherState, path: &str) {
    let root = PathBuf::from(path);
    let mut roots = state.watched_roots.lock().expect("Failed to lock watched_roots");
    if !roots.remove(&root) {
        return;
    }
    unwatch_project(&mut state.debouncer, &root);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn watch_project(
    debouncer: &mut Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    root: &Path,
) {
    let geas_dir = root.join(".geas");
    // Watch .geas itself non-recursively so that debts.json / events.jsonl
    // changes at the root are captured.
    if geas_dir.is_dir() {
        if let Err(e) = debouncer
            .watcher()
            .watch(&geas_dir, RecursiveMode::NonRecursive)
        {
            log::warn!("Failed to watch {}: {e}", geas_dir.display());
        }
    }
    for subdir in GEAS_WATCH_SUBDIRS {
        let target = geas_dir.join(subdir);
        if target.is_dir() {
            if let Err(e) = debouncer
                .watcher()
                .watch(&target, RecursiveMode::Recursive)
            {
                log::warn!("Failed to watch {}: {e}", target.display());
            }
        } else {
            log::info!("Skipping non-existent watch target: {}", target.display());
        }
    }
}

fn unwatch_project(
    debouncer: &mut Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
    root: &Path,
) {
    let geas_dir = root.join(".geas");
    let _ = debouncer.watcher().unwatch(&geas_dir);
    for subdir in GEAS_WATCH_SUBDIRS {
        let target = geas_dir.join(subdir);
        let _ = debouncer.watcher().unwatch(&target);
    }
}

fn handle_debounced_event(
    app_handle: &AppHandle,
    watched_roots: &Mutex<HashSet<PathBuf>>,
    result: notify_debouncer_mini::DebounceEventResult,
) {
    match result {
        Ok(events) => {
            let roots_snapshot: Vec<PathBuf> = match watched_roots.lock() {
                Ok(guard) => guard.iter().cloned().collect(),
                Err(_) => return,
            };

            let mut notified_roots: HashSet<PathBuf> = HashSet::new();
            for event in &events {
                let Some(root) = resolve_registered_root(&event.path, &roots_snapshot) else {
                    continue;
                };
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
        Err(err) => {
            log::warn!("File watcher error: {err:?}");
        }
    }
}

fn normalize_path(p: &Path) -> String {
    let s = p.to_string_lossy().to_string();
    let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    s.replace('\\', "/")
}

fn resolve_registered_root(changed_path: &Path, roots: &[PathBuf]) -> Option<PathBuf> {
    let changed_norm = normalize_path(changed_path);
    for root in roots {
        let geas_norm = normalize_path(&root.join(".geas"));
        if changed_norm == geas_norm
            || changed_norm.starts_with(&format!("{}/", geas_norm))
        {
            return Some(root.clone());
        }
    }
    None
}

#[cfg(test)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_project_root_unix_style() {
        let p = PathBuf::from("/home/user/project/.geas/missions/m1/tasks/t1/contract.json");
        assert_eq!(
            resolve_project_root(&p),
            Some(PathBuf::from("/home/user/project"))
        );
    }

    #[test]
    fn resolve_project_root_no_geas() {
        let p = PathBuf::from("/home/user/project/src/main.rs");
        assert_eq!(resolve_project_root(&p), None);
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
    fn resolve_registered_root_matches_windows_prefixed_root_from_bare_event() {
        let roots = vec![PathBuf::from(r"\\?\A:\geas")];
        let event = PathBuf::from(r"A:\geas\.geas\debts.json");
        assert_eq!(
            resolve_registered_root(&event, &roots),
            Some(PathBuf::from(r"\\?\A:\geas"))
        );
    }

    #[test]
    fn resolve_registered_root_matches_unix() {
        let roots = vec![PathBuf::from("/home/user/project")];
        let event = PathBuf::from("/home/user/project/.geas/missions/m1/tasks/t1/contract.json");
        assert_eq!(
            resolve_registered_root(&event, &roots),
            Some(PathBuf::from("/home/user/project"))
        );
    }

    #[test]
    fn resolve_registered_root_rejects_sibling_with_common_prefix() {
        let roots = vec![PathBuf::from("/home/user/proj")];
        let event = PathBuf::from("/home/user/proj-other/.geas/debts.json");
        assert_eq!(resolve_registered_root(&event, &roots), None);
    }
}
