/**
 * @file Deploy module — dry/local deploy path for the publish
 *       substrate.
 *
 *       Provides two paths:
 *         1. dryRunDeploy(config, bundle) — validates + prints what
 *            would be deployed. No network calls. Used by tests
 *            and the editor's preview flow.
 *         2. deploy(config, bundle) — stubbed real deploy. Validates
 *            config, then throws with instructions for wiring the
 *            real Cloudflare Pages deploy. The stub is intentionally
 *            non-operational until the owner provides credentials
 *            and project binding.
 *
 *       All account/token/project/hostname values come from config,
 *       never from this module. No secrets are hardcoded.
 */

import { dryRun, publish, validateConfig } from './api.js';
import { exportBundle } from './export.js';

// ---------------------------------------------------------------------------
// Re-export the public surface from api.js so consumers can import
// from either deploy.js or api.js
// ---------------------------------------------------------------------------

export { validateConfig, dryRun, publish };
export { exportBundle };

// ---------------------------------------------------------------------------
// Deploy-specific helpers
// ---------------------------------------------------------------------------

/**
 * Validate a bundle structure before deploy. Checks that the
 * bundle contains the minimum files a static host needs.
 *
 * @param {Record<string, string | Uint8Array>} bundle
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBundle(bundle) {
  const errors = [];

  if (!bundle || typeof bundle !== 'object') {
    errors.push('bundle must be an object');
    return { valid: false, errors };
  }

  if (!('index.html' in bundle)) {
    errors.push('bundle is missing index.html');
  }

  if (!('styles.css' in bundle)) {
    errors.push('bundle is missing styles.css');
  }

  if (!('404.html' in bundle)) {
    errors.push('bundle is missing 404.html (Cloudflare Pages doctrine)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Perform a dry-run deploy: validate config + bundle, then
 * return a summary of what would happen. No network calls are
 * made. This is the path used by tests and by the editor's
 * preview/preview-deploy flow.
 *
 * @param {object} config - PublishConfig (see api.js)
 * @param {object} project - The editor project { html, css, title, assets? }
 * @returns {{ ok: boolean, summary: string, files: string[], errors: string[] }}
 */
export function dryRunDeploy(config, project) {
  const bundle = exportBundle(project);
  const bundleValidation = validateBundle(bundle);

  if (!bundleValidation.valid) {
    return {
      ok: false,
      summary: 'Bundle validation failed',
      files: [],
      errors: bundleValidation.errors,
    };
  }

  return dryRun(config, bundle);
}

/**
 * Deploy a project to Cloudflare Pages. This is a STUB — the
 * real implementation requires a live Cloudflare account and API
 * token. The stub validates the config and bundle, then throws
 * with a clear message telling the caller what they need to
 * provide.
 *
 * Owner must decide: which Cloudflare account/project to bind
 * to before this function can be wired to a real deploy.
 *
 * @param {object} config - PublishConfig (see api.js)
 * @param {object} project - The editor project { html, css, title, assets? }
 * @returns {Promise<{ url: string }>}
 *
 * @throws {Error} Always throws with instructions until the owner
 *         wires the real Cloudflare Pages deploy.
 */
export async function deploy(config, project) {
  const configResult = validateConfig(config);
  if (!configResult.valid) {
    throw new Error(
      'deploy: invalid config — ' + configResult.errors.join('; '),
    );
  }

  const bundle = exportBundle(project);
  const bundleValidation = validateBundle(bundle);

  if (!bundleValidation.valid) {
    throw new Error(
      'deploy: bundle validation failed — ' + bundleValidation.errors.join('; '),
    );
  }

  // Stub: the real implementation would call publish() with the
  // validated config and bundle. Until the owner wires credentials,
  // this throws with clear instructions.
  throw new Error(
    'deploy: Cloudflare Pages deploy is not yet wired. ' +
    'The owner must provide: (1) a Cloudflare API token, ' +
    '(2) an account ID, (3) a Pages project name. ' +
    'See the publish contract in editor/src/publish/api.js for the config shape.',
  );
}
