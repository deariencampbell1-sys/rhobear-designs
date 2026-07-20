# Model samples

Drop finished work for each model in its folder. One brief, one deliverable per model — same prompt, different outputs, so we can pick the model for the final job.

This is a **competition**. The owner needs to compare models fairly. Copying another model's sample invalidates your entry.

---

## Design reference — read this first

### Use the URL in the prompt

Every brief includes one or more **target website URLs**. Those URLs are the **only** authoritative design reference.

1. **Visit and study the live site** — layout, colors, typography, interactions, responsive behavior, section order.
2. **Rebuild from that site** — your own HTML/CSS/JS, your own implementation choices.
3. **Match fidelity to the real site** — not to whatever happens to already be in this repo.

If the live site is unreachable, use public source material tied to that site (e.g. the owner's open-source repo, case studies, archived pages). Still **do not** use another model's folder as a shortcut.

### Do not copy other models' samples

| Allowed | Not allowed |
|---------|-------------|
| Reading `samples/README.md` and your own folder's README | Reading or opening `samples/<other-model>/` deliverables to "get started" |
| Using the prompt URL as design reference | Copy-pasting, refactoring, or "improving" another model's HTML |
| Grep/glob to find **your** folder path | Grep across `samples/` to see how competitors solved the brief |
| Same filename as peers (e.g. `bruno-simon-portfolio.html`) | Same code structure, palette, or 3D approach lifted from a peer file |

**Why:** Other folders contain **competitors' entries**, not reference implementations. If everyone copies the first submission, we cannot tell which model is actually good.

**Example:** For Bruno Simon, the live site is the 2025 folio (`https://bruno-simon.com/` — driving game, plum UI, rolling terrain). An entry that recreates the old 2019 flat-grid version, or that traces another model's file, is off-brief even if it "looks fine."

---

## Folders

| Folder | Model |
|--------|-------|
| `claude-opus-4.7/` | Claude Opus 4.7 |
| `grok-composer-2.5/` | Grok Composer 2.5 |
| `grok-build-beta/` | Grok Build Beta |
| `minimax-m3-high/` | MiniMax M3 High |
| `minimax-m3-medium/` | MiniMax M3 Medium |
| `minimax-m2.7/` | MiniMax M2.7 (not Highspeed / Flash) |

---

## Submission rules

1. **Only your model's folder** — do not edit another model's samples or status tables.
2. **Design from the prompt URL** — not from sibling folders in `samples/`.
3. **Self-contained deliverables** — HTML/CSS/JS that opens in a browser without a build step, unless the brief says otherwise.
4. **Name files clearly** — e.g. `bruno-simon-portfolio.html`, not `output.html`.
5. **Document your source** — at the top of each HTML file (comment block): original URL, what you observed on the live site, challenges you solved. Optionally add `PROMPT.txt` beside the file with the exact brief.

---

## Agent checklist (before you commit)

- [ ] I identified **my** model folder and did not open other models' deliverables.
- [ ] I used the **website URL(s) from the prompt** as the design reference.
- [ ] My file is self-contained and named clearly.
- [ ] I updated **only** my folder's README status (not the whole status table in this file unless asked).

---

## Status

| Model | Sample |
|-------|--------|
| Claude Opus 4.7 | — |
| Grok Composer 2.5 | `bruno-simon-portfolio.html` |
| Grok Build Beta | — |
| MiniMax M3 High | — |
| MiniMax M3 Medium | `bruno-simon-portfolio.html` |
| MiniMax M2.7 | — |