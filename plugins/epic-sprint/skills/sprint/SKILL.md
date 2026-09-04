---
name: sprint
description: Advance the epic-sprint loop by exactly one step — reads current/status.json and every handoff in current/, decides what runs next, and acts on it.
disable-model-invocation: true
argument-hint: "[next]"
allowed-tools: Bash(node:*), Bash(mkdir:*), Bash(git:*), Bash(gh:*), Read, Edit, Glob, Task
---

# /sprint — advance one step

`/sprint` (any argument is ignored — there is only one action) advances the
sprint loop by exactly one step.

## Bootstrap (first run in this project)

!`mkdir -p .claude/handoffs/current && [ -f .claude/handoffs/current/.gitkeep ] || touch .claude/handoffs/current/.gitkeep`

## Always validate current state first

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-handoff.js" 2>&1 || true`

If validation reported any failure, STOP and report it before doing anything else.

## Advance one step
```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/next-step.js"
```
This is the coordinator's state machine — it reads `current/status.json` and
every handoff in `current/` and prints ONE JSON decision. Act on its
`action` field exactly:

| `action` | What to do |
|---|---|
| `run-agent` | Launch the named `agent` via Task (`subagent_type: <agent>`) |
| `write-handoff-and-run` | Write the file named in `write` (envelope per `${CLAUDE_PLUGIN_ROOT}/schemas/handoff.schema.json`), then launch `agent` |
| `merge-confirm` | See **Merge confirmation** below |
| `stop` | Report `reason`. Do nothing else |

One logical step per invocation, then STOP.

**Merge confirmation (`action: "merge-confirm"`):**
Show the human the decision's `payload` (ticket ID or design phase, PR
URL(s), merge command(s)).

Then ask explicitly: "Confirm merge of PR `<pr-url>`? (yes / no)"

- **yes** → run the merge command(s); once they succeed, update
  `current/status.json` and refresh `updatedAt`:
  - `payload.ticket` present → set that ticket's `merged: "done"` — this is
    the only record that the merge happened; `ticket.status: "done"` alone
    doesn't mean merged and never flips back, so without this the script
    would re-suggest the same merge-confirm forever.
  - `payload.phase === "design"` (the Architect's dedicated design PR) → set
    `designMerged: "done"` instead. This is the gate that unblocks the
    Coder for the rest of the sprint.
  Then re-run `node "${CLAUDE_PLUGIN_ROOT}/scripts/next-step.js"` and act on
  the new decision.
- **no** → STOP, report that the merge was cancelled. Do not advance.

**Sprint closes inside the Documenter step.** When the Documenter finishes,
it updates the living docs AND closes the sprint itself (sprint history,
closing PR, archive `current/` → `sprint-{N}/`, fresh empty `current/`) —
there is no separate closing step to chase. The next `/sprint` will find an
empty `current/` and the script will return `run-agent: planner`, starting
the next sprint.

## Rules
- Run at most ONE agent per invocation.
- Never auto-chain the whole loop — the human approves between every step.
- If there's no epic yet, run `/epic-creator` first.
