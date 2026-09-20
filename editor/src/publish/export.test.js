/**
 * @file Tests for the publish/export module.
 *
 *       Covers:
 *         - exportBundle produces a bundle with all required files
 *         - index.html contains the html, css, and title
 *         - styles.css contains the css
 *         - 404.html is present (Cloudflare Pages doctrine)
 *         - _headers is present with a revalidate-only cache policy
 *           (no immutable / long max-age on unhashed paths)
 *         - assets/ directory contains provided assets
 *         - path traversal in asset keys is rejected
 *         - exportBundleDetailed reports skipped asset keys
 *         - empty/missing fields use safe defaults
 *         - bundle is a locally-loadable static site (index.html
 *           is a valid HTML5 document)
 *
 *       Run with: `node --test src/publish/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportBundle, exportBundleDetailed } from './export.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a string looks like a valid HTML5 document.
 * @param {string} html
 */
function assertValidHtml5(html) {
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'must start with doctype');
  assert.ok(html.includes('<html'), 'must have <html> tag');
  assert.ok(html.includes('</html>'), 'must have closing </html> tag');
  assert.ok(html.includes('<head>'), 'must have <head> tag');
  assert.ok(html.includes('</head>'), 'must have closing </head> tag');
  assert.ok(html.includes('<body>'), 'must have <body> tag');
  assert.ok(html.includes('</body>'), 'must have closing </body> tag');
}

// ---------------------------------------------------------------------------
// Basic bundle structure
// ---------------------------------------------------------------------------

test('exportBundle: produces all required files', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  assert.ok('index.html' in bundle);
  assert.ok('styles.css' in bundle);
  assert.ok('404.html' in bundle);
  assert.ok('_headers' in bundle);
});

test('exportBundle: index.html contains the html content', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const index = bundle['index.html'];
  assert.equal(typeof index, 'string');
  assert.match(index, /<p>hi<\/p>/);
});

test('exportBundle: index.html links to styles.css', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const index = bundle['index.html'];
  assert.match(index, /<link rel="stylesheet" href="styles\.css" \/>/);
});

test('exportBundle: index.html includes the title', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'My Custom Title',
  });

  const index = bundle['index.html'];
  assert.match(index, /<title>My Custom Title<\/title>/);
});

test('exportBundle: styles.css contains the css', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const css = bundle['styles.css'];
  assert.equal(typeof css, 'string');
  assert.match(css, /p \{ color: red; \}/);
});

test('exportBundle: 404.html is present for Cloudflare Pages doctrine', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const fallback = bundle['404.html'];
  assert.equal(typeof fallback, 'string');
  assert.ok(fallback.includes('404') || fallback.includes('not found'),
    '404.html should mention the missing-page context');
});

test('exportBundle: _headers contains cache policy', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const headers = bundle['_headers'];
  assert.equal(typeof headers, 'string');
  assert.match(headers, /Cache-Control/);

  // Every bundle path is mutable and unhashed: republishing reuses the
  // same URL, so an immutable / 1-year cache would pin stale bytes in
  // returning browsers with no way to force a refresh.
  assert.ok(!headers.includes('immutable'),
    '_headers must not mark unhashed paths immutable');
  assert.ok(!headers.includes('max-age=31536000'),
    '_headers must not use a 1-year max-age');

  // styles.css and assets/* revalidate on every request.
  assert.match(headers, /\/styles\.css\n\s+Cache-Control: no-cache/);
  assert.match(headers, /\/assets\/\*\n\s+Cache-Control: no-cache/);
});

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

test('exportBundle: assets are written under assets/', () => {
  const bundle = exportBundle({
    html: '<img src="assets/logo.png">',
    css: 'img { max-width: 100%; }',
    title: 'Test Page',
    assets: {
      'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    },
  });

  assert.ok('assets/logo.png' in bundle);
  const logoBytes = bundle['assets/logo.png'];
  assert.ok(logoBytes instanceof Uint8Array);
  assert.equal(logoBytes[0], 0x89);
  assert.equal(logoBytes[1], 0x50);
});

test('exportBundle: multiple assets are all included', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      'logo.png': new Uint8Array([0x89]),
      'fonts/main.woff2': new Uint8Array([0x77, 0x4f]),
    },
  });

  assert.ok('assets/logo.png' in bundle);
  assert.ok('assets/fonts/main.woff2' in bundle);
});

test('exportBundle: path traversal in asset keys is rejected', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      '../escape.png': new Uint8Array([1]),
      'ok.png': new Uint8Array([2]),
      'sub/../../escape2.png': new Uint8Array([3]),
    },
  });

  assert.ok(!('assets/../escape.png' in bundle));
  assert.ok(!('assets/escape2.png' in bundle));
  assert.ok('assets/ok.png' in bundle);
});

test('exportBundle: leading slashes in asset keys are stripped', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      '/logo.png': new Uint8Array([0x89]),
    },
  });

  assert.ok('assets/logo.png' in bundle);
  assert.ok(!('/logo.png' in bundle));
});

