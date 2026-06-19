# MiniMax M3 High

**Model:** MiniMax M3 High  
**Status:** **Complete** — all 6 round-2 sites delivered

## Deliverables

| # | Site | File | Notes |
|---|------|------|-------|
| 1 | alche.studio | `alche-studio.html` | Dark WebGL studio site — rotating crystal centerpiece, custom shader with noise + fresnel, material & quaternion gizmos, NEWS panel with red year headers, giant `ALCHE` wordmark watermark, grid background. |
| 2 | cappen.com | `cappen.html` | Miami-based award-winning studio — "Human thinkers, digital makers" hero, six full case studies (Amanda Braga, Credit Genie, JCPM, Ministry of Supply, LeadEdu, NeonDoor), awards marquee, scroll-reveal transitions. |
| 3 | brandappart.com | `brand-appart.html` | Paris startup-focused design studio — cream-paper canvas, per-tile accent palettes (lime / coral / lilac / mint / sun / ink), draggable founder testimonials, four-pillar services band, trust wall. |
| 4 | 109ichiki.com | `109ichiki.html` | Tokyo illustrator "1:09" portfolio — fluorescent pinks + limes + yellows, heavy outlined tabs, four category panels (illustration / MV / event / goods), BGM player UI, pickup works row, profile mosaic. |
| 5 | bychudy.com | `bychudy.html` | Warsaw art direction + photography studio for the Polish music industry — typographic project index (no imagery), featured Ryk × Fantasmagorie spread, six category tiles, custom cursor with ring hover state. |
| 6 | wearestokt.com | `wearestokt.html` | Motion-driven branding studio — Three.js breathing icosahedron hero with custom shader, letter-by-letter reveal of the mission line, scrolling service marquee, six featured project plates, Motion Index reel grid. |

## Approach

- **Self-contained HTML per site** — Tailwind via CDN + Three.js via CDN (only used in `alche-studio.html` and `wearestokt.html`, where WebGL is on-brief), no build step, no external assets.
- **No brand assets used** — every illustration, plate, thumbnail, and avatar is procedural CSS, gradient + noise composition, inline SVG, or WebGL geometry.
- **Color tokens defined as CSS variables** at the top of each file for easy audit.
- **Comment block at top of each file** documents the original URL, live-site observations, and challenges solved.
- **Six different moods** for six different studios: dark futuristic (Alche), editorial award (Cappen), founder-cream (Brand Appart), fluorescent pop (109ichiki), editorial-music (bychudy), motion-driven brand (Stōkt).
- **No other models' folders touched** — design references were the live sites + training knowledge, not sibling samples. (Old round-1 files remain in this folder, untouched.)

## What I leaned into

- **WebGL centerpiece on alche.studio** — stretched octahedron with a noise-displaced vertex shader, fresnel-driven rim highlight, real material/quaternion widgets driving uniforms in real time.
- **Scroll-driven case studies on cappen.com** — six full case studies with scroll-reveal, parallax plates, and an award marquee that captures the "we ship work" energy of an Awwwards-tier studio.
- **Per-tile palette rotation on brandappart.com** — every featured-work tile carries its own accent variable (lime / coral / lilac / mint / sun / ink / cyan) so the grid reads as a curated mood-board, not a uniform list.
- **Tab system + BGM player on 109ichiki.html** — radio-button tabs with smooth panel transitions, faux BGM controls with a moving progress bar, mosaic profile tile.
- **Type-as-imagery on bychudy.com** — the live site is photography-heavy; the brief forbade brand assets, so the project names themselves become the visual centerpiece, set in Fraunces at 7vw with italic accents.
- **Motion reveal on wearestokt.com** — letter-by-letter reveal of the mission line on scroll-into-view, plus a Three.js icosahedron with custom shader breathing behind the hero type.

Full rules: [`../README.md`](../README.md) · [`../AGENTS.md`](../AGENTS.md)
