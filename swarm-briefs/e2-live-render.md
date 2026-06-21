# Lane e2-live-render — Live-render pipeline: show a real site EXACTLY as stood-up, scripts intact

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/e2-live-render`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical — read first)
The editor app lives in the **`editor/`** subdirectory, NOT repo root. All your work goes under
`editor/src/engine/`. The headless core is at `editor/src/core/` (import { serialize, deserialize, createDocument } from '../core/index.js'). The vendored engine is at `editor/src/vendor/`. Run all npm/node commands from `editor/`.

## Goal of this lane
The product's killer feature is "Edit Live Site": load a stood-up website and render it in the canvas
**pixel-identical to how it serves** — scripts run, CSS/fonts load, animation/WebGL all live. This lane
builds the headless module that produces that live iframe document. NO editing yet (other lanes do
overlay/edit); just faithful live rendering + asset handling.

## Hard guardrails
- **NO UI / styling / visual design / React.** Pure module + tests. The human owner builds all UX.
- Create NEW files ONLY under `editor/src/engine/`. Do NOT modify existing files, do NOT create
  `editor/src/engine/index.js` (reserved — the orchestrator wires it). Do NOT touch `editor/src/styles/**`,
  `index.html`, `editor/src/editor/**`, `editor/src/core/**`, `editor/vendor/**`, `package.json`, `vite.config.js`.
- No new npm deps. No secrets/`node_modules/`/`dist/`.

## Build `editor/src/engine/live-render.js`
A framework-agnostic module that turns imported site source into a faithful live document for an iframe:
- `buildLiveDocument({ html, css?, assets? }) -> string` — returns a complete HTML document string
  suitable for `iframe.srcdoc`, PRESERVING the original `<head>` (stylesheets, `<style>`, fonts, meta),
  `<script>` tags (inline + src), and body. If given a fragment, wrap it minimally. Do NOT strip scripts.
- `rewriteAssetUrls(html, assetMap) -> html` — rewrite relative `src`/`href`/`url(...)` refs to provided
  blob/object URLs (folder-import case). Pure string transform; well-tested with tricky cases
  (quotes, `./`, nested paths, srcset, css `url()`).
- `extractDocumentParts(rawHtml) -> { headHtml, bodyHtml, scripts, styles, links, title }` — a
  dependency-free parser (use a minimal tokenizer or regex with documented limits) that splits a raw
  HTML doc so the renderer can preserve everything. Document the limits honestly in JSDoc.
- Export a short JSDoc-typed public API. Keep DOM-coupling out of the pure functions so they unit-test in node.

## Definition of Done (ALL)
- `editor/src/engine/live-render.js` exists with the API above + JSDoc.
- `editor/src/engine/live-render.test.js` runs under `node --test src/engine/` (from editor/) and passes:
  asset-url rewriting (multiple cases incl. srcset + css url), part extraction (scripts/styles/links/title
  preserved), buildLiveDocument keeps `<script>` tags and head links.
- From `editor/`: `npm ci` then `npm run build` stays GREEN (your module import-resolves).
- No files changed outside `editor/src/engine/`.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "e2-live-render"
git commit -m "feat(engine): faithful live-render pipeline (scripts/CSS/fonts preserved) + asset rewrite"
git push -u origin lane/e2-live-render
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/e2-live-render \
  --title "Wave2: live-render pipeline (render site as stood-up)" \
  --body "Headless module that renders an imported site pixel-identical to stood-up (scripts intact) + asset rewriting. Node tests + build evidence below.

## Evidence
<paste: node --test src/engine/ output; npm run build tail>

## DoD
- [x] node --test green  - [x] build green  - [x] new files only under editor/src/engine/  - [x] no UI/styles"
```
Print the final PR URL on its own line. Then STOP.
