/**
 * @file Hardened import / export layer — supersedes the legacy
 *       `editor/src/lib/file-io.js` + `editor/src/lib/serializer.js` pair
 *       with a pure, dependency-free, lossless round-trip.
 *
 *       Four public functions, deliberately small and string-oriented so
 *       they are unit-testable in plain Node without any DOM / File API:
 *
 *         importHtml(rawHtml)
 *           Pure. Splits a raw HTML document into its preserved parts
 *           (body markup, concatenated CSS, script list, title, asset
 *           references) by delegating to live-render's regex-based
 *           `extractDocumentParts`. Output `html` keeps <script> tags
 *           inline; output `scripts` is the same array for callers that
 *           want to introspect or re-inject them.
 *
 *         importFolder(fileEntries, { entryText })
 *           Sync. Resolves a folder-like list of `{ path, getUrl() }`
 *           entries into a single `{ html, css, title, assetMap }`
 *           bundle. Picks an entry HTML by documented rules, builds an
 *           asset map from the non-HTML entries (relative-to-entry
 *           paths, with bare-basename aliases for backwards compat),
 *           rewrites refs via live-render.rewriteAssetUrls, then runs
 *           the result through `importHtml`.
 *
 *         exportHtml({ html, css, scripts? }, overrides?)
 *           Pure. Produces a clean standalone HTML document. If
 *           `overrides` is a non-empty override store (or a plain
 *           object snapshot), folds it via
 *           `diff-serializer.applyOverrides` (non-destructive: html is
 *           returned byte-equivalent, the override block is appended to
 *           the CSS). Inline + external <script> tags survive verbatim.
 *
 *         exportZip({ html, css, scripts?, assetMap? }, overrides?)
 *           Async, returns a Blob. Writes `index.html` + `styles.css`
 *           + `assets/...` into a JSZip archive. Browser-only `saveAs`
 *           is intentionally NOT called here — the caller decides how
 *           to persist the Blob. The function is testable in Node
 *           because the assetMap value is raw bytes (Uint8Array /
 *           string / Blob), not a URL that needs fetching.
 *
 *       Stability contract:
 *         - importHtml is pure: no DOM, no globals. Safe in Node,
 *           browser, worker.
 *         - importFolder is sync and pure given `entryText`. The
 *           `getUrl()` call is the only side-effecting hook, used
 *           solely to populate the asset map; tests can return any
 *           string.
 *         - exportHtml is pure string assembly. Safe in Node, browser,
 *           worker.
 *         - exportZip uses jszip only — no DOM, no fetch, no
 *           URL.createObjectURL. Safe in Node for unit tests.
 *
 *       Round-trip guarantee:
 *         `exportHtml(importHtml(x))` returns a document whose body
 *         markup and <script> tags preserve x (modulo a stable
 *         normalization: canonical doctype, viewport meta always
 *         present, scripts preserved verbatim, link href values
 *         carried over as @import lines in css).
 *
 *       Reuse, do NOT duplicate:
 *         - live-render.extractDocumentParts (HTML splitting)
 *         - live-render.rewriteAssetUrls     (folder-import ref rewriting)
 *         - live-render.buildLiveDocument    (clean-document assembly)
 *         - diff-serializer.applyOverrides   (override folding)
 *         - style-overrides.toStylesheet     (override block emission)
 */

import {
  buildLiveDocument,
  extractDocumentParts,
  rewriteAssetUrls,
} from './live-render.js';
import { applyOverrides } from './diff-serializer.js';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback title when a document has none. */
const DEFAULT_TITLE = 'Imported page';

/** Default title for exportHtml output. */
const DEFAULT_EXPORT_TITLE = 'Exported page';

/** Filename for the standalone CSS file in ZIP exports. */
const ZIP_STYLES_FILENAME = 'styles.css';

/** Filename for the standalone HTML file in ZIP exports. */
const ZIP_INDEX_FILENAME = 'index.html';

