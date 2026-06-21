# an1-pattern-analysis — Template interaction patterns + simplest editor tools

> Analysis only. No editor code changes. New files only under `editor/src/library/patterns/`.

## 1. Sample set

* `samples/minimax-m3-high/*.html` — **65 templates** scanned (the full MiniMax M3
  High set, recreated from Awwwards-tier agencies).
* Each template is one self-contained HTML file (Tailwind via CDN + Three.js via
  CDN, no build step). All numbers below come from `patterns.json` produced by
  `editor/src/library/patterns/analysis.mjs`.

## 2. Headline findings — what the templates actually do

| Technique                                  | Templates | Notes |
| ------------------------------------------ | --------: | ----- |
| `IntersectionObserver` (scroll-reveal)     | **36 / 65** | Dominant reveal pattern. Class toggle on `isIntersecting` — `threshold` mostly 0.10–0.18, often `rootMargin: 0px 0px -60px 0px`. |
| **Three.js / WebGL**                       | **25 / 65** | The single biggest "complex" feature. 19 use `WebGLRenderer`, 17 use `<canvas>`, 14 set `roughness`, 7 do explicit `rotation.y += …` spin. |
| **Parallax via `transform` on scroll**     | **23 / 65** | Plain DOM `translateY(...)` updated from a `requestAnimationFrame` loop, often reading `dataset.speed`. |
| CSS `scroll-behavior: smooth`              | 17 / 65 | Already handles nav-anchor scrolling in most templates — no JS needed. |
| GSAP `ScrollTrigger`                       | 12 / 65 | 11 also load `gsap.min.js` CDN. Used for scrub-linked transforms and `from(...)` reveals. |
| `position: sticky`                         | 9 / 65 | Almost always the top nav; sometimes sticky panels inside a `100vh` slot. |
| Raw `window` scroll listener               | 7 / 65 | Drives background-color scroll-shift (locomotive), scroll-progress bars (cappen), and the parallax loop. |
| `lenis` / `locomotive-scroll` / `data-scroll` | 3 / 65 (Lenis only — 0 real locomotive) | Live sites use Lenis heavily; the recreated samples fake it with `scroll-behavior: smooth`. |
| JS `scrollIntoView({behavior:'smooth'})`   | 3 / 65 | Only when authors want per-link control on top of CSS smooth scroll. |
| AOS / `data-aos`                           | **0 / 65** | Not used. |
| CSS scroll-driven (`animation-timeline` / `scroll()`) | **0 / 65** | Not used yet. |
| `locomotive-scroll` script                 | **0 / 65** | Commented out / faked. |

### 3D breakdown (the 25 three-using templates)

* **Loaders** — split almost evenly: 10 use an importmap + `unpkg three.module`, 7
  pull `three.min.js` from `cdnjs` (mostly r128 / r134), 2 use jsdelivr, 6 are
  unknown loader (string match caught them in comments / `console.log`). The
  editor should standardize on one — recommend the importmap form because it
  lets us lazily inject `three/addons/...` only when needed.
* **Geometries** — `BoxGeometry` (20) is the single most common (cubes / cross
  arms), then `IcosahedronGeometry` (14), `SphereGeometry` (13), `BufferGeometry`
  (12, mostly particle fields), `TorusGeometry` (10), `PlaneGeometry` (10),
  `CylinderGeometry` (10), `TorusKnotGeometry` (2).
* **Materials** — `MeshStandardMaterial` (52) dominates, then `MeshBasicMaterial`
  (15, often for unlit overlays / debug). Only 2 use `MeshPhysicalMaterial`
  (Lusion). Zero use `ShaderMaterial`.
* **Lights** — `DirectionalLight` (33) + `AmbientLight` (16) covers 100%. A
  handful go further with `RoomEnvironment` + `PMREMGenerator` (Lusion, makemepulse).
* **Spin** — 7 templates drive the scene with `rotation.x/y +=` per frame
  (lusion: `crosses.rotation.y += 0.0015;`, joseph-san: `cube.rotation.y +=
  dt * 0.4;`, lisovskiy: `root.rotation.y += baseSpin + boost;`, madebynull:
  particle field, portalone-studio: stars). **No template uses
  `controls.autoRotate`** — they all do their own simple `rotation +=` because
  it's cheaper than OrbitControls and doesn't require user interaction.
* **Roughness / metalness** — 14 templates set `roughness:` directly. Almost
  every material is in the 0.18–0.50 range; a few go matte (`roughness: 1.0`)
  for `BackSide` backgrounds.

### Link / anchor breakdown

* 40 / 65 templates contain `href="#…"` (208 anchors total).
* Top offenders: `ragged-edge` (13), `jensbosman-nl` (12), `caffe-design` and
  `eduard-bodak` (10 each), `brand-appart` (9).
* 19 / 65 already smooth-scroll — 17 via pure CSS, 3 via JS. **That means for
  the majority of templates a single editor toggle that adds
  `html{scroll-behavior:smooth}` is enough.**

### Structure breakdown

