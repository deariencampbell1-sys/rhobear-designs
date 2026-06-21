/**
 * @file Internal test entry for the 3d module.
 *
 *       Wired up as the `main` of `src/3d/package.json` so that
 *       `node --test src/3d/` finds the suite by importing the
 *       directory's main. Importing here side-effect-registers
 *       every *.test.js file's tests, so the runner discovers them
 *       as subtests of this single import target.
 *
 *       This file MUST NOT be imported by consumer code (the
 *       `exports: { ".": "./index.js" }` map keeps it out of the
 *       public surface).
 *
 *       Run with: `cd editor && node --test src/3d/`
 */

import './transform.test.js';
import './serialize.test.js';
import './registry.test.js';
