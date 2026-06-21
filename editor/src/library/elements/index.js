/**
 * @file Element library loader — headless, dependency-free.
 *
 *       Reads the committed `manifest.json` and exposes a tiny read API
 *       so the editor (or any lane's consumer) can list categories,
 *       filter by category, and look up individual snippets by id.
 *
 *       No UI, no DOM, no styles, no React. Pure data lookup. Safe to
 *       import from Node, the browser, and workers alike.
 *
 *       Contract:
 *         listCategories()
 *           → string[] of category names, in canonical order.
 *
 *         listElements(category?)
 *           → Element[] (or Element[] filtered to one category).
 *
 *         getElement(id)
 *           → Element | null
 *
 *       `Element` shape (see `dissect.mjs` for how these are produced):
 *         {
 *           id: string,         // unique, e.g. "109ichiki-nav-00"
 *           category: string,   // "nav", "hero", ...
 *           name: string,       // human-friendly label
 *           tags: string[],     // short tag set for filtering
 *           html: string,       // self-contained markup, all classes
 *           //                    prefixed with "el-<id>-" so it can't
 *           //                    collide with page chrome.
 *           css: string,        // matching scoped CSS (with :root vars
 *           //                    inlined for self-contained render).
 *           source: string,     // sample filename
 *         }
 *
 *       The manifest file is read from disk on first call (and cached
 *       module-singleton) — we don't care about hot-reload semantics
 *       because the editor builds once and ships the data.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Path resolution — find `manifest.json` next to this file at runtime.
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, 'manifest.json');

// ---------------------------------------------------------------------------
// Singleton cache
// ---------------------------------------------------------------------------

let _cache = null;

/**
 * Load and parse `manifest.json`, with a module-level cache. Returns an
 * array of element objects (always non-null — a missing/broken manifest
 * throws, because shipping an editor that silently degrades is worse
 * than a clear load failure).
 *
 * Exported so the tests can poke at the cache directly if they need to.
 *
 * @returns {Array<object>}
 */
export function loadManifest() {
  if (_cache) return _cache;
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[library/elements] manifest.json is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('[library/elements] manifest.json must be an array');
  }
  _cache = parsed;
  return _cache;
}

/**
 * Test-only: drop the singleton cache so a re-import of manifest.json
 * (e.g. after re-running `dissect.mjs`) is picked up.
 */
export function _resetManifestCache() {
  _cache = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Canonical category order. Must match the order `dissect.mjs` uses so
 * UIs that render a category grid get a stable, intuitive sequence.
 *
 * The 20 categories here are the full DoD-defined spread: the original
 * 12 (nav, hero, button, chip, card, badge, cta, section, footer, form,
 * gallery, testimonial) plus 8 added in the le2-stash-expand lane
 * (pricing, faq, feature, stats, logos, contact, banner, divider).
 */
export const CATEGORIES = [
  // Original 12
  'nav',
  'hero',
  'button',
  'chip',
  'card',
  'badge',
  'cta',
  'section',
  'footer',
  'form',
  'gallery',
  'testimonial',
  // Added in le2-stash-expand
  'pricing',
  'faq',
  'feature',
  'stats',
  'logos',
  'contact',
  'banner',
  'divider',
];

/**
 * Return every category name, in canonical order.
 *
 * @returns {string[]}
 */
export function listCategories() {
  return [...CATEGORIES];
}

/**
 * Return all elements, optionally filtered to one category.
 *
 * @param {string} [category] — if provided, return only elements with
 *                              matching `category`. Unknown categories
 *                              yield an empty array (not an error) so
 *                              callers can pass user-typed input safely.
 * @returns {Array<object>}
 */
export function listElements(category) {
  const all = loadManifest();
  if (category == null || category === '') return [...all];
  return all.filter((s) => s && s.category === category);
}

/**
 * Look up a single element by id. Returns null if no match (the editor
 * can use null to mean "deleted / renamed").
 *
 * @param {string} id
 * @returns {object | null}
 */
export function getElement(id) {
  if (typeof id !== 'string' || id === '') return null;
  const all = loadManifest();
  return all.find((s) => s && s.id === id) ?? null;
}