/** Sub-directory inside ZIP exports where binary assets live. */
const ZIP_ASSETS_DIR = 'assets';

// ---------------------------------------------------------------------------
// Small string helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe interpolation inside an HTML attribute value
 * wrapped in double quotes. The exporter uses this for the <title> tag
 * only; inline attribute values in user-supplied html/css are preserved
 * verbatim.
 * @param {unknown} s
 * @returns {string}
 */
function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Return the parent directory of a POSIX-style path (everything up to
 * and including the last `/`). Bare filenames return `''`.
 * @param {string} p
 * @returns {string}
 */
function parentDir(p) {
  if (typeof p !== 'string' || !p) return '';
  const idx = p.lastIndexOf('/');
  return idx === -1 ? '' : p.slice(0, idx + 1);
}

/**
 * Return the basename of a POSIX-style path (everything after the last
 * `/`). For `''` or no slash, returns the input itself.
 * @param {string} p
 * @returns {string}
 */
function basename(p) {
  if (typeof p !== 'string' || !p) return '';
  const idx = p.lastIndexOf('/');
  return idx === -1 ? p : p.slice(idx + 1);
}

/**
 * True iff `raw` is a relative-path asset reference we should record in
 * `assets` (i.e. not absolute, not a data/blob/mailto/tel/hash, not
 * protocol-relative). Used by importHtml to enumerate external refs.
 * @param {unknown} raw
 * @returns {boolean}
 */
