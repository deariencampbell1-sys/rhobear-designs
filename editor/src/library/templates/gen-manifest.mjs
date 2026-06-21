/**
 * gen-manifest.mjs - scan samples/<collection>/<name>.html and emit manifest.json.
 *
 * Pure data tool. No React, no DOM in the runtime library.
 *
 * Run:
 *   node editor/src/library/templates/gen-manifest.mjs
 *
 * Writes:
 *   editor/src/library/templates/manifest.json
 *
 * MIT — RHOBEAR Designs.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo root is the worktree root (one level up from editor/).
// Script lives at editor/src/library/templates/gen-manifest.mjs.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const SAMPLES_ROOT = join(REPO_ROOT, 'samples');
const OUT = join(__dirname, 'manifest.json');

// Collection directories under samples/ to scan. We skip the top-level README.md
// and any non-template metadata (status files live alongside the .html but we
// only pick up .html files).
const COLLECTIONS = [
  'minimax-m3-high',
  'minimax-m3-medium',
  'minimax-m2.7',
  'grok-build-beta',
  'grok-composer-2.5',
  'claude-opus-4.7',
];

// Domain keyword → tag. Match is case-insensitive on title + first N headings
// + the description text. We keep the list small and stable.
const DOMAIN_KEYWORDS = [
  // studio types
  ['studio', 'studio'],
  ['agency', 'agency'],
  ['collective', 'collective'],
  ['portfolio', 'portfolio'],
  ['illustration', 'illustration'],
  ['photography', 'photography'],
  ['art direction', 'art-direction'],
  // technique / tech
  ['webgl', 'webgl'],
  ['3d', '3d'],
  ['interactive', 'interactive'],
  ['motion', 'motion'],
  ['design', 'design'],
  ['brand', 'brand'],
  ['creative', 'creative'],
  ['award', 'awards'],
  // content types
  ['film', 'film'],
  ['production', 'production'],
  ['developer', 'developer'],
  ['experience', 'experiences'],
];

const MAX_BYTES = 256 * 1024; // 256 KiB per template is plenty for sniff

function listHtml(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith('.html'))
    .sort();
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function pickTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return decodeEntities(stripTags(m[1])).trim();
}

function pickOriginalUrl(html) {
  // comment form: "  Original URL : https://example.com/" or "Original URL: ..."
  const m = html.match(/Original\s*URL\s*[:=]\s*(\S+)/i);
  if (!m) return null;
  return m[1].replace(/[),;]+$/, '');
}

function pickHeadings(html, max = 6) {
  const out = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    const t = decodeEntities(stripTags(m[2])).trim();
    if (t && t.length < 200) out.push(t);
  }
  return out;
}

function pickFirstParagraph(html) {
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return null;
  const t = decodeEntities(stripTags(m[1])).trim();
  if (!t) return null;
  return t.length > 240 ? t.slice(0, 237) + '…' : t;
}

function toTitleCase(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function inferTags({ collection, title, headings, paragraph }) {
  const tags = new Set();
  // collection is always a tag
  tags.add(collection);
  // base tag for filtering
  tags.add('template');
  const haystack = [title, ...(headings || []), paragraph || ''].join(' ').toLowerCase();
  for (const [kw, tag] of DOMAIN_KEYWORDS) {
    if (haystack.includes(kw)) tags.add(tag);
  }
  // dedupe + stable order
  return [...tags].sort();
}

function makeId(collection, file) {
  const slug = file
    .replace(/\.html?$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${collection}-${slug}`;
}

function buildEntry(collection, file, htmlPath) {
  let html = '';
  try {
    const buf = readFileSync(htmlPath);
    html = buf.subarray(0, MAX_BYTES).toString('utf8');
    if (buf.length > MAX_BYTES) html += '\n<!-- truncated for sniff -->';
  } catch (e) {
    console.warn(`! could not read ${htmlPath}: ${e.message}`);
  }

  const title = pickTitle(html);
  const originalUrl = pickOriginalUrl(html);
  const headings = pickHeadings(html, 6);
  const paragraph = pickFirstParagraph(html);

  const id = makeId(collection, file);
  const filenameSlug = file.replace(/\.html?$/i, '');
  const name = title && title.length <= 120 ? title : toTitleCase(filenameSlug);

  let description = '';
  if (paragraph) description = paragraph;
  else if (headings.length) description = headings[0];
  else if (title) description = title;
  else description = toTitleCase(filenameSlug);

  if (description.length > 240) description = description.slice(0, 237) + '…';

  const tags = inferTags({ collection, title: name, headings, paragraph });

  // sourcePath is repo-relative with forward slashes (portable across OS)
  const sourcePath = ['samples', collection, file].join('/');

  const entry = {
    id,
    collection,
    name,
    tags,
    sourcePath,
    description,
    thumb: null,
  };
  if (originalUrl) entry.originalUrl = originalUrl;
  if (title) entry.title = title;
  if (headings.length) entry.headings = headings;
  return entry;
}

function main() {
  if (!existsSync(SAMPLES_ROOT)) {
    console.error(`samples dir not found at ${SAMPLES_ROOT}`);
    process.exit(1);
  }

  const entries = [];
  let collectionsUsed = 0;
  for (const collection of COLLECTIONS) {
    const dir = join(SAMPLES_ROOT, collection);
    const files = listHtml(dir);
    if (!files.length) continue;
    collectionsUsed++;
    for (const file of files) {
      const abs = join(dir, file);
      // skip anything that isn't a real file
      try {
        const st = statSync(abs);
        if (!st.isFile()) continue;
      } catch {
        continue;
      }
      const entry = buildEntry(collection, file, abs);
      entries.push(entry);
    }
  }

  // Stable sort by id for diff-friendly output.
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const manifest = {
    $schema: './manifest.schema.json',
    version: 1,
    generatedAt: new Date().toISOString(),
    collections: COLLECTIONS.filter((c) =>
      entries.some((e) => e.tags.includes(c)),
    ),
    count: entries.length,
    entries,
  };

  writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} entries across ${collectionsUsed} collections → ${relative(REPO_ROOT, OUT)}`);
}

main();
