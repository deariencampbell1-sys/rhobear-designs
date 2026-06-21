# Lane g1-vendor-grapes — Vendor GrapesJS into the repo so the editor engine is OURS (MIT/BSD, sellable)

You are a swarm worker on chat-brain-1. Your working directory is ALREADY a git worktree on branch
`lane/g1-vendor-grapes`, based off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.
The product is a Canva-style visual website editor. This lane makes the third-party editor engine
**vendored and owned** so the whole product can be sold under a permissive license.

## Hard guardrails (do NOT violate)
- **Do NOT touch any UX / visual / styling files.** Off-limits this lane: `src/styles/**`, `index.html`,
  anything that changes how the app LOOKS. The human owner builds all UX by hand. You only touch engine
  plumbing, build config, and license files.
- Do NOT add or remove product features. Do NOT refactor unrelated code.
- Do NOT commit secrets, `.env`, `node_modules/`, or build artifacts (`dist/`).
- Keep the change minimal and reviewable. One concern: vendor the engine + prove the build still works.

## The task
The editor currently depends on these npm packages (all BSD-3-Clause / MIT — confirm, do not change to
copyleft): `grapesjs`, `grapesjs-preset-webpage`, `grapesjs-blocks-basic`, `grapesjs-plugin-forms`,
`grapesjs-custom-code`. Vendor them into the repo and build off the vendored copy:

1. Create `src/vendor/grapesjs/` and copy, for each of the 5 packages, the package's **license file**
   and the **distributable build** it actually ships (the files referenced by each package's
   `package.json` `main`/`module`/`exports`, plus its `dist/` CSS if any). Keep each package in its own
   subfolder: `src/vendor/grapesjs/<pkg>/`. Include each upstream `LICENSE` verbatim.
2. Repoint the editor's imports so the engine loads from `src/vendor/...` instead of `node_modules`.
   The only import site is `src/editor/grapes-init.js` (imports `grapesjs`, the css, and the 4 plugins).
   Update those import paths to the vendored locations. Do NOT change any editor behavior or options.
3. Write `THIRD-PARTY-NOTICES.md` at the repo root: a table of every vendored package, its version
   (from each `node_modules/<pkg>/package.json`), its SPDX license id, and its upstream repo URL. Add a
   one-paragraph header stating the product is MIT-licensed and all vendored components are permissive
   (BSD-3-Clause / MIT) and therefore redistributable in a commercial product.
4. Keep `grapesjs` etc. in `package.json` `dependencies` for now (they remain the upstream-of-truth for
   re-vendoring); add a `scripts` entry `"vendor:notices"` only if trivial — otherwise skip. Do not
   delete the deps.

## Definition of Done (ALL must hold before you open the PR)
- `npm ci` (or `npm install`) succeeds.
- `npm run build` succeeds and produces `dist/` (the build resolves the vendored imports — no missing-module errors).
- `npx playwright install --with-deps chromium` then `npm run test:e2e` — the existing smoke suite
  (`tests/e2e/smoke.spec.js`) passes GREEN against the vendored build. If Playwright cannot run headless
  on the box, run `npm run build` and `node -e` import-resolution checks instead, and SAY SO explicitly
  in the PR body with evidence.
- `src/vendor/grapesjs/**` exists with license files; `THIRD-PARTY-NOTICES.md` exists at root.
- No changes under `src/styles/**` or to `index.html`.

## Finish — commit, push, open PR (do this exactly, print the URL)
```bash
git add -A
git config user.email "swarm@rhobear"; git config user.name "g1-vendor-grapes"
git commit -m "build(engine): vendor GrapesJS + plugins into src/vendor; add THIRD-PARTY-NOTICES"
git push -u origin lane/g1-vendor-grapes
gh pr create --repo deariencampbell1-sys/rhobear-designs \
  --base build/editor-v1 --head lane/g1-vendor-grapes \
  --title "Wave1: vendor GrapesJS engine (owned, sellable)" \
  --body "Vendors the editor engine into src/vendor/grapesjs and repoints imports. Build + smoke evidence below.

## Evidence
<paste: npm run build tail, test:e2e result or import-resolution checks>

## DoD
- [x] build green  - [x] smoke green (or documented fallback)  - [x] vendored + NOTICES  - [x] no UX/style files touched"
```
Print the final PR URL on its own line so the dispatcher can capture it. Then STOP.
