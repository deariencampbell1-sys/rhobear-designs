/**
 * @file Tests for the inline-edit module.
 *
 *       Covers pure helpers: isTextEditableTag, computeSelectorPath
 *       (round-trip on a plain-object tree), resolveSelectorPath.
 *       DOM controller behavior is exercised end-to-end by the
 *       Playwright spec at tests/e2e/overlay.spec.js.
 *
 *       Run with: `node --test src/engine/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TEXT_EDITABLE_TAGS,
  isTextEditableTag,
  computeSelectorPath,
  resolveSelectorPath,
} from './inline-edit.js';

// ---------------------------------------------------------------------------
// isTextEditableTag
// ---------------------------------------------------------------------------

test('isTextEditableTag: accepts known text-bearing tags case-insensitively', () => {
  assert.equal(isTextEditableTag('p'), true);
  assert.equal(isTextEditableTag('H1'), true);
  assert.equal(isTextEditableTag('Span'), true);
  assert.equal(isTextEditableTag('button'), true);
});

test('isTextEditableTag: rejects non-text tags and non-strings', () => {
  assert.equal(isTextEditableTag('html'), false);
  assert.equal(isTextEditableTag('head'), false);
  assert.equal(isTextEditableTag('meta'), false);
  assert.equal(isTextEditableTag('script'), false);
  assert.equal(isTextEditableTag(null), false);
  assert.equal(isTextEditableTag(undefined), false);
  assert.equal(isTextEditableTag(42), false);
});

test('TEXT_EDITABLE_TAGS: is a Set and is non-empty', () => {
  assert.ok(TEXT_EDITABLE_TAGS instanceof Set);
  assert.ok(TEXT_EDITABLE_TAGS.size > 0);
});

// ---------------------------------------------------------------------------
// computeSelectorPath (pure, plain-object tree)
// ---------------------------------------------------------------------------

/**
 * Build a plain-object DOM-like tree and return the root.
 * Each node has: tagName, children (array of nodes), parentElement (back-ref).
 */
function buildTree() {
  const html = { tagName: 'HTML', children: [] };
  const body = { tagName: 'BODY', children: [] };
  const main = { tagName: 'MAIN', children: [] };
  const s1   = { tagName: 'SECTION', children: [] };
  const s2   = { tagName: 'SECTION', children: [] };
  const div1 = { tagName: 'DIV', children: [] };
  const div2 = { tagName: 'DIV', children: [] };
  const p1   = { tagName: 'P', children: [] };
  const p2   = { tagName: 'P', children: [] };
  const span = { tagName: 'SPAN', children: [] };

  function link(parent, child) {
    child.parentElement = parent;
    parent.children.push(child);
  }
  link(html, body);
  link(body, main);
  link(main, s1);
  link(main, s2);
  link(s1, div1);
  link(s2, div2);
  link(div1, p1);
  link(div1, p2);
  link(p2, span);

  // ownerDocument stub so computeSelectorPath defaults to html as the root.
  html.ownerDocument = { documentElement: html };

  return { html, body, main, s1, s2, div1, div2, p1, p2, span };
}

test('computeSelectorPath: returns "" for null / non-object input', () => {
  assert.equal(computeSelectorPath(null), '');
  assert.equal(computeSelectorPath(undefined), '');
  assert.equal(computeSelectorPath(42), '');
});

test('computeSelectorPath: unique siblings omit nth-of-type', () => {
  const t = buildTree();
  // body is the only body child of html
  assert.equal(computeSelectorPath(t.body), 'html > body');
  assert.equal(computeSelectorPath(t.main), 'html > body > main');
});

test('computeSelectorPath: duplicated siblings get nth-of-type(1..n)', () => {
  const t = buildTree();
  // Two SECTIONs under main → first one is :nth-of-type(1) (omitted)
  assert.equal(computeSelectorPath(t.s1),  'html > body > main > section');
  assert.equal(computeSelectorPath(t.s2),  'html > body > main > section:nth-of-type(2)');
  // Two DIVs, each in different parents, so no :nth-of-type needed for them
  assert.equal(computeSelectorPath(t.div1), 'html > body > main > section > div');
  assert.equal(computeSelectorPath(t.div2), 'html > body > main > section:nth-of-type(2) > div');
  // Two P siblings under div1
  assert.equal(computeSelectorPath(t.p1),   'html > body > main > section > div > p');
  assert.equal(computeSelectorPath(t.p2),   'html > body > main > section > div > p:nth-of-type(2)');
});

