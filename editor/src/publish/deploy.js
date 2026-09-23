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

import {
  validateConfig,
  dryRun as dryRunImpl,
  publish,
  validateBundle,
  findInvalidBundleValues,
} from './api.js';
import { exportBundle, exportBundleDetailed } from './export.js';

// ---------------------------------------------------------------------------
// Re-export the public surface so consumers can import from either
// deploy.js or api.js. index.js stays the documented entry point.
// ---------------------------------------------------------------------------

export {
  validateConfig,
  validateBundle,
  dryRunImpl as dryRun,
  publish,
  exportBundle,
  exportBundleDetailed,
  findInvalidBundleValues,
};

// ---------------------------------------------------------------------------
// Deploy-specific helpers
// ---------------------------------------------------------------------------

/**
 * Perform a dry-run deploy: validate config + bundle, then
 * return a summary of what would happen. No network calls are
 * made. This is the path used by tests and by the editor's
 * preview/preview-deploy flow.
 *
 * When assets are skipped during export (unsafe path, collision,
 * or empty key), they are surfaced in the `skipped` field so
 * callers can warn users instead of silently deploying incomplete
 * content.
 *
 * @param {object} config - PublishConfig (see api.js)
 * @param {object} project - The editor project { html, css, title, assets? }
 * @returns {{ ok: boolean, summary: string, files: string[], errors: string[], skipped?: object[] }}
 */
export function dryRunDeploy(config, project) {
  const { bundle, skipped } = exportBundleDetailed(project);
  const bundleValidation = validateBundle(bundle);

  if (!bundleValidation.valid) {
    return {
      ok: false,
      summary: 'Bundle validation failed',
      files: [],
      errors: bundleValidation.errors,
    };
  }

  // Fail hard on skipped assets: the user's project referenced
  // assets that cannot be safely deployed. Surface the skipped
  // list so the caller can explain what was rejected.
  if (skipped.length > 0) {
    const reasons = skipped.map(s => `${s.key}: ${s.reason}`);
    return {
      ok: false,
      summary: 'Some assets were skipped during export',
      files: [],
      errors: reasons.map(r => `Asset skipped: ${r}`),
      skipped,
    };
  }

  const result = dryRunImpl(config, bundle);
  // Propagate skipped (empty in success path, populated above for failure)
  return { ...result, skipped };
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

  const { bundle, skipped } = exportBundleDetailed(project);

  // Fail hard on skipped assets: the user's project referenced
  // assets that cannot be safely deployed.
  if (skipped.length > 0) {
    const reasons = skipped.map(s => `${s.key}: ${s.reason}`);
    throw new Error(
      'deploy: some assets were skipped — ' + reasons.join('; '),
    );
  }

  const bundleValidation = validateBundle(bundle);
  if (!bundleValidation.valid) {
    throw new Error(
      'deploy: bundle validation failed — ' + bundleValidation.errors.join('; '),
    );
  }

  // Enforce the same bundle contract dryRun() and publish() do.
  // The real deploy path must never be laxer than the dry-run path.
  const invalidFiles = findInvalidBundleValues(bundle);
  if (invalidFiles.length > 0) {
    throw new Error(
      'deploy: bundle contains invalid value types — ' + invalidFiles.map(
        (f) => `Bundle value for "${f}" must be string or Uint8Array`,
      ).join('; '),
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
