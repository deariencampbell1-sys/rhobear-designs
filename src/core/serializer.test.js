/**
 * @file Tests for the serializer.
 *
 *       Covers:
 *         - serialize produces clean body-level html + collected css
 *         - inline `style` is rendered from the `styles` object
 *         - void elements have no closing tag
 *         - empty non-void elements are self-closed
 *         - boolean attributes render without a value
 *         - HTML escaping in text and attribute values
 *         - deserialize parses html + css back into a doc
 *         - <style> blocks are extracted into doc.css
 *         - **round-trip stability**: serialize→deserialize→serialize is
 *           byte-equal (modulo the structural form), satisfying the DoD
 *
 *       Run with: `node --test src/core/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDocument } from './document-model.js';
import { serialize, deserialize } from './serializer.js';

/** Recursive structural comparison ignoring ids (they're regenerated on parse). */
function structurallyEqual(a, b) {
  if (!a || !b) return a === b;
  if (a.tag !== b.tag) return false;
  if (a.tag === '#text') return a.text === b.text;
  // Compare attrs as flat records.
  const aAttrs = a.attrs || {};
  const bAttrs = b.attrs || {};
  const aKeys = Object.keys(aAttrs).sort();
  const bKeys = Object.keys(bAttrs).sort();
  if (aKeys.join('|') !== bKeys.join('|')) return false;
  for (const k of aKeys) if (aAttrs[k] !== bAttrs[k]) return false;
  // Compare styles.
  const aStyles = a.styles || {};
  const bStyles = b.styles || {};
  const aSK = Object.keys(aStyles).sort();
  const bSK = Object.keys(bStyles).sort();
  if (aSK.join('|') !== bSK.join('|')) return false;
  for (const k of aSK) if (aStyles[k] !== bStyles[k]) return false;
  // Children.
  const ac = a.children || [];
  const bc = b.children || [];
  if (ac.length !== bc.length) return false;
  for (let i = 0; i < ac.length; i++) {
    if (!structurallyEqual(ac[i], bc[i])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

test('serialize: empty doc', () => {
  const doc = createDocument();
  const out = serialize(doc);
  assert.equal(out.html, '');
  assert.equal(out.css, '');
});

test('serialize: simple element', () => {
  const doc = createDocument('<p>hi</p>');
  const out = serialize(doc);
  assert.equal(out.html, '<p>hi</p>');
  assert.equal(out.css, '');
});

test('serialize: inlines styles as a style="..." attribute', () => {
  const doc = createDocument('<p style="color: red; font-size: 14px">x</p>');
  const out = serialize(doc);
  // Order of declarations is the insertion order in the styles object.
  assert.equal(out.html, '<p style="color:red;font-size:14px">x</p>');
});

test('serialize: void elements are written without a closing tag', () => {
  const doc = createDocument('<br><img src="x.png" alt="x">');
  const out = serialize(doc);
  assert.equal(out.html, '<br><img src="x.png" alt="x">');
});

test('serialize: empty non-void element is self-closed', () => {
  const doc = createDocument('<div></div>');
  const out = serialize(doc);
  assert.equal(out.html, '<div />');
});

test('serialize: boolean attribute renders without a value', () => {
  const doc = createDocument('<input type="checkbox" checked>');
  const out = serialize(doc);
  assert.equal(out.html, '<input type="checkbox" checked>');
});

test('serialize: HTML-escapes text content', () => {
  const doc = createDocument('<p>5 &lt; 6 &amp; 7 &gt; 6</p>');
  const out = serialize(doc);
  // Source input already had entities; the parser decoded them. The
  // serializer re-escapes for the canonical form.
  assert.equal(out.html, '<p>5 &lt; 6 &amp; 7 &gt; 6</p>');
});

test('serialize: HTML-escapes < and & in raw text', () => {
  // Build a doc by hand to test the raw escaping path.
  const doc = createDocument();
  doc.insertNode('root', {
    tag: 'p',
    children: [
      { tag: '#text', text: 'a < b & c > d' },
    ],
  });
  const out = serialize(doc);
  assert.equal(out.html, '<p>a &lt; b &amp; c &gt; d</p>');
});

test('serialize: HTML-escapes attribute values', () => {
  const doc = createDocument();
  doc.insertNode('root', {
    tag: 'a',
    attrs: { href: 'https://x.test/?a=1&b=2"x' },
    children: [],
  });
  const out = serialize(doc);
  assert.equal(out.html, '<a href="https://x.test/?a=1&amp;b=2&quot;x" />');
});

test('serialize: nested structure', () => {
  const doc = createDocument(
    '<section><div class="wrap"><h1>Hello</h1><p>World</p></div></section>',
  );
  const out = serialize(doc);
  assert.equal(
    out.html,
    '<section><div class="wrap"><h1>Hello</h1><p>World</p></div></section>',
  );
});

test('serialize: preserves doc.css', () => {
  const doc = createDocument();
  doc.css = 'body { margin: 0; }';
  doc.insertNode('root', { tag: 'p', children: [{ tag: '#text', text: 'x' }] });
  const out = serialize(doc);
  assert.equal(out.css, 'body { margin: 0; }');
  assert.equal(out.html, '<p>x</p>');
});

// ---------------------------------------------------------------------------
// deserialize
// ---------------------------------------------------------------------------

test('deserialize: empty input', () => {
  const doc = deserialize({});
  assert.equal(doc.root.children.length, 0);
  assert.equal(doc.css, '');
});

test('deserialize: html only', () => {
  const doc = deserialize({ html: '<p>hi</p>' });
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].tag, 'p');
});

test('deserialize: css only', () => {
  const doc = deserialize({ css: 'h1 { color: red; }' });
  assert.equal(doc.css, 'h1 { color: red; }');
  assert.equal(doc.root.children.length, 0);
});

test('deserialize: <style> blocks in the html are appended to doc.css', () => {
  const doc = deserialize({
    html: '<style>.x{color:red}</style><p>hi</p>',
    css: 'body{margin:0}',
  });
  assert.match(doc.css, /body\{margin:0\}/);
  assert.match(doc.css, /\.x\{color:red\}/);
  // <style> should not appear in the tree.
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].tag, 'p');
});

