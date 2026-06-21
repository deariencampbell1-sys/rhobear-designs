# RHOBEAR Designs — v1.0.0 Release

> **License:** MIT · **Editor entry:** [`editor/`](./editor) ·
> **Editor README:** [`editor/README.md`](./editor/README.md) ·
> **Deploy guide:** [`editor/DEPLOY.md`](./editor/DEPLOY.md) ·
> **Third-party notices:** [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)

A free, MIT-licensed, **Canva-style visual website editor** that runs
entirely in the browser. v1.0.0 is the first release-quality cut of the
editor: feature-complete, smoke-tested, and packaged for shipping.

## Release checklist

- [x] **Build green** — `npm ci` clean, `npm run build` produces
      `editor/dist/` in ~7 s.
- [x] **Smoke passing** — 51/51 Playwright tests across the four
      spec files (smoke, mode-b, overlay, three) — see "Build &
      test evidence" below.
- [x] **All-permissive licensing** — full inventory in
      [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md). **No
      copyleft (GPL / AGPL / LGPL / MPL) is vendored, bundled, or
      linked.**
- [x] **README, DEPLOY, RELEASE** — written, accurate to the actual
      app, no behavior/UI changes.
- [x] **Package metadata** — `editor/package.json` carries
      description, license, repository, homepage, keywords, `files`,
      and `engines.node`. `version` is `1.0.0`.
- [x] **Gitignore clean** — `dist/`, `node_modules/`, `test-results/`,
      `playwright-report/`, `blob-report/`, and scratch files
      (`_shot*`, `_dbg*`, `_shots*`) are ignored at the editor level.
- [x] **No app/UI/engine changes** — this lane only ships packaging,
      docs, license, and config.

## What shipped in v1.0.0

### Three editor modes

| Mode                   | What it does                                                                                                   |
|------------------------|----------------------------------------------------------------------------------------------------------------|
| **Edit Live Site**     | Open a real page (HTML file, folder, template). Edit on top of the original as an *override layer*. Original scripts and styles are preserved unchanged; your edits live in a separate stylesheet so look + functions survive the loop. |
| **Build from scratch** | GrapesJS-based free-form canvas with our RHOBEAR chrome on top — drag, drop, undo/redo, preview, export.       |
| **3D Studio**          | Owned Three.js engine — orbit, click an individual mesh, recolor, change metalness/roughness, rotate/scale/move via gizmos, save the scene as a self-contained embed any page can use. Drop in primitives (`box`, `sphere`, `cylinder`, `cone`, `torus`, `plane`) or load your own `.glb`/`.gltf`. |

### AI assist (bring-your-own key)

- Anthropic Claude (default: claude-sonnet-4-6), OpenAI (gpt-4o),
  Google Gemini (gemini-2.0-flash).
- Keys are stored in `localStorage` only and sent directly from the
  user's browser to the chosen provider — never via RHOBEAR
  infrastructure.
- The editor works without a key. The panel is opt-in.

### Content bundled with v1.0.0

| Surface                | Count                                                                                          |
|------------------------|------------------------------------------------------------------------------------------------|
| Templates              | **62** recreated designs (51 from `minimax-m3-high`, 10 from `minimax-m2.7`, 1 from `minimax-m3-medium`) |
| Element stash          | **351** self-contained snippets across 20 categories (nav, hero, button, chip, card, badge, cta, section, footer, form, gallery, testimonial, pricing, faq, feature, stats, logos, contact, banner, divider) |
| Open-license fonts     | **52** Google Fonts families (sans / serif / display / mono / handwriting), all OFL or Apache-2.0 |
| Media images           | **46** royalty-free (Picsum / Unsplash) placeholder references, 7 categories                    |
| Gradients              | **12** hand-tuned CSS gradients                                                                |
| GIF search             | BYO-provider client (Giphy / Tenor) — keys stay local                                          |

### Persistence + IO

