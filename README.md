# dev-setup

Fabian Fernandez's personal Claude Code plugin marketplace — reusable Claude
Code agents, skills, and hooks I install across projects, instead of
re-copying `.claude/` config into every repo by hand.

## Install

Add this marketplace once per machine:
```bash
claude plugin marketplace add FabianFdz/dev-setup
```
(or, working from a local clone: `claude plugin marketplace add /path/to/dev-setup`)

Then install a plugin in any project:
```bash
claude plugin install sprint-runner@fabian-dev-setup
```

Update everything after pulling changes:
```bash
claude plugin marketplace update fabian-dev-setup
```

## Plugins

- **[sprint-runner](plugins/sprint-runner/)** — turns a product epic into
  shipped, reviewed PRs through a 5-agent pipeline. `/epic-creator` drafts
  the epic; `/sprint` advances it one human-approved step at a time through
  planner → architect → coder → reviewer → documenter. Works alongside any
  project's own `CLAUDE.md` without touching it — see the
  [plugin README](plugins/sprint-runner/README.md) for how the pipeline and
  handoff protocol work.

## Layout

```
.claude-plugin/marketplace.json   # marketplace manifest, lists the plugins below
plugins/
  sprint-runner/                    # one plugin = one self-contained directory
```

Adding a new plugin means creating `plugins/<name>/` with its own
`.claude-plugin/plugin.json`, then adding an entry to
`.claude-plugin/marketplace.json`.
