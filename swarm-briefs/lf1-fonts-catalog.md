# Lane lf1-fonts-catalog — Open-license FONT catalog + loader

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/lf1-fonts-catalog`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run node there.

## Goal
A curated catalog of OPEN-LICENSE fonts (so a free/MIT product can ship them) the font picker will use.
Pure data + a headless loader that injects the stylesheet on demand. NO UI, NO binaries.

## Hard guardrails
- **NO UI / styling / React.** Data + loader only. Owner builds the font-picker UX.
- ONLY open licenses (OFL / Apache-2.0 / Ubuntu FL) — Google Fonts families qualify. Record the license.
- Do NOT bundle font binary files. Load via the providers' CSS URLs (e.g. Google Fonts `css2`) at runtime.
- Create NEW files ONLY under `editor/src/library/fonts/`. No existing-file edits, no `editor/src/styles/**`,
  no new npm deps, no secrets/node_modules/dist.

## Build it
1. `editor/src/library/fonts/catalog.json` — a curated set (aim ~40-60 families) spanning categories
   `sans, serif, display, mono, handwriting`. Each: `{ family, category, weights:[…], license, cssUrl }`
   where `cssUrl` is the provider stylesheet URL (e.g.
   `https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap`). Include staples
   (Inter, DM Sans, Poppins, Manrope, Space Grotesk, Playfair Display, Fraunces, Lora, JetBrains Mono,
   etc.) — all open-license.
2. `editor/src/library/fonts/index.js` — headless: `listFonts(category?)`, `getFont(family)`,
   `loadFont(family)` (idempotently injects a `<link rel=stylesheet href=cssUrl>` into document.head when
   in a browser; no-op + return false in node), `fontStack(family)` (family + sensible fallback).
3. `editor/src/library/fonts/index.test.js` (`node --test src/library/fonts/`): catalog valid JSON,
   every entry has family/category/cssUrl/license, only open licenses present, loader lists by category,
   fontStack returns a fallback chain.

## Definition of Done (ALL)
- catalog (~40-60, all open-license) + loader, tests pass, `npm run build` GREEN from `editor/`.
- New files only under `editor/src/library/fonts/`. No UI/styles touched.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "lf1-fonts-catalog"
git commit -m "feat(library): open-license font catalog + on-demand loader"
git push -u origin lane/lf1-fonts-catalog
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/lf1-fonts-catalog \
  --title "W4: open-license font catalog + loader" \
  --body "Curated open-license font catalog (OFL/Apache) + headless on-demand loader. No UI, no binaries.

## Evidence
<paste: family count + license breakdown; node --test output; npm run build tail>

## DoD
- [x] catalog all-open-license + loader  - [x] tests green  - [x] build green  - [x] new files only  - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
