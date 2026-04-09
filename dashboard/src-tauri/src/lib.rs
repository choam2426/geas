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
            commands::get_project_summary,
            commands::get_project_tasks,
            commands::get_project_debt,
            commands::get_mission_history,
            commands::get_mission_spec,
            commands::get_project_rules,
            commands::get_mission_events,
            commands::get_project_memories,
            commands::get_task_detail,
            commands::get_health_check,
            commands::get_design_brief,
            commands::get_vote_rounds,
            commands::get_phase_reviews,
            commands::get_gap_assessment,
            commands::list_projects,
            commands::add_project,
            commands::remove_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
