# Lane ap1-asset-pipeline — Image/asset insert + management (headless)

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/ap1-asset-pipeline`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run node there.

## Goal
There's nowhere to insert a photo/image. Build the headless asset layer the UX will surface: register
uploaded images, hold object-URLs or base64 embeds, and produce insertion snippets. NO UI.

## Hard guardrails
- **NO UI / styling / React.** Headless API + tests only. Owner builds the image-insert UX.
- Create NEW files ONLY under `editor/src/library/assets/`. No existing-file edits, no `editor/src/styles/**`,
  no new npm deps, no secrets/node_modules/dist.

## Build it
- `editor/src/library/assets/registry.js` — `createAssetRegistry()`: `addFromUrl(url,name?)`,
  `addFromFile(file,{embed?})` (browser: `URL.createObjectURL` or base64 dataURL when `embed`),
  `list()`, `get(id)`, `remove(id)`. Each asset: `{ id, name, url, type, embedded:boolean, bytes? }`.
  Accept an injected `fileReader`/`urlMaker` so tests run headless without browser APIs.
- `editor/src/library/assets/insert.js` — `imageSnippet(asset, {alt?,width?})` → clean `<img …>` html
  string; `backgroundSnippet(asset)` → a `background-image` css value. Pure.
- `editor/src/library/assets/index.js` — re-export.
- `editor/src/library/assets/registry.test.js` (`node --test src/library/assets/`): add/list/get/remove,
  embed vs object-url path (with injected stubs), imageSnippet/backgroundSnippet output correctness.

## DoD
- tests pass; `npm run build` GREEN from `editor/`; new files only under `editor/src/library/assets/`; no UI.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git config user.email "swarm@rhobear" && git config user.name "ap1-asset-pipeline"
git commit -m "feat(library): headless asset registry + image/background insertion snippets"
git push -u origin lane/ap1-asset-pipeline
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/ap1-asset-pipeline \
  --title "W5: asset/image pipeline" \
  --body "Headless asset registry (upload→object-url/base64) + insertion snippets. No UI.

## Evidence
<paste node --test output + build tail>

## DoD
- [x] tests green - [x] build green - [x] new files only - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
