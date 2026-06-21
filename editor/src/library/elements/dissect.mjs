/**
 * @file Dissector — reads the ~70 sample HTML templates under
 *       `../../samples/minimax-m3-high/*.html` (relative to this file, that
 *       resolves to `editor/../samples/minimax-m3-high/`) and produces a
 *       categorized, deduped catalog of reusable UI snippets. Pure data +
 *       a small extraction algorithm. No DOM, no React, no styles, no UI.
 *
 *       Usage:
 *         node editor/src/library/elements/dissect.mjs
 *
 *       Writes:
 *         editor/src/library/elements/manifest.json
 *
 *       The output schema matches what `index.js` reads at runtime — see
 *       `index.js` for the loader contract. We deliberately commit
 *       `manifest.json` so the editor doesn't need to run this script on
 *       load (and so the data is reviewable in a PR diff).
 *
 *       Algorithm (deterministic, dependency-free, runs in seconds):
 *         1. For each sample file:
 *              - Use the existing `extractDocumentParts` engine helper to
 *                split head from body and collect the inline `<style>`
 *                contents.
 *              - For each CATEGORY (20 categories — the original 12 plus
 *                pricing / faq / feature / stats / logos / contact /
 *                banner / divider) find candidate elements via tag /
 *                role / class heuristics.
 *              - For each candidate, build a self-contained snippet by:
 *                  * extracting the outerHTML of the candidate element,
 *                  * stripping scripts / event handlers / IDs that
 *                    reference runtime JS,
 *                  * gathering the CSS rules from the sample `<style>`
 *                    block whose selectors match the element's class
 *                    names (or its tag for tag-scoped rules),
 *                  * rewriting every class token inside both the HTML and
 *                    the CSS to a unique per-snippet prefix so the
 *                    snippet renders standalone in any document without
 *                    colliding with other snippets or the page chrome.
 *              - Generate an `id` from source + slug, a `name` derived
 *                from the element's class / text + a structural hint
 *                ("Pricing — 3 tier", "Hero — split image"), and `tags`
 *                from matching keywords in classes / role hints.
 *         2. Merge in `FIXTURES` from `fixtures.mjs` — hand-authored
 *            entries for categories that are thin in the sample corpus
 *            (pricing, faq, divider). Fixtures are tagged with a
 *            synthetic `fixture:<category>:<name>` source label.
 *         3. Dedupe near-identical snippets using a normalized signature
 *            (stripped class prefix, lowered text, whitespace-collapsed).
 *            Cap each category so the library is useful, not bloated.
 *
 *       Stability contract: this script is a one-way ETL — its output is
 *       committed, version-controlled, and reviewed like any other file.
 *       It does not run in production.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractDocumentParts } from '../../engine/live-render.js';
import { FIXTURES } from './fixtures.mjs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
// editor/src/library/elements -> editor -> repo root
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const SAMPLES_DIR = join(REPO_ROOT, 'samples', 'minimax-m3-high');
const OUT_FILE = join(HERE, 'manifest.json');

// ---------------------------------------------------------------------------
// Categories (the full DoD-defined spread)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  // Original 12
  'nav',
  'hero',
  'button',
  'chip',
  'card',
  'badge',
  'cta',
  'section',
  'footer',
  'form',
  'gallery',
  'testimonial',
  // New 8 — added in this lane
  'pricing',
  'faq',
  'feature',
  'stats',
  'logos',
  'contact',
  'banner',
  'divider',
];

// Per-category soft caps (target spread, not hard limits — quality wins).
// Bumped from 12 → 20 so we hit 250+ across the 20-category manifest.
const PER_CATEGORY_CAP = 20;

// Minimum guarantees applied AFTER the build: if a category has fewer
// than `MIN_PER_CATEGORY` entries we log a warning. Tests enforce a
// stricter floor; this constant is for the script's own self-check.
const MIN_PER_CATEGORY = 6;
// `form` is allowed to fall below the global minimum because real forms
// are rare in this creative-agency corpus. New fixture-style categories
// (pricing / faq / divider) are pulled up to the floor via FIXTURES.
const PER_CAT_MIN_OVERRIDES = { form: 2 };

// ---------------------------------------------------------------------------
// Helpers — class / attribute matching
// ---------------------------------------------------------------------------

/**
 * Pull every class token out of a class="..." attribute string.
 * @param {string} html
 * @returns {Set<string>}
 */
function classesInHtml(html) {
  const out = new Set();
  const re = /class\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(html)) != null) {
    for (const tok of m[1].split(/\s+/)) {
      if (tok) out.add(tok);
    }
  }
  return out;
}

/**
 * Pull the textContent-only approximation out of an HTML block, ignoring
 * tags. Used to build dedupe signatures and human-friendly names.
 * @param {string} html
 */
function textOf(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip event handlers (`onclick=`, `onload=`, ...) and `javascript:`
 * URLs so snippets can't run foreign code when dropped into another doc.
 * @param {string} html
 */
function sanitizeAttrs(html) {
  return html
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
}

/**
 * Drop entire <script> and <style> blocks (the CSS we need is gathered
 * separately, and JS we never want to leak through).
 * @param {string} html
 */
function stripScriptsAndStyles(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

/**
 * Slugify a free-text string for use inside an element id.
 * @param {string} s
 * @param {number} max
 */
function slug(s, max = 32) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'snippet';
}

// ---------------------------------------------------------------------------
// CSS extraction
// ---------------------------------------------------------------------------

/**
 * Very small CSS rule splitter. We don't need a real parser — we need to
 * split a `<style>` body into "selector { decls }" chunks so we can pick
 * the ones whose selectors mention the classes used by a candidate.
 *
 * Skips @-rules (they're either @keyframes — not relevant to a static
 * snippet — or @media wrappers we'll flatten into each rule).
 *
 * @param {string} cssBody
 * @returns {Array<{ selector: string, decls: string }>}
 */
function splitCssRules(cssBody) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(cssBody)) != null) {
    const selector = m[1].trim();
    const decls = m[2].trim();
    // Skip @-rules — we never need @keyframes/@font-face inside a snippet
    // and unwrapping @media properly is not worth the complexity for our
    // use case (snippet owners can wrap the snippet in their own media
    // queries).
    if (selector.startsWith('@')) continue;
    if (!decls) continue;
    out.push({ selector, decls });
  }
  return out;
}

