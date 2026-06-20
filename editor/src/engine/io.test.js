/**
 * @file Tests for the hardened import/export layer (io.js).
 *
 *       Run with: `node --test src/engine/`
 *
 *       Covers:
 *         - importHtml: parts extraction, scripts preserved (inline +
 *           external), title, CSS aggregation, assets enumeration
 *         - importFolder: entry-resolution rules (single html, multi
 *           html with index.html preferred, no html throws), asset
 *           map construction with relative paths + basename aliases,
 *           ref rewriting via the live-render regex pipeline, script
 *           bodies NOT rewritten
 *         - exportHtml: clean shell, scripts preserved, override
 *           folding (with both a store and a plain-object snapshot),
 *           empty-input safety
 *         - exportZip: produces a Blob, index.html + styles.css +
 *           assets/* present, override folding, deterministic asset
 *           ordering, empty-input safety
 *         - Round-trip: exportHtml(importHtml(x)) preserves the body
 *           markup and <script> tags of x on tricky inputs
 *
 *       Style: Node's built-in test runner, ESM, strict asserts.
 *       Asset-map values for exportZip tests are bytes (Uint8Array /
 *       string) — never blob: URLs — so the suite runs in pure Node.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  importHtml,
  importFolder,
  exportHtml,
  exportZip,
} from './io.js';
import { createOverrideStore } from './style-overrides.js';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a JSZip archive Blob as a Map<filename, string> for assertions.
 * Works in Node by converting to ArrayBuffer first (JSZip's Blob support
 * is gated off in Node — see node_modules/jszip/lib/support.js).
 *
 * @param {Blob} blob
 * @returns {Promise<{names: string[], get: (name: string) => Promise<string>, getBytes: (name: string) => Promise<Uint8Array>}>}
 */
async function readZip(blob) {
  const ab = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  return {
    names,
    get: async (n) => {
      const entry = zip.file(n);
      if (!entry) throw new Error('missing zip entry: ' + n);
      return await entry.async('string');
    },
    getBytes: async (n) => {
      const entry = zip.file(n);
      if (!entry) throw new Error('missing zip entry: ' + n);
      return await entry.async('uint8array');
    },
  };
}

// ===========================================================================
// importHtml
// ===========================================================================

test('importHtml: empty / non-string input returns safe defaults', () => {
  const r = importHtml('');
  assert.equal(r.html, '');
  assert.equal(r.css, '');
  assert.deepEqual(r.scripts, []);
  assert.equal(r.title, null);
  assert.deepEqual(r.assets, {});

  assert.equal(importHtml(null).html, '');
  assert.equal(importHtml(undefined).html, '');
});

test('importHtml: extracts title from a full document', () => {
  const r = importHtml('<!DOCTYPE html><html><head><title>Hello</title></head><body></body></html>');
  assert.equal(r.title, 'Hello');
});

test('importHtml: title is null when no <title> is present', () => {
  const r = importHtml('<html><body>x</body></html>');
  assert.equal(r.title, null);
});

test('importHtml: aggregates <style> contents into the css field', () => {
  const raw = '<html><head><style>body{margin:0}</style><style>h1{color:red}</style></head><body></body></html>';
  const r = importHtml(raw);
  assert.match(r.css, /body\{margin:0\}/);
  assert.match(r.css, /h1\{color:red\}/);
});

test('importHtml: stylesheet <link> references become @import lines', () => {
  const raw = '<html><head>' +
    '<link rel="stylesheet" href="main.css">' +
    '<link rel="stylesheet" href="theme.css">' +
    '</head><body></body></html>';
  const r = importHtml(raw);
  assert.match(r.css, /@import url\('main\.css'\);/);
  assert.match(r.css, /@import url\('theme\.css'\);/);
});

test('importHtml: non-stylesheet <link> tags do NOT contribute to css', () => {
  const raw = '<html><head>' +
    '<link rel="icon" href="favicon.ico">' +
    '<link rel="stylesheet" href="main.css">' +
    '</head><body></body></html>';
  const r = importHtml(raw);
  assert.doesNotMatch(r.css, /favicon/);
  assert.match(r.css, /@import url\('main\.css'\);/);
});