function looksRelative(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  return !/^(https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(raw);
}

// ---------------------------------------------------------------------------
// Entry resolution + asset-map construction (folder import)
// ---------------------------------------------------------------------------

/**
 * Pick the entry HTML from a list of file entries. Resolution rules,
 * evaluated in order:
 *
 *   1. If there is exactly one `.html` / `.htm` entry, use it.
 *   2. If multiple, prefer the entry whose basename is `index.html` or
 *      `index.htm` (case-insensitive). If multiple candidates match,
 *      the one whose full path sorts first wins (lexicographic).
 *   3. Otherwise (multiple html entries, none named index.html), the
 *      first by lexicographic path wins. This is documented behaviour,
 *      not an error, because the caller may have a deliberate structure.
 *   4. If no html entry exists, throw an Error.
 *
 * The function is deterministic for a given input (alphabetical tie-
 * break), so test fixtures are reproducible.
 *
 * @param {Array<{path: string}>} fileEntries
 * @returns {{path: string}}
 */
function pickEntryHtml(fileEntries) {
  if (!Array.isArray(fileEntries) || fileEntries.length === 0) {
    throw new Error('importFolder: fileEntries is empty');
  }
  const htmlEntries = fileEntries
    .filter((e) => e && typeof e.path === 'string' && /\.(html?|HTML?)$/.test(e.path))
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  if (htmlEntries.length === 0) {
    const seen = fileEntries
      .map((e) => (e && typeof e.path === 'string') ? e.path : '<bad-entry>')
      .slice(0, 5)
      .join(', ');
    throw new Error(
      'importFolder: no .html file found in folder (entries: ' + seen + ')'
    );
  }
  if (htmlEntries.length === 1) return htmlEntries[0];

  // Multiple: prefer index.html / index.htm (case-insensitive basename).
  const idx = htmlEntries.find((e) => {
    const b = basename(e.path).toLowerCase();
    return b === 'index.html' || b === 'index.htm';
  });
  if (idx) return idx;

  // Fallback: first alphabetically.
  return htmlEntries[0];
}

/**
 * Build an assetMap from file entries, given the chosen entry HTML.
 *
 * For each non-HTML entry:
 *   - The primary key is the entry's path with the entry HTML's parent
 *     directory stripped. So `myfolder/assets/logo.png` (when entry is
 *     `myfolder/index.html`) becomes `assets/logo.png`.
 *   - For backwards compatibility with the legacy folder loader, the
 *     bare basename is also registered as a key. This lets the export
 *     reach `assets/images/foo.png` from an `<img src="foo.png">`
 *     reference when the source HTML used short names.
 *   - The value for each key is the result of `entry.getUrl()`.
 *
 * Duplicate keys resolve first-write-wins. We sort the input by path
 * so the output is deterministic for tests.
 *
 * @param {Array<{path: string, getUrl: () => string}>} fileEntries
 * @param {{path: string}} entry
 * @returns {Record<string, string>}
 */
function buildAssetMap(fileEntries, entry) {
  const base = parentDir(entry.path);
  const sorted = fileEntries
    .filter((e) => e && typeof e.path === 'string' && typeof e.getUrl === 'function')
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  /** @type {Record<string, string>} */
  const map = {};
  for (const e of sorted) {
    if (e.path === entry.path) continue;
    if (/\.(html?|HTML?)$/.test(e.path)) continue;
    let rel = e.path;
    if (base && rel.startsWith(base)) {
      rel = rel.slice(base.length);
    }
    let url = '';
    try { url = String(e.getUrl() || ''); } catch { url = ''; }
    if (!rel || !url) continue;
    if (!(rel in map)) map[rel] = url;
    const bn = basename(e.path);
    if (bn && bn !== rel && !(bn in map)) map[bn] = url;
  }
  return map;
}

// ---------------------------------------------------------------------------
// importHtml
// ---------------------------------------------------------------------------

/**
 * Import a single raw HTML document. Pure, string-level — uses the
 * dependency-free regex-based `extractDocumentParts` from live-render
 * to split the document into its preserved parts.
 *
 * Returned shape:
 *   {
 *     html:    string                  // body markup, scripts inline, verbatim
 *     css:     string                  // concatenated <style> contents
 *                                      // + @import lines for stylesheet links
 *     scripts: Array<ScriptPart>       // all <script> tags (head + body)
 *     title:   string|null             // <title> text, if any
 *     assets:  Record<string,string>   // relative-path → path (the same
 *                                      // string in both positions; this
 *                                      // shape lets folder-import extend
 *                                      // the value with a resolved URL
 *                                      // while leaving the keys identical)
 *   }
 *
 * Round-trip: `html` + `scripts` together preserve every script of the
 * input, in document order, with their original `src=` / inline content
 * intact.
 *
 * @param {string} rawHtml
 * @returns {{
 *   html: string,
 *   css: string,
 *   scripts: object[],
 *   title: string|null,
 *   assets: Record<string,string>
 * }}
 */
export function importHtml(rawHtml) {
  const src = String(rawHtml ?? '');
  const parts = extractDocumentParts(src);

  // CSS — concatenate <style> contents and stylesheet links as @import.
  // Order: head styles first (in document order), then body styles, then
  // stylesheet links. Mirrors how the legacy serializer worked, just
  // done with the regex parts we already extracted.
  /** @type {string[]} */
  const cssBlocks = [];
  for (const s of parts.styles) {
    if (s.content != null && String(s.content).length) {
      cssBlocks.push(String(s.content));
    }
  }
  for (const link of parts.links) {
    if (!link.attrs) continue;
    if (String(link.attrs.rel || '').toLowerCase() !== 'stylesheet') continue;
    const href = link.attrs.href;
    if (typeof href !== 'string' || !href) continue;
    cssBlocks.push(`@import url('${href}');`);
  }
  const css = cssBlocks.join('\n');

  // Body markup — verbatim, scripts inline.
  const html = parts.bodyHtml || '';

  // Asset references — relative paths we noticed but did not resolve.
  /** @type {Record<string,string>} */
  const assets = {};
  const push = (raw) => {
    if (!looksRelative(raw)) return;
    if (raw in assets) return;
    assets[raw] = raw;
  };
  for (const link of parts.links) push(link.attrs && link.attrs.href);
  for (const s of parts.scripts) push(s.src);
  // Inline <style> blocks don't usually need resolution (their content
  // is css), but image / font references inside them would be handled
  // downstream by the asset-map pass. We don't enumerate url() calls
  // here — that's a job for a CSS-aware pass that runs after the asset
  // map exists.

  return {
    html,
    css,
    scripts: parts.scripts || [],
    title: parts.title || null,
    assets,
  };
}

// ---------------------------------------------------------------------------
// importFolder
// ---------------------------------------------------------------------------

/**
 * Import a folder of files. `fileEntries` is the abstraction:
 *
 *   [{ path: string, getUrl: () => string }, ...]
 *
 * The caller supplies `getUrl` so production code can return
 * `URL.createObjectURL(file)` and test code can return a stub. The
 * function is sync given an explicit `entryText` option (tests); the
 * caller is responsible for reading the entry HTML's text in their
 * preferred async shape.
 *
 * Entry-resolution rules (see pickEntryHtml):
 *   1. If exactly one `.html` / `.htm` entry, use it.
 *   2. Otherwise prefer a basename of `index.html` / `index.htm`
 *      (case-insensitive). On multiple matches the lexicographically
 *      first path wins.
 *   3. Otherwise the first by lexicographic path wins.
 *   4. If no HTML entry exists, throw an Error.
 *
 * Asset-map construction (see buildAssetMap):
 *   - For each non-HTML entry, the primary key is the entry's path with
 *     the entry HTML's parent directory stripped.
 *   - The bare basename is also registered as a key (legacy
 *     compatibility).
 *   - Value = `entry.getUrl()`. Tests can return any string.
 *
 * Reference rewriting:
 *   - The entry HTML text (passed via `opts.entryText`) is run through
 *     `live-render.rewriteAssetUrls` against the asset map.
 *   - Inline <script> bodies are NOT rewritten — only the `src=` of
 *     external scripts and attribute / url() / srcset references in the
 *     rest of the document.
 *
 * @param {Array<{path: string, getUrl: () => string}>} fileEntries
 * @param {{entryText?: string}} [opts]
 * @returns {{html: string, css: string, title: string|null, assetMap: Record<string,string>}}
 */
export function importFolder(fileEntries, opts) {
  const entry = pickEntryHtml(fileEntries);
  const assetMap = buildAssetMap(fileEntries, entry);

  const entryText = (opts && typeof opts.entryText === 'string')
    ? opts.entryText
    : '';

  if (!entryText) {
    // No entry text supplied — return the assetMap (so callers can
    // re-run after reading the file) plus a stub html/css. We do not
    // throw, because the caller may legitimately want the assetMap in
    // isolation (e.g. to populate it for a separate document).
    return { html: '', css: '', title: null, assetMap };
  }

  // Step 1 — rewrite references in the entry HTML against the map.
  const rewritten = rewriteAssetUrls(entryText, assetMap);

  // Step 2 — split the rewritten entry into parts via importHtml.
  const parsed = importHtml(rewritten);

  return {
    html: parsed.html,
    css: parsed.css,
    title: parsed.title,
    assetMap,
  };
}

// ---------------------------------------------------------------------------
// exportHtml
// ---------------------------------------------------------------------------

/**
 * Normalize an `overrides` argument into either an override store with
 * a `toJSON()` method, or `null`. Accepts:
 *   - null / undefined → null
 *   - any object that exposes `toJSON()` → returned as-is (treated as
 *     a store)
 *   - a plain object snapshot → wrapped via createOverrideStore +
 *     fromJSON so downstream `applyOverrides` accepts it
 *
 * The wrap is intentionally defensive: callers may pass either a live
 * store or a JSON snapshot.
 *
 * @param {unknown} overrides
 * @returns {object|null}
 */
function normalizeOverrides(overrides) {
  if (overrides == null) return null;
  if (typeof overrides !== 'object') return null;
  if (typeof overrides.toJSON === 'function') return overrides;
  // Treat as a plain JSON snapshot — wrap it. Avoid a circular
  // import of style-overrides.js by using dynamic import? No — we
  // want this to remain sync. Inline a tiny createOverrideStore shim
  // that does not depend on style-overrides here, then let
  // applyOverrides call `toStylesheet` on the store. The shim only
  // needs toJSON(); the rest of the store API is unused.
  const store = {
    _data: overrides || {},
    toJSON() { return this._data; },
    // The next two are read by applyOverrides via toStylesheet; we
    // can't avoid the dependency here without duplicating logic.
    // Instead, use createOverrideStore dynamically only if needed.
  };
  // Fast path: fall through to dynamic import? No — exportHtml must
  // remain sync. Re-implement the small surface applyOverrides needs.
  store.getSelectors = function () { return Object.keys(this._data || {}); };
  store.getOverridesFor = function (sel) {
    const m = (this._data || {})[sel];
    return (m && typeof m === 'object') ? m : {};
  };
  return store;
}

/**
 * Assemble the body markup for export. If `scripts` is provided AND
 * its raw text is not already present in `html`, append the raw text
 * of each script at the end of the body so the wrapper can re-extract
 * them as body-resident scripts. If they are already in `html`, the
 * existing positions are preserved.
 *
 * @param {string} html
 * @param {object[]|undefined} scripts
 * @returns {string}
 */
function assembleBodyWithScripts(html, scripts) {
  let body = String(html || '');
  if (!Array.isArray(scripts) || scripts.length === 0) return body;
  // Detect scripts already present in body (cheap substring check on
  // the opening tag, since each script's `raw` is the full
  // <script ...>...</script>).
  const missing = [];
  for (const s of scripts) {
    if (!s || typeof s.raw !== 'string') continue;
    if (body.indexOf(s.raw) !== -1) continue;
    missing.push(s);
  }
  if (missing.length === 0) return body;
  const sep = body.length && !body.endsWith('\n') ? '\n' : '';
  body = body + sep + missing.map((s) => s.raw).join('\n');
  return body;
}

/**
 * Export a clean standalone HTML document. Uses `buildLiveDocument`
 * from live-render for the shell assembly; that function already
 * handles scripts, stylesheets, the title, viewport meta, and doctype.
 *
 * Folding:
 *   - If `overrides` is a non-empty override store (or a plain object
 *     snapshot), `applyOverrides` is invoked first. It is byte-safe for
 *     `html` (scripts preserved verbatim) and appends an override block
 *     to `css` so the override rules win ties at equal specificity.
 *   - If the override store has no entries, the output is byte-
 *     equivalent to a no-op pass.
 *
 * Scripts:
 *   - `html` is expected to already contain <script> tags. They survive
 *     verbatim through `buildLiveDocument` because extractDocumentParts
 *     keeps them in place.
 *   - If an explicit `scripts` array is supplied, any script whose raw
 *     text is not already in `html` is appended to the body so it is
 *     preserved too.
 *
 * Title:
 *   - If `title` is supplied, it is used as the document's <title>.
 *     This is the canonical way to round-trip a title through the
 *     pipeline: pass `importHtml(x).title` back into exportHtml.
 *   - If `title` is not supplied, the constant fallback
 *     `DEFAULT_EXPORT_TITLE` is used.
 *
 * Reuse: the body-level markup is the string the caller supplied; the
 * document model / core serializer is not involved here (it is for tree
 * round-trips, not raw-HTML export). Core's `serialize(doc)` is what
 * callers would use to turn a document model into the html/css input
 * this function expects.
 *
 * @param {{html?: string, css?: string, scripts?: object[], title?: string}} input
 * @param {object} [overrides]  override store or plain JSON snapshot
 * @returns {string}            complete HTML document
 */
export function exportHtml(input, overrides) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const html = typeof safeInput.html === 'string' ? safeInput.html : '';
  const css = typeof safeInput.css === 'string' ? safeInput.css : '';
  const scripts = Array.isArray(safeInput.scripts) ? safeInput.scripts : undefined;
  const title = typeof safeInput.title === 'string' && safeInput.title
    ? safeInput.title
    : DEFAULT_EXPORT_TITLE;

  // Fold overrides (non-destructive). html is returned byte-equivalent;
  // css gets an appended override block.
  const store = normalizeOverrides(overrides);
  const folded = store ? applyOverrides({ html, css }, store) : { html, css };

  // Inject any scripts not already present in the body.
  const bodyWithScripts = assembleBodyWithScripts(folded.html, scripts);

  // Hand off to the live-render document assembler. It produces the
  // canonical shell (doctype, html, head with charset + viewport,
  // body, trailing scripts preserved).
  return buildLiveDocument({
    html: bodyWithScripts,
    css: folded.css,
    title,
  });
}

