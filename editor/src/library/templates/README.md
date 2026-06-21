# Template Bank

A browsable catalog of **62** recreated website designs (51 from
`minimax-m3-high`, 10 from `minimax-m2.7`, 1 from `minimax-m3-medium`)
that ship with RHOBEAR Designs as starting points for the visual editor.

This directory is **data + loader + docs only**. The gallery UX (the
sidebar, the filter chips, the preview cards) is built by the owner
inside `editor/src/app/`. Nothing here imports React, GrapesJS, or any
DOM library — the loader is plain JS and works in Node, the browser,
and the build step.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | The catalog. One entry per template. Generated, do not hand-edit. |
| `index.js` | Headless loader. Exports `listTemplates(tag?)`, `getTemplateMeta(id)`, `templateSourcePath(id)`, plus a few helpers. |
| `gen-manifest.mjs` | Re-generates `manifest.json` by scanning `samples/*/*.html`. |
| `gen-thumbs.mjs` | Best-effort thumbnail generator (uses Playwright + Chromium). Optional. |
| `thumbs/` | Rendered PNG thumbnails, one per template id. Empty if `gen-thumbs` was skipped. |
| `index.test.js` | `node --test` suite for the loader. |

## Manifest entry schema

```jsonc
{
  "id":         "minimax-m3-high-orage-studio",
  "collection": "minimax-m3-high",
  "name":       "Orage studio — recreation",
  "tags":       ["minimax-m3-high", "studio", "template"],
  "sourcePath": "samples/minimax-m3-high/orage-studio.html",
  "description": "3D / VFX / motion studio recreation ...",
  "thumb":      null,                             // or "thumbs/<id>.png"
  "originalUrl": "https://orage.studio/",        // optional
  "title":      "Orage studio — recreation",      // raw <title> when found
  "headings":   ["…", "…"]                        // optional, top h1–h3
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | `<collection>-<slug>`. Slug = filename without `.html`, lowercased, non-alphanumerics → `-`. Stable; used as the canonical handle everywhere. |
| `collection` | yes | Collection directory under `samples/` (e.g. `minimax-m3-high`). |
| `name` | yes | Human title. Falls back to title-cased slug if `<title>` is missing. |
| `tags` | yes | Includes the collection name (`minimax-m3-high`, etc.) and a `template` base tag. Domain tags (`studio`, `agency`, `webgl`, `portfolio`, `3d`, `motion`, `illustration`, …) are inferred from `<title>` + the first few headings. |
| `sourcePath` | yes | Repo-relative path with forward slashes, e.g. `samples/minimax-m3-high/orage-studio.html`. The app/build step is responsible for fetching the file. |
| `description` | yes | Short plain-text snippet. First `<p>`, else first `<h1>`/`<h2>`, else the title. Truncated at 240 chars. |
| `originalUrl` | no | Pulled from the `Original URL : …` comment block at the top of the source file. |
| `title` | no | The raw `<title>` string when present. |
| `headings` | no | Up to 6 top `<h1>`/`<h2>`/`<h3>` strings, in document order. |
| `thumb` | yes | `"thumbs/<id>.png"` if a thumbnail was rendered, otherwise `null`. |

## Regenerating the catalog

When you add, remove, or rename a template file under `samples/`, regenerate:

```bash
# from the repo root
node editor/src/library/templates/gen-manifest.mjs
```

This scans every `samples/<collection>/*.html`, sniffs `<title>` +
headings + the `Original URL` comment, infers tags, and rewrites
`manifest.json` in one pass. The output is sorted by `id` for
diff-friendly PRs.

Then (optionally) re-render thumbnails:

```bash
node editor/src/library/templates/gen-thumbs.mjs
```

`gen-thumbs.mjs` is **best-effort**. If Playwright/Chromium isn't
installed on your box, the script prints a warning, leaves every
`thumb: null`, and exits 0. The gallery UX will live-preview from
`sourcePath` instead — the gallery never breaks because thumbs are
missing.

## Re-running the tests

```bash
# any of these work — pick the one that matches your cwd:
node --test editor/src/library/templates/index.test.js          # explicit file
node --test "editor/src/library/templates/**/*.test.js"         # glob
( cd editor/src/library/templates && node --test )              # cwd scan
```

Note: `node --test <dir>/` accepts the directory but, in Node 22,
runs only a single suite-level test for the path itself — it does
not recurse into the individual `test()` calls inside `index.test.js`.
The forms above all enumerate the 19 cases.

The suite checks: manifest shape, >= 51 entries, all ids unique,
every `sourcePath` points at an existing file, the loader's filters
and lookups behave, and tag inference is sane.

---

## Contributing a template (community fork / PR model)

The template bank is the seed list for a larger, open community
catalog. The product is MIT and the templates live in this repo —
so adding a template means **git, not magic**.

### 1. Fork the repo

```bash
# on github.com/deariencampbell1-sys/rhobear-designs click "Fork"
git clone https://github.com/<you>/rhobear-designs.git
cd rhobear-designs
git checkout -b feat/add-my-studio-template
```

### 2. Add your template file

Templates are plain self-contained `.html` files under `samples/`.
Pick the closest matching collection directory (or open an issue
if you want a new one):

```
samples/<collection>/<your-template>.html
```

The file should be:

- A single, self-contained HTML document (CSS + JS inlined or via
  CDN). No build step required to open it in a browser.
- Have a `<title>` near the top — the loader uses this for the
  card name.
- Have an `Original URL : https://…` line in a leading HTML
  comment so the catalog can link back to the source inspiration.
- Render cleanly at desktop and mobile breakpoints.

### 3. Regenerate the manifest

```bash
node editor/src/library/templates/gen-manifest.mjs
```

This picks up your new file and adds a manifest entry. Skim
`manifest.json` and confirm:

- `id` is `<collection>-<your-slug>` and matches your filename.
- `name` came from your `<title>` (or override by editing your
  `<title>`).
- `tags` look sane (collection always included; domain tags
  inferred from your content).
- `description` reads well.

### 4. (Optional) Render a thumbnail

```bash
npx playwright install chromium   # one-time, ~150 MiB
node editor/src/library/templates/gen-thumbs.mjs
```

The new template gets `thumbs/<id>.png` and the manifest `thumb`
field is filled in. If you skip this, leave `thumb: null` — the
gallery will live-preview from the source.

### 5. Open a PR

```bash
git add samples/ editor/src/library/templates/manifest.json \
        editor/src/library/templates/thumbs/   # if rendered
git commit -m "feat(samples): add <your-template> recreation"
git push -u origin feat/add-my-studio-template
gh pr create --repo deariencampbell1-sys/rhobear-designs \
  --base build/editor-v1 \
  --title "Template: <your-template>" \
  --body  "Adds a recreation of <original-url> to the template bank. Self-contained, MIT, no new deps."
```

### 6. Review checklist (for reviewers)

- [ ] `node editor/src/library/templates/gen-manifest.mjs` produces
      no warnings.
- [ ] `node --test editor/src/library/templates/` is green.
- [ ] `npm run build` (from `editor/`) is green.
- [ ] The new `.html` opens in a fresh browser without console
      errors.
- [ ] `<title>` and `Original URL` are present.
- [ ] No new npm deps, no edits to `editor/src/styles/**`,
      `editor/src/app/**`, or `index.html`.

That's it. Once merged, the gallery picks the template up
automatically on the next build.

---

## License

MIT — see [`../../LICENSE`](../../LICENSE). Templates are recreated
for educational/inspiration purposes; original designs retain their
respective copyrights and are credited via `originalUrl`.
