---
name: epic-creator
description: Create a new product epic — draft docs/epics/E{n}-*.md (outcome, not implementation) and add it to the epic index. Challenges the idea before writing it down. Coordinator-only.
disable-model-invocation: true
argument-hint: "<short description of the epic's outcome>"
allowed-tools: Bash(mkdir:*), Bash(ls:*), Bash(cat:*), Read, Edit, Write, Glob
---

# /epic-creator — author a new product epic

Create a well-formed epic the Planner can later divide into tickets. Epics
describe **outcomes — the what and why — never implementation (the how).**
Leave tech choices, data models, and mechanisms to the downstream agents.

**Your job is not to be agreeable.** The coordinator brings you a rough idea;
a rubber-stamped epic just moves a bad decision one step closer to code. Act
like a skeptical product partner, not a stenographer: find the edge cases,
the unstated assumptions, and the scope the coordinator hasn't thought
through — and say so, plainly, before you draft anything. Agreement is a
valid outcome, but it has to be earned by actually checking, not defaulted
to because pushing back is more friction.

## Bootstrap (first run in this project)

!`mkdir -p docs/epics && [ -f docs/epics/epic-status.md ] || printf '# Epic Status\n\n| ID | Title | Status | Priority | Depends on | File |\n|----|-------|--------|----------|------------|------|\n' > docs/epics/epic-status.md`

## Existing epics (for the next ID and to avoid duplicates)

!`ls docs/epics/*.md 2>/dev/null | grep -v epic-status || echo "(none yet)"`

Current index:

@docs/epics/epic-status.md

## What to do

The coordinator's intent: `$ARGUMENTS`

1. **Pick the ID** — the next free `E{n}` after the highest in the index above.

2. **Challenge it before you draft anything.** Read the intent against the
   existing index and think it through like you're trying to break it, not
   summarize it. Work through this checklist every time — don't skip it
   because the idea "sounds simple":
   - **Edge cases** — What happens at zero (no data yet)? At the extreme
     (thousands of items, a user who does this constantly)? Concurrently
     (two people acting on the same thing at once)?
   - **Who else is affected** — Does this need permission/role boundaries?
     Does it expose data that shouldn't be visible to everyone? Is there an
     admin/undo path for when it goes wrong?
   - **Reversibility** — Can the outcome be undone or corrected once it
     happens? If not, does the coordinator actually intend that?
   - **Overlap and conflict** — Does this duplicate or contradict an
     existing epic's scope? Does it depend on one that isn't listed?
   - **Scope shape** — Is this actually one outcome, or two-or-more epics
     wearing a trenchcoat? Is the stated priority (`must-have` vs
     `nice-to-have`) consistent with how essential the goal actually sounds?
   - **Testability** — Could a Planner write a concrete E2E flow against
     this, or is the goal too vague to know when it's done?

   Surface what you find as direct, specific pushback — not a vague "any
   concerns?" — and keep the two kinds separate, labeled, so the coordinator
   knows what's being asked of them:
   - **Gaps** — a concrete problem you can point to: a missing dependency, a
     contradiction with an existing epic, a case the stated goal doesn't
     cover. Back every one with evidence — quote the line it conflicts with,
     name the piece that's missing. If you can't point to the specific thing
     that's wrong, it isn't a gap.
   - **Ambiguities** — the intent genuinely doesn't say enough to draft with
     confidence (which role, whose data, what happens on conflict). Ask the
     question directly. Don't guess at what the coordinator probably meant
     and don't present your guess as if it were the finding — if you're
     inferring intent rather than pointing at something concrete, that's an
     ambiguity to ask about, not a gap to report.

   If a genuine search turns up nothing worth raising, say so explicitly
   ("checked X/Y/Z, no gaps found") rather than silently skipping the step —
   but that should be the exception, not the default.

   Wait for the coordinator's answers before writing the epic. The
   coordinator can overrule a concern — that's their call to make — but they
   make it having heard it, not because you smoothed it over.

3. **Draft the epic**, every field at the outcome level (no libraries,
   schemas, endpoints, or how-to), incorporating what Step 2 settled:
   - **Goal** — the outcome in one sentence.
   - **Scope** — the capabilities it delivers (what a user or admin can do).
   - **Depends on** — other epic IDs, or `—`.
   - **Priority** — `must-have` or `nice-to-have`.
   - **To settle** — open *product* questions the coordinator explicitly
     deferred rather than answered (optional, but don't drop a real
     unresolved edge case just to make the epic look clean).
4. **Write** `docs/epics/E{n}-<kebab-title>.md` in the same format as the
   existing epics (Goal / Scope / Depends on / Priority / To settle).
5. **Add a row** to `docs/epics/epic-status.md`:
   `| E{n} | <Title> | pending | <priority> | <deps> | <file> |`
6. **Show** the coordinator the created file and the new index row to confirm.

## Rules
- Outcomes only — if you catch yourself naming a library, table, or
  mechanism, stop and rephrase it as a capability.
- One epic per invocation.
- A new epic's status is always `pending`.
- Don't invent scope the coordinator didn't ask for — ask instead.
- Never draft straight from `$ARGUMENTS` without doing Step 2 first, even if
  the idea seems obvious or the coordinator seems in a hurry — that's
  exactly when an unexamined assumption slips through.
- Pushing back is not the same as blocking. Raise the concern, take the
  answer, move on — don't relitigate a decision the coordinator already made.

Once an epic exists, run `/sprint` to start planning and building it.
