/**
 * @file Tests for the live-render pipeline.
 *
 *       Run with: `node --test src/engine/`
 *
 *       Covers:
 *         - extractDocumentParts: scripts/styles/links/title/meta
 *           preservation, head/body split, fragment input, comments,
 *           self-closing link tags, attribute parsing, script src vs
 *           inline content separation.
 *         - rewriteAssetUrls: src/href rewriting, single + double
 *           quotes, `./` prefix variants, CSS url() (quoted + unquoted),
 *           srcset with descriptors, script-body preservation (no
 *           false rewrites inside inline JS), absolute-URL pass-through.
 *         - buildLiveDocument: fragment wrapping, full-document pass-
 *           through, scripts + styles + links preserved, asset
 *           rewriting, title override, doctype override, viewport meta
 *           default, css injection on fragments.
 *
 *       Style: Node's built-in test runner, ESM, strict asserts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLiveDocument,
  rewriteAssetUrls,
  extractDocumentParts,
} from './live-render.js';

// ===========================================================================
// extractDocumentParts
// ===========================================================================

test('extractDocumentParts: parses a full document into parts', () => {
  const raw = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hello</title>
  <link rel="stylesheet" href="style.css" />
  <style>body { color: red; }</style>
</head>
<body>
  <h1>Hi</h1>
  <script src="app.js"></script>
</body>
</html>`;

  const p = extractDocumentParts(raw);
  assert.equal(p.doctype, '<!DOCTYPE html>');
  assert.match(p.headHtml, /<title[^>]*>Hello<\/title>/);
  assert.match(p.headHtml, /href="style\.css"/);
  assert.match(p.headHtml, /<style>body \{ color: red; \}<\/style>/);
  assert.match(p.bodyHtml, /<h1>Hi<\/h1>/);
  assert.match(p.bodyHtml, /<script src="app\.js"><\/script>/);
  assert.equal(p.title, 'Hello');
  assert.equal(p.scripts.length, 1);
  assert.equal(p.scripts[0].src, 'app.js');
  assert.equal(p.scripts[0].content, null);
  assert.equal(p.styles.length, 1);
  assert.equal(p.styles[0].content, 'body { color: red; }');
  assert.equal(p.links.length, 1);
  assert.equal(p.links[0].attrs.href, 'style.css');
  assert.equal(p.links[0].attrs.rel, 'stylesheet');
  assert.ok(p.metas.length >= 1, 'at least the charset meta is captured');
});

test('extractDocumentParts: separates inline vs external scripts', () => {
  const raw = `<html><head>
    <script src="ext1.js"></script>
  </head><body>
    <script>window.X = 1;</script>
    <script src="ext2.js"></script>
  </body></html>`;

  const p = extractDocumentParts(raw);
  assert.equal(p.scripts.length, 3);

  const [s1, s2, s3] = p.scripts;
  assert.equal(s1.src, 'ext1.js');
  assert.equal(s1.content, null);

  assert.equal(s2.src, null);
  assert.equal(s2.content, 'window.X = 1;');

  assert.equal(s3.src, 'ext2.js');
  assert.equal(s3.content, null);
});

test('extractDocumentParts: captures attribute map lowercased', () => {
  const raw = `<html><head>
    <script type="module" src="x.js" defer></script>
  </head><body></body></html>`;

  const p = extractDocumentParts(raw);
  const s = p.scripts[0];
  assert.equal(s.attrs.type, 'module');
  assert.equal(s.attrs.src, 'x.js');
  assert.equal(s.attrs.defer, true);
});

test('extractDocumentParts: handles missing <body> (head-only)', () => {
  const raw = `<html><head>
    <title>X</title>
    <link rel="stylesheet" href="a.css" />
  </head></html>`;

  const p = extractDocumentParts(raw);
  assert.equal(p.title, 'X');
  assert.equal(p.links.length, 1);
  assert.equal(p.bodyHtml.trim(), '');
});

test('extractDocumentParts: handles missing <head> (body-only)', () => {
  const raw = `<html><body><p>hi</p></body></html>`;
  const p = extractDocumentParts(raw);
  assert.match(p.bodyHtml, /<p>hi<\/p>/);
  assert.equal(p.title, null);
});

test('extractDocumentParts: handles a pure fragment with no <html>/<head>', () => {
  const raw = `<div class="x"><p>frag</p></div>`;
  const p = extractDocumentParts(raw);
  assert.match(p.bodyHtml, /<div class="x"><p>frag<\/p><\/div>/);
  assert.equal(p.title, null);
  assert.equal(p.scripts.length, 0);
});

test('extractDocumentParts: preserves HTML comments in head/body', () => {
  const raw = `<html><head><!-- top --><title>X</title></head><body><!-- body --><p>hi</p></body></html>`;
  const p = extractDocumentParts(raw);
  assert.match(p.headHtml, /<!-- top -->/);
  assert.match(p.bodyHtml, /<!-- body -->/);
});

test('extractDocumentParts: handles self-closing <link /> tag', () => {
  const raw = `<html><head>
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="main.css" />
  </head><body></body></html>`;

  const p = extractDocumentParts(raw);
  assert.equal(p.links.length, 2);
  assert.equal(p.links[0].attrs.rel, 'icon');
  assert.equal(p.links[0].attrs.href, '/favicon.ico');
  assert.equal(p.links[1].attrs.rel, 'stylesheet');
});

test('extractDocumentParts: handles <meta> tags with various attribute forms', () => {
  const raw = `<html><head>
    <meta charset="UTF-8">
    <meta name='description' content='a page'>
    <meta name=robots content=index,follow>
  </head><body></body></html>`;

  const p = extractDocumentParts(raw);
  assert.equal(p.metas.length, 3);
  assert.equal(p.metas[0].attrs.charset, 'UTF-8');
  assert.equal(p.metas[1].attrs.name, 'description');
  assert.equal(p.metas[1].attrs.content, 'a page');
  assert.equal(p.metas[2].attrs.name, 'robots');
  assert.equal(p.metas[2].attrs.content, 'index,follow');
});

test('extractDocumentParts: finds <title> even outside <head>', () => {
  const raw = `<title>Floating</title><body>x</body>`;
  const p = extractDocumentParts(raw);
  assert.equal(p.title, 'Floating');
});

test('extractDocumentParts: returns empty parts for empty input', () => {
  const p = extractDocumentParts('');
  assert.equal(p.doctype, '');
  assert.equal(p.headHtml, '');
  assert.equal(p.bodyHtml, '');
  assert.equal(p.title, null);
  assert.equal(p.scripts.length, 0);
  assert.equal(p.styles.length, 0);
  assert.equal(p.links.length, 0);
});

// ===========================================================================
// rewriteAssetUrls
// ===========================================================================

test('rewriteAssetUrls: rewrites <img src="...">', () => {
  const html = '<img src="foo.png">';
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  assert.equal(out, '<img src="blob:abc">');
});

test('rewriteAssetUrls: rewrites with single quotes', () => {
  const html = "<img src='foo.png'>";
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  assert.equal(out, "<img src='blob:abc'>");
});

test('rewriteAssetUrls: rewrites ./foo.png form', () => {
  const html = '<img src="./foo.png">';
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  assert.equal(out, '<img src="blob:abc">');
});

test('rewriteAssetUrls: matches "./foo.png" key as supplied', () => {
  const html = '<img src="foo.png">';
  const out = rewriteAssetUrls(html, { './foo.png': 'blob:abc' });
  assert.equal(out, '<img src="blob:abc">');
});

test('rewriteAssetUrls: rewrites href attribute (e.g. <link>, <a>)', () => {
  const html = '<link rel="stylesheet" href="main.css">';
  const out = rewriteAssetUrls(html, { 'main.css': 'blob:css-1' });
  assert.equal(out, '<link rel="stylesheet" href="blob:css-1">');
});

test('rewriteAssetUrls: rewrites CSS url("...") inside <style>', () => {
  const html = '<style>.a { background: url("bg.png"); }</style>';
  const out = rewriteAssetUrls(html, { 'bg.png': 'blob:bg' });
  assert.equal(out, '<style>.a { background: url("blob:bg"); }</style>');
});

test('rewriteAssetUrls: rewrites CSS url(\'...\') single-quoted', () => {
  const html = "<style>.a { background: url('bg.png'); }</style>";
  const out = rewriteAssetUrls(html, { 'bg.png': 'blob:bg' });
  assert.equal(out, "<style>.a { background: url('blob:bg'); }</style>");
});

test('rewriteAssetUrls: rewrites CSS url(...) unquoted', () => {
  const html = '<style>.a { background: url(./bg.png); }</style>';
  const out = rewriteAssetUrls(html, { 'bg.png': 'blob:bg' });
  assert.equal(out, '<style>.a { background: url(blob:bg); }</style>');
});

test('rewriteAssetUrls: rewrites @import url(...) form', () => {
  const html = '<style>@import url("theme.css");</style>';
  const out = rewriteAssetUrls(html, { 'theme.css': 'blob:theme' });
  assert.equal(out, '<style>@import url("blob:theme");</style>');
});

test('rewriteAssetUrls: rewrites srcset URLs while preserving descriptors', () => {
  const html = '<img srcset="small.png 1x, large.png 2x">';
  const out = rewriteAssetUrls(html, {
    'small.png': 'blob:small',
    'large.png': 'blob:large',
  });
  assert.equal(out, '<img srcset="blob:small 1x, blob:large 2x">');
});

test('rewriteAssetUrls: rewrites srcset with ./prefix and width descriptors', () => {
  const html = '<img srcset="./a.png 480w, ./b.png 960w" sizes="100vw">';
  const out = rewriteAssetUrls(html, {
    'a.png': 'blob:a',
    'b.png': 'blob:b',
  });
  assert.equal(out, '<img srcset="blob:a 480w, blob:b 960w" sizes="100vw">');
});

test('rewriteAssetUrls: leaves absolute http(s) URLs alone', () => {
  const html = '<img src="https://cdn.example.com/foo.png">';
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  assert.equal(out, html);
});

test('rewriteAssetUrls: leaves data: URIs alone', () => {
  const html = '<img src="data:image/png;base64,AAA">';
  const out = rewriteAssetUrls(html, { 'AAA': 'blob:abc' });
  assert.equal(out, html);
});

test('rewriteAssetUrls: does NOT rewrite inside <script> bodies', () => {
  const html = '<script>var s = "foo.png"; console.log(s);</script>';
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  // The literal "foo.png" string inside the JS must be preserved.
  assert.equal(out, html);
});

test('rewriteAssetUrls: does NOT rewrite URLs in inline JS that share the asset path', () => {
  const html = '<script src="app.js"></script><script>fetch("config.json")</script>';
  const out = rewriteAssetUrls(html, {
    'app.js': 'blob:app',
    'config.json': 'blob:cfg',
  });
  // External <script src> IS rewritten.
  assert.match(out, /<script src="blob:app"><\/script>/);
  // But the literal inside the inline script body is preserved.
  assert.match(out, /fetch\("config\.json"\)/);
  assert.doesNotMatch(out, /fetch\("blob:cfg"\)/);
});

test('rewriteAssetUrls: handles a real-ish page with multiple asset types', () => {
  const html = `<!DOCTYPE html>
<html><head>
  <link rel="stylesheet" href="./main.css">
  <link rel="icon" href="favicon.ico">
  <style>.a { background: url(./bg.png); }</style>
</head><body>
  <img src="./logo.png" srcset="./logo.png 1x, ./logo@2x.png 2x">
  <script src="./app.js"></script>
  <script>const x = "./bg.png";</script>
</body></html>`;
  const out = rewriteAssetUrls(html, {
    'main.css': 'blob:main',
    'favicon.ico': 'blob:fav',
    'bg.png': 'blob:bg',
    'logo.png': 'blob:logo1x',
    'logo@2x.png': 'blob:logo2x',
    'app.js': 'blob:app',
  });

  assert.match(out, /href="blob:main"/);
  assert.match(out, /href="blob:fav"/);
  assert.match(out, /url\(blob:bg\)/);
  assert.match(out, /src="blob:logo1x"/);
  assert.match(out, /srcset="blob:logo1x 1x, blob:logo2x 2x"/);
  assert.match(out, /<script src="blob:app"><\/script>/);
  // Inline JS body preserved.
  assert.match(out, /const x = "\.\/bg\.png";/);
});

test('rewriteAssetUrls: returns input unchanged for empty asset map', () => {
  const html = '<img src="foo.png">';
  assert.equal(rewriteAssetUrls(html, {}), html);
  assert.equal(rewriteAssetUrls(html, new Map()), html);
});

test('rewriteAssetUrls: accepts a Map asset map', () => {
  const html = '<img src="foo.png">';
  const m = new Map([['foo.png', 'blob:abc']]);
  const out = rewriteAssetUrls(html, m);
  assert.equal(out, '<img src="blob:abc">');
});

test('rewriteAssetUrls: handles nested asset paths', () => {
  const html = '<img src="./assets/images/hero.png">';
  const out = rewriteAssetUrls(html, {
    'assets/images/hero.png': 'blob:hero',
  });
  assert.equal(out, '<img src="blob:hero">');
});

test('rewriteAssetUrls: is idempotent (rewriting twice yields same result)', () => {
  const html = '<img src="foo.png">';
  const once = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  // The second pass would only rewrite `foo.png` if it appeared again —
  // it shouldn't, because the URL has already become a blob:.
  const twice = rewriteAssetUrls(once, { 'foo.png': 'blob:abc' });
  assert.equal(twice, once);
});

test('rewriteAssetUrls: leaves unknown relative URLs alone', () => {
  const html = '<img src="other.png">';
  const out = rewriteAssetUrls(html, { 'foo.png': 'blob:abc' });
  assert.equal(out, html);
});

// ===========================================================================
// buildLiveDocument
// ===========================================================================

test('buildLiveDocument: wraps a fragment in a minimal document shell', () => {
  const out = buildLiveDocument({ html: '<p>hi</p>' });
  assert.match(out, /^<!DOCTYPE html>/);
  assert.match(out, /<html lang="en">/);
  assert.match(out, /<meta charset="UTF-8" \/>/);
  assert.match(out, /<meta name="viewport"[^>]*\/>/);
  assert.match(out, /<body>\n<p>hi<\/p>\n<\/body>/);
});

test('buildLiveDocument: fragment with css emits a <style> block in head', () => {
  const out = buildLiveDocument({
    html: '<p>hi</p>',
    css: '.a { color: red; }',
  });
  assert.match(out, /<style>\n\.a \{ color: red; \}\n<\/style>/);
  assert.match(out, /<body>\n<p>hi<\/p>\n<\/body>/);
});

test('buildLiveDocument: full document preserves <script> tags verbatim', () => {
  const raw = `<!DOCTYPE html>
<html><head><title>T</title></head><body>
  <p>hello</p>
  <script>window.X = 1;</script>
  <script src="app.js"></script>
</body></html>`;
  const out = buildLiveDocument({ html: raw });
  assert.match(out, /<script>window\.X = 1;<\/script>/);
  assert.match(out, /<script src="app\.js"><\/script>/);
  assert.match(out, /<title>T<\/title>/);
});

test('buildLiveDocument: full document preserves <link rel=stylesheet>', () => {
  const raw = `<html><head>
    <link rel="stylesheet" href="https://cdn.example.com/x.css">
    <link rel="stylesheet" href="local.css">
  </head><body></body></html>`;
  const out = buildLiveDocument({ html: raw });
  assert.match(out, /<link rel="stylesheet" href="https:\/\/cdn\.example\.com\/x\.css"/);
  assert.match(out, /<link rel="stylesheet" href="local\.css"/);
});

test('buildLiveDocument: full document preserves <style> tags verbatim', () => {
  const raw = `<html><head>
    <style>body { background: black; }</style>
  </head><body></body></html>`;
  const out = buildLiveDocument({ html: raw });
  assert.match(out, /<style>body \{ background: black; \}<\/style>/);
});

test('buildLiveDocument: full document extracts <title>', () => {
  const raw = `<html><head><title>My page</title></head><body></body></html>`;
  const out = buildLiveDocument({ html: raw });
  assert.match(out, /<title>My page<\/title>/);
});

test('buildLiveDocument: full document with assets rewrites src/href/url()', () => {
  const raw = `<html><head>
    <link rel="stylesheet" href="./main.css">
    <style>.bg { background: url(./bg.png); }</style>
  </head><body>
    <img src="./logo.png">
  </body></html>`;
  const out = buildLiveDocument({
    html: raw,
    assets: {
      'main.css': 'blob:main-css',
      'bg.png': 'blob:bg-png',
      'logo.png': 'blob:logo-png',
    },
  });
  assert.match(out, /<link rel="stylesheet" href="blob:main-css"/);
  assert.match(out, /url\(blob:bg-png\)/);
  assert.match(out, /<img src="blob:logo-png"/);
});

test('buildLiveDocument: full document with assets does NOT rewrite script bodies', () => {
  const raw = `<html><head></head><body>
    <script>var s = "./bg.png";</script>
    <script src="./app.js"></script>
  </body></html>`;
  const out = buildLiveDocument({
    html: raw,
    assets: {
      'app.js': 'blob:app-js',
      'bg.png': 'blob:bg-png',
    },
  });
  // External script src IS rewritten.
  assert.match(out, /<script src="blob:app-js"><\/script>/);
  // Inline script body string literal is NOT rewritten.
  assert.match(out, /var s = "\.\/bg\.png";/);
  assert.doesNotMatch(out, /var s = "blob:bg-png"/);
});

test('buildLiveDocument: title override wins over document title', () => {
  const raw = `<html><head><title>Old</title></head><body></body></html>`;
  const out = buildLiveDocument({ html: raw, title: 'New' });
  // The override should appear in the output.
  assert.match(out, /<title>New<\/title>/);
  assert.doesNotMatch(out, /<title>Old<\/title>/);
});

test('buildLiveDocument: doctype override is applied to a fragment', () => {
  const out = buildLiveDocument({
    html: '<p>hi</p>',
    doctype: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">',
  });
  assert.match(out, /^<!DOCTYPE html PUBLIC /);
});

test('buildLiveDocument: existing viewport meta is preserved, not duplicated', () => {
  const raw = `<html><head>
    <meta name="viewport" content="width=1024" />
  </head><body></body></html>`;
  const out = buildLiveDocument({ html: raw });
  // The original viewport meta should still be there.
  assert.match(out, /<meta name="viewport" content="width=1024" \/>/);
  // And we shouldn't have added a second one.
  const count = (out.match(/<meta name="viewport"/g) || []).length;
  assert.equal(count, 1);
});

test('buildLiveDocument: charset meta is added even when input is full doc without one', () => {
  // Many minimalist exports omit charset. We always set one.
  const raw = `<html><head><title>X</title></head><body></body></html>`;
  const out = buildLiveDocument({ html: raw });
  assert.match(out, /<meta charset="UTF-8" \/>/);
});

test('buildLiveDocument: extra css is injected even when input is a full doc', () => {
  const raw = `<html><head><title>X</title></head><body><p>hi</p></body></html>`;
  const out = buildLiveDocument({ html: raw, css: '.x { color: blue; }' });
  assert.match(out, /<style>\n\.x \{ color: blue; \}\n<\/style>/);
});

test('buildLiveDocument: scripts after </body> are appended at the end', () => {
  const raw = `<html><head><title>X</title></head><body><p>hi</p></body>
<script>console.log('pixel');</script></html>`;
  const out = buildLiveDocument({ html: raw });
  // The trailing script should still be in the document.
  assert.match(out, /<script>console\.log\('pixel'\);<\/script>/);
});

test('buildLiveDocument: returns a string and starts with a doctype', () => {
  const out = buildLiveDocument({ html: '<p>x</p>' });
  assert.equal(typeof out, 'string');
  assert.ok(out.startsWith('<!DOCTYPE'));
});

test('buildLiveDocument: throws if html is missing or not a string', () => {
  assert.throws(() => buildLiveDocument(), /html/);
  assert.throws(() => buildLiveDocument({ html: 123 }), /html/);
  assert.throws(() => buildLiveDocument({ html: null }), /html/);
});

// ===========================================================================
// Cross-cutting / integration
// ===========================================================================

test('integration: round-trip a real-ish site through the full pipeline', () => {
  const raw = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo</title>
  <link rel="stylesheet" href="./style.css">
  <style>
    body { font-family: system-ui; }
    .hero { background: url('./hero.png') center/cover; }
  </style>
</head>
<body>
  <header><img src="./logo.svg" alt=""></header>
  <main>
    <h1>Hello</h1>
    <picture>
      <source srcset="./small.webp 480w, ./large.webp 960w" type="image/webp">
      <img src="./fallback.jpg" alt="">
    </picture>
  </main>
  <script>
    // Inline JS with a string literal that happens to contain a path.
    const debugAsset = './hero.png';
    console.log(debugAsset);
  </script>
  <script src="./app.js" defer></script>
</body>
</html>`;

  const assetMap = {
    'style.css': 'blob:style-css',
    'hero.png': 'blob:hero-png',
    'logo.svg': 'blob:logo-svg',
    'small.webp': 'blob:small-webp',
    'large.webp': 'blob:large-webp',
    'fallback.jpg': 'blob:fallback-jpg',
    'app.js': 'blob:app-js',
  };

  const out = buildLiveDocument({ html: raw, assets: assetMap });

  // Doctype + html root.
  assert.ok(out.startsWith('<!DOCTYPE html>'));
  assert.match(out, /<html lang="en">/);

  // Title preserved.
  assert.match(out, /<title>Demo<\/title>/);

  // Stylesheet link rewritten.
  assert.match(out, /<link rel="stylesheet" href="blob:style-css"/);

  // CSS url() rewritten inside <style>.
  assert.match(out, /url\('blob:hero-png'\)/);

  // Body content preserved.
  assert.match(out, /<h1>Hello<\/h1>/);

  // img src rewritten.
  assert.match(out, /<img src="blob:logo-svg"/);
  assert.match(out, /<img src="blob:fallback-jpg"/);

  // srcset rewritten with descriptors preserved.
  assert.match(out, /srcset="blob:small-webp 480w, blob:large-webp 960w"/);

  // Inline script body untouched (the literal './hero.png' is still there).
  assert.match(out, /const debugAsset = '\.\/hero\.png';/);
  assert.doesNotMatch(out, /const debugAsset = 'blob:hero-png'/);

  // External script src rewritten, but script preserved.
  assert.match(out, /<script src="blob:app-js" defer><\/script>/);

  // The original `hero.png` plain reference (without blob:) does NOT
  // survive anywhere except inside the inline JS string literal and
  // any non-rewritten place. We check for accidental leak by ensuring
  // every `src="hero.png"` (no blob) attribute-style match has been
  // replaced.
  assert.doesNotMatch(out, /src="\.\/hero\.png"/);
  assert.doesNotMatch(out, /href="\.\/hero\.png"/);
});
