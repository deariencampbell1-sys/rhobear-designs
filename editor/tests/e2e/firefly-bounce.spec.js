import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.resolve(HERE, '../../../screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

function watchBrowser(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    diagnostics.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'unknown request failure',
    });
  });
  return diagnostics;
}

async function waitForShell(page) {
  await page.waitForFunction(() => window.__RB_EDITOR__?.ready === true, null, { timeout: 10_000 });
}

/**
 * GrapesJS is vendored, but its iframe and plugin managers initialize after
 * the shell click. Keep this wait bounded and make a timeout useful: a future
 * failure must identify whether the iframe, editor handle, or a resource was
 * actually missing instead of being waved away as "pre-existing".
 */
async function waitForBuildReady(page, surface) {
  try {
    await page.waitForFunction(() => {
      const iframe = document.querySelector('.gjs-cv-canvas iframe');
      const frameDocument = iframe?.contentDocument;
      return Boolean(
        window.__RB_EDITOR__?.shell?.build?.editor &&
        iframe &&
        frameDocument?.readyState === 'complete' &&
        frameDocument.body?.children.length,
      );
    }, null, { timeout: 30_000 });
  } catch (error) {
    const diagnosis = await page.evaluate(() => ({
      hasShell: Boolean(window.__RB_EDITOR__?.shell),
      hasBuildHandle: Boolean(window.__RB_EDITOR__?.shell?.build?.editor),
      hasCanvas: Boolean(document.querySelector('#gjs')),
      hasCanvasIframe: Boolean(document.querySelector('.gjs-cv-canvas iframe')),
      frameReadyState: document.querySelector('.gjs-cv-canvas iframe')?.contentDocument?.readyState || null,
      grapesResources: performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => /grapes|typekit|companion/i.test(name))
        .slice(-20),
    }));
    throw new Error(
      `${surface} GrapesJS readiness timed out after 30s. ` +
      `Bounded diagnosis: ${JSON.stringify(diagnosis)}. ` +
      `GrapesJS is vendored under /src/vendor/grapesjs; any missing external ` +
      `resource must be named above. Original error: ${error.message}`,
    );
  }
}

async function assertWordmarkDom(page) {
  const wordmarks = page.locator('.rb-brand__name .rb-brand__accent');
  expect(await wordmarks.count()).toBeGreaterThan(0);
  await expect(wordmarks.first()).toHaveText('Designs');
  const markup = await page.locator('.rb-brand__name').evaluateAll((nodes) => nodes.map((node) => ({
    html: node.innerHTML,
    accentTag: node.querySelector('.rb-brand__accent')?.tagName || null,
  })));
  expect(markup.length).toBeGreaterThan(0);
  expect(markup.every(({ html, accentTag }) => accentTag === 'SPAN' && !/<em\b/i.test(html))).toBe(true);
}

