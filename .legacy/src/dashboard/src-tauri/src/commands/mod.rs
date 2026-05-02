use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::config;
use crate::models::{
    AgentMemory, Debts, DebtEntry, DeliberationsFile, EventEntry, EventsPage,
    EvidenceFile, EvidenceFileMeta, Gap, GateResults, ImplementationContract,
    KindRollup, MemoryUpdate, MissionDetail, MissionSpec, MissionState,
    MissionSummary, MissionVerdictsFile, PhaseReviewsFile, ProjectEntry,
    ProjectSummary, SelfCheck, SeverityRollup, TaskContract, TaskDetail,
    TaskRow, TaskState,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Validate and canonicalize a project path. Returns (canonical, .geas dir).
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

fn geas_dir(project_path: &str) -> Result<PathBuf, String> {
    let (_, geas) = validate_project_path(project_path)?;
    Ok(geas)
}

/// Read and deserialize a JSON file. None on missing file; Err on parse failure.
pub(crate) fn read_json_file<T: serde::de::DeserializeOwned>(
    path: &PathBuf,
) -> Result<Option<T>, String> {
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

fn read_text_file(path: &PathBuf) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(data) => Ok(Some(data)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read {}: {e}", path.display())),
    }
}

fn validate_mission_id(mission_id: &str) -> Result<(), String> {
    if mission_id.is_empty() {
        return Err("mission_id is required".to_string());
    }
    if mission_id.contains('/') || mission_id.contains('\\') || mission_id.contains("..") {
        return Err(format!("Invalid mission_id: {mission_id}"));
    }
    Ok(())
}

fn validate_task_id(task_id: &str) -> Result<(), String> {
    if task_id.is_empty() {
        return Err("task_id is required".to_string());
    }
    if task_id.contains('/') || task_id.contains('\\') || task_id.contains("..") {
        return Err(format!("Invalid task_id: {task_id}"));
    }
    Ok(())
}

pub(crate) fn name_from_path(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn file_mtime(path: &PathBuf) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
    Some(datetime.format("%Y-%m-%dT%H:%M:%SZ").to_string())
}

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
        if !path.is_dir() {
            continue;
        }
        // A task directory is any dir containing contract.json
        if !path.join("contract.json").is_file() {
            continue;
        }
        total += 1;
        let state: Option<TaskState> = read_json_file(&path.join("task-state.json"))?;
        if let Some(ts) = state {
            if ts.status.as_deref() == Some("passed") {
                completed += 1;
            }
        }
    }
    Ok((total, completed))
}

fn rollup_debts(debts: &Debts) -> (u32, SeverityRollup, KindRollup) {
    let mut sev = SeverityRollup::default();
    let mut kind = KindRollup::default();
    let mut open_count: u32 = 0;
    for entry in &debts.entries {
        if entry.status.as_deref() != Some("open") {
            continue;
        }
        open_count += 1;
        match entry.severity.as_deref() {
            Some("low") => sev.low += 1,
            Some("normal") => sev.normal += 1,
            Some("high") => sev.high += 1,
            Some("critical") => sev.critical += 1,
            _ => {}
        }
        match entry.kind.as_deref() {
            Some("output_quality") => kind.output_quality += 1,
            Some("verification_gap") => kind.verification_gap += 1,
            Some("structural") => kind.structural += 1,
            Some("risk") => kind.risk += 1,
            Some("process") => kind.process += 1,
            Some("documentation") => kind.documentation += 1,
            Some("operations") => kind.operations += 1,
            _ => {}
        }
    }
    (open_count, sev, kind)
}

