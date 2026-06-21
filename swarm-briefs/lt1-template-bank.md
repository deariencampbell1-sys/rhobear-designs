# Lane lt1-template-bank — Template bank catalog + loader + community fork/PR model

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/lt1-template-bank`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`.

## REPO LAYOUT (critical)
Editor app in **`editor/`**. Template sources are the REPO-ROOT site collections, primarily
**`samples/minimax-m3-high/*.html`** (51 full pages) plus any other `samples/*/*.html`. From `editor/`
that's `../samples/`. Run node from `editor/`.

## Goal
A browsable TEMPLATE BANK of the 50+ designs the user can open as a starting point, PLUS the model for
the community to add/fork templates (the product is MIT + git-backed). Pure data + headless loader +
docs. NO UI (the gallery is the owner's UX).

## Hard guardrails
- **NO UI / styling / React.** Data + loader + docs only. Owner builds the gallery UX.
- Create NEW files ONLY under `editor/src/library/templates/`. Do NOT modify existing files or touch
  `editor/src/styles/**`, `index.html`, `editor/src/app/**`. No new npm deps. No secrets/node_modules/dist.

## Build it
1. `editor/src/library/templates/manifest.json` — generated catalog: for each template site, an entry
   `{ id, name, tags[], sourcePath, description }` where `sourcePath` is repo-relative (e.g.
   `samples/minimax-m3-high/orage-studio.html`). Derive name/tags from filename + a quick content sniff
   (title, headings). Include ALL 51 from minimax-m3-high (and any other samples/* html).
2. `editor/src/library/templates/index.js` — headless loader: `listTemplates(tag?)`, `getTemplateMeta(id)`,
   and `templateSourcePath(id)` (returns the repo-relative path; the app/build step is responsible for
   fetching the file contents). Keep it environment-agnostic.
3. Thumbnails — BEST EFFORT, do not block DoD: if `npx playwright` + chromium are available on the box,
   write `editor/src/library/templates/gen-thumbs.mjs` that renders each template to a small webp/png in
   `editor/src/library/templates/thumbs/<id>.png` and record `thumb` in the manifest. If chromium is NOT
   available, SKIP thumbnail generation, leave `thumb: null`, and say so in the PR (the UX will live-preview).
4. `editor/src/library/templates/README.md` — the community model: templates live in `samples/` + are
   registered in `manifest.json`; contributors FORK the repo, add their template file + a manifest entry,
   and open a PR; document the entry schema + a `regen` note. (MIT, open community.)
5. `editor/src/library/templates/index.test.js` (`node --test src/library/templates/`): manifest valid,
   >= 51 entries, unique ids, sourcePath points at an existing file, loader filters by tag.

## Definition of Done (ALL)
- manifest (>=51) + loader + README, tests pass, `npm run build` GREEN from `editor/`.
- New files only under `editor/src/library/templates/`. No UI/styles touched.

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A
git config user.email "swarm@rhobear"; git config user.name "lt1-template-bank"
git commit -m "feat(library): template bank catalog + loader + community fork/PR model"
git push -u origin lane/lt1-template-bank
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/lt1-template-bank \
  --title "W4: template bank (50+ designs catalog + community model)" \
  --body "Catalog + headless loader for the 50+ template sites; documents the git fork/PR community model. No UI.

## Evidence
<paste: template count; thumbnails done or skipped (+why); node --test output; npm run build tail>

## DoD
- [x] manifest>=51 + loader + README  - [x] tests green  - [x] build green  - [x] new files only  - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
