"""
Extract text blocks and page images from a PDF file.

Processes each page to extract text with bounding boxes (as JSONL)
and renders high-DPI page snapshots (as PNG). This is the first
stage of the document ingestion pipeline (bronze layer).
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf>=1.25"]
# ///

import json
from pathlib import Path


def execute(
    pdf_path: str,
    output_dir: str,
    dpi: int = 200,
    pages: list[int] | None = None,
) -> dict:
    """
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to write page images and JSONL text blocks
        dpi: Resolution for page snapshots (default 200)
        pages: Optional page numbers to extract (1-indexed). None = all.

    Returns:
        dict with total_pages, extracted_pages, image_files, jsonl_file
    """
    import fitz

    pdf = Path(pdf_path)
    if not pdf.exists():
        return {"error": f"PDF not found: {pdf_path}"}

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf))
    total = doc.page_count
    page_indices = [p - 1 for p in pages] if pages else list(range(total))
    page_indices = [i for i in page_indices if 0 <= i < total]

    image_files = []
    all_blocks = []
    errors = []

    for idx in page_indices:
        page_num = idx + 1
        try:
            page = doc[idx]

            # Render page image
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img_path = out / f"page_{page_num:04d}.png"
            pix.save(str(img_path))
            image_files.append(str(img_path))

            # Extract text blocks with bounding boxes
            blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
            for block in blocks.get("blocks", []):
                all_blocks.append({
                    "page": page_num,
                    "bbox": block.get("bbox"),
                    "type": "text" if block.get("type") == 0 else "image",
                    "lines": [
                        {
                            "text": " ".join(
                                span.get("text", "")
                                for line_span in line.get("spans", [])
                                for span in [line_span]
                            ),
                            "bbox": line.get("bbox"),
                        }
                        for line in block.get("lines", [])
                    ] if block.get("type") == 0 else [],
                })
        except Exception as e:
            errors.append({"page": page_num, "error": str(e)})

    # Write JSONL
    jsonl_path = out / f"{pdf.stem}_blocks.jsonl"
    with open(jsonl_path, "w") as f:
        for block in all_blocks:
            f.write(json.dumps(block) + "\n")

    doc.close()

    return {
        "total_pages": total,
        "extracted_pages": len(page_indices),
        "image_files": image_files,
        "jsonl_file": str(jsonl_path),
        "block_count": len(all_blocks),
        "errors": errors,
    }
