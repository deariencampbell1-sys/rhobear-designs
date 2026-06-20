/**
 * @file End-to-end smoke test for the Edit Live Site overlay mechanism:
 *       iframe-bridge + overlay + inline-edit agent. The spec builds its
 *       own 2-iframe fixture entirely from inline strings (no external
 *       HTML files) so the spec stays self-contained.
 *
 *       Asserts:
 *         - The bridge receives `ready` from the agent on load.
 *         - A click inside the iframe produces a `select` message and
 *           the selection box is positioned over the clicked element.
 *         - Hover events move the hover box.
 *         - Double-click + typing produces a `text-changed` message and
 *           the document text is updated.
 *         - Escape disables editing and emits `deselect`.
 *         - computeSelectorPath round-trips back to the same element.
 *
 *       Browser-only behavior not covered by node tests lives here.
 */

import { test, expect } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/*  Self-contained fixture pages (no external HTML files).                     */
/* -------------------------------------------------------------------------- */

// Defined FIRST because HARNESS_HTML interpolates it via JSON.stringify.
const TARGET_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Overlay target</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; background: #fafafa; }
    .hero { padding: 24px; background: #fff; border-radius: 8px; max-width: 520px; }
    h1 { color: #7c5cff; margin: 0 0 8px; }
    p  { color: #333; line-height: 1.5; margin: 0 0 16px; }
    .row { display: flex; gap: 12px; }
    .card { flex: 1; padding: 16px; background: #fff; border: 1px solid #eee; border-radius: 6px; }
    button { padding: 8px 14px; background: #7c5cff; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <main class="hero" data-rb-target="hero">
    <h1 data-rb-target="title">Hello, RHOBEAR</h1>
    <p data-rb-target="lead">Click anywhere in this page to select an element. Double-click text to edit it inline.</p>
    <div class="row">
      <div class="card" data-rb-target="card-1">
        <h2>Card one</h2>
        <p>First card body.</p>
      </div>
      <div class="card" data-rb-target="card-2">
        <h2>Card two</h2>
        <p>Second card body.</p>
      </div>
    </div>
    <button data-rb-target="cta" type="button">Click me</button>
  </main>
  <script type="module">
    import { createEditAgent } from '/src/engine/inline-edit.js';
    const agent = createEditAgent(window, {
      expectedParentOrigin: '*',
      targetOrigin: '*',
    });
    window.__RB_AGENT__ = agent;
  </script>
</body>
</html>`;

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Overlay harness</title>
  <style>
    html, body { margin: 0; height: 100%; background: #161618; color: #e6e6e8; font: 13px/1.4 system-ui, sans-serif; }
    .stage {
      position: relative;
      width: 800px;
      height: 500px;
      margin: 40px auto;
      border: 1px solid rgba(124,92,255,0.22);
      background: #0e0e10;
    }
    .stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }
    .stage .overlay-host { position: absolute; inset: 0; pointer-events: none; }
  </style>
</head>
<body>
  <div class="stage">
    <iframe id="target"></iframe>
    <div class="overlay-host" id="overlay-host"></div>
  </div>
  <script>window.__RB_TARGET_HTML__ = ${JSON.stringify(TARGET_HTML).replace(/<\/script/g, '<\\/script').replace(/<\/style/gi, '<\\/style')};</script>
  <script type="module">
    import { createBridge } from '/src/engine/iframe-bridge.js';
    import { createOverlay } from '/src/engine/overlay.js';

    const iframe = document.getElementById('target');
    const overlayHost = document.getElementById('overlay-host');

    // Build the iframe document via srcdoc (same-origin), then attach the
    // bridge AFTER load so contentWindow is fully populated.
    iframe.srcdoc = window.__RB_TARGET_HTML__;
    iframe.addEventListener('load', () => {
      const events = [];
      window.__RB_EVENTS__ = events;
      const overlay = createOverlay(overlayHost, iframe);
      const bridge = createBridge(iframe, {
        expectedOrigin: '*',
        targetOrigin: '*',
        onReady:        (p) => events.push(['ready', p]),
        onSelect:       (p) => { events.push(['select', p]); overlay.showSelection(p.rect); overlay.setLabel(p.tagName); },
        onHover:        (p) => { events.push(['hover', p]);  overlay.showHover(p.rect); },
        onDeselect:     ()  => { events.push(['deselect']);  overlay.clear(); },
        onTextChange:   (p) => events.push(['text-changed', p]),
      });
      window.__RB_BRIDGE__ = bridge;
      window.__RB_OVERLAY__ = overlay;
      window.__RB_READY__ = true;
    });
  </script>
</body>
</html>`;

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

test.describe('RHOBEAR — Edit Live Site overlay mechanism', () => {
  test('click → select, hover → hover box, dblclick → inline edit', async ({ page }) => {
    // Capture browser console for debugging.
    const logs = [];
    page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

    // Serve the harness HTML from the running Vite dev server's origin so
    // the in-page `<script type="module">` can resolve absolute imports
    // like `/src/engine/iframe-bridge.js`. `page.route` intercepts the
    // request to a synthetic path and returns the harness inline HTML.
    await page.route('http://127.0.0.1:5180/__rb_overlay_harness__', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: HARNESS_HTML,
      });
    });
    await page.goto('http://127.0.0.1:5180/__rb_overlay_harness__');

    // Wait for the harness to finish its one-tick setup.
    await page.waitForFunction(() => window.__RB_READY__ === true, null, { timeout: 15_000 });

    // Wait for the agent in the iframe to send `ready`.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const evs = window.__RB_EVENTS__ || [];
        return evs.some((e) => e[0] === 'ready');
      });
    }, { timeout: 10_000 }).toBe(true);

    // Helper: get the iframe's contentDocument on the parent side.
    const frame = page.frameLocator('#target');

    // 1) Click the "Click me" button inside the iframe.
    const button = frame.locator('[data-rb-target="cta"]');
    await button.click();

    await expect.poll(async () => {
      return await page.evaluate(() => {
        const evs = window.__RB_EVENTS__ || [];
        return evs.some((e) => e[0] === 'select');
      });
    }, { timeout: 5_000 }).toBe(true);

    // Verify the selection box is visible and has a non-zero size.
    const selBox = await page.evaluate(() => {
      const el = window.__RB_OVERLAY__.elements.selection;
      return {
        display: el.style.display,
        w: el.offsetWidth,
        h: el.offsetHeight,
        top: el.style.top,
        left: el.style.left,
      };
    });
    expect(selBox.display).toBe('block');
    expect(selBox.w).toBeGreaterThan(0);
    expect(selBox.h).toBeGreaterThan(0);
    expect(selBox.top).toMatch(/px$/);
    expect(selBox.left).toMatch(/px$/);

    // Verify the path payload includes the button.
    const lastSelect = await page.evaluate(() => {
      const evs = window.__RB_EVENTS__ || [];
      const last = [...evs].reverse().find((e) => e[0] === 'select');
      return last ? last[1] : null;
    });
    expect(lastSelect).toBeTruthy();
    expect(lastSelect.tagName).toBe('button');
    expect(lastSelect.path).toContain('button');

    // 2) Hover over a card — should emit hover and reposition the hover box.
    const card = frame.locator('[data-rb-target="card-1"]');
    await card.hover();
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const evs = window.__RB_EVENTS__ || [];
        return evs.some((e) => e[0] === 'hover');
      });
    }, { timeout: 5_000 }).toBe(true);

    const hoverBox = await page.evaluate(() => {
      const el = window.__RB_OVERLAY__.elements.hover;
      return { display: el.style.display, w: el.offsetWidth, h: el.offsetHeight };
    });
    expect(hoverBox.display).toBe('block');
    expect(hoverBox.w).toBeGreaterThan(0);

    // 3) Double-click the title to enter inline editing, then type.
    const title = frame.locator('[data-rb-target="title"]');
    await title.dblclick();

    // Verify the title has contentEditable=true.
    const editingState = await page.evaluate(() => {
      const win = document.getElementById('target').contentWindow;
      const doc = win.document;
      const h1 = doc.querySelector('[data-rb-target="title"]');
      return h1.getAttribute('contenteditable');
    });
    expect(editingState).toBe('true');

    // Type to replace the selected text. The agent's startEditing calls
    // selectNodeContents so all keystrokes overwrite.
    await title.click({ clickCount: 3 });   // select all text in the line
    await page.keyboard.type('OVERLAY OK');

    // Debounce + microtask flush: wait for text-changed message.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const evs = window.__RB_EVENTS__ || [];
        return evs.some((e) => e[0] === 'text-changed');
      });
    }, { timeout: 5_000 }).toBe(true);

    const lastText = await page.evaluate(() => {
      const evs = window.__RB_EVENTS__ || [];
      const last = [...evs].reverse().find((e) => e[0] === 'text-changed');
      return last ? last[1] : null;
    });
    expect(lastText).toBeTruthy();
    expect(lastText.path).toContain('h1');
    expect(lastText.text).toBe('OVERLAY OK');
    expect(lastText.prevText).toBe('Hello, RHOBEAR');

    // The DOM in the iframe should also reflect the change.
    await expect(title).toHaveText('OVERLAY OK');

    // 4) Press Escape — should emit deselect and disable editing.
    await page.keyboard.press('Escape');
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const evs = window.__RB_EVENTS__ || [];
        return evs.some((e) => e[0] === 'deselect');
      });
    }, { timeout: 5_000 }).toBe(true);

    const afterEscape = await page.evaluate(() => {
      const win = document.getElementById('target').contentWindow;
      const h1 = win.document.querySelector('[data-rb-target="title"]');
      return h1.getAttribute('contenteditable');
    });
    expect(afterEscape).toBeNull();

    // 5) Compute-selector-path round-trip via the agent instance exposed
    //    in the iframe.
    const roundtrip = await page.evaluate(() => {
      const win = document.getElementById('target').contentWindow;
      const doc = win.document;
      const h1 = doc.querySelector('[data-rb-target="title"]');
      const path = win.__RB_AGENT__.computeSelectorPath(h1);
      const resolved = win.__RB_AGENT__.resolveSelectorPath(path);
      return { path, resolvedTag: resolved && resolved.getAttribute('data-rb-target') };
    });
    expect(roundtrip.path).toMatch(/h1/);
    expect(roundtrip.resolvedTag).toBe('title');

    // Surface logs to help debug if anything fails.
    if (logs.length) {
      // eslint-disable-next-line no-console
      console.log('browser logs:\n' + logs.join('\n'));
    }
  });
});