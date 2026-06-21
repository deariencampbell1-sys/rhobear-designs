# Lane ps1-projects-store — Projects + folders persistence (headless)

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/ps1-projects-store`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; run node there.

## Goal
Users need to separate work into PROJECTS and FOLDERS and have it persist locally (no server). Build a
headless persistence layer. NO UI.

## Hard guardrails
- **NO UI / styling / React.** Headless API + tests only. Owner builds the projects UX.
- Create NEW files ONLY under `editor/src/library/projects/`. No existing-file edits, no `editor/src/styles/**`,
  no new npm deps, no secrets/node_modules/dist.

## Build it
- `editor/src/library/projects/store.js` — `createProjectStore(adapter?)`. Default adapter wraps IndexedDB
  in the browser; accept an injected adapter so tests use an in-memory one. API: `listFolders()`,
  `createFolder(name)`, `renameFolder(id,name)`, `deleteFolder(id)`, `listProjects(folderId?)`,
  `createProject({name, folderId?})`, `renameProject(id,name)`, `moveProject(id,folderId)`,
  `deleteProject(id)`, `saveDesign(id,{html,css,mode})`, `loadDesign(id)`. Stable ids, timestamps.
- `editor/src/library/projects/memory-adapter.js` — in-memory adapter (used by tests + as node fallback).
- `editor/src/library/projects/index.js` — re-export.
- `editor/src/library/projects/store.test.js` (`node --test src/library/projects/`): CRUD on folders +
  projects, move between folders, save/load design round-trip, isolation between projects.

## DoD
- tests pass; `npm run build` GREEN from `editor/`; new files only under `editor/src/library/projects/`; no UI.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git config user.email "swarm@rhobear" && git config user.name "ps1-projects-store"
git commit -m "feat(library): headless projects + folders persistence store"
git push -u origin lane/ps1-projects-store
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/ps1-projects-store \
  --title "W5: projects + folders persistence" \
  --body "Headless project/folder store (IndexedDB + injectable in-memory adapter), save/load designs. No UI.

## Evidence
<paste node --test output + build tail>

## DoD
- [x] tests green - [x] build green - [x] new files only - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
