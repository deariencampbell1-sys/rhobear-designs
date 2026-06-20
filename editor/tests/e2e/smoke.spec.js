import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '../fixtures');
const SAMPLE_HTML = path.join(FIXTURES, 'sample-page.html');

test.describe('RHOBEAR Designs Editor — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.editor);
    await page.waitForSelector('.gjs-cv-canvas iframe', { timeout: 30_000 });
  });

  test('loads editor shell with all toolbar buttons present', async ({ page }) => {
    const buttons = [
      'btn-new',
      'btn-open-html',
      'btn-open-folder',
      'btn-save-html',
      'btn-export-zip',
      'btn-undo',
      'btn-redo',
      'btn-delete',
      'btn-duplicate',
      'btn-add-section',
      'btn-add-text',
      'btn-add-image',
      'btn-embed',
      'btn-device-desktop',
      'btn-device-tablet',
      'btn-device-mobile',
      'btn-preview',
      'btn-toggle-blocks',
      'btn-toggle-layers',
      'btn-toggle-styles',
    ];

    for (const id of buttons) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    await expect(page.getByTestId('panel-blocks')).toBeVisible();
    await expect(page.getByTestId('panel-layers')).toBeVisible();
    await expect(page.getByTestId('panel-styles')).toBeVisible();
    await expect(page.getByTestId('canvas-wrap')).toBeVisible();
    await expect(page.getByTestId('status-bar')).toBeVisible();
  });

  test('add-section inserts new content in canvas', async ({ page }) => {
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    const before = await frame.locator('section').count();

    await page.getByTestId('btn-add-section').click();
    await expect(frame.locator('section')).toHaveCount(before + 1);
    await expect(page.getByTestId('status-message')).toContainText('Added section');
  });

  test('add-text inserts paragraph', async ({ page }) => {
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    const before = await frame.locator('p').count();

    await page.getByTestId('btn-add-text').click();
    await expect(frame.locator('p')).toHaveCount(before + 1);
    await expect(page.getByTestId('status-message')).toContainText('Added text');
  });

  test('embed modal opens, inserts iframe, and closes', async ({ page }) => {
    await page.getByTestId('btn-embed').click();
    await expect(page.getByTestId('embed-modal')).toBeVisible();

    const embedCode = '<iframe src="https://example.com" width="300" height="200"></iframe>';
    await page.getByTestId('embed-code-input').fill(embedCode);
    await page.getByTestId('btn-embed-insert').click();

    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await expect(frame.locator('[data-embed="true"] iframe')).toHaveCount(1);
    await expect(page.getByTestId('status-message')).toContainText('Embed inserted');
  });

  test('embed cancel closes modal without inserting', async ({ page }) => {
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    const before = await frame.locator('[data-embed="true"]').count();

    await page.getByTestId('btn-embed').click();
    await page.getByTestId('embed-code-input').fill('<div>test</div>');
    await page.getByTestId('btn-embed-cancel').click();

    await expect(page.getByTestId('embed-modal')).not.toBeVisible();
    await expect(frame.locator('[data-embed="true"]')).toHaveCount(before);
  });

  test('device buttons switch active state', async ({ page }) => {
    await page.getByTestId('btn-device-tablet').click();
    await expect(page.getByTestId('btn-device-tablet')).toHaveClass(/rb-btn--active/);
    await expect(page.getByTestId('btn-device-desktop')).not.toHaveClass(/rb-btn--active/);

    await page.getByTestId('btn-device-mobile').click();
    await expect(page.getByTestId('btn-device-mobile')).toHaveClass(/rb-btn--active/);

    await page.getByTestId('btn-device-desktop').click();
    await expect(page.getByTestId('btn-device-desktop')).toHaveClass(/rb-btn--active/);
  });

  test('panel toggles show and hide', async ({ page }) => {
    await page.getByTestId('btn-toggle-blocks').click();
    await expect(page.getByTestId('panel-blocks')).toHaveClass(/is-hidden/);

    await page.getByTestId('btn-toggle-blocks').click();
    await expect(page.getByTestId('panel-blocks')).not.toHaveClass(/is-hidden/);

    await page.getByTestId('btn-toggle-layers').click();
    await expect(page.getByTestId('panel-layers')).toHaveClass(/is-hidden/);

    await page.getByTestId('btn-toggle-styles').click();
    await expect(page.getByTestId('panel-styles')).toHaveClass(/is-hidden/);
  });

  test('preview opens and closes', async ({ page }) => {
    await page.getByTestId('btn-preview').click();
    await expect(page.getByTestId('preview-modal')).toBeVisible();
    await expect(page.getByTestId('preview-frame')).toBeVisible();

    const previewSrc = await page.getByTestId('preview-frame').getAttribute('srcdoc');
    expect(previewSrc).toContain('<!DOCTYPE html>');

    await page.getByTestId('btn-preview-close').click();
    await expect(page.getByTestId('preview-modal')).not.toBeVisible();
  });

  test('open HTML imports file content', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('btn-open-html').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_HTML);

    await expect(page.getByTestId('doc-title')).toContainText('sample-page');
    await expect(page.getByTestId('status-message')).toContainText('Loaded');

    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await expect(frame.locator('h1')).toContainText('RHOBEAR Sample Page');
  });

  test('duplicate and delete work on selected element', async ({ page }) => {
    const frame = page.frameLocator('.gjs-cv-canvas iframe');
    await frame.locator('h1').first().click();

    await page.getByTestId('btn-duplicate').click();
    await expect(page.getByTestId('status-message')).toContainText('Duplicated');

    const h1Count = await frame.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(2);

    await page.getByTestId('btn-delete').click();
    await expect(page.getByTestId('status-message')).toContainText('Deleted');
  });

  test('undo and redo buttons respond after edit', async ({ page }) => {
    await page.getByTestId('btn-add-text').click();

    const undoBtn = page.getByTestId('btn-undo');
    await expect(undoBtn).toBeEnabled({ timeout: 5000 });

    await undoBtn.click();
    await expect(page.getByTestId('btn-redo')).toBeEnabled({ timeout: 5000 });

    await page.getByTestId('btn-redo').click();
  });

  test('save HTML triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-save-html').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.html$/);
    const savePath = path.join(FIXTURES, '_download-test.html');
    await download.saveAs(savePath);

    const content = fs.readFileSync(savePath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('Your page title');
    fs.unlinkSync(savePath);
  });

  test('export ZIP triggers download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('btn-export-zip').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    await expect(page.getByTestId('status-message')).toContainText('Exported');
  });

  test('new project resets after confirm', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.getByTestId('btn-add-section').click();
    await page.getByTestId('btn-new').click();
    await expect(page.getByTestId('status-message')).toContainText('New blank page');
  });

  test('style inspector height change applies to selected element', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { editor } = window.__RB_EDITOR__;
      const section = editor.getWrapper().find('section')[0];
      editor.select(section);
      editor.StyleManager.select(section);
      const height = editor.StyleManager.getProperty('size', 'height');
      height.upValue('400px');
      return section.getStyle().height;
    });

    expect(result).toBe('400px');
    await expect(page.getByTestId('status-message')).toContainText('height → 400px');
  });

  test('flex justify-content buttons apply to flex container', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { editor } = window.__RB_EDITOR__;
      const section = editor.getWrapper().find('section')[0];
      editor.select(section);
      section.addStyle({ display: 'flex' });
      editor.StyleManager.select(section);
      const jc = editor.StyleManager.getProperty('flex', 'justify-content');
      jc.upValue('center');
      return section.getStyle()['justify-content'];
    });
    expect(result).toBe('center');
    await expect(page.getByTestId('status-message')).toContainText('justify-content → center');
  });

  test('all data-action buttons map to handlers', async ({ page }) => {
    const unmapped = await page.evaluate(() => {
      const actions = {};
      document.querySelectorAll('[data-action]').forEach((el) => {
        actions[el.dataset.action] = (actions[el.dataset.action] || 0) + 1;
      });
      const wired = new Set([
        'new', 'open-html', 'open-folder', 'save-html', 'export-zip',
        'undo', 'redo', 'delete', 'duplicate', 'add-section', 'add-text',
        'add-image', 'embed', 'embed-cancel', 'device-desktop', 'device-tablet',
        'device-mobile', 'preview', 'preview-close', 'toggle-blocks',
        'toggle-layers', 'toggle-styles',
      ]);
      return Object.keys(actions).filter((a) => !wired.has(a));
    });
    expect(unmapped).toEqual([]);
  });
});