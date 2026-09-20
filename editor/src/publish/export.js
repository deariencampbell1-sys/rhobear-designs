/**
 * @file Export a project document to a self-contained static bundle.
 *
 *       The bundle is a flat directory map (filename → content) suitable
 *       for static hosting. It contains everything a browser needs to
 *       render the exported page — no server runtime, no API route, no
 *       database.
 *
 *       Cloudflare Pages serves 404.html for unknown routes (HTTP 404
 *       status), providing a branded fallback for missing pages. We include
 *       one so users see a helpful "not found" message instead of the
 *       generic Cloudflare error page.
 *
 *       Public surface:
 *         exportBundle({ html, css, title, assets? }) → Bundle
 *         exportBundleDetailed({ html, css, title, assets? })
 *           → { bundle: Bundle, skipped: { key, reason }[] }
 *
 *       A Bundle is a Record<string, string | Uint8Array> mapping
 *       filenames to their content. Callers write the entries to disk
 *       or upload them to a static host.
 *
 *       Round-trip guarantee:
 *         The bundle's index.html renders the same document the editor
 *         produced — body markup, CSS, and any asset references are
 *         preserved verbatim.
 *
 *       Owner decisions surfaced in PR description — this module does
 *       NOT make any irreversible hosting choices.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default title when none is supplied. */
const DEFAULT_TITLE = 'RHOBEAR Designs Export';

/** Filename for the standalone CSS file in the bundle. */
const STYLES_FILENAME = 'styles.css';

/** Filename for the main entry point. */
const INDEX_FILENAME = 'index.html';

/** Filename for the Cloudflare Pages 404 fallback. */
const FALLBACK_404_FILENAME = '404.html';

/** Filename for Cloudflare Pages _headers cache policy. */
const HEADERS_FILENAME = '_headers';

/** Sub-directory for binary assets inside the bundle. */
const ASSETS_DIR = 'assets';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe interpolation inside an HTML attribute value
 * wrapped in double quotes.
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
 * Build a clean standalone HTML document from exported parts.
 * Mirrors the shell used by `exportHtml` in `engine/io.js` so the
 * exported bundle is a faithful render of the editor's output.
 *
 * @param {{html: string, title: string}} parts
 * @returns {string}
 */
function buildIndexHtml({ html, title }) {
  const safeTitle = escapeAttr(title || DEFAULT_TITLE);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
${html || ''}
</body>
</html>`;
}

/**
 * Build a 404.html that serves as a branded fallback for unknown routes.
 * Cloudflare Pages serves this file with HTTP 404 status when a path
 * doesn't match any static asset.
 *
 * @param {string} title
 * @returns {string}
 */
function build404Html(title) {
  const safeTitle = escapeAttr(title || DEFAULT_TITLE);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app"></div>
  <script>
    // The app shell loads styles.css and renders into #app.
    // If the original page had content, it was served at index.html.
    // This 404.html is served for unknown routes so users see a
    // branded fallback instead of the generic Cloudflare error.
    document.getElementById('app').innerHTML =
      '<p>Page not found — the editor export is still available at <a href="/">the root</a>.</p>';
  </script>
</body>
</html>`;
}

/**
 * Build a _headers file for Cloudflare Pages cache policy.
 *
 * Every path in the bundle is mutable and unhashed: republishing to
 * the same Pages project reuses the same URLs. A long-lived immutable
 * cache on such a path would pin the old bytes in returning browsers
 * with no way to force a refresh, so all four entries use no-cache
 * (always revalidate — a 304 when unchanged, never stale bytes).
 *
 * - index.html → no-cache
 * - 404.html → no-cache
 * - styles.css → no-cache
 * - assets/* → no-cache
 *
 * Future optimization: content-hash the filenames (styles.<hash>.css,
 * assets/<hash>-logo.png) and rewrite the references in index.html.
 * Only then is `immutable, max-age=31536000` safe, because a changed
 * file becomes a new URL.
 *
 * @returns {string}
 */
