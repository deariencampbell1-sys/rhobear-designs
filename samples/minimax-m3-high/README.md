# MiniMax M3 High

**Model:** MiniMax M3 High  
**Status:** **Complete** — all 6 round-2 sites + 7 round-3 sites delivered

## Round 3 — Award batch C (new acclaimed sites)

| # | Site | File | Notes |
|---|------|------|-------|
| 1 | basicagency.com | `basic-dept.html` | BASIC/DEPT® paper-white portfolio — white "browser card" centered on a slate-blue page that auto-rotates through KFC, Google Store, Wilson, Patagonia case studies; serif giant type, awards row, statement band, project mosaic, news list, dark footer with newsletter + offices. |
| 2 | akaru.fr | `akaru.html` | Lyon agency with editorial print-book feel — 50/50 hero (massive black "AKARU" wordmark on cream + 4-up pastel color-stripe thumbnails), full-bleed case study panels for bomo / Orlinski / Pikko with category tags and circular arrow CTAs, scroll-reveal awards table, full-bleed orange expertises panel, giant footer wordmark. |
| 3 | wokine.com | `wokine.html` | Lille/Annecy digital & creative studio — "Hello, again.*" giant serif hero with bobbing lime-green shield + Annecy pop-up, full-bleed peach/red Leroux 2022 case with stubbed jars and giant serif year, rotating-words "Nos Expertises" stack, dark project mosaic, awards tags, trust wall, deep-purple startup-studio band. |
| 4 | fireart.studio | `fireart.html` | Cream-canvas dev/design agency — orange leather-textured hero with cycling phone-app mockup, floating white pill nav with orange Contact, marquee client logo strip, swap-on-click service tabs, success-story cards, 4 award tiles, dark podcast grid, dark CTA with 8 trust pills, 6-col white footer. |
| 5 | lazarev.agency | `lazarev.html` | San Francisco AI-product studio — black canvas with massive serif headline and a single bright green "LET'S TALK" pill CTA, scrolling accolades marquee, "Golden standard in UX + AI" + "Webby winner" cards, Accern/Elva/VT.NEWS case grid, partnership manifesto band, 6-service cards, client mosaic, testimonial stack, dense dark footer. |
| 6 | unseen.co | `unseen-studio.html` | Bristol brand/digital/motion studio — full-bleed pastel-pink dreamscape with mountains, arches over a pool, sphere, stairs (mousemove parallax), italic "Creating the" + sans "unexpected" hero overlay, "Selected Projects" filter pills, gradient project cards. |
| 7 | igloo.inc | `igloo-inc.html` | Crypto/Web3 studio "Igloo Inc." with sci-fi HUD aesthetic — full-bleed snowy mountain landscape with SVG-constructed ice-block igloo dome and tunnel arch, animated shifting blocks, falling snow, four corner HUD overlays (pixelated "IGLOO" wordmark + ID panel / dark menu pill + telemetry grid / stat panel + build bar / globe icon) with live-updating frame counter. |

## Round 2 deliverables

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

### Round 3 (award batch C)

- **White-card carousel on basic-dept.html** — the white "browser" card centered on a slate-blue page auto-rotates through KFC / Google Store / Wilson / Patagonia case studies; each slide is a clean, generic recreation of the brand chrome (logo wordmark + product chip + gradient plate where the photo would be).
- **50/50 hero with massive black type on akaru.html** — a print-book-feeling split hero with Archivo Black "AKARU" wordmark on cream + a 2×2 pastel color-stripe thumbnail collage on the right; full-bleed case study panels for bomo / Orlinski / Pikko with category tags and rotating circular arrow CTAs.
- **Bobbing lime shield + Leroux 2022 banner on wokine.html** — CSS-only shield with a slow bob/rotate animation, full-bleed peach Leroux case with stubbed jars and giant serif "2022" year, rotating-words "Nos Expertises" stack that slides the active word up and brings the next one in.
- **Floating pill nav + cycling phone plates on fireart.html** — a centered floating pill nav holds six menu items with chevrons; the hero phone mockup crossfades between three different "app screens" via JS; leather-orange hero with SVG noise overlay.
- **Green pill CTA + scrolling accolades marquee on lazarev.html** — massive Fraunces headline on pure black with a single bright green "LET'S TALK" pill; accolades marquee scrolls under the hero; partnership manifesto + services cards + dense categorized footer.
- **Pastel pink dreamscape with parallax on unseen-studio.html** — layered CSS+SVG composition of mountains, arches, pool, sphere, stairs — each element reacts to mouse position with subtle parallax; italic Cormorant Garamond "Creating the" + sans "unexpected" hero overlay.
- **Sci-fi HUD over icy igloo on igloo-inc.html** — full-bleed snowy mountain landscape with an SVG-constructed ice-block igloo (dome + tunnel arch); subtle animation shifts the blocks like the original Three.js scene; four corner HUD overlays (pixelated "IGLOO" wordmark + ID panel / dark menu pill + telemetry grid / stat panel + build bar / globe icon) with a live-updating frame counter.

### Round 2

- **WebGL centerpiece on alche.studio** — stretched octahedron with a noise-displaced vertex shader, fresnel-driven rim highlight, real material/quaternion widgets driving uniforms in real time.
- **Scroll-driven case studies on cappen.com** — six full case studies with scroll-reveal, parallax plates, and an award marquee that captures the "we ship work" energy of an Awwwards-tier studio.
- **Per-tile palette rotation on brandappart.com** — every featured-work tile carries its own accent variable (lime / coral / lilac / mint / sun / ink / cyan) so the grid reads as a curated mood-board, not a uniform list.
- **Tab system + BGM player on 109ichiki.html** — radio-button tabs with smooth panel transitions, faux BGM controls with a moving progress bar, mosaic profile tile.
- **Type-as-imagery on bychudy.com** — the live site is photography-heavy; the brief forbade brand assets, so the project names themselves become the visual centerpiece, set in Fraunces at 7vw with italic accents.
- **Motion reveal on wearestokt.com** — letter-by-letter reveal of the mission line on scroll-into-view, plus a Three.js icosahedron with custom shader breathing behind the hero type.

Full rules: [`../README.md`](../README.md) · [`../AGENTS.md`](../AGENTS.md)