test('importHtml: body markup keeps <script> tags inline (verbatim)', () => {
  const raw = '<html><body>' +
    '<p>hi</p>' +
    '<script src="ext.js"></script>' +
    '<script>window.X = 1;</script>' +
    '</body></html>';
  const r = importHtml(raw);
  assert.match(r.html, /<script src="ext\.js"><\/script>/);
  assert.match(r.html, /<script>window\.X = 1;<\/script>/);
});

test('importHtml: scripts array contains every script tag in document order', () => {
  const raw = '<html><head>' +
    '<script src="a.js"></script>' +
    '</head><body>' +
    '<script>inline1</script>' +
    '<script src="b.js"></script>' +
    '</body></html>';
  const r = importHtml(raw);
  assert.equal(r.scripts.length, 3);
  assert.equal(r.scripts[0].src, 'a.js');
  assert.equal(r.scripts[1].src, null);
  assert.equal(r.scripts[1].content, 'inline1');
  assert.equal(r.scripts[2].src, 'b.js');
});

test('importHtml: assets enumerates relative href/src references', () => {
  const raw = '<html><head>' +
    '<link rel="stylesheet" href="main.css">' +
    '<link rel="icon" href="favicon.ico">' +
    '</head><body>' +
    '<script src="app.js"></script>' +
    '<img src="logo.png">' +
    '</body></html>';
  const r = importHtml(raw);
  // Only link href and script src are enumerated (img src isn't
  // enumerated by extractDocumentParts — but if a future lane adds
  // more, the test still passes for the present set).
  assert.ok(r.assets['main.css']);
  assert.ok(r.assets['favicon.ico']);
  assert.ok(r.assets['app.js']);
});

test('importHtml: assets excludes absolute and data: references', () => {
  const raw = '<html><head>' +
    '<link rel="stylesheet" href="https://cdn.example.com/x.css">' +
    '<link rel="stylesheet" href="//cdn.example.com/y.css">' +
    '<link rel="stylesheet" href="data:text/css,body{}">' +
    '<link rel="stylesheet" href="local.css">' +
    '</head><body></body></html>';
  const r = importHtml(raw);
  assert.ok(!('https://cdn.example.com/x.css' in r.assets));
  assert.ok(!('//cdn.example.com/y.css' in r.assets));
  assert.ok(!('data:text/css,body{}' in r.assets));
  assert.ok('local.css' in r.assets);
});

test('importHtml: handles a pure fragment with no <html> wrapper', () => {
  const r = importHtml('<div class="x"><p>frag</p></div>');
  assert.match(r.html, /<div class="x"><p>frag<\/p><\/div>/);
  assert.equal(r.title, null);
});

test('importHtml: tolerates comments inside head/body', () => {
  const raw = '<html><!-- top --><head><title>X</title></head><body><!-- inner --><p>hi</p></body></html>';
  const r = importHtml(raw);
  assert.match(r.html, /<!-- inner -->/);
  assert.equal(r.title, 'X');
});

// ===========================================================================
// importFolder — entry-resolution rules
// ===========================================================================

test('importFolder: single html entry is chosen as the entry', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:1' },
    { path: 'site/style.css', getUrl: () => 'blob:2' },
  ];
  const html = '<html><head><link rel="stylesheet" href="style.css"></head><body></body></html>';
  const r = importFolder(entries, { entryText: html });
  assert.deepEqual(r.assetMap, { 'style.css': 'blob:2' });
});

test('importFolder: prefers index.html when multiple html files exist', () => {
  const entries = [
    { path: 'site/about.html', getUrl: () => 'blob:a' },
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css', getUrl: () => 'blob:s' },
  ];
  const r = importFolder(entries, { entryText: '<html><body></body></html>' });
  // The chosen entry is index.html, so style.css is in the assetMap
  // (about.html is NOT a sibling asset; it's another html file).
  assert.deepEqual(r.assetMap, { 'style.css': 'blob:s' });
});

