# Lane w3-fidelity-tests — Prove the core promise on real sites: look + functions survive the loop

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/w3-fidelity-tests`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
App lives in **`editor/`** (NOT repo root). Real sample sites live at REPO-ROOT `samples/minimax-m3-high/*.html`
(51 recreated portfolio sites — scripts, WebGL, external CSS, CSS vars). From `editor/` that is `../samples/`.
Engine to exercise: `editor/src/engine/live-render.js` (`buildLiveDocument`, `extractDocumentParts`),
`editor/src/engine/diff-serializer.js` (`applyOverrides`), `editor/src/engine/style-overrides.js`,
`editor/src/core/` serializer. Run npm/node from `editor/`.

## Goal
A headless fidelity suite that proves: importing a stood-up site and exporting it back PRESERVES its look
and functions (scripts, external CSS links, fonts, structure), and applying a style override is
non-destructive. This is the product's whole promise — make it provable + regression-proof. NO UI.

## Hard guardrails
- **NO UI / styling / React.** Tests + a runner only. Do NOT modify any `src/**` engine/core files
  (you IMPORT them), `editor/src/styles/**`, `index.html`, `package.json`, `vite.config.js`.
- Create NEW files ONLY under `editor/tests/fidelity/`. No new npm deps (use `node --test` + node builtins).
  No secrets/node_modules/dist.

## Build the suite under `editor/tests/fidelity/`
1. `fixtures.js` — picks a small REPRESENTATIVE set (3–5) of `../samples/minimax-m3-high/*.html` by
   characteristic: one with `<canvas>`/webgl, one with external `<link rel=stylesheet>`, one with
   `@keyframes`/CSS vars, one "simple". Resolve paths relative to this file; read with `node:fs`.
2. `fidelity.test.js` (run via `node --test tests/fidelity/`) asserting, for each fixture:
   - `extractDocumentParts(raw)` preserves EVERY `<script>` (count + src/inline), every stylesheet `<link>`,
     and the `<title>` — nothing silently dropped.
   - `buildLiveDocument(importHtml(raw))` output still contains those scripts + links (look+functions intact).
   - Applying a non-trivial override via `style-overrides` + `diff-serializer.applyOverrides` yields output
     that STILL contains the original scripts/markup (non-destructive) AND reflects the override.
   - Empty-override round-trip is a no-op (stable).
   - Core serializer round-trip on the extracted body is stable.
3. A tiny `README.md` in the folder listing which samples are covered and what each assert proves; if any
   sample reveals a real fidelity GAP in the W2 engine, DO NOT hack the test to pass — instead `test.todo`
   it and clearly document the gap in the README + PR body so the owner/Iron Man can address it.

## Definition of Done (ALL)
- `node --test tests/fidelity/` runs and PASSES (todos allowed only for honestly-documented engine gaps).
- From `editor/`: `npm run build` stays GREEN (you added no app code, just tests).
- Files only under `editor/tests/fidelity/`.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "w3-fidelity-tests"
git commit -m "test(fidelity): prove import/export preserves look+functions on real sample sites"
git push -u origin lane/w3-fidelity-tests
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/w3-fidelity-tests \
  --title "Wave3: fidelity suite on real sample sites" \
  --body "Headless proof that import/export preserves scripts/CSS/structure + non-destructive overrides, across representative samples. Any real engine gaps are documented (todo), not hidden.

## Evidence
<paste: node --test tests/fidelity/ output; list of covered samples; any documented gaps>

## DoD
- [x] fidelity tests green  - [x] build green  - [x] tests only under editor/tests/fidelity/  - [x] gaps documented honestly"
```
Print the final PR URL on its own line. Then STOP.
