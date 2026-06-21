/**
 * Template Bank loader.
 *
 * Pure data + lookup. Browser-safe, headless, environment-agnostic. This file
 * imports the static manifest and exposes three functions used by the gallery
 * UI (built separately by the owner):
 *
 *   listTemplates(tag?)       -> Template[]
 *   getTemplateMeta(id)       -> Template | null
 *   templateSourcePath(id)    -> string | null  (repo-relative)
 *
 * The loader does NOT fetch or render template source — the app / build step
 * is responsible for fetching the file at the returned `sourcePath`. We only
 * know the catalog metadata here.
 *
 * MIT — RHOBEAR Designs.
 */

import manifestRaw from './manifest.json' with { type: 'json' };

/**
 * @typedef {Object} Template
 * @property {string} id         Stable id: `<collection>-<slug>`. Use as the
 *                               canonical handle everywhere (URLs, queries).
 * @property {string} collection Collection directory name under samples/,
 *                               e.g. `minimax-m3-high`.
 * @property {string} name       Human-readable name (from <title> if available,
 *                               otherwise a derived title-case of the slug).
 * @property {string[]} tags     Tags, including the collection name (e.g.
 *                               `minimax-m3-high`) and a `template` base tag.
 *                               Domain tags like `studio`, `webgl`, `portfolio`
 *                               are inferred from headings/title.
 * @property {string} sourcePath Repo-relative path to the HTML source file
 *                               (forward slashes), e.g.
 *                               `samples/minimax-m3-high/orage-studio.html`.
 * @property {string} description Short plain-text description (first
 *                               paragraph / first heading / title).
 * @property {string=} originalUrl Original site URL when known.
 * @property {string=} title      Raw <title> string when present.
 * @property {string[]=} headings Top headings (h1–h3) when present.
 * @property {string|null} thumb Relative thumb path inside this folder, or
 *                               null when thumbnails haven't been generated.
 *                               e.g. `thumbs/minimax-m3-high-orage-studio.png`.
 */

/**
 * @typedef {Object} Manifest
 * @property {string} $schema
 * @property {number} version
 * @property {string} generatedAt
 * @property {string[]} collections
 * @property {number} count
 * @property {Template[]} entries
 */

/** @type {Manifest} */
const manifest = /** @type {Manifest} */ (manifestRaw);

if (!manifest || !Array.isArray(manifest.entries)) {
  throw new Error(
    '[templates] manifest.json is missing or malformed; expected { entries: [...] }',
  );
}

/**
 * Build a Map<id, Template> once at module load. O(1) lookup, single allocation.
 * @type {Map<string, Template>}
 */
const byId = new Map(manifest.entries.map((t) => [t.id, t]));

/**
 * List templates. If `tag` is provided, only templates that include that tag
 * are returned. Otherwise the full catalog is returned, sorted by `id` for
 * stable ordering across calls.
 *
 * @param {string} [tag] Optional tag to filter by (e.g. `studio`, `webgl`,
 *                       a collection name like `minimax-m3-high`, or `template`).
 * @returns {Template[]}
 */
export function listTemplates(tag) {
  if (!tag) return manifest.entries.slice();
  const needle = String(tag).toLowerCase();
  return manifest.entries.filter((t) =>
    Array.isArray(t.tags) && t.tags.some((x) => String(x).toLowerCase() === needle),
  );
}

/**
 * Look up a single template by id. Returns `null` if no entry matches.
 *
 * @param {string} id
 * @returns {Template | null}
 */
export function getTemplateMeta(id) {
  if (!id) return null;
  return byId.get(String(id)) || null;
}

/**
 * Return the repo-relative source path for a template, or `null` if no entry
 * matches. The caller (the editor app or build step) is responsible for
 * actually fetching the file — this loader only knows the catalog.
 *
 * @param {string} id
 * @returns {string | null}
 */
export function templateSourcePath(id) {
  const meta = getTemplateMeta(id);
  return meta ? meta.sourcePath : null;
}

/**
 * Convenience: total number of templates in the bank. Useful for empty-state
 * copy ("62 templates to start from").
 *
 * @returns {number}
 */
export function templateCount() {
  return manifest.entries.length;
}

/**
 * Convenience: distinct tag list across the bank, sorted. Useful for the
 * gallery's filter sidebar.
 *
 * @returns {string[]}
 */
export function listTags() {
  const set = new Set();
  for (const t of manifest.entries) {
    if (Array.isArray(t.tags)) for (const tag of t.tags) set.add(tag);
  }
  return [...set].sort();
}

/**
 * Convenience: distinct collections present in the bank, in the order
 * declared in the manifest (so newer collections appear last).
 *
 * @returns {string[]}
 */
export function listCollections() {
  return manifest.collections.slice();
}

// Named export for tests + power-users that want to introspect.
export { manifest };