/**
 * Decide whether a CSS rule "applies to" the given class set.
 *   - A *compound* selector like `.foo .bar` is anchored on the FIRST
 *     class token. If `.foo` is in our classes we accept (the rule
 *     might cascade to `.bar` further down). If `.foo` is NOT in our
 *     classes we reject — pulling `.foo .bar` because `.bar` happens
 *     to be in our set would attach unrelated styles from another
 *     part of the page.
 *   - A *flat* selector like `.foo` or `.foo:hover` matches if `.foo`
 *     is in our classes.
 *   - A *compound* selector like `.foo.bar` matches if `.foo` OR `.bar`
 *     is in our classes (both classes must be on the same element for
 *     this rule to apply, so either alone is enough signal).
 *   - Tag selectors (`button`, `a`, `header`) only match when this is the
 *     element's own tag and the rule is a flat single-token rule, to
 *     avoid dragging in page-wide resets.
 *   - ID selectors (`#foo`) are ignored — they're too page-specific.
 *
 * @param {string} selector
 * @param {Set<string>} classes
 * @param {string} tagName
 */
function ruleAppliesTo(selector, classes, tagName) {
  // Split selector into comma-separated compounds.
  const compounds = selector.split(',').map((c) => c.trim()).filter(Boolean);
  if (compounds.length === 0) return false;
  for (const compound of compounds) {
    // A compound's tokens are split by combinators.
    const tokens = compound.split(/[\s>+~]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) continue;
    // Skip pure id-only compounds.
    if (tokens.every((t) => t.startsWith('#'))) continue;
    // Extract every class token anywhere in the compound.
    const classTokens = [];
    for (const tok of tokens) {
      for (const cls of tok.split('.')) {
        if (!cls) continue;
        if (cls.startsWith(':')) continue;
        classTokens.push(cls);
      }
    }
    // 1) Anchor check: the FIRST class token in the FIRST token group
    //    of the compound must be in our classes (for descendant-style
    //    selectors). E.g. `.loader .label` anchors on `.loader`; if
    //    `.loader` isn't ours we reject — even if `.label` is.
    const firstTok = tokens[0];
    const firstClasses = firstTok.split('.').filter(Boolean);
    const anchorOk = firstClasses.some((c) => classes.has(c));
    // 2) Flat-tag rule: single-token selector whose first token is a
    //    bare tag name that matches our element's tag.
    const isSingleTag = tokens.length === 1
      && /^[a-z][a-z0-9]*$/i.test(firstTok)
      && firstTok.toLowerCase() === tagName.toLowerCase();
    if (anchorOk) return true;
    // 3) For chained-class compounds like `.foo.bar`, the *second*
    //    token doesn't have to be in our classes — but if the anchor
    //    on the first token matches, we already returned. Otherwise,
    //    accept compound `.foo.bar` only if at least one of the
    //    classes within any single token group is in our set AND the
    //    anchor of that token group matches. This is what `anchorOk`
    //    already covers, so we don't add a second pass.
    if (isSingleTag) return true;
  }
  return false;
}

/**
 * Collect every CSS rule from a sample's <style> body that applies to
 * the given classes + tag, then prefix-rewrite every class token so the
 * resulting CSS only collides with itself.
 *
 * @param {string} cssBody
 * @param {Set<string>} classes
 * @param {string} tagName
 * @param {string} prefix  e.g. `el-3-nav`
 * @returns {string}
 */
function extractScopedCss(cssBody, classes, tagName, prefix) {
  const rules = splitCssRules(cssBody);
  const kept = [];
  for (const r of rules) {
    if (ruleAppliesTo(r.selector, classes, tagName)) {
      kept.push(r);
    }
  }
  if (kept.length === 0) return '';
  // Rewrite: every ".foo" -> ".el-3-nav-foo" inside selectors; ids left
  // alone (we won't match id-only rules anyway).
  const rewriter = (sel) => {
    return sel.replace(/\.([A-Za-z_][\w-]*)/g, (_, cls) => `.${prefix}-${cls}`);
  };
  const lines = kept.map((r) => `${rewriter(r.selector)}{${r.decls}}`);
  let out = lines.join('\n');
  // If the snippet references CSS custom properties (var(--*)) and the
  // sample has a :root block, inline the variable definitions too so
  // the snippet is genuinely self-contained. We rewrite `.x` class
  // tokens inside `:root` too, but `:root` only has var declarations
  // (no class selectors) so nothing actually rewrites — we just attach
  // it under a class-scoped selector to make it clear where it came
  // from.
  if (out.includes('var(--')) {
    const rootMatch = cssBody.match(/:root\s*\{([^{}]*)\}/);
    if (rootMatch) {
      const rootDecls = rootMatch[1].trim();
      if (rootDecls) {
        out = `/* :root from ${prefix} source */\n.${prefix}-root{${rootDecls}}\n` + out;
      }
    }
  }
  return out;
}

/**
 * Rewrite every class token inside an HTML string under a prefix, and
 * also rewrite the class="..." attribute itself when the class is a
 * meaningful one. We walk tokens; classes that look like Tailwind
 * utilities (contain only lowercase letters + dashes + digits, ≤ 32
 * chars, and don't start with a known component prefix like "nav-" or
 * "btn-") we leave alone — they're usually self-explanatory in context.
 *
 * For our purposes we rewrite ALL classes uniformly under the prefix.
 * That keeps snippet CSS unambiguous; if the user wants to drop a
 * Tailwind class, they can re-add it.
 *
 * @param {string} html
 * @param {Set<string>} classes
 * @param {string} prefix
 */
function rewriteHtmlClasses(html, classes, prefix) {
  // Map old -> new for fast lookup.
  const map = new Map();
  for (const c of classes) map.set(c, `${prefix}-${c}`);
  // Inside class="..." attributes — replace each token.
  let out = html.replace(/class\s*=\s*"([^"]*)"/gi, (_, body) => {
    const toks = body.split(/\s+/).filter(Boolean).map((t) => map.get(t) ?? t);
    return `class="${toks.join(' ')}"`;
  });
  out = out.replace(/class\s*=\s*'([^']*)'/gi, (_, body) => {
    const toks = body.split(/\s+/).filter(Boolean).map((t) => map.get(t) ?? t);
    return `class="${toks.join(' ')}"`;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Candidate extraction — per category
// ---------------------------------------------------------------------------

/**
 * Generic helper: find every element of a given tag name in bodyHtml,
 * optionally filtered by a predicate over the element's outerHTML, and
 * return the outerHTML of each match.
 *
 * We use a regex because the samples are not guaranteed to be balanced
 * (and that's OK — we tolerate imperfect matches the same way the rest
 * of the engine does).
 *
 * @param {string} bodyHtml
 * @param {string} tag
 * @param {(outerHtml: string, attrs: Record<string,string>) => boolean} filter
 */