test('computeSelectorPath: deeply nested element gets correct full path', () => {
  const t = buildTree();
  assert.equal(computeSelectorPath(t.span),
    'html > body > main > section > div > p:nth-of-type(2) > span');
});

test('computeSelectorPath: stops at the supplied root', () => {
  const t = buildTree();
  // Provide main as the root — path stops there.
  assert.equal(computeSelectorPath(t.p1, t.main), 'main > section > div > p');
  assert.equal(computeSelectorPath(t.span, t.main), 'main > section > div > p:nth-of-type(2) > span');
});

test('computeSelectorPath: tagName is lowercased', () => {
  const t = buildTree();
  // Force-uppercase tags; output should be lowercased.
  t.span.tagName = 'SPAN';
  assert.match(computeSelectorPath(t.span), /> span$/);
});

test('computeSelectorPath: a node whose parent is missing still returns its own tag', () => {
  const orphan = { tagName: 'P', parentElement: null, children: [] };
  // No ownerDocument, no children — should just return "p".
  assert.equal(computeSelectorPath(orphan), 'p');
});

// ---------------------------------------------------------------------------
// resolveSelectorPath
// ---------------------------------------------------------------------------

test('resolveSelectorPath: returns null when given garbage input', () => {
  assert.equal(resolveSelectorPath(null,    'p'),         null);
  assert.equal(resolveSelectorPath({},      ''),          null);
  assert.equal(resolveSelectorPath({},      null),        null);
  assert.equal(resolveSelectorPath({},      '   '),       null);
});

test('resolveSelectorPath: returns null when selector is malformed', () => {
  const doc = {
    querySelector: () => { throw new Error('bad selector'); },
  };
  assert.equal(resolveSelectorPath(doc, '$$$'), null);
});

test('resolveSelectorPath: delegates to doc.querySelector and returns the match', () => {
  const fakeEl = { tagName: 'P' };
  let called = '';
  const doc = {
    querySelector: (sel) => { called = sel; return fakeEl; },
  };
  const out = resolveSelectorPath(doc, 'html > body > p');
  assert.equal(out, fakeEl);
  assert.equal(called, 'html > body > p');
});

test('resolveSelectorPath: returns null when querySelector returns null', () => {
  const doc = { querySelector: () => null };
  assert.equal(resolveSelectorPath(doc, 'html > body > nope'), null);
});

// ---------------------------------------------------------------------------
// Round-trip: compute → resolve
// ---------------------------------------------------------------------------

test('compute → resolve round-trips on a plain-object tree (best-effort)', () => {
  const t = buildTree();
  // Compute the path for p1, then assert that a querySelector stub that
  // does the same nth-of-type walk returns p1.
  const path = computeSelectorPath(t.p1, t.html);
  assert.equal(path, 'html > body > main > section > div > p');

  // Build a doc-like that implements just enough selector resolution for
  // the trivial "html > body > main > section > div > p" chain.
  const doc = makeFakeDoc(t.html);
  const resolved = resolveSelectorPath(doc, path);
  assert.equal(resolved, t.p1);
});

/** Build a doc-like that resolves "html > body > ... > tag" by walking the tree. */
function makeFakeDoc(root) {
  return {
    querySelector(selector) {
      const parts = selector.split('>').map((s) => s.trim());
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Strip ":nth-of-type(N)" for the walk.
        const m = /^([a-z]+)(?::nth-of-type\((\d+)\))?$/.exec(part);
        if (!m) return null;
        const tag = m[1];
        const nth = m[2] ? parseInt(m[2], 10) : 1;
        // If the current node's own tag matches the part, this is a self-step;
        // otherwise, descend into children.
        const ownTag = (cur && cur.tagName || '').toLowerCase();
        if (ownTag === tag) {
          // Already at the right element — advance to next part on the next iter.
          continue;
        }
        const kids = (cur.children || []).filter((c) => (c.tagName || '').toLowerCase() === tag);
        if (kids.length < nth) return null;
        cur = kids[nth - 1];
      }
      return cur;
    },
  };
}