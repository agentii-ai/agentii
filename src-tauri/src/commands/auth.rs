use serde::{Deserialize, Serialize};
use crate::security::{encryption, file_storage};

const CRED_FILE: &str = "credentials.enc";
const MASTER_KEY: &str = "agentii_default_key";

#[derive(Serialize, Deserialize)]
pub struct Credentials {
    pub api_key: String,
    pub api_secret: String,
}

#[tauri::command]
pub fn store_credentials(api_key: String, api_secret: String) -> Result<(), String> {
    let creds = Credentials { api_key, api_secret };
    let json = serde_json::to_vec(&creds).map_err(|e| e.to_string())?;
    let key = encryption::derive_key(MASTER_KEY);
    let encrypted = encryption::encrypt(&json, &key)?;
    file_storage::write_file(CRED_FILE, &encrypted)
}

#[tauri::command]
pub fn get_credentials() -> Result<Credentials, String> {
    let encrypted = file_storage::read_file(CRED_FILE)?;
    let key = encryption::derive_key(MASTER_KEY);
    let decrypted = encryption::decrypt(&encrypted, &key)?;
    serde_json::from_slice(&decrypted).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_credentials() -> Result<(), String> {
    file_storage::delete_file(CRED_FILE)
}

#[tauri::command]
pub fn has_credentials() -> bool {
    file_storage::file_exists(CRED_FILE)
}
