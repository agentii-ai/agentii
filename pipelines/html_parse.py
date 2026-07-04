"""
Parse an SEC EDGAR HTML filing into structured elements.

Extracts sections, tables, footnotes, and exhibits from EDGAR
HTML filings (10-K, 10-Q, 8-K, etc.) into structured JSON
suitable for agent consumption and RAG indexing.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["beautifulsoup4>=4.12", "lxml>=5.0"]
# ///

import json
from pathlib import Path


def execute(
    html_path: str,
    output_dir: str,
    filing_type: str = "auto",
) -> dict:
    """
    Args:
        html_path: Path to the EDGAR HTML filing
        output_dir: Directory to write structured output
        filing_type: Filing type hint (auto, 10-K, 10-Q, 8-K). Auto-detects if 'auto'.

    Returns:
        dict with sections_count, tables_count, output_file, filing_type
    """
    from bs4 import BeautifulSoup

    html_file = Path(html_path)
    if not html_file.exists():
        return {"error": f"HTML file not found: {html_path}"}

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    content = html_file.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(content, "lxml")

    # Remove script/style tags
    for tag in soup(["script", "style"]):
        tag.decompose()

    # Detect filing type if auto
    detected_type = filing_type
    if filing_type == "auto":
        text_lower = soup.get_text()[:5000].lower()
        if "annual report" in text_lower or "form 10-k" in text_lower:
            detected_type = "10-K"
        elif "quarterly report" in text_lower or "form 10-q" in text_lower:
            detected_type = "10-Q"
        elif "form 8-k" in text_lower:
            detected_type = "8-K"
        else:
            detected_type = "unknown"

    sections = []
    tables = []

    # Extract sections by heading tags
    for heading in soup.find_all(["h1", "h2", "h3", "h4"]):
        section_text = []
        sibling = heading.find_next_sibling()
        while sibling and sibling.name not in ["h1", "h2", "h3", "h4"]:
            if sibling.name == "table":
                tables.append({
                    "section": heading.get_text(strip=True),
                    "html": str(sibling),
                    "rows": len(sibling.find_all("tr")),
                })
            else:
                text = sibling.get_text(strip=True)
                if text:
                    section_text.append(text)
            sibling = sibling.find_next_sibling()

        if heading.get_text(strip=True):
            sections.append({
                "heading": heading.get_text(strip=True),
                "level": int(heading.name[1]),
                "content": "\n".join(section_text),
            })

    # If no headings found, extract as flat text blocks
    if not sections:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            if text and len(text) > 20:
                sections.append({
                    "heading": "",
                    "level": 0,
                    "content": text,
                })

    # Collect standalone tables not captured in sections
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) > 1:
            tables.append({
                "section": "standalone",
                "html": str(table),
                "rows": len(rows),
            })

    result = {
        "filing_type": detected_type,
        "sections": sections,
        "tables_summary": [
            {"section": t["section"], "rows": t["rows"]}
            for t in tables
        ],
    }

    output_file = out / f"{html_file.stem}_parsed.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    return {
        "filing_type": detected_type,
        "sections_count": len(sections),
        "tables_count": len(tables),
        "output_file": str(output_file),
    }
