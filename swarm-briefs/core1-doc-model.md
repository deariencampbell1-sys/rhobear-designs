# Lane core1-doc-model — The owned HEADLESS editor core (document model + command bus + serializer)

You are a swarm worker on chat-brain-1. Your working directory is ALREADY a git worktree on branch
`lane/core1-doc-model`, based off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.
The product is a Canva-style visual website editor with two future modes: "Edit Live Site" (annotate a
real rendered page) and "Build from scratch" (block editor). Both modes — and a later AI phase — need a
shared, **headless, framework-agnostic core**. You build that core. NO UI.

## Hard guardrails (do NOT violate)
- **Pure logic only. NO UI, NO DOM rendering, NO React, NO styling, NO visual code.** The human owner
  builds all UX by hand. If you render or style anything, the work is rejected.
- **Create NEW files only under `src/core/`.** Do NOT modify existing files except to add one export line
  in a new `src/core/index.js`. Specifically do NOT touch `package.json`, `vite.config.js`, `index.html`,
  `src/styles/**`, `src/editor/**`, or `src/lib/serializer.js` (you will write a NEW serializer in core).
- Use only Node built-ins for tests (`node --test`, `node:assert`) — do NOT add npm dependencies.
- No secrets, no `node_modules/`, no `dist/`.

## The task — build `src/core/` (ES modules, plain modern JS, JSDoc types)
1. **`src/core/document-model.js`** — an in-memory representation of an editable page, independent of any
   renderer. Model a tree of nodes `{ id, tag, attrs, styles, children, text }` plus a flat id→node index.
   API: `createDocument(html?)`, `getNode(id)`, `updateNode(id, patch)`, `insertNode(parentId, node, index?)`,
   `removeNode(id)`, `moveNode(id, newParentId, index)`, `toJSON()/fromJSON()`. Parsing HTML→tree may use a
   tiny dependency-free tokenizer OR accept a pre-parsed structure; keep it simple and well-tested. Assign
   stable unique ids.
2. **`src/core/command-bus.js`** — an undo/redo command stack operating on a document. API:
   `createCommandBus(doc)`, `dispatch(command)`, `undo()`, `redo()`, `canUndo()/canRedo()`, `onChange(cb)`.
   A `command` is `{ do(doc), undo(doc), label }`. Provide factory helpers for the common edits
   (updateNode, insert, remove, move) that produce reversible commands. This is the foundation for editor
   history AND for AI-proposed edits later.
3. **`src/core/serializer.js`** — `serialize(doc) -> { html, css }` (clean, stable output) and
   `deserialize({ html, css }) -> doc`. Round-trip must be lossless for the structural model
   (serialize→deserialize→serialize is stable). Escape correctly. NO document `<html>` shell — body-level
   fragment + collected CSS, matching how the existing app exports.
4. **`src/core/index.js`** — re-export the public API of the three modules.

## Definition of Done (ALL must hold)
- `node --test src/core/` passes with a meaningful suite: document CRUD, move semantics, undo/redo across
  a sequence of commands (including redo-after-new-command truncation), and serializer round-trip stability.
- Only new files under `src/core/`. `git status` shows nothing modified outside `src/core/`.
- No new npm deps; no UI/style/DOM code.

## Finish — commit, push, open PR (do this exactly, print the URL)
```bash
git add -A
git config user.email "swarm@rhobear"; git config user.name "core1-doc-model"
git commit -m "feat(core): headless document model + command bus + serializer (no UI)"
git push -u origin lane/core1-doc-model
gh pr create --repo deariencampbell1-sys/rhobear-designs \
  --base build/editor-v1 --head lane/core1-doc-model \
  --title "Wave1: headless editor core (doc model + command bus + serializer)" \
  --body "Pure-logic core shared by both editor modes and the future AI phase. No UI.

## Evidence
<paste: node --test src/core/ output showing all tests pass>

## DoD
- [x] node --test green  - [x] new files only under src/core/  - [x] no new deps  - [x] no UI/style/DOM"
```
Print the final PR URL on its own line so the dispatcher can capture it. Then STOP.
