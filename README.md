# RHOBEAR Designs

**An open-source visual website editor. Canva-style, but you own it — no lock-in, no account, no telemetry, and bring your own AI.**

Design a page on a canvas, edit any live site in place, drop in real 3D, and export clean HTML/CSS. MIT-licensed and self-hostable. The AI is optional and **bring-your-own-key** — RHOBEAR never sits between you and your model.

**▶ Try it live:** https://rhobear-ai.github.io/rhobear-designs/

> Identity: red `#E94560` on deep navy. RHOBEAR Designs is one of the RHOBEAR family — each product shares one shell and wears its own accent + bear.

---

## What you get (free, forever)

- **Three ways to work**
  - **Edit Live Site** — open any HTML page (a template, a file, or markup a chatbot gave you) and edit it *in place*; it keeps its look and its behavior.
  - **Build from scratch** — a blank canvas with a block/element library.
  - **3D Studio** — a real [Three.js](https://threejs.org/) scene: insert primitives/models, orbit, recolor, transform, and drop the result into a page as a self-contained embed.
- **62 templates** — full-page designs recreated from award-winning sites, opened as editable pages.
- **350+ elements** — navs, heroes, pricing, FAQs, galleries, footers, and more, as a drag-in library.
- **Direct manipulation** — click to select, double-click to edit text inline, drag to move, undo/redo, a live layers tree, and an inspector for fills, type, spacing, and effects.
- **Bring-your-own AI (optional)** — point the built-in assistant at **Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint** (Ollama, vLLM, LM Studio…). Your key is stored **locally in your browser** and used to call *your* model directly. There is no RHOBEAR AI middleman and no server-side key.
- **Clean export** — download standalone **HTML** or an **HTML + CSS ZIP**. What you export is what you built — no runtime lock-in.
- **Installable PWA** — works offline for the app shell; install to your desktop or iPad home screen.

No sign-up. No tracking. No paywall on the editor.

---

## Quickstart (run it locally)

```bash
git clone https://github.com/rhobear-ai/rhobear-designs.git
cd rhobear-designs/editor
npm install
npm run dev          # http://localhost:5180
```

Build the static app for hosting anywhere:

```bash
npm run build        # outputs editor/dist — deploy it to any static host
npm run preview      # preview the production build locally
```

The build is a fully static site (relative asset paths), so it drops onto GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket, or your own box with no server.

---

## Bring your own AI

RHOBEAR Designs does not ship or proxy any model. To use the assistant:

1. Click **AI assist** (bottom-right) → **Connect / change LLM key**.
2. Pick a provider — **Anthropic**, **OpenAI**, **Google**, or **Local / OpenAI-compatible**.
3. Paste your key (and, for local/compatible endpoints, the base URL, e.g. `http://localhost:11434/v1`).

Your key never leaves your browser's local storage. For OpenAI-compatible endpoints the model can call the editor's tools to act on the page directly (select, edit, insert). The editor is **fully usable with no key** — the AI is an accelerator, not a gate.

---

## How it's built

- **Vanilla ES modules + Vite** — no framework runtime; the app is small and static.
- **[GrapesJS](https://grapesjs.com/)** (vendored, MIT) powers the Build-mode canvas.
- **[Three.js](https://threejs.org/)** (MIT) powers 3D Studio.
- **Node test runner** — `npm test` runs the unit/behavior suite; `npm run test:e2e` runs the smoke tests.

Everything shippable is MIT and self-contained — no proprietary services are required to run the editor.

## Repository layout

- `editor/` — the website editor (the product). See [`editor/README.md`](editor/README.md) for internals.
- `samples/` — the source HTML for the bundled templates (recreations used by the template bank).

---

## Contributing

Issues and PRs are welcome — new templates, elements, editor UX, and export fidelity especially. Please keep contributions MIT-clean (no code copied from non-permissive sources) and run `npm test` before opening a PR.

## License

[MIT](LICENSE) © RHOBEAR. Use it, fork it, ship client work with it, sell what you make — no attribution required.

---

### Looking for more?

An optional **Pro** tier adds voice control, generation styles, and deep-thinking model passes on top of this same editor. The editor here is complete and free on its own; Pro never removes or paywalls anything above — you can always stay on the open-source core.

## UX reference

The only UX reference for Designs is the North Star in rhobear-north-star (the Engines board). This repo is the engine;
its editor styling is not a reference and is replaced in lane L8d. `samples/` is the template corpus the engine reads,
not RHOBEAR brand. Icons and marks are the current Designs mark.
