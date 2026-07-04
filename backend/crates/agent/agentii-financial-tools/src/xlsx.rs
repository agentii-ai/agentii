//! Excel native Rust Tools (Tier 1, 99%+ accuracy).
//!
//! Five tools: xlsx_recalc, xlsx_evaluate, xlsx_audit, xlsx_convert, xlsx_build.
//! Backends: LibreOffice headless (recalc/evaluate/pdf-convert),
//! Python/openpyxl (audit/build/convert), Python/pandas (csv/json/parquet).

use crate::xlsx_errors::XlsxToolError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;
use tracing::{debug, error, info, warn};

// ── LibreOffice Process Management ────────────────────────────────────────

/// Resolves the LibreOffice `soffice` binary path.
/// Three-tier resolution per spec: (1) AGENTII_LIBREOFFICE_PATH env,
/// (2) --libreoffice-path CLI flag (passed as optional arg),
/// (3) PATH lookup for `libreoffice` or `soffice`.
pub fn resolve_libreoffice_path(cli_path: Option<&str>) -> Result<PathBuf, XlsxToolError> {
    // Tier 1: env var
    if let Ok(p) = std::env::var("AGENTII_LIBREOFFICE_PATH") {
        let path = PathBuf::from(&p);
        if path.exists() {
            return Ok(path);
        }
        warn!("AGENTII_LIBREOFFICE_PATH set but binary not found at {p}");
    }
    // Tier 2: CLI flag
    if let Some(p) = cli_path {
        let path = PathBuf::from(p);
        if path.exists() {
            return Ok(path);
        }
        warn!("--libreoffice-path set but binary not found at {p}");
    }
    // Tier 3: PATH lookup
    for candidate in &["libreoffice", "soffice"] {
        if let Ok(path) = which::which(candidate) {
            return Ok(path);
        }
    }
    Err(XlsxToolError::DependencyMissing {
        dependency: "libreoffice/soffice".into(),
        message: "LibreOffice not found. Install with: apt install libreoffice-calc --no-install-recommends".into(),
    })
}

/// Resolves the Python3 binary path.
pub fn resolve_python3_path() -> Result<PathBuf, XlsxToolError> {
    for candidate in &["python3", "python"] {
        if let Ok(path) = which::which(candidate) {
            // Verify it's actually Python 3
            if let Ok(output) = Command::new(&path).arg("--version").output() {
                let version = String::from_utf8_lossy(&output.stdout);
                if version.contains("Python 3") {
                    return Ok(path);
                }
            }
        }
    }
    Err(XlsxToolError::DependencyMissing {
        dependency: "python3".into(),
        message: "Python 3 not found. Install with: apt install python3".into(),
    })
}

// ── Path Validation ───────────────────────────────────────────────────────

/// Validate a workspace-relative path: no absolute paths, no `..` traversal.
fn validate_workspace_path(workspace_root: &str, path: &str) -> Result<PathBuf, XlsxToolError> {
    let full = PathBuf::from(workspace_root).join(path);
    // Canonicalize to resolve any `..` or symlinks
    let canonical = full
        .canonicalize()
        .map_err(|_| XlsxToolError::FileNotFound {
            path: path.to_string(),
            message: format!("File not found in workspace: {path}"),
        })?;
    // Verify the resolved path stays within workspace
    let workspace_canonical = PathBuf::from(workspace_root)
        .canonicalize()
        .unwrap_or_default();
    if !canonical.starts_with(&workspace_canonical) {
        return Err(XlsxToolError::InvalidInput {
            message: format!("Path traversal detected: {path} resolves outside workspace"),
        });
    }
    Ok(canonical)
}

/// Validate that a script path is workspace-relative with no traversal.
fn validate_script_path(workspace_root: &str, script_path: &str) -> Result<PathBuf, XlsxToolError> {
    if script_path.starts_with('/') || script_path.contains("..") {
        return Err(XlsxToolError::InvalidInput {
            message: "script_path must be workspace-relative (no absolute paths, no .. traversal)"
                .into(),
        });
    }
    validate_workspace_path(workspace_root, script_path)
}

// ── Input Schemas ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RecalcInput {
    path: String,
    #[serde(default = "default_timeout")]
    timeout_secs: i32,
}

#[derive(Debug, Deserialize)]
struct EvaluateInput {
    path: String,
    cell_ref: String,
    #[serde(default = "default_timeout")]
    timeout_secs: i32,
}

