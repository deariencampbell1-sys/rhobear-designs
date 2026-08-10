import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDITOR_ROOT = path.resolve(HERE, '../..');
// PWA + desktop-shell artifacts are user-visible brand surfaces too: the
// manifest's chrome/splash colours and the service worker's cached shell
// must carry the pack values just like the HTML entries. src-tauri JSON
// (tauri.conf.json, capabilities/) rides along for the same reason.
const SOURCE_ROOTS = ['index.html', 'm.html', 't.html', 'src', 'public', 'src-tauri'];
const SKIP_DIRS = new Set(['vendor', 'node_modules', 'dist']);
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs']);

function sourceFiles() {
  const out = [];
  function visit(abs) {
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(abs))) return;
      for (const entry of fs.readdirSync(abs)) visit(path.join(abs, entry));
      return;
    }
    if (TEXT_EXTENSIONS.has(path.extname(abs).toLowerCase())) out.push(abs);
  }
  for (const root of SOURCE_ROOTS) visit(path.join(EDITOR_ROOT, root));
  return out.sort();
}

function readSource() {
  return sourceFiles().map((file) => ({
    file: path.relative(EDITOR_ROOT, file),
    text: fs.readFileSync(file, 'utf8'),
  }));
}

function matchesInSource(pattern) {
  return readSource().flatMap(({ file, text }) => {
    const hits = [];
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push(`${file}:${line}: ${match[0]}`);
    }
    return hits;
  });
}

test('Firefly census — old accent is absent in both hex and RGB spellings', () => {
  // ff6b5e: the old Firefly gradient stop (removed in live-mode.js) — same
  // stale-accent family as ff3a2a/cc2e20, now covered too.
  const oldHex = /#(?:ff3a2a|cc2e20|ff6b5e)\b/gi;
  const oldRgb = /\brgba?\(\s*255\s*,\s*58\s*,\s*42(?:\s*,|\s*\))/gi;
  const hits = [...matchesInSource(oldHex), ...matchesInSource(oldRgb)];
  assert.deepEqual(hits, [], `old Firefly accent remnants found:\n${hits.join('\n')}`);
});

test('Firefly census — no unused .designs-* selector pack remains', () => {
  const selectors = matchesInSource(/(?:^|[,{\s])\.designs-[a-z0-9_-]+(?=[\s:{>,])/g);
  assert.deepEqual(selectors, [], `unused .designs-* selectors found:\n${selectors.join('\n')}`);
});

test('PWA manifest — chrome and splash wear the canonical Firefly colours', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(EDITOR_ROOT, 'public', 'manifest.webmanifest'), 'utf8'),
  );
  assert.equal(manifest.theme_color, '#C84B4B', 'browser chrome must use the ONE Firefly accent');
  assert.equal(manifest.background_color, '#0A0D10', 'splash background must use the Firefly ground');
});

test('wordmark DOM — all three entrypoints use the non-semantic Designs span', () => {
  const expected = {
    'index.html': /<span class="rb-brand__name">RHOBEAR\s+<span class="rb-brand__accent">Designs<\/span><\/span>/,
    'm.html': /<span class="rb-brand__name"><span class="rb-brand__accent">Designs<\/span><\/span>/,
    't.html': /<span class="rb-brand__name">RHOBEAR\s+<span class="rb-brand__accent">Designs<\/span><\/span>/,
  };
  for (const [file, pattern] of Object.entries(expected)) {
    const html = fs.readFileSync(path.join(EDITOR_ROOT, file), 'utf8');
    assert.match(html, pattern, `${file} must expose Designs as a styled span`);
    assert.doesNotMatch(html, /rb-brand__name[^>]*>[\s\S]{0,100}<em>Designs<\/em>/i,
      `${file} must not use semantic emphasis for the product wordmark`);
  }

  const desktop = fs.readFileSync(path.join(EDITOR_ROOT, 'index.html'), 'utf8');
  assert.match(desktop, /\.dsob-name \.rb-brand__accent\{color:#C84B4B\}/,
    'onboarding selector must target the non-semantic accent span');
});