- **Projects + folders** stored in `localStorage` — survives reload,
  rename, multiple in flight.
- **Element stash** gets enriched at runtime with "Saved" snippets
  (incl. 3D scenes saved from 3D Studio).
- **Export HTML** (single self-contained file) and **Export ZIP**
  (`index.html` + `styles.css` + `assets/`) via `file-saver` + `jszip`.
- **Save current** writes the project; **Open** restores it.

### Licensing posture (verdict)

- **Application code** — MIT, © 2026 RHOBEAR Designs (see
  [`editor/LICENSE`](./editor/LICENSE)).
- **Vendored editor engine** — GrapesJS core + 4 plugins, BSD-3-Clause,
  copyright notices preserved verbatim at
  `editor/src/vendor/grapesjs/<pkg>/LICENSE`.
- **Bundled npm deps** — all MIT or BSD-3-Clause or Apache-2.0. The
  one dual-licensed component (`jszip`) is exercised under its MIT
  option only.
- **Font catalog** — all SIL OFL 1.1 or Apache-2.0; commercial-use OK.
- **Runtime CDN loads** — all permissive (Google Fonts OFL, FontAwesome
  OFL, three.js MIT via esm.sh, Unsplash license for Picsum).
- **BYO-key APIs** — provider ToS governs the user's calls; RHOBEAR
  does not redistribute provider responses.

**No copyleft exposure anywhere.** Safe to **sell, sublicense, and
ship as part of a larger commercial offering** under the MIT terms.

## Build & test evidence

### `npm ci`

```
added 47 packages, and audited 48 packages in 917ms
5 packages are looking for funding
found 0 vulnerabilities
```

### `npm run build` (tail)

```
dist/assets/grit-pictures-DSDmBeRv.js                             32.23 kB │ gzip:   8.74 kB │ map:    40.80 kB
dist/assets/basic-dept-BJU6D13G.js                                32.29 kB │ gzip:   8.35 kB │ map:    37.68 kB
dist/assets/caffe-design-DF8vUGSD.js                              32.63 kB │ gzip:   8.49 kB │ map:    39.49 kB
dist/assets/buildinamsterdam-DERAG0mx.js                          33.20 kB │ gzip:   8.57 kB │ map:    38.22 kB
dist/assets/mikkisindhunata-COdW7e_s.js                           33.26 kB │ gzip:   9.63 kB │ map:    39.08 kB
dist/assets/eduard-bodak-CiIVCxIz.js                              33.45 kB │ gzip:   8.47 kB │ map:    40.58 kB
dist/assets/fireart-D24gNiwT.js                                   35.69 kB │ gzip:  10.01 kB │ map:    41.64 kB
dist/assets/wearestokt-DKhmZF0w.js                                36.95 kB │ gzip:   9.44 kB │ map:    42.97 kB
dist/assets/joseph-san-Qo19vlkN.js                                37.20 kB │ gzip:  11.13 kB │ map:    43.44 kB
dist/assets/generalcondition-BPnWkgAd.js                          38.32 kB │ gzip:   9.95 kB │ map:    48.97 kB
dist/assets/orage-studio-BehH6qfh.js                              38.83 kB │ gzip:  11.12 kB │ map:    45.99 kB
dist/assets/portalone-studio-QQX6MAm8.js                          41.97 kB │ gzip:  10.33 kB │ map:    51.35 kB
dist/assets/index-CgEaYLlM.js                                     2,899.40 kB │ gzip: 691.29 kB │ map: 7,515.25 kB
✓ built in 7.03s
```

Output: `editor/dist/index.html` + 231 hashed asset files in
`editor/dist/assets/` (~30 MB uncompressed, ~700 KB gzipped main
bundle). Note the by-design chunk-size warning: the main bundle carries
the full editor (GrapesJS + 4 vendored plugins + Three.js + the mode
controllers).

### `npm run test:e2e`

