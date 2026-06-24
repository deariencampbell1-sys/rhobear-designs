# RHOBEAR Designs

**A website editor that hands you the file back.**

Open an HTML file, edit it on a live canvas, and export clean HTML and CSS you own. No account, no lock-in, no export tax. MIT licensed. Bring your own model.

Most page builders trap your work behind their renderer — you can design, but you can never really leave with what you made. RHOBEAR Designs opens the HTML you already have, edits the actual DOM, and writes it back out clean. The code stays yours from the first click.

→ **Landing page:** [`site/index.html`](site/index.html)
→ **The editor:** [`editor/`](editor/) · [editor docs](editor/README.md)

## Quick start

```bash
cd editor
npm install
npm run dev      # http://localhost:5180
```

## What it does

- **Open** a single `.html` file or a whole project folder with linked images and CSS.
- **Edit** on a real canvas — click to select, drag blocks in, resize with handles, double-click to type. You move the document, not a preview of it.
- **Ask** a model to make a change. Connect any provider with your own key; the AI applies clean edits to the canvas instead of reloading the page, so nothing flickers and nothing gets held hostage.
- **Export** the document with inlined styles, or a ZIP of `index.html` + `styles.css` + assets. Host it anywhere.

The canvas and serializer are [GrapesJS](https://grapesjs.com/) (MIT) under RHOBEAR chrome. Import, export, and the AI chat bubble are original code in `src/lib/`. The Playwright suite checks that every toolbar button does what it claims.

## Structure

- `site/` — the product landing page (self-contained, ships on GitHub Pages)
- `editor/` — the website editor (GrapesJS + RHOBEAR theme, MIT)
- `samples/` — model benchmark folders; each model gets one folder for its finished work ([map + rules](samples/README.md))
- `brand/` — logo, color, typography *(planned)*

## Brand

- Deep Navy `#1A1A2E`
- Rhobear Red `#E94560`
- Off-White `#F5F5F5`
- Dark starfield background. Never orange.

## License

MIT. Clone it, fork it, sell what you build with it.