// ---------------------------------------------------------------------------
// exportZip
// ---------------------------------------------------------------------------

/**
 * Resolve a single assetMap value to a Uint8Array suitable for JSZip.
 * Acceptable shapes:
 *   - Uint8Array          → returned as-is (zero-copy)
 *   - ArrayBuffer         → wrapped in a Uint8Array view
 *   - Blob / File         → read via `.arrayBuffer()` and wrapped
 *                            (browser + Node ≥ 18 both provide this)
 *   - string              → UTF-8 encoded (TextEncoder; works in browser
 *                            and Node)
 *   - { bytes: <one of the above> }  → unwrap and recurse
 *
 * Always returns Uint8Array (never a Blob) so the output is identical in
 * Node (where JSZip's Blob support is gated off) and in the browser.
 *
 * Async conversion (for Blob) is handled by the caller via the helper
 * `resolveAssetBytesAsync`; this sync version handles only the
 * non-Blob shapes so simple cases can run sync. The async helper
 * falls back here for those shapes.
 *
 * @param {unknown} value
 * @returns {Uint8Array|null}
 */
function resolveAssetBytes(value) {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  if (typeof value === 'object' && value.bytes != null) {
    return resolveAssetBytes(value.bytes);
  }
  // Blob / File: must be resolved via .arrayBuffer() — async.
  // The async helper below handles these. The sync version returns
  // null for blobs so the caller can route to the async path.
  if (typeof value === 'object' && typeof value.arrayBuffer === 'function' &&
      typeof value.size === 'number' && typeof value.type === 'string') {
    return null; // signals "needs async resolution"
  }
  return null;
}