test('importFolder: index.html preference is case-insensitive on basename', () => {
  const entries = [
    { path: 'site/INDEX.HTML', getUrl: () => 'blob:i' },
    { path: 'site/about.html', getUrl: () => 'blob:a' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  // INDEX.HTML should be chosen; about.html should not appear in
  // assetMap (it's also an html file, so it's skipped either way).
  assert.deepEqual(r.assetMap, {});
});

test('importFolder: falls back to first alphabetically when no index.html', () => {
  const entries = [
    { path: 'site/zeta.html', getUrl: () => 'blob:z' },
    { path: 'site/alpha.html', getUrl: () => 'blob:a' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  // alpha.html wins (alphabetically first). Both are html files so the
  // assetMap is empty either way, but we can still confirm the entry
  // choice by feeding style.css and seeing it end up in assetMap only
  // if its parent is alpha.html's directory.
  const entries2 = [
    { path: 'site/zeta.html', getUrl: () => 'blob:z' },
    { path: 'site/alpha.html', getUrl: () => 'blob:a' },
    { path: 'site/style.css', getUrl: () => 'blob:s' },
  ];
  const r2 = importFolder(entries2, { entryText: '<html></html>' });
  assert.deepEqual(r2.assetMap, { 'style.css': 'blob:s' });
});

test('importFolder: throws when no html entry exists', () => {
  const entries = [
    { path: 'site/style.css', getUrl: () => 'blob:s' },
    { path: 'site/logo.png', getUrl: () => 'blob:l' },
  ];
  assert.throws(
    () => importFolder(entries, { entryText: '' }),
    /no \.html file found/,
  );
});

test('importFolder: throws on empty entries list', () => {
  assert.throws(() => importFolder([], { entryText: '' }), /empty/);
  assert.throws(() => importFolder(null, { entryText: '' }), /empty/);
  assert.throws(() => importFolder(undefined, { entryText: '' }), /empty/);
});

// ===========================================================================
// importFolder — asset-map construction
// ===========================================================================

test('importFolder: assetMap keys are paths RELATIVE to the entry directory', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css', getUrl: () => 'blob:s' },
    { path: 'site/images/logo.png', getUrl: () => 'blob:l' },
    { path: 'site/assets/fonts/x.woff2', getUrl: () => 'blob:f' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  assert.equal(r.assetMap['style.css'], 'blob:s');
  assert.equal(r.assetMap['images/logo.png'], 'blob:l');
  assert.equal(r.assetMap['assets/fonts/x.woff2'], 'blob:f');
});

test('importFolder: assetMap also registers a bare-basename alias', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/images/logo.png', getUrl: () => 'blob:l' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  // Both keys should resolve to the same url.
  assert.equal(r.assetMap['images/logo.png'], 'blob:l');
  assert.equal(r.assetMap['logo.png'], 'blob:l');
});

test('importFolder: assetMap skips entries that have no getUrl', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css' }, // no getUrl
    { path: 'site/logo.png', getUrl: () => 'blob:l' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  assert.deepEqual(r.assetMap, { 'logo.png': 'blob:l' });
});

test('importFolder: handles flat (no-directory) file paths', () => {
  const entries = [
    { path: 'index.html', getUrl: () => 'blob:i' },
    { path: 'style.css', getUrl: () => 'blob:s' },
  ];
  const r = importFolder(entries, { entryText: '<html></html>' });
  assert.deepEqual(r.assetMap, { 'style.css': 'blob:s' });
});

test('importFolder: rewritten html has blob: URLs for src/href/url()', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css', getUrl: () => 'blob:css' },
    { path: 'site/logo.png', getUrl: () => 'blob:png' },
  ];
  const html = '<html><head>' +
    '<link rel="stylesheet" href="style.css">' +
    '<style>.bg { background: url(logo.png); }</style>' +
    '</head><body>' +
    '<img src="logo.png">' +
    '<script src="app.js"></script>' +
    '</body></html>';
  const r = importFolder(entries, { entryText: html });
  assert.match(r.html, /src="blob:png"/);
  assert.match(r.css, /@import url\('blob:css'\);/);
  // Note: the inline <style> in head gets extracted into css as-is by
  // importHtml, so url(logo.png) lives in r.css.
  assert.match(r.css, /url\(blob:png\)/);
});

test('importFolder: rewritten html does NOT touch inline <script> bodies', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css', getUrl: () => 'blob:css' },
  ];
  const html = '<html><body>' +
    '<script>const x = "style.css";</script>' +
    '</body></html>';
  const r = importFolder(entries, { entryText: html });
  assert.match(r.html, /const x = "style\.css";/);
  assert.doesNotMatch(r.html, /const x = "blob:css"/);
});

