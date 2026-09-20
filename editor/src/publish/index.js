/**
 * @file Public surface of the publish substrate.
 *
 *       Re-exports the export, API, and deploy modules so
 *       consumers can `import { ... } from './publish'` (or
 *       `./publish/index`) without caring about the internal
 *       file layout.
 *
 *       The publish substrate provides:
 *         - exportBundle() / exportBundleDetailed(): turn an editor
 *           project into a self-contained static bundle (the detailed
 *           form also reports which asset keys were skipped and why)
 *         - validateConfig() / dryRun() / publish(): the
 *           publish contract for Cloudflare Pages
 *         - validateBundle() / dryRunDeploy() / deploy(): the
 *           deploy path with a dry-run mode for tests
 */

export { exportBundle, exportBundleDetailed } from './export.js';
export { validateConfig, validateBundle, dryRun, publish } from './api.js';
export { dryRunDeploy, deploy } from './deploy.js';
