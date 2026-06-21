# Lane le1-element-dissector — Carve a reusable ELEMENT LIBRARY out of the 51 template sites

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/le1-element-dissector`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
The editor app is in **`editor/`**. The source sites are at REPO-ROOT **`samples/minimax-m3-high/*.html`**
(51 recreations of beautiful sites) — from `editor/` that's `../samples/minimax-m3-high/`. Engine to reuse:
`editor/src/engine/live-render.js` (`extractDocumentParts`). Run node from `editor/`.

## Goal
The editor needs a STASH of reusable building blocks the user drags in / swaps — "chips, bubbles, buttons,
cards, navs, heroes, footers, CTAs, sections." Dissect the 51 sample sites into a categorized library of
clean, self-contained snippets. Pure data + a headless loader. NO UI.

## Hard guardrails
- **NO UI / styling / React / DOM-render code.** The human owner builds all UX. You produce DATA + a loader.
- Create NEW files ONLY under `editor/src/library/elements/`. Do NOT modify existing files, do NOT touch
  `editor/src/styles/**`, `index.html`, `editor/src/app/**`, `editor/src/editor/**`. No new npm deps
  (use node builtins + the existing engine). No secrets/node_modules/dist.

## Build it
1. A build script `editor/src/library/elements/dissect.mjs` (run with `node`) that reads the sample HTML
   files, and for each, extracts candidate reusable elements by tag/role/class heuristics:
   categories = `nav, hero, button, chip, card, badge, cta, section, footer, form, gallery, testimonial`.
   For each extracted element produce a CLEAN, SELF-CONTAINED snippet: `{ id, category, name, tags[],
   html, css, source }` where `css` is the minimal rules needed (scope/inline so it renders standalone),
   `source` = sample filename. Dedupe near-identical snippets. Aim for a useful spread (~6-12 per category
   where available; quality over raw count — drop broken/empty ones).
2. Commit the GENERATED catalog at `editor/src/library/elements/manifest.json` (an array of the element
   objects above) so the app doesn't need to run the script at load.
3. `editor/src/library/elements/index.js` — headless loader: `listCategories()`, `listElements(category?)`,
   `getElement(id)`, reading `manifest.json`.
4. `editor/src/library/elements/index.test.js` (`node --test src/library/elements/`): manifest is valid
   JSON, every entry has id/category/html, loader filters by category, ids are unique.

## Definition of Done (ALL)
- `manifest.json` exists with a solid categorized set (state the count + per-category breakdown in the PR).
- `node --test src/library/elements/` passes. From `editor/`: `npm run build` stays GREEN.
- New files only under `editor/src/library/elements/`. No UI/styles touched.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "le1-element-dissector"
git commit -m "feat(library): dissect 51 templates into a reusable element library (manifest + loader)"
git push -u origin lane/le1-element-dissector
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/le1-element-dissector \
  --title "W4: element library (chips/buttons/cards/heros/sections from templates)" \
  --body "Dissects the 51 sample sites into a categorized, self-contained element stash. Data + headless loader, no UI.

## Evidence
<paste: element count + per-category breakdown; node --test output; npm run build tail>

## DoD
- [x] manifest + loader  - [x] node --test green  - [x] build green  - [x] new files only  - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
