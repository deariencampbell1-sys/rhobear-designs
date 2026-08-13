/**
 * @file Tests for the publish/api module.
 *
 *       Covers:
 *         - validateConfig accepts valid config
 *         - validateConfig rejects missing/invalid fields
 *         - dryRun validates config and bundle, returns summary
 *         - dryRun rejects invalid config
 *         - dryRun rejects invalid bundle
 *         - publish stub validates config and returns a URL shape
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
    { 'index.html': '<p>hi</p>', 'styles.css': 'p{}' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.summary.includes('my-project'));
  assert.ok(result.summary.includes('2 files'));
  assert.ok(result.files.includes('index.html'));
  assert.ok(result.files.includes('styles.css'));
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
      'assets/logo.png': new Uint8Array([0x89]),
    },
  );

  assert.equal(result.ok, true);
  assert.ok(result.summary.includes('3 files'));
  assert.ok(result.summary.includes('2 text'));
  assert.ok(result.summary.includes('1 binary'));
});

// ---------------------------------------------------------------------------
// publish (stub)
// ---------------------------------------------------------------------------

test('publish: stub validates config and returns a URL shape', async () => {
  const result = await publish(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    { 'index.html': '<p>hi</p>' },
  );

  assert.ok(result.url);
  assert.match(result.url, /\.pages\.dev$/);
  assert.match(result.url, /my-project/);
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
