use serde_json::Value;
use crate::security::file_storage;

const SETTINGS_FILE: &str = "settings.json";

fn load_settings() -> serde_json::Map<String, Value> {
    file_storage::read_file(SETTINGS_FILE)
        .ok()
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or_default()
}

fn save_settings(settings: &serde_json::Map<String, Value>) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?;
    file_storage::write_file(SETTINGS_FILE, &json)
}

#[tauri::command]
pub fn get_setting(key: String) -> Option<Value> {
    load_settings().get(&key).cloned()
}

#[tauri::command]
pub fn set_setting(key: String, value: Value) -> Result<(), String> {
    let mut settings = load_settings();
    settings.insert(key, value);
    save_settings(&settings)
}

#[tauri::command]
pub fn get_all_settings() -> serde_json::Map<String, Value> {
    load_settings()
}
