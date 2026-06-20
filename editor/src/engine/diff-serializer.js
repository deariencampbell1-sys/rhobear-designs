/**
 * @file Fold override layer + original source into clean export output.
 *
 *       applyOverrides({html, css}, store) → {html, css}
 *         Returns the same html UNCHANGED (markup and scripts preserved),
 *         with the override stylesheet APPENDED to css so that override
 *         rules load after the original CSS and therefore win ties at
 *         equal specificity. This is a fully non-destructive fold:
 *         the original CSS is never modified, the original HTML is never
 *         modified, and <script> tags survive verbatim.
 *
 *         The emitted override block is preceded by a clearly-marked
 *         comment so consumers can tell what the editor added.
 *
 *       summarizeChanges(store [, baseline]) → [{selector, prop, from?, to}]
 *         Without a baseline: returns the current overrides as
 *         {selector, prop, to} records (suitable for an edit log and
 *         future AI consumption).
 *         With a baseline store: returns a diff including {from, to}
 *         for edited properties and a {from}-only record for removed
 *         properties (suitable for undo / change review).
 *
 *       No DOM dependency. Pure functions + small helpers. ES module,
 *       JSDoc-typed. Reuses toStylesheet from style-overrides.js.
 */

import { toStylesheet } from './style-overrides.js';

/** Header comment placed above the emitted override block. */
const OVERRIDE_HEADER = '/* RHOBEAR editor overrides — non-destructive layer */';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply an override store to a `{html, css}` export input, producing a
 * `{html, css}` output with the overrides folded in.
 *
 * Behavior:
 *   - `html` is returned BYTE-EQUIVALENT — markup and `<script>` tags
 *     are preserved verbatim.
 *   - `css` keeps the original CSS unchanged, with the override block
 *     appended at the end so it wins ties at equal specificity.
 *   - If the store has no overrides, the output is byte-equivalent to
 *     the input (no-op safety).
 *
 * @param {{html?: string, css?: string}} input
 * @param {object} store  override store from createOverrideStore()
 * @returns {{html: string, css: string}}
 */
export function applyOverrides(input, store) {
  const html = (input && typeof input.html === 'string') ? input.html : '';
  const css = (input && typeof input.css === 'string') ? input.css : '';
  if (!store) return { html, css };

  const overrideCss = toStylesheet(store);
  if (!overrideCss) return { html, css };

  const prefix = css.length
    ? css.replace(/\s+$/, '') + '\n\n' + OVERRIDE_HEADER + '\n'
    : OVERRIDE_HEADER + '\n';
  return { html, css: prefix + overrideCss };
}

/**
 * Summarize the changes in an override store as a list of records.
 *
 * Each record is `{selector, prop, from?, to?}`. A record has `to` for
 * current values, `from` for previous values, and both when a property
 * was edited. Records are sorted by selector (then prop) for stable
 * output — convenient for change logs, AI prompts, and undo tooling.
 *
 * @param {object} store   current override store
 * @param {object} [baseline]  optional previous override store to diff against
 * @returns {Array<{selector: string, prop: string, from?: string, to?: string}>}
 */
export function summarizeChanges(store, baseline) {
  if (!store || typeof store.toJSON !== 'function') return [];
  const cur = store.toJSON();
  const prev = (baseline && typeof baseline.toJSON === 'function')
    ? baseline.toJSON() : {};

  const out = [];
  const selectors = new Set([...Object.keys(cur), ...Object.keys(prev)]);

  for (const sel of selectors) {
    const c = cur[sel] || {};
    const p = prev[sel] || {};
    const props = new Set([...Object.keys(c), ...Object.keys(p)]);
    for (const prop of props) {
      const hasC = Object.prototype.hasOwnProperty.call(c, prop);
      const hasP = Object.prototype.hasOwnProperty.call(p, prop);
      if (hasC && hasP) {
        if (c[prop] !== p[prop]) {
          out.push({ selector: sel, prop, from: p[prop], to: c[prop] });
        }
        // Equal values are not a change — no record.
      } else if (hasC) {
        out.push({ selector: sel, prop, to: c[prop] });
      } else {
        // Only had it before — it was removed.
        out.push({ selector: sel, prop, from: p[prop] });
      }
    }
  }

  // Stable order: by selector, then by prop. Makes the output
  // predictable for downstream consumers (logs, AI prompts, undo lists).
  out.sort((a, b) => {
    if (a.selector !== b.selector) return a.selector < b.selector ? -1 : 1;
    if (a.prop !== b.prop) return a.prop < b.prop ? -1 : 1;
    return 0;
  });

  return out;
}
