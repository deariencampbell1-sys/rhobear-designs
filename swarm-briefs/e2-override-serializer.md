# Lane e2-override-serializer — Non-destructive style overrides + diff serializer (export keeps look & functions)

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/e2-override-serializer`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
App lives in **`editor/`** (NOT repo root). Work goes under `editor/src/engine/`. The headless core is at
`editor/src/core/` — import its serializer: `import { serialize, deserialize } from '../core/index.js'`.
Run npm/node from `editor/`.

## Goal of this lane
Core promise: editing a live site must NEVER destroy its original look or functions. So edits are applied
as an OVERRIDE layer on top of the untouched original, and export merges original + overrides into clean
HTML/CSS. This lane builds that override + diff-serialization engine. Pure data/string logic — highly
unit-testable. NO UI.

## Hard guardrails
- **NO UI / styling / React / DOM rendering chrome.** Pure modules + tests. Owner builds all UX.
- Create NEW files ONLY under `editor/src/engine/`. Do NOT create `editor/src/engine/index.js` (reserved).
  Do NOT modify existing files or touch `editor/src/styles/**`, `index.html`, `editor/src/editor/**`,
  `editor/src/core/**` (you may IMPORT from core, not edit it), `package.json`, `vite.config.js`.
- No new npm deps. No secrets/node_modules/dist.

## Build these modules
- `editor/src/engine/style-overrides.js` — an override store keyed by stable element selector/path:
  `createOverrideStore()` with `setStyle(selector, prop, value)`, `setStyles(selector, obj)`,
  `removeOverride(selector, prop)`, `getOverridesFor(selector)`, `toJSON/fromJSON`. Produce
  `toStylesheet(store) -> cssText` — a single override `<style>` body (selectors + only the overridden
  props, correct specificity ordering) that can be INJECTED into the live document to apply edits
  WITHOUT mutating the original CSS. Pure + thoroughly tested.
- `editor/src/engine/diff-serializer.js` — merge original source + overrides into final export:
  `applyOverrides({ html, css }, store) -> { html, css }` producing clean output where overrides are
  folded in (append an override stylesheet block, or merge into matching rules — your call, document it),
  PRESERVING original scripts/markup. Also `summarizeChanges(store) -> [{selector, prop, from?, to}]`
  for an edit log / future AI + undo. Reuse `editor/src/core` serializer where it helps; do not duplicate it.
- Round-trip guarantee: applying an empty override store yields output equivalent to the input
  (no-op safety). Test it.

## Definition of Done (ALL)
- Both modules exist with JSDoc-typed APIs.
- `editor/src/engine/*.test.js` under `node --test src/engine/` (from editor/) passes: override store CRUD +
  toStylesheet specificity/format, applyOverrides folds edits + preserves scripts, empty-store no-op,
  summarizeChanges correctness.
- From `editor/`: `npm run build` stays GREEN.
- No files changed outside `editor/src/engine/`.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "e2-override-serializer"
git commit -m "feat(engine): non-destructive style overrides + diff serializer (export keeps look+functions)"
git push -u origin lane/e2-override-serializer
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/e2-override-serializer \
  --title "Wave2: style-override layer + diff serializer" \
  --body "Edits applied as a non-destructive override layer; export merges original + overrides into clean HTML/CSS, scripts preserved. Tests/evidence below.

## Evidence
<paste: node --test src/engine/ output; npm run build tail>

## DoD
- [x] node --test green  - [x] build green  - [x] new files only under editor/src/engine/  - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
