# sprint-runner — Agent Contract

Loaded by every agent in this plugin, every invocation, in every project it's
enabled in. This file lives inside the plugin (`${CLAUDE_PLUGIN_ROOT}/CONTRACT.md`)
— it is never copied into your project and never touches your project's own
`CLAUDE.md`. Project-specific conventions (stack, structure, test commands,
review standards) belong in *your* `CLAUDE.md` / `.claude/context/*` — agents
read those too, from the project root, alongside this file.

---

## The pipeline

Five agents, one epic per sprint (a large epic may span more than one sprint —
the Planner decides):

```
Sprint setup (once per sprint):
  Planner -> Architect -> [design PR opened, human merges]

Per-ticket cycle (repeats for each ticket in the sprint):
  Coder -> Reviewer -> [human merges]

Sprint close (after every ticket is done and merged):
  Documenter (updates docs, writes sprint history, opens the closing PR,
  archives current/ -> sprint-{N}/)
```

`/sprint` advances this by exactly one step per invocation and always stops
for a human to merge or confirm before continuing. Nothing auto-chains.

## On uncertainty

When an agent is blocked or unsure, it appends the question to
`.claude/handoffs/current/questions.md` and STOPS. Never assume, never guess,
never proceed past a blocker. You (the human) resolve it by editing the
relevant handoff/state and re-running `/sprint`.

## Reviewability

Every change must be reviewable without fatigue (defect detection drops
sharply past ~200 lines of diff; ~400 is a hard ceiling).
- Keep tickets small — the Planner scopes them small, and the Coder splits a
  ticket into several small sequential PRs if the work turns out larger than
  expected. Never code first and then ask to re-split the ticket.
- Handoffs and reports are concise and skimmable: what changed, why, what to
  verify. No walls of prose.
- Mechanical checks (format, lint, types, tests) belong in your project's own
  hooks/CI, not in agent judgment — the Reviewer focuses on logic, security,
  and design, not things a linter already catches.
- AI-generated code carries more, and subtler, defects than human code.
  Review it more carefully per line; never rubber-stamp.

## PR hygiene

A sprint opens exactly three *kinds* of PR — never a fourth:
1. **One design PR** (Architect, sprint setup) — `plan.md`, `design.md`, and
   any ADRs, together, separate from any ticket's diff.
2. **One PR per ticket** (Coder) — split further only when a ticket's own
   diff is too large for one review pass, never for unrelated reasons.
3. **One closing PR** (Documenter, sprint close) — living docs, sprint
   history, and the `current/` -> `sprint-{N}/` archive move, all in that one
   PR (possibly several commits).

A process/bookkeeping fix (a wrong `status.json` field, a script bug) is
never its own standalone PR — fold it into whichever PR is already open.

## Handoff protocol

All agent-to-agent communication happens via JSON files in
`.claude/handoffs/current/` — never via prose. `/sprint` bootstraps this
directory the first time it's missing.

- Every handoff uses the envelope: `{ sprint, from, to, status, timestamp, payload }`.
- Valid `status` values: `pending` | `in_progress` | `approved` | `rejected`.
- Valid agent names: `planner` | `architect` | `coder` | `reviewer` |
  `documenter` | `human`.
- Filename is always `{from}-to-{to}.json`.
- Every agent reads ONLY its own inbound handoff(s) — never other files in
  `current/`, except `status.json` (shared progress tracker, see below).
- Sprint progress lives in `current/status.json` — each agent updates ONLY
  its own field(s). This is what lets a sprint resume mid-way after an
  interruption.
- Sprint working artifacts (`plan.md`, `design.md`) also live in `current/`
  and get archived with the sprint by the Documenter.
- Schemas: `${CLAUDE_PLUGIN_ROOT}/schemas/handoff.schema.json` and
  `status.schema.json`. `/sprint` validates every file in `current/` against
  them before doing anything else — if validation fails, it stops and reports
  the error instead of guessing.

## Definition of done

Tracked deterministically in `current/status.json`, never by judgment.
- **Ticket done**: `design`, `code`, and `codeReview` are all
  `done`/`approved`.
- **Ticket merged**: `merged: "done"` — set only by `/sprint`, only after a
  human explicitly confirms the merge. `status: "done"` alone does NOT mean
  merged.
- **Sprint done**: `plan: "done"`, every ticket `status: "done"` AND
  `merged: "done"`, and `docsUpdated: "done"`.

## Timestamps

Always get the real timestamp before writing any handoff — never hardcode a
date string:
```sh
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

## Agent memory

Each agent owns one persistent file in *your* project:
`.claude/memory/{agent-name}.md` (e.g. `.claude/memory/coder.md`). It is
separate from `current/` — it survives sprint archival and carries process
learnings forward, not sprint state. It may not exist yet; create it the
first time you have something worth writing.

- **Read** it at the start of every invocation, before anything else.
- **Write** to it only when you hit something that changes how you'll act
  next time — a repeated mistake, a project-specific gotcha, a convention
  not written elsewhere. An uneventful run adds nothing.
- Every entry is a short, reusable **rule**, not a narration of one ticket.
  If you can't imagine a *different* future ticket where the rule applies
  verbatim, it doesn't belong in memory.
- Prefer editing/merging an existing entry over appending a new one. Keep the
  file short — it's memory, not an archive.
- Never write another agent's memory file.
