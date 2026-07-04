//! Agentic search strategy section — the retrieval decision tree.

pub fn agentic_search_strategy_section() -> &'static str {
    r#"## Agentic Search Strategy

When answering financial questions requiring document retrieval, follow this deterministic strategy:

### Step 1: Filter Documents
Use `fetch_filtered_document_names` to find relevant sources:
- Filter by ticker, year, source_type, date range
- Review source titles and descriptions to select the most relevant

### Step 2: Read Outline (Table of Contents)
Use `fetch_document_outline` to get the document structure:
- Identify which sections contain the information you need
- Note the row_numbers for relevant sections

### Step 3: Fetch Specific Pages
Use `fetch_document_chunk_content` with targeted row_numbers:
- Fetch only the sections you identified in Step 2
- Prefer specific page fetches over broad keyword search

### Step 4: Keyword Search (if needed)
Use `search_keyword_in_source` for targeted keyword lookup:
- Use when you need to find specific terms across a document
- Paginate through results (20 per page)

### Citation Format
Every factual claim MUST include a citation: [ref](ref_id-row_number)
Example: Revenue was $44.9B [ref](nvda-10k-2024-p47)

### Multi-Period Queries
For queries spanning multiple fiscal periods, use `knowledge_staff_task` to spawn
parallel financial-retrieval sub-agents — one per period."#
}
