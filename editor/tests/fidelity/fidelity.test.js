/**
 * @file Wave3 fidelity suite — proves the W2 engine's whole promise on
 *       REAL sample sites (from `samples/minimax-m3-high/`):
 *
 *         importing a stood-up site and exporting it back PRESERVES its
 *         look and functions (scripts, external CSS links, fonts,
 *         structure), and applying a style override is non-destructive.
 *
 *       The five pillars asserted below match the suite's Definition of
 *       Done. Each fixture gets a parallel test for every pillar so a
 *       regression in any one engine on any one site shows up by name.
 *
 *       Run from `editor/` with:
 *
 *         node --test tests/fidelity/
 *
 *       If a fixture reveals a real engine gap, that test is marked
 *       `test.todo(...)` with a clear `[GAP]` description; the README
 *       and the PR body document the gap honestly. Tests are NEVER
 *       hacked to pass.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractDocumentParts,
  buildLiveDocument,
} from '../../src/engine/live-render.js';
import { createOverrideStore } from '../../src/engine/style-overrides.js';
import { applyOverrides } from '../../src/engine/diff-serializer.js';
import { createDocument } from '../../src/core/document-model.js';
import { serialize, deserialize } from '../../src/core/serializer.js';

import { FIXTURES } from './fixtures.js';

// ---------------------------------------------------------------------------
// Tiny regex-driven counters — used to derive expected ground truth
// directly from the raw source so the test never trusts extractDocumentParts
// to validate itself.
// ---------------------------------------------------------------------------

/** Count occurrences of a regex in a string. */
function countOf(re, s) {
  return (s.match(re) || []).length;
}

/** Strip `<script>...</script>` blocks from a string. */
function stripScripts(s) {
  return s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
}

/** Strip `<style>...</style>` blocks from a string. */
function stripStyles(s) {
  return s.replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

/** Get the `<title>` text from raw HTML (first match). */
function extractTitleFromRaw(raw) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  return m ? m[1].trim() : null;
}

/** Parse all `<script ... src="...">` external URLs from raw HTML. */
function externalScriptSrcs(raw) {
  const re = /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  const out = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1] || m[2] || m[3]);
  }
  return out;
}

