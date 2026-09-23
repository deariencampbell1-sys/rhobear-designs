/**
 * @file Tests for the publish/api module.
 *
 *       Covers:
 *         - validateConfig accepts valid config
 *         - validateConfig rejects missing/invalid fields
 *         - dryRun validates config and bundle, returns summary
 *         - dryRun rejects invalid config
 *         - dryRun rejects invalid bundle
 *         - dryRun rejects bundle values that are neither string nor
 *           Uint8Array
 *         - publish stub always throws — it validates config and
 *           bundle first, then throws the not-yet-wired error
 *         - publish rejects invalid config
 *         - publish rejects empty bundle
 *
 *       Run with: `node --test src/publish/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateConfig, dryRun, publish } from './api.js';

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

test('validateConfig: accepts a valid config', () => {
  const result = validateConfig({
    accountId: 'abc123',
    apiToken: 'token-xyz',
    projectName: 'my-project',
    directory: '/tmp/bundle',
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateConfig: rejects missing accountId', () => {
  const result = validateConfig({
    apiToken: 'token-xyz',
    projectName: 'my-project',
    directory: '/tmp/bundle',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('accountId')));
});

test('validateConfig: rejects missing apiToken', () => {
  const result = validateConfig({
    accountId: 'abc123',
    projectName: 'my-project',
    directory: '/tmp/bundle',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('apiToken')));
});

test('validateConfig: rejects missing projectName', () => {
  const result = validateConfig({
    accountId: 'abc123',
    apiToken: 'token-xyz',
    directory: '/tmp/bundle',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('projectName')));
});

test('validateConfig: rejects missing directory', () => {
  const result = validateConfig({
    accountId: 'abc123',
    apiToken: 'token-xyz',
    projectName: 'my-project',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('directory')));
});

test('validateConfig: rejects non-object config', () => {
  const result = validateConfig(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateConfig: rejects undefined config', () => {
  const result = validateConfig(undefined);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

// ---------------------------------------------------------------------------
// dryRun
// ---------------------------------------------------------------------------

test('dryRun: validates a valid config + bundle', () => {
  const result = dryRun(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    { 'index.html': '<p>hi</p>', 'styles.css': 'p{}', '404.html': '<p>not found</p>' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.summary.includes('my-project'));
  assert.ok(result.summary.includes('3 files'));
  assert.ok(result.files.includes('index.html'));
  assert.ok(result.files.includes('styles.css'));
  assert.ok(result.files.includes('404.html'));
});

test('dryRun: rejects invalid config', () => {
  const result = dryRun(
    { accountId: '', apiToken: '', projectName: '', directory: '' },
    { 'index.html': '<p>hi</p>' },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('dryRun: rejects non-object bundle', () => {
  const result = dryRun(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    null,
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Bundle must be an object')));
});

test('dryRun: counts text and binary files correctly', () => {
  const result = dryRun(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      'index.html': '<p>hi</p>',
      'styles.css': 'p{}',
      '404.html': '<p>not found</p>',
      'assets/logo.png': new Uint8Array([0x89]),
    },
  );

  assert.equal(result.ok, true);
  assert.ok(result.summary.includes('4 files'));
  assert.ok(result.summary.includes('3 text'));
  assert.ok(result.summary.includes('1 binary'));
});

test('dryRun: rejects bundle with a non-string, non-binary value', () => {
  const result = dryRun(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      'index.html': '<html></html>',
      'styles.css': 'p{}',
      '404.html': '<html></html>',
      'bad.txt': 42,
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.files, []);
  assert.match(result.summary, /invalid value types/);
  assert.ok(result.errors.some((e) => e.includes('bad.txt')));
});

test('dryRun: rejects bundle with a null value', () => {
  const result = dryRun(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      'index.html': '<html></html>',
      'styles.css': 'p{}',
      '404.html': '<html></html>',
      'bad.txt': null,
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.files, []);
  assert.ok(result.errors.some((e) => e.includes('bad.txt')));
});

// ---------------------------------------------------------------------------
// publish (stub)
// ---------------------------------------------------------------------------

test('publish: stub throws with instructions (not a real deploy)', async () => {
  await assert.rejects(
    async () => publish(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      // A complete, valid bundle — publish validates before the stub throw.
      {
        'index.html': '<p>hi</p>',
        'styles.css': 'p{}',
        '404.html': '<p>not found</p>',
      },
    ),
    /Cloudflare Pages publish is not yet wired/,
  );
});

test('publish: rejects a bundle missing required files', async () => {
  await assert.rejects(
    async () => publish(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      // Structurally an object, but missing styles.css and 404.html —
      // publish must enforce the same contract dryRun does.
      { 'index.html': 'x' },
    ),
    (err) => {
      assert.match(err.message, /styles\.css/);
      assert.match(err.message, /404\.html/);
      return true;
    },
  );
});

test('publish: rejects a bundle with invalid value types', async () => {
  await assert.rejects(
    async () => publish(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      {
        'index.html': 'x',
        'styles.css': 'p{}',
        '404.html': 'x',
        'bad.txt': 42,
      },
    ),
    /bad\.txt/,
  );
});

test('publish: stub rejects invalid config', async () => {
  await assert.rejects(
    async () => publish(
      { accountId: '', apiToken: '', projectName: '', directory: '' },
      { 'index.html': '<p>hi</p>' },
    ),
    /invalid config/,
  );
});

test('publish: stub rejects empty bundle', async () => {
  await assert.rejects(
    async () => publish(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      {},
    ),
    /non-empty object/,
  );
});

test('publish: stub rejects null bundle', async () => {
  await assert.rejects(
    async () => publish(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      null,
    ),
    /non-empty object/,
  );
});
