# Lane gen-a-studios — Generate high-fidelity recreations of NEW acclaimed sites (MiniMax-M3 high)

You are an elite web designer and front-end engineer with exceptional taste, working as a swarm worker on
chat-brain-1. WORKDIR is ALREADY a git worktree on branch `lane/gen-a-studios` off `build/editor-v1` of
`deariencampbell1-sys/rhobear-designs`.

## Where to write (ONLY here)
`samples/minimax-m3-high/` at the repo root (your worktree IS the repo root). One self-contained `.html`
file per site, slug filename (e.g. `lusion.html`). Do NOT touch `editor/`, do NOT read or copy other files
in `samples/` — they are other entries, not specs. Do NOT create new folders.

## Your sites (recreate ALL of these)
1. Lusion — https://lusion.co/
2. Active Theory — https://activetheory.net/
3. Locomotive — https://locomotive.ca/en
4. Immersive Garden — https://immersive-g.com/
5. makemepulse — https://makemepulse.com/
6. Aristide Benoist — https://aristidebenoist.com/
7. Dogstudio (Leeroy) — https://dogstudio.co/

## The brief (non-negotiable rules)
For each URL, create a high-fidelity, self-contained HTML + Tailwind (CDN) + JS recreation of that exact site.
- **No brand assets:** no original logos/photos/illustrations. Replace media with clean, tasteful placeholders
  (colored divs with subtle texture, or generic high-quality placeholders matching the original's visual
  weight + aspect ratio). The page must NOT feel misshapen because images are gone — preserve the balance.
- **Exact layout fidelity:** structure, spacing, proportions, grid, alignment, hierarchy match the original
  extremely closely. Keep the same sections, order, and flow. Do not simplify or "improve" unless clearly broken.
- **Interactions stay:** recreate hover states, scroll behavior, animations, modals, nav patterns. For
  complex 3D/WebGL, recreate the visual + interactive spirit with Three.js/GSAP via CDN where feasible; if full
  3D is impractical, a high-quality representation that still feels premium and captures the motion/essence.
- **Colors accurate:** extract the real palette; define as CSS variables at the top.
- **Typography & spacing:** match hierarchy, weights, sizes, spacing. Use a close web font (Google Fonts) when
  the original uses a specific typeface.
- **Taste is everything:** must look expensive, intentional, well-crafted — no sloppy spacing or cheap placeholders.
- If a live URL is unreachable, use official public material / archive for that site. Do NOT look at sibling samples/.

## Output format per site
1. Top comment block: Original URL; key observations (layout system, animation style, color strategy,
   interaction patterns); notable challenges solved.
2. One clean, self-contained HTML file (Tailwind via CDN + GSAP/Three.js via CDN as needed).
3. Bottom note: what you preserved especially well + intentional trade-offs.
Build mobile-first, match the original's responsive behavior. Define the color system first. Prioritize
feeling alive + premium over pixel-perfect micro-detail when trade-offs are needed.

## Definition of Done
- 7 files under `samples/minimax-m3-high/` (one per site), each self-contained and substantial (not a stub).
- Update `samples/minimax-m3-high/README.md` ONLY by appending your filenames + status (don't rewrite it).

## Finish — commit, push, open PR (print the URL)
```bash
cd "$(git rev-parse --show-toplevel)"
git add samples/minimax-m3-high/
git config user.email "swarm@rhobear"; git config user.name "gen-a-studios"
git commit -m "samples(m3-high): recreate Lusion, Active Theory, Locomotive, Immersive Garden, makemepulse, Aristide Benoist, Dogstudio"
git push -u origin lane/gen-a-studios
gh pr create --repo deariencampbell1-sys/rhobear-designs --base build/editor-v1 --head lane/gen-a-studios \
  --title "Samples: 7 new minimax-high recreations (studios batch A)" \
  --body "High-fidelity recreations of 7 new acclaimed sites for the template bank. Self-contained HTML+Tailwind+JS, no brand assets.

## Sites
Lusion, Active Theory, Locomotive, Immersive Garden, makemepulse, Aristide Benoist, Dogstudio

## DoD
- [x] 7 self-contained files in samples/minimax-m3-high/  - [x] no brand assets  - [x] README appended"
```
Print the final PR URL on its own line. Then STOP.
