"""
Download SEC EDGAR filings for a given ticker symbol.

Retrieves filing documents (10-K, 10-Q, 8-K, etc.) from the SEC
EDGAR system, including the primary filing HTML and any attachments.
Respects SEC rate limits and user-agent requirements.
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///

import json
import os
import time
from pathlib import Path


def execute(
    ticker: str,
    output_dir: str,
    filing_type: str = "10-K",
    count: int = 1,
    user_agent: str | None = None,
) -> dict:
    """
    Args:
        ticker: Company ticker symbol (e.g., AAPL, MSFT)
        output_dir: Directory to save downloaded filings
        filing_type: SEC filing type (10-K, 10-Q, 8-K, etc.)
        count: Number of most recent filings to download (max 10)
        user_agent: SEC-required user agent string. Falls back to EDGAR_USER_AGENT env var.

    Returns:
        dict with ticker, filing_type, filings_found, downloaded_files, errors
    """
    import httpx

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    agent = user_agent or os.environ.get(
        "EDGAR_USER_AGENT", "Agentii/1.0 (research@example.com)"
    )
    count = min(count, 10)

    headers = {
        "User-Agent": agent,
        "Accept-Encoding": "gzip, deflate",
    }

    errors = []
    downloaded = []

    try:
        # Step 1: Look up CIK from ticker
        with httpx.Client(timeout=30, headers=headers) as client:
            resp = client.get(
                "https://efts.sec.gov/LATEST/search-index",
                params={"q": ticker, "dateRange": "custom", "startdt": "2020-01-01"},
            )

            # Use company tickers JSON for CIK lookup
            tickers_resp = client.get(
                "https://www.sec.gov/files/company_tickers.json"
            )
            tickers_resp.raise_for_status()
            tickers_data = tickers_resp.json()

            cik = None
            for entry in tickers_data.values():
                if entry.get("ticker", "").upper() == ticker.upper():
                    cik = str(entry["cik_str"]).zfill(10)
                    break

            if not cik:
                return {"error": f"Ticker '{ticker}' not found in SEC EDGAR"}

            # Step 2: Get filing index
            time.sleep(0.15)  # SEC rate limit: 10 req/sec
            submissions_resp = client.get(
                f"https://data.sec.gov/submissions/CIK{cik}.json"
            )
            submissions_resp.raise_for_status()
            submissions = submissions_resp.json()

            recent = submissions.get("filings", {}).get("recent", {})
            forms = recent.get("form", [])
            accessions = recent.get("accessionNumber", [])
            primary_docs = recent.get("primaryDocument", [])
            filing_dates = recent.get("filingDate", [])

            # Filter by filing type
            matches = []
            for i, form in enumerate(forms):
                if form == filing_type and i < len(accessions):
                    matches.append({
                        "accession": accessions[i].replace("-", ""),
                        "accession_raw": accessions[i],
                        "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
                        "filing_date": filing_dates[i] if i < len(filing_dates) else "",
                    })
                if len(matches) >= count:
                    break

            if not matches:
                return {
                    "ticker": ticker,
                    "filing_type": filing_type,
                    "filings_found": 0,
                    "downloaded_files": [],
                    "errors": [f"No {filing_type} filings found for {ticker}"],
                }

            # Step 3: Download each filing
            for match in matches:
                time.sleep(0.15)  # SEC rate limit
                accession = match["accession"]
                doc_name = match["primary_doc"]
                filing_date = match["filing_date"]

                if not doc_name:
                    errors.append(f"No primary document for accession {match['accession_raw']}")
                    continue

                doc_url = (
                    f"https://www.sec.gov/Archives/edgar/data/"
                    f"{cik.lstrip('0')}/{accession}/{doc_name}"
                )

                try:
                    doc_resp = client.get(doc_url)
                    doc_resp.raise_for_status()

                    safe_date = filing_date.replace("-", "")
                    filename = f"{ticker}_{filing_type}_{safe_date}_{doc_name}"
                    filepath = out / filename
                    filepath.write_bytes(doc_resp.content)
                    downloaded.append({
                        "file": str(filepath),
                        "filing_date": filing_date,
                        "accession": match["accession_raw"],
                        "size_bytes": len(doc_resp.content),
                    })
                except Exception as e:
                    errors.append(f"Failed to download {doc_url}: {str(e)}")

    except httpx.HTTPStatusError as e:
        return {"error": f"SEC API error ({e.response.status_code}): {e.response.text[:500]}"}
    except Exception as e:
        return {"error": f"Download failed: {str(e)}"}

    return {
        "ticker": ticker,
        "filing_type": filing_type,
        "filings_found": len(downloaded),
        "downloaded_files": downloaded,
        "errors": errors,
    }