// ---------------------------------------------------------------------------
// Project registry
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
    let (canonical, _) = validate_project_path(&path)?;
    let canonical_str = canonical.to_string_lossy().to_string();

    let mut cfg = config::read_config(&app_handle)?;
    if cfg.projects.iter().any(|p| p.path == path || p.path == canonical_str) {
        return Err(format!("Project path already registered: {path}"));
    }

    let entry = ProjectEntry {
        name: name_from_path(&canonical_str),
        path: canonical_str.clone(),
    };
    cfg.projects.push(entry.clone());
    config::write_config(&app_handle, &cfg)?;

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

    if let Ok(mut state) = watcher_state.lock() {
        crate::watcher::unregister_path(&mut state, &path);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Project-level summaries
// ---------------------------------------------------------------------------

fn empty_project_summary(path: &str, status: &str) -> ProjectSummary {
    ProjectSummary {
        name: name_from_path(path),
        path: path.to_string(),
        mission_id: None,
        mission_name: None,
        phase: None,
        task_total: 0,
        task_completed: 0,
        active_tasks: vec![],
        debt_total: 0,
        debt_by_severity: SeverityRollup::default(),
        last_activity: None,
        status: status.to_string(),
    }
}

/// Find the "active" mission: the one whose mission-state.phase is not
/// "complete" and has the most recent updated_at. If all missions are complete,
/// return the most recently updated one.
fn find_active_mission(missions_dir: &PathBuf) -> Result<Option<(String, MissionState, Option<MissionSpec>)>, String> {
    if !missions_dir.is_dir() {
        return Ok(None);
    }
    let mut candidates: Vec<(String, MissionState, Option<MissionSpec>, String)> = Vec::new();
    for entry in fs::read_dir(missions_dir).map_err(|e| format!("Failed to read missions dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let dir_path = entry.path();
        if !dir_path.is_dir() {
            continue;
        }
        let dir_name = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.starts_with("mission-") => name.to_string(),
            _ => continue,
        };
        let state: Option<MissionState> = read_json_file(&dir_path.join("mission-state.json"))?;
        let spec: Option<MissionSpec> = read_json_file(&dir_path.join("spec.json"))?;
        let state = match state {
            Some(s) => s,
            None => continue,
        };
        let updated_at = state.updated_at.clone().unwrap_or_default();
        candidates.push((dir_name, state, spec, updated_at));
    }
    // Prefer non-complete; then sort by updated_at desc
    candidates.sort_by(|a, b| {
        let a_active = a.1.phase.as_deref() != Some("complete");
        let b_active = b.1.phase.as_deref() != Some("complete");
        b_active.cmp(&a_active).then_with(|| b.3.cmp(&a.3))
    });
    Ok(candidates.into_iter().next().map(|(id, state, spec, _)| (id, state, spec)))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_project_summary(path: String) -> Result<ProjectSummary, String> {
    let geas = match geas_dir(&path) {
        Ok(g) => g,
        Err(_) => return Ok(empty_project_summary(&path, "error")),
    };
    if !geas.is_dir() {
        return Ok(empty_project_summary(&path, "no_geas"));
    }

    let missions_dir = geas.join("missions");
    let active = find_active_mission(&missions_dir)?;

    // Project-level debts
    let debts_path = geas.join("debts.json");
    let debts: Debts = read_json_file(&debts_path)?.unwrap_or_default();
    let (debt_total, debt_by_severity, _by_kind) = rollup_debts(&debts);

    // Last activity: newest file mtime across events.jsonl, mission-state, task-state
    let events_path = geas.join("events.jsonl");
    let events_mtime = file_mtime(&events_path);

    let (mission_id, mission_name, phase, task_total, task_completed, active_tasks, last_activity_state) =
        if let Some((mid, state, spec)) = active {
            let tasks_dir = missions_dir.join(&mid).join("tasks");
            let (total, completed) = count_tasks(&tasks_dir)?;
            let la = state.updated_at.clone();
            (
                Some(mid),
                spec.and_then(|s| s.name),
                state.phase,
                total,
                completed,
                state.active_tasks,
                la,
            )
        } else {
            (None, None, None, 0, 0, vec![], None)
        };

    // Last activity = max(events_mtime, mission-state.updated_at)
    let last_activity = match (events_mtime, last_activity_state) {
        (Some(a), Some(b)) => Some(if a > b { a } else { b }),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    };

    Ok(ProjectSummary {
        name: name_from_path(&path),
        path,
        mission_id,
        mission_name,
        phase,
        task_total,
        task_completed,
        active_tasks,
        debt_total,
        debt_by_severity,
        last_activity,
        status: "ok".to_string(),
    })
}

// ---------------------------------------------------------------------------
// Mission history / detail
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_history(path: String) -> Result<Vec<MissionSummary>, String> {
    let geas = geas_dir(&path)?;
    let missions_dir = geas.join("missions");
    if !missions_dir.is_dir() {
        return Ok(vec![]);
    }

    let active = find_active_mission(&missions_dir)?;
    let active_id = active.as_ref().map(|(id, _, _)| id.clone());

    let mut summaries: Vec<MissionSummary> = Vec::new();
    for entry in fs::read_dir(&missions_dir)
        .map_err(|e| format!("Failed to read missions dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let dir_path = entry.path();
        if !dir_path.is_dir() {
            continue;
        }
        let dir_name = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.starts_with("mission-") => name.to_string(),
            _ => continue,
        };

        let spec: Option<MissionSpec> = read_json_file(&dir_path.join("spec.json"))?;
        let state: Option<MissionState> = read_json_file(&dir_path.join("mission-state.json"))?;
        let tasks_dir = dir_path.join("tasks");
        let (task_total, task_completed) = count_tasks(&tasks_dir)?;

        let phase = state.as_ref().and_then(|s| s.phase.clone());
        let mission_name = spec.as_ref().and_then(|s| s.name.clone());
        let created_at = spec.as_ref().and_then(|s| s.created_at.clone());
        let is_active = active_id.as_deref() == Some(dir_name.as_str());

        summaries.push(MissionSummary {
            mission_id: dir_name,
            mission_name,
            phase,
            task_total,
            task_completed,
            is_active,
            created_at,
        });
    }

    summaries.sort_by(|a, b| {
        b.is_active
            .cmp(&a.is_active)
            .then_with(|| match (&b.created_at, &a.created_at) {
                (Some(b_date), Some(a_date)) => b_date.cmp(a_date),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            })
            .then_with(|| b.mission_id.cmp(&a.mission_id))
    });
    Ok(summaries)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_detail(path: String, mission_id: String) -> Result<MissionDetail, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let mdir = geas.join("missions").join(&mission_id);

    let spec: Option<MissionSpec> = read_json_file(&mdir.join("spec.json"))?;
    let state: Option<MissionState> = read_json_file(&mdir.join("mission-state.json"))?;
    let design_markdown: Option<String> = read_text_file(&mdir.join("mission-design.md"))?;
    let phase_reviews: Option<PhaseReviewsFile> =
        read_json_file(&mdir.join("phase-reviews.json"))?;
    let verdicts: Option<MissionVerdictsFile> =
        read_json_file(&mdir.join("mission-verdicts.json"))?;
    let deliberations: Option<DeliberationsFile> =
        read_json_file(&mdir.join("deliberations.json"))?;
    let gap: Option<Gap> = read_json_file(&mdir.join("consolidation").join("gap.json"))?;
    let memory_update: Option<MemoryUpdate> =
        read_json_file(&mdir.join("consolidation").join("memory-update.json"))?;
    let has_candidates = mdir.join("consolidation").join("candidates.json").is_file();

    Ok(MissionDetail {
        mission_id,
        spec,
        state,
        design_markdown,
        phase_reviews,
        verdicts,
        deliberations,
        gap,
        memory_update,
        has_candidates,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_phase_reviews(path: String, mission_id: String) -> Result<Option<PhaseReviewsFile>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("phase-reviews.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_verdicts(path: String, mission_id: String) -> Result<Option<MissionVerdictsFile>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("mission-verdicts.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_deliberations(path: String, mission_id: String) -> Result<Option<DeliberationsFile>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("deliberations.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_gap(path: String, mission_id: String) -> Result<Option<Gap>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("consolidation").join("gap.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_memory_update(path: String, mission_id: String) -> Result<Option<MemoryUpdate>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("consolidation").join("memory-update.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_candidates(path: String, mission_id: String) -> Result<Option<serde_json::Value>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("consolidation").join("candidates.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_mission_design(path: String, mission_id: String) -> Result<Option<String>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    read_text_file(&geas.join("missions").join(&mission_id).join("mission-design.md"))
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn list_tasks(path: String, mission_id: String) -> Result<Vec<TaskRow>, String> {
    validate_mission_id(&mission_id)?;
    let geas = geas_dir(&path)?;
    let tasks_dir = geas.join("missions").join(&mission_id).join("tasks");
    if !tasks_dir.is_dir() {
        return Ok(vec![]);
    }
    let mut rows = Vec::new();
    for entry in fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let tpath = entry.path();
        if !tpath.is_dir() {
            continue;
        }
        let contract: Option<TaskContract> = read_json_file(&tpath.join("contract.json"))?;
        let state: Option<TaskState> = read_json_file(&tpath.join("task-state.json"))?;
        let Some(contract) = contract else { continue };

        let task_id = contract.task_id.clone().unwrap_or_else(|| {
            tpath.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string()
        });
        let state = state.unwrap_or_default();

        rows.push(TaskRow {
            task_id,
            title: contract.title.unwrap_or_default(),
            goal: contract.goal,
            status: state.status.unwrap_or_else(|| "unknown".to_string()),
            risk_level: contract.risk_level,
            primary_worker_type: contract
                .routing
                .as_ref()
                .and_then(|r| r.primary_worker_type.clone()),
            required_reviewers: contract
                .routing
                .as_ref()
                .map(|r| r.required_reviewers.clone())
                .unwrap_or_default(),
            active_agent: state.active_agent,
            verify_fix_iterations: state.verify_fix_iterations.unwrap_or(0),
            acceptance_criteria: contract.acceptance_criteria,
            dependencies: contract.dependencies,
            surfaces: contract.surfaces,
        });
    }
    Ok(rows)
}

fn list_evidence_for_task(task_dir: &PathBuf) -> Result<Vec<EvidenceFileMeta>, String> {
    let ev_dir = task_dir.join("evidence");
    if !ev_dir.is_dir() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    for entry in fs::read_dir(&ev_dir).map_err(|e| format!("Failed to read evidence dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = match p.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let ev: Option<EvidenceFile> = read_json_file(&p)?;
        let meta = match ev {
            Some(ev) => {
                let entry_count = ev.entries.len();
                let latest = ev.entries.last();
                EvidenceFileMeta {
                    filename: filename.clone(),
                    agent: ev.agent.clone(),
                    slot: ev.slot.clone(),
                    entry_count,
                    latest_verdict: latest.and_then(|e| e.verdict.clone()),
                    latest_kind: latest.and_then(|e| e.evidence_kind.clone()),
                    created_at: ev.created_at.clone(),
                    updated_at: ev.updated_at.clone(),
                }
            }
            None => EvidenceFileMeta {
                filename,
                agent: None,
                slot: None,
                entry_count: 0,
                latest_verdict: None,
                latest_kind: None,
                created_at: None,
                updated_at: None,
            },
        };
        files.push(meta);
    }
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_task_detail(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<TaskDetail, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    let tdir = geas.join("missions").join(&mission_id).join("tasks").join(&task_id);

    let contract: Option<TaskContract> = read_json_file(&tdir.join("contract.json"))?;
    let state: Option<TaskState> = read_json_file(&tdir.join("task-state.json"))?;
    let implementation_contract: Option<ImplementationContract> =
        read_json_file(&tdir.join("implementation-contract.json"))?;
    let self_check: Option<SelfCheck> = read_json_file(&tdir.join("self-check.json"))?;
    let gate_results: Option<GateResults> = read_json_file(&tdir.join("gate-results.json"))?;
    let deliberations: Option<DeliberationsFile> =
        read_json_file(&tdir.join("deliberations.json"))?;
    let evidence_files = list_evidence_for_task(&tdir)?;

    Ok(TaskDetail {
        task_id,
        contract,
        state,
        implementation_contract,
        self_check,
        gate_results,
        deliberations,
        evidence_files,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_evidence_files(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<Vec<EvidenceFileMeta>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    let tdir = geas.join("missions").join(&mission_id).join("tasks").join(&task_id);
    list_evidence_for_task(&tdir)
}

#[tauri::command(rename_all = "snake_case")]
pub fn read_evidence_file(
    path: String,
    mission_id: String,
    task_id: String,
    filename: String,
) -> Result<Option<EvidenceFile>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(format!("Invalid filename: {filename}"));
    }
    let geas = geas_dir(&path)?;
    let p = geas
        .join("missions")
        .join(&mission_id)
        .join("tasks")
        .join(&task_id)
        .join("evidence")
        .join(&filename);
    read_json_file(&p)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_self_check(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<Option<SelfCheck>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("tasks").join(&task_id).join("self-check.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_gate_results(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<Option<GateResults>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("tasks").join(&task_id).join("gate-results.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_implementation_contract(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<Option<ImplementationContract>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("tasks").join(&task_id).join("implementation-contract.json"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_task_deliberations(
    path: String,
    mission_id: String,
    task_id: String,
) -> Result<Option<DeliberationsFile>, String> {
    validate_mission_id(&mission_id)?;
    validate_task_id(&task_id)?;
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("missions").join(&mission_id).join("tasks").join(&task_id).join("deliberations.json"))
}

// ---------------------------------------------------------------------------
// Debts (project level)
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_debts(path: String) -> Result<Option<Debts>, String> {
    let geas = geas_dir(&path)?;
    read_json_file(&geas.join("debts.json"))
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn get_shared_memory(path: String) -> Result<Option<String>, String> {
    let geas = geas_dir(&path)?;
    read_text_file(&geas.join("memory").join("shared.md"))
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_agent_memories(path: String) -> Result<Vec<AgentMemory>, String> {
    let geas = geas_dir(&path)?;
    let agents_dir = geas.join("memory").join("agents");
    if !agents_dir.is_dir() {
        return Ok(vec![]);
    }
    let mut results = Vec::new();
    for entry in fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read agents dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Error reading dir entry: {e}"))?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let agent_name = p
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let content = fs::read_to_string(&p).unwrap_or_default();
        results.push(AgentMemory { agent_name, content });
    }
    results.sort_by(|a, b| a.agent_name.cmp(&b.agent_name));
    Ok(results)
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_agent_memory(path: String, agent: String) -> Result<Option<String>, String> {
    if agent.contains('/') || agent.contains('\\') || agent.contains("..") {
        return Err(format!("Invalid agent: {agent}"));
    }
    let geas = geas_dir(&path)?;
    read_text_file(&geas.join("memory").join("agents").join(format!("{agent}.md")))
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

fn payload_str_field(entry: &EventEntry, field: &str) -> Option<String> {
    entry.payload.as_ref().and_then(|p| {
        p.get(field)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_events(
    path: String,
    mission_id: Option<String>,
    task_id: Option<String>,
    kind: Option<String>,
    actor: Option<String>,
    page: usize,
    page_size: usize,
) -> Result<EventsPage, String> {
    let (_canonical, geas) = validate_project_path(&path)?;
    let events_path = geas.join("events.jsonl");
    if !events_path.is_file() {
        return Ok(EventsPage {
            events: vec![],
            total_count: 0,
            page,
            page_size,
        });
    }

    let file = fs::File::open(&events_path)
        .map_err(|e| format!("Failed to open events.jsonl: {e}"))?;
    let reader = BufReader::new(file);

    let mut all_events: Vec<EventEntry> = Vec::new();
    for line in reader.lines() {
        let Ok(line) = line else { continue };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let entry: EventEntry = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(_) => continue,
        };

        if let Some(ref mid) = mission_id {
            if payload_str_field(&entry, "mission_id").as_deref() != Some(mid.as_str()) {
                continue;
            }
        }
        if let Some(ref tid) = task_id {
            if payload_str_field(&entry, "task_id").as_deref() != Some(tid.as_str()) {
                continue;
            }
        }
        if let Some(ref k) = kind {
            if entry.kind.as_deref() != Some(k.as_str()) {
                continue;
            }
        }
        if let Some(ref a) = actor {
            if entry.actor.as_deref() != Some(a.as_str()) {
                continue;
            }
        }
        all_events.push(entry);
    }

    all_events.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let total_count = all_events.len();
    let skip = page.saturating_mul(page_size);
    let events: Vec<EventEntry> = all_events.into_iter().skip(skip).take(page_size).collect();

    Ok(EventsPage {
        events,
        total_count,
        page,
        page_size,
    })
}

// Re-export DebtEntry for the frontend to avoid unused-import warnings.
#[allow(dead_code)]
fn _type_export(_: DebtEntry) {}
