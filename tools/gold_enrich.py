"""
Enrich document pages with LLM-generated labels, keywords, and metrics.

Takes parsed document pages and sends them to an LLM for enrichment
with section labels, key financial metrics, keywords, and summary.
This is the gold layer of the document ingestion pipeline.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///

import json
import os
from pathlib import Path


def execute(
    input_file: str,
    output_dir: str,
    provider: str = "openrouter",
    model: str = "deepseek/deepseek-chat",
    batch_size: int = 5,
) -> dict:
    """
    Args:
        input_file: Path to parsed JSON file (from pdf_parse or html_parse)
        output_dir: Directory to write enriched output
        provider: LLM provider for enrichment (openrouter, deepseek)
        model: Model identifier
        batch_size: Number of sections to process per LLM call

    Returns:
        dict with sections_enriched, output_file, total_metrics, total_keywords
    """
    import httpx

    inp = Path(input_file)
    if not inp.exists():
        return {"error": f"Input file not found: {input_file}"}

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    with open(inp) as f:
        data = json.load(f)

    # Handle both list (page_chunks from pdf_parse) and dict (from html_parse)
    if isinstance(data, list):
        sections = data
    elif isinstance(data, dict) and "sections" in data:
        sections = data["sections"]
    else:
        return {"error": "Unrecognized input format"}

    api_key, base_url, headers = _get_provider_config(provider)
    if not api_key:
        return {"error": f"No API key for provider '{provider}'"}

    enriched = []
    total_metrics = 0
    total_keywords = 0
    errors = []

    # Process in batches
    for i in range(0, len(sections), batch_size):
        batch = sections[i : i + batch_size]
        batch_text = "\n\n---\n\n".join(
            s.get("text", s.get("content", ""))[:2000] for s in batch
        )

        prompt = (
            "Analyze the following document sections and for each section provide:\n"
            "1. A descriptive label (e.g., 'Revenue Discussion', 'Risk Factors')\n"
            "2. Up to 5 keywords\n"
            "3. Any financial metrics mentioned (name, value, period)\n"
            "4. A one-sentence summary\n\n"
            "Return as JSON array with objects: {label, keywords, metrics, summary}\n\n"
            f"Sections:\n{batch_text}"
        )

        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 2048,
                        "response_format": {"type": "json_object"},
                    },
                )
                resp.raise_for_status()
                result = resp.json()

            content = result["choices"][0]["message"]["content"]
            parsed = json.loads(content)

            # Merge enrichment back into sections
            items = parsed if isinstance(parsed, list) else parsed.get("sections", [parsed])
            for j, item in enumerate(items):
                idx = i + j
                if idx < len(sections):
                    sections[idx]["enrichment"] = item
                    total_metrics += len(item.get("metrics", []))
                    total_keywords += len(item.get("keywords", []))
                    enriched.append(idx)

        except Exception as e:
            errors.append(f"Batch {i}-{i + batch_size}: {str(e)}")

    # Write enriched output
    output_file = out / f"{inp.stem}_enriched.json"
    with open(output_file, "w") as f:
        json.dump(sections if isinstance(data, list) else data, f, indent=2, default=str)

    return {
        "sections_enriched": len(enriched),
        "total_sections": len(sections),
        "output_file": str(output_file),
        "total_metrics": total_metrics,
        "total_keywords": total_keywords,
        "errors": errors,
    }


def _get_provider_config(provider: str) -> tuple:
    """Return (api_key, base_url, headers) for the given provider."""
    configs = {
        "openrouter": {
            "env_key": "OPENROUTER_API_KEY",
            "base_url": "https://openrouter.ai/api/v1",
        },
        "deepseek": {
            "env_key": "DEEPSEEK_API_KEY",
            "base_url": "https://api.deepseek.com/v1",
        },
    }

    cfg = configs.get(provider, configs["openrouter"])
    api_key = os.environ.get(cfg["env_key"], "")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    return api_key, cfg["base_url"], headers
