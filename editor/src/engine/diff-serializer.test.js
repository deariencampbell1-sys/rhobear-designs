/**
 * @file Tests for the diff serializer.
 *
 *       Covers:
 *         - applyOverrides: empty-store no-op safety, html unchanged,
 *           override block appended to css, scripts preserved, multiple
 *           overrides fold correctly
 *         - summarizeChanges: empty store, current-only records (no
 *           baseline), edited/added/removed records (with baseline),
 *           stable output ordering
 *         - end-to-end: original page + override store → clean export
 *           with original CSS intact and override CSS appended
 *
 *       Run with: `node --test src/engine/*.test.js` (from editor/)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createOverrideStore, toStylesheet } from './style-overrides.js';
import { applyOverrides, summarizeChanges } from './diff-serializer.js';

// ---------------------------------------------------------------------------
// applyOverrides — no-op safety
// ---------------------------------------------------------------------------

test('applyOverrides: empty store returns input byte-equivalent (no-op safety)', () => {
  const input = {
    html: '<header><h1>Hi</h1></header><main><p>World</p></main>',
    css: 'body { margin: 0; }\nh1 { color: blue; }',
  };
  const store = createOverrideStore();
  const out = applyOverrides(input, store);
  assert.equal(out.html, input.html);
  assert.equal(out.css, input.css);
});

test('applyOverrides: empty input fields are tolerated', () => {
  const store = createOverrideStore();
  store.setStyle('#x', 'color', 'red');
  // Missing fields → treated as empty strings; override still applied.
  assert.deepEqual(applyOverrides({}, store), { html: '', css: '/* RHOBEAR editor overrides — non-destructive layer */\n#x{color:red}' });
  assert.deepEqual(applyOverrides({ html: '<p/>' }, store), {
    html: '<p/>',
    css: '/* RHOBEAR editor overrides — non-destructive layer */\n#x{color:red}',
  });
  assert.deepEqual(applyOverrides({ css: '/* base */' }, store), {
    html: '',
    css: '/* base */\n\n/* RHOBEAR editor overrides — non-destructive layer */\n#x{color:red}',
  });
});

test('applyOverrides: null/undefined store does not throw and returns input', () => {
  const input = { html: '<p/>', css: 'body{margin:0}' };
  assert.deepEqual(applyOverrides(input, null), input);
  assert.deepEqual(applyOverrides(input, undefined), input);
});

// ---------------------------------------------------------------------------
// applyOverrides — folding behavior
// ---------------------------------------------------------------------------

test('applyOverrides: html is byte-equivalent, override block appended to css', () => {
  const input = {
    html: '<section><h1>Title</h1></section>',
    css: 'h1 { color: blue; }',
  };
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  const out = applyOverrides(input, store);
  // html preserved verbatim.
  assert.equal(out.html, input.html);
  // css keeps the original and appends the override block.
  assert.match(out.css, /^h1 \{ color: blue; \}/);
  assert.match(out.css, /RHOBEAR editor overrides/);
  assert.match(out.css, /h1\{color:red\}/);
});

test('applyOverrides: override block comes AFTER the original CSS', () => {
  const input = { html: '<p/>', css: 'p{margin:0}' };
  const store = createOverrideStore();
  store.setStyle('p', 'color', 'red');
  const out = applyOverrides(input, store);
  const idxOrig = out.css.indexOf('p{margin:0}');
  const idxOver = out.css.indexOf('p{color:red}');
  assert.ok(idxOrig >= 0 && idxOver > idxOrig,
    'override rule must come AFTER the original rule (so it wins equal-specificity ties)');
});

test('applyOverrides: preserves <script> tags verbatim in the html', () => {
  const input = {
    html:
      '<header><h1>Title</h1>' +
      '<script src="https://example.test/analytics.js"></script>' +
      '<script>window.__RHOBEAR__ = { v: 1 };</script>' +
      '</header>',
    css: '',
  };
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  const out = applyOverrides(input, store);
  // Scripts preserved, untouched, in order.
  assert.match(out.html, /<script src="https:\/\/example\.test\/analytics\.js"><\/script>/);
  assert.match(out.html, /<script>window\.__RHOBEAR__ = \{ v: 1 \};<\/script>/);
  // No script content moved into css.
  assert.equal(out.css.includes('RHOBEAR__'), false);
  assert.equal(out.css.includes('analytics'), false);
});

test('applyOverrides: preserves arbitrary markup including comments and doctype', () => {
  const input = {
    html: '<!-- page -->\n<section><p>hi</p></section>',
    css: 'p { padding: 0; }',
  };
  const store = createOverrideStore();
  store.setStyle('p', 'margin', '8px');
  const out = applyOverrides(input, store);
  assert.equal(out.html, input.html);
});

test('applyOverrides: appends override header once per call, even with multiple rules', () => {
  const store = createOverrideStore();
  store.setStyle('.a', 'color', 'red');
  store.setStyle('.b', 'color', 'blue');
  store.setStyle('#c', 'color', 'green');
  const out = applyOverrides({ html: '', css: '' }, store);
  const headerMatches = out.css.match(/RHOBEAR editor overrides/g) || [];
  assert.equal(headerMatches.length, 1);
});

