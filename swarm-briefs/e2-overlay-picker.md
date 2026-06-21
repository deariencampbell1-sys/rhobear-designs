# Lane e2-overlay-picker — Click-to-select overlay + iframe bridge + inline text edit (the edit layer)

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/e2-overlay-picker`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
App lives in **`editor/`** (NOT repo root). Your work goes under `editor/src/engine/`. Core at
`editor/src/core/`. Run npm/node from `editor/`.

## Goal of this lane
In "Edit Live Site", the real site renders untouched in an iframe (built by lane e2-live-render). This lane
builds the OVERLAY EDIT LAYER that lets a user select and edit elements on that living page WITHOUT
re-rendering it: click-to-select with hover/selection rects, a parent<->iframe message bridge, and inline
text editing (contentEditable) on the selected element. Mechanism + clean API only.

## Hard guardrails
- **NO visual design / theming / final styling / React.** You may draw a FUNCTIONAL 1px selection/hover
  outline + a tiny bounding box so it works, but keep it visually minimal and un-themed — the human owner
  restyles ALL of it. No panels, no toolbars, no UI chrome.
- Create NEW files ONLY under `editor/src/engine/`. Do NOT create `editor/src/engine/index.js` (reserved).
  Do NOT modify existing files or touch `editor/src/styles/**`, `index.html`, `editor/src/editor/**`,
  `editor/src/core/**`, `package.json`, `vite.config.js`.
- No new npm deps. No secrets/node_modules/dist.

## Build these modules
- `editor/src/engine/iframe-bridge.js` — a postMessage protocol between the editor (parent) and an agent
  script injected into the iframe. Typed message kinds: `select`, `hover`, `deselect`, `text-changed`,
  `request-rect`, `ready`. `createBridge(iframe, { onSelect, onHover, onTextChange })` (parent side) and
  `createAgent(window)` (iframe side). Guard origins; tolerate cross-origin gracefully (document the limit).
- `editor/src/engine/overlay.js` — given a selected element's bounding rect (from the bridge), compute and
  position a selection box + hover box in PARENT coordinates over the iframe (account for iframe offset +
  scroll). `createOverlay(container, iframe)` with `showSelection(rect)`, `showHover(rect)`, `clear()`.
  Pure geometry where possible (unit-testable).
- `editor/src/engine/inline-edit.js` — the iframe-agent side: hit-test clicks to the deepest element,
  emit `select`; on text elements enable `contentEditable` and emit `text-changed` with the new text +
  a stable selector/path for the node. Provide `computeSelectorPath(el) -> string` (testable) for mapping
  edits back to the document model later.

## Definition of Done (ALL)
- The 3 modules exist with JSDoc-typed public APIs.
- `editor/src/engine/*.test.js` under `node --test src/engine/` (from editor/) passes for the pure parts:
  overlay geometry (offset/scroll math), `computeSelectorPath` round-trip on a small DOM-ish structure,
  bridge message (de)serialization. Browser-only behavior may be covered by a SMALL self-contained
  Playwright spec under `editor/tests/e2e/overlay.spec.js` (builds its own 2-iframe fixture page) OR, if
  that's not feasible headless, a clearly documented manual-verification note in the PR — do NOT leave it
  silently untested.
- From `editor/`: `npm run build` stays GREEN.
- No files changed outside `editor/src/engine/` (and optionally `editor/tests/e2e/overlay.spec.js`).

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "e2-overlay-picker"
git commit -m "feat(engine): overlay select + iframe message bridge + inline text edit (mechanism)"
git push -u origin lane/e2-overlay-picker
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/e2-overlay-picker \
  --title "Wave2: overlay edit layer (select + bridge + inline text)" \
  --body "Click-to-select overlay, parent<->iframe bridge, inline contentEditable on the live page. Tests/evidence below.

## Evidence
<paste: node --test src/engine/ output; build tail; playwright result or manual-verify note>

## DoD
- [x] node --test green  - [x] build green  - [x] minimal/un-themed visuals only  - [x] new files only"
```
Print the final PR URL on its own line. Then STOP.
