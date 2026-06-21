/**
 * Tests for the open-license font catalog + loader.
 * Run with: `node --test src/library/fonts/`
 *
 * MIT — RHOBEAR Designs (original)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  listFonts,
  getFont,
  loadFont,
  fontStack,
  catalog,
  FONT_CATALOG,
  CATEGORIES,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Open-license license identifiers allowed in the catalog. */
const ALLOWED_LICENSES = new Set(['OFL-1.1', 'OFL', 'Apache-2.0', 'Ubuntu Font Licence']);

/** Categories the catalog is curated around. */
const ALLOWED_CATEGORIES = new Set(['sans', 'serif', 'display', 'mono', 'handwriting']);

test('catalog.json parses and is the expected size (40-60)', () => {
  const raw = readFileSync(join(__dirname, 'catalog.json'), 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), 'catalog must be a JSON array');
  assert.ok(parsed.length >= 40, `catalog must have >=40 families (got ${parsed.length})`);
  assert.ok(parsed.length <= 60, `catalog must have <=60 families (got ${parsed.length})`);
  // Round-trip identity: the imported catalog should be the same array
  assert.equal(catalog.length, parsed.length, 'imported catalog length must match raw JSON');
});

test('every catalog entry has all required fields with sane types', () => {
  for (const f of catalog) {
    assert.equal(typeof f.family, 'string', `family must be a string: ${JSON.stringify(f)}`);
    assert.ok(f.family.length > 0, `family must be non-empty: ${JSON.stringify(f)}`);
    assert.ok(ALLOWED_CATEGORIES.has(f.category), `bad category for ${f.family}: ${f.category}`);
    assert.equal(typeof f.cssUrl, 'string', `cssUrl must be a string for ${f.family}`);
    assert.ok(
      /^https:\/\/fonts\.googleapis\.com\/css2\?family=/.test(f.cssUrl),
      `cssUrl must be a Google Fonts css2 URL for ${f.family}: ${f.cssUrl}`,
    );
    assert.equal(typeof f.license, 'string', `license must be a string for ${f.family}`);
    assert.ok(Array.isArray(f.weights), `weights must be an array for ${f.family}`);
    assert.ok(f.weights.length > 0, `weights must be non-empty for ${f.family}`);
    for (const w of f.weights) {
      assert.ok(
        typeof w === 'number' || typeof w === 'string',
        `weight entries must be number or string for ${f.family}`,
      );
    }
    // cssUrl must actually mention the family (URL-encoded with `+`)
    const expectedSlug = f.family.replace(/\s+/g, '+');
    assert.ok(
      f.cssUrl.includes(`family=${expectedSlug}`),
      `cssUrl for ${f.family} must include family=${expectedSlug}: ${f.cssUrl}`,
    );
  }
});

test('every license is an open-license (OFL / Apache-2.0 / Ubuntu FL)', () => {
  const seen = new Set();
  for (const f of catalog) {
    assert.ok(
      ALLOWED_LICENSES.has(f.license),
      `disallowed license for ${f.family}: ${f.license}`,
    );
    seen.add(f.license);
  }
  // Realistic distribution: at least one OFL-1.1 family present.
  assert.ok(seen.has('OFL-1.1'), 'expected at least one OFL-1.1 family in the catalog');
});

test('family names are unique within the catalog', () => {
  const seen = new Set();
  for (const f of catalog) {
    assert.ok(!seen.has(f.family), `duplicate family in catalog: ${f.family}`);
    seen.add(f.family);
  }
  assert.equal(seen.size, catalog.length, 'unique family count must equal catalog length');
});

test('all five expected categories are populated', () => {
  for (const cat of CATEGORIES) {
    const items = listFonts(cat);
    assert.ok(items.length > 0, `expected at least one entry for category "${cat}"`);
    for (const f of items) {
      assert.equal(f.category, cat, `entry ${f.family} has wrong category`);
    }
  }
});

test('listFonts() returns every entry when no category is given', () => {
  const all = listFonts();
  assert.equal(all.length, catalog.length, 'listFonts() must return every entry');
  // Returned array is a fresh copy, not the catalog itself
  assert.notEqual(all, catalog, 'listFonts() must return a defensive copy');
});

