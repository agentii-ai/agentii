"""
Send a document page image to a vision LLM for financial data extraction.

Processes page snapshots through a vision-capable LLM to extract
structured financial data (tables, charts, figures) as markdown.
Supports multiple vision LLM providers via API key configuration.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///

import base64
import json
import os
from pathlib import Path


def execute(
    image_path: str,
    output_dir: str,
    provider: str = "openrouter",
    model: str = "google/gemini-2.0-flash-001",
    prompt: str | None = None,
) -> dict:
    """
    Args:
        image_path: Path to the page image (PNG/JPG)
        output_dir: Directory to write extracted markdown
        provider: Vision LLM provider (openrouter, together_ai, deepseek)
        model: Model identifier for the provider
        prompt: Custom extraction prompt. Uses default financial extraction prompt if None.

    Returns:
        dict with output_file, model_used, tokens_used, content_length
    """
    import httpx

    img = Path(image_path)
    if not img.exists():
        return {"error": f"Image not found: {image_path}"}

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Read and encode image
    image_data = base64.b64encode(img.read_bytes()).decode("utf-8")
    media_type = "image/png" if img.suffix.lower() == ".png" else "image/jpeg"

    default_prompt = (
        "Extract all financial data from this document page image. "
        "Include tables (as markdown tables), charts (describe data points), "
        "figures (describe content), and any numerical data. "
        "Preserve the original structure and formatting. "
        "Output as clean markdown."
    )

    extraction_prompt = prompt or default_prompt

    # Build provider-specific request
    api_key, base_url, headers = _get_provider_config(provider)
    if not api_key:
        return {"error": f"No API key found for provider '{provider}'. Set the appropriate env var."}

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": extraction_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_data}",
                        },
                    },
                ],
            }
        ],
        "max_tokens": 4096,
    }

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"API error ({e.response.status_code}): {e.response.text[:500]}"}
    except Exception as e:
        return {"error": f"Request failed: {str(e)}"}

    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = result.get("usage", {})

    # Write output
    output_file = out / f"{img.stem}_scan.md"
    output_file.write_text(content, encoding="utf-8")

    return {
        "output_file": str(output_file),
        "model_used": model,
        "tokens_used": usage.get("total_tokens", 0),
        "content_length": len(content),
    }


def _get_provider_config(provider: str) -> tuple:
    """Return (api_key, base_url, headers) for the given provider."""
    configs = {
        "openrouter": {
            "env_key": "OPENROUTER_API_KEY",
            "base_url": "https://openrouter.ai/api/v1",
        },
        "together_ai": {
            "env_key": "TOGETHER_AI_API_KEY",
            "base_url": "https://api.together.xyz/v1",
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