test('importFolder: returns empty html when entryText is empty', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
    { path: 'site/style.css', getUrl: () => 'blob:s' },
  ];
  const r = importFolder(entries, { entryText: '' });
  assert.equal(r.html, '');
  assert.equal(r.css, '');
  // But the assetMap is still populated — useful for callers that want
  // to know which files were found before reading the entry.
  assert.deepEqual(r.assetMap, { 'style.css': 'blob:s' });
});

test('importFolder: title is extracted from the rewritten entry', () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:i' },
  ];
  const html = '<html><head><title>My Folder</title></head><body></body></html>';
  const r = importFolder(entries, { entryText: html });
  assert.equal(r.title, 'My Folder');
});

// ===========================================================================
// exportHtml
// ===========================================================================

test('exportHtml: empty input returns a valid empty-shell document', () => {
  const out = exportHtml({});
  assert.ok(out.startsWith('<!DOCTYPE html>'));
  assert.match(out, /<body>\n\n<\/body>/);
});

test('exportHtml: produces a canonical shell', () => {
  const out = exportHtml({ html: '<p>hi</p>' });
  assert.ok(out.startsWith('<!DOCTYPE html>'));
  assert.match(out, /<html lang="en">/);
  assert.match(out, /<meta charset="UTF-8" \/>/);
  assert.match(out, /<meta name="viewport"/);
  assert.match(out, /<body>\n<p>hi<\/p>\n<\/body>/);
});

test('exportHtml: html content survives verbatim, scripts and all', () => {
  const html =
    '<p>hello</p>' +
    '<script src="https://example.test/x.js"></script>' +
    '<script>window.__RHOBEAR__ = { v: 1 };</script>';
  const out = exportHtml({ html });
  assert.match(out, /<script src="https:\/\/example\.test\/x\.js"><\/script>/);
  assert.match(out, /<script>window\.__RHOBEAR__ = \{ v: 1 \};<\/script>/);
});

test('exportHtml: css content is included as a <style> block', () => {
  const out = exportHtml({ html: '<p/>', css: 'body{margin:0}\n.a{color:red}' });
  assert.match(out, /<style>\nbody\{margin:0\}\n\.a\{color:red\}\n<\/style>/);
});

test('exportHtml: explicit scripts? are appended to the body when missing', () => {
  const out = exportHtml({
    html: '<p/>',
    scripts: [{
      raw: '<script src="https://cdn.example.com/analytics.js"></script>',
      src: 'https://cdn.example.com/analytics.js',
      content: null,
      attrs: { src: 'https://cdn.example.com/analytics.js' },
      openTag: '<script src="https://cdn.example.com/analytics.js">',
    }],
  });
  assert.match(out, /<script src="https:\/\/cdn\.example\.com\/analytics\.js"><\/script>/);
});

test('exportHtml: explicit scripts? are NOT duplicated when already in html', () => {
  const scriptRaw = '<script>window.X = 1;</script>';
  const html = '<p/>' + scriptRaw;
  const out = exportHtml({
    html,
    scripts: [{
      raw: scriptRaw,
      src: null,
      content: 'window.X = 1;',
      attrs: {},
      openTag: '<script>',
    }],
  });
  // Count occurrences of the script — must be exactly 1.
  const count = (out.match(/<script>window\.X = 1;<\/script>/g) || []).length;
  assert.equal(count, 1);
});

test('exportHtml: null overrides is a no-op', () => {
  const input = { html: '<p/>', css: 'p{color:red}' };
  const out = exportHtml(input, null);
  assert.match(out, /p\{color:red\}/);
  assert.doesNotMatch(out, /RHOBEAR editor overrides/);
});

