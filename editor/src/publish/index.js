/**
 * @file Public surface of the publish substrate.
 *
 *       Re-exports the export, API, and deploy modules so
 *       consumers can `import { ... } from './publish'` (or
 *       `./publish/index`) without caring about the internal
 *       file layout.
 *
 *       The publish substrate provides:
 *         - exportBundle(): turn an editor project into a
 *           self-contained static bundle
 *         - validateConfig() / dryRun() / publish(): the
 *           publish contract for Cloudflare Pages
 *         - validateBundle() / dryRunDeploy() / deploy(): the
 *           deploy path with a dry-run mode for tests
 */

export { exportBundle } from './export.js';
export { validateConfig, dryRun, publish } from './api.js';
export { validateBundle, dryRunDeploy, deploy, exportBundle as exportProject } from './deploy.js';
