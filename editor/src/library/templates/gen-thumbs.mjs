/**
 * gen-thumbs.mjs — best-effort thumbnail generator for the template bank.
 *
 * For each entry in manifest.json this opens the source HTML in a real
 * Chromium at width 1280, scrolls the page top→bottom→top to trigger
 * lazy/scroll reveals, then takes a **full-page** tall screenshot
 * (capped to MAX_PAGE_HEIGHT so giant infinite-scroll pages stay sane).
 * The captured PNG is downscaled to TARGET_WIDTH (default 640, height
 * proportional) and written to editor/src/library/templates/thumbs/<id>.png.
 *
 * Why full-page? The template gallery's "page rolls" hover effect
 * reveals the whole design on hover. A 1280x800 viewport crop shows
 * only the fold and most templates look indistinguishable. The
 * full-page capture gives a tall portrait of the entire page so
 * preview cards stay identifiable and the roll animation has
 * something to roll.
 *
 * The script is OPTIONAL. The gallery UX live-previews anyway, so
 * if chromium is unavailable we exit 0 with a printed warning and
 * leave `thumb: null` in the manifest. Don't block CI on this.
 *
 * If a single entry fails (timeout, parse error, page too broken),
 * we keep its existing thumb on disk (don't blank it out) and note
 * the skip — the gallery still has a fallback.
 *
 * Run from the repo root:
 *   node editor/src/library/templates/gen-thumbs.mjs
 *
 * Optional environment knobs:
 *   COLLECTION=minimax-m3-high   only render one collection
 *                               (e.g. for swarm lanes that touch one set)
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
const NAV_TIMEOUT_MS = 20_000;
const RENDER_WAIT_MS = 1200;          // settle fonts / hero animation
const SCROLL_STEP_MS = 120;           // pace of scroll-to-bottom
const SCROLL_SETTLE_MS = 250;         // pause after each scroll step
const MAX_PAGE_HEIGHT = 5000;         // clamp so infinite-scroll pages stay sane
const TARGET_WIDTH = 640;             // downscale on save (height proportional)
const MAX_PARALLEL = 1;               // chromium contexts are heavy; keep sequential for the few 3D samples that crash the renderer when loaded in parallel
const COLLECTION_FILTER = process.env.COLLECTION || null; // optional subset

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
 * Best-effort scroll: walk the page from top to bottom in small
 * steps (so IntersectionObservers / scroll-revealed blocks fire),
 * then back to the top. Returns the document scroll height at the
 * end (post-reveal) so we know how tall the page actually is.
 */
async function scrollReveal(page) {
  try {
    return await page.evaluate(async ({ stepMs, settleMs }) => {
      const waitFor = (ms) => new Promise((r) => setTimeout(r, ms));
      const docH = () => Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
      );
      window.scrollTo(0, 0);
      await waitFor(100);
      const total = docH();
      const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < total + step; y += step) {
        window.scrollTo(0, y);
        await waitFor(stepMs);
        await waitFor(settleMs);
      }
      window.scrollTo(0, docH());
      await waitFor(200);
      window.scrollTo(0, 0);
      await waitFor(100);
      return docH();
    }, { stepMs: SCROLL_STEP_MS, settleMs: SCROLL_SETTLE_MS });
  } catch {
    return 0;
  }
}

/**
 * Downscale a PNG buffer to `targetWidth` (height proportional)
 * using the same Chromium session we rendered with: load the
 * buffer into a hidden page and screenshot the scaled <img>.
 * We do this instead of pulling in sharp/canvas to keep the
 * script dep-free.
 */
