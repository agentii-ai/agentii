"""
Check the status of a long-running pipeline task.

Reads the status file written by workspace_ingest or other
long-running pipeline tools to report progress back to the agent.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import json
from pathlib import Path


def execute(
    task_id: str,
    workspace_dir: str,
    output_dir: str | None = None,
) -> dict:
    """
    Args:
        task_id: The task ID returned by the pipeline tool
        workspace_dir: Root directory of the workspace
        output_dir: Output directory where status files are written. Defaults to workspace/.agentii/silver/

    Returns:
        dict with task_id, status, progress, current_file, completed, total, errors
    """
    workspace = Path(workspace_dir)
    out = Path(output_dir) if output_dir else workspace / ".agentii" / "silver"

    status_file = out / f".{task_id}_status.json"

    if not status_file.exists():
        return {
            "task_id": task_id,
            "status": "not_found",
            "error": f"No status file found for task {task_id}",
        }

    try:
        with open(status_file) as f:
            status = json.load(f)
        return status
    except Exception as e:
        return {
            "task_id": task_id,
            "status": "error",
            "error": f"Failed to read status: {str(e)}",
        }
