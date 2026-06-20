/**
 * @file Fidelity fixtures — small, REPRESENTATIVE set of real sample
 *       sites from `samples/minimax-m3-high/` (51 recreated portfolio
 *       sites) chosen to exercise the W2 engine end-to-end on the kinds
 *       of inputs real users will import.
 *
 *       Each fixture carries:
 *         - a stable `id` (the basename)
 *         - `path`     — absolute path to the raw HTML
 *         - `raw`      — UTF-8 contents (read once at module load)
 *         - `why`      — short human description of what characteristic
 *                        it represents
 *
 *       Resolved relative to THIS file (no dependency on CWD), so the
 *       suite works no matter where you `cd` from.
 *
 *       Picking a small set (4) keeps the suite fast while covering the
 *       four characteristics the prompt names:
 *
 *         1. `<canvas>` / WebGL — animated 3D content
 *         2. external `<link rel="stylesheet">` — external font / CSS
 *         3. `@keyframes` / CSS variables — animation-heavy styling
 *         4. "simple" — small, basic, baseline check
 *
 *       If a future sample reveals an honest engine gap, add it here as
 *       its own fixture and `test.todo` it in `fidelity.test.js` with a
 *       link to the documented gap. DO NOT hack the test to pass.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths — relative to THIS file, not to CWD.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = resolve(__dirname, '..', '..', '..', 'samples', 'minimax-m3-high');

/** Load one sample by basename. Throws a clear error if missing. */
function loadSample(basename) {
  const path = resolve(SAMPLES_DIR, basename);
  const raw = readFileSync(path, 'utf8');
  return { path, raw };
}

// ---------------------------------------------------------------------------
// Fixture set
// ---------------------------------------------------------------------------

/**
 * The fixture set. Each entry is `{ id, path, raw, why }`. The order is
 * stable so failures point at the same fixture each run.
 *
 * @type {Array<{id: string, path: string, raw: string, why: string, characteristics: string[]}>}
 */
export const FIXTURES = [
  {
    id: 't-ko-space.html',
    why: 'WebGL/canvas-heavy: 5 <canvas> + Three.js bundle. 0 <link> tags (fonts are CSS-loaded) — exercises the canvas/inline-script path with no external stylesheets.',
    characteristics: ['canvas', 'webgl', 'multiple-scripts', 'no-external-links'],
    ...loadSample('t-ko-space.html'),
  },
  {
    id: 'hnine-interaction.html',
    why: 'External stylesheet links: 4 <link> tags (2 preconnects + Google Fonts + jsdelivr/pretendard). 4 scripts (Tailwind CDN + 3 inline). 1 <canvas>. Exercises the stylesheet-link + cross-origin font loading path.',
    characteristics: ['external-link-stylesheet', 'multiple-scripts', 'preconnect', 'canvas'],
    ...loadSample('hnine-interaction.html'),
  },
  {
    id: 'samsy-ninja.html',
    why: '@keyframes + CSS variables: 6 @keyframes and 11 CSS var definitions (:root { --red: ... }). 0 <link> tags. Exercises the animation/var path through the live-render pipeline.',
    characteristics: ['keyframes', 'css-variables', 'no-external-links', 'inline-script-heavy'],
    ...loadSample('samsy-ninja.html'),
  },
  {
    id: 'cyphr-studio.html',
    why: '"Simple" baseline: smallest reasonable site, 2 scripts (Tailwind CDN + inline), 3 <link> tags (2 preconnects + Google Fonts), 1 inline <style> block. The smoke-test fixture.',
    characteristics: ['simple', 'external-link-stylesheet', 'mixed-scripts'],
    ...loadSample('cyphr-studio.html'),
  },
];

/**
 * Map of fixture id → fixture. Useful when picking a single fixture in
 * a focused test (`byId('cyphr-studio.html')`).
 *
 * @type {Record<string, (typeof FIXTURES)[number]>}
 */
export const FIXTURES_BY_ID = Object.fromEntries(FIXTURES.map((f) => [f.id, f]));