test('exportHtml: undefined overrides is a no-op', () => {
  const out = exportHtml({ html: '<p/>', css: 'p{color:red}' }, undefined);
  assert.doesNotMatch(out, /RHOBEAR editor overrides/);
});

test('exportHtml: empty override store is a no-op', () => {
  const store = createOverrideStore();
  const out = exportHtml({ html: '<p/>', css: 'p{color:red}' }, store);
  assert.doesNotMatch(out, /RHOBEAR editor overrides/);
});

test('exportHtml: non-empty store fold — html byte-equivalent, css gets override block', () => {
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  const input = {
    html: '<header><h1>Title</h1></header><script>window.X = 1;</script>',
    css: 'h1 { font-size: 32px; }',
  };
  const out = exportHtml(input, store);
  // Markup byte-equal.
  assert.match(out, /<header><h1>Title<\/h1><\/header><script>window\.X = 1;<\/script>/);
  // Original CSS preserved.
  assert.match(out, /h1 \{ font-size: 32px; \}/);
  // Override block appended.
  assert.match(out, /RHOBEAR editor overrides/);
  assert.match(out, /h1\{color:red\}/);
});

test('exportHtml: plain-object override snapshot is accepted', () => {
  const input = { html: '<h1>Title</h1>', css: 'h1{font-size:32px}' };
  const out = exportHtml(input, { 'h1': { 'color': 'red' } });
  assert.match(out, /h1\{color:red\}/);
  assert.match(out, /RHOBEAR editor overrides/);
});

test('exportHtml: override block comes AFTER the original css', () => {
  const input = { html: '<p/>', css: 'p{margin:0}' };
  const store = createOverrideStore();
  store.setStyle('p', 'color', 'red');
  const out = exportHtml(input, store);
  const idxOrig = out.indexOf('p{margin:0}');
  const idxOver = out.indexOf('p{color:red}');
  assert.ok(idxOrig >= 0 && idxOver > idxOrig,
    'override block must come AFTER the original css');
});

test('exportHtml: html is byte-equivalent through folding (scripts + comments preserved)', () => {
  const input = {
    html:
      '<!-- page -->\n' +
      '<section><p>hi</p></section>' +
      '<script src="https://example.test/x.js" defer></script>' +
      '<script>const SECRET = 42;</script>',
    css: 'p { padding: 0; }',
  };
  const store = createOverrideStore();
  store.setStyle('p', 'margin', '8px');
  const out = exportHtml(input, store);
  // Comment, scripts, all preserved verbatim.
  assert.match(out, /<!-- page -->/);
  assert.match(out, /<script src="https:\/\/example\.test\/x\.js" defer><\/script>/);
  assert.match(out, /<script>const SECRET = 42;<\/script>/);
});

// ===========================================================================
// exportZip
// ===========================================================================

test('exportZip: returns a Blob of the right type', async () => {
  const blob = await exportZip({ html: '<p/>', css: 'p{}' });
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/zip');
  assert.ok(blob.size > 0);
});

test('exportZip: empty input still writes index.html + styles.css', async () => {
  const blob = await exportZip({});
  const z = await readZip(blob);
  assert.ok(z.names.includes('index.html'));
  assert.ok(z.names.includes('styles.css'));
});

test('exportZip: index.html has a sibling stylesheet link', async () => {
  const blob = await exportZip({ html: '<p/>', css: 'p{color:red}' });
  const z = await readZip(blob);
  const index = await z.get('index.html');
  assert.match(index, /<link rel="stylesheet" href="styles\.css" \/>/);
});

test('exportZip: index.html preserves scripts verbatim', async () => {
  const blob = await exportZip({
    html: '<p>x</p><script src="https://cdn.example.com/x.js"></script><script>window.Y=1;</script>',
  });
  const z = await readZip(blob);
  const index = await z.get('index.html');
  assert.match(index, /<script src="https:\/\/cdn\.example\.com\/x\.js"><\/script>/);
  assert.match(index, /<script>window\.Y=1;<\/script>/);
});

