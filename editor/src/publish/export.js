/**
 * @file Export a project document to a self-contained static bundle.
 *
 *       The bundle is a flat directory map (filename → content) suitable
 *       for static hosting. It contains everything a browser needs to
 *       render the exported page — no server runtime, no API route, no
 *       database.
 *
 *       Cloudflare Pages doctrine: a missing `404.html` makes a missing
 *       asset return cached HTML 200 for a year. We include one so that
 *       broken asset references degrade gracefully instead of returning
 *       a Cloudflare 404 page that breaks the SPA shell.
 *
 *       Public surface:
 *         exportBundle({ html, css, title, assets? }) → Bundle
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
 * @param {{html: string, css: string, title: string}} parts
 * @returns {string}
 */
function buildIndexHtml({ html, css, title }) {
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
 * Build a 404.html that serves the same shell as index.html.
 * Cloudflare Pages caches this response for a year, so missing
 * assets return a valid HTML page instead of a broken 404.
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
    // This 404.html ensures that a missing asset (e.g. a renamed
    // image) returns a valid HTML page with HTTP 200 instead of
    // a Cloudflare 404 that breaks the SPA shell.
    document.getElementById('app').innerHTML =
      '<p>Page not found — the editor export is still available at <a href="/">the root</a>.</p>';
  </script>
</body>
</html>`;
}

/**
 * Build a _headers file for Cloudflare Pages cache policy.
 *
 * - index.html and 404.html → no-cache (always fresh)
 * - styles.css → immutable, 1-year cache
 * - assets/* → immutable, 1-year cache
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
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export a project document to a self-contained static bundle.
 *
 * The returned Bundle is a flat Record mapping filenames to their
 * content (string for text files, Uint8Array for binary assets).
 * Callers write the entries to a directory, zip them, or upload
 * them to a static host.
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
  bundle[INDEX_FILENAME] = buildIndexHtml({ html, css, title });

  // Standalone stylesheet.
  bundle[STYLES_FILENAME] = css || '/* Generated by RHOBEAR Designs */';

  // Cloudflare Pages 404 fallback — ensures missing assets return
  // cached HTML 200 instead of a broken 404 page.
  bundle[FALLBACK_404_FILENAME] = build404Html(title);

  // Cache policy for Cloudflare Pages.
  bundle[HEADERS_FILENAME] = buildHeaders();

  // Assets — written under assets/ with path traversal protection.
  const assetKeys = Object.keys(assets).sort();
  for (const key of assetKeys) {
    const value = assets[key];
    // Strip leading slashes and reject path traversal.
    const safeKey = String(key).replace(/^\/+/, '');
    if (!safeKey || safeKey.indexOf('..') !== -1) continue;
    const destKey = `${ASSETS_DIR}/${safeKey}`;
    bundle[destKey] = value;
  }

  return bundle;
}
