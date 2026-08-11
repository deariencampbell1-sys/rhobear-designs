import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.resolve(HERE, '../../../screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// 375×812 — the mobile-review viewport from the responsive lane brief. Two
// surfaces are covered:
//   - the DESKTOP shell (index.html): a fine-pointer 375px window is the
//     squeeze defect (a real touch phone is routed to m.html by the entry
//     script, but a narrow laptop window or a forced visit still hits this
//     shell, and it must lay out like a phone, not like a squeezed desktop);
//   - the PHONE shell (m.html): the purpose-built studio, sanity-checked at
//     the same viewport.
const NARROW = { width: 375, height: 812 };

async function waitForShell(page) {
  await page.waitForFunction(() => window.__RB_EDITOR__?.ready === true, null, { timeout: 10_000 });
}

/** First-run onboarding covers the shell until skipped — same as smoke.spec. */
async function skipOnboarding(page) {
  const onboarding = page.locator('#dsOnb');
  if (await onboarding.count() && await onboarding.evaluate((el) => el.classList.contains('on'))) {
    await onboarding.locator('#dsobSkip').click();
    await expect(onboarding).not.toHaveClass(/on/);
  }
}

/** Every visible toolbar control must fit inside the toolbar's box (no
 *  truncation at the viewport edge), be ≥36px tall, and carry a name — text,
 *  aria-label, or title. This is the narrow twin of the firefly-bounce
 *  toolbar check, run at the width where the old layout squeezed. */
async function assertNarrowToolbar(page) {
  const toolbar = page.getByTestId('toolbar');
  await expect(toolbar).toBeVisible();
  const metrics = await toolbar.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const controls = [...el.querySelectorAll('button')].map((button) => {
      const b = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        id: button.dataset.testid || button.id || button.dataset.action || '',
        name: button.innerText.trim() || button.getAttribute('aria-label') || button.title || '',
        left: b.left, right: b.right, top: b.top, bottom: b.bottom,
        height: b.height,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && b.width > 0 && b.height > 0,
      };
    }).filter((c) => c.visible && c.right > 0 && c.left < window.innerWidth);
    return { toolbarBottom: box.bottom, viewportWidth: window.innerWidth, controls };
  });
  expect(metrics.controls.length).toBeGreaterThan(0);
  for (const c of metrics.controls) {
    expect(c.name, `${c.id} should keep a readable label at phone width`).not.toBe('');
    expect(c.left, `${c.id} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(c.right, `${c.id} is clipped at the viewport edge`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(c.bottom, `${c.id} escapes the toolbar box`).toBeLessThanOrEqual(metrics.toolbarBottom + 1);
    expect(c.height, `${c.id} is too small to tap`).toBeGreaterThanOrEqual(36);
  }
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
  }));
  expect(overflow.doc, `documentElement scrollWidth ${overflow.doc} > ${overflow.inner}`).toBeLessThanOrEqual(overflow.inner);
  expect(overflow.body, `body scrollWidth ${overflow.body} > ${overflow.inner}`).toBeLessThanOrEqual(overflow.inner);
}

test.describe('RHOBEAR Designs — mobile layout at 375×812', () => {
  test('desktop shell: no overflow, labeled on-screen toolbar, canvas owns the width', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/index.html?surface=desktop', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    await skipOnboarding(page);

    await assertNoHorizontalOverflow(page);
    await assertNarrowToolbar(page);

    // The promised row structure: R1 brand|undo|redo|preview|save, R2
    // toggle|mode switch, R3 devices|Templates|Projects. This is what makes
    // the toolbar read as a phone layout instead of a squeezed desktop.
    const rowTops = await page.evaluate(() => {
      const top = (id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect().top;
      return { preview: top('btn-preview'), save: top('btn-save-html'), toggle: top('btn-toggle-rail'), devices: top('btn-device-mobile'), templates: top('btn-templates') };
    });
    expect(rowTops.preview).toBeLessThan(rowTops.toggle);      // R1 above R2
    expect(rowTops.save).toBeLessThan(rowTops.toggle);         // Save stays on R1
    expect(rowTops.toggle).toBeLessThan(rowTops.templates);    // R2 above R3
    expect(Math.abs(rowTops.devices - rowTops.templates)).toBeLessThanOrEqual(1); // same row

    // The canvas must own the full viewport width — no rail stealing the
    // narrow space (the rail only overlays as a sheet when opened).
    const canvas = await page.getByTestId('canvas-wrap').evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, width: b.width, height: b.height };
    });
    expect(canvas.left).toBeGreaterThanOrEqual(0);
    expect(canvas.right).toBeLessThanOrEqual(375);
    expect(canvas.width).toBeGreaterThanOrEqual(370);
    // Usable content region: canvas taller than half the viewport.
    expect(canvas.height).toBeGreaterThan(812 / 2);

    await page.screenshot({ path: path.join(SCREENSHOTS, 'narrow-desktop-start.png') });
  });

  test('desktop shell: primary controls stay clickable at phone width', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/index.html?surface=desktop', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    await skipOnboarding(page);

    // Preview opens the preview modal.
    await page.getByTestId('btn-preview').click();
    await expect(page.getByTestId('preview-modal')).toBeVisible();
    await page.getByTestId('btn-preview-close').click();

    // Save still downloads the page (labeled button on row 1).
    const download = page.waitForEvent('download');
    await page.getByTestId('btn-save-html').click();
    expect((await download).suggestedFilename()).toMatch(/\.html$/);

    // Device switcher drives the live-frame width (the mobile view matters
    // most on a phone).
    await page.getByTestId('btn-device-mobile').click();
    const frameWidth = await page.getByTestId('live-frame').evaluate((el) => el.style.maxWidth);
    expect(frameWidth).toBe('375px');
  });

  test('desktop shell: rail opens as a bottom sheet, Files tab labeled, add-element works', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/index.html?surface=desktop', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    await skipOnboarding(page);

    // A real live page, so the click-to-add flow has a document to receive it.
    await page.setInputFiles('[data-testid="input-html"]', path.join(HERE, '../fixtures/sample-page.html'));
    const liveFrame = page.frameLocator('#live-frame');
    await expect(liveFrame.locator('body > *').first()).toBeVisible();

    // The rail opens as a bottom sheet over the canvas (not beside it).
    await page.getByTestId('btn-toggle-rail').click();
    const rail = page.getByTestId('rail');
    await expect(rail).toHaveClass(/is-narrow-open/);
    const box = await rail.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width };
    });
    expect(box.left).toBeLessThanOrEqual(0);
    expect(box.right).toBeGreaterThanOrEqual(375);
    expect(box.bottom).toBeGreaterThanOrEqual(811);   // pinned to the viewport bottom
    expect(box.width).toBeGreaterThanOrEqual(375);

    // The scrim shows and closes the sheet on tap.
    await expect(page.getByTestId('narrow-scrim')).toHaveClass(/is-on/);
    await page.getByTestId('narrow-scrim').click({ position: { x: 30, y: 200 } });
    await expect(rail).not.toHaveClass(/is-narrow-open/);

    // Files tab: labeled file actions live here at phone width.
    await page.getByTestId('btn-toggle-rail').click();
    await page.getByTestId('rail-tab-files').click();
    await expect(page.getByTestId('rail-pane-files')).toHaveClass(/is-active/);
    for (const id of ['narrow-new', 'narrow-open', 'narrow-open-folder', 'narrow-export']) {
      const btn = page.getByTestId(id);
      await expect(btn).toBeVisible();
      expect((await btn.textContent()).trim().length).toBeGreaterThan(0);
    }

    // Add tab (live mode): a real card tap inserts into the page — the sheet
    // keeps the add-element controls reachable and the canvas usable.
    await page.getByTestId('rail-tab-add').click();
    await expect(page.getByTestId('element-library')).toBeVisible();
    const before = await liveFrame.locator('body > *').count();
    await page.locator('#element-library .rb-lib-card').first().click();
    await expect(liveFrame.locator('body > *')).toHaveCount(before + 1);

    // Close the sheet (scrim tap — the same gesture the user makes), then
    // build mode keeps its blocks reachable through the sheet.
    await page.getByTestId('narrow-scrim').click({ position: { x: 30, y: 200 } });
    await expect(rail).not.toHaveClass(/is-narrow-open/);
    await page.getByTestId('btn-mode-build').click();
    await page.waitForSelector('#gjs-blocks .gjs-block');
    await expect(page.locator('#gjs-blocks .gjs-block').first()).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS, 'narrow-desktop-editor.png') });
  });

  test('phone shell: purpose-built studio stays clean at the same viewport', async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto('/m.html?surface=mobile', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);

    await assertNoHorizontalOverflow(page);
    await expect(page.locator('.rbm-dock')).toBeVisible();

    // Add sheet opens above the dock, canvas keeps the width.
    await page.locator('#rbm-dock-add').click();
    const rail = page.getByTestId('rail');
    await expect(rail).toHaveClass(/is-sheet-open/);
    // The desktop-shell scrim is index/t.html-only — the phone shell has its
    // own rbm-scrim and must not inherit the desktop one.
    await expect(page.getByTestId('narrow-scrim')).toHaveCount(0);
    await expect(page.getByTestId('canvas-wrap')).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOTS, 'narrow-mobile-shell.png') });
  });
});