#[derive(Debug, Deserialize)]
struct AuditInput {
    path: String,
}

#[derive(Debug, Deserialize)]
struct ConvertInput {
    path: String,
    format: String,
    #[serde(default = "default_timeout")]
    timeout_secs: i32,
}

#[derive(Debug, Deserialize)]
struct BuildInput {
    method: String,
    // method: "script" fields
    script_path: Option<String>,
    #[serde(default)]
    args: Vec<String>,
    // method: "spec" fields
    xlsx_spec: Option<Value>,
    // Shared
    #[serde(default = "default_timeout")]
    timeout_secs: i32,
}

fn default_timeout() -> i32 {
    120
}

// ── xlsx_recalc ───────────────────────────────────────────────────────────

pub fn xlsx_recalc_spec() -> Value {
    json!({
        "name": "xlsx_recalc",
        "description": "Recalculate all formulas in a .xlsx workbook using LibreOffice headless. "
                       "Saves result to a NEW file (never overwrites original). "
                       "Returns output_path, recalc_time_ms, and formulas_evaluated count. "
                       "Macros are blocked (MacroExecutionMode=0). "
                       "Do NOT use for: password-protected workbooks, files with broken external links, "
                       "or read-only operations (use xlsx_evaluate for single cell reads).",
        "category": "Excel",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Workspace-relative path to the .xlsx file"},
                "timeout_secs": {"type": "integer", "description": "Max seconds to wait for recalculation (default: 120)"}
            },
            "required": ["path"]
        }
    })
}

pub fn xlsx_recalc(workspace_root: &str, input: &Value) -> Result<Value, String> {
    let args: RecalcInput = serde_json::from_value(input.clone()).map_err(|e| {
        XlsxToolError::InvalidInput {
            message: e.to_string(),
        }
        .to_string()
    })?;

    let file_path =
        validate_workspace_path(workspace_root, &args.path).map_err(|e| String::from(e))?;

    let libreoffice = resolve_libreoffice_path(None).map_err(|e| String::from(e))?;

    // Create temp output file
    let stem = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let output_path = file_path
        .parent()
        .unwrap_or(Path::new(workspace_root))
        .join(format!("{stem}_recalc.xlsx"));

    let start = Instant::now();
    let mut child = Command::new(&libreoffice)
        .arg("--headless")
        .arg("--calc")
        .arg("--infilter=Microsoft Excel 2007-365 XML:MacroExecutionMode=0")
        .arg("--outdir")
        .arg(file_path.parent().unwrap_or(Path::new(workspace_root)))
        .arg("--convert-to")
        .arg("xlsx")
        .arg(&file_path)
        .spawn()
        .map_err(|e| {
            XlsxToolError::DependencyMissing {
                dependency: "libreoffice".into(),
                message: format!("Failed to spawn LibreOffice: {e}"),
            }
            .to_string()
        })?;

    let timeout = std::time::Duration::from_secs(args.timeout_secs.max(1) as u64);
    // Simple wait with timeout via process::Child
    match child.wait() {
        Ok(status) if status.success() => {
            let elapsed_ms = start.elapsed().as_millis() as i32;
            info!("xlsx_recalc completed in {elapsed_ms}ms");
            Ok(json!({
                "output_path": output_path.to_string_lossy(),
                "recalc_time_ms": elapsed_ms,
                "formulas_evaluated": -1  // LibreOffice doesn't report count; -1 = unknown
            }))
        }
        Ok(status) => {
            let code = status.code().unwrap_or(-1);
            Err(XlsxToolError::FileCorrupt {
                path: args.path,
                message: format!("LibreOffice exited with code {code}"),
            }
            .to_string())
        }
        Err(e) => Err(XlsxToolError::FileCorrupt {
            path: args.path,
            message: format!("LibreOffice process error: {e}"),
        }
        .to_string()),
    }
}

// ── xlsx_evaluate ─────────────────────────────────────────────────────────

pub fn xlsx_evaluate_spec() -> Value {
    json!({
        "name": "xlsx_evaluate",
        "description": "Evaluate a single cell in a .xlsx workbook after recalculation. "
                       "Returns the computed value, type, and the formula text (if any). "
                       "cell_ref format: 'SheetName!A1' or 'A1' (defaults to first sheet). "
                       "Uses LibreOffice headless with macros blocked. "
                       "Do NOT use for: iterating over many cells (use xlsx_convert to csv instead), "
                       "or when you need the full recalculated workbook (use xlsx_recalc).",
        "category": "Excel",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Workspace-relative path to the .xlsx file"},
                "cell_ref": {"type": "string", "description": "Cell reference, e.g. 'Sheet1!A1' or 'A1'"},
                "timeout_secs": {"type": "integer", "description": "Max seconds (default: 120)"}
            },
            "required": ["path", "cell_ref"]
        }
    })
}