/**
 * Async version of resolveAssetBytes. Resolves Blob/File to
 * Uint8Array via `.arrayBuffer()`. Returns `null` for unsupported
 * shapes (matching the sync version's contract).
 *
 * @param {unknown} value
 * @returns {Promise<Uint8Array|null>}
 */
async function resolveAssetBytesAsync(value) {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (typeof value === 'object' && value.bytes != null) {
    return resolveAssetBytesAsync(value.bytes);
  }
  if (typeof value === 'object' && typeof value.arrayBuffer === 'function' &&
      typeof value.size === 'number' && typeof value.type === 'string') {
    const ab = await value.arrayBuffer();
    return new Uint8Array(ab);
  }
  return null;
}

/**
 * Build the index.html string for a ZIP export. Mirrors exportHtml's
 * document assembly, but uses the `ZIP_INDEX_FILENAME` for the stylesheet
 * <link> reference (instead of an inline <style> block). The stylesheet
 * link tag is appended to the head so the styles.css sibling file is
 * picked up when the zip is unzipped.
 *
 * @param {{html: string, css: string, scripts?: object[], title?: string}} folded
 * @returns {string}
 */
function buildZipIndexHtml(folded) {
  // Reuse exportHtml for the canonical shell, then inject a <link>
  // stylesheet reference inside <head> so the unzipped site loads
  // styles.css as a sibling file.
  const doc = exportHtml({
    html: folded.html,
    css: folded.css,
    scripts: folded.scripts,
    title: folded.title,
  });
  const linkTag = `<link rel="stylesheet" href="${ZIP_STYLES_FILENAME}" />`;
  // Insert before </head> — keeps it as the last element of <head>.
  const idx = doc.indexOf('</head>');
  if (idx === -1) return doc;
  return doc.slice(0, idx) + '  ' + linkTag + '\n' + doc.slice(idx);
}

