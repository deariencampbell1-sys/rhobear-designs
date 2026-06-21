# Lane med1-media-bucket — Free media bucket (images + gifs) catalog + BYO gif-provider client

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/med1-media-bucket`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run node there.

## Goal
The editor needs a MEDIA BUCKET the user can drop images/gifs from — for a free/MIT product. Build a
headless catalog of FREE/open-license media + a search client that supports a BYO gif-provider key
(Giphy/Tenor) the way the app does BYO-LLM. Pure data + loaders. NO UI.

## Hard guardrails
- **NO UI / styling / React.** Data + loaders + docs only. Owner builds the media panel UX.
- ONLY free/open-license sources. Do NOT bundle copyrighted media binaries. Reference by URL.
- Browser-safe: import JSON via `import x from './catalog.json' with { type: 'json' }` — do NOT use node:fs
  in the loader (it must bundle for the browser; the elements lane's fs loader broke the build — don't repeat).
- Create NEW files ONLY under `editor/src/library/media/`. No other edits, no new npm deps, no secrets.

## Build it
1. `editor/src/library/media/catalog.json` — curated free media references:
   - **images**: stable royalty-free sources — Picsum (`https://picsum.photos/seed/<name>/<w>/<h>`),
     Unsplash Source, Pexels CDN, or similar; ~40-60 entries spanning categories
     (`abstract, texture, gradient, nature, people, product, tech, pattern`). Each:
     `{ id, type:'image', category, url, thumb, license, source, w, h }`.
   - **gifs**: a small set of CC0/open gifs (e.g. from openly-licensed collections) if you can find stable
     URLs; otherwise `gifs: []` and document the BYO provider below. Same entry shape with `type:'gif'`.
   - Also include a set of pure-CSS **gradient** swatches (no URL): `{ id, type:'gradient', css }` for
     backgrounds (~12 tasteful gradients).
2. `editor/src/library/media/index.js` — headless loader (browser-safe JSON import):
   `listMedia(type?, category?)`, `getMedia(id)`, `categories()`, and `gradients()`.
3. `editor/src/library/media/gif-provider.js` — a BYO gif-search client:
   `searchGifs({ query, provider:'giphy'|'tenor', apiKey, limit })` → builds the correct provider REST URL
   and `fetch`es it, normalizing results to `[{ id, url, thumb, title }]`. No key is bundled; the caller
   passes it (BYO, like the LLM keys). Pure URL-building must be unit-testable without network.
4. `editor/src/library/media/README.md` — document the licensing of bundled media + how BYO Giphy/Tenor
   keys plug in (where the user enters them — the app's settings, next phase).
5. `editor/src/library/media/index.test.js` (`node --test src/library/media/`): catalog valid, every image
   entry has url+license, gradients have css, gif-provider URL building correct for giphy + tenor (assert
   the constructed URL string; do NOT hit the network).

## DoD
- catalog + loaders + gif client + README + tests pass; `npm run build` GREEN from `editor/`; new files only
  under `editor/src/library/media/`; no UI; browser-safe imports (no node:fs in loaders).

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git config user.email "swarm@rhobear" && git config user.name "med1-media-bucket"
git commit -m "feat(library): free media bucket (images/gifs/gradients) + BYO gif-provider client"
git push -u origin lane/med1-media-bucket
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/med1-media-bucket \
  --title "W: media bucket (free images/gifs/gradients + BYO gif provider)" \
  --body "Headless free-media catalog + loaders + BYO Giphy/Tenor search client. Browser-safe JSON imports, no UI.

## Evidence
<paste: media counts by type; node --test output; npm run build tail>

## DoD
- [x] catalog+loaders+gif client+README - [x] tests green - [x] build green - [x] browser-safe - [x] new files only - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
