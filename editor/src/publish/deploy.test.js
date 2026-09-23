/**
 * @file Tests for the publish/deploy module.
 *
 *       Covers:
 *         - exportBundle is re-exported from deploy.js
 *         - validateBundle checks for required files
 *         - validateBundle rejects missing index.html
 *         - validateBundle rejects missing styles.css
 *         - validateBundle rejects missing 404.html
 *         - validateBundle accepts a complete bundle
 *         - dryRunDeploy validates config + project, produces a summary
 *         - dryRunDeploy rejects invalid config
 *         - dryRunDeploy rejects invalid project (missing html)
 *         - deploy stub throws with instructions (not a real deploy)
 *         - deploy stub throws after validation for a project
 *           exportBundle considers valid
 *
 *       Run with: `node --test src/publish/`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  exportBundle,
  exportBundleDetailed,
  validateBundle,
  dryRunDeploy,
  deploy,
} from './deploy.js';

// ---------------------------------------------------------------------------
// validateBundle
// ---------------------------------------------------------------------------

test('validateBundle: accepts a complete bundle', () => {
  const result = validateBundle({
    'index.html': '<p>hi</p>',
    'styles.css': 'p{}',
    '404.html': '<p>not found</p>',
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateBundle: rejects missing index.html', () => {
  const result = validateBundle({
    'styles.css': 'p{}',
    '404.html': '<p>not found</p>',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('index.html')));
});

test('validateBundle: rejects missing styles.css', () => {
  const result = validateBundle({
    'index.html': '<p>hi</p>',
    '404.html': '<p>not found</p>',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('styles.css')));
});

test('validateBundle: rejects missing 404.html', () => {
  const result = validateBundle({
    'index.html': '<p>hi</p>',
    'styles.css': 'p{}',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('404.html')));
});

test('validateBundle: rejects non-object bundle', () => {
  const result = validateBundle(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('object')));
});

// ---------------------------------------------------------------------------
// exportBundle re-export
// ---------------------------------------------------------------------------

test('deploy: re-exports exportBundle', () => {
  // The deploy module re-exports exportBundle so consumers can
  // import it from either path.
  const bundle = exportBundle({
    html: '<p>hi</p>',
    css: 'p{}',
    title: 'Test',
  });

  assert.ok('index.html' in bundle);
});

test('deploy: re-exports exportBundleDetailed', () => {
  // Verify that exportBundleDetailed is re-exported and returns
  // the skipped array for assets that cannot be safely written.
  const { bundle, skipped } = exportBundleDetailed({
    html: '<p>hi</p>',
    css: 'p{}',
    title: 'Test',
    assets: { '/a\\b.png': new Uint8Array([1, 2, 3]) },
  });

  assert.ok('index.html' in bundle);
  assert.ok(Array.isArray(skipped));
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].reason, 'unsafe-path');
});

// ---------------------------------------------------------------------------
// dryRunDeploy
// ---------------------------------------------------------------------------

test('dryRunDeploy: validates a valid config + project', () => {
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      html: '<p>hi</p>',
      css: 'p { color: red; }',
      title: 'Test Page',
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.summary.includes('my-project'));
  assert.ok(result.files.includes('index.html'));
  assert.ok(result.files.includes('styles.css'));
  assert.ok(result.files.includes('404.html'));
  assert.ok(result.files.includes('_headers'));
});

test('dryRunDeploy: rejects invalid config', () => {
  const result = dryRunDeploy(
    { accountId: '', apiToken: '', projectName: '', directory: '' },
    { html: '<p>hi</p>', css: 'p{}', title: 'Test' },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('dryRunDeploy: allows project with missing html (empty body is valid)', () => {
  // An empty project still produces a valid bundle (empty html
  // is safe), so this test confirms the bundle is still valid.
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    { css: 'p{}', title: 'Test' },
  );

  // Empty html is allowed — the bundle is still valid.
  assert.equal(result.ok, true);
});

test('dryRunDeploy: includes assets in the bundle files', () => {
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      html: '<img src="assets/logo.png">',
      css: 'img { max-width: 100%; }',
      title: 'Test Page',
      assets: {
        'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      },
    },
  );

  assert.equal(result.ok, true);
  assert.ok(result.files.includes('assets/logo.png'));
});

// ---------------------------------------------------------------------------
// deploy (stub)
// ---------------------------------------------------------------------------

test('deploy: stub throws with instructions', async () => {
  await assert.rejects(
    async () => deploy(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      { html: '<p>hi</p>', css: 'p{}', title: 'Test' },
    ),
    /Cloudflare Pages deploy is not yet wired/,
  );
});

test('deploy: stub throws after validation for a project exportBundle considers valid', async () => {
  // Missing html is fine — exportBundle still emits index.html,
  // styles.css, and 404.html, so the bundle validates and the call
  // reaches the deploy stub, which is where it throws.
  //
  // Consequence: deploy()'s 'bundle validation failed' branch is
  // defensive/unreachable today, because every project exportBundle
  // accepts produces those three required files. It stays as a guard
  // in case exportBundle ever stops emitting one of them.
  await assert.rejects(
    async () => deploy(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      { css: 'p{}' },
    ),
    /Cloudflare Pages deploy is not yet wired/,
  );
});

test('deploy: stub rejects invalid config', async () => {
  await assert.rejects(
    async () => deploy(
      { accountId: '', apiToken: '', projectName: '', directory: '' },
      { html: '<p>hi</p>', css: 'p{}', title: 'Test' },
    ),
    /invalid config/,
  );
});

// ---------------------------------------------------------------------------
// deploy: skipped-asset and value-type contracts
// ---------------------------------------------------------------------------

test('dryRunDeploy: fails when assets are skipped (unsafe-path)', () => {
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      html: '<h1>hi</h1>',
      css: 'h1{}',
      assets: { '/a\\b.png': new Uint8Array([1, 2, 3]) },
    },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('unsafe-path')));
  assert.ok(Array.isArray(result.skipped));
  assert.equal(result.skipped.length, 1);
});

test('dryRunDeploy: fails when assets collide (collision)', () => {
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    {
      html: '<h1>hi</h1>',
      css: 'h1{}',
      assets: {
        '/logo.png': new Uint8Array([1]),
        'logo.png': new Uint8Array([2]),
      },
    },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('collision')));
});

test('dryRunDeploy: skipped is empty array on success', () => {
  const result = dryRunDeploy(
    {
      accountId: 'abc123',
      apiToken: 'token-xyz',
      projectName: 'my-project',
      directory: '/tmp/bundle',
    },
    { html: '<h1>hi</h1>', css: 'h1{}' },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.skipped, []);
});

test('deploy: throws when assets are skipped (unsafe-path)', async () => {
  await assert.rejects(
    async () => deploy(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      {
        html: '<h1>hi</h1>',
        css: 'h1{}',
        assets: { '/a\\b.png': new Uint8Array([1, 2, 3]) },
      },
    ),
    /some assets were skipped/,
  );
});

test('deploy: throws when assets are skipped (collision)', async () => {
  await assert.rejects(
    async () => deploy(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      {
        html: '<h1>hi</h1>',
        css: 'h1{}',
        assets: {
          '/logo.png': new Uint8Array([1]),
          'logo.png': new Uint8Array([2]),
        },
      },
    ),
    /some assets were skipped/,
  );
});

test('deploy: throws when the bundle contains invalid value types', async () => {
  // Build a project whose exported bundle carries a non-string,
  // non-Uint8Array value. exportBundle does not type-check asset
  // values, so deploy() must catch it — the real deploy path is
  // never laxer than the dry-run path.
  const project = {
    html: '<h1>hi</h1>',
    css: 'h1{}',
    assets: { 'logo.png': /** @type {any} */ (42) },
  };
  const { bundle } = exportBundleDetailed(project);
  // Sanity: the bad value made it into the bundle.
  assert.equal(bundle['assets/logo.png'], 42);

  await assert.rejects(
    async () => deploy(
      {
        accountId: 'abc123',
        apiToken: 'token-xyz',
        projectName: 'my-project',
        directory: '/tmp/bundle',
      },
      project,
    ),
    /invalid value types/,
  );
});