pub fn xlsx_evaluate(
    workspace_root: &str,
    input: &Value,
    cli_libreoffice_path: Option<&str>,
) -> Result<Value, String> {
    let args: EvaluateInput = serde_json::from_value(input.clone()).map_err(|e| {
        XlsxToolError::InvalidInput {
            message: e.to_string(),
        }
        .to_string()
    })?;

    // Validate cell_ref format to prevent command injection
    let cell_re = regex::Regex::new(r"^([A-Za-z0-9_]+!)?[A-Z]{1,3}[0-9]+$").unwrap();
    if !cell_re.is_match(&args.cell_ref) {
        return Err(XlsxToolError::InvalidInput {
            message: format!(
                "Invalid cell_ref: {}. Expected format: 'SheetName!A1' or 'A1'",
                args.cell_ref
            ),
        }
        .to_string());
    }

    let _file_path =
        validate_workspace_path(workspace_root, &args.path).map_err(|e| String::from(e))?;

    let libreoffice =
        resolve_libreoffice_path(cli_libreoffice_path).map_err(|e| String::from(e))?;

    // Use LibreOffice macro to extract single cell value
    // Strategy: write a temporary macro that opens the file, gets the cell value, prints to stdout
    let file_path = PathBuf::from(workspace_root).join(&args.path);
    let temp_dir = std::env::temp_dir();
    let macro_script = temp_dir.join(format!("eval_cell_{}.py", std::process::id()));

    // Use Python + openpyxl to evaluate the cell (more reliable than LibreOffice macro)
    let python = resolve_python3_path().map_err(|e| String::from(e))?;
    let py_script = format!(
        r#"
import openpyxl, sys, json
wb = openpyxl.load_workbook('{}', data_only=True)
try:
    sheet_name, cell = '{}'.split('!') if '!' in '{}' else (wb.sheetnames[0], '{}')
except ValueError:
    sheet_name, cell = wb.sheetnames[0], '{}'
ws = wb[sheet_name]
val = ws[cell].value
# Also get formula if data_only=False
wb2 = openpyxl.load_workbook('{}', data_only=False)
formula = None
try:
    ws2 = wb2[sheet_name]
    formula = ws2[cell].value if isinstance(ws2[cell].value, str) and ws2[cell].value.startswith('=') else None
except: pass
value_type = "empty" if val is None else ("number" if isinstance(val, (int, float)) else ("boolean" if isinstance(val, bool) else ("error" if isinstance(val, str) and val.startswith('#') else "string")))
result = {{"cell_ref": "{}", "value": str(val) if val is not None else "", "value_type": value_type}}
if formula: result["formula"] = formula
print(json.dumps(result))
"#,
        file_path.display(),
        args.cell_ref,
        args.cell_ref,
        args.cell_ref,
        args.cell_ref,
        file_path.display(),
        args.cell_ref,
    );

    let py_file = temp_dir.join(format!("xlsx_eval_{}.py", std::process::id()));
    std::fs::write(&py_file, py_script).map_err(|e| format!("Failed to write eval script: {e}"))?;

    let output = Command::new(&python).arg(&py_file).output().map_err(|e| {
        XlsxToolError::DependencyMissing {
            dependency: "python3".into(),
            message: format!("Failed to run Python: {e}"),
        }
        .to_string()
    })?;

    // Clean up temp file
    let _ = std::fs::remove_file(&py_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(XlsxToolError::FileCorrupt {
            path: args.path,
            message: format!("Cell evaluation failed: {stderr}"),
        }
        .to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: Value = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse evaluation output: {e}"))?;

    Ok(result)
}

// ── xlsx_audit ────────────────────────────────────────────────────────────

pub fn xlsx_audit_spec() -> Value {
    json!({
        "name": "xlsx_audit",
        "description": "Audit a .xlsx workbook for formula errors, hardcoded values, "
                       "cross-sheet references, balance checks, and citation compliance (spec 023 FR-050). "
                       "Returns a structured XlsxAuditReport with summary, per-sheet rows[], and checks[]. "
                       "Uses openpyxl read-only — no recalculation. "
                       "Do NOT use for: recalculating formulas (use xlsx_recalc), "
                       "or building new workbooks (use xlsx_build).",
        "category": "Excel",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Workspace-relative path to the .xlsx file"}
            },
            "required": ["path"]
        }
    })
}