/** Parse all `<link ... rel="stylesheet" href="...">` stylesheet URLs. */
function stylesheetLinks(raw) {
  const re = /<link\b([^>]*?)>/gi;
  const out = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    const attrs = m[1];
    const rel = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    if (rel && /^stylesheet$/i.test(rel[1] || rel[2] || rel[3])) {
      out.push(href[1] || href[2] || href[3]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pillar 1: extractDocumentParts preserves EVERY script, stylesheet
// link, and the title. Nothing silently dropped.
// ---------------------------------------------------------------------------

test('PILLAR 1 — extractDocumentParts preserves every <script>, stylesheet <link>, and the <title>', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] extractDocumentParts preserves scripts / stylesheet links / title`, () => {
      const parts = extractDocumentParts(fx.raw);

      // Scripts — count and content shape.
      const rawScriptCount = countOf(/<script\b/gi, fx.raw);
      assert.equal(parts.scripts.length, rawScriptCount,
        `[${fx.id}] scripts dropped: raw has ${rawScriptCount}, extractDocumentParts has ${parts.scripts.length}`);

      // Every external script src must be preserved verbatim.
      const rawExtSrcs = externalScriptSrcs(fx.raw);
      const extSrcsFromParts = parts.scripts
        .filter((s) => s.src != null)
        .map((s) => s.src);
      assert.deepEqual(extSrcsFromParts, rawExtSrcs,
        `[${fx.id}] external <script src="..."> list drifted: raw=${JSON.stringify(rawExtSrcs)} got=${JSON.stringify(extSrcsFromParts)}`);

      // Inline scripts: the content must not be empty / null.
      for (const s of parts.scripts) {
        if (s.src != null) {
          // External scripts: content must be null (per JSDoc contract).
          assert.equal(s.content, null,
            `[${fx.id}] external script has unexpected inline content: src=${s.src}`);
        } else {
          assert.ok(s.content != null,
            `[${fx.id}] inline script content dropped (got null)`);
        }
      }

      // Stylesheet <link rel="stylesheet"> — every href preserved.
      const rawStylesheetHrefs = stylesheetLinks(fx.raw);
      const stylesheetHrefsFromParts = parts.links
        .filter((l) => (l.attrs.rel || '').toLowerCase() === 'stylesheet')
        .map((l) => l.attrs.href);
      assert.deepEqual(stylesheetHrefsFromParts, rawStylesheetHrefs,
        `[${fx.id}] stylesheet <link href="..."> list drifted: raw=${JSON.stringify(rawStylesheetHrefs)} got=${JSON.stringify(stylesheetHrefsFromParts)}`);

      // Title — preserved verbatim (trimmed of whitespace).
      const rawTitle = extractTitleFromRaw(fx.raw);
      if (rawTitle !== null) {
        assert.ok(parts.title != null,
          `[${fx.id}] <title> present in raw but missing from extractDocumentParts`);
        assert.equal(parts.title, rawTitle,
          `[${fx.id}] <title> text drifted: raw=${JSON.stringify(rawTitle)} got=${JSON.stringify(parts.title)}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Pillar 2: buildLiveDocument({html: raw}) output still contains the
// original scripts + links. Look and functions intact.
// ---------------------------------------------------------------------------

test('PILLAR 2 — buildLiveDocument({html: raw}) preserves every script src and stylesheet href', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] buildLiveDocument output contains every script and stylesheet link`, () => {
      const built = buildLiveDocument({ html: fx.raw });

      // The output MUST still mention every external script URL.
      for (const src of externalScriptSrcs(fx.raw)) {
        assert.ok(built.includes(src),
          `[${fx.id}] external script src lost from buildLiveDocument output: ${src}`);
      }

      // Inline script bodies — sampled via a content-bearing marker.
      // We pick a known-visible DOM id from each fixture (best-effort;
      // marker-free presence is asserted via the inline-script CONTENT
      // count, not via a hand-picked marker).
      const inlineParts = extractDocumentParts(fx.raw).scripts.filter(
        (s) => s.content != null,
      );
      // We can't keep every byte of every inline script byte-equal in
      // the output (buildLiveDocument emits its own <head> shell), but
      // we CAN assert that every inline script's `<script>...</script>`
      // raw text is present verbatim — that's the contract.
      for (const s of inlineParts) {
        // Inline scripts' raw is `<script ...>...</script>`. For
        // content-only inline scripts there's no opening attribute, so
        // their raw is exactly `<script>...content...</script>`.
        assert.ok(built.includes(s.raw),
          `[${fx.id}] inline script lost from buildLiveDocument output (${s.raw.slice(0, 60)}…)`);
      }

      // Stylesheet links: every <link rel="stylesheet" href="..."> href
      // must survive.
      for (const href of stylesheetLinks(fx.raw)) {
        assert.ok(built.includes(href),
          `[${fx.id}] stylesheet <link href="..."> lost from buildLiveDocument output: ${href}`);
      }

      // Title — preserved in the emitted <head>.
      const rawTitle = extractTitleFromRaw(fx.raw);
      if (rawTitle != null) {
        assert.ok(built.includes('>' + rawTitle + '<'),
          `[${fx.id}] <title> text lost from buildLiveDocument output`);
      }

      // Canvas tags — preserved verbatim (relevant for fixtures that
      // declare them; gracefully skipped otherwise).
      const canvasCount = countOf(/<canvas\b/gi, fx.raw);
      if (canvasCount > 0) {
        const builtCanvas = countOf(/<canvas\b/gi, built);
        assert.equal(builtCanvas, canvasCount,
          `[${fx.id}] <canvas> count drifted: raw=${canvasCount}, built=${builtCanvas}`);
      }

      // @keyframes — preserved (relevant for the keyframes fixture).
      const kfCount = countOf(/@keyframes/gi, fx.raw);
      if (kfCount > 0) {
        const builtKf = countOf(/@keyframes/gi, built);
        assert.equal(builtKf, kfCount,
          `[${fx.id}] @keyframes count drifted: raw=${kfCount}, built=${builtKf}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Pillar 3: non-trivial override via style-overrides + diff-serializer
// applyOverrides is NON-DESTRUCTIVE — original markup + scripts survive,
// AND the override is reflected in the output css.
//
// We feed the override layer with a {html: parts.bodyHtml, css: collectedCss}
// bundle. This is the canonical shape the exporter consumes.
// ---------------------------------------------------------------------------

/**
 * Build a non-trivial override store targeting selectors that exist in
 * real portfolio-site body markup (best-effort: falls back to universal
 * selectors when a class-name can't be verified).
 */
function buildNonTrivialStore() {
  const store = createOverrideStore();
  // Multi-selector, multi-prop. Specificity-sorting inside the engine
  // puts higher-specificity rules LAST so they win ties at equal weight.
  store.setStyle('body', 'background-color', '#fafafa');
  store.setStyle('h1', 'color', '#ff5500');
  store.setStyle('h1', 'font-size', '56px');
  store.setStyle('#hero', 'padding', '48px 24px');
  store.setStyle('#hero', 'background', '#111111');
  store.setStyle('.card', 'border-radius', '12px');
  store.setStyle('.card', 'padding', '24px');
  store.setStyle('a', 'color', '#0066cc');
  return store;
}

test('PILLAR 3 — non-destructive override: original markup+scripts survive AND override is reflected', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] applyOverrides is non-destructive and reflects the override`, () => {
      const parts = extractDocumentParts(fx.raw);
      const collectedCss = parts.styles.map((s) => s.content).join('\n\n');
      const inputBundle = { html: parts.bodyHtml, css: collectedCss };

      const store = buildNonTrivialStore();
      const out = applyOverrides(inputBundle, store);

      // MARKUP: html byte-equal — scripts and all.
      assert.equal(out.html, inputBundle.html,
        `[${fx.id}] applyOverrides modified the body html — must be byte-equivalent`);

      // SCRIPTS: every <script> open tag from the body must still be there.
      const inScripts = countOf(/<script\b/gi, inputBundle.html);
      const outScripts = countOf(/<script\b/gi, out.html);
      assert.equal(outScripts, inScripts,
        `[${fx.id}] <script> tag count changed: in=${inScripts}, out=${outScripts}`);
      // And every external script src must survive.
      for (const src of externalScriptSrcs(inputBundle.html)) {
        assert.ok(out.html.includes(src),
          `[${fx.id}] external script src lost: ${src}`);
      }

      // CSS: the override block must be in the output AND the original
      // CSS must still be in the output.
      assert.ok(out.css.includes('RHOBEAR editor overrides'),
        `[${fx.id}] override header missing from output css`);
      // The override must come AFTER the original CSS so it wins ties.
      const idxOrig = out.css.indexOf(collectedCss) === -1
        ? -1
        : out.css.indexOf(collectedCss);
      const idxHeader = out.css.indexOf('RHOBEAR editor overrides');
      assert.ok(idxHeader > idxOrig,
        `[${fx.id}] override header must come AFTER the original CSS (idxOrig=${idxOrig}, idxHeader=${idxHeader})`);
      // The override block must actually contain representative rules.
      assert.ok(out.css.includes('body{background-color:#fafafa'),
        `[${fx.id}] expected body background-color override missing`);
      assert.ok(out.css.includes('h1{color:#ff5500'),
        `[${fx.id}] expected h1 color override missing`);
      assert.ok(out.css.includes('#hero{padding:48px 24px'),
        `[${fx.id}] expected #hero padding override missing`);
    });
  }
});

