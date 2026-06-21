# Lane an1-pattern-analysis — Analyze how the template designs actually WORK (scroll, 3D, links, structure)

You are a swarm worker on chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/an1-pattern-analysis`
off `build/editor-v1` of `deariencampbell1-sys/rhobear-designs`. Editor app in **`editor/`**; sample sites at
REPO-ROOT `samples/minimax-m3-high/*.html` (and other `samples/*/`). Run node from `editor/`.

## Why
The editor must give SIMPLE tools to control what these templates already do — scroll effects, the 3D
sphere (roughness + spin), in-page links, and nav/header/footer structure. To build those tools right, we
first need a precise map of WHAT techniques the templates use. You produce that map + concrete tool
recommendations. Analysis only — NO UI, NO editor-code changes.

## Hard guardrails
- **NO UI / no edits to `editor/src/app/**`, `editor/src/styles/**`, `index.html`.** You ANALYZE + write a
  report + a data file. Create NEW files ONLY under `editor/src/library/patterns/`.
- No new npm deps. Browser-safe if any loader (import JSON, not node:fs). No secrets.

## The task — scan every sample HTML and detect, per file:
1. **Scroll techniques**: which of these appear — GSAP `ScrollTrigger`, `locomotive-scroll` / `data-scroll`,
   `IntersectionObserver`, `AOS`, CSS scroll-driven (`animation-timeline`/`scroll()`), `position:sticky`,
   parallax (transform on scroll). Record the exact markers found (script src, attribute, API name).
2. **3D / WebGL**: `three.js` (and how loaded), canvas/WebGL, sphere/geometry usage, material params you can
   find in source (`roughness`, `metalness`, `MeshStandardMaterial`), and any auto-rotate/spin
   (`rotation.x/y += …`, `autoRotate`). Quote the lines.
3. **Links / anchors**: in-page anchors (`href="#…"`), smooth-scroll handlers, scroll-to-section patterns.
4. **Structure**: presence of `<header> <nav> <footer> <main>`, and the dominant section/grid patterns.
5. **Animation libs**: GSAP, anime.js, framer-motion-like, Lenis, etc. (by script src / global).

## Outputs (under `editor/src/library/patterns/`)
- `patterns.json` — `{ generatedAt:null, templates: [ { id, file, scroll:[…], threeD:{…}, links:{anchors:n, smoothScroll:bool}, structure:{header,nav,footer,main}, libs:[…] } ], summary: { byTechnique: {…counts…} } }`
  (leave generatedAt null — the scripts can't use Date; stamp later.)
- `analysis.mjs` — the node script that produced it (re-runnable: `node src/library/patterns/analysis.mjs`).
- `RECOMMENDATIONS.md` — the key deliverable: for each capability (scroll-reveal, parallax/sticky,
  3D rotate/roughness/spin, in-page link targeting, footer/nav insertion), describe the SIMPLEST editor tool
  that would let a non-coder control it, grounded in what the templates actually use. Be concrete: e.g.
  "Most reveals = add/remove a class via IntersectionObserver → a 'Scroll reveal' toggle should stamp
  `data-rb-reveal="fade-up"` + ship a 3KB runtime that applies it; no GSAP needed." Note where a small
  reusable runtime (`rb-scroll.js`, `rb-three-control.js`) would be worth building.

## DoD
- `patterns.json` covers all minimax-m3-high samples (state the count), `analysis.mjs` re-runs, and
  `RECOMMENDATIONS.md` gives concrete, simplicity-first tool specs. `npm run build` stays GREEN (you added
  no app imports). New files only under `editor/src/library/patterns/`.

## Finish — commit, push, open PR (print URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add -A && git config user.email "swarm@rhobear" && git config user.name "an1-pattern-analysis"
git commit -m "analysis(patterns): map scroll/3D/link/structure techniques across templates + tool recommendations"
git push -u origin lane/an1-pattern-analysis
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/an1-pattern-analysis \
  --title "Analysis: template interaction patterns + simplicity-first tool specs" \
  --body "Maps scroll effects, the 3D sphere (roughness/spin), in-page links, and nav/footer structure across the templates; recommends the simplest editor tools to control each. Analysis only, no UI.

## Evidence
<paste: template count analyzed; top techniques by count; the headline recommendations>

## DoD
- [x] patterns.json + analysis.mjs + RECOMMENDATIONS.md - [x] build green - [x] new files only - [x] no UI"
```
Print the final PR URL on its own line. Then STOP.
