# Wave 3 — Fidelity Suite

A headless, framework-free fidelity suite that proves the **W2 engine's whole
promise** on **real sample sites** from `samples/minimax-m3-high/`:

> Importing a stood-up site and exporting it back **PRESERVES its look and
> functions** (scripts, external CSS links, fonts, structure), and applying a
> style override is **non-destructive**.

No UI, no React, no app-code changes. This folder only adds tests.

## Run

From `editor/`:

```bash
node --test tests/fidelity/
```

Expected output: `pass 30`, `fail 0`, `todo 0`. (See [Coverage](#coverage)
for which assertions run.)

---

## What is exercised

The suite imports the W2 engine modules **as-is** and exercises them on
real imported site source — the kind of input a user pastes into the
"Edit Live Site" pane:

| Module                                       | Where used                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `editor/src/engine/live-render.js`           | `extractDocumentParts`, `buildLiveDocument`                               |
| `editor/src/engine/diff-serializer.js`       | `applyOverrides` (fold override layer into clean export)                  |
| `editor/src/engine/style-overrides.js`       | `createOverrideStore` (non-destructive override store)                     |
| `editor/src/core/serializer.js`              | `serialize` / `deserialize` (round-trip stability on the extracted body)   |
| `editor/src/core/document-model.js`          | `createDocument` (used to host the body markup for round-trip)            |

No `src/**` engine or core files were modified.

---

## Fixtures

Picked from `samples/minimax-m3-high/` (51 recreated portfolio sites) to
exercise the four characteristics the prompt names. Each fixture is a
complete `<html>…</html>` document with `<head>` and `<body>`.

| Fixture id              | Characteristic(s) exercised                                                       | Why chosen                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `t-ko-space.html`       | `<canvas>` / WebGL — 5 `<canvas>` + Three.js bundle                              | Heaviest canvas case in the corpus (5 canvas tags + Three.js r134 external + Tailwind CDN).            |
| `hnine-interaction.html`| External `<link rel="stylesheet">` — 4 links (2 preconnects + Google Fonts + jsdelivr/Pretendard) | Only fixture with a stylesheet link beyond Google Fonts; exercises the cross-origin CSS path.           |
| `samsy-ninja.html`      | `@keyframes` + CSS variables — 6 `@keyframes`, 11 CSS var definitions            | Animation-rich fixture that proves `@keyframes` and `:root { --var: ... }` survive the pipeline.        |
| `cyphr-studio.html`     | "Simple" — 2 scripts (Tailwind CDN + inline), 3 `<link>` (2 preconnects + Google Fonts) | Smallest reasonable portfolio site. Baseline / smoke-test fixture.                                     |

Adding more fixtures is a 4-line edit to `fixtures.js`. If a new sample
reveals an honest engine gap, add it as its own fixture, `test.todo` it in
`fidelity.test.js`, and document the gap here and in the PR body.

---

## Coverage — what each assert proves

Each pillar runs once **per fixture**, so a regression in any one engine
on any one site shows up by name.

### Pillar 1 — `extractDocumentParts(raw)` preservation
For each fixture, after parsing the raw HTML, **every** `<script>` tag
is captured (count + src/inline classification + external-script src list),
**every** `<link rel="stylesheet" href="...">` href is preserved, and the
`<title>` text matches what was in the raw.

This is the most fundamental fidelity guarantee: **nothing is silently
dropped** by the part extractor.

### Pillar 2 — `buildLiveDocument({ html: raw })` output preservation
The rebuilt document string contains every external `<script src="…">`,
every inline `<script>…</script>` raw block, every stylesheet `<link>` href,
the original `<title>` text, every `<canvas>` tag, and every `@keyframes`
(where the fixture declares them). Look and functions survive the
re-emission step.

### Pillar 3 — `applyOverrides` is non-destructive AND reflects the override
The override layer receives the canonical `{ html: parts.bodyHtml,
css: collectedCss }` shape the exporter consumes, applies a **non-trivial**
8-property / 5-selector store (so we exercise specificity-sorting in
`toStylesheet`), and the output satisfies BOTH invariants:

  - `out.html === input.html` byte-equal (markup + scripts + canvas all
    untouched).
  - `out.css` contains the original CSS verbatim, the `RHOBEAR editor
    overrides` header **after** the original CSS (so it wins equal-
    specificity ties), and the override rules themselves.

This is the product's "non-destructive fold" guarantee, proven on real
imported markup.

### Pillar 4 — Empty-override round-trip is a stable no-op
With an empty store, `applyOverrides({ html, css }, emptyStore) ===
{ html, css }` byte-equal. No override header is introduced. This
guards against accidental header-injection regressions.

### Pillar 5 — Core serializer round-trip on the extracted body is stable
The editor's editable body representation is `parts.bodyHtml` with
`<script>` and `<style>` blocks removed (the document-model parser drops
those into `doc.css` per its documented contract). Asserts
`serialize(deserialize(s))` is byte-equal to `s` for **5 iterations**,
proving the round-trip fixed point.

### END-TO-END — live-render → override pipeline
Combines Pillars 1–3 in one path: take the raw site, run it through
`extractDocumentParts` + `buildLiveDocument` + `applyOverrides`, and
verify the final exported bundle still contains every script / link
AND has the override reflected.

---

## Honest engine gaps

**None at this time.** Every Pillar passes for every fixture (30/30
green). If a future sample reveals a real gap, it should be added here
as a `test.todo(...)` — **NOT** hacked to pass.

---

## Files

```
editor/tests/fidelity/
├── README.md          this file
├── fixtures.js        picks the 4 representative samples
├── fidelity.test.js   the 30-test suite (5 pillars + end-to-end, x4 fixtures)
├── package.json       registers tests/fidelity/ as a node --test discovery root
└── _entry.js          side-effect imports fidelity.test.js for `node --test tests/fidelity/`
```

No new npm dependencies. Pure Node 22 built-ins (`node:test`, `node:assert/strict`,
`node:fs`, `node:path`, `node:url`).

---

## DoD self-check

- [x] `node --test tests/fidelity/` runs and PASSES (30/30)
- [x] `npm run build` stays GREEN (no `src/**` touched)
- [x] Files only under `editor/tests/fidelity/`
- [x] No new npm deps
- [x] No real engine gaps to hide — every sample passes all 5 pillars