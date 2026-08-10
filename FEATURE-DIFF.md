# FEATURE-DIFF — Designs app current state → Firefly pack rebuild

## Current screens/entry points

| Entry | File | Purpose |
|-------|------|---------|
| Desktop studio | `editor/index.html` | Full editor with toolbar, rail, canvas, inspector, status bar |
| Mobile studio | `editor/m.html` | Phone-optimized shell with bottom dock, sheet rail, AI panel |
| Tablet studio | `editor/t.html` | Touch-optimized desktop engine with overlay rails |

## Every feature/screen/setting — inventory

### 1. Editor shell (desktop)
- **Toolbar**: brand logo, doc title, mode switch (Edit Live/Build/3D), Templates, Projects, undo/redo, device switch (desktop/tablet/mobile), preview, new, open, open-folder, export, save, sign-in
- **Rail**: Add tab (GrapesJS blocks / element library / 3D rail) + Layers tab
- **Canvas**: GrapesJS build mode, live-mode iframe host, 3D Studio host
- **Empty state**: "What will you design today?" hero, templates grid, recent projects
- **Floatbar**: select-parent, duplicate, replace, delete
- **AI panel**: chat surface with "Ask anything…" composer, provider settings, model config
- **Inspector**: GrapesJS styles + traits (build), live inspector, 3D controls
- **Status bar**: dot, message, selection info
- **First-run onboarding**: 4-step walkthrough (visual editor, templates, canvas, Rho)

### 2. Mobile shell (m.html)
- **Top bar**: brand, undo/redo, preview, save, sign-in
- **Dock**: Templates, Add, AI, Layers, Projects
- **Sheets**: rail (Add/Layers), inspector, AI panel (all slide up from bottom)
- **Floatbar**: same as desktop, bottom-center
- **Canvas/empty**: same engine, phone-tuned spacing
- **Onboarding**: none (separate from desktop)

### 3. Tablet shell (t.html)
- **Toolbar**: same as desktop but compact (icons-only, text hidden)
- **Overlay rails**: rail/inspector float over canvas at ≤1100px
- **Canvas/empty**: same as desktop
- **Onboarding**: none

### 4. Shared engine features
- **GrapesJS build mode** with blocks, layers, style manager, traits
- **Live mode** with iframe + overlay + element library (the stash)
- **3D Studio** with object controls
- **AI chat** (BYO-LLM) with provider/model/key config, message history
- **Auth** via central auth (sign-in/sign-out)
- **Projects** with save/load/list
- **Templates gallery** with search, template cards, thumbnails
- **Preview modal**
- **Embed modal** (HTML/iframe)
- **Settings modal** (LLM provider, key, model, base URL)
- **File operations**: open HTML, open folder, export ZIP, save HTML
- **Device preview**: desktop/tablet/mobile canvas frame sizes
- **Undo/redo** (Backbone.Undo)
- **Rho companion** embed (bottom-left corner positioning)
- **PWA**: manifest, service worker, installable, apple touch icons

### 5. No-mock survivors (features with no picture — KEEP)
- **3D Studio** — no mock, but it's a core mode. Keep full wire.
- **Projects system** — save/load/list, no mock. Keep.
- **Settings modal** — BYO-LLM config, no mock. Keep.
- **Embed modal** — no mock. Keep.
- **Preview modal** — no mock. Keep.
- **Auth** — sign-in, no mock. Keep.
- **First-run onboarding** — no mock for the pack. Keep.
- **Rho companion** — Rho embed, separate from the pack. Keep.
- **PWA/manifest/service worker** — no mock. Keep.
- **Floatbar** (selection toolbar) — no mock. Keep.

### 6. What gets purged
- **Old accent color**: `#ff3a2a` → `#C84B4B` (pack ONE red)
- **Old accent variants**: `#cc2e20`, `#e94560`, `#ff3a2a` references
- **Nacelle font**: remove `/nacelle/nacelle.css` link, remove Nacelle dependency
- **Old font stack**: `--rb-font` system stacks → Typekit lato
- **Old brand colors**: all `--rb-brand-*` vars get new values
- **Old bear tint**: the bear mark is already the correct red etched head (committed in 72d884e), but Rho accent needs updating

### 7. What stays (no change)
- All HTML structure (DOM elements, data-testids, JS hooks)
- All JS engine code (main.js, shell.js, auth.js, etc.)
- All API endpoints
- All mode behavior (Live/Build/3D)
- GrapesJS integration
- AI chat logic
- PWA manifests
- Service worker
- All test fixtures

### 8. Pack tokens to add
- `--designs-accent: #C84B4B` (replaces `--rb-brand: #ff3a2a`)
- `--designs-bg: #0A0D10` (slightly different from current `#0a0e13`)
- `--designs-canvas-bg: #111518`
- `--designs-panel-bg: #0D1014`
- `--designs-text-section: #2A8FA8` (teal section labels)
- Typekit `sbv5bcv`: rokkitt (display), lato (body), droid-sans-mono (mono)
- allura (brand-word face for "Designs")