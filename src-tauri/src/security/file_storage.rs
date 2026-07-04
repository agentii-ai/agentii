use std::fs;
use std::path::PathBuf;

fn storage_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("com.agentii.app").join("secure");
    fs::create_dir_all(&dir).ok();
    dir
}

pub fn write_file(name: &str, data: &[u8]) -> Result<(), String> {
    let path = storage_dir().join(name);
    fs::write(&path, data).map_err(|e| format!("write failed: {e}"))
}

pub fn read_file(name: &str) -> Result<Vec<u8>, String> {
    let path = storage_dir().join(name);
    fs::read(&path).map_err(|e| format!("read failed: {e}"))
}

pub fn delete_file(name: &str) -> Result<(), String> {
    let path = storage_dir().join(name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("delete failed: {e}"))?;
    }
    Ok(())
}

pub fn file_exists(name: &str) -> bool {
    storage_dir().join(name).exists()
}
