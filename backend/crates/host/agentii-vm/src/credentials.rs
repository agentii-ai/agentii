use std::collections::HashMap;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

/// Process-level mutex to serialize all credentials file read-modify-write cycles.
/// Prevents concurrent RPC handlers from clobbering each other's writes.
static CREDENTIALS_LOCK: Mutex<()> = Mutex::new(());

/// Sentinel prefix for values stored in macOS Keychain.
pub const KEYCHAIN_SENTINEL: &str = "<<KEYCHAIN:";

/// On-disk credentials file structure.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CredentialsFile {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub skills: HashMap<String, HashMap<String, String>>,
    #[serde(default)]
    pub mcp: HashMap<String, HashMap<String, String>>,
}

/// Returns the default credentials file path: `~/.agentii/config/credentials.json`.
/// Panics if home directory cannot be resolved — credentials must never fall back to /tmp.
pub fn credentials_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .expect("HOME or USERPROFILE must be set for credential storage");
    PathBuf::from(home)
        .join(".agentii")
        .join("config")
        .join("credentials.json")
}

/// Load the credentials file from disk. Returns default if missing or invalid.
pub fn load_credentials() -> CredentialsFile {
    load_credentials_from(credentials_path())
}

/// Load credentials from a specific path (for testing).
pub fn load_credentials_from(path: PathBuf) -> CredentialsFile {
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|e| {
            warn!(path = %path.display(), error = %e, "Failed to parse credentials.json, using default");
            CredentialsFile { version: 1, ..Default::default() }
        }),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            CredentialsFile { version: 1, ..Default::default() }
        }
        Err(e) => {
            warn!(path = %path.display(), error = %e, "Failed to read credentials.json, using default");
            CredentialsFile { version: 1, ..Default::default() }
        }
    }
}

/// Save the credentials file to disk.
fn save_credentials(creds: &CredentialsFile) -> Result<(), String> {
    save_credentials_to(creds, credentials_path())
}

/// Save credentials to a specific path (for testing).
/// Uses atomic write (temp file + rename) and sets 0600 permissions.
fn save_credentials_to(creds: &CredentialsFile, path: PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }
    let json = serde_json::to_string_pretty(creds)
        .map_err(|e| format!("Failed to serialize credentials: {e}"))?;

    // Atomic write: write to temp file, then rename to avoid partial writes on crash
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write temp credentials file: {e}"))?;

    // Set 0600 permissions (owner read/write only) before renaming into place
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        if let Err(e) = std::fs::set_permissions(&tmp_path, perms) {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(format!("Failed to set credentials file permissions: {e}"));
        }
    }

    if let Err(e) = std::fs::rename(&tmp_path, &path) {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!("Failed to rename temp credentials file: {e}"));
    }

    debug!(path = %path.display(), "Saved credentials.json");
    Ok(())
}

/// Get the entity map (skills or mcp) from the credentials file.
fn entity_map_mut<'a>(
    creds: &'a mut CredentialsFile,
    entity_type: &str,
) -> &'a mut HashMap<String, HashMap<String, String>> {
    match entity_type {
        "skill" => &mut creds.skills,
        "mcp" => &mut creds.mcp,
        other => {
            warn!(entity_type = other, "Unknown entity type, defaulting to skills");
            &mut creds.skills
        }
    }
}

fn entity_map<'a>(
    creds: &'a CredentialsFile,
    entity_type: &str,
) -> &'a HashMap<String, HashMap<String, String>> {
    match entity_type {
        "skill" => &creds.skills,
        "mcp" => &creds.mcp,
        other => {
            warn!(entity_type = other, "Unknown entity type, defaulting to skills");
            &creds.skills
        }
    }
}

/// Save a non-secret credential value to credentials.json.
pub fn save_credential(
    entity_type: &str,
    entity_id: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let _lock = CREDENTIALS_LOCK.lock().map_err(|e| format!("Credentials lock poisoned: {e}"))?;
    let mut creds = load_credentials();
    let map = entity_map_mut(&mut creds, entity_type);
    map.entry(entity_id.to_string())
        .or_default()
        .insert(key.to_string(), value.to_string());
    save_credentials(&creds)
}

/// Read a non-secret credential value from credentials.json.
pub fn read_credential(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> Option<String> {
    let creds = load_credentials();
    let map = entity_map(&creds, entity_type);
    map.get(entity_id)
        .and_then(|m| m.get(key))
        .filter(|v| !v.is_empty() && !v.starts_with(KEYCHAIN_SENTINEL))
        .cloned()
}

/// Delete a credential value from credentials.json.
pub fn delete_credential(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> Result<(), String> {
    let _lock = CREDENTIALS_LOCK.lock().map_err(|e| format!("Credentials lock poisoned: {e}"))?;
    let mut creds = load_credentials();
    let map = entity_map_mut(&mut creds, entity_type);
    if let Some(entity) = map.get_mut(entity_id) {
        entity.remove(key);
        if entity.is_empty() {
            map.remove(entity_id);
        }
    }
    save_credentials(&creds)
}

/// Check if a credential value exists in credentials.json (non-sentinel).
pub fn has_credential(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> bool {
    read_credential(entity_type, entity_id, key).is_some()
}

/// Record a keychain sentinel in credentials.json so we know the value exists in keychain.
pub fn record_keychain_sentinel(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> Result<(), String> {
    let _lock = CREDENTIALS_LOCK.lock().map_err(|e| format!("Credentials lock poisoned: {e}"))?;
    let sentinel = format!("{KEYCHAIN_SENTINEL}agentii.{entity_type}.{entity_id}.{key}>>");
    let mut creds = load_credentials();
    let map = entity_map_mut(&mut creds, entity_type);
    map.entry(entity_id.to_string())
        .or_default()
        .insert(key.to_string(), sentinel);
    save_credentials(&creds)
}

/// Check if a value exists — either as a direct value or as a keychain sentinel.
pub fn has_any_value(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> bool {
    let creds = load_credentials();
    let map = entity_map(&creds, entity_type);
    map.get(entity_id)
        .and_then(|m| m.get(key))
        .map(|v| !v.is_empty())
        .unwrap_or(false)
}