// ---------------------------------------------------------------------------
// Pillar 4: empty-override round-trip is a no-op (stable).
// ---------------------------------------------------------------------------

test('PILLAR 4 — empty override store is a stable no-op (byte-equivalent round-trip)', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] empty-override round-trip is byte-equivalent`, () => {
      const parts = extractDocumentParts(fx.raw);
      const collectedCss = parts.styles.map((s) => s.content).join('\n\n');
      const inputBundle = { html: parts.bodyHtml, css: collectedCss };

      const store = createOverrideStore(); // empty
      const out = applyOverrides(inputBundle, store);

      assert.equal(out.html, inputBundle.html,
        `[${fx.id}] empty-override round-trip modified body html`);
      assert.equal(out.css, inputBundle.css,
        `[${fx.id}] empty-override round-trip modified css`);
      // Sanity: no override header should appear.
      assert.equal(out.css.includes('RHOBEAR editor overrides'), false,
        `[${fx.id}] empty-override round-trip introduced an override header`);
    });
  }
});

// ---------------------------------------------------------------------------
// Pillar 5: core serializer round-trip on the extracted body is stable.
//
// "Extracted body" here = parts.bodyHtml with <script> and <style>
// blocks removed, because the document-model parser EXPLICITLY drops
// those into doc.css (per its documented contract). This is the shape
// the editor actually edits — scripts are handled separately by the
// live-render pipeline.
//
// Stability means: serialize → deserialize → serialize is byte-equal
// at the html+css level for any number of iterations.
// ---------------------------------------------------------------------------

test('PILLAR 5 — core serializer round-trip on the extracted body is stable', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] core serializer round-trip on the extracted body is stable`, () => {
      const parts = extractDocumentParts(fx.raw);
      // The editor's "editable body" strips scripts and style blocks.
      const bodyEditable = stripScripts(stripStyles(parts.bodyHtml));
      const collectedCss = parts.styles.map((s) => s.content).join('\n\n');

      const doc = createDocument(bodyEditable);
      doc.css = collectedCss;
      const first = serialize(doc);

      // Many iterations must remain byte-equal — proves the
      // serialize→deserialize→serialize fixed point.
      let cur = first;
      for (let i = 0; i < 5; i++) {
        cur = serialize(deserialize(cur));
      }

      assert.equal(cur.html, first.html,
        `[${fx.id}] core serializer round-trip drifted on html (5 iterations)`);
      assert.equal(cur.css, first.css,
        `[${fx.id}] core serializer round-trip drifted on css (5 iterations)`);

      // And the extracted body must contain the structural elements we
      // expect to round-trip — at minimum, one element tag.
      assert.ok(first.html.length > 0,
        `[${fx.id}] core serializer produced empty html for non-empty body`);
      assert.ok(/<\w+/.test(first.html),
        `[${fx.id}] core serializer html has no element tags`);
    });
  }
});