test('exportBundleDetailed: backslash keys are skipped as unsafe-path', () => {
  const { bundle, skipped } = exportBundleDetailed({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      // Windows treats '\' as a path separator, so a backslash key is
      // rejected outright — traversal protection must not be OS-dependent.
      '..\\..\\escape.png': new Uint8Array([1]),
      // Rejected even without a '..' segment: bundle keys are URL paths.
      'sub\\dir.png': new Uint8Array([2]),
      'ok.png': new Uint8Array([3]),
    },
  });

  assert.ok(!('assets/..\\..\\escape.png' in bundle));
  assert.ok(!('assets/sub\\dir.png' in bundle));
  assert.ok('assets/ok.png' in bundle);
  assert.deepEqual(skipped, [
    { key: '..\\..\\escape.png', reason: 'unsafe-path' },
    { key: 'sub\\dir.png', reason: 'unsafe-path' },
  ]);
});

test('exportBundleDetailed: colliding destinations keep the first writer', () => {
  const first = new Uint8Array([0x89]);
  const second = new Uint8Array([0x50]);

  const { bundle, skipped } = exportBundleDetailed({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      // Both normalize to assets/logo.png (leading slash stripped).
      // Keys are sorted before the loop, so '/logo.png' wins.
      '/logo.png': first,
      'logo.png': second,
    },
  });

  assert.equal(bundle['assets/logo.png'], first);
  assert.deepEqual(skipped, [{ key: 'logo.png', reason: 'collision' }]);
});

test('exportBundleDetailed: skipped is empty for a clean project', () => {
  const { bundle, skipped } = exportBundleDetailed({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
    assets: {
      'logo.png': new Uint8Array([0x89]),
    },
  });

  assert.deepEqual(skipped, []);
  assert.ok('assets/logo.png' in bundle);
  assert.ok('index.html' in bundle);

  // exportBundle returns only the Bundle map, not the report.
  assert.ok(!('skipped' in exportBundle({ html: '<p>hi</p>', css: 'p{}' })));
});

// ---------------------------------------------------------------------------
// Defaults / empty input
// ---------------------------------------------------------------------------

test('exportBundle: empty project uses safe defaults', () => {
  const bundle = exportBundle({});

  assert.ok('index.html' in bundle);
  assert.ok('styles.css' in bundle);
  assert.ok('404.html' in bundle);
  assert.ok('_headers' in bundle);

  const index = bundle['index.html'];
  assert.match(index, /<title>RHOBEAR Designs Export<\/title>/);

  const css = bundle['styles.css'];
  assert.equal(css, '/* Generated by RHOBEAR Designs */');
});

test('exportBundle: missing html defaults to empty string', () => {
  const bundle = exportBundle({
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  const index = bundle['index.html'];
  // Body should be empty but the shell is still valid HTML5.
  assertValidHtml5(index);
});

test('exportBundle: missing css defaults to placeholder comment', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    title: 'Test Page',
  });

  const css = bundle['styles.css'];
  assert.equal(css, '/* Generated by RHOBEAR Designs */');
});

// ---------------------------------------------------------------------------
// Locally-loadable bundle verification
// ---------------------------------------------------------------------------

test('exportBundle: index.html is a valid HTML5 document', () => {
  const bundle = exportBundle({
    html: '<div class="container"><h1>Hello</h1><p>World</p></div>',
    css: '.container { max-width: 800px; } h1 { color: #333; }',
    title: 'My Site',
  });

  assertValidHtml5(bundle['index.html']);
  assert.match(bundle['index.html'], /<div class="container">/);
  assert.match(bundle['index.html'], /<h1>Hello<\/h1>/);
  assert.match(bundle['index.html'], /<p>World<\/p>/);
});

test('exportBundle: index.html has viewport meta for responsive rendering', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  assert.match(bundle['index.html'], /<meta name="viewport" content="width=device-width, initial-scale=1.0" \/>/);
});

test('exportBundle: index.html has charset meta', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  assert.match(bundle['index.html'], /<meta charset="UTF-8" \/>/);
});

test('exportBundle: 404.html is a valid HTML5 document', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  assertValidHtml5(bundle['404.html']);
});

test('exportBundle: 404.html references styles.css', () => {
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  });

  assert.match(bundle['404.html'], /<link rel="stylesheet" href="styles\.css" \/>/);
});

// ---------------------------------------------------------------------------
// Deterministic output
// ---------------------------------------------------------------------------

test('exportBundle: same input produces the same output', () => {
  const input = {
    html: '<p>hi</p>',
    css: 'p { color: red; }',
    title: 'Test Page',
  };

  const a = exportBundle(input);
  const b = exportBundle(input);

  assert.equal(a['index.html'], b['index.html']);
  assert.equal(a['styles.css'], b['styles.css']);
  assert.equal(a['404.html'], b['404.html']);
  assert.equal(a['_headers'], b['_headers']);
});