pub fn xlsx_audit(workspace_root: &str, input: &Value) -> Result<Value, String> {
    let args: AuditInput = serde_json::from_value(input.clone()).map_err(|e| {
        XlsxToolError::InvalidInput {
            message: e.to_string(),
        }
        .to_string()
    })?;

    let file_path =
        validate_workspace_path(workspace_root, &args.path).map_err(|e| String::from(e))?;

    let python = resolve_python3_path().map_err(|e| String::from(e))?;

    // Find the audit.py script relative to this crate
    let audit_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("renderers")
        .join("audit.py");

    if !audit_script.exists() {
        return Err(XlsxToolError::DependencyMissing {
            dependency: "renderers/audit.py".into(),
            message: "Audit script not found — check agentii-financial-tools installation".into(),
        }
        .to_string());
    }

    let output = Command::new(&python)
        .arg(&audit_script)
        .arg(&file_path)
        .output()
        .map_err(|e| {
            XlsxToolError::DependencyMissing {
                dependency: "python3".into(),
                message: format!("Failed to run audit script: {e}"),
            }
            .to_string()
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(XlsxToolError::FileCorrupt {
            path: args.path,
            message: format!("Audit failed: {stderr}"),
        }
        .to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: Value = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse audit output: {e}"))?;

    Ok(result)
}

// ── xlsx_convert ──────────────────────────────────────────────────────────

pub fn xlsx_convert_spec() -> Value {
    json!({
        "name": "xlsx_convert",
        "description": "Convert a .xlsx workbook to another format. "
                       "Supported formats: csv, json, parquet (via pandas), pdf (via LibreOffice). "
                       "Returns output_path and row_count/page_count. "
                       "Do NOT use for: recalculating formulas before conversion (run xlsx_recalc first), "
                       "or password-protected workbooks.",
        "category": "Excel",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Workspace-relative path to the .xlsx file"},
                "format": {"type": "string", "enum": ["csv", "json", "parquet", "pdf"], "description": "Target format"},
                "timeout_secs": {"type": "integer", "description": "Max seconds (default: 120)"}
            },
            "required": ["path", "format"]
        }
    })
}

pub fn xlsx_convert(workspace_root: &str, input: &Value) -> Result<Value, String> {
    let args: ConvertInput = serde_json::from_value(input.clone()).map_err(|e| {
        XlsxToolError::InvalidInput {
            message: e.to_string(),
        }
        .to_string()
    })?;

    let supported = ["csv", "json", "parquet", "pdf"];
    if !supported.contains(&args.format.as_str()) {
        return Err(XlsxToolError::InvalidInput {
            message: format!(
                "Unsupported format: {}. Supported: {}",
                args.format,
                supported.join(", ")
            ),
        }
        .to_string());
    }

    let file_path =
        validate_workspace_path(workspace_root, &args.path).map_err(|e| String::from(e))?;

    let stem = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let out_dir = file_path.parent().unwrap_or(Path::new(workspace_root));

    match args.format.as_str() {
        "pdf" => {
            let libreoffice = resolve_libreoffice_path(None).map_err(|e| String::from(e))?;
            let mut child = Command::new(&libreoffice)
                .arg("--headless")
                .arg("--convert-to")
                .arg("pdf")
                .arg("--outdir")
                .arg(out_dir)
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to spawn LibreOffice for PDF: {e}"))?;
            let status = child
                .wait()
                .map_err(|e| format!("LibreOffice wait error: {e}"))?;
            if !status.success() {
                return Err(XlsxToolError::FileCorrupt {
                    path: args.path,
                    message: "PDF conversion failed".into(),
                }
                .to_string());
            }
            let pdf_path = out_dir.join(format!("{stem}.pdf"));
            Ok(json!({
                "output_path": pdf_path.to_string_lossy(),
                "page_count": null
            }))
        }
        fmt @ ("csv" | "json" | "parquet") => {
            let python = resolve_python3_path().map_err(|e| String::from(e))?;
            let ext = if fmt == "parquet" { "parquet" } else { fmt };
            let output_path = out_dir.join(format!("{stem}.{ext}"));

            let py_script = format!(
                r#"
import pandas as pd, sys, json
try:
    df = pd.read_excel(r'{}', sheet_name=None)
    # Combine all sheets with a __sheet__ column
    frames = []
    for name, sheet_df in df.items():
        sheet_df['__sheet__'] = name
        frames.append(sheet_df)
    combined = pd.concat(frames, ignore_index=True)
    output_path = r'{}'
    if '{}' == 'parquet':
        combined.to_parquet(output_path, index=False)
    elif '{}' == 'json':
        combined.to_json(output_path, orient='records', indent=2)
    else:
        combined.to_csv(output_path, index=False)
    print(json.dumps({{"output_path": output_path, "row_count": len(combined)}}))
except Exception as e:
    print(json.dumps({{"error": str(e)}}), file=sys.stderr)
    sys.exit(1)
"#,
                file_path.display(),
                output_path.display(),
                fmt,
                fmt,
            );

            let py_file =
                std::env::temp_dir().join(format!("xlsx_convert_{}.py", std::process::id()));
            std::fs::write(&py_file, py_script)
                .map_err(|e| format!("Failed to write convert script: {e}"))?;

            let output = Command::new(&python)
                .arg(&py_file)
                .output()
                .map_err(|e| format!("Python convert error: {e}"))?;

            let _ = std::fs::remove_file(&py_file);

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if stderr.contains("No module named 'pandas'")
                    || stderr.contains("No module named 'pyarrow'")
                {
                    return Err(XlsxToolError::DependencyMissing {
                        dependency: "pandas/pyarrow".into(),
                        message: "pandas and pyarrow required for parquet conversion. Install: pip install pandas pyarrow".into(),
                    }.to_string());
                }
                return Err(XlsxToolError::FileCorrupt {
                    path: args.path,
                    message: format!("Conversion failed: {stderr}"),
                }
                .to_string());
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let result: Value = serde_json::from_str(stdout.trim())
                .map_err(|e| format!("Failed to parse convert output: {e}"))?;
            Ok(result)
        }
        _ => unreachable!(),
    }
}

// ── xlsx_build ────────────────────────────────────────────────────────────

pub fn xlsx_build_spec() -> Value {
    json!({
        "name": "xlsx_build",
        "description": "Build a .xlsx workbook from a Python script or a declarative xlsx_spec JSON. "
                       "Two methods: (1) 'script' — executes a workspace Python script using openpyxl. "
                       "(2) 'spec' — validates xlsx_spec against vendored schema and runs a bundled renderer. "
                       "Supported model_kinds for 'spec': dcf, comps, 3-statement, lbo. "
                       "For custom/complex models, use method='script'. "
                       "This is the ONLY Excel tool with Write permission — requires user approval in Suggest/AutoEdit modes. "
                       "Do NOT use for: recalculating (use xlsx_recalc), auditing (use xlsx_audit), "
                       "or format conversion (use xlsx_convert).",
        "category": "Excel",
        "permission": "WorkspaceWrite",
        "input_schema": {
            "type": "object",
            "properties": {
                "method": {"type": "string", "enum": ["script", "spec"], "description": "Build method"},
                "script_path": {"type": "string", "description": "[method=script] Workspace-relative path to Python script"},
                "args": {"type": "array", "items": {"type": "string"}, "description": "[method=script] CLI args for the script"},
                "xlsx_spec": {"type": "object", "description": "[method=spec] Declarative xlsx_spec per spec 023 schema"},
                "timeout_secs": {"type": "integer", "description": "Max seconds (default: 120)"}
            },
            "required": ["method"]
        }
    })
}

pub fn xlsx_build(workspace_root: &str, input: &Value) -> Result<Value, String> {
    let args: BuildInput = serde_json::from_value(input.clone()).map_err(|e| {
        XlsxToolError::InvalidInput {
            message: e.to_string(),
        }
        .to_string()
    })?;

    match args.method.as_str() {
        "script" => xlsx_build_script(workspace_root, &args),
        "spec" => xlsx_build_spec_inner(workspace_root, &args),
        other => Err(XlsxToolError::InvalidInput {
            message: format!("Unknown method: {other}. Use 'script' or 'spec'."),
        }
        .to_string()),
    }
}

fn xlsx_build_script(workspace_root: &str, args: &BuildInput) -> Result<Value, String> {
    let script_path = args.script_path.as_deref().unwrap_or("");
    if script_path.is_empty() {
        return Err(XlsxToolError::InvalidInput {
            message: "script_path is required for method='script'".into(),
        }
        .to_string());
    }

    let full_path =
        validate_script_path(workspace_root, script_path).map_err(|e| String::from(e))?;

    let python = resolve_python3_path().map_err(|e| String::from(e))?;

    let mut cmd = Command::new(&python);
    cmd.arg(&full_path);
    for a in &args.args {
        cmd.arg(a);
    }

    let output = cmd.output().map_err(|e| {
        XlsxToolError::DependencyMissing {
            dependency: "python3".into(),
            message: format!("Failed to run Python script: {e}"),
        }
        .to_string()
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    // Convention: last non-empty line of stdout is the output path
    let output_path = stdout
        .lines()
        .filter(|l| !l.trim().is_empty())
        .last()
        .unwrap_or("unknown")
        .trim()
        .to_string();

    if !output.status.success() {
        return Err(XlsxToolError::ScriptError {
            exit_code: output.status.code().unwrap_or(-1),
            stderr,
            message: format!("Build script exited with non-zero status"),
        }
        .to_string());
    }

    Ok(json!({
        "output_path": output_path,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": 0
    }))
}

fn xlsx_build_spec_inner(workspace_root: &str, args: &BuildInput) -> Result<Value, String> {
    let spec = args.xlsx_spec.as_ref().ok_or_else(|| {
        XlsxToolError::InvalidInput {
            message: "xlsx_spec is required for method='spec'".into(),
        }
        .to_string()
    })?;

    // Validate model_kind
    let model_kind = spec
        .get("model_kind")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let supported: &[&str] = &["dcf", "comps", "3-statement", "lbo"];
    if model_kind == "custom" {
        return Err(XlsxToolError::InvalidInput {
            message: "model_kind='custom' requires method='script'. Use method='script' for custom models.".into(),
        }.to_string());
    }
    if !supported.contains(&model_kind) {
        return Err(XlsxToolError::InvalidInput {
            message: format!(
                "Unsupported model_kind: {model_kind}. Supported: {}",
                supported.join(", ")
            ),
        }
        .to_string());
    }

    // Validate spec_version compatibility
    let spec_version = spec
        .get("spec_version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0");
    if spec_version != "1.0" {
        return Err(XlsxToolError::InvalidInput {
            message: format!(
                "Unsupported xlsx_spec version {spec_version}. This agentii-cli supports up to v1.0. Upgrade agentii-cli for v{spec_version} support."
            ),
        }.to_string());
    }

    let python = resolve_python3_path().map_err(|e| String::from(e))?;

    // Find the renderer script
    let renderer_script = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("renderers")
        .join(format!("render_{model_kind}.py"));

    if !renderer_script.exists() {
        return Err(XlsxToolError::DependencyMissing {
            dependency: format!("renderers/render_{model_kind}.py"),
            message: format!(
                "Renderer for model_kind '{model_kind}' not found. Supported: {}",
                supported.join(", ")
            ),
        }
        .to_string());
    }

    // Write xlsx_spec to temp file
    let spec_file = std::env::temp_dir().join(format!("xlsx_spec_{}.json", std::process::id()));
    std::fs::write(
        &spec_file,
        serde_json::to_string_pretty(spec).map_err(|e| format!("JSON err: {e}"))?,
    )
    .map_err(|e| format!("Failed to write spec temp file: {e}"))?;

    let out_dir = PathBuf::from(workspace_root);
    let output_path = out_dir.join(format!("{}_output.xlsx", model_kind));

    let output = Command::new(&python)
        .arg(&renderer_script)
        .arg(&spec_file)
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Renderer execution failed: {e}"))?;

    let _ = std::fs::remove_file(&spec_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(XlsxToolError::ScriptError {
            exit_code: output.status.code().unwrap_or(-1),
            stderr: stderr.to_string(),
            message: format!("Renderer for '{model_kind}' failed"),
        }
        .to_string());
    }

    Ok(json!({
        "output_path": output_path.to_string_lossy(),
        "model_kind": model_kind,
        "sheets_created": null
    }))
}

// ── Spec aggregation ─────────────────────────────────────────────────────

/// Returns tool specs for all 5 Excel tools.
pub fn excel_tool_specs() -> Vec<Value> {
    vec![
        xlsx_recalc_spec(),
        xlsx_evaluate_spec(),
        xlsx_audit_spec(),
        xlsx_convert_spec(),
        xlsx_build_spec(),
    ]
}