test('applyOverrides: trailing whitespace in original css is normalized', () => {
  const input = { html: '', css: 'p{margin:0}\n\n\n  \t\n' };
  const store = createOverrideStore();
  store.setStyle('p', 'color', 'red');
  const out = applyOverrides(input, store);
  // Original block must NOT have trailing whitespace, and the override
  // header must follow a clean blank line.
  assert.match(out.css, /p\{margin:0\}\n\n\/\* RHOBEAR editor overrides/);
});

test('applyOverrides: empty original css still gets the header', () => {
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  const out = applyOverrides({ html: '', css: '' }, store);
  assert.match(out.css, /^\/\* RHOBEAR editor overrides — non-destructive layer \*\/\n/);
  assert.match(out.css, /h1\{color:red\}/);
});

test('applyOverrides: equivalent output via toStylesheet appears in css', () => {
  // The css field of the output should contain exactly what toStylesheet
  // produces (preceded by the header). Independent verification.
  const store = createOverrideStore();
  store.setStyle('#hero', 'color', '#fff');
  store.setStyle('.card', 'padding', '16px');
  const out = applyOverrides({ html: '<main/>', css: '' }, store);
  const expectedSheet = toStylesheet(store);
  assert.ok(out.css.includes(expectedSheet),
    'output css should contain exactly the override stylesheet body');
});

test('applyOverrides: same selector / multiple props — last write wins via sheet order', () => {
  const store = createOverrideStore();
  store.setStyle('h1', 'color', 'red');
  store.setStyle('h1', 'color', 'blue'); // overwrite
  store.setStyle('h1', 'font-size', '24px');
  const out = applyOverrides({ html: '', css: '' }, store);
  // Single rule for h1 with both props; latest color wins.
  assert.match(out.css, /h1\{color:blue;font-size:24px\}/);
});

// ---------------------------------------------------------------------------
// End-to-end: original page + edits → clean export
// ---------------------------------------------------------------------------