test('listFonts() defensive copy can be mutated without affecting the catalog', () => {
  const all = listFonts();
  const before = catalog.length;
  all.pop();
  assert.equal(catalog.length, before, 'mutating listFonts() result must not change the catalog');
});

test('getFont returns the matching entry, or null for unknown families', () => {
  const inter = getFont('Inter');
  assert.ok(inter, 'Inter should be in the catalog');
  assert.equal(inter.family, 'Inter');
  assert.equal(inter.category, 'sans');
  assert.equal(getFont('NotARealFont123'), null);
  assert.equal(getFont(''), null);
  assert.equal(getFont(null), null);
});

test('loadFont is a safe no-op in Node (returns false, throws nothing)', () => {
  // The catalog entry exists, but we have no document — must not throw.
  assert.equal(loadFont('Inter'), false);
  // And unknown families are still false, not an error.
  assert.equal(loadFont('DefinitelyNotAFont'), false);
});

test('loadFont is idempotent: duplicate DOM injections must be safe', () => {
  // Save and restore the real document so we don't pollute later tests.
  const realDocument = globalThis.document;
  try {
    const links = [];
    const makeLink = (tag) => ({
      tagName: (tag || 'link').toUpperCase(),
      rel: '',
      href: '',
      dataset: {},
      get href() { return this._href || ''; },
      set href(v) { this._href = v; },
    });
    globalThis.document = {
      createElement: (tag) => makeLink(tag),
      head: {
        querySelectorAll: () => links,
        appendChild: (el) => { links.push(el); },
      },
    };

    // First call injects a <link> for Inter.
    assert.equal(loadFont('Inter'), true, 'first loadFont(Inter) must succeed');
    assert.equal(links.length, 1, 'one <link> should have been injected');
    assert.equal(links[0].rel, 'stylesheet', 'injected link must be rel=stylesheet');
    assert.equal(
      links[0]._href,
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      'injected link href must match the catalog entry',
    );
    assert.equal(
      links[0].dataset.rhobearFont,
      'Inter',
      'injected link must carry data-rhobear-font="Inter"',
    );

    // Second call with the same family must NOT inject again.
    assert.equal(loadFont('Inter'), true, 'second loadFont(Inter) must still return true');
    assert.equal(links.length, 1, 'second call must not inject a duplicate <link>');

    // A different family injects a second <link>.
    assert.equal(loadFont('JetBrains Mono'), true);
    assert.equal(links.length, 2, 'a new family should inject a fresh <link>');
  } finally {
    if (realDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = realDocument;
    }
  }
});

test('fontStack returns a CSS fallback chain, quoting families with whitespace', () => {
  const inter = fontStack('Inter');
  assert.ok(typeof inter === 'string', 'fontStack must return a string for known families');
  assert.ok(inter.startsWith('Inter,'), `family must lead the stack: ${inter}`);
  assert.ok(/sans-serif/.test(inter), 'sans category must include a sans-serif fallback');

  const dmSans = fontStack('DM Sans');
  assert.ok(
    dmSans.startsWith('"DM Sans"'),
    `multi-word family must be quoted: ${dmSans}`,
  );
  assert.ok(/sans-serif/.test(dmSans), 'DM Sans should fall back to sans-serif');

  const jet = fontStack('JetBrains Mono');
  assert.ok(jet.startsWith('"JetBrains Mono"'), 'JetBrains Mono must be quoted');
  assert.ok(/monospace/.test(jet), 'mono category must include a monospace fallback');

  const caveat = fontStack('Caveat');
  assert.ok(/cursive/.test(caveat), 'handwriting category must include a cursive fallback');

  assert.equal(fontStack('DefinitelyNotAFont'), null);
});

test('FONT_CATALOG is a frozen defensive copy of the catalog', () => {
  assert.equal(FONT_CATALOG.length, catalog.length);
  assert.ok(Object.isFrozen(FONT_CATALOG), 'FONT_CATALOG must be frozen');
  assert.throws(() => { FONT_CATALOG.pop(); }, TypeError, 'mutating FONT_CATALOG must throw');
});
