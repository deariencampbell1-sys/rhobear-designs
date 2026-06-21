# Lane gen-c-award — Generate high-fidelity recreations of NEW acclaimed sites (MiniMax-M3 high)

You are an elite web designer and front-end engineer with exceptional taste, working as a swarm worker on
chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/gen-c-award` off `build/editor-v1` of
`deariencampbell1-sys/rhobear-designs`.

## Where to write (ONLY here)
`samples/minimax-m3-high/` at the repo root (your worktree IS the repo root). One self-contained `.html`
per site, slug filename (e.g. `basic-agency.html`). Do NOT touch `editor/`, do NOT read/copy other
`samples/` files, do NOT create new folders.

## Your sites (recreate ALL of these)
1. Basic/Dept — https://www.basicagency.com/
2. Akaru — https://akaru.fr/
3. Wokine — https://wokine.com/
4. Fireart Studio — https://fireart.studio/
5. Lazarev (Elva) — https://www.lazarev.agency/
6. Unseen Studio — https://unseen.co/
7. Igloo Inc — https://igloo.inc/

## The brief (non-negotiable rules)
For each URL, create a high-fidelity, self-contained HTML + Tailwind (CDN) + JS recreation of that exact site.
- **No brand assets:** no original logos/photos/illustrations. Replace media with clean, tasteful placeholders
  (colored divs with subtle texture, or generic high-quality placeholders matching visual weight + aspect ratio).
  The page must NOT feel misshapen because images are gone — preserve the balance.
- **Exact layout fidelity:** structure, spacing, proportions, grid, alignment, hierarchy match closely. Same
  sections, order, flow. Don't simplify/"improve" unless clearly broken.
- **Interactions stay:** hover states, scroll behavior, animations, modals, nav. Complex 3D/WebGL → recreate the
  visual + interactive spirit with Three.js/GSAP (CDN) where feasible; else a premium representation capturing motion.
- **Colors accurate:** extract the real palette; CSS variables at top.
- **Typography & spacing:** match hierarchy, weights, sizes, spacing; close Google Font when a specific typeface.
- **Taste is everything:** expensive, intentional, well-crafted — no sloppy spacing or cheap placeholders.
- Unreachable URL → use official public material / archive. Do NOT look at sibling samples/.

## Output format per site
1. Top comment block: Original URL; key observations (layout, animation, color strategy, interactions); challenges.
2. One clean self-contained HTML file (Tailwind CDN + GSAP/Three.js CDN as needed).
3. Bottom note: what you preserved especially well + trade-offs.
Mobile-first, match responsive behavior; define color system first; alive + premium over pixel-perfect.

## Definition of Done
- 7 files under `samples/minimax-m3-high/`, each self-contained + substantial. Append filenames to that
  folder's README.md (don't rewrite it).

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add samples/minimax-m3-high/
git config user.email "swarm@rhobear"; git config user.name "gen-c-award"
git commit -m "samples(m3-high): recreate Basic, Akaru, Wokine, Fireart, Lazarev, Unseen, Igloo"
git push -u origin lane/gen-c-award
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/gen-c-award \
  --title "Samples: 7 new minimax-high recreations (award batch C)" \
  --body "High-fidelity recreations of 7 new acclaimed sites. Self-contained HTML+Tailwind+JS, no brand assets.

## Sites
Basic, Akaru, Wokine, Fireart, Lazarev, Unseen, Igloo

## DoD
- [x] 7 self-contained files in samples/minimax-m3-high/  - [x] no brand assets  - [x] README appended"
```
Print the final PR URL on its own line. Then STOP.