test('end-to-end: original page preserved + overrides folded in', () => {
  // Simulates the export path: take an original {html, css} bundle
  // (the live site's untouched representation) and apply a user's
  // override store.
  const original = {
    html:
      '<header id="hero"><h1>Welcome</h1></header>' +
      '<main><section class="card"><h2>Title</h2><p>Body</p></section></main>' +
      '<script src="/assets/site.js"></script>',
    css:
      '/* original site styles */\n' +
      'body { font-family: system-ui, sans-serif; margin: 0; }\n' +
      '#hero { background: #000; color: #fff; padding: 24px; }\n' +
      '.card { padding: 16px; border: 1px solid #ccc; }\n' +
      'h1 { font-size: 32px; }\n' +
      'h2 { font-size: 24px; }',
  };

  const store = createOverrideStore();
  store.setStyle('#hero', 'background', '#222');   // tweak hero bg
  store.setStyle('#hero', 'padding', '48px 24px');
  store.setStyle('.card', 'padding', '24px');       // bump card padding
  store.setStyle('.card', 'border-radius', '12px');
  store.setStyle('h2', 'margin-bottom', '24px');   // extra space under h2

  const exported = applyOverrides(original, store);

  // Markup byte-equal — including the <script> tag.
  assert.equal(exported.html, original.html);

  // Original CSS appears verbatim.
  assert.match(exported.css, /original site styles/);
  assert.match(exported.css, /body \{ font-family: system-ui, sans-serif; margin: 0; \}/);
  assert.match(exported.css, /#hero \{ background: #000; color: #fff; padding: 24px; \}/);

  // Override rules are appended after the original CSS.
  const idxHeader = exported.css.indexOf('RHOBEAR editor overrides');
  const idxOrigEnd = exported.css.lastIndexOf('}', idxHeader); // last } of original
  assert.ok(idxOrigEnd > -1 && idxHeader > idxOrigEnd,
    'override header must come AFTER the original CSS block');
  assert.match(exported.css, /#hero\{background:#222;padding:48px 24px\}/);
  assert.match(exported.css, /\.card\{padding:24px;border-radius:12px\}/);
  assert.match(exported.css, /h2\{margin-bottom:24px\}/);
});

test('end-to-end: empty store keeps the original page untouched', () => {
  const original = {
    html: '<header><h1>Untouched</h1></header>',
    css: 'h1 { color: green; }',
  };
  const store = createOverrideStore();
  const out = applyOverrides(original, store);
  assert.equal(out.html, original.html);
  assert.equal(out.css, original.css);
  // No override header introduced.
  assert.equal(out.css.includes('RHOBEAR editor overrides'), false);
});

// ---------------------------------------------------------------------------
// summarizeChanges — current-only
// ---------------------------------------------------------------------------

test('summarizeChanges: empty store with no baseline → empty list', () => {
  const store = createOverrideStore();
  assert.deepEqual(summarizeChanges(store), []);
});

test('summarizeChanges: invalid store → empty list', () => {
  assert.deepEqual(summarizeChanges(null), []);
  assert.deepEqual(summarizeChanges(undefined), []);
  assert.deepEqual(summarizeChanges({}), []);
});

test('summarizeChanges: current overrides are reported with `to`, no `from`', () => {
  const store = createOverrideStore();
  store.setStyle('#a', 'color', 'red');
  store.setStyle('.b', 'padding', '16px');
  const changes = summarizeChanges(store);
  assert.equal(changes.length, 2);
  // Output is sorted by selector (ASCII) then by prop (ASCII).
  // '#' (0x23) sorts BEFORE '.' (0x2E), so '#a' precedes '.b'.
  assert.deepEqual(changes[0], { selector: '#a', prop: 'color',   to: 'red' });
  assert.deepEqual(changes[1], { selector: '.b', prop: 'padding', to: '16px' });
  for (const c of changes) assert.equal('from' in c, false);
});

test('summarizeChanges: same store as baseline → no changes', () => {
  const a = createOverrideStore();
  a.setStyle('#x', 'color', 'red');
  const b = createOverrideStore();
  b.fromJSON(a.toJSON());
  assert.deepEqual(summarizeChanges(b, a), []);
});

// ---------------------------------------------------------------------------
// summarizeChanges — diff against a baseline
// ---------------------------------------------------------------------------

test('summarizeChanges: edited property → record with from + to', () => {
  const before = createOverrideStore();
  before.setStyle('#a', 'color', 'red');
  const after = createOverrideStore();
  after.fromJSON(before.toJSON());
  after.setStyle('#a', 'color', 'blue');
  const changes = summarizeChanges(after, before);
  assert.deepEqual(changes, [{ selector: '#a', prop: 'color', from: 'red', to: 'blue' }]);
});

test('summarizeChanges: added property → record with to, no from', () => {
  const before = createOverrideStore();
  before.setStyle('#a', 'color', 'red');
  const after = createOverrideStore();
  after.fromJSON(before.toJSON());
  after.setStyle('#a', 'width', '10px');
  const changes = summarizeChanges(after, before);
  assert.deepEqual(changes, [{ selector: '#a', prop: 'width', to: '10px' }]);
});

test('summarizeChanges: removed property → record with from, no to', () => {
  const before = createOverrideStore();
  before.setStyle('#a', 'color', 'red');
  before.setStyle('#a', 'width', '10px');
  const after = createOverrideStore();
  after.fromJSON(before.toJSON());
  after.removeOverride('#a', 'width');
  const changes = summarizeChanges(after, before);
  assert.deepEqual(changes, [{ selector: '#a', prop: 'width', from: '10px' }]);
});

test('summarizeChanges: full diff (edit + add + remove across selectors)', () => {
  const before = createOverrideStore();
  before.setStyle('#a', 'color', 'red');
  before.setStyle('#a', 'width', '10px');
  before.setStyle('.b', 'padding', '8px');
  const after = createOverrideStore();
  after.fromJSON(before.toJSON());
  // Edit: #a color red → blue
  after.setStyle('#a', 'color', 'blue');
  // Add:  #a height 100px
  after.setStyle('#a', 'height', '100px');
  // Remove: #a width
  after.removeOverride('#a', 'width');
  // Remove: .b padding
  after.removeOverride('.b', 'padding');

  const changes = summarizeChanges(after, before);
  // Sorted by selector (ASCII — '#' before '.'), then by prop.
  assert.deepEqual(changes, [
    { selector: '#a', prop: 'color',   from: 'red',   to: 'blue' },
    { selector: '#a', prop: 'height',                to: '100px' },
    { selector: '#a', prop: 'width',   from: '10px' },
    { selector: '.b', prop: 'padding', from: '8px' },
  ]);
});

test('summarizeChanges: equal values are not a change', () => {
  const before = createOverrideStore();
  before.setStyle('#a', 'color', 'red');
  const after = createOverrideStore();
  after.fromJSON(before.toJSON());
  // Re-setting to the same value should NOT appear in the diff.
  after.setStyle('#a', 'color', 'red');
  assert.deepEqual(summarizeChanges(after, before), []);
});

test('summarizeChanges: null/undefined baseline behaves like no baseline', () => {
  const store = createOverrideStore();
  store.setStyle('#a', 'color', 'red');
  assert.deepEqual(summarizeChanges(store, null),
    summarizeChanges(store));
  assert.deepEqual(summarizeChanges(store, undefined),
    summarizeChanges(store));
});

test('summarizeChanges: invalid baseline (non-store object) is treated as empty', () => {
  const store = createOverrideStore();
  store.setStyle('#a', 'color', 'red');
  // Anything without toJSON is treated as "no baseline" — so the
  // returned records describe the current state.
  assert.deepEqual(summarizeChanges(store, {}), summarizeChanges(store));
});
