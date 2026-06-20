# Third-Party Notices

This repository (`deariencampbell1-sys/rhobear-designs`) is licensed under the
**MIT License**. The RHOBEAR Designs website editor (under `editor/`) is also
MIT-licensed and is built on top of the open-source GrapesJS ecosystem.

To make the editor engine fully owned and sellable, every GrapesJS runtime
component it depends on is **vendored into the source tree** under
`editor/src/vendor/grapesjs/<pkg>/`. The upstream packages themselves are
permissively licensed (BSD-3-Clause and MIT), which means their source and
binary forms may be redistributed as part of a commercial product provided the
upstream copyright notice, license text, and (for BSD-3-Clause) non-endorsement
clause are preserved. Each vendored package ships its verbatim `LICENSE` next to
its distributable build so the obligations are met automatically. No copyleft
(GPL / AGPL / LGPL / MPL) components are vendored or linked.

The `package.json` `dependencies` entries for these packages remain in place as
the **upstream-of-truth** for re-vendoring when a new version is needed; the
runtime always loads from `editor/src/vendor/grapesjs/`, not from `node_modules`.

## Vendored packages

| Package | Version | SPDX license | Upstream repository |
|---|---|---|---|
| grapesjs | 0.22.16 | BSD-3-Clause | https://github.com/GrapesJS/grapesjs.git |
| grapesjs-preset-webpage | 1.0.3 | BSD-3-Clause | https://github.com/GrapesJS/preset-webpage.git |
| grapesjs-blocks-basic | 1.0.2 | BSD-3-Clause | https://github.com/GrapesJS/blocks-basic.git |
| grapesjs-plugin-forms | 2.0.6 | BSD-3-Clause | https://github.com/GrapesJS/components-forms.git |
| grapesjs-custom-code | 1.0.2 | BSD-3-Clause | https://github.com/GrapesJS/components-custom-code.git |

Each `editor/src/vendor/grapesjs/<pkg>/LICENSE` is the verbatim upstream
license text. Each `editor/src/vendor/grapesjs/<pkg>/package.json` is the
verbatim upstream package manifest (kept for record and so the file hashes can
be diffed against `node_modules/<pkg>/package.json` when re-vendoring).