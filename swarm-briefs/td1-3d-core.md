# Lane td1-3d-core — The OWN 3D engine: insert a model, orbit, select meshes, recolor, transform

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/td1-3d-core`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. App in **`editor/`**; run from `editor/`.

## Why
Template 3D (e.g. Bruno-Simon-style scenes) is baked into each page's own WebGL canvas — to the editor it's
"one image": can't separate objects, recolor, rotate, or run physics. We need OUR OWN 3D layer so a user can
INSERT a 3D scene that RENDERS live and is fully manipulable. This lane builds the engine CORE (no physics
yet — that's a follow-up; no editor UI — the Iron Man builds controls on your API). Make the API clean.

## Deps + license (MIT — sellable)
- Add `three` (MIT) to package.json dependencies. Use `three/examples/jsm/...` for OrbitControls,
  TransformControls, GLTFLoader, RoomEnvironment. Vite bundles these fine. NO other new deps.

## Hard guardrails
- **NO editor UI / no edits to `editor/src/app/**`, `editor/src/styles/**`, `index.html`.** You build a
  headless-ish engine + a clean handle API + tests. The Iron Man builds the controls panel on your API.
- Create NEW files under `editor/src/3d/` only (plus the `three` dep in package.json). No secrets.

## Build `editor/src/3d/` — a scene engine with this exact handle API
`create3DScene(container, opts?) -> handle` that:
- Sets up `WebGLRenderer` (antialias, alpha), `PerspectiveCamera`, `Scene`, ambient + directional light +
  environment, an optional subtle ground/grid, a render loop, ResizeObserver, and `dispose()`.
- `OrbitControls` for camera rotate/zoom/pan (this is "rotate the view").
handle API (document each):
- `addPrimitive(type)` — 'box'|'sphere'|'cylinder'|'cone'|'torus'|'plane' with a default PBR material; returns object id.
- `loadModel(urlOrFile)` — GLTF/GLB via GLTFLoader (accept a URL or a File/Blob via object URL); add to scene,
  frame camera; returns the root object id. Sub-meshes become individually selectable.
- `listObjects()` — flat list `[{ id, name, type }]` of selectable meshes (so the UI can list "the 36 objects").
- `select(id)` / `getSelected()` / `deselect()` — raycaster pointerdown picking also selects; highlight selection.
- `setColor(id, hex)` — set the mesh material color. `setMetalness/ setRoughness(id, v)` — PBR params.
- `setTransform(id, { position?, rotation?, scale? })`, `rotate(id, axis, deg)` — programmatic transforms.
- `setTransformMode('translate'|'rotate'|'scale')` + attach `TransformControls` gizmo to the selected object.
- `toJSON()` / `fromJSON(state)` — serialize/restore scene (objects, transforms, colors, material params,
  model source refs) so a scene persists + round-trips.
- `onChange(cb)` — fires on select/transform/color changes (so the UI can sync).
Keep transform/serialize math in pure helpers (`editor/src/3d/serialize.js`, `editor/src/3d/transform.js`) so
they unit-test in node without WebGL.

## Definition of Done
- `npm install` adds three; `npm run build` GREEN (three bundles).
- `node --test src/3d/` passes for the PURE helpers (serialize round-trip, transform math, listObjects shape).
- A Playwright spec `editor/tests/e2e/three.spec.js`: mounts a scene in a blank fixture, `addPrimitive('box')`,
  `select` it, `setColor('#2dd4bf')`, asserts the mesh material color changed + `listObjects()` has it +
  `toJSON()/fromJSON()` round-trips. (Headless WebGL via Chromium works in Playwright.)
- New files only under `editor/src/3d/` (+ package.json three dep + the one test spec).

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add editor/src/3d editor/package.json editor/package-lock.json editor/tests/e2e/three.spec.js
git config user.email "swarm@rhobear"; git config user.name "td1-3d-core"
git commit -m "feat(3d): own Three.js engine core — insert model/primitive, orbit, mesh select, recolor, transform, serialize"
git push -u origin lane/td1-3d-core
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/td1-3d-core \
  --title "3D core: insertable Three.js scene (orbit, per-mesh select, recolor, transform, serialize)" \
  --body "Our own 3D layer so 3D becomes editable, not 'one image': insert GLB/primitive, orbit camera, select individual meshes, recolor + PBR, transform gizmo, JSON serialize. Engine + API + tests; no editor UI (Iron Man builds controls). three.js (MIT).

## Evidence
<paste: node --test src/3d output; playwright three.spec result; npm run build tail>

## DoD
- [x] three dep + build green - [x] node --test green - [x] playwright scene test green - [x] src/3d only - [x] no editor UI"
```
Print the final PR URL on its own line. Then STOP.
