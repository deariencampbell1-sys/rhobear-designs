/**
 * gen-thumbs.mjs — best-effort thumbnail generator for the template bank.
 *
 * For each entry in manifest.json this opens the source HTML in a real
 * Chromium and writes a small PNG (1280x800, viewport-fit) into
 * editor/src/library/templates/thumbs/<id>.png. It then patches manifest.json
 * to add a `thumb: "thumbs/<id>.png"` field (or `thumb: null` if rendering
 * failed for that entry).
 *
 * This script is OPTIONAL. The gallery UX live-previews anyway, so if
 * chromium is unavailable we exit 0 with a printed warning and leave
 * `thumb: null` in the manifest. Don't block CI on this.
 *
 * Run from the repo root:
 *   node editor/src/library/templates/gen-thumbs.mjs
 *
 * MIT — RHOBEAR Designs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const MANIFEST_PATH = join(__dirname, 'manifest.json');
const THUMBS_DIR = join(__dirname, 'thumbs');

const VIEWPORT = { width: 1280, height: 800 };
const NAV_TIMEOUT_MS = 15_000;
const RENDER_WAIT_MS = 800; // settle animations / canvases
const FULL_PAGE = false;   // viewport-only snap (faster, smaller file)
const MAX_PARALLEL = 4;

async function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

async function writeManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

/**
 * Render one template. Returns the absolute PNG path on success, or null on
 * failure. We catch every error and downgrade to a warning so one broken
 * template doesn't kill the whole batch.
 */
async function renderOne(browser, entry) {
  const sourceAbs = resolve(REPO_ROOT, entry.sourcePath);
  const outPath = join(THUMBS_DIR, `${entry.id}.png`);
  if (!existsSync(sourceAbs)) {
    console.warn(`  ! ${entry.id}: source missing at ${sourceAbs}`);
    return null;
  }
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  try {
    await page.goto('file://' + sourceAbs, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForTimeout(RENDER_WAIT_MS);
    await page.screenshot({ path: outPath, fullPage: FULL_PAGE });
    return outPath;
  } catch (err) {
    console.warn(`  ! ${entry.id}: render failed: ${err && err.message ? err.message : err}`);
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Run N renderers in parallel using a simple worker-pool. We share a single
 * Chromium browser across all pages for speed.
 */
async function renderAll(entries) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    throw new Error(
      `chromium launch failed (${err && err.message ? err.message : err}); ` +
        `install via \`npx playwright install chromium\` or skip thumbs`,
    );
  }
  let cursor = 0;
  let done = 0;
  const results = new Map();

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= entries.length) return;
      const entry = entries[i];
      const out = await renderOne(browser, entry);
      results.set(entry.id, out);
      done++;
      if (done % 10 === 0 || done === entries.length) {
        console.log(`  rendered ${done}/${entries.length}`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, entries.length) }, worker);
  await Promise.all(workers);
  await browser.close().catch(() => {});
  return results;
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`manifest.json not found at ${MANIFEST_PATH} - run gen-manifest.mjs first`);
    process.exit(1);
  }
  const manifest = await loadManifest();
  ensureDir(THUMBS_DIR);

  const total = manifest.entries.length;
  console.log(`Rendering thumbnails for ${total} templates (${VIEWPORT.width}x${VIEWPORT.height})`);

  let results;
  try {
    results = await renderAll(manifest.entries);
  } catch (err) {
    // Best-effort. Chromium not installed → leave thumb=null, print why, exit 0.
    console.warn(`[gen-thumbs] SKIPPED: ${err && err.message ? err.message : err}`);
    for (const entry of manifest.entries) {
      if (!('thumb' in entry)) entry.thumb = null;
    }
    await writeManifest(manifest);
    process.exit(0);
  }

  let rendered = 0;
  let skipped = 0;
  for (const entry of manifest.entries) {
    const out = results.get(entry.id);
    if (out) {
      entry.thumb = `thumbs/${entry.id}.png`;
      rendered++;
    } else {
      entry.thumb = null;
      skipped++;
    }
  }
  await writeManifest(manifest);

  console.log(`Done. rendered=${rendered} skipped=${skipped} total=${total}`);
  console.log(`Thumbs written to ${join(__dirname, 'thumbs')}`);
}

main().catch((err) => {
  console.error('[gen-thumbs] unexpected error:', err);
  // Don't fail the swarm lane on thumb problems.
  process.exit(0);
});