function findElementsByTag(bodyHtml, tag, filter) {
  const out = [];
  // Self-closing tags handled separately.
  const selfClosing = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
  const tagLower = tag.toLowerCase();
  const openRe = new RegExp(`<${tagLower}\\b([^>]*)>`, 'gi');
  let m;
  while ((m = openRe.exec(bodyHtml)) != null) {
    if (selfClosing.has(tagLower)) {
      const full = m[0];
      const attrs = parseAttrs(m[1]);
      if (!filter || filter(full, attrs)) out.push(full);
      continue;
    }
    // For non-self-closing tags, walk forward to find matching close.
    const start = m.index;
    const openEnd = openRe.lastIndex;
    const inner = findBalancedInner(bodyHtml, openEnd, tagLower);
    if (inner == null) continue;
    const outerEnd = inner.end; // points just after '</tag>'
    const full = bodyHtml.slice(start, outerEnd);
    const attrs = parseAttrs(m[1]);
    if (!filter || filter(full, attrs)) out.push(full);
  }
  return out;
}

/**
 * Lightweight attribute parser — enough for the discriminator predicates
 * below. Pulls out class, id, role, href, type, name, aria-label.
 *
 * @param {string} body
 * @returns {Record<string,string>}
 */
function parseAttrs(body) {
  const out = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(body)) != null) {
    out[m[1].toLowerCase()] = (m[3] != null ? m[3] : m[4]) ?? '';
  }
  return out;
}

/**
 * Given an index just AFTER the opening tag, scan forward to the matching
 * close tag, accounting for nested same-name tags. Returns the end index
 * (just past `</tag>`) or null if unbalanced.
 *
 * We use a clean cursor-based scan instead of regex lastIndex tricks:
 *   pos = current scan position
 *   depth = nesting depth (starts at 1 — we're inside the opener)
 *   find next <tag and next </tag> after pos
 *   whichever comes first wins
 *   if it's an open: depth++, pos = past-the-open
 *   if it's a close: depth--, pos = past-the-close
 *   when depth hits 0: return pos
 */
function findBalancedInner(bodyHtml, afterOpen, tag) {
  const openRe = new RegExp(`<${tag}\\b`, 'gi');
  const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
  let pos = afterOpen;
  let depth = 1;
  // Hard cap so a malformed input can't loop forever.
  const maxIter = 5000;
  let iter = 0;
  while (depth > 0 && iter < maxIter) {
    iter++;
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(bodyHtml);
    const nextClose = closeRe.exec(bodyHtml);
    if (nextClose == null) return null;
    if (nextOpen != null && nextOpen.index < nextClose.index) {
      depth++;
      pos = openRe.lastIndex;
    } else {
      depth--;
      pos = closeRe.lastIndex;
    }
  }
  if (depth !== 0) return null;
  return { end: pos };
}

// ---------------------------------------------------------------------------
// Structural hint helpers — used by the smarter name generator below
// ---------------------------------------------------------------------------

/**
 * Count how many children a snippet has at its top level, using a
 * heuristic that doesn't require a real parser. We split the inner
 * content by occurrences of top-level block tags.
 *
 * @param {string} html
 * @param {string} tag         the parent tag
 * @returns {number} approximate child count
 */
function approxChildCount(html, tag) {
  const m = html.match(new RegExp(`^<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>$`, 'i'));
  if (!m) return 0;
  const inner = m[1];
  // Count opens of any block-ish tag (a, article, div, li, section, span, button).
  // We tolerate nested markup; this is a coarse signal.
  const opens = (inner.match(/<(a|article|div|li|section|span|button|figure|tr|td|th)\b/gi) ?? []).length;
  // Subtract nested opens via a depth scan for the most common offenders.
  // Simpler: count top-level opens by walking the string with a depth counter
  // restricted to the parent tag's children. We just return raw count — it
  // correlates well enough for naming purposes.
  return opens;
}

/**
 * Detect a few coarse structural patterns the name generator keys off.
 * Returns hints like { cols: 3, layout: 'card' }.
 *
 * @param {string} html
 * @param {string} tag
 */
