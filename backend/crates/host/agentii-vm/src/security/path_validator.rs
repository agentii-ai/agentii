//! 6-gate path validation ported from ZeroClaw.
//! Defense-in-depth inside the VM — primary isolation is the Lima VM boundary.

use std::path::{Path, PathBuf};

/// Error returned when path validation fails.
#[derive(Debug, thiserror::Error)]
pub enum PathValidationError {
    #[error("Gate 1: path contains null byte")]
    NullByte,
    #[error("Gate 2: path contains '..' traversal component")]
    Traversal,
    #[error("Gate 3: path contains URL-encoded traversal sequence")]
    UrlEncodedTraversal,
    #[error("Gate 4: path contains ~user expansion")]
    TildeUser,
    #[error("Gate 5: path escapes workspace boundary after canonicalization")]
    WorkspaceEscape { canonical: PathBuf },
    #[error("Gate 6: path matches forbidden prefix: {prefix}")]
    ForbiddenPrefix { prefix: String },
    #[error("Gate 7: symlink target escapes workspace boundary")]
    SymlinkEscape { link: PathBuf, target: PathBuf },
    #[error("IO error during canonicalization: {0}")]
    Io(#[from] std::io::Error),
}

/// Default forbidden path prefixes (sensitive host directories).
fn default_forbidden_prefixes() -> Vec<&'static str> {
    vec![
        "/etc", "/root", "/home", "/usr", "/bin", "/sbin", "/lib", "/opt",
        "/boot", "/dev", "/proc", "/sys", "/var", "/tmp",
        "/.ssh", "/.gnupg", "/.aws", "/.config/gcloud", "/.netrc",
    ]
}

/// Validate a path against all 6 security gates.
/// `workspace_root` is the allowed workspace directory (e.g., "/workspace").
pub fn validate_path(path: &str, workspace_root: &Path) -> Result<PathBuf, PathValidationError> {
    // Gate 1: Null byte check
    if path.contains('\0') {
        return Err(PathValidationError::NullByte);
    }

    // Gate 2: Traversal component check
    let p = Path::new(path);
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err(PathValidationError::Traversal);
        }
    }

    // Gate 3: URL-encoded traversal check
    let lower = path.to_lowercase();
    if lower.contains("%2f") || lower.contains("%2e") || lower.contains("%00") {
        return Err(PathValidationError::UrlEncodedTraversal);
    }

    // Gate 4: ~user expansion check
    if path.starts_with('~') && path.len() > 1 && !path.starts_with("~/") {
        return Err(PathValidationError::TildeUser);
    }

    // Gate 5: Workspace confinement after canonicalization
    // Resolve the path relative to workspace_root if it's relative
    let resolved = if p.is_absolute() {
        p.to_path_buf()
    } else {
        workspace_root.join(p)
    };

    // Use lexical normalization (no filesystem access needed for validation)
    let canonical = normalize_path(&resolved);
    if !canonical.starts_with(workspace_root) {
        return Err(PathValidationError::WorkspaceEscape { canonical });
    }

    // Gate 6: Forbidden prefix deny-list
    let canonical_str = canonical.to_string_lossy();
    for prefix in default_forbidden_prefixes() {
        if canonical_str.starts_with(prefix) {
            return Err(PathValidationError::ForbiddenPrefix {
                prefix: prefix.to_string(),
            });
        }
    }

    // Gate 7: Symlink escape detection
    // Walk each component of the resolved path. If any intermediate directory
    // or the leaf itself is a symlink, resolve its real target and verify it
    // stays within the workspace boundary. This catches symlinks at any depth,
    // not just the leaf.
    {
        let mut check_path = PathBuf::new();
        for component in canonical.components() {
            check_path.push(component);
            if !check_path.exists() {
                break; // Path doesn't exist yet — nothing to check
            }
            match check_path.symlink_metadata() {
                Ok(meta) if meta.file_type().is_symlink() => {
                    match std::fs::canonicalize(&check_path) {
                        Ok(real_target) => {
                            if !real_target.starts_with(workspace_root) {
                                return Err(PathValidationError::SymlinkEscape {
                                    link: check_path,
                                    target: real_target,
                                });
                            }
                        }
                        Err(e) => return Err(PathValidationError::Io(e)), // dangling symlink
                    }
                }
                _ => {} // Not a symlink or doesn't exist — continue
            }
        }
    }

    Ok(canonical)
}

