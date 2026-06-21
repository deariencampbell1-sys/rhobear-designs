# Lane cc1-community-contrib — Community template contribution (git fork/PR) tooling + docs

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/cc1-community-contrib`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run node there.

## Goal
The product is MIT + git-backed: the community adds/forks TEMPLATES via GitHub (no custom server). Build
the headless tooling + docs for that flow. Reuse the template manifest schema from
`editor/src/library/templates/` if present (it merges from W4); if not present yet, define a minimal
compatible `{ id, name, tags[], sourcePath, description }` and note the dependency. NO UI.

## Hard guardrails
- **NO UI / styling / React.** Headless helpers + docs + a validator. Owner builds any UX.
- Create NEW files ONLY under `editor/src/library/community/` plus a root-level `CONTRIBUTING-TEMPLATES.md`.
  No other existing-file edits, no `editor/src/styles/**`, no new npm deps, no secrets/node_modules/dist.

## Build it
- `editor/src/library/community/contribute.js` — headless helpers:
  `validateTemplateEntry(entry)` (schema + required fields → {ok, errors}),
  `contributionUrl({repo:'deariencampbell1-sys/rhobear-designs', filePath, contentBase64?})` → a GitHub
  "new file" / fork URL the user can open to propose a template,
  `prInstructions(entry)` → a short ordered checklist string (fork → add file under samples/ → add manifest
  entry → open PR).
- `CONTRIBUTING-TEMPLATES.md` (repo root) — the human guide: how to fork, where templates live (`samples/`),
  the manifest entry schema, licensing requirement (contributor certifies their template is theirs / MIT-OK),
  and the PR checklist.
- `editor/src/library/community/index.js` — re-export.
- `editor/src/library/community/contribute.test.js` (`node --test src/library/community/`):
  validateTemplateEntry accepts a good entry + rejects missing fields; contributionUrl builds a valid
  github.com URL; prInstructions returns the steps.

## DoD
- tests pass; `npm run build` GREEN from `editor/`; new files only under `editor/src/library/community/`
  + `CONTRIBUTING-TEMPLATES.md`; no UI.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git config user.email "swarm@rhobear" && git config user.name "cc1-community-contrib"
git commit -m "feat(community): git fork/PR template contribution tooling + CONTRIBUTING-TEMPLATES"
git push -u origin lane/cc1-community-contrib
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/cc1-community-contrib \
  --title "W5: community template contribution (git fork/PR)" \
  --body "Headless validator + GitHub fork/PR URL helpers + CONTRIBUTING-TEMPLATES guide. GitHub is the backend. No UI.

## Evidence
<paste node --test output + build tail>

## DoD
- [x] tests green - [x] build green - [x] new files only (+CONTRIBUTING) - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