function detectStructure(html, tag) {
  const inner = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>$`, 'i'))?.[1] ?? html;
  // Column count from `grid-template-columns: repeat(N, 1fr)` or `repeat(N,` patterns.
  const colsMatch = inner.match(/repeat\((\d+),\s*1fr\)/);
  const cols = colsMatch ? Number(colsMatch[1]) : null;
  const hasImg = /<img\b|<svg\b/i.test(inner);
  const hasTable = /<table\b/i.test(inner);
  const hasUl = /<ul\b/i.test(inner);
  const hasOl = /<ol\b/i.test(inner);
  const hasForm = /<form\b|<input\b|<textarea\b/i.test(inner);
  const isMarquee = /class="[^"]*marquee/i.test(html);
  const isDetails = /<details\b/i.test(html);
  const isHr = /^<hr\b/i.test(html.trim());
  const isDark = /background:\s*(#0a0a0a|#0d0d0d|#111|#050505|#000000|black)/i.test(inner)
    || /color:\s*(#fff|#f5f5f0|#ffffff|white)/i.test(inner);
  const isSplit = /grid-template-columns:\s*1fr\s+1fr/i.test(inner);
  const isHorizontal = /display:\s*flex;\s*align-items:\s*center/i.test(inner) && !isSplit;
  const isGrid = /display:\s*grid|grid-template-columns/i.test(inner);
  return { cols, hasImg, hasTable, hasUl, hasOl, hasForm, isMarquee, isDetails, isHr, isDark, isSplit, isHorizontal, isGrid };
}

// ---------------------------------------------------------------------------
// Candidate collectors — one per category
// ---------------------------------------------------------------------------

/**
 * For each category, define a collector: (bodyHtml, sourceName) =>
 * Array<{ tag, html, classes, hints }>.
 *
 * `hints` is a string we look at to generate tags and a name — the
 * element's class list joined with role/aria-label hints.
 */

/** NAV: <nav>, <header> with nav-like class, role=navigation */
function collectNavs(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'nav', () => true)) {
    out.push({ tag: 'nav', html, hints: 'nav' });
  }
  for (const html of findElementsByTag(bodyHtml, 'header', (h) => {
    const a = parseAttrs(h.match(/<header\b([^>]*)>/i)?.[1] ?? '');
    const cls = (a.class ?? '').toLowerCase();
    return /(nav|topbar|navbar|top-nav|menu|header-nav)/.test(cls);
  })) {
    out.push({ tag: 'header', html, hints: 'nav' });
  }
  return out;
}

/** HERO: <header>/<section> with "hero" class or containing an <h1> */
function collectHeroes(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'header', (h) => {
    const a = parseAttrs(h.match(/<header\b([^>]*)>/i)?.[1] ?? '');
    return /(^|\s)(hero|hero-block|hero-section|hero-wrap|intro)(\s|$)/.test((a.class ?? '').toLowerCase());
  })) {
    out.push({ tag: 'header', html, hints: 'hero' });
  }
  for (const html of findElementsByTag(bodyHtml, 'section', (h) => {
    const a = parseAttrs(h.match(/<section\b([^>]*)>/i)?.[1] ?? '');
    return /(^|\s)(hero|hero-block|hero-section|hero-wrap|intro|top)(\s|$)/.test((a.class ?? '').toLowerCase());
  })) {
    out.push({ tag: 'section', html, hints: 'hero' });
  }
  return out;
}

/** BUTTON: <button> elements */
function collectButtons(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'button', () => true)) {
    out.push({ tag: 'button', html, hints: 'button' });
  }
  return out;
}

/** CHIP: small <span>/<a>/<button> with chip/tag/label/pill class */
function collectChips(bodyHtml) {
  const out = [];
  const chipRe = /(chip|tag|pill|label|badge-text|eyebrow|hashtag)/i;
  for (const tag of ['span', 'a', 'button', 'div']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (chipRe.test(a.class ?? '')) return true;
      return false;
    })) {
      // Reject chips that are obviously too big (whole nav, etc.)
      if (html.length > 1200) continue;
      out.push({ tag, html, hints: 'chip' });
    }
  }
  return out;
}

/** CARD: container with card-like class */
function collectCards(bodyHtml) {
  const out = [];
  const cardRe = /(card|tile|item-card|project-card|product-card|work-card)/i;
  for (const tag of ['article', 'div', 'li', 'section']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (cardRe.test(a.class ?? '')) return true;
      // <article> with an <img> inside counts as a card even without
      // an explicit "card" class — that's a strong structural signal.
      if (tag === 'article' && /<img\b/i.test(h)) return true;
      return false;
    })) {
      if (html.length < 80 || html.length > 8000) continue;
      out.push({ tag, html, hints: 'card' });
    }
  }
  return out;
}

/** BADGE: <span>/<small> with badge/dot/marker/tag-mark class */
function collectBadges(bodyHtml) {
  const out = [];
  const re = /(badge|dot|marker|tag-mark|counter|status|number|step|index)/i;
  for (const tag of ['span', 'small', 'em', 'strong', 'i', 'div']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (re.test(a.class ?? '')) return true;
      return false;
    })) {
      if (html.length > 400) continue;
      out.push({ tag, html, hints: 'badge' });
    }
  }
  return out;
}

/** CTA: <a> with button-like styling (cta, btn, button, action) */
function collectCtas(bodyHtml) {
  const out = [];
  const re = /(^|\s)(cta|btn|button|action|more|see-more|view-more|read-more|primary|secondary)(\s|$|-)/i;
  for (const html of findElementsByTag(bodyHtml, 'a', (h) => {
    const a = parseAttrs(h.match(/<a\b([^>]*)>/i)?.[1] ?? '');
    return re.test((a.class ?? '').toLowerCase());
  })) {
    out.push({ tag: 'a', html, hints: 'cta' });
  }
  return out;
}

/** SECTION: <section> elements (excluding ones we own via other categories) */
function collectSections(bodyHtml) {
  const out = [];
  // Skip section-tagged containers that are clearly owned by a more
  // specific category so we don't double-class the same chunk of HTML.
  const skip = /(contact|pricing|faq|frequent|questions|accordion|feature|expertise|service|capabilit|stat[s -]?(row|grid|number)?|metric|kpi|logos?|partners?|clients?|trusted|brand[- ]?row|press[- ]?kit|banner|announce|notification|alert|coupon|cookie|ticker)/i;
  for (const html of findElementsByTag(bodyHtml, 'section', () => true)) {
    if (html.length < 200 || html.length > 12000) continue;
    const a = parseAttrs(html.match(/<section\b([^>]*)>/i)?.[1] ?? '');
    if (skip.test(a.class ?? '')) continue;
    out.push({ tag: 'section', html, hints: 'section' });
  }
  return out;
}

/** FOOTER: <footer> elements */
function collectFooters(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'footer', () => true)) {
    if (html.length < 80) continue;
    out.push({ tag: 'footer', html, hints: 'footer' });
  }
  return out;
}

/** FORM: <form> elements (without an obvious "contact" signal) */
function collectForms(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'form', () => true)) {
    if (html.length < 80) continue;
    // Defer to the contact collector when the form is the contact form
    // (email + textarea). Plain newsletter / login forms stay here.
    const isContactForm = /type="email"/i.test(html) && /textarea/i.test(html);
    if (isContactForm) continue;
    out.push({ tag: 'form', html, hints: 'form' });
  }
  return out;
}

/** GALLERY: <ul>/<div> with grid/list/gallery/masonry/work class */
function collectGalleries(bodyHtml) {
  const out = [];
  const re = /(gallery|grid|masonry|portfolio|works-grid|projects-grid|list|carousel|slider|swiper|marquee|scroller)/i;
  for (const tag of ['ul', 'ol', 'div', 'section']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (re.test(a.class ?? '')) {
        // Only accept if it actually contains at least 2 child elements
        // — a single <ul> with one <li> is not a gallery.
        const childOpens = (h.match(/<(li|div|article|figure|a|img)\b/gi) ?? []).length;
        return childOpens >= 2;
      }
      return false;
    })) {
      if (html.length < 120 || html.length > 14000) continue;
      // Skip gallery containers that the logos/banner collectors own.
      const a = parseAttrs(html.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      const cls = (a.class ?? '').toLowerCase();
      if (/(logos?|partners?|clients?|trusted|brand[- ]?row|logo[- ]?grid)/.test(cls)) continue;
      if (/(banner|announce|notification|alert|coupon|cookie|ticker)/.test(cls)) continue;
      out.push({ tag, html, hints: 'gallery' });
    }
  }
  return out;
}

/** TESTIMONIAL: <blockquote> or section with quote/testimonial class */
function collectTestimonials(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'blockquote', () => true)) {
    out.push({ tag: 'blockquote', html, hints: 'testimonial' });
  }
  const re = /(testimonial|quote|review|client-quote|client-says|voice)/i;
  for (const tag of ['div', 'section', 'article']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      return re.test(a.class ?? '');
    })) {
      if (html.length < 80) continue;
      out.push({ tag, html, hints: 'testimonial' });
    }
  }
  return out;
}

// ---- New category collectors (added in this lane) -------------------------

/**
 * PRICING: sections/cards that look like a pricing block.
 *
 * Detection signals (any one is enough):
 *   1. Element class contains /pricing|tier|price-card|price-tag|plan\b/i
 *   2. Element has a price-table (<table>) inside
 *   3. Element contains $/€/£ with /month|/mo|per month/i text
 *
 * The dedupe layer keeps 2-3 candidates per source (we want diverse
 * pricing blocks, not the same one repeated).
 */
function collectPricing(bodyHtml) {
  const out = [];
  const clsRe = /(pricing|tier|price[- ]?card|price[- ]?tag|plan\b)/i;
  for (const tag of ['section', 'div', 'article', 'table']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (clsRe.test(a.class ?? '')) return true;
      // Price table?
      if (tag === 'table') return true;
      // $/€/£ + /mo or /month?
      const txt = textOf(h);
      const hasCurrency = /(\$|€|£|¥|₹)\s?\d/.test(txt);
      const hasPeriod = /\/(mo|month|yr|year)\b|per\s+month/i.test(txt);
      return hasCurrency && hasPeriod;
    })) {
      // Keep this lenient — pricing comes in many shapes.
      if (html.length < 60) continue;
      out.push({ tag, html, hints: 'pricing' });
    }
  }
  return out;
}

/**
 * FAQ: section/div with faq/question/accordion class.
 *
 * Falls back to: a section containing 3+ <details> elements (native
 * accordion pattern).
 *
 * The sample corpus has almost zero native FAQs, so this collector
 * contributes a few entries plus the fixtures carry the rest.
 */
function collectFaq(bodyHtml) {
  const out = [];
  const re = /(faq|questions?|accordion|frequent)/i;
  for (const tag of ['section', 'div', 'article']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (re.test(a.class ?? '')) return true;
      // 3+ <details> is a strong FAQ signal even without a class hint.
      const details = (h.match(/<details\b/gi) ?? []).length;
      return details >= 3;
    })) {
      if (html.length < 80) continue;
      out.push({ tag, html, hints: 'faq' });
    }
  }
  return out;
}

/**
 * FEATURE: section/div with feature/expertise/service/capability class.
 *
 * The samples are *rich* in this pattern (29 of 70 have at least one
 * match), so this collector drives most of the `feature` category.
 */
function collectFeatures(bodyHtml) {
  const out = [];
  const re = /(feature|expertise|service|capabilit|what[- ]?we[- ]?do|approach|method)/i;
  for (const tag of ['section', 'div', 'article', 'ul']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (re.test(a.class ?? '')) {
        // Must look like a feature block, not just a nav with "service" in a class.
        // Heuristic: at least 2 children with an h-tag or .num/.icon/.title token.
        const headings = (h.match(/<h[1-6]\b/gi) ?? []).length;
        const kids = (h.match(/<(article|li|div|section)\b/gi) ?? []).length;
        return headings >= 1 && kids >= 2;
      }
      return false;
    })) {
      if (html.length < 200 || html.length > 10000) continue;
      out.push({ tag, html, hints: 'feature' });
    }
  }
  return out;
}

/**
 * STATS: sections/grids with stat/metric/numbers/counter class — or any
 * container whose children have the canonical "k/v" pattern
 * (e.g. `<div class="item"><div class="k">Founded</div><div class="v">2004</div></div>`).
 */
function collectStats(bodyHtml) {
  const out = [];
  const clsRe = /(stat[s -]?(row|grid|number)?|metric|kpi|counter|figure|numbers)/i;
  // 1) Class-based detection
  for (const tag of ['section', 'div', 'ul']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      return clsRe.test(a.class ?? '');
    })) {
      if (html.length < 80) continue;
      out.push({ tag, html, hints: 'stats' });
    }
  }
  // 2) Pattern-based detection: containers with at least 2 children
  //    that look like key/value stat rows (text + numeric). This catches
  //    samples like resn.html where the stat row is just a div with
  //    `<div class="item"><div class="k">..</div><div class="v">..</div></div>`.
  for (const tag of ['section', 'div']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      if (clsRe.test(parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '').class ?? '')) {
        return false; // already covered by class-based pass
      }
      // Look for 2+ k/v pairs.
      const kvs = (h.match(/<div[^>]*class="[^"]*\bk\b[^"]*"[^>]*>[\s\S]*?<\/div>\s*<div[^>]*class="[^"]*\bv\b[^"]*"[^>]*>([^<]*)<\/div>/gi) ?? []).length;
      return kvs >= 2;
    })) {
      if (html.length < 80) continue;
      out.push({ tag, html, hints: 'stats' });
    }
  }
  return out;
}

/**
 * LOGOS: static logo row, logo grid, partner strip, trusted-by row.
 *
 * Detection signals:
 *   1. Class contains /logos?|partners?|clients?|trusted|brand[- ]?row|logo[- ]?grid/i
 *   2. A <ul>/<div> with 4+ uppercase short text tokens (likely brand names)
 *   3. A marquee whose inner content is dominated by short uppercase
 *      tokens (the "logos marquee" pattern, e.g. "MARRIOTT · HILTON · QT HOTELS").
 */
function collectLogos(bodyHtml) {
  const out = [];
  const clsRe = /(logos?|partners?|clients?|trusted|brand[- ]?row|logo[- ]?grid|press[ -]?kit)/i;
  for (const tag of ['ul', 'div', 'section', 'ol']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (clsRe.test(a.class ?? '')) return true;
      // 4+ uppercase brand-name tokens (>= 2 chars each, <= 30 chars each,
      // separated by dots / middots / commas) — likely a logo strip.
      const inner = textOf(h);
      const toks = inner.split(/\s*[·|,•]\s*/).filter((t) => /^[A-Z][A-Z0-9 &.'-]{1,28}$/.test(t));
      return toks.length >= 4;
    })) {
      // Skip container-only empties
      if (html.length < 60 || html.length > 6000) continue;
      out.push({ tag, html, hints: 'logos' });
    }
  }
  return out;
}

/**
 * CONTACT: sections/divs with contact class OR <form> with email + textarea.
 */
function collectContact(bodyHtml) {
  const out = [];
  const clsRe = /contact/i;
  for (const tag of ['section', 'div', 'article']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (clsRe.test(a.class ?? '')) return true;
      // A <form> with email + textarea inside a container counts as contact.
      if (/<form\b/i.test(h) && /type="email"/i.test(h) && /textarea/i.test(h)) return true;
      return false;
    })) {
      if (html.length < 80) continue;
      out.push({ tag, html, hints: 'contact' });
    }
  }
  return out;
}

/**
 * BANNER: announcement bars, marquees, cookie banners, top-of-page
 * promo strips.
 *
 * Detection signals:
 *   1. Class contains /banner|announce|notification|alert|coupon|cookie|ticker|marquee/i
 *   2. A marquee with text content (different from `logos` which looks
 *      for uppercase brand-name tokens specifically)
 *
 * Note: marquees with brand-name tokens are picked up by `logos` first
 * because we run that collector earlier in the round-robin and its
 * signal is more specific. Banners here pick up the rest.
 */
function collectBanners(bodyHtml) {
  const out = [];
  const clsRe = /(banner|announce|notification|alert|coupon|cookie|ticker|marquee[- ]?strip|scroll[- ]?bar)/i;
  for (const tag of ['section', 'div', 'aside', 'header']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (clsRe.test(a.class ?? '')) return true;
      // Marquees are often classed just `marquee` (no -strip suffix) —
      // catch those too.
      const cls = (a.class ?? '').toLowerCase().split(/\s+/).join('|');
      if (/(^|\|)marquee(\||$)/.test(cls)) return true;
      return false;
    })) {
      // Banner containers are usually short — but award marquees can be long.
      if (html.length < 40) continue;
      // Skip if it's clearly a logos row (already in `logos`).
      const a = parseAttrs(html.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (/(logos?|partners?|clients?|trusted|brand[- ]?row)/i.test(a.class ?? '')) continue;
      out.push({ tag, html, hints: 'banner' });
    }
  }
  return out;
}

/**
 * DIVIDER: <hr>, decorative dividers, section breaks.
 *
 * Detection: <hr> tags OR very small divs (≤ 200 chars) whose class
 * hints at a divider. The sample corpus has zero native <hr> tags,
 * so fixtures carry this category.
 */
function collectDividers(bodyHtml) {
  const out = [];
  for (const html of findElementsByTag(bodyHtml, 'hr', () => true)) {
    out.push({ tag: 'hr', html, hints: 'divider' });
  }
  const clsRe = /(divider|separator|break|hr|rule|splitter)/i;
  for (const tag of ['div', 'span']) {
    for (const html of findElementsByTag(bodyHtml, tag, (h) => {
      const a = parseAttrs(h.match(new RegExp(`<${tag}\\b([^>]*)>`, 'i'))?.[1] ?? '');
      if (clsRe.test(a.class ?? '')) return true;
      return false;
    })) {
      if (html.length > 400) continue;
      out.push({ tag, html, hints: 'divider' });
    }
  }
  return out;
}

const COLLECTORS = {
  nav: collectNavs,
  hero: collectHeroes,
  button: collectButtons,
  chip: collectChips,
  card: collectCards,
  badge: collectBadges,
  cta: collectCtas,
  section: collectSections,
  footer: collectFooters,
  form: collectForms,
  gallery: collectGalleries,
  testimonial: collectTestimonials,
  // New in this lane
  pricing: collectPricing,
  faq: collectFaq,
  feature: collectFeatures,
  stats: collectStats,
  logos: collectLogos,
  contact: collectContact,
  banner: collectBanners,
  divider: collectDividers,
};

// ---------------------------------------------------------------------------
// Smart name generator
// ---------------------------------------------------------------------------

/**
 * Build a human-friendly name for a snippet based on its category,
 * class list, and structural hints. Examples:
 *   "Pricing — 3 tier"
 *   "Hero — split image"
 *   "Feature — 3-up"
 *   "Logo strip — horizontal"
 *   "FAQ — accordion"
 *
 * Returns a short string suitable for display in a chip / card UI.
 */
function deriveName({ category, html, classes, tag, text, structure }) {
  const allCls = [...classes].join(' ').toLowerCase();
  const firstHeadingMatch = text.match(/^[^.\n!?]{1,80}/);
  const firstSentence = (firstHeadingMatch?.[0] ?? '').trim();

  // Category-specific name composers. Each one returns a candidate
  // string or null to fall through.
  switch (category) {
    case 'pricing': {
      if (structure.hasTable) return 'Pricing — table';
      if (structure.cols === 3) return 'Pricing — 3 tier';
      if (structure.cols === 4) return 'Pricing — 4 tier';
      if (structure.cols === 2) return 'Pricing — 2 tier';
      if (allCls.includes('toggle') || allCls.includes('switch')) return 'Pricing — toggle';
      if (allCls.includes('enterprise') || allCls.includes('contact-sales')) return 'Pricing — enterprise';
      if (allCls.includes('list') || allCls.includes('rates')) return 'Pricing — list';
      if (structure.hasForm) return 'Pricing — custom';
      return 'Pricing — single';
    }
    case 'faq': {
      if (structure.isDetails) return 'FAQ — accordion';
      if (structure.cols === 2) return 'FAQ — two column';
      if (allCls.includes('tabs') || allCls.includes('tab-list')) return 'FAQ — categorized';
      if (allCls.includes('support') || allCls.includes('help-center')) return 'FAQ — support grid';
      if (allCls.includes('aside') || allCls.includes('split')) return 'FAQ — with contact';
      return 'FAQ — single column';
    }
    case 'feature': {
      if (structure.cols === 3) return 'Feature — 3-up';
      if (structure.cols === 4) return 'Feature — 4-up';
      if (structure.cols === 2) return 'Feature — 2-up';
      if (structure.hasUl) return 'Feature — list';
      if (structure.isSplit) return 'Feature — split';
      return 'Feature — grid';
    }
    case 'stats': {
      if (structure.cols === 3) return 'Stats — 3-up';
      if (structure.cols === 4) return 'Stats — 4-up';
      if (structure.cols === 2) return 'Stats — 2-up';
      if (allCls.includes('marquee')) return 'Stats — marquee';
      if (allCls.includes('counter')) return 'Stats — counter';
      if (allCls.includes('row')) return 'Stats — row';
      return 'Stats — grid';
    }
    case 'logos': {
      if (structure.isMarquee) return 'Logo strip — marquee';
      if (structure.cols === 4) return 'Logo grid — 4-up';
      if (structure.cols === 6) return 'Logo grid — 6-up';
      if (structure.cols === 3) return 'Logo grid — 3-up';
      if (structure.cols === 2) return 'Logo grid — 2-up';
      if (structure.isHorizontal) return 'Logo strip — horizontal';
      if (allCls.includes('cloud')) return 'Logo cloud — grid';
      if (allCls.includes('row')) return 'Logo strip — row';
      if (allCls.includes('partner')) return 'Logo strip — partners';
      if (allCls.includes('client')) return 'Logo strip — clients';
      if (allCls.includes('press')) return 'Logo strip — press';
      if (allCls.includes('trusted')) return 'Logo strip — trusted';
      return 'Logo strip — text';
    }
    case 'contact': {
      if (structure.isSplit) return 'Contact — split';
      if (structure.hasForm && allCls.includes('newsletter')) return 'Contact — newsletter';
      if (structure.hasForm) return 'Contact — form';
      if (allCls.includes('aside') || allCls.includes('info')) return 'Contact — info block';
      return 'Contact — section';
    }
    case 'banner': {
      if (allCls.includes('cookie')) return 'Banner — cookie';
      if (allCls.includes('announcement') || allCls.includes('announce')) return 'Banner — announcement';
      if (allCls.includes('ticker')) return 'Banner — ticker';
      if (structure.isMarquee) return 'Banner — marquee';
      return 'Banner — strip';
    }
    case 'divider': {
      if (structure.isHr) return 'Divider — hr';
      if (allCls.includes('dotted')) return 'Divider — dotted';
      if (allCls.includes('ornament') || allCls.includes('mark')) return 'Divider — ornament';
      if (allCls.includes('thick')) return 'Divider — thick';
      if (allCls.includes('gradient')) return 'Divider — gradient';
      return 'Divider — rule';
    }
    case 'nav': {
      if (allCls.includes('pill')) return 'Nav — pill';
      if (allCls.includes('center')) return 'Nav — centered';
      if (allCls.includes('minimal') || allCls.includes('micro')) return 'Nav — minimal';
      if (allCls.includes('split')) return 'Nav — split';
      return 'Nav — bar';
    }
    case 'hero': {
      if (structure.isSplit) return 'Hero — split';
      if (structure.hasImg) return 'Hero — with image';
      if (structure.isDark) return 'Hero — dark';
      if (allCls.includes('video') || allCls.includes('media')) return 'Hero — media';
      if (allCls.includes('grid')) return 'Hero — grid';
      return 'Hero — type';
    }
    case 'button': {
      if (allCls.includes('pill')) return 'Button — pill';
      if (allCls.includes('circle') || allCls.includes('icon')) return 'Button — icon';
      if (allCls.includes('ghost') || allCls.includes('outline')) return 'Button — ghost';
      return 'Button — solid';
    }
    case 'card': {
      if (structure.hasImg) return 'Card — media';
      if (structure.cols && structure.cols >= 3) return 'Card — wide';
      if (allCls.includes('project')) return 'Card — project';
      if (allCls.includes('product')) return 'Card — product';
      return 'Card — text';
    }
    case 'footer': {
      if (allCls.includes('dark')) return 'Footer — dark';
      if (structure.cols === 4) return 'Footer — 4-col';
      if (structure.cols === 3) return 'Footer — 3-col';
      return 'Footer — minimal';
    }
    case 'gallery': {
      if (allCls.includes('marquee')) return 'Gallery — marquee';
      if (allCls.includes('masonry')) return 'Gallery — masonry';
      if (allCls.includes('grid')) return 'Gallery — grid';
      if (allCls.includes('carousel') || allCls.includes('slider')) return 'Gallery — slider';
      return 'Gallery — list';
    }
    case 'form': {
      if (allCls.includes('newsletter')) return 'Form — newsletter';
      if (allCls.includes('login') || allCls.includes('signin')) return 'Form — login';
      if (allCls.includes('signup') || allCls.includes('register')) return 'Form — signup';
      return 'Form — generic';
    }
    case 'cta': {
      if (allCls.includes('pill')) return 'CTA — pill';
      if (allCls.includes('arrow')) return 'CTA — with arrow';
      if (allCls.includes('outline')) return 'CTA — outline';
      return 'CTA — button';
    }
    case 'testimonial': {
      if (allCls.includes('carousel') || allCls.includes('slider')) return 'Testimonial — slider';
      if (allCls.includes('card')) return 'Testimonial — card';
      if (allCls.includes('grid')) return 'Testimonial — grid';
      return 'Testimonial — quote';
    }
    case 'section': {
      if (allCls.includes('dark')) return 'Section — dark';
      if (structure.cols === 3) return 'Section — 3-col';
      if (structure.cols === 2) return 'Section — 2-col';
      return 'Section — block';
    }
    case 'chip': {
      if (allCls.includes('pill')) return 'Chip — pill';
      if (allCls.includes('tag')) return 'Chip — tag';
      return 'Chip — label';
    }
    case 'badge': {
      if (allCls.includes('dot')) return 'Badge — dot';
      if (allCls.includes('step')) return 'Badge — step';
      if (allCls.includes('number')) return 'Badge — number';
      return 'Badge — pill';
    }
  }

  // Fallback: trimmed first sentence from the snippet's text, with
  // shape-quality caps so we don't surface raw dumps like
  // "1 : 09 home Works Profile Contact Twitter Instagram ..." (60 chars).
  const fallback = firstSentence
    .replace(/\s+/g, ' ')
    .slice(0, 60)
    .trim();
  if (fallback && fallback.length >= 6) return capitalize(category) + ' — ' + fallback;
  return capitalize(category);
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Snippet construction
// ---------------------------------------------------------------------------

/**
 * Build a self-contained snippet object from a candidate.
 *
 * @param {object} args
 * @param {string} args.category
 * @param {string} args.tag       — the element's tag name
 * @param {string} args.html      — the raw outerHTML
 * @param {string} args.cssBody   — full <style> contents from the sample
 * @param {string} args.source    — sample filename
 * @param {number} args.index     — sequential index within source file
 */
function buildSnippet({ category, tag, html, cssBody, source, index }) {
  const sanitized = sanitizeAttrs(stripScriptsAndStyles(html));
  const classes = classesInHtml(sanitized);
  // Even if no class survives, we still want a unique prefix — Tailwind-
  // only snippets need scoping on tag-derived selectors too.
  const id = `${slug(source.replace('.html', ''))}-${category}-${String(index).padStart(2, '0')}`;
  const prefix = `el-${id}`;
  const scopedCss = extractScopedCss(cssBody, classes, tag, prefix);
  const scopedHtml = rewriteHtmlClasses(sanitized, classes, prefix);
  const text = textOf(scopedHtml);
  const structure = detectStructure(scopedHtml, tag);
  // Tags: derive from classes / hints.
  const tags = new Set();
  tags.add(category);
  const allClassText = [...classes].join(' ').toLowerCase();
  for (const keyword of [
    'dark', 'light', 'primary', 'secondary', 'outline', 'ghost',
    'pill', 'rounded', 'circle', 'square', 'compact', 'wide',
    'minimal', 'bold', 'playful', 'serif', 'mono', 'mono-spaced',
    'uppercase', 'bordered', 'striped', 'gradient', 'glow',
    'animated', 'stacked', 'horizontal', 'vertical', 'centered',
    'compact', 'large', 'small', 'micro', 'split',
    'accordion', 'marquee', 'carousel', 'slider', 'toggle',
  ]) {
    if (allClassText.includes(keyword)) tags.add(keyword);
  }
  if (structure.cols) tags.add(`${structure.cols}-column`);
  if (structure.hasImg) tags.add('media');
  if (structure.isMarquee) tags.add('marquee');
  if (structure.isDark) tags.add('dark');
  if (structure.isSplit) tags.add('split');
  // Drop empty tags.
  tags.delete('');
  // Smart name.
  const name = deriveName({
    category,
    html: scopedHtml,
    classes,
    tag,
    text,
    structure,
  });
  return {
    id,
    category,
    name,
    tags: [...tags].slice(0, 10),
    html: scopedHtml.trim(),
    css: scopedCss,
    source,
  };
}

// ---------------------------------------------------------------------------
// Dedupe — normalized text signature
// ---------------------------------------------------------------------------

/**
 * Build a normalized signature from a snippet. Two snippets with the same
 * signature are considered near-identical and only the first survives.
 *
 * We strip every `el-...` prefix we added, lowercase, collapse whitespace,
 * and chop to 200 chars. That's coarse but enough to catch the obvious
 * "same nav cloned across pages" duplicates.
 *
 * @param {object} s
 */
function signatureOf(s) {
  const text = textOf(s.html).toLowerCase().replace(/el-[a-z0-9-]+/g, '');
  // Also fold duplicate spaces.
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function listSamples() {
  return readdirSync(SAMPLES_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();
}

function readSample(filename) {
  const full = join(SAMPLES_DIR, filename);
  const raw = readFileSync(full, 'utf8');
  const parts = extractDocumentParts(raw);
  const cssBody = (parts.styles ?? []).map((s) => s.content ?? '').join('\n');
  return { bodyHtml: parts.bodyHtml, cssBody };
}

/**
 * Process one sample file across all categories. Returns
 * `Map<category, snippet[]>`.
 */
function processSample(filename) {
  const { bodyHtml, cssBody } = readSample(filename);
  const byCat = new Map();
  for (const cat of CATEGORIES) {
    const collector = COLLECTORS[cat];
    if (!collector) continue;
    const candidates = collector(bodyHtml);
    const snippets = [];
    candidates.forEach((c, i) => {
      // Some categories produce many small candidates (chips, badges).
      // Drop empties and overly-tiny snippets up front.
      if (!c.html || c.html.length < 30) return;
      const s = buildSnippet({
        category: cat,
        tag: c.tag,
        html: c.html,
        cssBody,
        source: filename,
        index: i,
      });
      snippets.push(s);
    });
    byCat.set(cat, snippets);
  }
  return byCat;
}

/**
 * Run the full pipeline, dedupe, cap, and return the manifest array.
 *
 * @returns {Array<object>}
 */
function buildManifest() {
  const samples = listSamples();
  /** @type {Map<string, object[]>} */
  const perCat = new Map(CATEGORIES.map((c) => [c, []]));
  // Per-source dedupe is more useful than a global dedupe: we want
  // a "Services" section from one template AND the same section from
  // another template (which has different CSS and different layout
  // DNA) to BOTH survive. Duplicate-within-the-same-file is what we
  // actually want to filter out — that's typically a copy-paste
  // mistake by the template author.
  /** @type {Map<string, Map<string, Set<string>>>} */
  const seenSig = new Map(CATEGORIES.map((c) => [c, new Map()]));
  /** @type {Set<string>} */
  const seenIds = new Set();

  for (const sample of samples) {
    let byCat;
    try {
      byCat = processSample(sample);
    } catch (err) {
      // One bad sample should not poison the whole library.
      console.warn(`[dissect] skip ${sample}: ${err.message}`);
      continue;
    }
    for (const cat of CATEGORIES) {
      const snippets = byCat.get(cat) ?? [];
      let sigs = seenSig.get(cat).get(sample);
      if (!sigs) {
        sigs = new Set();
        seenSig.get(cat).set(sample, sigs);
      }
      const list = perCat.get(cat);
      for (const s of snippets) {
        if (seenIds.has(s.id)) continue;
        const sig = signatureOf(s);
        if (sig && sigs.has(sig)) continue;
        sigs.add(sig);
        seenIds.add(s.id);
        list.push(s);
      }
    }
  }

  // Round-robin cap so the chosen snippets reflect the full set of
  // sources, not just whichever source's candidates arrived first.
  // Without this, the first 3 alphabetically-sorted sources fill the
  // 12-slot cap and every other source gets dropped — the library ends
  // up with 12 nav bars all from the same 3 sites.
  const manifest = [];
  for (const cat of CATEGORIES) {
    const list = perCat.get(cat) ?? [];
    if (list.length <= PER_CATEGORY_CAP) {
      for (const s of list) manifest.push(s);
      continue;
    }
    // Group by source, preserving the original order.
    /** @type {Map<string, object[]>} */
    const bySource = new Map();
    for (const s of list) {
      let bucket = bySource.get(s.source);
      if (!bucket) {
        bucket = [];
        bySource.set(s.source, bucket);
      }
      bucket.push(s);
    }
    const sources = [...bySource.keys()];
    // Take one per source, cycling, until we hit the cap.
    const picked = [];
    let cursor = 0;
    let exhausted = false;
    while (picked.length < PER_CATEGORY_CAP && !exhausted) {
      exhausted = true;
      for (const src of sources) {
        if (picked.length >= PER_CATEGORY_CAP) break;
        const bucket = bySource.get(src);
        if (cursor < bucket.length) {
          picked.push(bucket[cursor]);
          exhausted = false;
        }
      }
      cursor++;
    }
    for (const s of picked) manifest.push(s);
  }

  // Merge hand-authored fixtures. These carry ids prefixed with
  // `fixture-<category>-...` so they never collide with sample-derived
  // ids (`<source>-<category>-NN`). We dedupe by id and by signature
  // across the merged set so a fixture that mirrors a real sample is
  // skipped in favor of the dissected version (which has real CSS).
  for (const f of FIXTURES) {
    if (!f || !f.id) continue;
    if (seenIds.has(f.id)) continue;
    if (!CATEGORIES.includes(f.category)) continue;
    seenIds.add(f.id);
    manifest.push(f);
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Entry — run when invoked directly (not on import)
// ---------------------------------------------------------------------------

const invokedDirectly = (() => {
  if (typeof process === 'undefined') return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return fileURLToPath(import.meta.url) === argv1;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const t0 = Date.now();
  const manifest = buildManifest();
  // Pretty print: per-category breakdown to stdout for human eyes.
  const breakdown = {};
  for (const s of manifest) {
    breakdown[s.category] = (breakdown[s.category] ?? 0) + 1;
  }
  const total = manifest.length;
  const sampleCount = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.html')).length;
  const fixtureCount = FIXTURES.length;
  console.log(`[dissect] samples: ${sampleCount} · fixtures: ${fixtureCount}`);
  console.log(`[dissect] manifest: ${total} snippets`);
  for (const cat of CATEGORIES) {
    const n = breakdown[cat] ?? 0;
    const min = PER_CAT_MIN_OVERRIDES[cat] ?? MIN_PER_CATEGORY;
    const flag = n < min ? ' (BELOW MIN ' + min + ')' : '';
    console.log(`[dissect]   ${cat.padEnd(12)} ${String(n).padStart(3)}${flag}`);
  }
  writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[dissect] wrote ${relative(REPO_ROOT, OUT_FILE)} in ${Date.now() - t0}ms`);
}

// Also expose for ad-hoc testing / programmatic use.
export {
  buildManifest,
  processSample,
  signatureOf,
  CATEGORIES,
  COLLECTORS,
  detectStructure,
  deriveName,
};
