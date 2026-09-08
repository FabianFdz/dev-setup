---
name: sprint
description: Advance the sprint-runner loop automatically, agent after agent, until it hits a real stopping reason — an open question, an error, or a PR that needs merging.
disable-model-invocation: true
argument-hint: "[next]"
allowed-tools: Bash(node:*), Bash(mkdir:*), Bash(git:*), Bash(gh:*), Read, Edit, Glob, Task
---

# /sprint — advance until a real stop

`/sprint` (any argument is ignored) drives the sprint loop forward
automatically — one agent after another — and only stops for the human when
there's a weighty reason: an open question, an error, or a PR that needs
merging. It never stops merely because one agent finished and the next
mechanical step is obvious.

## Bootstrap (first run in this project)

!`mkdir -p .claude/handoffs/current && [ -f .claude/handoffs/current/.gitkeep ] || touch .claude/handoffs/current/.gitkeep`

## Always validate current state first

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-handoff.js" 2>&1 || true`

If validation reported any failure, STOP and report it before doing anything else.

## The loop

Repeat this until you hit a real stop (below) — do not wait for the human or
re-prompt between iterations:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/next-step.js"
```
This is the coordinator's state machine — it reads `current/status.json` and
every handoff in `current/` and prints ONE JSON decision. Act on its
`action` field, then loop back to this same command:

| `action` | What to do | Loop again after? |
|---|---|---|
| `run-agent` | Launch the named `agent` via Task (`subagent_type: <agent>`), wait for it to finish | Yes — unless the agent was `documenter`, see **Sprint close** below |
| `write-handoff-and-run` | Write the file named in `write` (envelope per `${CLAUDE_PLUGIN_ROOT}/schemas/handoff.schema.json`), then launch `agent` | Same as above |
| `merge-confirm` | See **Merge confirmation** below | Yes, once merged |
| `stop` | Report `reason`. Do nothing else | No — this ends the `/sprint` invocation |

**Real stops** (`action: "stop"`) cover exactly the weighty cases: an open
question (`questions.md` exists — an agent is genuinely blocked), a broken
handoff (schema failure, missing file, unroutable state), or anything else
`next-step.js` can't make sense of. Report the `reason` verbatim and stop.
Do not paper over a `stop` by re-running the same agent yourself — that's
exactly the class of bug CONTRACT.md's bookkeeping-fix guidance exists for;
fix the underlying file if it's a clear bookkeeping mistake, otherwise ask
the human.

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
  Then continue the loop from the top — do not stop just because a merge
  happened.
- **no** → STOP, report that the merge was cancelled. Do not advance.

## Sprint close is the one automatic checkpoint

When the Documenter finishes, it updates the living docs AND closes the
sprint itself (sprint history, closing PR, archive `current/` →
`sprint-{N}/`, fresh empty `current/`). Treat that as the end of this
`/sprint` invocation — report the sprint closed and STOP, rather than
looping back into `next-step.js` (which would otherwise immediately return
`run-agent: planner` and silently start the next sprint). Starting a new
sprint is its own `/sprint` call.

## Rules
- Never stop between two purely mechanical steps (e.g. Coder finishing and
  Reviewer being the obvious next step, or the Architect being the obvious
  next step after the Planner) — only stop for a `stop` decision or a
  `merge-confirm`.
- A Reviewer rejection routes straight back to the Coder automatically, same
  as any other mechanical step — it is not itself a reason to stop.
- Still run at most one agent *at a time*, in sequence — never launch two
  agents in parallel or skip the state machine's ordering.
- If there's no epic yet, run `/epic-creator` first.