```
Running 51 tests using 1 worker
  ✓  1-5   [chromium] › tests/e2e/mode-b.spec.js  (Mode-B mount API — 5 tests)
  ✓  6     [chromium] › tests/e2e/overlay.spec.js (overlay mechanism — 1 test)
  ✓  7-41  [chromium] › tests/e2e/smoke.spec.js   (UX smoke — 35 tests)
  ✓ 42-51  [chromium] › tests/e2e/three.spec.js   (3D engine — 10 tests)

  51 passed (1.5m)
```

Plus per-module headless `node --test` suites (run separately, not
required by `npm run test:e2e`):

| Module               | Tests |
|----------------------|-------|
| `src/engine/`        | 286   |
| `src/core/`          | 78    |
| `src/3d/`            | 79    |
| `src/library/`       | 81    |
| **Total headless**   | **524** |

## Known follow-ups (deliberately not in v1.0.0)

These are tracked work items the editor doesn't yet do — they're
flagged here so a future lane can pick them up.

- **True physics in 3D Studio** — primitives are PBR meshes with
  basic TransformControls; there is no physics simulation, no
  collisions, no rigid-body engine. (A future lane can plug in a
  permissive physics engine on top of the existing handle API.)
- **Canvas zoom-out beyond viewport** — the live-mode canvas wraps
  the rendered page at 1:1 with a fitting zoom; there is no
  bird's-eye "minimap" zoom-out or infinite-canvas pan. Build-mode
  (GrapesJS) has its own zoom which is unchanged.
- **Editing a template's own baked WebGL** — when a user opens a
  template that ships its own Three.js / WebGL canvas (e.g. the
  Bruno-Simon-style portfolio recreation), the editor treats the
  entire canvas as one image element. Selecting meshes *inside* that
  embedded WebGL is a follow-up: it needs a postMessage protocol
  similar to the existing live-render overlay so the parent editor
  can talk to the inner scene.
- **Code-splitting the main bundle** — currently ~3 MB minified /
  ~700 KB gzipped. Manual chunks (one per heavy lazy surface) would
  shave the initial page weight noticeably; defer to a perf-focused
  lane.
- **Vendor update policy** — vendored GrapesJS is pinned at the
  versions listed in `THIRD-PARTY-NOTICES.md`. When upstream publishes
  a security fix, a re-vendor lane will pull, verify, and bump.
- **More templates** — the gallery ships 62; the catalog schema is
  set up for community contributions (see
  `editor/src/library/templates/README.md`).
- **CSP recipe hardening** — `editor/DEPLOY.md` ships a starter CSP
  allow-list; a dedicated security lane should validate against the
  exact runtime calls.

## What's in this repo

```
.
├── editor/                  ← The RHOBEAR Designs Website Editor (the product)
│   ├── README.md            ← editor docs
│   ├── DEPLOY.md            ← how to ship editor/dist/
│   ├── LICENSE              ← MIT
│   ├── package.json         ← @rhobear/designs-editor v1.0.0
│   ├── src/                 ← app shell, engine, 3D, AI, library, vendor
│   ├── tests/               ← Playwright e2e + headless fidelity suite
│   ├── vite.config.js
│   └── playwright.config.js
├── samples/                 ← Recreation sites that power the template bank
│   ├── minimax-m2.7/        ← 10 sites
│   ├── minimax-m3-medium/   ←  1 site (Bruno Simon portfolio)
│   ├── minimax-m3-high/     ← 51 sites
│   └── …                    ← empty awaiting other model submissions
├── samples/README.md        ← the model-benchmark folder map
├── README.md                ← repo overview
├── THIRD-PARTY-NOTICES.md   ← authoritative third-party license inventory
├── RELEASE.md               ← this file
├── architect-audits/        ← internal audits / release-build board
└── swarm-briefs/            ← the lane-based development briefs (historical)
```

— RHOBEAR Designs · MIT · v1.0.0
