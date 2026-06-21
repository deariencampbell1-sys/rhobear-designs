# Lane tn1-fullpage-thumbs — Regenerate template thumbnails as FULL-PAGE tall captures

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/tn1-fullpage-thumbs`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run from `editor/`.

## Goal
The template gallery shows thumbnails too small/cropped to tell sites apart, and we want a "page rolls"
hover effect that reveals the whole design. That needs **full-page tall** screenshots (not 1280x800
viewport crops). Regenerate every template thumbnail as a full-page capture. Data/asset task — NO UI.

## Hard guardrails
- **NO edits to `editor/src/app/**`, `editor/src/styles/**`, `index.html`, or any loader code.** You only
  regenerate the PNG files under `editor/src/library/templates/thumbs/` and may update the existing
  `gen-thumbs.mjs` if one exists. No new npm deps beyond what's installed (playwright is available).
- No secrets. Keep filenames EXACTLY matching the manifest `thumb` entries (so the gallery finds them).

## The task
- Read `editor/src/library/templates/manifest.json` (entries: `{ id, sourcePath, thumb }`).
- For each entry, render its `sourcePath` (repo-root, e.g. `samples/minimax-m3-high/orage-studio.html`) in
  headless Chromium at width 1280, and capture a **full-page** screenshot (`fullPage: true`), capped to a
  reasonable max height (e.g. clamp page height to ≤ 5000px so giant infinite-scroll pages stay sane).
  Give it a short settle time (~1.2s) for fonts/hero animation, scroll to bottom then top to trigger
  lazy/scroll reveals before capturing.
- Write each PNG to the EXACT path in `entry.thumb` (e.g. `editor/src/library/templates/thumbs/<id>.png`),
  overwriting the viewport-only ones. Use webp/png; keep file size reasonable (resize width to ~640 on save
  if helpful — height proportional). Update `gen-thumbs.mjs` so it's re-runnable: `node src/library/templates/gen-thumbs.mjs`.
- If Chromium can't render a particular sample (error/timeout), keep its existing thumb and note it.

## DoD
- Thumbnails regenerated full-page for the minimax-m3-high collection at minimum (state how many done/skipped).
- Filenames unchanged (still match manifest). `npm run build` stays GREEN. Only `thumbs/*.png` (+ gen-thumbs.mjs) changed.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add editor/src/library/templates/thumbs editor/src/library/templates/gen-thumbs.mjs
git config user.email "swarm@rhobear"; git config user.name "tn1-fullpage-thumbs"
git commit -m "assets(templates): regenerate thumbnails as full-page tall captures (gallery roll-on-hover)"
git push -u origin lane/tn1-fullpage-thumbs
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/tn1-fullpage-thumbs \
  --title "Templates: full-page thumbnails (bigger, scroll-reveal)" \
  --body "Regenerates template thumbnails as full-page tall captures so the gallery can show bigger, identifiable previews + a roll-on-hover. Filenames unchanged.

## Evidence
<paste: count regenerated/skipped; a couple example dimensions>

## DoD
- [x] full-page thumbs - [x] filenames match manifest - [x] build green - [x] only thumbs+gen-thumbs changed"
```
Print the final PR URL on its own line. Then STOP.
