# Lane w3-import-export — Harden import (folder/asset/embed) + export (HTML/ZIP), full round-trip

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/w3-import-export`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
App lives in **`editor/`** (NOT repo root). Work under `editor/src/engine/`. Reuse, do NOT duplicate:
- core serializer: `editor/src/core/` (`serialize`/`deserialize`/`createDocument`)
- W2 engine: `editor/src/engine/live-render.js` (`buildLiveDocument`, `rewriteAssetUrls`, `extractDocumentParts`),
  `editor/src/engine/diff-serializer.js` (`applyOverrides`), `editor/src/engine/style-overrides.js`.
Existing (legacy) IO is `editor/src/lib/file-io.js` + `editor/src/lib/serializer.js` — do NOT edit them;
build a hardened layer that supersedes them, to be wired in later.
Run npm/node from `editor/`.

## Goal
Make import/export robust and lossless so a stood-up site survives the full loop: import (single HTML,
folder with assets, raw embed) -> edit -> export (clean HTML, ZIP) -> re-serve -> still looks + works.

## Hard guardrails
- **NO UI / styling / React.** Owner builds all UX. Do NOT touch `editor/src/styles/**`, `index.html`,
  `editor/src/editor/**`, `editor/src/core/**`, `editor/src/lib/**`, `package.json`, `vite.config.js`.
- Create NEW files ONLY under `editor/src/engine/`. Do NOT create `editor/src/engine/index.js` (reserved).
- `jszip` + `file-saver` are already deps — you MAY import them. No OTHER new deps. No secrets/node_modules/dist.

## Build `editor/src/engine/io.js`
- `importHtml(rawHtml) -> { html, css, scripts, title, assets }` — uses live-render `extractDocumentParts`;
  preserves scripts. Pure/string-level.
- `importFolder(fileEntries) -> { html, css, title, assetMap }` — fileEntries = `[{ path, getUrl() }]`
  abstraction (so it's testable without the browser File API); finds the entry HTML, builds an assetMap,
  rewrites refs via `rewriteAssetUrls`. Document the entry-resolution rules.
- `exportHtml({ html, css, scripts? }, overrides?) -> string` — clean standalone document; if an override
  store/object is passed, fold it via `diff-serializer.applyOverrides`; PRESERVE scripts. Reuse core
  serializer for the body where it helps.
- `exportZip({ html, css, scripts?, assetMap? }, overrides?) -> Promise<Blob>` — index.html + styles.css +
  assets/ via jszip. Keep the browser-only `saveAs` OUT of this function (return the Blob; a thin caller
  can save) so it unit-tests in node.
- Round-trip guarantee: `exportHtml(importHtml(x))` preserves the body markup + scripts of `x`
  (normalized). Test it on tricky inputs.

## Definition of Done (ALL)
- `editor/src/engine/io.js` exists with the API + JSDoc.
- `editor/src/engine/io.test.js` under `node --test src/engine/` passes: importHtml preserves scripts/title,
  importFolder asset rewrite (with a fake fileEntries fixture), exportHtml folds overrides + keeps scripts,
  exportZip produces a Blob/zip with index.html+styles.css+assets, and the round-trip guarantee.
- From `editor/`: `npm run build` stays GREEN.
- No files changed outside `editor/src/engine/`.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "w3-import-export"
git commit -m "feat(engine): hardened import/export (folder+asset+embed, HTML/ZIP) with lossless round-trip"
git push -u origin lane/w3-import-export
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/w3-import-export \
  --title "Wave3: hardened import/export + round-trip" \
  --body "Robust import (single/folder/embed) + export (HTML/ZIP), scripts preserved, lossless round-trip. Tests/build evidence below.

## Evidence
<paste: node --test src/engine/ output; npm run build tail>

## DoD
- [x] node --test green  - [x] build green  - [x] reuses core+engine (no dup)  - [x] new files only  - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
