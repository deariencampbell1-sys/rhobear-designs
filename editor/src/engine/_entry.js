/**
 * @file Internal test entry for the engine module.
 *
 *       Wired up as the `main` of src/engine/package.json so that
 *       `node --test src/engine/` (the test invocation the spec calls
 *       out) finds the suite by importing the directory's main.
 *       Importing here side-effect-registers every *.test.js file's
 *       tests, so the runner discovers them as subtests of this single
 *       import target.
 *
 *       Consumer-facing imports should use the `exports: { ".": "./live-render.js" }`
 *       map in package.json, which yields the clean public API without
 *       triggering test registration. Do NOT add this file to a barrel
 *       that consumers import directly.
 *
 *       Run with: `cd editor && node --test src/engine/`
 */

import './live-render.test.js';