/**
 * Export a complete site as a ZIP archive (Blob). Writes:
 *   - `index.html`     — standalone document assembled via exportHtml,
 *                        with a <link rel="stylesheet" href="styles.css">
 *                        added to <head>
 *   - `styles.css`     — the (override-folded) CSS
 *   - `assets/<key>`   — every entry in `assetMap`, written under
 *                        `assets/` using the asset-map key as its
 *                        relative path
 *
 * Browser-only `saveAs` is NOT called. The caller decides how to
 * persist the Blob (anchor download, fetch upload, IndexedDB, etc.).
 *
 * Testability: the assetMap values are bytes (string / Uint8Array /
 * Blob), NOT URLs. Production callers resolve URLs into bytes via
 * `fetch().then(r => r.blob())` before calling this function; tests
 * pass bytes directly.
 *
 * @param {{html?: string, css?: string, scripts?: object[], assetMap?: Record<string, unknown>}} input
 * @param {object} [overrides]  override store or plain JSON snapshot
 * @returns {Promise<Blob>}     ZIP archive as a Blob (Blob is the
 *                              standard jszip output type for browser
 *                              consumption)
 */
export async function exportZip(input, overrides) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const html = typeof safeInput.html === 'string' ? safeInput.html : '';
  const css = typeof safeInput.css === 'string' ? safeInput.css : '';
  const scripts = Array.isArray(safeInput.scripts) ? safeInput.scripts : undefined;
  const title = typeof safeInput.title === 'string' && safeInput.title
    ? safeInput.title
    : DEFAULT_EXPORT_TITLE;
  const assetMap = (safeInput.assetMap && typeof safeInput.assetMap === 'object')
    ? safeInput.assetMap
    : {};

  // Fold overrides (same path as exportHtml) so the zip and the
  // standalone export are byte-equivalent in their css handling.
  const store = normalizeOverrides(overrides);
  const folded = store ? applyOverrides({ html, css }, store) : { html, css };

  const zip = new JSZip();

  // index.html — canonical shell, with a sibling stylesheet link.
  zip.file(ZIP_INDEX_FILENAME, buildZipIndexHtml({
    html: folded.html,
    css: folded.css,
    scripts,
    title,
  }));

  // styles.css — folded CSS (with override block, if any).
  zip.file(ZIP_STYLES_FILENAME, folded.css || '');

  // assets/* — every asset in the map, sorted for determinism.
  const assetKeys = Object.keys(assetMap).sort();
  const assetsDir = zip.folder(ZIP_ASSETS_DIR);
  // First, resolve all entries (some may be Blob → async). We do this
  // synchronously where possible and async where required.
  /** @type {Array<{key: string, bytes: Uint8Array}>} */
  const resolved = [];
  for (const key of assetKeys) {
    const v = assetMap[key];
    let bytes = resolveAssetBytes(v);
    if (bytes == null && v != null && typeof v === 'object' &&
        typeof v.arrayBuffer === 'function' &&
        typeof v.size === 'number' && typeof v.type === 'string') {
      // Resolve Blob via async path.
      const ab = await /** @type {Blob} */ (v).arrayBuffer();
      bytes = new Uint8Array(ab);
    }
    if (bytes == null) continue;
    resolved.push({ key, bytes });
  }
  for (const { key, bytes } of resolved) {
    // Strip any leading slashes from the key (defensive — keys are
    // typically relative paths without them) so a malicious or
    // careless entry can't write outside `assets/`.
    const safeKey = String(key).replace(/^\/+/, '');
    if (!safeKey || safeKey.indexOf('..') !== -1) continue;
    assetsDir.file(safeKey, bytes);
  }

  return await zip.generateAsync({ type: 'blob' });
}

// ---------------------------------------------------------------------------
// End
// ---------------------------------------------------------------------------