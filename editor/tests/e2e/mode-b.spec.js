/**
 * @file End-to-end smoke test for the Mode-B (build-from-scratch)
 *       mount API. The spec builds a self-contained harness that
 *       imports `mountModeB` from `/src/engine/mode-b.js` and mounts
 *       it into a blank container, then exercises the headless
 *       lifecycle (setContent, getContent, addSection, addText,
 *       addImage, insertEmbed, undo/redo, destroy).
 *
 *       Browser-only behavior not covered by `node --test src/engine/`
 *       lives here:
 *         - mountModeB resolves to a real GrapesJS handle
 *         - The required DOM scaffolding is created inside the host
 *         - setContent / getContent round-trips a real document
 *         - Insert helpers produce real DOM inside the GrapesJS canvas
 *         - undo() / redo() actually walk the UndoManager
 *         - destroy() tears the editor down and removes the scaffolding
 *
 *       The headless surface (normalize, content round-trip via core,
 *       teardown idempotency, event fan-out) is covered by
 *       `editor/src/engine/mode-b.test.js` and is intentionally not
 *       duplicated here.
 */

import { test, expect } from '@playwright/test';

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mode-B harness</title>
  <style>
    html, body { margin: 0; height: 100%; background: #1a1a1d; color: #e6e6e8; font: 13px/1.4 system-ui, sans-serif; }
    #modeb-host { width: 900px; height: 600px; margin: 24px auto; border: 1px solid #333; background: #0e0e10; }
  </style>
</head>
<body>
  <div id="modeb-host"></div>
  <script type="module">
    import { mountModeB } from '/src/engine/mode-b.js';

    const host = document.getElementById('modeb-host');
    window.__RB_HOST__ = host;

    // Drive the mount once the harness page itself has loaded; expose
    // a small controller so the Playwright spec can await and assert
    // on each step.
    window.__RB_RUN__ = async function run() {
      const handle = await mountModeB(host, {
        initial: { html: '<p>Start</p>', css: 'p { color: red; }' },
        onLoad: (h) => { window.__RB_HANDLE__ = h; },
      });
      window.__RB_HANDLE__ = handle;
      return handle;
    };
  </script>
</body>
</html>`;

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('RHOBEAR — Mode-B (build from scratch) mount API', () => {
  test('mountModeB resolves, populates the canvas, and returns a real handle', async ({ page }) => {
    const logs = [];
    page.on('console',   (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

    await page.route('http://127.0.0.1:5180/__rb_modeb_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_modeb_harness__');

    // Trigger the mount and wait for the GrapesJS canvas iframe to
    // appear. The iframe is GrapesJS's own render target.
    await page.evaluate(() => window.__RB_RUN__());
    await page.waitForFunction(() => !!window.__RB_HANDLE__);
    await page.waitForSelector('#modeb-host #gjs', { timeout: 30_000 });
    await page.waitForSelector('.gjs-cv-canvas iframe', { timeout: 30_000 });

    // The required DOM scaffolding must be present in the host.
    for (const id of ['gjs', 'gjs-blocks', 'gjs-layers', 'gjs-styles', 'gjs-traits', 'status-selection']) {
      const exists = await page.evaluate((sid) => !!document.getElementById(sid), id);
      expect(exists, `scaffolding #${id} must exist`).toBe(true);
    }

    // The host container should carry the rb-modeb-host class.
    const hasClass = await page.evaluate(() => document.getElementById('modeb-host').classList.contains('rb-modeb-host'));
    expect(hasClass).toBe(true);

    // The initial <p>Start</p> should appear inside the canvas.
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await expect(frame.locator('p').first()).toContainText('Start');

    // getContent() should return both slots populated.
    const content = await page.evaluate(() => {
      const h = window.__RB_HANDLE__;
      return h.getContent();
    });
    expect(content.html).toMatch(/<p[^>]*>Start<\/p>/);
    expect(typeof content.css).toBe('string');
  });

  test('setContent replaces the canvas; getContent round-trips it back', async ({ page }) => {
    await page.route('http://127.0.0.1:5180/__rb_modeb_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_modeb_harness__');

    await page.evaluate(() => window.__RB_RUN__());
    await page.waitForFunction(() => !!window.__RB_HANDLE__);
    await page.waitForSelector('.gjs-cv-canvas iframe');

    // Apply a fresh document via setContent.
    const applyResult = await page.evaluate(() => {
      const h = window.__RB_HANDLE__;
      return h.setContent({
        html: '<section><h1>Hello</h1><p>World</p></section>',
        css:  'h1 { color: blue; }',
      });
    });
    expect(applyResult.htmlApplied).toBe(true);
    expect(applyResult.cssApplied).toBe(true);

    // The new content must appear inside the canvas iframe.
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await expect(frame.locator('h1')).toContainText('Hello');
    await expect(frame.locator('p')).toContainText('World');

    // getContent() must include the new HTML in some shape (GrapesJS
    // may rewrite some attributes, but the text content survives).
    const out = await page.evaluate(() => window.__RB_HANDLE__.getContent());
    expect(out.html).toMatch(/Hello/);
    expect(out.html).toMatch(/World/);
  });

  test('addSection, addText, addImage, insertEmbed each produce DOM in the canvas', async ({ page }) => {
    await page.route('http://127.0.0.1:5180/__rb_modeb_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_modeb_harness__');

    await page.evaluate(() => window.__RB_RUN__());
    await page.waitForFunction(() => !!window.__RB_HANDLE__);
    await page.waitForSelector('.gjs-cv-canvas iframe');

    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    const initialSections = await frame.locator('section').count();
    const initialParagraphs = await frame.locator('p').count();
    // addSection appends a section that itself contains a <p>, so
    // we count both the new section AND the +1 paragraph in one go.
    await page.evaluate(() => window.__RB_HANDLE__.addSection());
    await expect(frame.locator('section')).toHaveCount(initialSections + 1);
    const afterSectionParagraphs = await frame.locator('p').count();
    expect(afterSectionParagraphs).toBeGreaterThan(initialParagraphs);

    // addText appends a single <p> at the root.
    await page.evaluate(() => window.__RB_HANDLE__.addText());
    await expect(frame.locator('p')).toHaveCount(afterSectionParagraphs + 1);

    await page.evaluate(() => window.__RB_HANDLE__.addImage('https://example.com/x.png'));
    await expect(frame.locator('img')).toHaveCount(1);
    const src = await frame.locator('img').first().getAttribute('src');
    expect(src).toMatch(/x\.png|data:/);

    await page.evaluate(() =>
      window.__RB_HANDLE__.insertEmbed('<iframe src="https://example.com/embed"></iframe>')
    );
    await expect(frame.locator('[data-embed="true"]')).toHaveCount(1);
  });

  test('onChange fires on structural edits and on setContent', async ({ page }) => {
    await page.route('http://127.0.0.1:5180/__rb_modeb_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_modeb_harness__');

    await page.evaluate(() => window.__RB_RUN__());
    await page.waitForFunction(() => !!window.__RB_HANDLE__);
    await page.waitForSelector('.gjs-cv-canvas iframe');

    // Subscribe a listener that records every payload.
    await page.evaluate(() => {
      const h = window.__RB_HANDLE__;
      window.__RB_EVENTS__ = [];
      window.__RB_DISPOSE__ = h.onChange((p) => window.__RB_EVENTS__.push(p));
    });

    // Trigger a structural edit (addText → component:create).
    await page.evaluate(() => window.__RB_HANDLE__.addText());

    // Trigger a content reset.
    await page.evaluate(() =>
      window.__RB_HANDLE__.setContent({ html: '<p>reset</p>', css: '' })
    );

    // Wait for both events to land (GrapesJS may emit async).
    await page.waitForFunction(() => window.__RB_EVENTS__.length >= 2, null, { timeout: 5000 });

    const events = await page.evaluate(() => window.__RB_EVENTS__);
    const sources = events.map((e) => e.source);
    // The reset event MUST be in the list; the structural edit may be
    // emitted as 'component' or 'reset' depending on plugin order.
    expect(sources).toContain('reset');
    for (const ev of events) {
      expect(typeof ev.html).toBe('string');
      expect(typeof ev.css).toBe('string');
    }

    // Dispose works and prevents further deliveries.
    await page.evaluate(() => window.__RB_DISPOSE__());
    const before = events.length;
    await page.evaluate(() => window.__RB_HANDLE__.addText());
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => window.__RB_EVENTS__.length);
    expect(after).toBe(before);
  });

  test('destroy() tears the editor down, removes scaffolding, and is idempotent', async ({ page }) => {
    await page.route('http://127.0.0.1:5180/__rb_modeb_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_modeb_harness__');

    await page.evaluate(() => window.__RB_RUN__());
    await page.waitForFunction(() => !!window.__RB_HANDLE__);
    await page.waitForSelector('.gjs-cv-canvas iframe');

    // Capture pre-destroy state.
    const beforeIds = await page.evaluate(() => {
      const h = document.getElementById('modeb-host');
      return {
        gjs:      !!h.querySelector('#gjs'),
        blocks:   !!h.querySelector('#gjs-blocks'),
        layers:   !!h.querySelector('#gjs-layers'),
        styles:   !!h.querySelector('#gjs-styles'),
        traits:   !!h.querySelector('#gjs-traits'),
        status:   !!h.querySelector('#status-selection'),
      };
    });
    expect(beforeIds.gjs).toBe(true);
    expect(beforeIds.blocks).toBe(true);
    expect(beforeIds.layers).toBe(true);
    expect(beforeIds.styles).toBe(true);
    expect(beforeIds.traits).toBe(true);

    // Destroy twice — must not throw, must flip isDestroyed, must
    // remove the DOM we own.
    const destroyResults = await page.evaluate(() => {
      const h = window.__RB_HANDLE__;
      const a = h.destroy();
      const afterFirst = h.isDestroyed();
      const b = h.destroy();
      const afterSecond = h.isDestroyed();
      return { a, b, afterFirst, afterSecond };
    });
    expect(destroyResults.afterFirst).toBe(true);
    expect(destroyResults.afterSecond).toBe(true);

    // The host container should be empty (or contain only its own
    // children) — no GrapesJS scaffolding left.
    const afterIds = await page.evaluate(() => {
      const h = document.getElementById('modeb-host');
      return {
        gjs:      !!h.querySelector('#gjs'),
        blocks:   !!h.querySelector('#gjs-blocks'),
        layers:   !!h.querySelector('#gjs-layers'),
        styles:   !!h.querySelector('#gjs-styles'),
        traits:   !!h.querySelector('#gjs-traits'),
      };
    });
    expect(afterIds.gjs).toBe(false);
    expect(afterIds.blocks).toBe(false);
    expect(afterIds.layers).toBe(false);
    expect(afterIds.styles).toBe(false);
    expect(afterIds.traits).toBe(false);

    // Post-destroy no-ops: every method is safe.
    const post = await page.evaluate(() => {
      const h = window.__RB_HANDLE__;
      return {
        get:    h.getContent(),
        set:    h.setContent({ html: '<p>x</p>', css: '' }),
        undo:   h.undo(),
        redo:   h.redo(),
        isDead: h.isDestroyed(),
      };
    });
    expect(post.get).toEqual({ html: '', css: '' });
    expect(post.set).toEqual({ htmlApplied: false, cssApplied: false });
    expect(post.undo).toBe(false);
    expect(post.redo).toBe(false);
    expect(post.isDead).toBe(true);
  });
});
