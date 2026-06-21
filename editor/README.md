# RHOBEAR Designs — Website Editor

A free, MIT-licensed, **Canva-style visual website editor** that runs
entirely in the browser. Three working modes, a real 3D Studio, an
optional bring-your-own-LLM AI assistant, a **62-template** bank, and
a **351-piece element stash** you can drag in or swap — all without a
backend.

> **Editor v1.0.0** · MIT — see [`LICENSE`](./LICENSE) ·
> [Third-Party Notices](../THIRD-PARTY-NOTICES.md) ·
> [Release notes](../RELEASE.md) ·
> [Deploy guide](./DEPLOY.md)

## What it is

RHOBEAR Designs is a website editor for people who don't want to write
CSS by hand but also don't want a closed SaaS. The whole editor is a
**single static site** you can host on any static host (or run locally
with `npm run dev`) — no server, no account system, no telemetry.

Three editor modes cover the way real websites get built:

- **Edit Live Site** — open a real page (paste HTML, drop a folder,
  pick a template) and edit it **on top** of the original. Your edits
  are stored as an *override layer*; the original markup, scripts, and
  styles are preserved unchanged. Scripts keep running while you edit.
- **Build from scratch** — the proven **GrapesJS** canvas (with our
  RHOBEAR chrome on top) for free-form layout. Drag, drop, undo, redo,
  preview, export.
- **3D Studio** — an **owned Three.js engine** for inserting 3D scenes
  you can actually *manipulate*: orbit the camera, click an individual
  mesh, recolor it, change its metalness, rotate / scale / move it via
  gizmos, save the scene as a self-contained embed any page can use.
  Drop in primitives (`box`, `sphere`, `cylinder`, `cone`, `torus`,
  `plane`) or load your own `.glb` / `.gltf`.

Around those three modes sits a feature set that covers the whole
"design a real site" loop:

- **62 templates** across three collections (`minimax-m3-high`,
  `minimax-m2.7`, `minimax-m3-medium`) — open any one as a starting
  point.
- **351 element snippets** (the *stash*) across nav, hero, button,
  chip, card, badge, CTA, section, footer, form, gallery,
  testimonial, pricing, FAQ, feature, stats, logos, contact, banner,
  divider — drop a piece into the live page and it's already styled
  and scoped.
- **52 open-license Google Fonts** in the picker (sans, serif,
  display, mono, handwriting) — all SIL OFL or Apache-2.0, no
  closed-font dependencies.
- **46-image media bucket** with category filters (abstract, texture,
  nature, people, product, tech, pattern), plus 12 hand-tuned CSS
  gradients and a BYO gif-provider client (Giphy / Tenor) for search.
- **Save current** keeps your work in `localStorage`; projects survive
  page reloads. Multiple projects, easy rename, easy export.
- **Export HTML** as a single self-contained file (with optional
  asset folder) or **Export ZIP** (`index.html` + `styles.css` +
  `assets/`).
- **Inspector** for the live page: opacity slider, shadow presets,
  link retargeting, gradient swatches, free-move drag, duplicate,
  delete. Mode-aware: in 3D Studio it shows color / metalness /
  roughness / gizmo mode.

## How AI assist works (bring-your-own key)

The AI panel is **fully opt-in and fully local**. There is no RHOBEAR
account, no server, no telemetry. To enable AI:

1. Click the **AI bubble** (top-right) → opens the panel.
2. Open **Settings** inside the panel.
3. Pick a provider (Anthropic / OpenAI / Google) and paste your API
   key.

The editor stores the key in `localStorage` only — it is sent
directly from your browser to the chosen provider's API on each
request and never traverses RHOBEAR infrastructure. Remove the key
any time and the AI panel stops working instantly; the rest of the
editor is unaffected.

Default models: **claude-sonnet-4-6**, **gpt-4o**, **gemini-2.0-flash**.
The AI returns a short conversational reply plus an optional fenced
HTML block; the editor applies the HTML edit in place so you can see
exactly what changed (and undo it).

> The editor works **without** AI. The panel is a convenience, not a
> dependency.

## Quickstart

You need **Node ≥ 20** (Node 22 LTS recommended) and `npm`.

```bash
cd editor
npm install         # installs runtime + dev deps
npm run dev         # starts the Vite dev server on http://localhost:5180
```

Open <http://localhost:5180> in a Chromium-based browser. WebGL is
required for the 3D Studio mode.

## Production build

```bash
cd editor
npm run build       # writes static dist/ (HTML + JS + CSS + assets)
npm run preview     # serves dist/ locally on http://localhost:4173
```

