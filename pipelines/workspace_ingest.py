"""
Scan workspace for PDF and HTML files and run the full ingestion pipeline.

Orchestrates the bronze-to-silver document processing pipeline:
discovers files, extracts content, parses structure, and writes
results to the workspace's .agentii/silver/ directory. For large
workspaces, returns immediately with a task_id for progress polling.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf>=1.25", "pymupdf4llm>=0.0.17", "beautifulsoup4>=4.12", "lxml>=5.0"]
# ///

import json
import time
import uuid
from pathlib import Path


def execute(
    workspace_dir: str,
    output_dir: str | None = None,
    file_types: list[str] | None = None,
    max_files: int = 50,
) -> dict:
    """
    Args:
        workspace_dir: Root directory of the workspace to scan
        output_dir: Output directory for processed files. Defaults to workspace/.agentii/silver/
        file_types: File extensions to process (default: ["pdf", "html", "htm"])
        max_files: Maximum number of files to process in one run

    Returns:
        dict with task_id, status, files_found, files_processed, output_dir, errors
    """
    workspace = Path(workspace_dir)
    if not workspace.exists():
        return {"error": f"Workspace not found: {workspace_dir}"}

    out = Path(output_dir) if output_dir else workspace / ".agentii" / "silver"
    out.mkdir(parents=True, exist_ok=True)

    extensions = file_types or ["pdf", "html", "htm"]
    task_id = f"ingest_{uuid.uuid4().hex[:8]}"

    # Discover files
    files = []
    for ext in extensions:
        files.extend(workspace.rglob(f"*.{ext}"))

    # Exclude .agentii directory itself
    files = [f for f in files if ".agentii" not in f.parts]
    files = files[:max_files]

    if not files:
        return {
            "task_id": task_id,
            "status": "completed",
            "files_found": 0,
            "files_processed": 0,
            "output_dir": str(out),
            "errors": [],
        }

    # Write status file for progress tracking
    status_file = out / f".{task_id}_status.json"
    _write_status(status_file, {
        "task_id": task_id,
        "status": "running",
        "total": len(files),
        "completed": 0,
        "current_file": "",
        "errors": [],
    })

    processed = []
    errors = []

    for i, filepath in enumerate(files):
        _write_status(status_file, {
            "task_id": task_id,
            "status": "running",
            "total": len(files),
            "completed": i,
            "current_file": filepath.name,
            "progress": i / len(files),
            "errors": errors,
        })

        file_out = out / filepath.stem
        file_out.mkdir(parents=True, exist_ok=True)

        try:
            if filepath.suffix.lower() == ".pdf":
                result = _process_pdf(filepath, file_out)
            elif filepath.suffix.lower() in (".html", ".htm"):
                result = _process_html(filepath, file_out)
            else:
                continue

            if "error" in result:
                errors.append({"file": str(filepath), "error": result["error"]})
            else:
                processed.append({
                    "file": str(filepath),
                    "output": str(file_out),
                    **result,
                })
        except Exception as e:
            errors.append({"file": str(filepath), "error": str(e)})

    # Final status
    _write_status(status_file, {
        "task_id": task_id,
        "status": "completed",
        "total": len(files),
        "completed": len(processed),
        "progress": 1.0,
        "errors": errors,
    })

    return {
        "task_id": task_id,
        "status": "completed",
        "files_found": len(files),
        "files_processed": len(processed),
        "output_dir": str(out),
        "processed": processed,
        "errors": errors,
    }


def _process_pdf(pdf_path: Path, output_dir: Path) -> dict:
    """Extract and parse a PDF file."""
    import fitz
    import pymupdf4llm

    doc = fitz.open(str(pdf_path))
    total_pages = doc.page_count
    doc.close()

    # Use pymupdf4llm for structured extraction
    page_chunks = pymupdf4llm.to_markdown(
        str(pdf_path),
        show_progress=False,
        page_chunks=True,
    )

    md_path = output_dir / f"{pdf_path.stem}.md"
    with open(md_path, "w") as f:
        for chunk in page_chunks:
            f.write(chunk.get("text", "") + "\n\n")

    json_path = output_dir / f"{pdf_path.stem}.json"
    with open(json_path, "w") as f:
        json.dump(page_chunks, f, indent=2, default=str)

    return {
        "type": "pdf",
        "total_pages": total_pages,
        "markdown_file": str(md_path),
        "json_file": str(json_path),
    }


def _process_html(html_path: Path, output_dir: Path) -> dict:
    """Parse an HTML filing."""
    from bs4 import BeautifulSoup

    content = html_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(content, "lxml")

    for tag in soup(["script", "style"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    md_path = output_dir / f"{html_path.stem}.md"
    md_path.write_text(text, encoding="utf-8")

    sections = []
    for heading in soup.find_all(["h1", "h2", "h3"]):
        sections.append({
            "heading": heading.get_text(strip=True),
            "level": int(heading.name[1]),
        })

    json_path = output_dir / f"{html_path.stem}.json"
    with open(json_path, "w") as f:
        json.dump({"sections": sections, "text_length": len(text)}, f, indent=2)

    return {
        "type": "html",
        "sections_count": len(sections),
        "text_length": len(text),
        "markdown_file": str(md_path),
        "json_file": str(json_path),
    }


def _write_status(path: Path, data: dict):
    """Write pipeline status to a JSON file for progress polling."""
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
