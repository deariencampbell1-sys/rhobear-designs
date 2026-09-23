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
 *         6. What content/abuse policy applies to user-authored
 *            HTML/CSS published verbatim to a RHOBEAR-controlled
 *            *.pages.dev project — phishing, malware hosting, and
 *            same-site abuse are all served from our origin, so the
 *            owner must decide whether passthrough is intended
 *            product behavior or gated (scan, review, takedown).
 *
 *       This module surfaces those decision points. It does NOT
 *       make any of them.
 *
 *       Storage layout (what the bundle contains):
 *         bundle/
 *           index.html          — SPA entry point
 *           styles.css          — all CSS (separate file)
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
    errors.push('bundle is missing 404.html');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Find bundle keys whose value is neither a string nor a Uint8Array.
 * Other types would fail serialization during a real deploy.
 *
 * Shared by dryRun() and publish() so the dry-run path and the real
 * deploy path enforce the same value-type contract.
 *
 * @param {Record<string, unknown>} bundle
 * @returns {string[]} The offending keys, sorted.
 */
export function findInvalidBundleValues(bundle) {
  return Object.keys(bundle)
    .sort()
    .filter((f) => typeof bundle[f] !== 'string' && !(bundle[f] instanceof Uint8Array));
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

  // Validate bundle structure (required files)
  const bundleValidation = validateBundle(bundle);
  if (!bundleValidation.valid) {
    return {
      ok: false,
      summary: 'Bundle validation failed',
      files: [],
      errors: bundleValidation.errors,
    };
  }

  const files = Object.keys(bundle).sort();
  const textFiles = files.filter((f) => typeof bundle[f] === 'string');
  const binaryFiles = files.filter((f) => bundle[f] instanceof Uint8Array);

  // Validate that all bundle values are string or Uint8Array.
  // Other types would fail serialization during a real deploy.
  const invalidFiles = findInvalidBundleValues(bundle);
  if (invalidFiles.length > 0) {
    return {
      ok: false,
      summary: 'Bundle contains invalid value types',
      files: [],
      errors: invalidFiles.map(
        (f) => `Bundle value for "${f}" must be string or Uint8Array`,
      ),
    };
  }

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
 * config and the bundle exactly as dryRun() does, then throws
 * with a clear message telling the caller what they need to
 * provide. This ensures the interface is correct and testable
 * without real credentials, and that the real deploy path is
 * never laxer than the dry-run path.
 *
 * Owner must decide: which Cloudflare account/project to bind
 * to before this function can be wired to a real deploy.
 *
 * @param {PublishConfig} config
 * @param {Record<string, string | Uint8Array>} bundle
 * @returns {Promise<{ url: string }>} The deployed URL.
 *
 * @throws {Error} If config is invalid, bundle is empty or
 *         malformed, or credentials are missing.
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

  // Enforce the same bundle contract dryRun() does. The real deploy path
  // must never be weaker than the dry-run path.
  const bundleValidation = validateBundle(bundle);
  if (!bundleValidation.valid) {
    throw new Error(
      'publish: bundle validation failed — ' + bundleValidation.errors.join('; '),
    );
  }

  const invalidFiles = findInvalidBundleValues(bundle);
  if (invalidFiles.length > 0) {
    throw new Error(
      'publish: bundle contains invalid value types — ' + invalidFiles.map(
        (f) => `Bundle value for "${f}" must be string or Uint8Array`,
      ).join('; '),
    );
  }

  // Stub: the real implementation would call the Cloudflare Pages API.
  // The owner must wire the real deploy before this function
  // goes live. Until then, this throws with clear instructions —
  // returning a fake success URL would silently mislead callers.
  throw new Error(
    'publish: Cloudflare Pages publish is not yet wired. ' +
    'The owner must provide: (1) a Cloudflare API token, ' +
    '(2) an account ID, (3) a Pages project name. ' +
    'See the publish contract in editor/src/publish/api.js for the config shape.',
  );
}
