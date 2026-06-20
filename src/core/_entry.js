/**
 * @file Internal test entry for the headless core.
 *
 *       This file is wired up as the `main` of src/core/package.json so
 *       that `node --test src/core/` (the test invocation the spec calls
 *       out) finds the suite by importing the directory's main. Importing
 *       here side-effect-registers every *.test.js file's tests, so the
 *       runner discovers them as subtests of this single import target.
 *
 *       Consumer-facing imports should use the `exports: { ".": "./index.js" }`
 *       map in package.json, which yields the clean public API without
 *       triggering test registration. Do NOT add this file to a barrel
 *       that consumers import directly.
 *
 *       When developing locally, all of the following also work and run
 *       the same suite (78 tests):
 *         cd src/core && node --test
 *         node --test src/core/*.test.js
 *         node --test src/core/_entry.js
 */
import './document-model.test.js';
import './command-bus.test.js';
import './serializer.test.js';
