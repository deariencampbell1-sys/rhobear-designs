/**
 * @file Internal test entry for the fonts module.
 *
 *       Wired up as the `main` of src/library/fonts/package.json so that
 *       `node --test src/library/fonts/` (the test invocation the spec
 *       calls out) finds the suite by importing the directory's main.
 *       Importing here side-effect-registers the *.test.js file's tests,
 *       so the runner discovers them as subtests of this single import
 *       target.
 *
 *       Consumer-facing imports should use the `exports: { ".": "./index.js" }`
 *       map in package.json, which yields the clean public API
 *       (listFonts, getFont, loadFont, fontStack) without triggering
 *       test registration. Do NOT add this file to a barrel that
 *       consumers import directly.
 *
 *       When developing locally, all of the following also work and run
 *       the same suite (12 tests):
 *         cd src/library/fonts && node --test
 *         node --test src/library/fonts/*.test.js
 *         node --test src/library/fonts/_entry.js
 */

import './index.test.js';
