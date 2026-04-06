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
            commands::list_projects,
            commands::add_project,
            commands::remove_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