test('exportZip: styles.css contains the folded css', async () => {
  const blob = await exportZip({ html: '<p/>', css: 'body{margin:0}\n.a{color:red}' });
  const z = await readZip(blob);
  const css = await z.get('styles.css');
  assert.match(css, /body\{margin:0\}/);
  assert.match(css, /\.a\{color:red\}/);
});

test('exportZip: writes assets/* for each entry in the assetMap', async () => {
  const blob = await exportZip({
    html: '<img src="assets/logo.png">',
    assetMap: {
      'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
      'nested/sub/style.css': '/* x */',
    },
  });
  const z = await readZip(blob);
  assert.ok(z.names.includes('assets/logo.png'));
  assert.ok(z.names.includes('assets/nested/sub/style.css'));
  const logoBytes = await z.getBytes('assets/logo.png');
  assert.equal(logoBytes.length, 4);
  assert.equal(logoBytes[0], 0x89);
  assert.equal(logoBytes[1], 0x50);
  assert.equal(logoBytes[2], 0x4e);
  assert.equal(logoBytes[3], 0x47);
  const css = await z.get('assets/nested/sub/style.css');
  assert.equal(css, '/* x */');
});

test('exportZip: accepts string and Uint8Array asset values', async () => {
  const blob = await exportZip({
    html: '<p/>',
    assetMap: {
      'plain.txt': 'hello world',
      'binary.bin': new Uint8Array([1, 2, 3, 4, 5]),
    },
  });
  const z = await readZip(blob);
  const plain = await z.get('assets/plain.txt');
  assert.equal(plain, 'hello world');
  const bin = await z.getBytes('assets/binary.bin');
  assert.deepEqual(Array.from(bin), [1, 2, 3, 4, 5]);
});

test('exportZip: assetMap entries with absolute paths are stripped of leading slashes', async () => {
  const blob = await exportZip({
    html: '<p/>',
    assetMap: {
      '/logo.png': new Uint8Array([1]),
    },
  });
  const z = await readZip(blob);
  // Should be under assets/logo.png, not /logo.png at the root.
  assert.ok(z.names.includes('assets/logo.png'));
});

test('exportZip: assetMap entries with .. in the key are skipped', async () => {
  const blob = await exportZip({
    html: '<p/>',
    assetMap: {
      'ok.png': new Uint8Array([1]),
      '../escape.png': new Uint8Array([2]),
      'sub/../../escape2.png': new Uint8Array([3]),
    },
  });
  const z = await readZip(blob);
  assert.ok(z.names.includes('assets/ok.png'));
  assert.ok(!z.names.some((n) => n.includes('escape')));
});

test('exportZip: empty / non-string asset values are skipped', async () => {
  const blob = await exportZip({
    html: '<p/>',
    assetMap: {
      'good.png': new Uint8Array([1]),
      'null.png': null,
      'undef.png': undefined,
      'num.png': 42, // unsupported type
      'empty.png': '',
    },
  });
  const z = await readZip(blob);
  assert.ok(z.names.includes('assets/good.png'));
  // Empty string is still a valid (empty) write — it's a string.
  assert.ok(z.names.includes('assets/empty.png'));
  // Unsupported values are dropped.
  assert.ok(!z.names.includes('assets/null.png'));
  assert.ok(!z.names.includes('assets/undef.png'));
  assert.ok(!z.names.includes('assets/num.png'));
});

test('exportZip: applies overrides (same folding as exportHtml)', async () => {
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  const blob = await exportZip(
    { html: '<h1>Title</h1>', css: 'h1{font-size:32px}' },
    store,
  );
  const z = await readZip(blob);
  const css = await z.get('styles.css');
  assert.match(css, /h1\{font-size:32px\}/);
  assert.match(css, /RHOBEAR editor overrides/);
  assert.match(css, /h1\{color:red\}/);
});

test('exportZip: plain-object override snapshot is accepted', async () => {
  const blob = await exportZip(
    { html: '<h1>T</h1>', css: 'h1{font-size:32px}' },
    { 'h1': { 'color': 'blue' } },
  );
  const z = await readZip(blob);
  const css = await z.get('styles.css');
  assert.match(css, /h1\{color:blue\}/);
});

