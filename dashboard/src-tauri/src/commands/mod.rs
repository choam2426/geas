#[cfg(test)]
mod tests;

use std::fs;
use std::path::{Path, PathBuf};

use std::sync::Mutex;

use crate::config;
use std::io::{BufRead, BufReader};

use crate::models::{
    DebtInfo, DebtItemInfo, DebtRegister, EventEntry, EventsPage, MemoryDetail, MemoryFile,
    MemorySignalsInfo, MemorySummary, MissionSpec, MissionSpecDetail, MissionSummary,
    ProjectEntry, ProjectSummary, RunState, SeverityRollup, TaskContract, TaskInfo,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Validate and canonicalize a project path. Ensures the path points to an
/// existing directory. Returns the canonical path and its .geas subdirectory.
fn validate_project_path(project_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let raw = PathBuf::from(project_path);
    let canonical = raw
        .canonicalize()
        .map_err(|e| format!("Invalid project path '{}': {e}", project_path))?;
    if !canonical.is_dir() {
        return Err(format!("Not a directory: {}", canonical.display()));
    }
    let geas = canonical.join(".geas");
    Ok((canonical, geas))
}

/// Build the .geas base path for a project (with validation).
fn geas_dir(project_path: &str) -> Result<PathBuf, String> {
    let (_, geas) = validate_project_path(project_path)?;
    Ok(geas)
}

/// Read and deserialize a JSON file. Returns None if the file is missing.
/// Returns Err only on I/O errors other than not-found or on parse failures.
pub(crate) fn read_json_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Result<Option<T>, String> {
    match fs::read_to_string(path) {
        Ok(data) => {
            let parsed: T = serde_json::from_str(&data)
                .map_err(|e| format!("Failed to parse {}: {e}", path.display()))?;
            Ok(Some(parsed))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read {}: {e}", path.display())),
    }
}

/// Validate that a mission_id contains no path traversal characters.
fn validate_mission_id(mission_id: &str) -> Result<(), String> {
    if mission_id.is_empty() {
        return Err("mission_id is required".to_string());
    }
    if mission_id.contains('/') || mission_id.contains('\\') || mission_id.contains("..") {
        return Err(format!("Invalid mission_id: {mission_id}"));
    }
    Ok(())
}

/// Derive a human-friendly project name from the directory path.
pub(crate) fn name_from_path(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

// ---------------------------------------------------------------------------
// Project data commands (read-only .geas/ access)
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_summary(path: String) -> Result<ProjectSummary, String> {
    let geas = match geas_dir(&path) {
        Ok(g) => g,
        Err(_) => {
            return Ok(ProjectSummary {
                name: name_from_path(&path),
                path: path.clone(),
                mission_name: None,
                phase: None,
                task_total: 0,
                task_completed: 0,
                debt_total: 0,
                debt_by_severity: SeverityRollup::default(),
                last_activity: None,
                current_task_id: None,
                agent_in_flight: None,
                pipeline_step: None,
                parallel_batch: None,
                completed_in_batch: vec![],
                status: "error".to_string(),
            });
        }
    };

    // Check if .geas/ directory exists at all
    if !geas.is_dir() {
        return Ok(ProjectSummary {
            name: name_from_path(&path),
            path: path.clone(),
            mission_name: None,
            phase: None,
            task_total: 0,
            task_completed: 0,
            debt_total: 0,
            debt_by_severity: SeverityRollup::default(),
            last_activity: None,
            current_task_id: None,
            agent_in_flight: None,
            pipeline_step: None,
            parallel_batch: None,
            completed_in_batch: vec![],
            status: "no_geas".to_string(),
        });
    }

    // Read run.json
    let run_path = geas.join("state").join("run.json");
    let run_state: RunState = match read_json_file(&run_path)? {
        Some(rs) => rs,
        None => {
            return Ok(ProjectSummary {
                name: name_from_path(&path),
                path: path.clone(),
                mission_name: None,
                phase: None,
                task_total: 0,
                task_completed: 0,
                debt_total: 0,
                debt_by_severity: SeverityRollup::default(),
                last_activity: None,
                current_task_id: None,
                agent_in_flight: None,
                pipeline_step: None,
                parallel_batch: None,
                completed_in_batch: vec![],
                status: "no_geas".to_string(),
            });
        }
    };

    let mission_id = match &run_state.mission_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            // No active mission — return what we know from run.json
            return Ok(ProjectSummary {
                name: name_from_path(&path),
                path: path.clone(),
                mission_name: run_state.mission.clone(),
                phase: run_state.phase.clone(),
                task_total: 0,
                task_completed: 0,
                debt_total: 0,
                debt_by_severity: SeverityRollup::default(),
                last_activity: run_state
                    .checkpoint
                    .as_ref()
                    .and_then(|c| c.last_updated.clone()),
                current_task_id: run_state.current_task_id.clone(),
                agent_in_flight: run_state
                    .checkpoint
                    .as_ref()
                    .and_then(|c| c.agent_in_flight.clone()),
                pipeline_step: run_state
                    .checkpoint
                    .as_ref()
                    .and_then(|c| c.pipeline_step.clone()),
                parallel_batch: run_state
                    .checkpoint
                    .as_ref()
                    .and_then(|c| c.parallel_batch.clone()),
                completed_in_batch: run_state
                    .checkpoint
                    .as_ref()
                    .map(|c| c.completed_in_batch.clone())
                    .unwrap_or_default(),
                status: "ok".to_string(),
            });
        }
    };

    let mission_dir = geas.join("missions").join(&mission_id);

    // Count tasks
    let tasks_dir = mission_dir.join("tasks");
    let (task_total, task_completed) = count_tasks(&tasks_dir)?;

    // Debt
    let debt_path = mission_dir.join("evolution").join("debt-register.json");
    let (debt_total, debt_by_severity) = match read_json_file::<DebtRegister>(&debt_path)? {
        Some(dr) => {
            let total = dr.items.len() as u32;
            let rollup = dr.rollup_by_severity.unwrap_or_default();
            (total, rollup)
        }
        None => (0, SeverityRollup::default()),
    };

    // Last activity
    let last_activity = run_state
        .checkpoint
        .as_ref()
        .and_then(|c| c.last_updated.clone())
        .or_else(|| file_mtime(&run_path));

    Ok(ProjectSummary {
        name: name_from_path(&path),
        path: path.clone(),
        mission_name: run_state.mission.clone(),
        phase: run_state.phase.clone(),
        task_total,
        task_completed,
        debt_total,
        debt_by_severity,
        last_activity,
        current_task_id: run_state.current_task_id.clone(),
        agent_in_flight: run_state
            .checkpoint
            .as_ref()
            .and_then(|c| c.agent_in_flight.clone()),
        pipeline_step: run_state
            .checkpoint
            .as_ref()
            .and_then(|c| c.pipeline_step.clone()),
        parallel_batch: run_state
            .checkpoint
            .as_ref()
            .and_then(|c| c.parallel_batch.clone()),
        completed_in_batch: run_state
            .checkpoint
            .as_ref()
            .map(|c| c.completed_in_batch.clone())
            .unwrap_or_default(),
        status: "ok".to_string(),
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_tasks(path: String, mission_id: String) -> Result<Vec<TaskInfo>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;

    let tasks_dir = geas.join("missions").join(&mission_id).join("tasks");
    read_task_files(&tasks_dir)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_debt(path: String, mission_id: String) -> Result<DebtInfo, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;

    let debt_path = geas
        .join("missions")
        .join(&mission_id)
        .join("evolution")
        .join("debt-register.json");

    let register: DebtRegister = read_json_file(&debt_path)?.unwrap_or_default();

    let total = register.items.len() as u32;
    let by_severity = register.rollup_by_severity.unwrap_or_default();

    let items: Vec<DebtItemInfo> = register
        .items
        .into_iter()
        .map(|item| DebtItemInfo {
            debt_id: item.debt_id.unwrap_or_default(),
            severity: item.severity.unwrap_or_else(|| "unknown".to_string()),
            kind: item.kind,
            title: item.title.unwrap_or_default(),
            status: item.status,
            description: item.description,
            introduced_by_task_id: item.introduced_by_task_id,
        })
        .collect();

    Ok(DebtInfo {
        total,
        by_severity,
        items,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_history(path: String) -> Result<Vec<MissionSummary>, String> {
    let geas = geas_dir(&path)?;

    // Read run.json to identify the active mission
    let run_path = geas.join("state").join("run.json");
    let run_state: Option<RunState> = read_json_file(&run_path)?;
    let active_mission_id = run_state
        .as_ref()
        .and_then(|rs| rs.mission_id.clone())
        .filter(|id| !id.is_empty());
    let active_phase = run_state.as_ref().and_then(|rs| rs.phase.clone());

    // Scan .geas/missions/ for mission-* directories
    let missions_dir = geas.join("missions");
    if !missions_dir.is_dir() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&missions_dir)
        .map_err(|e| format!("Failed to read missions dir: {e}"))?;

    let mut summaries = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let dir_path = entry.path();

        if !dir_path.is_dir() {
            continue;
        }

        let dir_name = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.starts_with("mission-") => name.to_string(),
            _ => continue,
        };

        // Read spec.json for mission name and created_at
        let spec_path = dir_path.join("spec.json");
        let spec: MissionSpec = read_json_file(&spec_path)?.unwrap_or_default();

        // Count tasks
        let tasks_dir = dir_path.join("tasks");
        let (task_total, task_completed) = count_tasks(&tasks_dir)?;

        let is_active = active_mission_id.as_deref() == Some(dir_name.as_str());

        // Determine phase
        let phase = if is_active {
            active_phase.clone()
        } else {
            infer_phase(task_total, task_completed, &tasks_dir)?
        };

        summaries.push(MissionSummary {
            mission_id: dir_name,
            mission_name: spec.mission_name(),
            phase,
            task_total,
            task_completed,
            is_active,
            created_at: spec.created_at,
        });
    }

    // Sort by mission_id descending (latest first)
    summaries.sort_by(|a, b| b.mission_id.cmp(&a.mission_id));

    Ok(summaries)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_spec(path: String, mission_id: String) -> Result<MissionSpecDetail, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let spec_path = geas.join("missions").join(&mission_id).join("spec.json");
    let spec: MissionSpec = read_json_file(&spec_path)?.unwrap_or_default();

    // Call helper methods (borrow &self) before moving fields
    let mission = spec.mission_name();
    let scope_in = spec.resolved_scope_in();
    let scope_out = spec.resolved_scope_out();
    let constraints = spec.resolved_constraints();
    let risk_notes = spec.resolved_risk_notes();

    Ok(MissionSpecDetail {
        mission_id,
        mission,
        done_when: spec.done_when,
        scope_in,
        scope_out,
        acceptance_criteria: spec.acceptance_criteria.unwrap_or_default(),
        constraints,
        domain_profile: spec.domain_profile,
        mode: spec.mode,
        target_user: spec.target_user,
        risk_notes,
        assumptions: spec.assumptions.unwrap_or_default(),
        created_at: spec.created_at,
    })
}

// ---------------------------------------------------------------------------
// Memory commands
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_memories(path: String) -> Result<Vec<MemorySummary>, String> {
    let geas = geas_dir(&path)?;
    let memory_dir = geas.join("memory");

    let mut results = Vec::new();

    for source_dir in &["entries", "candidates"] {
        let dir = memory_dir.join(source_dir);
        if !dir.is_dir() {
            continue;
        }
        collect_memory_summaries(&dir, source_dir, &mut results);
    }

    Ok(results)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_memory_detail(path: String, memory_id: String) -> Result<MemoryDetail, String> {
    if memory_id.is_empty() {
        return Err("memory_id is required".to_string());
    }
    let geas = geas_dir(&path)?;
    let memory_dir = geas.join("memory");

    for source_dir in &["entries", "candidates"] {
        let dir = memory_dir.join(source_dir);
        if !dir.is_dir() {
            continue;
        }
        if let Some(detail) = find_memory_by_id(&dir, source_dir, &memory_id) {
            return Ok(detail);
        }
    }

    Err(format!("Memory not found: {memory_id}"))
}

// ---------------------------------------------------------------------------
// Config management commands
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<ProjectEntry>, String> {
    let cfg = config::read_config(&app_handle)?;
    Ok(cfg.projects)
}

#[tauri::command(rename_all = "snake_case")]
pub fn add_project(
    app_handle: tauri::AppHandle,
    watcher_state: tauri::State<'_, Mutex<crate::watcher::WatcherState>>,
    path: String,
) -> Result<ProjectEntry, String> {
    // Validate path is a real directory
    let (canonical, _) = validate_project_path(&path)?;
    let canonical_str = canonical.to_string_lossy().to_string();

    let mut cfg = config::read_config(&app_handle)?;

    // Prevent duplicates (check both original and canonical paths)
    if cfg.projects.iter().any(|p| p.path == path || p.path == canonical_str) {
        return Err(format!("Project path already registered: {path}"));
    }

    let entry = ProjectEntry {
        name: name_from_path(&canonical_str),
        path: canonical_str.clone(),
    };

    cfg.projects.push(entry.clone());
    config::write_config(&app_handle, &cfg)?;

    // Register the new project path with the file watcher
    if let Ok(mut state) = watcher_state.lock() {
        crate::watcher::register_path(&mut state, &canonical_str);
    }

    Ok(entry)
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove_project(
    app_handle: tauri::AppHandle,
    watcher_state: tauri::State<'_, Mutex<crate::watcher::WatcherState>>,
    path: String,
) -> Result<(), String> {
    let mut cfg = config::read_config(&app_handle)?;

    let before = cfg.projects.len();
    cfg.projects.retain(|p| p.path != path);

    if cfg.projects.len() == before {
        return Err(format!("Project path not found: {path}"));
    }

    config::write_config(&app_handle, &cfg)?;

    // Unregister the project path from the file watcher
    if let Ok(mut state) = watcher_state.lock() {
        crate::watcher::unregister_path(&mut state, &path);
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_rules(path: String) -> Result<String, String> {
    let (_canonical, geas) = validate_project_path(&path)?;
    let rules_path = geas.join("rules.md");
    match fs::read_to_string(&rules_path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!(
            "Failed to read rules.md at {}: {e}",
            rules_path.display()
        )),
    }
}

// ---------------------------------------------------------------------------
// Timeline / Events
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_events(
    path: String,
    mission_id: Option<String>,
    event_type: Option<String>,
    page: usize,
    page_size: usize,
) -> Result<EventsPage, String> {
    let (_canonical, geas) = validate_project_path(&path)?;

    // Check both paths — prefer ledger if both exist
    let ledger_path = geas.join("ledger").join("events.jsonl");
    let state_path = geas.join("state").join("events.jsonl");
    let events_path = if ledger_path.exists() {
        ledger_path
    } else if state_path.exists() {
        state_path
    } else {
        return Ok(EventsPage {
            events: vec![],
            total_count: 0,
            page,
            page_size,
        });
    };

    let file = fs::File::open(&events_path)
        .map_err(|e| format!("Failed to open events.jsonl: {e}"))?;
    let reader = BufReader::new(file);

    let mut all_events: Vec<EventEntry> = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let entry: EventEntry = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(_) => continue, // skip malformed lines
        };

        // Filter by mission_id if provided — use parsed field first, fall back to data
        if let Some(ref mid) = mission_id {
            let matches = if let Some(ref entry_mid) = entry.mission_id {
                entry_mid == mid
            } else if let Some(ref data) = entry.data {
                data.get("mission_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s == mid.as_str())
                    .unwrap_or(false)
            } else {
                false
            };
            if !matches {
                continue;
            }
        }

        // Filter by event_type if provided
        if let Some(ref et) = event_type {
            if entry.event_type != *et {
                continue;
            }
        }

        all_events.push(entry);
    }

    // Sort by timestamp descending (newest first)
    all_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let total_count = all_events.len();
    let skip = page * page_size;
    let events: Vec<EventEntry> = all_events.into_iter().skip(skip).take(page_size).collect();

    Ok(EventsPage {
        events,
        total_count,
        page,
        page_size,
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Infer the phase for a non-active mission based on task statuses.
fn infer_phase(task_total: u32, task_completed: u32, tasks_dir: &Path) -> Result<Option<String>, String> {
    if task_total == 0 {
        return Ok(None);
    }

    if task_completed == task_total {
        return Ok(Some("complete".to_string()));
    }

    // Check if any task is in an active state
    if tasks_dir.is_dir() {
        let entries = fs::read_dir(tasks_dir)
            .map_err(|e| format!("Failed to read tasks dir: {e}"))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Some(tc) = read_json_file::<TaskContract>(&path)? {
                match tc.status.as_deref() {
                    Some("implementing") | Some("reviewed") | Some("integrated") => {
                        return Ok(Some("building".to_string()));
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(None)
}

/// Count total and completed ("passed") tasks in a tasks directory.
fn count_tasks(tasks_dir: &PathBuf) -> Result<(u32, u32), String> {
    if !tasks_dir.is_dir() {
        return Ok((0, 0));
    }

    let entries = fs::read_dir(tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir {}: {e}", tasks_dir.display()))?;

    let mut total: u32 = 0;
    let mut completed: u32 = 0;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        if let Some(tc) = read_json_file::<TaskContract>(&path)? {
            total += 1;
            if tc.status.as_deref() == Some("passed") {
                completed += 1;
            }
        }
    }

    Ok((total, completed))
}

/// Read all task JSON files and convert to TaskInfo.
fn read_task_files(tasks_dir: &PathBuf) -> Result<Vec<TaskInfo>, String> {
    if !tasks_dir.is_dir() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir {}: {e}", tasks_dir.display()))?;

    let mut tasks = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        if let Some(tc) = read_json_file::<TaskContract>(&path)? {
            tasks.push(TaskInfo {
                task_id: tc.task_id.unwrap_or_default(),
                title: tc.title.unwrap_or_default(),
                goal: tc.goal,
                status: tc.status.unwrap_or_else(|| "unknown".to_string()),
                risk_level: tc.risk_level,
                task_kind: tc.task_kind,
                worker_type: tc
                    .routing
                    .as_ref()
                    .and_then(|r| r.primary_worker_type.clone()),
                acceptance_criteria: tc.acceptance_criteria,
                scope_surfaces: tc.scope.map(|s| s.surfaces).unwrap_or_default(),
            });
        }
    }

    Ok(tasks)
}

/// Try to get the file modification time as an ISO 8601 UTC string.
fn file_mtime(path: &PathBuf) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
    Some(datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string())
}

/// Recursively collect memory summaries from a directory, skipping malformed files.
fn collect_memory_summaries(dir: &Path, source_dir: &str, results: &mut Vec<MemorySummary>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        if path.is_dir() {
            collect_memory_summaries(&path, source_dir, results);
            continue;
        }

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let mf: MemoryFile = match read_json_file(&path) {
            Ok(Some(f)) => f,
            _ => {
                log::warn!("Skipping malformed memory file: {}", path.display());
                continue;
            }
        };

        let memory_id = match &mf.memory_id {
            Some(id) if !id.is_empty() => id.clone(),
            _ => continue,
        };

        results.push(MemorySummary {
            memory_id,
            memory_type: mf.memory_type.unwrap_or_else(|| "unknown".to_string()),
            state: mf.state.unwrap_or_else(|| "unknown".to_string()),
            title: mf.title.unwrap_or_default(),
            summary: mf.summary.unwrap_or_default(),
            scope: mf.scope.unwrap_or_else(|| "unknown".to_string()),
            tags: mf.tags.unwrap_or_default(),
            created_at: mf.meta.as_ref().and_then(|m| m.created_at.clone()),
            source_dir: source_dir.to_string(),
        });
    }
}

/// Recursively search for a memory file by memory_id and return its detail.
fn find_memory_by_id(dir: &Path, source_dir: &str, target_id: &str) -> Option<MemoryDetail> {
    let entries = fs::read_dir(dir).ok()?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        if path.is_dir() {
            if let Some(detail) = find_memory_by_id(&path, source_dir, target_id) {
                return Some(detail);
            }
            continue;
        }

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let mf: MemoryFile = match read_json_file(&path) {
            Ok(Some(f)) => f,
            _ => continue,
        };

        if mf.memory_id.as_deref() != Some(target_id) {
            continue;
        }

        let signals_info = mf.signals.as_ref().map(|s| MemorySignalsInfo {
            evidence_count: s.evidence_count.unwrap_or(0),
            reuse_count: s.reuse_count.unwrap_or(0),
            confidence: s.confidence.unwrap_or(0.0),
        });

        return Some(MemoryDetail {
            memory_id: target_id.to_string(),
            memory_type: mf.memory_type.unwrap_or_else(|| "unknown".to_string()),
            state: mf.state.unwrap_or_else(|| "unknown".to_string()),
            title: mf.title.unwrap_or_default(),
            summary: mf.summary.unwrap_or_default(),
            scope: mf.scope.unwrap_or_else(|| "unknown".to_string()),
            body: mf.body.unwrap_or_default(),
            tags: mf.tags.unwrap_or_default(),
            evidence_refs: mf.evidence_refs.unwrap_or_default(),
            signals: signals_info,
            review_after: mf.review_after,
            supersedes: mf.supersedes.unwrap_or_default(),
            superseded_by: mf.superseded_by,
            created_at: mf.meta.as_ref().and_then(|m| m.created_at.clone()),
            updated_at: mf.meta.as_ref().and_then(|m| m.updated_at.clone()),
            source_dir: source_dir.to_string(),
        });
    }

    None
}
