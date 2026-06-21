# Third-Party Notices

This repository (`deariencampbell1-sys/rhobear-designs`) and the
**RHOBEAR Designs Website Editor** (the application under `editor/`) are
licensed under the **MIT License**. Every runtime dependency, vendored
asset, embedded font, and CDN library the editor loads is **permissively
licensed** — MIT, BSD-3-Clause, Apache-2.0, or SIL OFL 1.1 — and is
therefore **redistributable, modifiable, and sublicensable in a
commercial product** provided the upstream copyright notice and license
text are preserved. **No copyleft (GPL / AGPL / LGPL / MPL / EUPL)
components are vendored, bundled, or linked.** Where a dual-licensed
component exists (notably `jszip`), this product elects the MIT option
and the GPL path is not exercised.

This document is the authoritative inventory for the editor's
release-as-software packaging. It covers four surfaces:

1. **Vendored editor engine** — GrapesJS core + 4 plugins (BSD-3-Clause),
   kept under `editor/src/vendor/grapesjs/`.
2. **npm runtime dependencies** — what `npm install` pulls in
   (`three`, `jszip`, `file-saver`, plus the same GrapesJS packages as
   upstream-of-truth for re-vendoring).
3. **Bundled font catalog** — the open-license Google Fonts families the
   font picker offers at runtime (OFL-1.1 / Apache-2.0).
4. **Runtime CDN loads** — third-party assets the browser fetches at
   load time (Google Fonts CSS, FontAwesome CSS from cdnjs,
   `three` via esm.sh for the 3D embed runtime, Picsum/Unsplash for
   media references).

Every version below is the version actually shipped with this release
(verified against `editor/package-lock.json` and the vendored
`package.json` files), every SPDX identifier is the one declared by the
upstream package, and every URL points at the canonical upstream
repository or distribution page.

---

## 1. Vendored editor engine — BSD-3-Clause

The GrapesJS core and its four official companion plugins are
**vendored into the source tree** at
`editor/src/vendor/grapesjs/<pkg>/`. The vendored copies ship their
verbatim upstream `LICENSE` next to the distributable build so the
BSD-3-Clause obligations (copyright notice, license text, non-endorsement
clause) are satisfied automatically without any runtime check.

`package.json` still lists these packages under `dependencies` so
`npm ci` always pulls in the upstream-of-truth — that lets a future lane
re-vendor against a newer upstream release without editing import paths.
At runtime, however, the editor loads the vendored copies, not the
`node_modules` builds (see `editor/vite.config.js`'s
`commonjsOptions.include` and `optimizeDeps.include`).

| Package                        | Version  | SPDX license | Upstream repository                                                |
|--------------------------------|----------|--------------|--------------------------------------------------------------------|
| grapesjs                       | 0.22.16  | BSD-3-Clause | https://github.com/GrapesJS/grapesjs.git                           |
| grapesjs-preset-webpage        | 1.0.3    | BSD-3-Clause | https://github.com/GrapesJS/preset-webpage.git                     |
| grapesjs-blocks-basic          | 1.0.2    | BSD-3-Clause | https://github.com/GrapesJS/blocks-basic.git                       |
| grapesjs-plugin-forms          | 2.0.6    | BSD-3-Clause | https://github.com/GrapesJS/components-forms.git                   |
| grapesjs-custom-code           | 1.0.2    | BSD-3-Clause | https://github.com/GrapesJS/components-custom-code.git             |

Each `editor/src/vendor/grapesjs/<pkg>/LICENSE` is the verbatim upstream
license text (BSD-3-Clause © Artur Arseniev and the listed contributors).
Each `editor/src/vendor/grapesjs/<pkg>/package.json` is the verbatim
upstream package manifest.

---

## 2. npm runtime dependencies

These are what `npm ci` installs from the registry. Versions are pinned
by `package-lock.json`; SPDX identifiers are read from each package's
upstream `package.json`.

### Direct dependencies (production runtime)

| Package      | Version | SPDX license      | Notes                                                                            | Upstream                                                                                       |
|--------------|---------|-------------------|----------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| three        | 0.171.0 | MIT               | 3D engine. Bundled by Vite into `dist/assets/`.                                  | https://github.com/mrdoob/three.js                                                             |
| jszip        | 3.10.1  | MIT OR GPL-3.0    | **Elected: MIT.** Dual-licensed; this product exercises the MIT option only.      | https://github.com/Stuk/jszip                                                                   |
| file-saver   | 2.0.5   | MIT               | Browser `<a download>`-style file save for export-HTML and export-ZIP.            | https://github.com/eligrey/FileSaver.js                                                         |

### Direct dependencies (GrapesJS — also vendored, see §1)

