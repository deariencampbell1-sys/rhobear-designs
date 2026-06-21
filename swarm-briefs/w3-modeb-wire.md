# Lane w3-modeb-wire — Headless "Build from scratch" (Mode B) mount API over the vendored GrapesJS

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/w3-modeb-wire`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
App lives in **`editor/`** (NOT repo root). Work under `editor/src/engine/`. Vendored GrapesJS is at
`editor/src/vendor/grapesjs/`. Existing GrapesJS init is `editor/src/editor/grapes-init.js`
(`createEditor()`, plus addSection/addTextBlock/addImageBlock/insertEmbed). Core at `editor/src/core/`.
Run npm/node from `editor/`.

## Goal
The editor has two modes. "Edit Live Site" (Mode A) is the W2 engine. THIS lane builds **Mode B "Build
from scratch"**: a clean, headless lifecycle wrapper around the vendored GrapesJS so the (human-built) shell
can mount/unmount it and read/write content. Plumbing only — NO visual shell, NO styling.

## Hard guardrails
- **NO UI / theming / final styling / React.** Owner builds all UX. Do NOT modify `editor/src/styles/**`,
  `index.html`, `editor/src/editor/grapes-init.js` (you IMPORT from it, don't edit it),
  `editor/src/core/**`, `editor/src/vendor/**`, `package.json`, `vite.config.js`.
- Create NEW files ONLY under `editor/src/engine/`. Do NOT create `editor/src/engine/index.js` (reserved).
- No new npm deps. No secrets/node_modules/dist.

## Build `editor/src/engine/mode-b.js`
A framework-agnostic lifecycle API wrapping the existing GrapesJS editor:
- `mountModeB(container, opts?) -> handle` — initializes GrapesJS (reuse `createEditor` from
  `../editor/grapes-init.js`) into the given container; returns a handle.
- handle API: `setContent({ html, css })`, `getContent() -> { html, css }`, `onChange(cb)`,
  `addSection()/addText()/addImage(src)/insertEmbed(code)` (delegate to the existing helpers),
  `undo()/redo()`, `destroy()` (clean teardown — remove editor, listeners, DOM).
- Bridge to the headless core where natural: `getContent()` output must round-trip through
  `editor/src/core` serializer (`deserialize(getContent())` then `serialize(...)` stable). Don't duplicate
  the serializer; reuse core.
- Keep all GrapesJS specifics behind this module so the shell never imports GrapesJS directly.

## Definition of Done (ALL)
- `editor/src/engine/mode-b.js` exists with the API + JSDoc; GrapesJS is only referenced through it.
- `editor/src/engine/mode-b.test.js` under `node --test src/engine/` passes for the headless-testable
  parts (content get/set normalization, core round-trip of getContent output, teardown idempotency).
  DOM-dependent mount may use a small Playwright spec `editor/tests/e2e/mode-b.spec.js` (mounts into a
  blank page) OR a documented manual-verify note — do not leave it silently untested.
- From `editor/`: `npm run build` stays GREEN.
- No files changed outside `editor/src/engine/` (and optionally `editor/tests/e2e/mode-b.spec.js`).

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "w3-modeb-wire"
git commit -m "feat(engine): headless Mode-B (build-from-scratch) mount API over vendored GrapesJS"
git push -u origin lane/w3-modeb-wire
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/w3-modeb-wire \
  --title "Wave3: Mode-B mount API (build from scratch)" \
  --body "Clean headless lifecycle wrapper around vendored GrapesJS; shell never touches GrapesJS directly. Tests/build evidence below.

## Evidence
<paste: node --test src/engine/ output; npm run build tail; playwright or manual note>

## DoD
- [x] node --test green  - [x] build green  - [x] GrapesJS only via mode-b  - [x] no UI/styles"
```
Print the final PR URL on its own line. Then STOP.