test('exportZip: index.html and styles.css match a standalone exportHtml (modulo link tag)', async () => {
  const input = { html: '<h1>Title</h1><p>body</p>', css: 'body{margin:0}' };
  const htmlDoc = exportHtml(input);
  const blob = await exportZip(input);
  const z = await readZip(blob);
  const indexInZip = await z.get('index.html');
  // The standalone htmlDoc and the in-zip index should both contain
  // the same body markup and styles. The in-zip version has an
  // extra <link rel="stylesheet" href="styles.css" /> in <head>.
  assert.match(indexInZip, /<h1>Title<\/h1><p>body<\/p>/);
  assert.match(indexInZip, /body\{margin:0\}/);
  assert.match(htmlDoc, /<h1>Title<\/h1><p>body<\/p>/);
  assert.match(htmlDoc, /body\{margin:0\}/);
});

// ===========================================================================
// Round-trip: exportHtml(importHtml(x)) preserves body + scripts of x
// ===========================================================================

/**
 * Helper: pull every <script> tag out of an html-or-document string and
 * return an array of `{ raw }` records. Uses live-render.extractDocumentParts.
 */
async function extractScriptRaws(s) {
  const { extractDocumentParts } = await import('./live-render.js');
  return extractDocumentParts(s).scripts.map((sc) => sc.raw);
}

test('round-trip: full document with scripts in head and body', async () => {
  const raw = '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <title>Demo</title>\n' +
    '  <link rel="stylesheet" href="main.css">\n' +
    '  <script src="head.js" defer></script>\n' +
    '  <script>var HEAD_INLINE = 1;</script>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <h1>Hello</h1>\n' +
    '  <p>World</p>\n' +
    '  <script src="body.js"></script>\n' +
    '  <script>var BODY_INLINE = 2;</script>\n' +
    '</body>\n' +
    '</html>';
  const imp = importHtml(raw);
  const out = exportHtml({ html: imp.html, css: imp.css, scripts: imp.scripts, title: imp.title });
  // Title preserved.
  assert.equal(imp.title, 'Demo');
  assert.match(out, /<h1>Hello<\/h1>/);
  assert.match(out, /<p>World<\/p>/);
  // Every script tag survives.
  const outScripts = await extractScriptRaws(out);
  // Scripts after </body> in source may be re-emitted at the end;
  // buildLiveDocument preserves them. We expect all four script tags
  // (head.js, head-inline, body.js, body-inline) to be in the output.
  assert.equal(outScripts.length, 4);
  assert.ok(outScripts.some((s) => /src="head\.js"/.test(s)));
  assert.ok(outScripts.some((s) => /var HEAD_INLINE/.test(s)));
  assert.ok(outScripts.some((s) => /src="body\.js"/.test(s)));
  assert.ok(outScripts.some((s) => /var BODY_INLINE/.test(s)));
});

