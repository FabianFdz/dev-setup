# sprint-runner

A Claude Code plugin that turns an epic into shipped, reviewed PRs through
five agents:

```
/epic-creator  ->  drafts docs/epics/E{n}-*.md

/sprint        ->  Planner -> Architect -> [you merge the design PR]
                    -> (Coder -> Reviewer -> [you merge]) per ticket
                    -> Documenter (docs + sprint history + closing PR)
```

Everything is human-gated: `/sprint` advances exactly one step and always
stops for you to approve or merge before continuing. Nothing auto-chains.

Works alongside your project's own `CLAUDE.md` — this plugin never reads or
edits it. Its own rules live in `CONTRACT.md`, bundled inside the plugin, and
every agent is told to read it first.

## Install

Once, per machine — register this repo as a marketplace:
```bash
claude plugin marketplace add FabianFdz/dev-setup
```
(or, working from a local clone: `claude plugin marketplace add /path/to/dev-setup`)

Then, in any project you want it in:
```bash
claude plugin install sprint-runner@fabian-dev-setup
```

To pick up changes after editing this plugin:
```bash
claude plugin marketplace update fabian-dev-setup
```

## Use

```
/epic-creator add a "favorite desks" list users can star and filter by
/sprint
/sprint
/sprint
...
```

`/sprint` bootstraps `.claude/handoffs/current/` and `docs/epics/` in the
target project on first use — nothing to set up by hand beyond installing
the plugin. It needs `git` and `gh` (GitHub CLI) on your PATH, and `node` for
its own scripts (no other dependency — the schema validator is
hand-rolled, zero npm packages).

## What lives where

- **In the plugin** (never copied into your project): the 5 agent
  definitions, the 2 skills, `CONTRACT.md`, the schemas, and the
  orchestration scripts (`next-step.js`, `validate-handoff.js`,
  `close-sprint.js`).
- **In your project** (created on first use, git-tracked like any other
  file): `docs/epics/`, `docs/adr/`, `docs/sprint-history/`,
  `.claude/handoffs/current/` (and `sprint-{N}/` once archived), and
  `.claude/memory/{agent}.md` (each agent's own persistent notes).

## Extending

The 5-agent roster (planner, architect, coder, reviewer, documenter) is
deliberately minimal — no dedicated security/QA/devops/db agents. To add
one: create `agents/{name}.md`, add its transitions to
`scripts/lib/handoff.js` and `schemas/handoff.schema.json`'s agent enum, and
teach `scripts/next-step.js` the new routing.