async function assertToolbarReadable(page) {
  await expect(page.getByTestId('toolbar')).toBeVisible();
  const metrics = await page.getByTestId('toolbar').evaluate((toolbar) => {
    const toolbarBox = toolbar.getBoundingClientRect();
    const controls = [...toolbar.querySelectorAll('button')].map((button) => {
      const box = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        id: button.dataset.testid || button.id,
        name: button.innerText.trim() || button.getAttribute('aria-label') || button.title || '',
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0,
      };
    }).filter((control) => control.visible && control.right > 0 && control.left < window.innerWidth);
    return {
      toolbar: { bottom: toolbarBox.bottom, width: toolbarBox.width },
      viewportWidth: window.innerWidth,
      controls,
    };
  });

  expect(metrics.toolbar.width).toBeGreaterThan(0);
  expect(metrics.controls.length).toBeGreaterThan(0);
  for (const control of metrics.controls) {
    expect(control.name, `${control.id} should have readable text or an accessible name`).not.toBe('');
    expect(control.left, `${control.id} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
    expect(control.right, `${control.id} is clipped at the viewport edge`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(control.bottom, `${control.id} escapes the toolbar row`).toBeLessThanOrEqual(metrics.toolbar.bottom + 1);
    expect(control.height, `${control.id} is too small to read/tap`).toBeGreaterThanOrEqual(30);
  }
}

async function assertEditorSurface(page, surface) {
  await assertToolbarReadable(page);
  await expect(page.getByTestId('canvas-wrap')).toBeVisible();
  await expect(page.locator('#gjs')).toBeVisible();
  await expect(page.locator('.gjs-cv-canvas iframe')).toBeVisible();
  await expect(page.locator('.rb-logo-img').first()).toBeVisible();

  const activeAccent = await page.getByTestId('btn-mode-build').evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(activeAccent.match(/\d+/g)?.slice(0, 3).map(Number)).toEqual([200, 75, 75]);

  const canvas = page.frameLocator('.gjs-cv-canvas iframe');
  await expect(canvas.locator('h1')).toBeVisible();
  const ctaColor = await canvas.locator('a').first().evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(ctaColor.match(/\d+/g)?.slice(0, 3).map(Number)).toEqual([200, 75, 75]);

  if (surface === 'desktop') {
    await expect(page.locator('#gjs-blocks .gjs-block').first()).toBeVisible();
    await expect(page.getByTestId('status-bar')).toBeVisible();
  } else if (surface === 'tablet') {
    const rail = page.getByTestId('rail');
    if (await rail.evaluate((element) => element.classList.contains('is-collapsed'))) {
      await page.getByTestId('btn-toggle-rail').click();
    }
    await expect(rail).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('#gjs-blocks .gjs-block').first()).toBeVisible();
    await expect(page.getByTestId('status-bar')).toBeVisible();
  } else {
    await expect(page.locator('.rbm-dock')).toBeVisible();
    await page.locator('#rbm-dock-add').click();
    await expect(page.getByTestId('rail')).toHaveClass(/is-sheet-open/);
    await expect(page.locator('#gjs-blocks .gjs-block').first()).toBeVisible();
  }
}

async function assertNoBrowserErrors(diagnostics, surface) {
  const localFailures = diagnostics.failedRequests.filter(({ url }) => url.startsWith('http://127.0.0.1:5180'));
  expect(diagnostics.consoleErrors, `${surface} console errors`).toEqual([]);
  expect(diagnostics.pageErrors, `${surface} page errors`).toEqual([]);
  expect(localFailures, `${surface} local request failures`).toEqual([]);
}

test.describe('RHOBEAR Designs — Firefly bounce proof', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('designs_onboarded_v1'); } catch (_) { /* browser storage may be disabled */ }
    });
  });

  test('desktop: complete onboarding, mount the real editor, and capture proof', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const diagnostics = watchBrowser(page);
    await page.goto('/index.html?surface=desktop', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);

    const onboarding = page.locator('#dsOnb');
    await expect(onboarding).toHaveClass(/on/);
    await assertWordmarkDom(page);
    await expect(onboarding.locator('.dsob-name .rb-brand__accent')).toBeVisible();
    const onboardingColor = await onboarding.locator('.dsob-name .rb-brand__accent').evaluate((element) => getComputedStyle(element).color);
    expect(onboardingColor).toBe('rgb(200, 75, 75)');
    await expect(onboarding.locator('.dsob-name em')).toHaveCount(0);

    for (let step = 0; step < 3; step += 1) {
      const current = onboarding.locator(`.dsob-step[data-step="${step}"]`);
      await expect(current).toBeVisible();
      await current.locator('[data-next]').click();
    }
    await expect(onboarding.locator('.dsob-step[data-step="3"]')).toBeVisible();
    await onboarding.locator('#dsobDone').click();
    await expect(onboarding).not.toHaveClass(/on/);

    await page.getByTestId('empty-build').click();
    await waitForBuildReady(page, 'desktop');
    await assertEditorSurface(page, 'desktop');
    await page.screenshot({ path: path.join(SCREENSHOTS, 'desktop-editor.png') });
    await assertNoBrowserErrors(diagnostics, 'desktop');
  });

  test('tablet: direct entry reaches the real editor without clipped toolbar controls', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const diagnostics = watchBrowser(page);
    await page.goto('/t.html?surface=tablet', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    await assertWordmarkDom(page);
    await page.getByTestId('empty-build').click();
    await waitForBuildReady(page, 'tablet');
    await assertEditorSurface(page, 'tablet');
    await page.screenshot({ path: path.join(SCREENSHOTS, 'tablet-editor.png') });
    await assertNoBrowserErrors(diagnostics, 'tablet');
  });

  test('mobile: direct entry reaches the real editor and its Add sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const diagnostics = watchBrowser(page);
    await page.goto('/m.html?surface=mobile', { waitUntil: 'domcontentloaded' });
    await waitForShell(page);
    await assertWordmarkDom(page);
    await page.getByTestId('empty-build').click();
    await waitForBuildReady(page, 'mobile');
    await assertEditorSurface(page, 'mobile');
    await page.screenshot({ path: path.join(SCREENSHOTS, 'mobile-editor.png') });
    await assertNoBrowserErrors(diagnostics, 'mobile');
  });
});
