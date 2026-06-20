/**
 * @file Tests for the style-override store + CSS emitter.
 *
 *       Covers:
 *         - specificity() for the common selector shapes used by the
 *           editor (ids, classes, tags, attributes, pseudo-classes,
 *           pseudo-elements, combinators, :not / :is / :where)
 *         - prop / value validation (rejects structural injection chars)
 *         - createOverrideStore CRUD: setStyle, setStyles, removeOverride,
 *           getOverridesFor, getSelectors, hasOverrides, size, clear
 *         - toJSON / fromJSON round-trip
 *         - toStylesheet(): empty, single rule, ascending specificity
 *           ordering, same-specificity insertion-order tiebreak
 *
 *       Run with: `node --test src/engine/*.test.js` (from editor/)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  specificity,
  isValidPropName,
  isValidValue,
  createOverrideStore,
  toStylesheet,
} from './style-overrides.js';

// ---------------------------------------------------------------------------
// specificity()
// ---------------------------------------------------------------------------

test('specificity: id selector', () => {
  assert.deepEqual(specificity('#header'), [1, 0, 0]);
  assert.deepEqual(specificity('#a #b'), [2, 0, 0]);
});

test('specificity: class selector', () => {
  assert.deepEqual(specificity('.card'), [0, 1, 0]);
  assert.deepEqual(specificity('.a.b.c'), [0, 3, 0]);
});

test('specificity: tag / type selector', () => {
  assert.deepEqual(specificity('div'), [0, 0, 1]);
  assert.deepEqual(specificity('main section'), [0, 0, 2]);
});

test('specificity: combined id + class + tag', () => {
  assert.deepEqual(specificity('main .card'), [0, 1, 1]);
  assert.deepEqual(specificity('#hero .title'), [1, 1, 0]);
  assert.deepEqual(specificity('div.hero#title'), [1, 1, 1]);
});

test('specificity: attribute selector counts as class', () => {
  assert.deepEqual(specificity('[data-x]'), [0, 1, 0]);
  assert.deepEqual(specificity('[data-x="y"]'), [0, 1, 0]);
  assert.deepEqual(specificity('input[required][disabled]'), [0, 2, 1]);
});

test('specificity: pseudo-class counts as class', () => {
  assert.deepEqual(specificity(':hover'), [0, 1, 0]);
  assert.deepEqual(specificity(':first-child'), [0, 1, 0]);
  assert.deepEqual(specificity('a:hover'), [0, 1, 1]);
});

test('specificity: pseudo-element counts as type', () => {
  assert.deepEqual(specificity('::before'), [0, 0, 1]);
  assert.deepEqual(specificity('p::after'), [0, 0, 2]);
});

test('specificity: universal selector contributes nothing', () => {
  assert.deepEqual(specificity('*'), [0, 0, 0]);
  assert.deepEqual(specificity('* .card'), [0, 1, 0]);
});

test('specificity: combinators do not add to specificity', () => {
  assert.deepEqual(specificity('div > p'), [0, 0, 2]);
  assert.deepEqual(specificity('h1 + p'), [0, 0, 2]);
  assert.deepEqual(specificity('h1 ~ p'), [0, 0, 2]);
});

test('specificity: descendant combinator', () => {
  assert.deepEqual(specificity('body main section .card'), [0, 1, 3]);
});

test('specificity: :not() uses highest arg specificity', () => {
  assert.deepEqual(specificity(':not(.a)'), [0, 1, 0]);
  assert.deepEqual(specificity(':not(#a)'), [1, 0, 0]);
  // Per CSS Selectors L4, :not(X) uses the HIGHEST specificity of its
  // argument selectors. #b (id) beats .a (class) regardless of order,
  // so the resulting specificity is [1,0,0], not [1,1,0].
  assert.deepEqual(specificity(':not(.a, #b)'), [1, 0, 0]);
  // Equal-id tie-break falls through to classes.
  assert.deepEqual(specificity(':not(#a, #b.x)'), [1, 1, 0]);
});

test('specificity: :is() / :matches() use highest arg specificity', () => {
  assert.deepEqual(specificity(':is(.a, #b)'), [1, 0, 0]);
  // div is [0,0,1] and .x is [0,1,0] — .x wins.
  assert.deepEqual(specificity(':matches(div, .x)'), [0, 1, 0]);
});

test('specificity: :where() contributes zero', () => {
  assert.deepEqual(specificity(':where(.a)'), [0, 0, 0]);
  assert.deepEqual(specificity(':where(#a, .b)'), [0, 0, 0]);
  assert.deepEqual(specificity('div :where(.a)'), [0, 0, 1]);
});

test('specificity: :nth-child() counts as a single class', () => {
  assert.deepEqual(specificity(':nth-child(2n+1)'), [0, 1, 0]);
  assert.deepEqual(specificity('li:nth-child(odd)'), [0, 1, 1]);
});

test('specificity: :has() uses highest arg specificity', () => {
  assert.deepEqual(specificity(':has(.x)'), [0, 1, 0]);
  assert.deepEqual(specificity(':has(img)'), [0, 0, 1]);
});

test('specificity: :lang(en) counts as class', () => {
  assert.deepEqual(specificity(':lang(en)'), [0, 1, 0]);
});

test('specificity: complex real-world selector', () => {
  // body.dark-mode #app > main .card.title[data-id="x"]:hover::before
  //   ids: #app                                        → 1
  //   classes/attrs/pseudo-classes:
  //     .dark-mode, .card, .title, [data-id="x"], :hover → 5
  //   types/pseudo-elements: body, main, ::before      → 3
  assert.deepEqual(
    specificity('body.dark-mode #app > main .card.title[data-id="x"]:hover::before'),
    [1, 5, 3],
  );
});

test('specificity: ordering — id > class > tag', () => {
  const tag = specificity('div');
  const cls = specificity('.x');
  const id = specificity('#x');
  // Compare lexicographically.
  const lexCmp = (a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  };
  assert.ok(lexCmp(id, cls) > 0);
  assert.ok(lexCmp(cls, tag) > 0);
  assert.ok(lexCmp(id, tag) > 0);
});

test('specificity: non-string input returns zero', () => {
  assert.deepEqual(specificity(undefined), [0, 0, 0]);
  assert.deepEqual(specificity(null), [0, 0, 0]);
  assert.deepEqual(specificity(42), [0, 0, 0]);
});

test('specificity: top-level comma stops parsing (list-aware)', () => {
  // Comma-separated lists: this function returns the specificity of the
  // FIRST selector. Callers dealing with lists should split first and
  // take the max of the parts.
  assert.deepEqual(specificity('#a, #b'), [1, 0, 0]);
  assert.deepEqual(specificity('.x, .y.z'), [0, 1, 0]);
  assert.deepEqual(specificity('div, .card'), [0, 0, 1]);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test('isValidPropName: accepts common property names', () => {
  assert.equal(isValidPropName('color'), true);
  assert.equal(isValidPropName('font-size'), true);
  assert.equal(isValidPropName('background-color'), true);
  assert.equal(isValidPropName('--custom-prop'), true);
  assert.equal(isValidPropName('-webkit-foo'), true);
});

test('isValidPropName: rejects structural injection', () => {
  assert.equal(isValidPropName(''), false);
  assert.equal(isValidPropName('color;'), false);
  assert.equal(isValidPropName('col:or'), false);
  assert.equal(isValidPropName('a}b'), false);
  assert.equal(isValidPropName('a{b'), false);
  assert.equal(isValidPropName('a\nb'), false);
  assert.equal(isValidPropName('1color'), false); // can't start with digit
  assert.equal(isValidPropName('color red'), false); // spaces
  assert.equal(isValidPropName(null), false);
  assert.equal(isValidPropName(undefined), false);
});

test('isValidValue: accepts common values', () => {
  assert.equal(isValidValue('red'), true);
  assert.equal(isValidValue('16px'), true);
  assert.equal(isValidValue('rgba(0,0,0,0.5)'), true);
  assert.equal(isValidValue('calc(100% - 8px)'), true);
  assert.equal(isValidValue('#abc'), true);
  assert.equal(isValidValue('"with quotes"'), true);
});

test('isValidValue: rejects structural injection', () => {
  assert.equal(isValidValue(''), false);
  assert.equal(isValidValue('red;'), false);
  assert.equal(isValidValue('a}b'), false);
  assert.equal(isValidValue('a{b'), false);
  assert.equal(isValidValue('a\nb'), false);
  assert.equal(isValidValue('a\rb'), false);
  assert.equal(isValidValue(null), false);
  assert.equal(isValidValue(undefined), false);
});

// ---------------------------------------------------------------------------
// createOverrideStore() — CRUD
// ---------------------------------------------------------------------------

test('store: fresh store is empty', () => {
  const s = createOverrideStore();
  assert.equal(s.hasOverrides(), false);
  assert.equal(s.size(), 0);
  assert.deepEqual(s.getSelectors(), []);
  assert.deepEqual(s.getOverridesFor('#x'), {});
});

test('store: setStyle adds an override and is reported by getters', () => {
  const s = createOverrideStore();
  assert.equal(s.setStyle('#header', 'color', 'red'), true);
  assert.equal(s.hasOverrides(), true);
  assert.equal(s.size(), 1);
  assert.deepEqual(s.getSelectors(), ['#header']);
  assert.deepEqual(s.getOverridesFor('#header'), { color: 'red' });
});

test('store: setStyle overwrites the same prop', () => {
  const s = createOverrideStore();
  s.setStyle('#header', 'color', 'red');
  s.setStyle('#header', 'color', 'blue');
  assert.equal(s.size(), 1);
  assert.deepEqual(s.getOverridesFor('#header'), { color: 'blue' });
});

test('store: setStyle coerces non-string values', () => {
  const s = createOverrideStore();
  s.setStyle('.box', 'width', 16);          // number
  s.setStyle('.box', 'opacity', 0.5);        // number
  assert.equal(s.getOverridesFor('.box').width, '16');
  assert.equal(s.getOverridesFor('.box').opacity, '0.5');
});

test('store: setStyle rejects invalid inputs', () => {
  const s = createOverrideStore();
  assert.equal(s.setStyle('', 'color', 'red'), false);
  assert.equal(s.setStyle(null, 'color', 'red'), false);
  assert.equal(s.setStyle(undefined, 'color', 'red'), false);
  assert.equal(s.setStyle('#x', '', 'red'), false);
  assert.equal(s.setStyle('#x', 'color;', 'red'), false);
  assert.equal(s.setStyle('#x', 'color', null), false);
  assert.equal(s.setStyle('#x', 'color', undefined), false);
  assert.equal(s.setStyle('#x', 'color', 'bad;val'), false); // value w/ ;
  assert.equal(s.size(), 0);
});

test('store: setStyle rejects prototype-pollution selector keys', () => {
  // Defense-in-depth: the store round-trips through toJSON() which
  // builds a plain object. Blocking these keys prevents an attacker
  // (or accidental input) from mutating Object.prototype on the
  // returned snapshot.
  const s = createOverrideStore();
  assert.equal(s.setStyle('__proto__',  'color', 'red'), false);
  assert.equal(s.setStyle('constructor','color', 'red'), false);
  assert.equal(s.setStyle('prototype',  'color', 'red'), false);
  assert.equal(s.size(), 0);
  // And the same keys are rejected on the JSON input path.
  assert.equal(s.fromJSON({ '__proto__': { color: 'red' } }), 0);
  assert.equal(s.fromJSON({ 'constructor': { color: 'red' } }), 0);
  assert.equal(s.fromJSON({ 'prototype': { color: 'red' } }), 0);
  assert.equal(s.size(), 0);
});

test('store: setStyles batch applies multiple props', () => {
  const s = createOverrideStore();
  const applied = s.setStyles('#header', {
    color: 'red',
    'font-size': '24px',
    padding: '12px',
  });
  assert.equal(applied, 3);
  assert.equal(s.size(), 3);
  assert.deepEqual(s.getOverridesFor('#header'), {
    color: 'red',
    'font-size': '24px',
    padding: '12px',
  });
});

test('store: setStyles silently skips invalid entries', () => {
  const s = createOverrideStore();
  const applied = s.setStyles('#header', {
    color: 'red',
    'bad;name': 'oops',      // invalid prop name → skip
    width: 32,
    '': 'no-name',            // empty prop name → skip
    'font-size': null,        // null value → skip
  });
  assert.equal(applied, 2);
  assert.deepEqual(s.getOverridesFor('#header'), { color: 'red', width: '32' });
});

test('store: setStyles on bad selector is a no-op', () => {
  const s = createOverrideStore();
  assert.equal(s.setStyles('', { color: 'red' }), 0);
  assert.equal(s.setStyles(null, { color: 'red' }), 0);
  assert.equal(s.setStyles('#x', null), 0);
  assert.equal(s.size(), 0);
});

test('store: removeOverride returns true on removal, false otherwise', () => {
  const s = createOverrideStore();
  s.setStyle('#x', 'color', 'red');
  s.setStyle('#x', 'width', '10px');
  assert.equal(s.removeOverride('#x', 'color'), true);
  assert.equal(s.removeOverride('#x', 'color'), false);  // already gone
  assert.equal(s.removeOverride('#y', 'color'), false);  // selector missing
  assert.deepEqual(s.getOverridesFor('#x'), { width: '10px' });
  assert.deepEqual(s.getSelectors(), ['#x']);
});

test('store: removeOverride of last prop cleans up the selector entry', () => {
  const s = createOverrideStore();
  s.setStyle('#x', 'color', 'red');
  s.removeOverride('#x', 'color');
  assert.equal(s.hasOverrides(), false);
  assert.deepEqual(s.getSelectors(), []);
  assert.deepEqual(s.getOverridesFor('#x'), {});
});

test('store: getSelectors returns selectors in insertion order', () => {
  const s = createOverrideStore();
  s.setStyle('.b', 'color', 'red');
  s.setStyle('#a', 'color', 'red');
  s.setStyle('div', 'color', 'red');
  assert.deepEqual(s.getSelectors(), ['.b', '#a', 'div']);
});

test('store: size and hasOverrides', () => {
  const s = createOverrideStore();
  assert.equal(s.size(), 0);
  assert.equal(s.hasOverrides(), false);
  s.setStyle('#a', 'color', 'red');
  s.setStyle('#a', 'width', '1px');
  s.setStyle('.b', 'color', 'blue');
  assert.equal(s.size(), 3);
  assert.equal(s.hasOverrides(), true);
  s.clear();
  assert.equal(s.size(), 0);
  assert.equal(s.hasOverrides(), false);
});

test('store: clear empties everything', () => {
  const s = createOverrideStore();
  s.setStyle('#a', 'color', 'red');
  s.setStyle('.b', 'color', 'blue');
  s.clear();
  assert.equal(s.size(), 0);
  assert.deepEqual(s.getSelectors(), []);
});

// ---------------------------------------------------------------------------
// toJSON / fromJSON
// ---------------------------------------------------------------------------

test('store: toJSON produces a plain object snapshot', () => {
  const s = createOverrideStore();
  s.setStyle('#a', 'color', 'red');
  s.setStyle('#a', 'width', '1px');
  s.setStyle('.b', 'color', 'blue');
  assert.deepEqual(s.toJSON(), {
    '#a': { color: 'red', width: '1px' },
    '.b': { color: 'blue' },
  });
});

test('store: toJSON → fromJSON round-trip is identity', () => {
  const a = createOverrideStore();
  a.setStyle('#a', 'color', 'red');
  a.setStyle('#a', 'width', '1px');
  a.setStyle('.b', 'color', 'blue');
  a.setStyle('main > .card', 'padding', '16px');
  const snap = a.toJSON();

  // Simulate JSON.stringify → JSON.parse to confirm JSON-safety.
  const wire = JSON.parse(JSON.stringify(snap));

  const b = createOverrideStore();
  const applied = b.fromJSON(wire);
  assert.equal(applied, 4);
  assert.deepEqual(b.toJSON(), snap);
  assert.deepEqual(b.getSelectors(), a.getSelectors());
});

test('store: fromJSON with bad data skips invalid entries', () => {
  const s = createOverrideStore();
  const applied = s.fromJSON({
    '#a': { color: 'red' },
    '.b': { 'bad;name': 'oops', width: '10px' },
    'div': null,
    '': { color: 'red' },
    'empty': {},
  });
  assert.equal(applied, 2);
  assert.deepEqual(s.toJSON(), {
    '#a': { color: 'red' },
    '.b': { width: '10px' },
  });
});

test('store: fromJSON clears existing contents first', () => {
  const s = createOverrideStore();
  s.setStyle('#a', 'color', 'red');
  s.setStyle('.b', 'color', 'blue');
  s.fromJSON({ '#a': { width: '1px' } });
  assert.deepEqual(s.toJSON(), { '#a': { width: '1px' } });
  assert.deepEqual(s.getSelectors(), ['#a']);
});

test('store: fromJSON on non-object is a safe no-op', () => {
  const s = createOverrideStore();
  s.setStyle('#a', 'color', 'red');
  assert.equal(s.fromJSON(null), 0);
  assert.equal(s.fromJSON(undefined), 0);
  assert.equal(s.fromJSON('nope'), 0);
  assert.equal(s.fromJSON(42), 0);
  // Existing state intact.
  assert.deepEqual(s.getSelectors(), ['#a']);
});

// ---------------------------------------------------------------------------
// toStylesheet()
// ---------------------------------------------------------------------------

test('toStylesheet: empty store returns empty string', () => {
  const s = createOverrideStore();
  assert.equal(toStylesheet(s), '');
});

test('toStylesheet: null/invalid store returns empty string', () => {
  assert.equal(toStylesheet(null), '');
  assert.equal(toStylesheet(undefined), '');
  assert.equal(toStylesheet({}), ''); // missing getSelectors
});

test('toStylesheet: single rule', () => {
  const s = createOverrideStore();
  s.setStyle('#header', 'color', 'red');
  assert.equal(toStylesheet(s), '#header{color:red}');
});

test('toStylesheet: multi-prop selector emits all props in insertion order', () => {
  const s = createOverrideStore();
  s.setStyle('#header', 'color', 'red');
  s.setStyle('#header', 'background', 'blue');
  s.setStyle('#header', 'padding', '12px');
  assert.equal(
    toStylesheet(s),
    '#header{color:red;background:blue;padding:12px}',
  );
});

test('toStylesheet: later write to the same selector wins (insertion order)', () => {
  // Two rules with the SAME specificity — insertion order determines
  // the LAST rule, which wins in CSS. Our emitter preserves insertion
  // order within a specificity bucket.
  const s = createOverrideStore();
  s.setStyle('.x', 'color', 'red');
  s.setStyle('.x', 'color', 'blue'); // overwrite (same selector/prop)
  // Only one rule, latest value:
  assert.equal(toStylesheet(s), '.x{color:blue}');
});

test('toStylesheet: orders rules by ascending specificity', () => {
  // Insert in arbitrary order; the emitter should sort by specificity
  // ascending so the more specific rules come last (and win).
  const s = createOverrideStore();
  s.setStyle('#id',     'color', 'a'); // [1,0,0]
  s.setStyle('div',     'color', 'b'); // [0,0,1]
  s.setStyle('.cls',    'color', 'c'); // [0,1,0]
  s.setStyle('div.cls', 'color', 'd'); // [0,1,1]
  assert.equal(
    toStylesheet(s),
    'div{color:b}\n' +
    '.cls{color:c}\n' +
    'div.cls{color:d}\n' +
    '#id{color:a}',
  );
});

test('toStylesheet: insertion order preserved within same specificity', () => {
  const s = createOverrideStore();
  s.setStyle('.a', 'color', '1');
  s.setStyle('.b', 'color', '2');
  s.setStyle('.c', 'color', '3');
  // All three are class selectors (same specificity [0,1,0]) — should
  // appear in the order they were inserted.
  assert.equal(
    toStylesheet(s),
    '.a{color:1}\n.b{color:2}\n.c{color:3}',
  );
});

test('toStylesheet: complex selector with combinator is ranked by its specificity', () => {
  const s = createOverrideStore();
  s.setStyle('body main .card', 'color', 'red'); // [0,1,3]
  s.setStyle('#hero',           'color', 'blue'); // [1,0,0]
  assert.equal(
    toStylesheet(s),
    'body main .card{color:red}\n' +
    '#hero{color:blue}',
  );
});

test('toStylesheet: pseudo-class counts as class in specificity ordering', () => {
  const s = createOverrideStore();
  s.setStyle('a:hover', 'color', 'red');  // [0,1,1] — pseudo-class
  s.setStyle('#x',     'color', 'blue');  // [1,0,0]
  // a:hover must come before #x.
  assert.equal(
    toStylesheet(s),
    'a:hover{color:red}\n#x{color:blue}',
  );
});

test('toStylesheet: empty rule (no props) is skipped', () => {
  const s = createOverrideStore();
  s.setStyle('#a', 'color', 'red');
  // Manually empty out the #a selector entry by removing its last prop,
  // and inject a phantom selector into the store for the negative test.
  s.removeOverride('#a', 'color');
  // Re-add for the positive portion of the test.
  s.setStyle('#a', 'color', 'red');
  // The store only contains #a here — but we want to exercise the
  // "empty selector skipped" branch. Use a separate store.
  const s2 = createOverrideStore();
  s2.fromJSON({ '#a': {}, '.b': { color: 'red' } });
  assert.equal(toStylesheet(s2), '.b{color:red}');
});

test('toStylesheet: value strings are emitted verbatim', () => {
  const s = createOverrideStore();
  s.setStyle('.x', 'background', 'rgba(0,0,0,0.5)');
  s.setStyle('.x', 'width', 'calc(100% - 8px)');
  assert.equal(
    toStylesheet(s),
    '.x{background:rgba(0,0,0,0.5);width:calc(100% - 8px)}',
  );
});

// ---------------------------------------------------------------------------
// Integration: live-injection shape
// ---------------------------------------------------------------------------

test('integration: emitted CSS is a valid style block ready to inject', () => {
  const s = createOverrideStore();
  s.setStyle('#header', 'color', '#fff');
  s.setStyle('#header', 'background', '#000');
  s.setStyle('.card',   'padding', '16px');
  s.setStyle('.card',   'border-radius', '8px');
  s.setStyle('main > .title', 'font-weight', '700');
  const css = toStylesheet(s);

  // No triple-newlines anywhere.
  assert.equal(css.includes('\n\n\n'), false);

  // Wrap in <style> the way the live injector would.
  const styleBlock = `<style>\n${css}\n</style>`;

  // Specificities:
  //   main > .title →  [0,1,1]
  //   .card         →  [0,1,0]
  //   #header       →  [1,0,0]
  // Ascending order → .card  <  main > .title  <  #header.
  const headerIdx = styleBlock.indexOf('#header');
  const cardIdx   = styleBlock.indexOf('.card{');
  const titleIdx  = styleBlock.indexOf('main > .title');
  assert.ok(titleIdx > -1 && cardIdx > -1 && headerIdx > -1,
    'all selectors should appear in the emitted stylesheet');
  assert.ok(cardIdx < titleIdx,
    '.card (specificity [0,1,0]) should come before main > .title ([0,1,1])');
  assert.ok(titleIdx < headerIdx,
    'main > .title should come before #header (highest specificity wins last)');
});

test('integration: real-world edit flow (header color + card padding)', () => {
  const store = createOverrideStore();
  store.setStyle('#hero', 'color', '#fff');
  store.setStyle('#hero', 'padding', '48px 24px');
  store.setStyle('.card', 'padding', '16px');
  store.setStyle('.card', 'border-radius', '12px');
  store.setStyle('main h2', 'margin-bottom', '24px');

  const css = toStylesheet(store);
  // Most specific → last. main h2 is type-only, .card is class,
  // #hero is id.
  assert.match(css, /^main h2\{margin-bottom:24px\}$/m);
  assert.match(css, /^\.card\{padding:16px;border-radius:12px\}$/m);
  assert.match(css, /^#hero\{color:#fff;padding:48px 24px\}$/m);

  // The #hero rule must appear AFTER the .card rule.
  assert.ok(css.indexOf('#hero{') > css.indexOf('.card{'));
});