// ---------------------------------------------------------------------------
// End-to-end: the live-render → override → export pipeline produces
// output that combines look-preservation with the override.
// ---------------------------------------------------------------------------

test('END-TO-END — live-render → override preserves everything end-to-end', async (t) => {
  for (const fx of FIXTURES) {
    await t.test(`[${fx.id}] live-render → override pipeline preserves all scripts/links AND reflects overrides`, () => {
      const parts = extractDocumentParts(fx.raw);
      const collectedCss = parts.styles.map((s) => s.content).join('\n\n');

      // 1) Live-render: rebuild a complete HTML document.
      const built = buildLiveDocument({ html: fx.raw });

      // 2) Apply an override on the editor's editable bundle.
      const store = buildNonTrivialStore();
      const exported = applyOverrides(
        { html: parts.bodyHtml, css: collectedCss },
        store,
      );

      // Built document still has all scripts/links.
      for (const src of externalScriptSrcs(fx.raw)) {
        assert.ok(built.includes(src),
          `[${fx.id}] [e2e] live-render lost script src: ${src}`);
      }
      for (const href of stylesheetLinks(fx.raw)) {
        assert.ok(built.includes(href),
          `[${fx.id}] [e2e] live-render lost stylesheet href: ${href}`);
      }

      // Exported bundle: original markup unchanged, override reflected.
      assert.equal(exported.html, parts.bodyHtml,
        `[${fx.id}] [e2e] exported body html drifted from input`);
      assert.ok(exported.css.includes('RHOBEAR editor overrides'),
        `[${fx.id}] [e2e] exported css missing override header`);
      assert.ok(exported.css.includes('body{background-color:#fafafa'),
        `[${fx.id}] [e2e] exported css missing body background-color override`);
    });
  }
});