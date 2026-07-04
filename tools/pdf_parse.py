"""
Parse extracted PDF blocks into structured document elements.

Takes the JSONL output from pdf_extract and produces structured
elements: headings, paragraphs, tables, and metadata. This is the
silver layer of the document ingestion pipeline.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf>=1.25", "pymupdf4llm>=0.0.17"]
# ///

import json
from pathlib import Path


def execute(
    pdf_path: str,
    output_dir: str,
    pages: list[int] | None = None,
    include_images: bool = False,
) -> dict:
    """
    Args:
        pdf_path: Path to the original PDF file
        output_dir: Directory to write structured output
        pages: Optional page numbers to parse (1-indexed). None = all.
        include_images: Whether to include image descriptions in output

    Returns:
        dict with total_pages, elements_count, markdown_file, json_file
    """
    import pymupdf4llm

    pdf = Path(pdf_path)
    if not pdf.exists():
        return {"error": f"PDF not found: {pdf_path}"}

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    page_chunks = pymupdf4llm.to_markdown(
        str(pdf),
        pages=([p - 1 for p in pages] if pages else None),
        show_progress=False,
        page_chunks=True,
    )

    # Write markdown
    md_path = out / f"{pdf.stem}_parsed.md"
    with open(md_path, "w") as f:
        for chunk in page_chunks:
            f.write(f"<!-- Page {chunk.get('metadata', {}).get('page', '?')} -->\n")
            f.write(chunk.get("text", "") + "\n\n")

    # Write structured JSON
    json_path = out / f"{pdf.stem}_parsed.json"
    with open(json_path, "w") as f:
        json.dump(page_chunks, f, indent=2, default=str)

    return {
        "total_pages": len(page_chunks),
        "markdown_file": str(md_path),
        "json_file": str(json_path),
        "elements_count": sum(
            len(c.get("text", "").split("\n")) for c in page_chunks
        ),
    }
