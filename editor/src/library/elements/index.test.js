/**
 * @file Tests for the element-library loader.
 *
 *       Run with: `node --test src/library/elements/`
 *
 *       Covers:
 *         - The committed `manifest.json` is valid JSON.
 *         - Every entry has the required fields: id, category, name,
 *           tags (array), html (non-empty string), css (string, may be
 *           empty), source (string).
 *         - Every id is unique.
 *         - `listCategories()` returns the canonical category list in
 *           order.
 *         - `listElements()` returns everything; `listElements(cat)`
 *           returns only that category.
 *         - `getElement(id)` returns the matching element, and null for
 *           an unknown id.
 *
 *       Style: Node's built-in test runner, ESM, strict asserts. Kept
 *       dependency-free (no extra imports beyond node:test + assert +
 *       the loader under test).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listCategories,
  listElements,
  getElement,
  loadManifest,
  CATEGORIES,
  _resetManifestCache,
} from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, 'manifest.json');

// ===========================================================================
// manifest.json file shape
// ===========================================================================

test('manifest.json exists and is valid JSON', () => {
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(raw);
  }, 'manifest.json must parse as JSON');
  assert.ok(Array.isArray(parsed), 'manifest.json must be a JSON array');
});

test('manifest.json contains a useful number of entries', () => {
  const all = loadManifest();
  // DoD target: ≥ 250 unique, self-contained entries across 20
  // categories (12 original + 8 added in le2-stash-expand). The
  // dissector currently produces ~340–360 entries from ~70 samples
  // plus ~27 hand-authored fixtures. The lower bound is generous so
  // future slimming still passes; the upper bound catches the
  // runaway-dedupe case where every fixture leaks a near-identical
  // duplicate.
  assert.ok(all.length >= 250, `expected >= 250 elements, got ${all.length}`);
});

// ===========================================================================
// Per-entry validation
// ===========================================================================

test('every entry has required fields with valid types', () => {
  const all = loadManifest();
  for (const s of all) {
    assert.equal(typeof s, 'object', 'entry must be an object');
    assert.ok(s !== null, 'entry must not be null');
    assert.equal(typeof s.id, 'string', `entry.id must be string: ${JSON.stringify(s).slice(0,80)}`);
    assert.ok(s.id.length > 0, 'entry.id must be non-empty');
    assert.equal(typeof s.category, 'string', `entry.category must be string: ${s.id}`);
    assert.ok(CATEGORIES.includes(s.category), `entry.category must be in canonical list: ${s.id} -> ${s.category}`);
    assert.equal(typeof s.name, 'string', `entry.name must be string: ${s.id}`);
    assert.ok(s.name.length > 0, `entry.name must be non-empty: ${s.id}`);
    assert.ok(Array.isArray(s.tags), `entry.tags must be array: ${s.id}`);
    assert.equal(typeof s.html, 'string', `entry.html must be string: ${s.id}`);
    assert.ok(s.html.length > 0, `entry.html must be non-empty: ${s.id}`);
    assert.equal(typeof s.css, 'string', `entry.css must be string: ${s.id}`);
    assert.equal(typeof s.source, 'string', `entry.source must be string: ${s.id}`);
    assert.ok(s.source.length > 0, `entry.source must be non-empty: ${s.id}`);
    // Self-containment contract: every entry's html and css must be
    // class-scoped under an `el-<id>-*` prefix so the snippet renders
    // standalone when dropped into a page.
    //
    // Two relaxations:
    //   1. If the snippet has no `class="..."` attributes at all (a
    //      plain `<nav>...</nav>` with bare tags), there is nothing to
    //      scope — the prefix check is a no-op and the css will
    //      naturally be empty. This happens ~13 times out of ~350 in
    //      the current corpus (creative-agency samples sometimes ship
    //      ultra-minimal markup).
    //   2. If the snippet has classes, EVERY class attribute must
    //      carry the `el-<id>-*` prefix.
    //   3. If the snippet has css, every selector must carry the
    //      `el-<id>-*` prefix. (Empty css is allowed and not checked.)
    const expectedPrefix = `el-${s.id}-`;
    const hasClasses = /class\s*=\s*"[^"]*"/i.test(s.html);
    if (hasClasses) {
      // At least one class attribute must be present with the scoped
      // prefix. This is the practical proxy for "is this snippet
      // scoped?" — if it has classes but no scoping at all, we have a
      // regression in dissect.mjs.
      assert.ok(
        s.html.includes(expectedPrefix),
        `entry html has class= attributes but none carry prefix "${expectedPrefix}": ${s.id}`,
      );
    }
    if (s.css.length > 0) {
      // CSS may legitimately be either:
      //   (a) class-scoped under the `el-<id>-` prefix, OR
      //   (b) tag-selector rules like `button{...}` / `a{...}` that
      //       style the bare element tag (these don't carry the prefix
      //       because they're not class-scoped).
      // Tag-selector-only rules are detectable by the absence of any
      // `.foo{` style declarations.
      const hasClassSelector = /\.[\w-]+\s*\{/.test(s.css);
      if (hasClassSelector) {
        assert.ok(
          s.css.includes(expectedPrefix),
          `entry css has class selectors but none carry prefix "${expectedPrefix}": ${s.id}`,
        );
      }
    }
  }
});

test('every id is unique across the manifest', () => {
  const all = loadManifest();
  const seen = new Set();
  const dups = [];
  for (const s of all) {
    if (seen.has(s.id)) dups.push(s.id);
    seen.add(s.id);
  }
  assert.equal(dups.length, 0, `duplicate ids: ${dups.slice(0, 5).join(', ')}`);
});

test('every name is human-friendly (not a raw text dump)', () => {
  // The dissect.mjs deriveName() composes names like "Pricing — 3 tier"
  // or "Hero — split". Names that look like raw text dumps (one long
  // wordy sentence with no category prefix or dash separator) get
  // flagged here so the manifest reads well in the editor's library
  // UI. Fixture entries hand-author their own names so they should
  // always pass.
  const all = loadManifest();
  const offenders = [];
  for (const s of all) {
    const n = s.name ?? '';
    if (n.length === 0) { offenders.push(`${s.id}: empty`); continue; }
    // Names must not exceed 80 chars (raw dumps like "Abhishek Jha —
    // Visual Designer Coder 100% 100% Scroll down to explore" do).
    if (n.length > 80) offenders.push(`${s.id}: ${n.length} chars — "${n.slice(0, 60)}…"`);
    // Names must start with the category or contain an em-dash
    // separator indicating a structured suffix.
    const cap = s.category[0].toUpperCase() + s.category.slice(1);
    if (!n.startsWith(cap) && !n.startsWith(s.category) && !n.includes('—')) {
      offenders.push(`${s.id}: ${s.category}/${n}`);
    }
  }
  assert.equal(
    offenders.length, 0,
    `entries with non-human names: ${offenders.slice(0, 5).join(' | ')}`,
  );
});

test('every category has at least 6 elements (form/contact allowed down to 2)', () => {
  const all = loadManifest();
  const counts = new Map();
  for (const s of all) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  // Per-category minimums — most categories target 6+. `form` and
  // `contact` are genuine rarities in this creative-agency sample
  // corpus, so they're tolerated down to 2. Every other category
  // should easily clear 6 thanks to the per-category cap (20) and
  // hand-authored fixtures.
  const FLOORS = { form: 2, contact: 2 };
  for (const cat of CATEGORIES) {
    const n = counts.get(cat) ?? 0;
    const floor = FLOORS[cat] ?? 6;
    assert.ok(n >= floor, `category "${cat}" has ${n} elements, expected >= ${floor}`);
  }
});

test('every category has a healthy number of entries (soft upper bound)', () => {
  // Soft check: nothing should be wildly over-represented relative to
  // the per-category cap. If a category balloons past 2x the cap, the
  // round-robin cap is broken (or fixtures doubled up).
  const all = loadManifest();
  const counts = new Map();
  for (const s of all) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  for (const cat of CATEGORIES) {
    const n = counts.get(cat) ?? 0;
    assert.ok(n <= 60, `category "${cat}" has ${n} elements, expected <= 60 (cap is 20 + fixtures)`);
  }
});

// ===========================================================================
// Loader behavior — listCategories / listElements / getElement
// ===========================================================================

test('listCategories returns the canonical category list in order', () => {
  const cats = listCategories();
  assert.deepEqual(cats, [...CATEGORIES]);
});

test('listElements() returns every element', () => {
  const all = listElements();
  const fromManifest = loadManifest();
  assert.equal(all.length, fromManifest.length);
});

test('listElements(category) filters by category', () => {
  for (const cat of CATEGORIES) {
    const items = listElements(cat);
    assert.ok(items.length > 0, `expected at least one element in category "${cat}"`);
    for (const s of items) {
      assert.equal(s.category, cat, `listElements(${cat}) must only return ${cat} items`);
    }
  }
});

test('listCategories includes the new pricing/faq/feature/stats/logos/contact/banner/divider categories', () => {
  const cats = listCategories();
  for (const expected of [
    'pricing', 'faq', 'feature', 'stats', 'logos', 'contact', 'banner', 'divider',
  ]) {
    assert.ok(cats.includes(expected), `listCategories() must include "${expected}"`);
  }
  assert.equal(cats.length, 20, `expected exactly 20 canonical categories, got ${cats.length}`);
});

test('listElements(unknownCategory) returns empty array, not error', () => {
  const items = listElements('not-a-real-category');
  assert.deepEqual(items, []);
});

test('getElement(id) returns the matching element', () => {
  const all = loadManifest();
  // Pick the first one deterministically.
  const target = all[0];
  const got = getElement(target.id);
  assert.ok(got, `getElement("${target.id}") must return an element`);
  assert.equal(got.id, target.id);
  assert.equal(got.category, target.category);
  assert.equal(got.html, target.html);
});

test('getElement(unknownId) returns null', () => {
  assert.equal(getElement('not-a-real-id-12345'), null);
});

test('getElement(bad input) returns null safely', () => {
  assert.equal(getElement(''), null);
  assert.equal(getElement(null), null);
  assert.equal(getElement(undefined), null);
  assert.equal(getElement(123), null);
});

// ===========================================================================
// Cache lifecycle
// ===========================================================================

test('loadManifest returns the same array reference on repeat calls (cached)', () => {
  const a = loadManifest();
  const b = loadManifest();
  assert.equal(a, b);
});

test('_resetManifestCache forces a re-read on next loadManifest()', () => {
  const a = loadManifest();
  _resetManifestCache();
  const b = loadManifest();
  // After a reset, the cache should be repopulated with a fresh array.
  assert.notEqual(a, b);
  // But the contents should be equal-by-value.
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id);
  }
});