* `<header>` — 38 / 65 (often doubled as the top nav row).
* `<nav>` — 45 / 65 (semantic nav tags are widespread).
* `<footer>` — 48 / 65 (footer is near-universal).
* `<main>` — **only 3 / 65** (the templates don't bother — almost every section
  is a `<section>` directly under `<body>` or a wrapper `<div>`).

### Library fingerprint

| Lib                  | Count | Notes |
| -------------------- | ----: | ----- |
| Tailwind via CDN     | 48 | Almost universal. The editor must coexist with it. |
| Three.js             | 25 | See above. |
| GSAP + ScrollTrigger | 12 / 11 | The "fancy" templates. |
| Lenis                | 3 | Comments-only in the recreated samples. |
| jQuery               | 1 | One legacy artifact. |

## 3. The recommendation — simplicity-first editor tools

The principle: **the smallest runtime that lets a non-coder toggle the dominant
pattern**. We don't need to ship GSAP. We don't need to ship Lenis. We need
four small runtimes.

### Tool A — Scroll reveal (`rb-reveal.js`, ~1 KB)

**Why.** 36 / 65 templates use IntersectionObserver; another 12 use GSAP
`ScrollTrigger` mostly to do the same thing. Both end with the same effect:
"this element was hidden, then `is-in` flipped to true and CSS faded/slid it
in."

**What the editor should expose.**
* A *Reveal* panel on any selected element with two controls:
  * `Reveal on scroll` — checkbox. When on, the editor stamps
    `data-rb-reveal="fade-up"` on the element and pulls in a stylesheet.
  * `Effect` — radio: `fade` / `fade-up` / `fade-left` / `fade-zoom`.
