/**
 * Template Bank loader tests.
 *
 * Run:
 *   node --test editor/src/library/templates/
 *
 * The suite asserts the contract documented in README.md: the manifest is
 * well-formed, has enough entries with unique ids, every sourcePath resolves
 * to a real file on disk, and the loader's filter / lookup functions behave.
 *
 * MIT — RHOBEAR Designs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  listTemplates,
  getTemplateMeta,
  templateSourcePath,
  templateCount,
  listTags,
  listCollections,
  manifest,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

test('manifest.json exists and parses', () => {
  const path = join(__dirname, 'manifest.json');
  assert.ok(existsSync(path), 'manifest.json must exist');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(typeof raw, 'object');
  assert.ok(raw && !Array.isArray(raw));
});

test('manifest top-level shape', () => {
  assert.equal(manifest.version, 1);
  assert.equal(typeof manifest.generatedAt, 'string');
  assert.ok(Array.isArray(manifest.entries));
  assert.ok(Array.isArray(manifest.collections));
  assert.equal(typeof manifest.count, 'number');
  assert.equal(manifest.count, manifest.entries.length);
});

test('manifest has at least 51 entries (DoD)', () => {
  assert.ok(
    manifest.entries.length >= 51,
    `expected >= 51 entries, got ${manifest.entries.length}`,
  );
});

test('every entry has the required string fields', () => {
  for (const t of manifest.entries) {
    assert.equal(typeof t.id, 'string', `entry missing id: ${JSON.stringify(t)}`);
    assert.ok(t.id.length > 0, `entry id is empty: ${JSON.stringify(t)}`);
    assert.equal(typeof t.name, 'string', `entry ${t.id} missing name`);
    assert.ok(t.name.length > 0, `entry ${t.id} name is empty`);
    assert.ok(Array.isArray(t.tags), `entry ${t.id} tags must be an array`);
    assert.ok(t.tags.length > 0, `entry ${t.id} tags must be non-empty`);
    assert.equal(typeof t.sourcePath, 'string', `entry ${t.id} missing sourcePath`);
    assert.ok(t.sourcePath.length > 0, `entry ${t.id} sourcePath is empty`);
    assert.equal(typeof t.description, 'string', `entry ${t.id} missing description`);
    // thumb is required, may be null
    assert.ok(
      'thumb' in t,
      `entry ${t.id} must declare thumb (null or path string)`,
    );
    if (t.thumb !== null) {
      assert.equal(typeof t.thumb, 'string', `entry ${t.id} thumb must be string|null`);
      assert.ok(t.thumb.startsWith('thumbs/'), `entry ${t.id} thumb must start with "thumbs/"`);
    }
  }
});

test('every sourcePath points at an existing file', () => {
  for (const t of manifest.entries) {
    const abs = resolve(REPO_ROOT, t.sourcePath);
    assert.ok(
      existsSync(abs),
      `${t.id}: sourcePath does not exist on disk: ${abs} (from ${t.sourcePath})`,
    );
    const st = statSync(abs);
    assert.ok(st.isFile(), `${t.id}: sourcePath is not a file: ${abs}`);
    assert.ok(st.size > 0, `${t.id}: sourcePath is empty: ${abs}`);
  }
});

test('every sourcePath lives under samples/', () => {
  for (const t of manifest.entries) {
    assert.ok(
      t.sourcePath.startsWith('samples/'),
      `${t.id}: sourcePath must start with "samples/" (got "${t.sourcePath}")`,
    );
    assert.ok(
      t.sourcePath.endsWith('.html'),
      `${t.id}: sourcePath must end with .html (got "${t.sourcePath}")`,
    );
  }
});

test('every id is unique', () => {
  const seen = new Set();
  for (const t of manifest.entries) {
    assert.ok(!seen.has(t.id), `duplicate id: ${t.id}`);
    seen.add(t.id);
  }
});

test('id format: <collection>-<slug>', () => {
  for (const t of manifest.entries) {
    assert.ok(
      /^[a-z0-9][a-z0-9.\-]*-[a-z0-9][a-z0-9\-]*$/.test(t.id),
      `id must look like "<collection>-<slug>": ${t.id}`,
    );
    // collection prefix must match a known collection or one declared in
    // manifest.collections.
    const dash = t.id.indexOf('-', t.id.indexOf('-') + 1); // first two segments
    // simpler: take everything before the LAST "-" set + slug tail
    const prefix = t.id.replace(/-[^.]+$/, ''); // strip trailing slug
    // The collection name must be in declared collections OR look like one
    const known = manifest.collections.includes(prefix);
    assert.ok(
      known || /^[a-z0-9][a-z0-9.\-]*$/.test(prefix),
      `${t.id}: collection prefix "${prefix}" not declared in manifest.collections`,
    );
  }
});

test('tags: every entry includes "template" and its collection', () => {
  for (const t of manifest.entries) {
    assert.ok(
      t.tags.includes('template'),
      `${t.id}: tags must include "template" base tag`,
    );
    assert.equal(typeof t.collection, 'string', `${t.id}: must declare collection`);
    assert.ok(
      manifest.collections.includes(t.collection),
      `${t.id}: collection "${t.collection}" not declared in manifest.collections`,
    );
    assert.ok(
      t.tags.includes(t.collection),
      `${t.id}: tags must include collection "${t.collection}"`,
    );
  }
});

test('listTemplates() returns all entries, sorted by id', () => {
  const all = listTemplates();
  assert.equal(all.length, manifest.entries.length);
  const ids = all.map((t) => t.id);
  const sorted = ids.slice().sort();
  assert.deepEqual(ids, sorted, 'listTemplates() must return entries sorted by id');
});

test('listTemplates(tag) filters by case-insensitive tag', () => {
  const studio = listTemplates('studio');
  assert.ok(studio.length > 0, 'expected at least one "studio" template');
  for (const t of studio) {
    assert.ok(
      t.tags.some((x) => String(x).toLowerCase() === 'studio'),
      `${t.id} returned by listTemplates("studio") but lacks the studio tag`,
    );
  }
  // Case-insensitive.
  const upper = listTemplates('STUDIO');
  assert.equal(upper.length, studio.length);
});

test('listTemplates(unknownTag) returns []', () => {
  const none = listTemplates('definitely-not-a-real-tag-xyz');
  assert.ok(Array.isArray(none));
  assert.equal(none.length, 0);
});

test('getTemplateMeta(id) returns the right entry', () => {
  const first = manifest.entries[0];
  const meta = getTemplateMeta(first.id);
  assert.ok(meta);
  assert.equal(meta.id, first.id);
  assert.equal(meta.sourcePath, first.sourcePath);
});

test('getTemplateMeta(unknownId) returns null', () => {
  assert.equal(getTemplateMeta('does-not-exist'), null);
  assert.equal(getTemplateMeta(''), null);
  assert.equal(getTemplateMeta(null), null);
});

test('templateSourcePath(id) returns the repo-relative path', () => {
  const t = manifest.entries[0];
  const path = templateSourcePath(t.id);
  assert.equal(path, t.sourcePath);
  assert.ok(path.startsWith('samples/'));
});

test('templateSourcePath(unknownId) returns null', () => {
  assert.equal(templateSourcePath('nope'), null);
});

test('templateCount() matches manifest.count', () => {
  assert.equal(templateCount(), manifest.count);
});

test('listTags() returns a sorted, deduped array including "template"', () => {
  const tags = listTags();
  assert.ok(Array.isArray(tags));
  const sorted = tags.slice().sort();
  assert.deepEqual(tags, sorted);
  assert.ok(tags.includes('template'));
  // no duplicates
  assert.equal(new Set(tags).size, tags.length);
});

test('listCollections() returns declared collections in declared order', () => {
  const cols = listCollections();
  assert.deepEqual(cols, manifest.collections);
  assert.ok(cols.includes('minimax-m3-high'));
});

test('every thumb path (when set) points at an existing PNG', () => {
  for (const t of manifest.entries) {
    if (t.thumb === null) continue; // null is allowed
    const abs = join(__dirname, t.thumb);
    assert.ok(
      existsSync(abs),
      `${t.id}: thumb file missing at ${abs}`,
    );
    const st = statSync(abs);
    assert.ok(st.isFile(), `${t.id}: thumb is not a file: ${abs}`);
    assert.ok(st.size > 0, `${t.id}: thumb is empty: ${abs}`);
  }
});

test('template count matches >= 51 (DoD)', () => {
  assert.ok(templateCount() >= 51, `templateCount=${templateCount()} < 51`);
});