async function downscalePng(browser, buf, targetWidth) {
  const ctx = await browser.newContext({
    viewport: { width: targetWidth + 32, height: 8000 },
  });
  const page = await ctx.newPage();
  try {
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
    const dims = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      return { w: img.naturalWidth, h: img.naturalHeight };
    }, dataUrl);
    const ratio = dims.h / Math.max(1, dims.w);
    const outH = Math.max(1, Math.round(targetWidth * ratio));
    await page.setViewportSize({ width: targetWidth, height: outH });
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;background:transparent}
        img{display:block;width:${targetWidth}px;height:${outH}px}
      </style></head><body><img src="${dataUrl}"/></body></html>`,
      { waitUntil: 'load' },
    );
    return await page.screenshot({
      clip: { x: 0, y: 0, width: targetWidth, height: outH },
      omitBackground: false,
    });
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Render one template. Returns { width, height, bytes } on success,
 * or null on failure. We catch every error and downgrade to a
 * warning so one broken template doesn't kill the whole batch.
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
  let captureHeight = VIEWPORT.height;
  let usedFallback = false;
  try {
    await page.goto('file://' + sourceAbs, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForTimeout(RENDER_WAIT_MS);
    const pageHeight = await scrollReveal(page);
    captureHeight = Math.max(
      VIEWPORT.height,
      Math.min(pageHeight || VIEWPORT.height, MAX_PAGE_HEIGHT),
    );
    await page.setViewportSize({ width: VIEWPORT.width, height: captureHeight });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    let fullBuf;
    try {
      console.log(`    [${entry.id}] screenshotting ${VIEWPORT.width}x${captureHeight}...`);
      fullBuf = await page.screenshot({
        type: 'png',
        fullPage: false,
      });
    } catch (clipErr) {
      usedFallback = true;
      process.stderr.write(
        `    [${entry.id}] full-page capture failed, falling back to viewport: ` +
        `${clipErr && clipErr.message ? clipErr.message : clipErr}\n`,
      );
      try {
        await page.setViewportSize(VIEWPORT);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(120);
        captureHeight = VIEWPORT.height;
        fullBuf = await page.screenshot({ type: 'png', fullPage: false });
      } catch (fallbackErr) {
        process.stderr.write(
          `    [${entry.id}] viewport fallback also failed: ` +
          `${fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr}\n`,
        );
        throw fallbackErr;
      }
    }
    const downBuf = await downscalePng(browser, fullBuf, TARGET_WIDTH);
    writeFileSync(outPath, downBuf);
    return {
      width: TARGET_WIDTH,
      height: Math.max(1, Math.round(TARGET_WIDTH * (captureHeight / VIEWPORT.width))),
      bytes: downBuf.length,
      fallback: usedFallback,
    };
  } catch (err) {
    process.stderr.write(`  ! ${entry.id}: render failed: ${err && err.message ? err.message : err}\n`);
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Run N renderers in parallel using a simple worker-pool. We share
 * a single Chromium browser across all pages for speed.
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
      if (done % 5 === 0 || done === entries.length) {
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

  const all = manifest.entries;
  const entries = COLLECTION_FILTER
    ? all.filter((e) => e.collection === COLLECTION_FILTER)
    : all;
  const total = entries.length;
  console.log(
    `Rendering ${total} thumbnails ` +
    `(${VIEWPORT.width}px wide, fullPage≤${MAX_PAGE_HEIGHT}px, downscale→${TARGET_WIDTH}px)` +
    (COLLECTION_FILTER ? ` [collection=${COLLECTION_FILTER}]` : ''),
  );

  let results;
  try {
    results = await renderAll(entries);
  } catch (err) {
    console.warn(`[gen-thumbs] SKIPPED: ${err && err.message ? err.message : err}`);
    for (const entry of entries) {
      if (!('thumb' in entry) || !entry.thumb) {
        entry.thumb = null;
      }
    }
    await writeManifest(manifest);
    process.exit(0);
  }

  let rendered = 0;
  let skipped = 0;
  const examples = [];
  for (const entry of entries) {
    const out = results.get(entry.id);
    if (out) {
      entry.thumb = `thumbs/${entry.id}.png`;
      rendered++;
      if (examples.length < 5) {
        examples.push(
          `${entry.id} → ${out.width}x${out.height} ${(out.bytes/1024).toFixed(0)}KB`,
        );
      }
    } else {
      if (!('thumb' in entry) || !entry.thumb) {
        entry.thumb = null;
      }
      skipped++;
    }
  }
  await writeManifest(manifest);

  console.log(`Done. rendered=${rendered} skipped=${skipped} total=${total}`);
  for (const ex of examples) console.log(`  example: ${ex}`);
  console.log(`Thumbs written to ${join(__dirname, 'thumbs')}`);
}

main().catch((err) => {
  console.error('[gen-thumbs] unexpected error:', err);
  process.exit(0);
});