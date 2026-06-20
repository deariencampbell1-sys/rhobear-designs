/**
 * @file Tests for the document model.
 *
 *       Covers: empty / HTML construction, CRUD, ids, index consistency,
 *       move semantics (within parent, across parents, cycle rejection,
 *       void/text parent rejection), and toJSON / fromJSON round-trip.
 *
 *       Run with: `node --test src/core/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDocument,
  VOID_TAGS,
  parseHtmlFragment,
  parseStyleString,
} from './document-model.js';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

test('createDocument: empty doc has a #document root and an index with root', () => {
  const doc = createDocument();
  assert.equal(doc.root.tag, '#document');
  assert.equal(doc.root.children.length, 0);
  assert.ok(doc.index.has('root'));
  assert.equal(doc.getNode('root'), doc.root);
  assert.equal(doc.css, '');
});

test('createDocument: parses a simple HTML fragment into a tree', () => {
  const doc = createDocument('<div class="a"><p>hi</p><p>bye</p></div>');
  assert.equal(doc.root.children.length, 1);
  const div = doc.root.children[0];
  assert.equal(div.tag, 'div');
  assert.equal(div.attrs.class, 'a');
  assert.equal(div.children.length, 2);
  assert.equal(div.children[0].tag, 'p');
  assert.equal(div.children[0].children[0].tag, '#text');
  assert.equal(div.children[0].children[0].text, 'hi');
  assert.equal(div.children[1].children[0].text, 'bye');
});

test('createDocument: hoists style="..." into the styles object', () => {
  const doc = createDocument('<p style="color: red; font-size: 14px">x</p>');
  const p = doc.root.children[0];
  assert.equal(p.styles.color, 'red');
  assert.equal(p.styles['font-size'], '14px');
  assert.equal(p.attrs.style, undefined);
});

test('createDocument: assigns unique stable ids', () => {
  const doc = createDocument('<div><p>a</p><p>b</p></div>');
  // Walk the body tree only (skip the synthetic #document root).
  const ids = new Set();
  for (const c of doc.root.children) collectIds(c, ids);
  assert.equal(ids.size, 5); // div, p, #text, p, #text
  // All ids must be retrievable via getNode.
  for (const id of ids) assert.ok(doc.getNode(id), `id ${id} should be in index`);
});

function collectIds(n, ids) {
  if (!n) return;
  if (n.id) ids.add(n.id);
  for (const c of n.children || []) collectIds(c, ids);
}

test('createDocument: extracts <style> into doc.css and drops the element', () => {
  const doc = createDocument(
    '<style>body { color: red; }</style><p>hi</p>',
  );
  assert.match(doc.css, /body \{ color: red; \}/);
  // <style> should not appear as a child.
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].tag, 'p');
});

test('createDocument: keeps <script> out of the tree', () => {
  const doc = createDocument('<script>alert(1)</script><p>safe</p>');
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].tag, 'p');
});

test('createDocument: comments and doctype are skipped', () => {
  const doc = createDocument('<!DOCTYPE html><!-- a comment --><p>ok</p>');
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0].tag, 'p');
});

test('createDocument: void elements have no children', () => {
  const doc = createDocument('<br><img src="x.png">');
  assert.equal(doc.root.children.length, 2);
  assert.equal(doc.root.children[0].tag, 'br');
  assert.equal(doc.root.children[1].tag, 'img');
  assert.equal(doc.root.children[1].attrs.src, 'x.png');
  assert.equal(VOID_TAGS.has('img'), true);
});

test('createDocument: decodes common HTML entities', () => {
  const doc = createDocument('<p>5 &lt; 6 &amp; 7 &gt; 6</p>');
  const text = doc.root.children[0].children[0].text;
  assert.equal(text, '5 < 6 & 7 > 6');
});

// ---------------------------------------------------------------------------
// getNode / parentOf
// ---------------------------------------------------------------------------

test('getNode: returns null for unknown id', () => {
  const doc = createDocument();
  assert.equal(doc.getNode('nope'), null);
});

test('parentOf: returns the direct parent', () => {
  const doc = createDocument('<div><p>x</p></div>');
  const div = doc.root.children[0];
  const p = div.children[0];
  assert.equal(doc.parentOf(p.id), div);
  assert.equal(doc.parentOf(div.id), doc.root);
  assert.equal(doc.parentOf('root'), null);
  assert.equal(doc.parentOf('nope'), null);
});

// ---------------------------------------------------------------------------
// updateNode
// ---------------------------------------------------------------------------

test('updateNode: patches attrs / styles / text and returns the node', () => {
  const doc = createDocument('<p>hi</p>');
  const p = doc.root.children[0];
  const textNode = p.children[0];
  const ret = doc.updateNode(p.id, { attrs: { id: 'first', class: 'lead' } });
  assert.equal(ret, p);
  assert.equal(p.attrs.id, 'first');
  assert.equal(p.attrs.class, 'lead');

  doc.updateNode(p.id, { styles: { color: 'red' } });
  assert.equal(p.styles.color, 'red');

  doc.updateNode(textNode.id, { text: 'updated' });
  assert.equal(textNode.text, 'updated');
});

test('updateNode: replacing attrs fully replaces the object', () => {
  const doc = createDocument('<p class="a" id="b">x</p>');
  const p = doc.root.children[0];
  doc.updateNode(p.id, { attrs: { class: 'z' } });
  assert.equal(p.attrs.class, 'z');
  assert.equal(p.attrs.id, undefined);
});

test('updateNode: throws for unknown id and cannot change root/#text tag', () => {
  const doc = createDocument();
  assert.throws(() => doc.updateNode('nope', { attrs: {} }));
  assert.throws(() => doc.updateNode('root', { tag: 'div' }));
  const doc2 = createDocument('<p>x</p>');
  const tn = doc2.root.children[0].children[0];
  assert.throws(() => doc2.updateNode(tn.id, { tag: 'span' }));
});

// ---------------------------------------------------------------------------
// insertNode
// ---------------------------------------------------------------------------

test('insertNode: appends by default and assigns an id', () => {
  const doc = createDocument();
  const node = doc.insertNode('root', { tag: 'div' });
  assert.equal(doc.root.children.length, 1);
  assert.equal(doc.root.children[0], node);
  assert.ok(node.id);
  assert.ok(doc.index.has(node.id));
});

test('insertNode: honours an explicit index', () => {
  const doc = createDocument();
  const a = doc.insertNode('root', { tag: 'p' });
  const b = doc.insertNode('root', { tag: 'p' });
  const c = doc.insertNode('root', { tag: 'p' }, 1);
  assert.deepEqual(
    doc.root.children.map((n) => n.id),
    [a.id, c.id, b.id],
  );
});

test('insertNode: indexes every descendant', () => {
  const doc = createDocument();
  const n = doc.insertNode('root', {
    tag: 'div',
    children: [
      { tag: 'p', children: [{ tag: '#text', text: 'hi' }] },
      { tag: 'span' },
    ],
  });
  assert.ok(doc.index.has(n.id));
  assert.ok(doc.index.has(n.children[0].id));
  assert.ok(doc.index.has(n.children[0].children[0].id));
  assert.ok(doc.index.has(n.children[1].id));
});

test('insertNode: rejects a duplicate id', () => {
  const doc = createDocument();
  doc.insertNode('root', { tag: 'div', id: 'dup' });
  assert.throws(() => doc.insertNode('root', { tag: 'div', id: 'dup' }));
});

test('insertNode: rejects inserting into a #text or unknown parent', () => {
  const doc = createDocument('<p>hi</p>');
  const tn = doc.root.children[0].children[0];
  assert.throws(() => doc.insertNode(tn.id, { tag: 'div' }));
  assert.throws(() => doc.insertNode('nope', { tag: 'div' }));
});

test('insertNode: rejects cycles (parent is inside the new node)', () => {
  const doc = createDocument();
  const div = doc.insertNode('root', { tag: 'div' });
  const p = doc.insertNode(div.id, { tag: 'p' });
  // Try to insert `div` into `p` (its descendant) — must throw.
  assert.throws(() => doc.insertNode(p.id, { tag: 'section', children: [div] }));
});

// ---------------------------------------------------------------------------
// removeNode
// ---------------------------------------------------------------------------

test('removeNode: removes the node and all descendants from the index', () => {
  const doc = createDocument('<div><p>hi</p><p>bye</p></div>');
  const div = doc.root.children[0];
  const p1 = div.children[0];
  const tnId = p1.children[0].id;
  doc.removeNode(p1.id);
  assert.equal(div.children.length, 1);
  assert.equal(doc.getNode(p1.id), null);
  assert.equal(doc.getNode(tnId), null);
});

test('removeNode: cannot remove the root', () => {
  const doc = createDocument();
  assert.throws(() => doc.removeNode('root'));
});

test('removeNode: throws for unknown id', () => {
  const doc = createDocument();
  assert.throws(() => doc.removeNode('nope'));
});

// ---------------------------------------------------------------------------
// moveNode
// ---------------------------------------------------------------------------

test('moveNode: reorders within the same parent', () => {
  const doc = createDocument('<div><p>a</p><p>b</p><p>c</p></div>');
  const div = doc.root.children[0];
  const a = div.children[0];
  doc.moveNode(a.id, div.id, 3);
  assert.equal(div.children.map((n) => n.id).join(','), [div.children[0], div.children[1], a].map((n) => n.id).join(','));
  // Stronger: c, b, a
  assert.equal(div.children[2], a);
});

test('moveNode: moves across parents and preserves the subtree', () => {
  const doc = createDocument('<div><p class="x">hi</p></div><section></section>');
  const div = doc.root.children[0];
  const section = doc.root.children[1];
  const p = div.children[0];
  doc.moveNode(p.id, section.id, 0);
  assert.equal(div.children.length, 0);
  assert.equal(section.children.length, 1);
  assert.equal(section.children[0], p);
  assert.equal(p.attrs.class, 'x');
  assert.equal(p.children[0].text, 'hi');
});

test('moveNode: rejects moving into self or a descendant', () => {
  const doc = createDocument('<div><p><span></span></p></div>');
  const div = doc.root.children[0];
  const p = div.children[0];
  const span = p.children[0];
  assert.throws(() => doc.moveNode(div.id, div.id, 0));
  assert.throws(() => doc.moveNode(div.id, p.id, 0));
  assert.throws(() => doc.moveNode(div.id, span.id, 0));
});

test('moveNode: cannot move root, into #text, or unknown parent', () => {
  const doc = createDocument('<div><p>x</p></div>');
  const p = doc.root.children[0].children[0];
  const tn = p.children[0];
  assert.throws(() => doc.moveNode('root', 'root', 0));
  assert.throws(() => doc.moveNode(p.id, tn.id, 0));
  assert.throws(() => doc.moveNode(p.id, 'nope', 0));
});

// ---------------------------------------------------------------------------
// toJSON / fromJSON
// ---------------------------------------------------------------------------

test('toJSON: omits methods and the live index', () => {
  const doc = createDocument('<p>x</p>');
  const json = doc.toJSON();
  assert.equal(typeof json.root, 'object');
  assert.equal(typeof json.css, 'string');
  assert.equal(typeof json.id, 'string');
  assert.equal(typeof json.idCounter, 'number');
  // No live references to the doc.
  json.root.children.push({ tag: 'div', attrs: {}, styles: {}, children: [] });
  assert.equal(doc.root.children.length, 1);
});

test('fromJSON: rebuilds the index and the tree', () => {
  const doc = createDocument('<div class="a"><p>hi</p></div>');
  const json = doc.toJSON();
  const doc2 = createDocument();
  doc2.fromJSON(json);
  assert.equal(doc2.root.children[0].tag, 'div');
  assert.equal(doc2.root.children[0].attrs.class, 'a');
  assert.equal(doc2.root.children[0].children[0].children[0].text, 'hi');
  // Ids from the original must be retrievable.
  const origP = doc.root.children[0].children[0];
  assert.equal(doc2.getNode(origP.id).tag, 'p');
});

test('fromJSON: can be chained (serialize→deserialize→serialize stable at the structural level)', () => {
  const doc = createDocument('<div class="a"><p style="color:red">hi</p></div>');
  // We test structural equivalence, not the live doc — the next test file
  // covers the full string-level round trip.
  const json = doc.toJSON();
  const doc2 = createDocument();
  doc2.fromJSON(json);
  assert.equal(doc2.root.children.length, 1);
  assert.equal(doc2.root.children[0].attrs.class, 'a');
  // The div has no inline style, so its styles object is empty ({}).
  assert.equal(Object.keys(doc2.root.children[0].styles).length, 0);
  // The inner <p> retains its color.
  assert.equal(doc2.root.children[0].children[0].styles.color, 'red');
});

// ---------------------------------------------------------------------------
// parseStyleString / parseHtmlFragment — direct unit tests
// ---------------------------------------------------------------------------

test('parseStyleString: splits declarations and trims', () => {
  const s = parseStyleString('  color : red ; font-size:14px ; ');
  assert.equal(s.color, 'red');
  assert.equal(s['font-size'], '14px');
});

test('parseStyleString: empty / non-string input is empty', () => {
  assert.deepEqual(parseStyleString(''), {});
  assert.deepEqual(parseStyleString(null), {});
  assert.deepEqual(parseStyleString(undefined), {});
});

test('parseHtmlFragment: tolerates unclosed tags (EOF) and malformed input', () => {
  const r1 = parseHtmlFragment('<div><p>oops');
  assert.equal(r1.tree[0].tag, 'div');
  assert.equal(r1.tree[0].children[0].tag, 'p');
  assert.equal(r1.tree[0].children[0].children[0].text, 'oops');
  assert.equal(r1.styleCss, '');

  const r2 = parseHtmlFragment('<<<broken');
  // Two '<' get emitted as text, then 'broken' as text.
  assert.equal(r2.tree.length, 1);
  assert.equal(r2.tree[0].tag, '#text');
  assert.match(r2.tree[0].text, /broken/);
});

test('parseHtmlFragment: self-closing void elements are siblings, not parents', () => {
  const r = parseHtmlFragment('<br /><hr/><img src="x">');
  assert.equal(r.tree.length, 3);
  assert.equal(r.tree[0].tag, 'br');
  assert.equal(r.tree[1].tag, 'hr');
  assert.equal(r.tree[2].tag, 'img');
  assert.equal(r.tree[2].attrs.src, 'x');
});