function buildHeaders() {
  return `# Cloudflare Pages cache policy for RHOBEAR Designs exports
/index.html
  Cache-Control: no-cache

/404.html
  Cache-Control: no-cache

/styles.css
  Cache-Control: no-cache

/assets/*
  Cache-Control: no-cache
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export a project document to a self-contained static bundle, plus a
 * report of the asset keys that were not written.
 *
 * Asset keys are URL-style paths. They are sorted so the output is
 * deterministic, then written under assets/:
 *   - an empty key (or one that is only slashes) is skipped as
 *     'empty-key'
 *   - a key containing a backslash is skipped as 'unsafe-path' —
 *     Windows treats `\` as a path separator, so allowing it would
 *     make traversal protection OS-dependent — as is a key with any
 *     `..` segment
 *   - a key whose destination is already taken (e.g. `/logo.png` and
 *     `logo.png` both normalize to assets/logo.png) is skipped as
 *     'collision'; the first writer wins, nothing is overwritten
 *
 * Nothing is dropped silently: every skipped key appears in `skipped`
 * with the reason it was skipped, so callers can surface it to the user.
 *
 * @param {{
 *   html: string,
 *   css: string,
 *   title?: string,
 *   assets?: Record<string, string | Uint8Array>
 * }} project
 * @returns {{
 *   bundle: Record<string, string | Uint8Array>,
 *   skipped: Array<{ key: string, reason: 'empty-key' | 'unsafe-path' | 'collision' }>
 * }}
 *
 * @example
 *   const { bundle, skipped } = exportBundleDetailed({
 *     html: '<h1>Hello</h1>',
 *     css: 'h1 { color: red; }',
 *     assets: { '/logo.png': bytes, 'logo.png': otherBytes },
 *   });
 *   // bundle['assets/logo.png'] → bytes (first sorted writer wins)
 *   // skipped → [{ key: 'logo.png', reason: 'collision' }]
 */
export function exportBundleDetailed(project) {
  const html = typeof project?.html === 'string' ? project.html : '';
  const css = typeof project?.css === 'string' ? project.css : '';
  const title = typeof project?.title === 'string' && project.title
    ? project.title
    : DEFAULT_TITLE;
  const assets = project?.assets && typeof project.assets === 'object'
    ? project.assets
    : {};

  /** @type {Record<string, string | Uint8Array>} */
  const bundle = {};

  // Main entry point.
  bundle[INDEX_FILENAME] = buildIndexHtml({ html, title });

  // Standalone stylesheet.
  bundle[STYLES_FILENAME] = css || '/* Generated by RHOBEAR Designs */';

  // Cloudflare Pages 404 fallback — branded page for unknown routes.
  bundle[FALLBACK_404_FILENAME] = build404Html(title);

  // Cache policy for Cloudflare Pages.
  bundle[HEADERS_FILENAME] = buildHeaders();

  /** @type {Array<{ key: string, reason: 'empty-key' | 'unsafe-path' | 'collision' }>} */
  const skipped = [];

  // Assets — written under assets/ with path traversal protection.
  const assetKeys = Object.keys(assets).sort();
  for (const key of assetKeys) {
    const value = assets[key];
    // Strip leading slashes; a key of only slashes has nowhere to go.
    const safeKey = String(key).replace(/^\/+/, '');
    if (!safeKey) {
      skipped.push({ key, reason: 'empty-key' });
      continue;
    }
    // Reject backslashes outright (bundle keys are URL-style paths)
    // and any path segment that is exactly '..'.
    const hasBackslash = safeKey.includes('\\');
    const hasTraversal = safeKey.split('/').some((seg) => seg === '..');
    if (hasBackslash || hasTraversal) {
      skipped.push({ key, reason: 'unsafe-path' });
      continue;
    }
    const destKey = `${ASSETS_DIR}/${safeKey}`;
    // First writer wins — never let one asset silently replace another.
    if (destKey in bundle) {
      skipped.push({ key, reason: 'collision' });
      continue;
    }
    bundle[destKey] = value;
  }

  return { bundle, skipped };
}

/**
 * Export a project document to a self-contained static bundle.
 *
 * The returned Bundle is a flat Record mapping filenames to their
 * content (string for text files, Uint8Array for binary assets).
 * Callers write the entries to a directory, zip them, or upload
 * them to a static host.
 *
 * Asset keys that cannot be written safely are omitted. Use
 * exportBundleDetailed() when the caller needs to report which keys
 * were skipped and why; this function returns only the Bundle map.
 *
 * @param {{
 *   html: string,
 *   css: string,
 *   title?: string,
 *   assets?: Record<string, string | Uint8Array>
 * }} project
 * @returns {Record<string, string | Uint8Array>}
 *
 * @example
 *   const bundle = exportBundle({
 *     html: '<h1>Hello</h1><p>World</p>',
 *     css: 'h1 { color: red; }',
 *     title: 'My Page',
 *     assets: { 'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
 *   });
 *   // bundle['index.html']  → full HTML document
 *   // bundle['styles.css']  → CSS string
 *   // bundle['404.html']    → fallback page
 *   // bundle['_headers']    → cache policy
 *   // bundle['assets/logo.png'] → binary asset
 */
export function exportBundle(project) {
  return exportBundleDetailed(project).bundle;
}
