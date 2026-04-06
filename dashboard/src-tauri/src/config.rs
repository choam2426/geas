use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::models::AppConfig;

/// Resolve the path to config.json inside the Tauri app data directory.
pub fn config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    Ok(dir.join("config.json"))
}

/// Read the persisted config. Returns a default (empty) config if the file
/// does not exist or cannot be parsed.
pub fn read_config(app_handle: &tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app_handle)?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config at {}: {e}", path.display()))?;

    serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse config at {}: {e}", path.display()))
}

/// Write the config to disk, creating parent directories if needed.
pub fn write_config(app_handle: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app_handle)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir {}: {e}", parent.display()))?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    fs::write(&path, json)
        .map_err(|e| format!("Failed to write config at {}: {e}", path.display()))
}
