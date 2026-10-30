/**
 * Auth + prefs integration verification.
 *
 * These tests verify that auth and server-synced preferences integrate
 * correctly with the editor shell. They do NOT test the live auth.rhobear.ai
 * service end-to-end (that requires a real session token) — they verify the
 * local contract: the sign-in button appears, settings save flows through
 * the prefs system, localStorage fallback works signed out, and the boot
 * does not throw or leave console errors.
 *
 * The full acceptance test (sign in, change pref, open second profile,
 * see it sync) is a manual step documented in the PR.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth + prefs integration', () => {
  test.beforeEach(async ({ context }) => {
    // Mark onboarding as done. Seed sample data ONLY on the first navigation
    // (no rb-prefs-cache yet) so reloads preserve the cache written by setPrefs.
    await context.addInitScript(() => {
      localStorage.setItem('designs_onboarded_v1', '1');
      if (!localStorage.getItem('rb-prefs-cache')) {
        localStorage.setItem('rb-ai', JSON.stringify({
          provider: 'anthropic', key: 'sk-test', model: '', baseUrl: '',
        }));
        localStorage.setItem('rb-ai-style', 'luxury');
        localStorage.setItem('rb-ai-deep', '1');
      }
    });
  });

  test('sign-in button appears in toolbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    const btn = page.getByTestId('btn-auth');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Sign in');
  });

  test('no console errors on boot (auth + prefs init)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Reload and wait for ready
    await page.reload();
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    await page.waitForTimeout(500);
    // Filter known non-issue errors
    const relevant = errors.filter((e) =>
      !e.includes('favicon') && !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(relevant).toEqual([]);
  });

  test('settings save persists through prefs (signed-out localStorage fallback)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);

    // Open settings, change provider, save
    await page.getByTestId('ai-fab').click();
    await page.getByTestId('ai-connect').click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await page.getByTestId('ai-provider').selectOption('openai');
    await page.getByTestId('ai-key').fill('sk-openai-test');
    await page.getByTestId('btn-settings-save').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
    // Status message reflects local save (not signed in)
    await expect(page.getByTestId('status-message')).toContainText('locally');

    // Reload and verify prefs persisted (localStorage cache).
    // IMPORTANT: do NOT seed again — the prefs-cache written by setPrefs
    // during the first visit must survive the reload.
    await page.reload();
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    // Open settings again — should have the saved values
    await page.getByTestId('ai-fab').click();
    await page.getByTestId('ai-connect').click();
    await expect(page.getByTestId('ai-provider')).toHaveValue('openai');
    await expect(page.getByTestId('ai-key')).toHaveValue('sk-openai-test');
  });

  test('settings save shows sync checkmark when signed in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('rhobear_session', 's_test_token'));
    await page.reload();
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    // Open settings, save — should show "saved ✓"
    await page.getByTestId('ai-fab').click();
    await page.getByTestId('ai-connect').click();
    await page.getByTestId('ai-provider').selectOption('google');
    await page.getByTestId('ai-key').fill('sk-google-test');
    await page.getByTestId('btn-settings-save').click();
    await expect(page.getByTestId('status-message')).toContainText('✓');
  });

  test('AI style and deep thinking persist through prefs', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    // Open the AI panel to reveal the pro toolbar (style select, deep btn)
    await page.getByTestId('ai-fab').click();
    await page.waitForSelector('#rb-ai-pro', { state: 'visible' });
    const styleSelect = page.locator('#rb-ai-pro select');
    await expect(styleSelect).toHaveValue('luxury');
    const deepBtn = page.locator('#rb-ai-pro .rb-ai-pro__deep');
    await expect(deepBtn).toHaveClass(/is-on/);
  });

  test('signing out clears the session and reverts button to "Sign in"', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('rhobear_session', 's_test_token'));
    await page.reload();
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    const btn = page.getByTestId('btn-auth');
    await expect(btn).toHaveText('Sign out');
    // Click sign out
    await btn.click();
    await expect(btn).toHaveText('Sign in');
  });

  test('signed-out editor still fully works (no wall)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    // Verify the core toolbar actions still work
    await expect(page.getByTestId('btn-mode-live')).toBeVisible();
    await expect(page.getByTestId('btn-mode-build')).toBeVisible();
    await expect(page.getByTestId('ai-fab')).toBeVisible();
    await expect(page.getByTestId('btn-templates')).toBeVisible();
    await expect(page.getByTestId('btn-projects')).toBeVisible();
    // Switch to build mode
    await page.getByTestId('btn-mode-build').click();
    await expect(page.getByTestId('btn-mode-build')).toHaveClass(/is-active/);
    await expect(page.locator('#gjs')).toContainText('This feature is being rebuilt.');
  });

  test('rb-designs-api falls back gracefully when absent from prefs', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/?designs_page_id=test-page');
    await page.waitForFunction(() => window.__RB_EDITOR__?.ready);
    await page.waitForTimeout(1000);
    const relevant = errors.filter((e) =>
      !e.includes('favicon') && !e.includes('Failed to load resource')
    );
    expect(relevant).toEqual([]);
  });
});