The five packages listed in §1 also appear under `dependencies` in
`editor/package.json` so the npm lockfile is the upstream-of-truth
for re-vendoring. Their SPDX license, version, and upstream URL are
the same as in §1.

| Package                  | Version | SPDX license | Upstream                                                |
|--------------------------|---------|--------------|---------------------------------------------------------|
| grapesjs                 | 0.22.16 | BSD-3-Clause | https://github.com/GrapesJS/grapesjs.git                |
| grapesjs-preset-webpage  | 1.0.3   | BSD-3-Clause | https://github.com/GrapesJS/preset-webpage.git          |
| grapesjs-blocks-basic    | 1.0.2   | BSD-3-Clause | https://github.com/GrapesJS/blocks-basic.git            |
| grapesjs-plugin-forms    | 2.0.6   | BSD-3-Clause | https://github.com/GrapesJS/components-forms.git        |
| grapesjs-custom-code     | 1.0.2   | BSD-3-Clause | https://github.com/GrapesJS/components-custom-code.git  |

### Transitive runtime dependencies

These are pulled in transitively. All are permissive.

| Package        | Version (resolved) | SPDX license | Purpose                                              | Upstream                                                  |
|----------------|--------------------|--------------|------------------------------------------------------|-----------------------------------------------------------|
| esbuild        | 0.25.x             | MIT          | Vite's transformer (dev + build only).               | https://github.com/evanw/esbuild                         |
| rollup         | 4.x                | MIT          | Vite's bundler (dev + build only).                   | https://github.com/rollup/rollup                         |
| @rollup/plugin-commonjs | 28.x      | MIT          | CJS → ESM interop for the vendored GrapesJS bundles. | https://github.com/rollup/plugins/tree/master/packages/commonjs |
| nanoid         | 5.x                | MIT          | ID generation in Vite's HMR runtime.                | https://github.com/ai/nanoid                             |
| postcss        | 8.x                | MIT          | Vite's CSS pipeline.                                 | https://github.com/postcss/postcss                       |
| source-map-js  | 1.x                | BSD-3-Clause | Source map support for the dev prebundle.            | https://github.com/mozilla/source-map                    |

### Dev dependencies (test + build tooling only)

These never ship in the runtime bundle — they exist to run the build
and tests during development.

| Package             | Version (range) | SPDX license | Purpose                              | Upstream                                            |
|---------------------|-----------------|--------------|--------------------------------------|-----------------------------------------------------|
| vite                | ^6.3.5          | MIT          | Dev server + production bundler.     | https://github.com/vitejs/vite                      |
| @playwright/test    | ^1.52.0         | Apache-2.0   | E2E + headless browser test runner.  | https://github.com/microsoft/playwright             |
| playwright          | (matches above) | Apache-2.0   | Browser drivers (chromium install).  | https://github.com/microsoft/playwright             |

---

## 3. Bundled font catalog — OFL-1.1 / Apache-2.0

The font picker (`editor/src/library/fonts/catalog.json`) ships **52
open-license Google Fonts families** — no font binaries are bundled in
this repository; the catalog references each family's official Google
Fonts CSS endpoint, and the editor injects a `<link rel="stylesheet">`
into the document `<head>` on demand. Every family is open-license:

- **SIL Open Font License 1.1 (OFL-1.1)** — 49 families
- **Apache License 2.0** — 3 families (Roboto, Roboto Mono, the
  Apache-licensed members of the IBM Plex family are present as OFL
  per upstream; only Roboto / Roboto Mono carry the Apache-2.0 label)

Per the OFL, the fonts can be:
- Used commercially without permission
- Embedded in applications and websites (CSS @font-face is the
  supported embed mechanism)
- Modified; modified copies must remain under the OFL

And per the Apache-2.0 license, Roboto / Roboto Mono can be used,
reproduced, distributed, and modified (with appropriate NOTICE
preservation) without restriction.

The catalog covers five categories:
**sans** (Inter, DM Sans, Poppins, Manrope, Space Grotesk, Roboto,
Open Sans, Lato, Montserrat, Nunito, Work Sans, Source Sans 3, Outfit,
Plus Jakarta Sans, Public Sans, IBM Plex Sans, Karla, Figtree, Geist,
Be Vietnam Pro), **serif** (Playfair Display, Fraunces, Lora,
Merriweather, PT Serif, Source Serif 4, Crimson Text, Cormorant
Garamond, EB Garamond, Bitter, Spectral, IBM Plex Serif),
**display** (Bricolage Grotesque, Unbounded, Archivo Black, Bebas
Neue, Anton, Oswald, Abril Fatface, Big Shoulders Display),
**mono** (JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono,
Roboto Mono, Space Mono), and **handwriting** (Caveat, Dancing Script,
Pacifico, Permanent Marker, Indie Flower, Patrick Hand).

