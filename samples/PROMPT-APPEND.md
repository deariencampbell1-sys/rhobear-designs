# Prompt append — paste after the main brief

Copy everything below the line into the same message as the main recreation prompt. Replace `YOUR_MODEL_NAME` and the output path with the row that matches the agent you are running.

---

## REPO & COMPETITION INSTRUCTIONS (required)

**Repo:** `rhobear-designs` (workspace root may be `C:\Users\slang\rhobear-designs` or a clone of that repo)

**You are:** `YOUR_MODEL_NAME` — see the table below.

This is a **multi-model competition**: the same brief is run on several models in parallel. Each model submits **one independent recreation** of the **live website URL(s)** in the prompt. The owner compares outputs to decide which model is best. You are **not** collaborating with or building on other models' files.

### Your output folder (use only this one)

| If you are this model | Write files only here |
|------------------------|------------------------|
| Claude Opus 4.7 | `rhobear-designs/samples/claude-opus-4.7/` |
| Grok Composer 2.5 | `rhobear-designs/samples/grok-composer-2.5/` |
| Grok Build Beta | `rhobear-designs/samples/grok-build-beta/` |
| MiniMax M3 High | `rhobear-designs/samples/minimax-m3-high/` |
| MiniMax M3 Medium | `rhobear-designs/samples/minimax-m3-medium/` |
| MiniMax M2.7 | `rhobear-designs/samples/minimax-m2.7/` |

**Do not** create a new folder. **Do not** write under `samples/<other-model>/`. **Do not** put deliverables at the repo root.

### Design reference (what to copy)

- **Source of truth:** the **live website URL(s)** appended to this prompt (open them, study layout, color, type, motion, interactions).
- **Not a source of truth:** any `.html` already inside `samples/` — those are **other competitors' entries**, not reference implementations.

**Mission:** Make your own high-fidelity recreation of the **real site**, then save it in **your** folder. Same filename as peers is fine (e.g. `bruno-simon-portfolio.html`); **same code lifted from another folder is not.**

If the live URL is down, use official public material for **that** site (owner's GitHub, case study, archive). Still do not open sibling folders under `samples/` for "inspiration."

### Deliverable rules

1. **One self-contained HTML file per URL** in this batch — Tailwind via CDN (or inline) plus JS libs as needed.
2. **Filename:** clear and URL-based, e.g. `bruno-simon-portfolio.html` — not `output.html`.
3. **Comment block at top of file:** Original URL, live-site observations, challenges solved (per main prompt).
4. **Update only your folder's `README.md`** with status and filename when done.
5. Read `samples/AGENTS.md` and `samples/README.md` if anything is unclear.

### Hard prohibitions

- Do not read, grep, diff, or refactor HTML in `samples/<other-model>/`.
- Do not "start from" or "improve" another model's submission.
- Do not edit the main prompt rules or other models' READMEs/status tables.

**You are graded on taste, craft, and fidelity to the live website — not on matching another agent's file in the repo.**