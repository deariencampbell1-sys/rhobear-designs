/**
 * @file Internal test entry for the fidelity suite.
 *
 *       Wired up as the `main` of tests/fidelity/package.json so that
 *       `node --test tests/fidelity/` (the test invocation the spec
 *       calls out) finds the suite by importing the directory's main.
 *       Importing here side-effect-registers every *.test.js file's
 *       tests, so the runner discovers them as subtests of this single
 *       import target.
 *
 *       Pattern matches src/engine/_entry.js.
 *
 *       Run with: `cd editor && node --test tests/fidelity/`
 */

import './fidelity.test.js';