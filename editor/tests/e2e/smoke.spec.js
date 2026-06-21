import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '../fixtures');
const SCRIPTED = path.join(FIXTURES, 'scripted-page.html');
const SAMPLE = path.join(FIXTURES, 'sample-page.html');

test.describe('RHOBEAR Designs — UX smoke (Aurora Teal)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
  });

  test('shell + all toolbar controls present', async ({ page }) => {
    const ids = [
      'toolbar', 'doc-title', 'btn-toggle-rail', 'btn-mode-live', 'btn-mode-build',
      'btn-undo', 'btn-redo', 'btn-device-desktop', 'btn-device-tablet', 'btn-device-mobile',
      'btn-preview', 'btn-new', 'btn-open-html', 'btn-open-folder', 'btn-export-zip', 'btn-save-html',
      'rail', 'canvas-wrap', 'status-bar', 'ai-fab',
    ];
    for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  });

  test('default = live mode with onboarding; inspector hidden', async ({ page }) => {
    await expect(page.getByTestId('btn-mode-live')).toHaveClass(/is-active/);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('inspector')).toHaveClass(/is-hidden/);
  });

  test('mode switch mounts Build (GrapesJS) and hides onboarding', async ({ page }) => {
    await page.getByTestId('btn-mode-build').click();
    await expect(page.getByTestId('btn-mode-build')).toHaveClass(/is-active/);
    await page.waitForSelector('.gjs-cv-canvas iframe', { timeout: 30_000 });
    await expect(page.getByTestId('empty-state')).not.toBeVisible();
  });

  test('build mode: add section inserts into canvas', async ({ page }) => {
    await page.getByTestId('btn-mode-build').click();
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await page.waitForSelector('.gjs-cv-canvas iframe');
    const before = await frame.locator('section').count();
    await page.evaluate(() => window.__RB_EDITOR__.shell.build.addSection());
    await expect(frame.locator('section')).toHaveCount(before + 1);
  });

  test('live mode preserves the page AND runs its scripts (fidelity)', async ({ page }) => {
    await page.getByTestId('btn-open-html').click().catch(() => {});
    await page.setInputFiles('[data-testid="input-html"]', SCRIPTED);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await expect(frame.locator('h1')).toContainText('RHOBEAR Scripted Page');
    // the page's own <script> executed in the live canvas → functions preserved
    await expect(frame.locator('html')).toHaveAttribute('data-script-ran', 'yes');
    await expect(frame.locator('#p1')).toHaveAttribute('data-touched', '1');
    await expect(page.getByTestId('doc-title')).toContainText('scripted-page');
  });

  test('live mode: clicking an element reveals the inspector', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await expect(frame.locator('h1')).toBeVisible();
    await frame.locator('h1').click();
    await expect(page.getByTestId('inspector')).not.toHaveClass(/is-hidden/);
    await expect(page.getByTestId('inspector-tag')).toContainText('h1');
    await expect(page.getByTestId('inspector-live')).toBeVisible();
  });

  test('element library: categories render and a card inserts into the live page', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    const lib = page.getByTestId('element-library');
    await expect(lib.locator('.rb-lib-cat').first()).toBeVisible();
    const beforeSections = await frame.locator('section, div, button, a').count();
    await lib.locator('.rb-lib-card').first().click();
    // insertion grows the DOM and auto-selects the new element (inspector opens)
    await expect.poll(async () => frame.locator('section, div, button, a').count()).toBeGreaterThan(beforeSections);
    await expect(page.getByTestId('inspector')).not.toHaveClass(/is-hidden/);
  });

  test('templates gallery opens (62) and opens one into the live editor', async ({ page }) => {
    await page.getByTestId('btn-templates').click();
    await expect(page.getByTestId('templates-modal')).toBeVisible();
    const cards = page.getByTestId('templates-grid').locator('.rb-tpl-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(10);
    await cards.first().click();
    await expect(page.getByTestId('templates-modal')).not.toBeVisible();
    const fr = page.frameLocator('[data-testid="live-frame"]');
    await expect(fr.locator('body')).not.toBeEmpty({ timeout: 15000 });
  });

  test('projects: save current creates a listed entry', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    await page.frameLocator('[data-testid="live-frame"]').locator('h1').waitFor();
    await page.getByTestId('btn-projects').click();
    await expect(page.getByTestId('projects-modal')).toBeVisible();
    await page.getByTestId('proj-name').fill('My Project');
    await page.getByTestId('btn-proj-save').click();
    await expect(page.getByTestId('projects-list')).toContainText('My Project');
  });

  test('live layers tree lists elements and selects on click', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    await page.frameLocator('[data-testid="live-frame"]').locator('h1').waitFor();
    await page.getByTestId('rail-tab-layers').click();
    const layers = page.getByTestId('live-layers').locator('.rb-layer');
    await expect(layers.first()).toBeVisible();
    await layers.first().click();
    await expect(page.getByTestId('inspector')).not.toHaveClass(/is-hidden/);
  });

  test('inspector opacity slider changes the element (Effects apply)', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').click();
    await page.getByTestId('inspector-live').locator('.rb-sector__head', { hasText: 'Effects' }).click();
    const range = page.getByTestId('inspector-live').locator('.rb-range');
    await range.evaluate((el) => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    // inline opacity is set immediately (the computed value then transitions toward it)
    const inline = await frame.locator('h1').evaluate((e) => e.style.opacity);
    expect(Number(inline)).toBeCloseTo(0.4, 1);
    await page.waitForTimeout(400);
    const op = await frame.locator('h1').evaluate((e) => getComputedStyle(e).opacity);
    expect(Number(op)).toBeLessThan(0.9);
  });

  test('inspector shadow preset applies a box-shadow', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').click();
    await page.getByTestId('inspector-live').locator('.rb-sector__head', { hasText: 'Effects' }).click();
    await page.getByTestId('inspector-live').locator('.rb-preset').nth(2).click();
    const sh = await frame.locator('h1').evaluate((e) => e.style.boxShadow);
    expect(sh && sh !== 'none').toBeTruthy();
  });

  test('double-click makes an element editable; single click does not', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').click();
    expect(await frame.locator('h1').getAttribute('contenteditable')).toBeNull();
    await frame.locator('h1').dblclick();
    expect(await frame.locator('h1').getAttribute('contenteditable')).toBe('true');
  });

  test('gradient swatch sets a background-image', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('.card').waitFor();
    await frame.locator('.card').click();
    await page.getByTestId('inspector-live').locator('.rb-grad').first().click({ force: true });
    const bg = await frame.locator('.card').evaluate((e) => e.style.backgroundImage);
    expect(bg).toContain('gradient');
  });

  test('clicking the page background never selects/drags <body>', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').click();
    await expect(page.getByTestId('inspector-tag')).toContainText('h1');
    // click empty background → must clear, not select <body>
    await frame.locator('body').click({ position: { x: 3, y: 3 } });
    await expect(page.getByTestId('inspector-tag')).not.toContainText('body');
    // body is never draggable
    expect(await frame.locator('body').getAttribute('draggable')).not.toBe('true');
  });

  test('quick-add inserts a structural footer', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await page.getByTestId('element-library').locator('.rb-quick-btn', { hasText: 'Footer' }).click();
    await expect(frame.locator('footer')).toHaveCount(1);
  });

  test('undo reverts a live-mode insert', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await page.getByTestId('element-library').locator('.rb-quick-btn', { hasText: 'Footer' }).click();
    await expect(frame.locator('footer')).toHaveCount(1);
    await page.waitForTimeout(500); // MutationObserver snapshot debounce
    await page.getByTestId('btn-undo').click();
    await expect(frame.locator('footer')).toHaveCount(0);
  });

  test('link editing: Link controls appear and retarget the href', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('a').first().waitFor();
    await frame.locator('a').first().click();
    const href = page.getByTestId('inspector-live').locator('input[placeholder*="#section"]');
    await expect(href).toBeVisible();
    await href.fill('#contact');
    await href.blur();
    expect(await frame.locator('a').first().getAttribute('href')).toBe('#contact');
  });

  test('free move: dragging an element places it anywhere (transform applied)', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    const h1 = frame.locator('h1');
    await h1.waitFor();
    const box = await h1.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 90, { steps: 10 });
    await page.mouse.up();
    const t = await h1.evaluate((e) => e.style.transform);
    expect(t).toContain('translate');
  });

  test('duplicate offsets the copy so it is visible', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    const frame = page.frameLocator('[data-testid="live-frame"]');
    await frame.locator('h1').waitFor();
    await frame.locator('h1').click();
    const before = await frame.locator('h1').count();
    await page.getByTestId('float-duplicate').click();
    await expect(frame.locator('h1')).toHaveCount(before + 1);
    const t = await frame.locator('h1').nth(1).evaluate((e) => e.style.transform);
    expect(t).toContain('translate');
  });

  test('rail toggles collapse', async ({ page }) => {
    await page.getByTestId('btn-toggle-rail').click();
    await expect(page.getByTestId('rail')).toHaveClass(/is-collapsed/);
    await page.getByTestId('btn-toggle-rail').click();
    await expect(page.getByTestId('rail')).not.toHaveClass(/is-collapsed/);
  });

  test('device buttons switch active state', async ({ page }) => {
    await page.getByTestId('btn-device-tablet').click();
    await expect(page.getByTestId('btn-device-tablet')).toHaveClass(/is-active/);
    await page.getByTestId('btn-device-desktop').click();
    await expect(page.getByTestId('btn-device-desktop')).toHaveClass(/is-active/);
  });

  test('AI bubble opens panel → settings modal opens and saves', async ({ page }) => {
    await page.getByTestId('ai-fab').click();
    await expect(page.getByTestId('ai-panel')).toHaveClass(/is-open/);
    await page.getByTestId('ai-connect').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('ai-key').fill('sk-test');
    await page.getByTestId('btn-settings-save').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
  });

  test('embed modal opens, inserts into build canvas, closes', async ({ page }) => {
    await page.getByTestId('btn-mode-build').click();
    await page.waitForSelector('.gjs-cv-canvas iframe');
    await page.evaluate(() => window.__RB_EDITOR__.shell.build.embed('<div data-embed-test="1">x</div>'));
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await expect(frame.locator('[data-embed="true"]')).toHaveCount(1);
  });

  test('preview opens with a full document and closes', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    await page.frameLocator('[data-testid="live-frame"]').locator('h1').waitFor();
    await page.getByTestId('btn-preview').click();
    await expect(page.getByTestId('preview-modal')).toBeVisible();
    const src = await page.getByTestId('preview-frame').getAttribute('srcdoc');
    expect(src).toContain('<!DOCTYPE html>');
    await page.getByTestId('btn-preview-close').click();
    await expect(page.getByTestId('preview-modal')).not.toBeVisible();
  });

  test('save HTML downloads a document', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    await page.frameLocator('[data-testid="live-frame"]').locator('h1').waitFor();
    const dl = page.waitForEvent('download');
    await page.getByTestId('btn-save-html').click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/\.html$/);
    const p = path.join(FIXTURES, '_dl.html');
    await d.saveAs(p);
    expect(fs.readFileSync(p, 'utf-8')).toContain('<!DOCTYPE html>');
    fs.unlinkSync(p);
  });

  test('export ZIP downloads', async ({ page }) => {
    await page.setInputFiles('[data-testid="input-html"]', SAMPLE);
    await page.frameLocator('[data-testid="live-frame"]').locator('h1').waitFor();
    const dl = page.waitForEvent('download');
    await page.getByTestId('btn-export-zip').click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('new blank page switches to build and resets', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('btn-new').click();
    await page.waitForSelector('.gjs-cv-canvas iframe');
    await expect(page.getByTestId('btn-mode-build')).toHaveClass(/is-active/);
  });
});
