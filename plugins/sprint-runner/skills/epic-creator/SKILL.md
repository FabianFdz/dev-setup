---
name: epic-creator
description: Create a new product epic — draft docs/epics/E{n}-*.md (outcome, not implementation) and add it to the epic index. Coordinator-only.
disable-model-invocation: true
argument-hint: "<short description of the epic's outcome>"
allowed-tools: Bash(mkdir:*), Bash(ls:*), Bash(cat:*), Read, Edit, Write, Glob
---

# /epic-creator — author a new product epic

Create a well-formed epic the Planner can later divide into tickets. Epics
describe **outcomes — the what and why — never implementation (the how).**
Leave tech choices, data models, and mechanisms to the downstream agents.

## Bootstrap (first run in this project)

!`mkdir -p docs/epics && [ -f docs/epics/epic-status.md ] || printf '# Epic Status\n\n| ID | Title | Status | Priority | Depends on | File |\n|----|-------|--------|----------|------------|------|\n' > docs/epics/epic-status.md`

## Existing epics (for the next ID and to avoid duplicates)

!`ls docs/epics/*.md 2>/dev/null | grep -v epic-status || echo "(none yet)"`

Current index:

@docs/epics/epic-status.md

## What to do

The coordinator's intent: `$ARGUMENTS`

1. **Pick the ID** — the next free `E{n}` after the highest in the index above.
2. **Draft the epic** from the intent, every field at the outcome level
   (no libraries, schemas, endpoints, or how-to):
   - **Goal** — the outcome in one sentence.
   - **Scope** — the capabilities it delivers (what a user or admin can do).
   - **Depends on** — other epic IDs, or `—`.
   - **Priority** — `must-have` or `nice-to-have`.
   - **To settle** — open *product* questions, if any (optional).
   If goal, scope, priority, or dependencies are unclear, ask the
   coordinator before writing.
3. **Write** `docs/epics/E{n}-<kebab-title>.md` in the same format as the
   existing epics (Goal / Scope / Depends on / Priority / To settle).
4. **Add a row** to `docs/epics/epic-status.md`:
   `| E{n} | <Title> | pending | <priority> | <deps> | <file> |`
5. **Show** the coordinator the created file and the new index row to confirm.

## Rules
- Outcomes only — if you catch yourself naming a library, table, or
  mechanism, stop and rephrase it as a capability.
- One epic per invocation.
- A new epic's status is always `pending`.
- Don't invent scope the coordinator didn't ask for — ask instead.

Once an epic exists, run `/sprint` to start planning and building it.