Full per-family list and weights are in
[`editor/src/library/fonts/catalog.json`](editor/src/library/fonts/catalog.json).
Each entry's `cssUrl` resolves through
`https://fonts.googleapis.com/css2?family=…` and the per-family
copyright is preserved in the response headers per Google Fonts'
terms of service.

---

## 4. Runtime CDN loads — assets the browser fetches at load time

These are **not bundled in the repository**, but they ARE loaded by the
running editor in a normal browser session. Each is permissive and
redistribution-friendly in the way the editor uses it (CSS file from a
public CDN, JS module via esm.sh, image references).

| Resource                                                                                          | License      | Where it's loaded                                               | Upstream                                                                                      |
|---------------------------------------------------------------------------------------------------|-------------|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `https://fonts.googleapis.com/css2?family=DM+Sans:…&family=JetBrains+Mono:…`                     | OFL-1.1     | `editor/index.html` (app shell chrome fonts)                    | https://fonts.google.com/specimen/DM+Sans , https://fonts.google.com/specimen/JetBrains+Mono   |
| FontAwesome 4.7.0 CSS (`cdnjs.cloudflare.com/.../font-awesome/4.7.0/...`)                         | SIL OFL 1.1 | GrapesJS icon stylesheet (vendored copy's default `cssIcons`)   | https://fontawesome.com/v4.7.0/                                                              |
| `https://esm.sh/three@0.161.0`                                                                    | MIT         | 3D Studio mode (in-iframe `three` + `OrbitControls` embed)      | https://github.com/mrdoob/three.js                                                           |
| `https://picsum.photos/seed/<seed>/<w>/<h>`                                                       | Unsplash*   | Media bucket placeholder images                                 | https://picsum.photos/ (powered by https://unsplash.com/)                                    |

\* Picsum is a curated Lorem-Ipsum-for-photos service that proxies
Unsplash photos. Per the [Unsplash License](https://unsplash.com/license),
photos can be used freely for commercial and non-commercial purposes
without permission; the editor's media catalog marks each entry's
license field as `"Unsplash"` to reflect provenance.

### Bring-your-own-key APIs (called directly from the user's browser)

The editor's AI assistant and the GIF search panel call external
provider APIs directly from the user's browser using **keys the user
supplies** (stored only in `localStorage` — never sent to RHOBEAR
infrastructure). These are not vendored, not redistributed, and do not
bind the editor's license in any way.

| Provider      | Endpoint                                              | Auth model   | Usage                                                       |
|---------------|-------------------------------------------------------|--------------|-------------------------------------------------------------|
| Anthropic     | `https://api.anthropic.com/v1/messages`               | BYO API key  | BYO-LLM AI assist (default model: claude-sonnet-4-6)        |
| OpenAI        | `https://api.openai.com/v1/chat/completions`          | BYO API key  | BYO-LLM AI assist (default model: gpt-4o)                   |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/...` | BYO API key  | BYO-LLM AI assist (default model: gemini-2.0-flash)         |
| Giphy         | `https://api.giphy.com/v1/gifs/search`                | BYO API key  | BYO GIF search (optional media panel feature)               |
| Tenor         | `https://tenor.googleapis.com/v2/search`              | BYO API key  | BYO GIF search (optional media panel feature)               |

The provider API responses are not stored, cached, or redistributed
by RHOBEAR — they are rendered live into the user's own document.
Provider terms of service govern each user's use of those APIs.

---

## 5. Verdict

| Surface                         | License posture                                                       |
|---------------------------------|-----------------------------------------------------------------------|
| Application code (RHOBEAR)      | MIT (original — see `editor/LICENSE`)                                 |
| Vendored editor engine          | BSD-3-Clause (redistributable; notices preserved)                      |
| Bundled npm dependencies        | MIT (jszip elects MIT; others are MIT/BSD/Apache only)                 |
| Font catalog                    | SIL OFL 1.1 / Apache-2.0 (open-license, commercially usable)          |
| Runtime CDN assets              | MIT, OFL-1.1, Unsplash license (commercial-use OK)                    |
| BYO-key provider APIs           | Provider ToS — user-supplied keys; RHOBEAR does not redistribute       |
| **Copyleft exposure**           | **None** — no GPL, AGPL, LGPL, MPL, or EUPL components bundled or linked |

This product is safe to **sell, sublicense, and ship as part of a
larger commercial offering** under the MIT terms. If you re-vendor
GrapesJS or update `three`, re-run this inventory before release.

— last regenerated for RHOBEAR Designs editor v1.0.0
