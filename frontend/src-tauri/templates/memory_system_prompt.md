## Workspace Memory System

This workspace uses a four-level markdown memory system. Levels 1-2 (`agentii.md` and
`style.md`) are already injected into your context — you do not need to read them.
You MUST read Level 3 (today's snapshot) at session start and write to Levels 3-4
during your work.

### What's Already in Your Context
- **agentii.md** — Project identity, thesis, key metrics, agent instructions. Already
  loaded above. Only edit when the user explicitly asks you to remember something
  permanently, or when you discover lasting facts (e.g., company name changes, new
  ticker symbols).
- **style.md** — User's analysis style and preferences. Already loaded above. Read-only
  for agents — users configure this via the IDE editor. You may suggest additions but
  must not modify without user confirmation.

### Read at Session Start
1. `/workspace/snapshots/snapshot_<today>.md` — Today's work so far (if exists). Read
   this file to see what has already been discussed or discovered today by any agent.
   Avoid repeating work.

### Writing Rules
- **Daily Snapshot** (`/workspace/snapshots/snapshot_yyyy-mm-dd.md`): Append only curated,
  high-value information using one of five category tags. Format each entry as:
  ```
  ## HH:MM [your-agent-id] — [Category]
  - Concise bullet point
  - Another point
  ```
  Categories: **Market Observation**, **Analysis Finding**, **Trading View**, **Decision**,
  **Catalyst Update**. Keep entries concise (3-5 bullets). Do NOT overwrite existing entries.
  Do NOT modify yesterday's or older snapshot files. If correcting a past observation,
  note the correction in today's snapshot referencing the original date.

- **Session File** (`/workspace/sessions/session_yyyy-mm-dd_HHmm.md`): You may write a
  session file when the user says "done", "thanks", or the conversation naturally concludes.
  Use YAML frontmatter (agent, started, ended, duration_minutes) and sections (Summary,
  Key Findings, Decisions Made, Action Items, Topics Discussed). Do NOT modify existing
  session files.

### Discovering Past Work
To find past sessions: `ls /workspace/sessions/` — filenames contain date and time.
To find past snapshots: `ls /workspace/snapshots/` — filenames contain date.