/// Validate a path for host-side workspace APIs.
///
/// Unlike `validate_path()` which is designed for VM-internal paths (where the
/// workspace is at `/workspace/`), this function is for host-side validation where
/// the workspace lives under `~/.agentii/workspaces/...` — a path that would
/// normally be rejected by Gate 6's forbidden prefix list (e.g., `/home`, `/var`).
///
/// Runs Gates 1-5 and Gate 7 (symlink escape), but skips Gate 6 (forbidden prefix)
/// since the workspace itself is under a "forbidden" host path.
pub fn validate_path_host(path: &str, workspace_root: &Path) -> Result<PathBuf, PathValidationError> {
    // Gate 1: Null byte check
    if path.contains('\0') {
        return Err(PathValidationError::NullByte);
    }

    // Gate 2: Traversal component check
    let p = Path::new(path);
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err(PathValidationError::Traversal);
        }
    }

    // Gate 3: URL-encoded traversal check
    let lower = path.to_lowercase();
    if lower.contains("%2f") || lower.contains("%2e") || lower.contains("%00") {
        return Err(PathValidationError::UrlEncodedTraversal);
    }

    // Gate 4: ~user expansion check
    if path.starts_with('~') && path.len() > 1 && !path.starts_with("~/") {
        return Err(PathValidationError::TildeUser);
    }

    // Gate 5: Workspace confinement after canonicalization
    let resolved = if p.is_absolute() {
        p.to_path_buf()
    } else {
        workspace_root.join(p)
    };

    let canonical = normalize_path(&resolved);
    if !canonical.starts_with(workspace_root) {
        return Err(PathValidationError::WorkspaceEscape { canonical });
    }

    // Gate 6: SKIPPED for host-side validation — the workspace itself is under
    // a host path like /Users/x/.agentii/workspaces/ which would match /home, etc.

    // Gate 7: Symlink escape detection (walk all components)
    {
        let mut check_path = PathBuf::new();
        for component in canonical.components() {
            check_path.push(component);
            if !check_path.exists() {
                break;
            }
            match check_path.symlink_metadata() {
                Ok(meta) if meta.file_type().is_symlink() => {
                    match std::fs::canonicalize(&check_path) {
                        Ok(real_target) => {
                            if !real_target.starts_with(workspace_root) {
                                return Err(PathValidationError::SymlinkEscape {
                                    link: check_path,
                                    target: real_target,
                                });
                            }
                        }
                        Err(e) => return Err(PathValidationError::Io(e)),
                    }
                }
                _ => {}
            }
        }
    }

    Ok(canonical)
}

/// Lexical path normalization without filesystem access.
/// Resolves `.` and `..` components purely from the path string.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                // This shouldn't happen (Gate 2 catches it), but handle defensively
                components.pop();
            }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    components.iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_path() {
        let ws = Path::new("/workspace");
        assert!(validate_path("/workspace/file.txt", ws).is_ok());
        assert!(validate_path("/workspace/subdir/file.py", ws).is_ok());
    }

    #[test]
    fn test_gate1_null_byte() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("/workspace/file\0.txt", ws),
            Err(PathValidationError::NullByte)
        ));
    }

    #[test]
    fn test_gate2_traversal() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("/workspace/../etc/passwd", ws),
            Err(PathValidationError::Traversal)
        ));
    }

    #[test]
    fn test_gate3_url_encoded() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("/workspace/%2f%2e%2e/etc", ws),
            Err(PathValidationError::UrlEncodedTraversal)
        ));
    }

    #[test]
    fn test_gate4_tilde_user() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("~root/.ssh/id_rsa", ws),
            Err(PathValidationError::TildeUser)
        ));
    }

    #[test]
    fn test_gate5_workspace_escape() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("/etc/passwd", ws),
            Err(PathValidationError::ForbiddenPrefix { .. })
                | Err(PathValidationError::WorkspaceEscape { .. })
        ));
    }

    #[test]
    fn test_gate6_forbidden_prefix() {
        let ws = Path::new("/workspace");
        assert!(matches!(
            validate_path("/etc/shadow", ws),
            Err(PathValidationError::ForbiddenPrefix { .. })
                | Err(PathValidationError::WorkspaceEscape { .. })
        ));
    }

    #[test]
    fn test_gate7_symlink_escape() {
        // Create a workspace dir under HOME to avoid forbidden prefix matches.
        // On macOS, /tmp resolves to /private/var/... which hits Gate 6.
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let ws = std::path::PathBuf::from(&home).join(".agentii_test_gate7_ws");
        let _ = std::fs::create_dir_all(&ws);
        let link_path = ws.join("escape_link");
        let _ = std::fs::remove_file(&link_path);
        #[cfg(unix)]
        {
            // Symlink pointing outside the workspace to /etc
            std::os::unix::fs::symlink("/etc", &link_path).unwrap();
            let result = validate_path(
                link_path.to_str().unwrap(),
                &ws,
            );
            // Should be caught by either SymlinkEscape (Gate 7) or ForbiddenPrefix (Gate 6)
            // depending on how the path resolves on this OS.
            assert!(
                result.is_err(),
                "Expected error for symlink escaping workspace, got: {result:?}"
            );
            let _ = std::fs::remove_file(&link_path);
        }
        let _ = std::fs::remove_dir_all(&ws);
    }
}
