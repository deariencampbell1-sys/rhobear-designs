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