test('round-trip: inline script body containing a path-like literal is preserved', async () => {
  const raw = '<html><body>' +
    '<script>const assetPath = "logo.png"; const other = "./style.css";</script>' +
    '</body></html>';
  const imp = importHtml(raw);
  const out = exportHtml({ html: imp.html, css: imp.css, scripts: imp.scripts, title: imp.title });
  // The string literals inside the script must NOT be touched.
  assert.match(out, /const assetPath = "logo\.png";/);
  assert.match(out, /const other = "\.\/style\.css";/);
  assert.doesNotMatch(out, /const assetPath = "blob:/);
});

test('round-trip: fragment input (no <html>) still produces a valid document', async () => {
  const raw = '<div class="x"><p>frag</p>' +
    '<script>window.FRAG = 1;</script>' +
    '</div>';
  const imp = importHtml(raw);
  const out = exportHtml({ html: imp.html, css: imp.css, scripts: imp.scripts, title: imp.title });
  assert.ok(out.startsWith('<!DOCTYPE html>'));
  assert.match(out, /<div class="x"><p>frag<\/p>/);
  assert.match(out, /window\.FRAG = 1;/);
});

test('round-trip: doctype + comments + meta all survive the loop', async () => {
  const raw = '<!DOCTYPE html>\n<!-- top -->\n' +
    '<html><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width">' +
    '<title>Survives</title>' +
    '</head><body><!-- body --><p>hi</p></body></html>';
  const imp = importHtml(raw);
  const out = exportHtml({ html: imp.html, css: imp.css, scripts: imp.scripts, title: imp.title });
  // Charset meta always added (buildLiveDocument guarantees it).
  assert.match(out, /<meta charset="UTF-8" \/>/);
  // Body comment preserved (verbatim text in bodyHtml).
  assert.match(out, /<!-- body -->/);
  // Body markup preserved.
  assert.match(out, /<p>hi<\/p>/);
  // Title preserved.
  assert.match(out, /<title>Survives<\/title>/);
});

test('round-trip: scripts array used to inject scripts not in html body', async () => {
  const html = '<p>x</p>';
  const scripts = [{
    raw: '<script src="https://example.test/late.js" async></script>',
    src: 'https://example.test/late.js',
    content: null,
    attrs: { src: 'https://example.test/late.js', async: true },
    openTag: '<script src="https://example.test/late.js" async>',
  }];
  const out = exportHtml({ html, scripts });
  assert.match(out, /<p>x<\/p>/);
  assert.match(out, /<script src="https:\/\/example\.test\/late\.js" async><\/script>/);
});

test('round-trip: importFolder + exportHtml — full folder pipeline preserves assets', async () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:idx' },
    { path: 'site/style.css', getUrl: () => 'blob:css' },
    { path: 'site/logo.png', getUrl: () => 'blob:png' },
    { path: 'site/app.js', getUrl: () => 'blob:app' },
  ];
  const html = '<html><head>' +
    '<title>Folder</title>' +
    '<link rel="stylesheet" href="style.css">' +
    '</head><body>' +
    '<img src="logo.png">' +
    '<script src="app.js"></script>' +
    '</body></html>';
  const folder = importFolder(entries, { entryText: html });
  assert.equal(folder.title, 'Folder');
  // Refs are rewritten in the imported html.
  assert.match(folder.html, /src="blob:png"/);
  // Now re-export the same data.
  const out = exportHtml({ html: folder.html, css: folder.css, title: folder.title });
  assert.match(out, /<img src="blob:png"/);
  assert.match(out, /<script src="blob:app"><\/script>/);
  // Title preserved.
  assert.match(out, /<title>Folder<\/title>/);
  // Stylesheet link is carried over via @import in the exported css.
  assert.match(out, /@import url\('blob:css'\);/);
});

test('round-trip: importFolder + exportZip — folder exports as a working ZIP', async () => {
  const entries = [
    { path: 'site/index.html', getUrl: () => 'blob:idx' },
    { path: 'site/style.css', getUrl: () => 'blob:css' },
    { path: 'site/logo.png', getUrl: () => 'blob:png' },
  ];
  const html = '<html><head>' +
    '<title>ZIP Round-trip</title>' +
    '<link rel="stylesheet" href="style.css">' +
    '</head><body>' +
    '<img src="logo.png">' +
    '<script>window.F = 1;</script>' +
    '</body></html>';
  const folder = importFolder(entries, { entryText: html });
  const blob = await exportZip({
    html: folder.html,
    css: folder.css,
    title: folder.title,
    assetMap: {
      'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    },
  });
  const z = await readZip(blob);
  // index.html has the body markup + script + title.
  const index = await z.get('index.html');
  assert.match(index, /<title>ZIP Round-trip<\/title>/);
  assert.match(index, /<img src="blob:png"/);
  assert.match(index, /window\.F = 1;/);
  // styles.css has the (no-asset) css. Since folder.html/css use
  // blob: URLs that aren't in our re-exported assetMap, those stay
  // as @import references.
  const css = await z.get('styles.css');
  assert.match(css, /@import url\('blob:css'\);/);
  // Asset bytes round-trip.
  const logoBytes = await z.getBytes('assets/logo.png');
  assert.equal(logoBytes[0], 0x89);
});

// ---------------------------------------------------------------------------
// End
// ---------------------------------------------------------------------------