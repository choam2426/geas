use tauri::Manager;

mod commands;
mod config;
mod models;
mod watcher;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let cfg = config::read_config(app.handle())?;
            let paths: Vec<String> = cfg.projects.iter().map(|p| p.path.clone()).collect();
            let watcher_state = watcher::start_watching(app.handle().clone(), &paths);
            app.manage(watcher_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project registry
            commands::list_projects,
            commands::add_project,
            commands::remove_project,
            // Project-level
            commands::get_project_summary,
            commands::get_debts,
            commands::get_events,
            // Mission-level
            commands::get_mission_history,
            commands::get_mission_detail,
            commands::get_mission_design,
            commands::get_phase_reviews,
            commands::get_mission_verdicts,
            commands::get_mission_deliberations,
            commands::get_gap,
            commands::get_memory_update,
            commands::get_candidates,
            // Task-level
            commands::list_tasks,
            commands::get_task_detail,
            commands::list_evidence_files,
            commands::read_evidence_file,
            commands::get_self_check,
            commands::get_gate_results,
            commands::get_implementation_contract,
            commands::get_task_deliberations,
            // Memory
            commands::get_shared_memory,
            commands::list_agent_memories,
            commands::get_agent_memory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
