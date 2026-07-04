# Skill Authoring Guide

Skills are markdown bundles that extend the agentii agent with domain-specific instructions and tool access. A skill is a single `SKILL.md` file (or any `.md` file) with a YAML frontmatter header followed by a system-prompt extension in markdown.

---

## Anatomy of a Skill

```markdown
---
description: One-sentence description shown in /skills list and tool selection.
tools: [tool_name_1, tool_name_2]
trigger: optional regex or keyword that auto-activates this skill
---

# Skill Title

Your system-prompt extension goes here. Write it as instructions to the agent.

## Section 1

Detailed guidance...

## Section 2

More guidance...
```

### Frontmatter fields

| Field | Required | Description |
|---|---|---|
| `description` | yes | Short description (shown in `/skills` and tool-selection UI) |
| `tools` | no | List of tool names this skill needs. The agent will only call these tools when the skill is active. |
| `trigger` | no | Regex or keyword phrase that auto-activates the skill when matched in the user prompt |
| `model` | no | Override the model for this skill (e.g. `claude-opus-4-5`) |
| `max_tokens` | no | Override max output tokens |

---

## File Layout

Skills live in `agentii/backend/skills/` (built-in) or `~/.agentii/skills/` (user-installed):

```
skills/
└── my-skill/
    └── SKILL.md        # required — the skill definition
```

The directory name becomes the skill's slug (e.g. `my-skill`). The file must be named `SKILL.md` (case-insensitive).

---

## Minimal Example

```markdown
---
description: Summarise git history in plain English.
tools: [bash]
---

# Git History Summariser

When asked to summarise git history, run `git log --oneline -20` and explain
each commit in one sentence. Group related commits together. Use plain English,
no jargon.
```

Save this as `skills/git-summary/SKILL.md` and invoke it with:

```
/skills git-summary
```

or let the agent auto-select it when the user asks about git history (if you set a `trigger`).

---

## Financial Skill Example

```markdown
---
description: Deep financial document search with 99% accuracy.
tools:
  - fetch_filtered_document_names
  - fetch_document_outline
  - fetch_document_chunk_content
  - search_keyword_in_source
  - fetch_financial_statement
  - fetch_stock_info
trigger: "SEC|10-K|10-Q|earnings|revenue|EPS|guidance"
---

# Financial Document Retrieval

You are a financial document retrieval specialist. Follow this 4-step strategy:

## Step 1: Filter
Call `fetch_filtered_document_names` to discover available documents.
Filter by `ticker`, `year`, `source_type` as appropriate.

## Step 2: Outline
Call `fetch_document_outline` with the `source_id` to map section headings.

## Step 3: Fetch
Call `fetch_document_chunk_content` with targeted `row_numbers`.
Format citations as `[ref](ref_id-row_number)`.

## Step 4: Search
If Step 3 missed the data point, use `search_keyword_in_source`.
```

---

## Tool Access

The `tools` list restricts which tools the agent may call while the skill is active. If omitted, the agent has access to its full tool suite.

Available tool names (subset):

**File system**
- `read_file`, `write_file`, `edit_file`, `glob_search`, `grep_search`

**Shell**
- `bash`

**Web**
- `WebFetch`, `WebSearch`

**Agent**
- `Agent`, `TodoWrite`, `StructuredOutput`, `Skill`

**Financial**
- `fetch_filtered_document_names`, `fetch_document_outline`, `fetch_document_chunk_content`
- `search_keyword_in_source`, `fetch_financial_statement`, `fetch_stock_info`
- `read_market_context`, `stage_order`

**Utility**
- `ToolSearch`, `NotebookEdit`, `Sleep`, `Brief`, `Config`

---

## Trigger Auto-Activation

Set `trigger` to a regex pattern. When the user's prompt matches, the skill is automatically prepended to the system prompt:

```yaml
trigger: "earnings|quarterly results|beat|miss|guidance"
```

Triggers are case-insensitive. If multiple skills match, all are activated in alphabetical order.

---

## Writing Effective Skill Instructions

1. **Be specific about when to use each tool.** Don't just list tools — explain the decision logic.

2. **Define the output format.** If you want citations, tables, or a specific structure, say so explicitly.

3. **Handle edge cases.** What should the agent do if a document is not found? If the API returns an error?

4. **Keep it focused.** A skill should do one thing well. Compose multiple skills for complex workflows.

5. **Use imperative mood.** Write "Call `fetch_document_outline`…" not "The agent should call…".

---

## Installing a Skill

**Built-in (shipped with agentii):** Place in `agentii/backend/skills/<slug>/SKILL.md` and rebuild.

**User-installed:** Place in `~/.agentii/skills/<slug>/SKILL.md`. No rebuild needed — skills are loaded at agent startup.

**Via CLI:**

```bash
agentii skills install /path/to/my-skill/SKILL.md
agentii skills list
agentii skills show my-skill
```

---

## Invoking a Skill

**Slash command:**

```
/skills my-skill
```

**Direct invocation in a prompt:**

```
Use the earnings-analysis skill to analyse NVDA Q4 2024 results.
```

**Auto-trigger:** If the skill has a `trigger` pattern and the user's prompt matches, it activates automatically.

---

## Debugging Skills

```bash
# List all loaded skills
agentii skills

# Show a skill's full content
agentii skills show my-skill

# Run with verbose logging to see skill activation
RUST_LOG=agentii_tools=debug agentii run "analyse NVDA earnings"
```

---

## Skill Registry

The skill registry is loaded from:

1. `agentii/backend/skills/` (built-in, compiled into the binary path)
2. `~/.agentii/skills/` (user-installed, loaded at runtime)
3. `.agentii/skills/` (project-local, loaded when the agent starts in that directory)

Project-local skills take precedence over user-installed, which take precedence over built-in.

---

## Versioning and Compatibility

- Skills are plain markdown — no compilation needed.
- The `tools` list is validated at load time; unknown tool names produce a warning but do not prevent the skill from loading.
- The `description` field is used for semantic tool-selection by the agent; write it as a clear, searchable sentence.
