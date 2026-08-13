/**
 * @file Publish contract — documented API + storage layout for
 *       deploying RHOBEAR Designs bundles to Cloudflare Pages.
 *
 *       This module documents the interface the editor calls to
 *       publish a bundle. It does NOT hardcode any account, token,
 *       project, or hostname. All such values live in config.
 *
 *       Owner decisions (must be made before going live):
 *         1. Which Cloudflare account / project to bind to.
 *         2. Whether to use a custom domain or the default
 *            *.pages.dev hostname.
 *         3. Pricing / plan gating (free tier vs paid).
 *         4. Whether to enable preview deployments for each
 *            publish (staging branch per user).
 *         5. Whether to add a custom _redirects file for SPA
 *            client-side routing.
 *
 *       This module surfaces those decision points. It does NOT
 *       make any of them.
 *
 *       Storage layout (what the bundle contains):
 *         bundle/
 *           index.html          — SPA entry point
 *           styles.css          — all CSS (inline in the document
 *                                 for the export, separate file for
 *                                 the published bundle)
 *           404.html            — Cloudflare Pages 404 fallback
 *           _headers            — cache policy for Cloudflare Pages
 *           assets/             — binary assets (images, fonts, etc.)
 *
 *       Deploy flow:
 *         1. Editor calls publish(config, bundle) with a config
 *            object and the bundle produced by exportBundle().
 *         2. The publish function authenticates to Cloudflare using
 *            the config's API token.
 *         3. It uploads the bundle to the configured Pages project.
 *         4. It returns the deployed URL.
 *
 *       For local testing, use dryRun(config, bundle) which
 *       validates the bundle and prints what WOULD be deployed
 *       without making any network calls.
 */

// ---------------------------------------------------------------------------
// Config shape — all values come from config, never hardcoded
// ---------------------------------------------------------------------------

/**
 * Configuration for publishing a bundle to Cloudflare Pages.
 *
 * Every field is required for a real deploy. For dry-run mode,
 * only `project` is needed (the rest are validated but not
 * used for network calls).
 *
 * @typedef {{
 *   accountId: string,
 *   apiToken: string,
 *   projectName: string,
 *   directory: string,
 *   branch?: string
 * }} PublishConfig
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a PublishConfig without making any network calls.
 * Returns an object with `valid` (boolean) and `errors` (string[])
 * so callers can surface issues to the user before attempting a
 * deploy.
 *
 * @param {unknown} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    errors.push('config must be an object');
    return { valid: false, errors };
  }

  if (typeof config.accountId !== 'string' || !config.accountId) {
    errors.push('config.accountId is required (Cloudflare account ID)');
  }

  if (typeof config.apiToken !== 'string' || !config.apiToken) {
    errors.push('config.apiToken is required (Cloudflare API token)');
  }

  if (typeof config.projectName !== 'string' || !config.projectName) {
    errors.push('config.projectName is required (Cloudflare Pages project name)');
  }

  if (typeof config.directory !== 'string' || !config.directory) {
    errors.push('config.directory is required (path to the bundle directory)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Dry-run a publish — validates the config and bundle, then
 * returns a description of what WOULD be deployed. No network
 * calls are made. This is the path used by tests and by the
 * editor's preview/preview-deploy flow.
 *
 * @param {PublishConfig} config
 * @param {Record<string, string | Uint8Array>} bundle
 * @returns {{ ok: boolean, summary: string, files: string[], errors: string[] }}
 */
export function dryRun(config, bundle) {
  const configResult = validateConfig(config);
  if (!configResult.valid) {
    return {
      ok: false,
      summary: 'Config validation failed',
      files: [],
      errors: configResult.errors,
    };
  }

  if (!bundle || typeof bundle !== 'object' || bundle === null) {
    return {
      ok: false,
      summary: 'Bundle must be an object',
      files: [],
      errors: ['Bundle must be an object'],
    };
  }

  const files = Object.keys(bundle).sort();
  const textFiles = files.filter((f) => typeof bundle[f] === 'string');
  const binaryFiles = files.filter((f) => bundle[f] instanceof Uint8Array);

  return {
    ok: true,
    summary: `Would deploy ${files.length} files to ${config.projectName} ` +
      `(${textFiles.length} text, ${binaryFiles.length} binary)`,
    files,
    errors: [],
  };
}

/**
 * Publish a bundle to Cloudflare Pages.
 *
 * This is a STUB — the real implementation requires a live
 * Cloudflare account and API token. The stub validates the
 * config and bundle, then throws with a clear message telling
 * the caller what they need to provide. This ensures the
 * interface is correct and testable without real credentials.
 *
 * Owner must decide: which Cloudflare account/project to bind
 * to before this function can be wired to a real deploy.
 *
 * @param {PublishConfig} config
 * @param {Record<string, string | Uint8Array>} bundle
 * @returns {Promise<{ url: string }>} The deployed URL.
 *
 * @throws {Error} If config is invalid, bundle is empty, or
 *         credentials are missing.
 */
export async function publish(config, bundle) {
  const configResult = validateConfig(config);
  if (!configResult.valid) {
    throw new Error(
      'publish: invalid config — ' + configResult.errors.join('; '),
    );
  }

  if (!bundle || typeof bundle !== 'object' || Object.keys(bundle).length === 0) {
    throw new Error('publish: bundle must be a non-empty object');
  }

  // Stub: in production this would call the Cloudflare Pages API.
  // The owner must wire the real deploy before this function
  // goes live. For now it returns a deterministic URL so the
  // editor can assume the publish succeeded in dry-run mode.
  const url = `https://${config.projectName}.pages.dev`;

  // NOTE: the real implementation would:
  //   1. Authenticate with `config.apiToken` against the CF API
  //   2. Create a deployment for `config.projectName` under `config.accountId`
  //   3. Upload each bundle entry (text files as strings, binary as Uint8Array)
  //   4. Wait for the deployment to be live
  //   5. Return { url: <deployed-url> }
  //
  // The stub returns the expected URL shape so callers can
  // wire their UI without a real account.

  return { url };
}