`dist/` is a fully self-contained static site. Drop it on any static
host — GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront,
Nginx, Apache. **No server runtime is required.**

For hosting specifics (asset paths, CORS, the network calls the running
editor makes), see [`DEPLOY.md`](./DEPLOY.md).

## Project scripts

| Script                  | What it does                                            |
|-------------------------|---------------------------------------------------------|
| `npm run dev`           | Vite dev server on port 5180 (with HMR + source maps).  |
| `npm run build`         | Production build → `dist/` (HTML + JS + CSS + assets).  |
| `npm run preview`       | Serves `dist/` on port 4173 (smoke-test the build).     |
| `npm start`             | Same as `preview`, but bound to `0.0.0.0`.              |
| `npm run test:e2e`      | Playwright smoke + feature tests against Chromium.      |
| `npm run test:e2e:ui`   | Same, in Playwright's interactive UI mode.              |

## Repo layout (this folder)

```
editor/
├── index.html                 # Vite entry — the app shell, toolbar, modes, modals
├── package.json               # npm metadata, scripts, deps (MIT, no copyleft)
├── vite.config.js             # Vite config (incl. vendor CJS→ESM shim for GrapesJS)
├── playwright.config.js       # Playwright config (chromium, port 5180)
├── LICENSE                    # MIT — © 2026 RHOBEAR Designs
├── DEPLOY.md                  # how to ship dist/ to a static host
├── README.md                  # this file
├── src/
│   ├── main.js                # one-liner: boot the shell
│   ├── app/                   # editor shell, mode controllers, modals (UI)
│   ├── styles/                # RHOBEAR theme + GrapesJS overrides (UI)
│   ├── editor/                # GrapesJS bootstrap + toolbar glue (engine glue)
│   ├── engine/                # live-render, overlay, style-overrides, mode-b, IO, fidelity
│   ├── core/                  # headless document model + serializer
│   ├── 3d/                    # owned Three.js engine (scene, handle, registry, serialize)
│   ├── ai/                    # BYO-LLM client (Anthropic / OpenAI / Google)
│   ├── lib/                   # legacy file IO + serializer (supserseded by engine/io.js)
│   ├── library/               # element stash, fonts, media, templates, patterns
│   │   ├── elements/          # 351 self-contained snippets across 20 categories
│   │   ├── fonts/             # 52 open-license Google Fonts families
│   │   ├── media/             # 46 Picsum/Unsplash images + 12 gradients + BYO gif
│   │   ├── templates/         # manifest for 62 templates + thumbs/
│   │   └── patterns/          # analyzer that scanned the 62 templates for techniques
│   └── vendor/grapesjs/       # vendored GrapesJS core + 4 plugins (BSD-3-Clause)
└── tests/
    ├── e2e/                   # Playwright specs (smoke, mode-b, overlay, three)
    ├── fidelity/              # node --test fidelity suite (scripts survive the loop)
    └── fixtures/              # HTML pages the e2e suite imports
```

## Tests

The build is only "shippable" if the smoke + feature tests pass.

```bash
cd editor
npx playwright install --with-deps chromium   # one-time
npm run test:e2e                              # 51 tests, ~90s
```

Plus per-module headless suites that run under Node's built-in test
runner (no test framework dependency):

```bash
cd editor
node --test src/engine/      # engine: live-render, overlay, io, mode-b, …
node --test src/core/        # headless document model + serializer
node --test src/3d/          # owned 3D engine (transform, registry, serialize)
node --test src/library/     # element stash, fonts, media, templates
```

## License & third-party

RHOBEAR Designs is **MIT-licensed** (see [`LICENSE`](./LICENSE)). Every
runtime dependency, vendored asset, embedded font, and CDN library the
editor loads is **permissively licensed** (MIT / BSD-3-Clause /
Apache-2.0 / SIL OFL 1.1) and is therefore safe to redistribute in a
commercial product. The authoritative inventory is
[`../THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md) — it lists
every vendored editor engine package, every npm dependency, every
bundled font family, every runtime CDN load, and confirms there is
**no copyleft (GPL / AGPL / LGPL / MPL) exposure**.

## Contributing

Bug reports and PRs welcome. The lane-based development model keeps
each PR small and reviewable: see [`../swarm-briefs/`](../swarm-briefs)
for examples of scoped single-concern lanes. Touch only the files your
lane is responsible for; UX changes go to `editor/src/app/**` and
`editor/src/styles/**` and are owned by the human owner.