test('deserialize: hoists style="..." into the styles object', () => {
  const doc = deserialize({ html: '<p style="color: red; font-size: 14px">x</p>' });
  const p = doc.root.children[0];
  assert.equal(p.styles.color, 'red');
  assert.equal(p.styles['font-size'], '14px');
  assert.equal(p.attrs.style, undefined);
});

test('deserialize: assigns fresh ids and indexes the tree', () => {
  const doc = deserialize({ html: '<div><p>x</p></div>' });
  const div = doc.root.children[0];
  const p = div.children[0];
  const tn = p.children[0];
  assert.ok(div.id);
  assert.ok(p.id);
  assert.ok(tn.id);
  assert.equal(doc.getNode(div.id), div);
  assert.equal(doc.getNode(p.id), p);
  assert.equal(doc.getNode(tn.id), tn);
});

// ---------------------------------------------------------------------------
// Round-trip stability (the DoD property)
// ---------------------------------------------------------------------------

test('round-trip: serialize → deserialize → serialize is byte-stable for simple html', () => {
  const original = createDocument('<p>hi</p>');
  const a = serialize(original);
  const doc2 = deserialize(a);
  const b = serialize(doc2);
  assert.equal(b.html, a.html);
  assert.equal(b.css, a.css);
});

test('round-trip: nested elements', () => {
  const original = createDocument(
    '<section><div class="wrap"><h1>Hello</h1><p>World</p></div></section>',
  );
  const a = serialize(original);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
});

test('round-trip: inline styles', () => {
  const original = createDocument(
    '<p style="color: red; font-size: 14px">x</p>',
  );
  const a = serialize(original);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
});

test('round-trip: void + boolean attrs', () => {
  const original = createDocument(
    '<input type="checkbox" checked><br><img src="x.png" alt="x">',
  );
  const a = serialize(original);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
});

test('round-trip: doc.css survives (style block in input is extracted into css)', () => {
  const original = createDocument(
    '<style>body { margin: 0; }</style><p>hi</p>',
  );
  const a = serialize(original);
  // Sanity: the original doc has the style content in css.
  assert.match(a.css, /body \{ margin: 0; \}/);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
  assert.equal(b.css, a.css);
});

test('round-trip: doc.css passed separately is preserved', () => {
  const doc = createDocument();
  doc.css = '/* external */\nh1{color:red}';
  doc.insertNode('root', { tag: 'h1', children: [{ tag: '#text', text: 'hi' }] });
  const a = serialize(doc);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
  assert.equal(b.css, a.css);
});

test('round-trip: many rounds remain stable', () => {
  const doc = createDocument(
    '<div class="a"><p style="color:red">x</p><br><span></span></div>',
  );
  doc.css = '/* c */\np{margin:0}';
  const a = serialize(doc);
  let cur = a;
  for (let i = 0; i < 5; i++) {
    cur = serialize(deserialize(cur));
  }
  assert.equal(cur.html, a.html);
  assert.equal(cur.css, a.css);
});

test('round-trip: structural equivalence holds across serialize→deserialize', () => {
  const doc = createDocument(
    '<div class="a"><p style="color: red; font-size: 14px">Hello <b>world</b></p></div>',
  );
  const a = serialize(doc);
  // Ids must not appear in the serialized output — the editor-internal id
  // format is not part of the public contract.
  assert.equal(a.html.includes('data-rb-id'), false, 'serialized html should not carry ids');
  assert.equal(a.html.match(/id="n\d+"/), null, 'serialized html should not carry generated ids');
  // Structure must match across the round-trip.
  const doc2 = deserialize(a);
  assert.ok(
    structurallyEqual(doc.root, doc2.root),
    'structural equality must hold across round-trip',
  );
});

test('round-trip: HTML entities are preserved in text', () => {
  // When the source has `&amp;` in text, we want it to round-trip as `&amp;`
  // in the canonical html — i.e. the model decodes to `&` and re-encodes.
  const doc = createDocument('<p>5 &lt; 6 &amp; 7 &gt; 6</p>');
  const a = serialize(doc);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
});

test('round-trip: complex / real-ish page', () => {
  const html =
    '<header class="hero"><h1 style="color: #fff">Title</h1>' +
    '<p class="lead">Lead paragraph with <a href="/x">a link</a>.</p>' +
    '</header><main><section><h2>S</h2><p>Body</p></section></main>';
  const doc = createDocument(html);
  doc.css = ':root { --gap: 8px; }\n.hero { padding: 24px; }';
  const a = serialize(doc);
  const b = serialize(deserialize(a));
  assert.equal(b.html, a.html);
  assert.equal(b.css, a.css);
});
