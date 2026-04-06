mod commands;
mod config;
mod models;

pub fn run() {
    tauri::Builder::default()
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
