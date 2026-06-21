# Lane le2-stash-expand — Expand the element stash with MORE preloaded content

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/le2-stash-expand`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. App in **`editor/`**; samples at REPO-ROOT
`samples/minimax-m3-high/*.html` (now ~70 sites incl. lusion, active-theory, locomotive, cuberto, resn,
14islands, etc.). Run node from `editor/`.

## Goal
The element stash (`editor/src/library/elements/manifest.json`, currently ~129 entries) needs MORE
preloaded content — richer variety per category + new categories — so users have a real bank to drag from.
Pure data. NO UI.

## Hard guardrails
- **NO UI / no edits to `editor/src/app/**`, `editor/src/styles/**`, `index.html`.** You only EXTEND the
  elements library data under `editor/src/library/elements/`.
- Keep it BROWSER-SAFE: the app imports `manifest.json` directly. Do not make the app depend on node:fs.
- No new npm deps. No secrets. Each element's `html` must be SELF-CONTAINED (inline styles or a `css` field).

## The task
1. Extend `editor/src/library/elements/dissect.mjs` (or add a companion script) to also dissect the NEWER
   samples added since the first pass, and to pull MORE variety per category.
2. Add these categories if missing, with quality hand-or-derived components: `pricing` (tables/cards),
   `faq`, `feature` (feature grids/3-up), `stats` (metric rows), `logos` (logo cloud), `contact` (forms),
   `banner`, `divider`. Keep the existing ones (nav/hero/button/chip/card/badge/cta/section/footer/form/
   gallery/testimonial) and DEEPEN them (aim ~20+ each where the samples support it).
3. Regenerate `editor/src/library/elements/manifest.json` so total is **≥ 250** unique, self-contained,
   tasteful entries `{ id, category, name, tags, html, css, source }`. Dedupe near-identical; drop broken/empty.
   Names should be human ("Pricing — 3 tier", "Hero — split image", not raw text dumps).
4. Update `editor/src/library/elements/index.test.js` so it still passes and asserts the new count + that
   every entry has html and a unique id.

## DoD
- manifest ≥ 250 entries (state count + per-category breakdown), all self-contained, unique ids, human names.
- `node --test src/library/elements/` passes. From `editor/`: `npm run build` stays GREEN.
- New/changed files only under `editor/src/library/elements/`.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add editor/src/library/elements
git config user.email "swarm@rhobear"; git config user.name "le2-stash-expand"
git commit -m "feat(library): expand element stash to 250+ (more variety + pricing/faq/feature/stats/logos/contact)"
git push -u origin lane/le2-stash-expand
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/le2-stash-expand \
  --title "Stash: expand element library to 250+ with richer variety" \
  --body "Deepens the element stash with more per-category variety + new categories (pricing/faq/feature/stats/logos/contact). Self-contained, human-named. No UI.

## Evidence
<paste: total count + per-category breakdown; node --test output; npm run build tail>

## DoD
- [x] >=250 unique self-contained - [x] human names - [x] tests green - [x] build green - [x] elements/ only - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