* A "Stagger" numeric field when the parent has multiple selected children —
  reads `data-rb-reveal-stagger` on the parent (mirrors the 60 ms cadence from
  `lusion.html`'s card grid).

**Runtime contract** — single attribute, no JS to write.
```html
<section data-rb-reveal="fade-up" data-rb-reveal-stagger="60">
  <h2 …>Bold Ideas</h2>
  <p …>…</p>
</section>
```
A 1 KB script attaches one IntersectionObserver at document level, toggles
`.is-in` when intersecting, and a CSS file ships the four effects.

**Why this beats "use IntersectionObserver directly".** A non-coder can't write
the IO. A non-coder can flip a checkbox.

**Why this beats "ship GSAP".** GSAP `ScrollTrigger.min.js` is ~50 KB.
`rb-reveal.js` is ~1 KB and covers 36 + ~half of the 12 GSAP templates.

### Tool B — Parallax / sticky (`rb-scroll-effects.js`, ~1.5 KB)

**Why.** 23 templates use scroll-driven `translateY`; 9 use `position: sticky`;
7 bind a raw `window` scroll listener for color shift or progress. Three
different patterns, one shared runtime.

**Three sub-tools — one attribute family.**
1. **Parallax** — `data-rb-parallax="0.04"` on any element (the 0.04 mirrors the
   `data-speed="0.04"` default in `cappen.html`'s parallax loop). The runtime
   uses `IntersectionObserver` to enable / disable a `requestAnimationFrame`
   loop only while the element is in view.
2. **Sticky** — `data-rb-sticky="top:0"` on any block. The runtime adds
   `position: sticky; top: 0;` and exposes the standard `top` value via a
   numeric input. Mirrors the 9 templates that hand-write `position: sticky`.
3. **Scroll color shift / progress** — `data-rb-scroll-color="var(--bg-red) ->
   var(--bg-blue)"` and `data-rb-scroll-progress="#progress"` on a 2 px bar.
   Both are derived directly from `locomotive.html` and `cappen.html`.

**One runtime handles all three** because they share a single `scroll` source
and a single RAF loop — see below.

```html
<div class="plate" data-rb-parallax="0.04">…</div>
<header class="nav" data-rb-sticky="top:0">…</header>
<div class="progress" id="progress" data-rb-scroll-progress></div>
```

### Tool C — 3D rotate / roughness / spin (`rb-three-control.js`, ~3 KB)

**Why.** 25 templates use Three.js. 14 set `roughness`, 7 do `rotation.y +=`,
zero use `autoRotate`. The editors surface for "3D" today is hidden inside
arbitrary JS — a non-coder has no chance.

**Two pieces, separable.**

1. **Material sliders** — `rb-three-control.js` patches the three.js prototype
   once at load time:
   ```js
   const _orig = THREE.MeshStandardMaterial.prototype.constructor;
   THREE.MeshStandardMaterial = function(opts = {}) {
     opts.roughness ??= 0.35;
     opts.metalness ??= 0.0;
     return _orig.call(this, opts);
   };
   ```
   Then in the editor the user sees two sliders (`Roughness`, `Metalness`)
   bound to the selected mesh's material via `data-rb-roughness` /
   `data-rb-metalness` attributes. The runtime reads them after material
   construction and reapplies them — covers 14 templates.

2. **Auto-spin** — covers the 7 templates that do `rotation.y +=`. The simplest
   primitive the editor can expose:
   ```html
   <div data-rb-three-root>
     <canvas …></canvas>
   </div>
   ```
   Editor panel exposes:
   * `Spin X / Y / Z` — three number inputs (radians per frame, default 0.005).
   * `Idle drift` — checkbox. When on, applies a tiny `Math.sin(time)` to
     `position.y` (this is the "pile drifts slowly" feel from lusion).

   The runtime ships a tiny `requestAnimationFrame` driver that mirrors
   `lusion.html`'s `tick()` loop — six lines of code. We do **not** need
   `OrbitControls` (used by only 2 templates) or `autoRotate` (used by 0).

**Loader normalization** — pick one. Recommended: the importmap form, like
`lusion.html` already does, because it lets the editor lazy-load
`three/addons/environments/RoomEnvironment.js` only when the user adds an
environment to a scene. Saves 6 / 25 templates from shipping a heavier build.

### Tool D — In-page link targeting + smooth scroll (no new runtime)

**Why.** 40 / 65 templates use anchors; 19 already smooth-scroll. The editor
should not need a runtime here.

**Two editor-level actions.**
1. **Set anchor on a section** — "Use as link target" toggle in the section
   panel. Writes `id="<slug>"` (auto from heading text) and reveals a copyable
   URL `…#<slug>` in the link picker.
2. **Smooth scroll toggle** — project-level checkbox. When on, the editor
   inlines one line into the project's `<style>`:
   `html{scroll-behavior:smooth}`. That single line covers 17/65 templates
   with zero JS.

**For the 3 templates that hand-roll JS smooth-scroll** (des-obys,
jensbosman-nl, etc.), the editor can offer a one-line snippet under "Custom
code":
```js
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth',block:'start'});
}));
```
Verbatim from `des-obys.html` line 372. Don't reinvent it.

### Tool E — Header / nav / footer / main insertion (no runtime, structural)

**Why.** 45/65 have `<nav>`, 48/65 have `<footer>`, 38/65 have `<header>`,
only 3 have `<main>`. The gap is `<main>`. The editor should make it trivial
to drop these in.

**Editor menu additions.**
* `Insert → Header` — drops a `<header>` with a default top-nav row (logo +
  three placeholder links + a "let's talk" pill). Mirrors the structure of
  lusion.html's `<header class="nav">`.
* `Insert → Nav` — standalone semantic `<nav>` with optional pill styling.
* `Insert → Footer` — three-column footer (Studio / Social / Newsletter) with
  the same email-form pattern from `lusion.html`. This is the most-replicated
  footer in the set.
* `Insert → Main wrapper` — wraps the current selection in `<main>`. The
  templates don't use it but the editor should encourage it (better outline,
  better a11y, same zero-runtime cost).

Each insert is purely structural — no new JS. Color/spacing tweaks come from
the existing style panel.

## 4. Where a small reusable runtime is worth building

| Runtime | Size target | Files covered (out of 65) | Replaces |
| ------- | ----------- | ------------------------- | -------- |
| `rb-reveal.js` | ~1 KB | 36 + ~6 GSAP | IntersectionObserver snippet + GSAP `from()` reveal |
| `rb-scroll-effects.js` | ~1.5 KB | 23 + 9 + 7 = 39 | Parallax loops + sticky + raw scroll listeners |
| `rb-three-control.js` | ~3 KB | 25 (material params + spin) | Per-template three.js boilerplate |
| (no runtime) | — | 19 (smooth scroll) + 45 (nav/footer) | `scroll-behavior: smooth` + structural inserts |

Combined: ~5.5 KB covers **~55 of 65 templates** with a single runtime per
concern, no GSAP, no Lenis. The remaining 10 templates are either highly
custom (jensbosman-nl's Barba transitions, locomotive's exact red→blue color
formula) or one-offs that already include their own JS.

## 5. Out-of-scope / explicitly NOT recommended

* **Do not ship GSAP.** 50 KB for what 1 KB of IntersectionObserver does. We
  treat the 12 GSAP templates as power-user opt-in via the existing "Custom
  code" panel.
* **Do not ship Lenis / Locomotive.** Zero real `locomotive-scroll` scripts in
  the sample set. CSS smooth scroll + one-line JS already covers the use case.
* **Do not ship `OrbitControls`.** Used by 2 templates. The 7 `rotation.y +=`
  patterns are not asking for OrbitControls; they're asking for "spin slowly".
  We expose that primitive directly.
* **Do not chase CSS scroll-driven animations.** 0 / 65 templates use them. Not
  worth the cross-browser surface yet — re-evaluate once Safari coverage is
  universal.
* **Do not require `<main>`.** Only 3 / 65 templates have it. Structural
  insertion should be encouraged but never forced.

## 6. Verification — how to use these files

```bash
cd editor
node src/library/patterns/analysis.mjs   # re-runs the scanner, rewrites patterns.json
```

`patterns.json` is the source of truth for the numbers above. `RECOMMENDATIONS.md`
(this file) is the human-readable "so what". The recommendations above would
each become a follow-up lane (`lane/an2-rb-reveal`, `lane/an3-rb-scroll-effects`,
`lane/an4-rb-three-control`) — but no UI / no editor-code changes happen in
this lane.