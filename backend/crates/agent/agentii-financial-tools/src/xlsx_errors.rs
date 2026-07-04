//! XlsxToolError — shared error enum for all 5 Excel native tools.
//! Agents match on variant to decide retry/abort/escalate (FR-006, FR-034f).

use serde::Serialize;
use std::fmt;

/// Shared error enum for all Excel tools (xlsx_recalc, xlsx_evaluate, xlsx_audit,
/// xlsx_convert, xlsx_build). Six variants covering the common failure modes.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "variant", content = "detail")]
pub enum XlsxToolError {
    /// Path doesn't exist in the workspace.
    FileNotFound {
        path: String,
        message: String,
    },
    /// LibreOffice or openpyxl cannot parse the file — not a valid .xlsx.
    FileCorrupt {
        path: String,
        message: String,
    },
    /// Required dependency (LibreOffice `soffice`, Python3, pandas, pyarrow)
    /// not found on the configured path or system PATH.
    DependencyMissing {
        dependency: String,
        message: String,
    },
    /// Operation exceeded `timeout_secs`.
    Timeout {
        timeout_secs: i32,
        message: String,
    },
    /// Malformed cell reference, path traversal attempt (`../`), unsupported
    /// format string, script_path outside workspace, schema validation failure.
    InvalidInput {
        message: String,
    },
    /// `xlsx_build` only — Python script exited non-zero.
    ScriptError {
        exit_code: i32,
        stderr: String,
        message: String,
    },
}

impl XlsxToolError {
    /// Human-readable message carried by every variant.
    pub fn message(&self) -> &str {
        match self {
            Self::FileNotFound { message, .. }
            | Self::FileCorrupt { message, .. }
            | Self::DependencyMissing { message, .. }
            | Self::Timeout { message, .. }
            | Self::InvalidInput { message }
            | Self::ScriptError { message, .. } => message,
        }
    }

    /// Discriminant string for agent pattern-matching.
    pub fn variant_name(&self) -> &'static str {
        match self {
            Self::FileNotFound { .. } => "FileNotFound",
            Self::FileCorrupt { .. } => "FileCorrupt",
            Self::DependencyMissing { .. } => "DependencyMissing",
            Self::Timeout { .. } => "Timeout",
            Self::InvalidInput { .. } => "InvalidInput",
            Self::ScriptError { .. } => "ScriptError",
        }
    }
}

impl fmt::Display for XlsxToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.variant_name(), self.message())
    }
}

impl std::error::Error for XlsxToolError {}

// Conversions to String for the existing execute_financial_tool signature
impl From<XlsxToolError> for String {
    fn from(e: XlsxToolError) -> Self {
        serde_json::to_string(&e).unwrap_or_else(|_| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_not found_serializes_correctly() {
        let err = XlsxToolError::FileNotFound {
            path: "/workspace/model.xlsx".into(),
            message: "File not found".into(),
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["variant"], "FileNotFound");
        assert_eq!(json["detail"]["path"], "/workspace/model.xlsx");
    }

    #[test]
    fn all_variants_have_messages() {
        let variants: Vec<XlsxToolError> = vec![
            XlsxToolError::FileNotFound { path: "".into(), message: "m1".into() },
            XlsxToolError::FileCorrupt { path: "".into(), message: "m2".into() },
            XlsxToolError::DependencyMissing { dependency: "soffice".into(), message: "m3".into() },
            XlsxToolError::Timeout { timeout_secs: 120, message: "m4".into() },
            XlsxToolError::InvalidInput { message: "m5".into() },
            XlsxToolError::ScriptError { exit_code: 1, stderr: "err".into(), message: "m6".into() },
        ];
        for v in &variants {
            assert!(!v.message().is_empty());
            assert!(!v.variant_name().is_empty());
        }
    }

    #[test]
    fn display_includes_variant_and_message() {
        let err = XlsxToolError::InvalidInput { message: "bad cell ref".into() };
        let s = err.to_string();
        assert!(s.contains("InvalidInput"));
        assert!(s.contains("bad cell ref"));
    }

    #[test]
    fn conversion_to_string_produces_json() {
        let err = XlsxToolError::Timeout { timeout_secs: 30, message: "timed out".into() };
        let s: String = err.into();
        assert!(s.contains("Timeout"));
        assert!(s.contains("timed out"));
    }
}
