/**
 * Open-license font catalog + on-demand loader.
 *
 * Pure data + a headless loader that injects the provider stylesheet
 * (e.g. Google Fonts `css2`) into `document.head` the first time a
 * family is requested. No UI, no bundled font binaries, no network
 * call from Node — the catalog is the source of truth.
 *
 * MIT — RHOBEAR Designs (original)
 */

import catalogData from './catalog.json' with { type: 'json' };

/** The raw catalog array, as imported from catalog.json. */
const catalog = catalogData;

/** CSS fallback chains per category, in CSS-priority order. */
const FALLBACKS = Object.freeze({
  sans:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif:
    'Georgia, "Times New Roman", Times, serif',
  display:
    'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif',
  mono:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  handwriting: 'cursive',
});

/** Categories the catalog is curated around. */
export const CATEGORIES = Object.freeze(Object.keys(FALLBACKS));

/** Named export of the raw catalog array. */
export { catalog };

/** Frozen, defensive copy of the raw catalog. */
export const FONT_CATALOG = Object.freeze(catalog.slice());

/** Family names already injected into the current document. */
const loaded = new Set();

/** Find a catalog entry by exact family name. */
function findEntry(family) {
  if (typeof family !== 'string' || family.length === 0) return null;
  for (const entry of catalog) {
    if (entry.family === family) return entry;
  }
  return null;
}

/**
 * List catalog entries. With no argument, returns every entry.
 * With a category, returns only entries in that category.
 *
 * Always returns a fresh array; mutating it is safe.
 */
export function listFonts(category) {
  if (!category) return catalog.slice();
  return catalog.filter((f) => f.category === category);
}

/**
 * Look up a single font entry by exact family name.
 * Returns the entry object, or `null` if not in the catalog.
 */
export function getFont(family) {
  return findEntry(family);
}

/**
 * Idempotently load a font's provider stylesheet into `document.head`.
 *
 * - Returns `false` if the family is not in the catalog, or if called
 *   in a non-browser environment (e.g. Node).
 * - Returns `true` if the stylesheet is already present (either from a
 *   prior call to `loadFont` or pre-existing in the DOM), or after a
 *   successful injection of a new `<link rel="stylesheet">`.
 *
 * The injected link is tagged with `data-rhobear-font="<family>"` for
 * later inspection. The stylesheet is only injected once per family.
 */
export function loadFont(family) {
  const entry = findEntry(family);
  if (!entry) return false;
  if (typeof document === 'undefined' || !document.head) return false;
  if (loaded.has(family)) return true;

  // Idempotency: even if a caller injected the same stylesheet manually
  // (or another module instance beat us to it), treat it as loaded.
  for (const link of document.head.querySelectorAll('link')) {
    if (link.href === entry.cssUrl) {
      loaded.add(family);
      return true;
    }
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = entry.cssUrl;
  link.dataset.rhobearFont = family;
  document.head.appendChild(link);
  loaded.add(family);
  return true;
}

/**
 * Return a CSS-ready `font-family` value: the family (quoted if it
 * contains whitespace) followed by a category-appropriate fallback
 * chain. Returns `null` for unknown families.
 *
 * @example
 *   fontStack('Inter')         // 'Inter, system-ui, ...'
 *   fontStack('DM Sans')       // '"DM Sans", system-ui, ...'
 *   fontStack('JetBrains Mono')// '"JetBrains Mono", ui-monospace, ...'
 */
export function fontStack(family) {
  const entry = findEntry(family);
  if (!entry) return null;
  const fallback = FALLBACKS[entry.category] || FALLBACKS.sans;
  const quoted = /[\s"']/.test(entry.family) ? `"${entry.family}"` : entry.family;
  return `${quoted}, ${fallback}`;
}

/**
 * Default export: the raw catalog array. Prefer the named exports
 * (`catalog`, `listFonts`, `getFont`, `loadFont`, `fontStack`) for app code.
 */
export default catalog;
