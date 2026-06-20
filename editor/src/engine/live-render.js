/**
 * @file Faithful live-render pipeline — turns imported site source into a
 *       pixel-identical live document for an `<iframe srcdoc>`.
 *
 *       The product's killer feature is "Edit Live Site": the canvas renders
 *       a stood-up website *as it would serve*, with all scripts running,
 *       stylesheets loading, fonts and animations live. This module is the
 *       headless engine that produces that iframe document. Other lanes add
 *       the editing overlay on top; this lane is deliberately UI-free.
 *
 *       Three public functions:
 *
 *         extractDocumentParts(rawHtml)
 *           Split a raw HTML document into its preserved parts so the
 *           renderer can re-emit a faithful live document without
 *           stripping `<script>` tags, `<style>` blocks, or external
 *           `<link rel="stylesheet">` references.
 *
 *         rewriteAssetUrls(html, assetMap)
 *           Pure string transform that rewrites relative `src`/`href`/
 *           `url(...)` references in an HTML string against a caller-
 *           supplied `{ "relative/path": "blob:..." }` map (folder-import
 *           case). Preserves quotes and the `./` prefix shape.
 *
 *         buildLiveDocument({ html, css?, assets?, title? })
 *           The headline entrypoint. Returns a complete HTML document
 *           string suitable for `iframe.srcdoc`. If `html` is already a
 *           full document, head/body/scripts/styles/links/title are
 *           preserved verbatim. If it's a fragment, it is wrapped in a
 *           minimal HTML shell. Optional `assets` are applied via
 *           rewriteAssetUrls before output.
 *
 *       Stability contract:
 *         - Pure functions: no DOM, no globals, no I/O. Safe in Node,
 *           browsers, and workers. Side-effect-free.
 *         - Dependency-free (only ESM + JSDoc).
 *         - All exports are JSDoc-typed; no separate `.d.ts`.
 *
 *       Documented limits:
 *         extractDocumentParts is regex-based and dependency-free. It
 *         handles the 99% case of real-world sites but does NOT:
 *           - parse `<script>` tags that contain the literal substring
 *             `</script>` inside a JS string (vanishingly rare; even
 *             browsers handle this as an end-of-script marker, so it
 *             would break the site at runtime anyway).
 *           - parse `<style>` tags that contain the literal substring
 *             `</style>` inside a CSS string (CSS has no such construct
 *             except inside comments, which we don't specially skip).
 *           - validate attribute syntax — quoted and unquoted attribute
 *             values are tolerated; malformed quotes in a `<script
 *             src="...">` would split prematurely.
 *         In all cases the worst the parser does is return a slightly
 *         wrong partition; buildLiveDocument then re-emits a working
 *         document because the contents are still preserved as-is.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default viewport meta — applied when a fragment has none. */
const DEFAULT_VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';

/** Default charset meta — applied when a fragment has none. */
const DEFAULT_CHARSET_META = '<meta charset="UTF-8" />';

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe interpolation inside an HTML double-quoted
 * attribute value. Mirrors the existing editor convention.
 * @param {unknown} str
 * @returns {string}
 */
function escapeHtmlAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a string for safe interpolation inside HTML text content.
 * @param {unknown} str
 * @returns {string}
 */
function escapeHtmlText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * HTML5 void elements — relevant for our self-closing link handling.
 * @type {Set<string>}
 */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ---------------------------------------------------------------------------
// extractDocumentParts — regex-based, dependency-free HTML splitter
// ---------------------------------------------------------------------------

/**
 * Captured script tag — both external (`src`) and inline (`content`).
 * Exactly one of `src` or `content` is set.
 * @typedef {object} ScriptPart
 * @property {string} raw     The original `<script ...>...</script>` text.
 * @property {string|null} src      External URL for `src` scripts, else null.
 * @property {string|null} content  Inline JS for inline scripts, else null.
 * @property {object} attrs         Attribute map (lowercased keys).
 * @property {string} openTag       The opening `<script ...>` portion.
 */

/**
 * Captured style tag.
 * @typedef {object} StylePart
 * @property {string} raw     The original `<style ...>...</style>` text.
 * @property {string} content CSS content of the tag.
 * @property {object} attrs   Attribute map (lowercased keys).
 * @property {string} openTag The opening `<style ...>` portion.
 */

/**
 * Captured link tag.
 * @typedef {object} LinkPart
 * @property {string} raw   The original `<link ... />` text.
 * @property {object} attrs Attribute map (lowercased keys).
 */

/**
 * Captured meta tag.
 * @typedef {object} MetaPart
 * @property {string} raw   The original `<meta ... />` text.
 * @property {object} attrs Attribute map (lowercased keys).
 */

/**
 * Decomposed parts of an HTML document.
 * @typedef {object} DocumentParts
 * @property {string}      doctype   Original `<!doctype...>` or empty string.
 * @property {string}      headHtml  Raw inner HTML of `<head>` (verbatim).
 * @property {string}      bodyHtml  Raw inner HTML of `<body>` (verbatim).
 * @property {string|null} title     `<title>` text content, if present.
 * @property {ScriptPart[]} scripts  All `<script>` tags found (head + body).
 * @property {StylePart[]}  styles   All `<style>` tags found (head + body).
 * @property {LinkPart[]}   links    All `<link>` tags found.
 * @property {MetaPart[]}   metas    All `<meta>` tags found.
 */

/**
 * Parse a single tag's attributes into a lowercased key map. Tolerates
 * double quotes, single quotes, and unquoted values. Boolean attributes
 * are stored as `true`. Returns an empty object if no attributes.
 *
 * @param {string} tagBody  The text inside `<...>` of a tag, e.g. for
 *                          `<a href="x" hidden>` returns `a href="x" hidden`.
 * @returns {object}
 */
function parseAttrs(tagBody) {
  const attrs = {};
  // Match name="value" | name='value' | name=value | name
  // name: ASCII letter start, then letters/digits/dashes/colons/underscores.
  const re = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(tagBody)) !== null) {
    const name = m[1].toLowerCase();
    if (m[2] !== undefined) attrs[name] = m[2];
    else if (m[3] !== undefined) attrs[name] = m[3];
    else if (m[4] !== undefined) attrs[name] = m[4];
    else attrs[name] = true;
  }
  return attrs;
}

/**
 * Strip the tag name from the inside of an opening tag, returning only
 * the attribute string. Returns '' if the tag has no attributes.
 * @param {string} tagBody
 * @returns {string}
 */
/**
 * Find the matching close tag for an opening `<name` at index `start`,
 * respecting quoted attribute values. Returns the index just past the
 * closing `>`, or -1 if unclosed.
 *
 * @param {string} html
 * @param {number} start  Index of the `<` of the opening tag.
 * @param {string} name   Lowercase tag name.
 * @returns {number}
 */
function findOpenTagEnd(html, start, name) {
  // Skip past `<name` and any whitespace.
  let i = start + 1 + name.length;
  const len = html.length;
  while (i < len && /\s/.test(html[i])) i++;
  // Walk until unquoted `>`.
  while (i < len) {
    const ch = html[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < len && html[i] !== quote) i++;
      if (i < len) i++;
      continue;
    }
    if (ch === '>') return i + 1;
    i++;
  }
  return -1;
}

/**
 * Find the index just past a closing `</name>` tag, or -1 if not found.
 * @param {string} html
 * @param {number} from  Index to start searching from.
 * @param {string} name  Lowercase tag name.
 * @returns {number}
 */
function findCloseTag(html, from, name) {
  const re = new RegExp('</\\s*' + name + '\\s*>', 'i');
  const m = re.exec(html.slice(from));
  if (!m) return -1;
  return from + m.index + m[0].length;
}

/**
 * Walk the HTML, collecting all opening tags with the given lowercase
 * name and returning each one as a `{raw, openTag, attrs, content,
 * outerEnd}` record. For self-closing/void elements `content` is `null`.
 *
 * @param {string} html
 * @param {string} name
 * @returns {Array<{raw:string, openTag:string, attrs:object, content:(string|null), outerEnd:number}>}
 */
function collectTags(html, name) {
  const results = [];
  const openRe = new RegExp('<\\s*' + name + '[\\s/>]', 'gi');
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index;
    const openEnd = findOpenTagEnd(html, start, name);
    if (openEnd === -1) continue;
    const openTag = html.slice(start, openEnd);
    // Did the open tag self-close? (`<script src="..." />` style)
    const selfClosing = />\s*\/\s*>$/.test(openTag);
    const isVoid = VOID_TAGS.has(name);
    const innerStart = openEnd;
    if (selfClosing || isVoid) {
      // openTag has shape `<name attrs...>` or `<name attrs... />`.
      // We want everything inside the brackets, EXCLUDING the trailing
      // `>` (and the `/` of `/>` when present).
      const openBody = openTag.endsWith('/>')
        ? openTag.slice(1 + name.length, openTag.length - 2)
        : openTag.slice(1 + name.length, openTag.length - 1);
      results.push({
        raw: openTag,
        openTag,
        attrs: parseAttrs(openBody),
        content: null,
        outerEnd: openEnd,
      });
      continue;
    }
    const closeEnd = findCloseTag(html, innerStart, name);
    if (closeEnd === -1) continue;
    const content = html.slice(innerStart, closeEnd - (('</' + name + '>').length));
    const raw = html.slice(start, closeEnd);
    const openBody = openTag.endsWith('/>')
      ? openTag.slice(1 + name.length, openTag.length - 2)
      : openTag.slice(1 + name.length, openTag.length - 1);
    results.push({
      raw,
      openTag,
      attrs: parseAttrs(openBody),
      content,
      outerEnd: closeEnd,
    });
  }
  return results;
}

/**
 * Extract `<title>...</title>` text content from a head fragment.
 * @param {string} headHtml
 * @returns {string|null}
 */
function extractTitle(headHtml) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(headHtml);
  if (!m) return null;
  return m[1].trim();
}

/**
 * Split a raw HTML document into its preserved parts. The parts are
 * suitable for round-trip re-emission by `buildLiveDocument` without
 * losing `<script>` tags, `<style>` blocks, `<link>` tags, `<meta>`
 * tags, or the title.
 *
 * Documented limits (see file header for the full list):
 *   - Does not specially skip `</script>` substrings inside JS string
 *     literals.
 *   - Does not specially skip `</style>` substrings inside CSS comments.
 *   - Comment handling: HTML comments remain part of headHtml/bodyHtml.
 *
 * @param {string} rawHtml
 * @returns {DocumentParts}
 */
export function extractDocumentParts(rawHtml) {
  const html = String(rawHtml ?? '');

  // Doctype — optional.
  const doctypeMatch = /^\s*(<!doctype[^>]*>)/i.exec(html);
  const doctype = doctypeMatch ? doctypeMatch[1] : '';

  // Head — locate the inner contents of `<head>...</head>`.
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const headHtml = headMatch ? headMatch[1] : '';

  // Body — locate the inner contents of `<body>...</body>`.
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  let bodyHtml = bodyMatch ? bodyMatch[1] : '';

  // If there's no <body>, treat the whole post-head content as the body.
  // If there's no <head> either, treat the whole input as a fragment body
  // (minus the doctype).
  if (!bodyMatch) {
    if (headMatch) {
      const headOuterEnd = headMatch.index + headMatch[0].length;
      bodyHtml = html.slice(headOuterEnd);
    } else {
      const afterDoctype = doctype ? doctype.length : 0;
      bodyHtml = html.slice(afterDoctype);
    }
    // Strip a leading `<html>` open tag if present, since the body raw
    // text begins right after `<html>`. Also strip a trailing `</html>`
    // close tag so the body is just the content between them.
    bodyHtml = bodyHtml.replace(/^\s*<html\b[^>]*>/i, '');
    bodyHtml = bodyHtml.replace(/<\/html>\s*$/i, '');
  }

  // Scripts / styles / links / metas — scan the whole document so that
  // body-resident scripts (very common: analytics, page-specific bundles)
  // are preserved too.
  const scriptMatches = collectTags(html, 'script').map((m) => {
    const hasSrc = m.attrs.src != null;
    return {
      raw: m.raw,
      openTag: m.openTag,
      // External (src=) scripts have no inline content by definition;
      // represent that as null rather than an empty string.
      src: hasSrc ? String(m.attrs.src) : null,
      content: hasSrc ? null : (m.content != null ? m.content : null),
      attrs: m.attrs,
    };
  });
  const styleMatches = collectTags(html, 'style').map((m) => ({
    raw: m.raw,
    openTag: m.openTag,
    content: m.content != null ? m.content : '',
    attrs: m.attrs,
  }));
  const linkMatches = collectTags(html, 'link').map((m) => ({
    raw: m.raw,
    attrs: m.attrs,
  }));
  const metaMatches = collectTags(html, 'meta').map((m) => ({
    raw: m.raw,
    attrs: m.attrs,
  }));

  // Title — look in head first, fall back to whole doc.
  const title = (headHtml && extractTitle(headHtml)) || extractTitle(html);

  return {
    doctype,
    headHtml,
    bodyHtml,
    title,
    scripts: scriptMatches,
    styles: styleMatches,
    links: linkMatches,
    metas: metaMatches,
  };
}

// ---------------------------------------------------------------------------
// rewriteAssetUrls — pure string transform for folder-import asset maps
// ---------------------------------------------------------------------------

/**
 * Normalize a "wanted" relative path for matching. Strips a single
 * leading `./` because the regex accepts both `./foo.png` and `foo.png`
 * forms in source HTML.
 * @param {string} p
 * @returns {string}
 */
function stripLeadingDotSlash(p) {
  return p.startsWith('./') ? p.slice(2) : p;
}

/**
 * Escape a string for literal use inside a RegExp.
 * @param {string} s
 * @returns {string}
 */
function reEscape(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply a list of `(pattern, replacement)` pairs to a string, returning
 * the result. Each pattern's `.lastIndex` is reset.
 * @param {string} html
 * @param {Array<[RegExp, string]>} replacements
 * @returns {string}
 */
function applyReplacements(html, replacements) {
  let out = html;
  for (const [re, repl] of replacements) {
    if (re.global) re.lastIndex = 0;
    out = out.replace(re, repl);
  }
  return out;
}

/**
 * Build the set of needle variants for a single asset-map entry. We
 * accept both `./foo.png` and `foo.png` in the source HTML, and either
 * of those may be quoted or unquoted, may appear in `src=` / `href=` /
 * CSS `url(...)` form. Each variant is the *unescaped* literal needle.
 *
 * @param {string} original  Path as the user gave it in the asset map.
 * @returns {string[]}
 */
function buildNeedles(original) {
  const bare = stripLeadingDotSlash(original);
  // Same path with and without the `./` prefix.
  const candidates = bare === original ? [original, './' + bare] : [original, bare];
  return Array.from(new Set(candidates));
}

/**
 * Build a regex that matches a relative reference to one of the needles
 * inside an attribute value of the form `attr="..."` or `attr='...'`,
 * capturing the quote character so we can preserve it on rewrite.
 *
 * @param {string[]} needles  Bare or `./`-prefixed path candidates.
 * @returns {RegExp}
 */
function buildAttrRegex(needles) {
  // Pattern: attr=(["'])needle\1   (case-insensitive on the attr name)
  const alt = needles.map(reEscape).join('|');
  return new RegExp(
    '([a-zA-Z][a-zA-Z0-9-]*)\\s*=\\s*(["\'])(' + alt + ')\\2',
    'gi',
  );
}

/**
 * Build a regex that matches a CSS `url(...)` reference to one of the
 * needles. Handles quoted (`url("x")`, `url('x')`) and unquoted
 * (`url(x)`) forms, preserving the original quote style on rewrite.
 *
 * @param {string[]} needles
 * @returns {RegExp}
 */
function buildCssUrlRegex(needles) {
  const alt = needles.map(reEscape).join('|');
  return new RegExp(
    'url\\(\\s*(["\']?)(' + alt + ')\\1\\s*\\)',
    'gi',
  );
}

/**
 * Build a regex that matches a single URL candidate inside a `srcset`
 * attribute. Captures the URL portion of a single candidate — a
 * `<URL>[ <whitespace><descriptor>]` entry in the comma-separated list.
 * We extract each candidate individually (see rewriteSrcset) rather
 * than trying to match the whole attribute in one regex, because
 * descriptors vary (`1x`, `2x`, `100w`, `480px`, etc.) and we want to
 * leave the descriptors untouched.
 *
 * @param {string[]} needles
 * @returns {RegExp}
 */
function buildSrcsetUrlRegex(needles) {
  const alt = needles.map(reEscape).join('|');
  return new RegExp(
    '([,\\s])(' + alt + ')(\\s|,|$)',
    'gi',
  );
}

/**
 * Apply the asset rewriting to a single chunk of HTML. Walks over each
 * entry in `lookup`, rewriting attribute `src`/`href`, CSS `url(...)`,
 * and `srcset` references. Same logic as the per-key loop inside
 * `rewriteAssetUrls`, but factored out so we can call it on a single
 * `<script>` opening tag in isolation (without touching the JS body).
 *
 * @param {string} html
 * @param {Map<string,string>} lookup
 * @returns {string}
 */
function rewriteChunk(html, lookup) {
  let working = html;
  for (const original of lookup.keys()) {
    const needles = buildNeedles(original);
    const repl = lookup.get(original);

    // attr="..." / attr='...' — preserve quote style.
    const attrRe = buildAttrRegex(needles);
    working = applyReplacements(working, [
      [
        attrRe,
        (_m, attr, quote, _needle) => `${attr}=${quote}${repl}${quote}`,
      ],
    ]);

    // CSS url("...") / url('...') / url(...) — preserve quote style.
    const cssRe = buildCssUrlRegex(needles);
    working = applyReplacements(working, [
      [
        cssRe,
        (_m, quote, _needle) => `url(${quote}${repl}${quote})`,
      ],
    ]);
  }

  // srcset — single combined regex (descriptors + multiple URLs).
  const srcsetAttrRe = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(["'])([^"']*?)\2/gi;
  working = working.replace(srcsetAttrRe, (full, attr, quote, value) => {
    if (attr.toLowerCase() !== 'srcset') return full;
    const rewritten = rewriteSrcset(value, lookup);
    return `${attr}=${quote}${rewritten}${quote}`;
  });

  return working;
}

/**
 * Rewrite a `<script>...</script>` block in isolation, applying asset
 * rewriting ONLY to the opening tag (so a `src=` attribute is rewritten
 * but the JS body — which may legitimately contain string literals
 * that look like paths — is preserved verbatim).
 *
 * @param {string} scriptRaw  Raw `<script ...>...</script>` text.
 * @param {Map<string,string>} lookup
 * @returns {string}
 */
function rewriteScriptBlock(scriptRaw, lookup) {
  // Locate the end of the opening `<script ...>` tag.
  const openEnd = findOpenTagEnd(scriptRaw, 0, 'script');
  if (openEnd === -1) return scriptRaw;
  const openTag = scriptRaw.slice(0, openEnd);
  const rest = scriptRaw.slice(openEnd);
  const rewrittenOpen = rewriteChunk(openTag, lookup);
  return rewrittenOpen + rest;
}

/**
 * Rewrite a single `srcset` attribute value, replacing matching URL
 * candidates with their blob/object equivalents while leaving
 * descriptors (`1x`, `2x`, `480px`, ...) and separators intact.
 *
 * @param {string} srcsetValue  The attribute value (without surrounding quotes).
 * @param {Map<string,string>} lookup  Map of bare-path → resolved URL.
 * @returns {string}
 */
function rewriteSrcset(srcsetValue, lookup) {
  // srcset = "<url>[ <descriptor>](, <url>[ <descriptor>])*"
  // Split on commas while respecting parentheses (CSS `url()` may
  // appear, though that's unusual in srcset — still, be safe).
  const parts = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < srcsetValue.length; i++) {
    const ch = srcsetValue[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);

  const rewritten = parts.map((part) => {
    const trimmed = part.replace(/^\s+|\s+$/g, '');
    if (!trimmed) return part;
    // Split into URL + descriptor(s).
    const spaceIdx = trimmed.search(/\s/);
    let url, rest;
    if (spaceIdx === -1) {
      url = trimmed;
      rest = '';
    } else {
      url = trimmed.slice(0, spaceIdx);
      rest = trimmed.slice(spaceIdx);
    }
    const repl = lookup.get(stripLeadingDotSlash(url)) || lookup.get(url);
    if (!repl) return part;
    // Preserve original surrounding whitespace.
    const leading = part.match(/^\s*/)[0];
    const trailing = part.match(/\s*$/)[0];
    return leading + repl + rest + trailing;
  });

  return rewritten.join(',');
}

/**
 * Rewrite relative `src`/`href`/`url(...)` references in an HTML
 * document against the caller-supplied asset map. Pure string transform.
 *
 * The rewrite is asset-driven: we iterate over the keys of `assetMap`
 * (each a relative path the user knows about) and replace only those
 * references. Anything not in the map (absolute URLs, `data:` URIs,
 * hashes, mailto links, etc.) is left alone.
 *
 * To avoid corrupting inline `<script>` bodies, the function first
 * extracts every `<script>...</script>` block, rewrites the rest of the
 * document, then re-inserts the scripts verbatim.
 *
 * @param {string} html  A complete HTML document or fragment.
 * @param {Record<string,string>|Map<string,string>} assetMap
 *        Map of relative path → resolved URL (typically a `blob:` URL).
 * @returns {string}
 */
export function rewriteAssetUrls(html, assetMap) {
  if (html == null || !assetMap) return String(html ?? '');
  const src = String(html);

  // Normalize the map to a Map<string,string> for O(1) lookups.
  const lookup = assetMap instanceof Map
    ? new Map(assetMap)
    : new Map(Object.entries(assetMap));
  if (lookup.size === 0) return src;

  // Step 1: Pull out all <script>...</script> blocks so we never rewrite
  // inside JS string literals. For each script we rewrite the OPENING
  // tag's `src=` (if any) against the asset map, but leave the body
  // content untouched.
  const scriptPlaceholder = '\u0000RB_SCRIPT_\u0000';
  const scriptBlocks = [];
  const scriptRe = /<script\b[\s\S]*?<\/script>/gi;
  const stripped = src.replace(scriptRe, (m) => {
    const rewritten = rewriteScriptBlock(m, lookup);
    const idx = scriptBlocks.length;
    scriptBlocks.push(rewritten);
    return scriptPlaceholder + idx + scriptPlaceholder;
  });

  // Step 2: Apply attr / url() / srcset rewriting to the non-script
  // portion of the document.
  const working = rewriteChunk(stripped, lookup);

  // Step 3: Reinsert script blocks.
  let result = working;
  for (let i = 0; i < scriptBlocks.length; i++) {
    result = result.replace(scriptPlaceholder + i + scriptPlaceholder, scriptBlocks[i]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// buildLiveDocument — the headline entrypoint
// ---------------------------------------------------------------------------

/**
 * Build a complete HTML document string suitable for `iframe.srcdoc`.
 *
 * Two input shapes are accepted:
 *
 *   1. A full HTML document. The renderer splits it via
 *      `extractDocumentParts` and re-emits with the original `<head>`
 *      contents, `<script>` tags, `<style>` blocks, and `<link>` tags
 *      preserved verbatim. Only asset URLs in `assets` are rewritten.
 *
 *   2. A fragment. The renderer wraps it in a minimal `<html><head>
 *      </head><body>...</body></html>` shell. Optional `css` is emitted
 *      as a `<style>` block. Asset URLs in `assets` are rewritten.
 *
 * If `assets` is supplied, it is applied to BOTH head and body contents
 * via `rewriteAssetUrls` before re-emission. Inline `<script>` tags are
 * preserved untouched (they were stripped out before rewriting and put
 * back in afterward).
 *
 * @param {object}   opts
 * @param {string}   opts.html        Raw HTML — full document or fragment.
 * @param {string}   [opts.css]       Extra CSS to inject as a `<style>` block.
 *                                    Ignored if `html` is a full document and
 *                                    already has its own `<style>` tags.
 * @param {Record<string,string>|Map<string,string>} [opts.assets]
 *                                    Relative-path → resolved-URL map for
 *                                    asset rewriting (folder-import case).
 * @param {string}   [opts.title]     Document title override.
 * @param {string}   [opts.doctype]   Doctype override. Defaults to `<!DOCTYPE html>`
 *                                    when input is a fragment, or to the input's
 *                                    own doctype when input is a full document.
 * @returns {string}                  Complete HTML document string.
 */
export function buildLiveDocument(opts) {
  if (!opts || typeof opts.html !== 'string') {
    throw new TypeError('buildLiveDocument: opts.html (string) is required');
  }
  const { html, css, assets, title, doctype: doctypeOverride } = opts;
  const assetMap = assets || null;
  const hasAssets = assetMap &&
    ((assetMap instanceof Map && assetMap.size > 0) ||
     (typeof assetMap === 'object' && Object.keys(assetMap).length > 0));

  const trimmed = html.trim();
  // Heuristic: is this a full document? Look for an explicit `<html`
  // opening tag, a doctype, or a `<head>` block. Anything else is a
  // fragment.
  const isFullDoc = /<html\b/i.test(trimmed) ||
                    /^<!doctype/i.test(trimmed) ||
                    /<head\b/i.test(trimmed);

  if (isFullDoc) {
    return buildLiveDocumentFromFull({ html, css, assetMap: hasAssets ? assetMap : null, title, doctypeOverride });
  }
  return buildLiveDocumentFromFragment({ html, css, assetMap: hasAssets ? assetMap : null, title, doctypeOverride });
}

/**
 * Internal — build a live document from a full HTML document string.
 * @param {object} args
 * @returns {string}
 */
function buildLiveDocumentFromFull({ html, css, assetMap, title, doctypeOverride }) {
  const parts = extractDocumentParts(html);
  const doctype = doctypeOverride || parts.doctype || '<!DOCTYPE html>';
  const titleStr = title != null
    ? String(title)
    : (parts.title || 'Live preview');

  // Apply asset rewriting to head and body separately so script
  // extraction (which is content-based) doesn't fight us.
  let headOut = assetMap
    ? rewriteAssetUrls(parts.headHtml, assetMap)
    : parts.headHtml;
  const bodyOut = assetMap
    ? rewriteAssetUrls(parts.bodyHtml, assetMap)
    : parts.bodyHtml;

  // When the caller supplies a title override, strip any existing
  // <title> from the head so we don't emit two of them.
  if (title != null) {
    headOut = headOut.replace(/<title\b[\s\S]*?<\/title>/i, '');
  }

  // Build the document. We don't try to interleave scripts back in by
  // position; we emit all scripts after the head + body because that's
  // what the original HTML was effectively doing (scripts execute when
  // encountered). For live render fidelity this is what we want.
  //
  // However, we should preserve scripts in their original document
  // order if possible. The simplest correct approach: emit headHtml
  // (which contains head-resident scripts) verbatim, then the body,
  // and finally any body-resident scripts that aren't already in body
  // text. In practice our bodyHtml already contains body-resident
  // scripts inline (they're inside <body>...</body>), and head-resident
  // scripts are inside headHtml. So we just re-emit head then body.
  //
  // One exception: scripts that the original placed AFTER </body> (a
  // common Google Analytics / pixel pattern). Those are in `parts.scripts`
  // but not in either head or body. We append them at the end.
  const headAndBodyScriptCount = countScriptsInText(parts.headHtml) +
                                  countScriptsInText(parts.bodyHtml);
  const trailingScripts = parts.scripts.slice(headAndBodyScriptCount);
  const trailingScriptsHtml = trailingScripts.length
    ? trailingScripts.map((s) => s.raw).join('\n')
    : '';

  const extraStyleBlock = css
    ? `\n<style>\n${css}\n</style>\n`
    : '';

  return (
    doctype +
    '\n<html lang="en">\n' +
    '<head>\n' +
    `<meta charset="UTF-8" />\n` +
    ensureViewportMeta(parts.metas) +
    headOut +
    extraStyleBlock +
    `<title>${escapeHtmlText(titleStr)}</title>\n` +
    '</head>\n' +
    '<body>\n' +
    bodyOut +
    '\n</body>\n' +
    trailingScriptsHtml +
    '\n</html>\n'
  );
}

/**
 * Internal — build a live document from a fragment string.
 * @param {object} args
 * @returns {string}
 */
function buildLiveDocumentFromFragment({ html, css, assetMap, title, doctypeOverride }) {
  const bodyOut = assetMap ? rewriteAssetUrls(html, assetMap) : html;
  const cssBlock = css ? `<style>\n${css}\n</style>\n` : '';
  const titleStr = title != null ? String(title) : 'Live preview';
  const doctype = doctypeOverride || '<!DOCTYPE html>';

  return (
    doctype + '\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    `${DEFAULT_CHARSET_META}\n` +
    `${DEFAULT_VIEWPORT_META}\n` +
    cssBlock +
    `<title>${escapeHtmlText(titleStr)}</title>\n` +
    '</head>\n' +
    '<body>\n' +
    bodyOut +
    '\n</body>\n' +
    '</html>\n'
  );
}

/**
 * Ensure a viewport meta tag is present in the head. If one is already
 * present in `metas`, returns the original metas' serialized text.
 * Otherwise prepends a default viewport meta.
 *
 * @param {MetaPart[]} metas
 * @returns {string}
 */
function ensureViewportMeta(metas) {
  const existing = metas.find((m) => {
    const name = m.attrs.name;
    const httpEquiv = m.attrs['http-equiv'];
    return (typeof name === 'string' && name.toLowerCase() === 'viewport') ||
           (typeof httpEquiv === 'string' && httpEquiv.toLowerCase() === 'content-type');
  });
  if (existing) return '';
  return `${DEFAULT_VIEWPORT_META}\n`;
}

/**
 * Count `<script>` opening tags in a chunk of HTML. Used to know how
 * many of `parts.scripts` are accounted for by head + body text.
 * @param {string} html
 * @returns {number}
 */
function countScriptsInText(html) {
  const re = /<script\b/gi;
  let n = 0;
  while (re.exec(html) !== null) n++;
  return n;
}

// ---------------------------------------------------------------------------
// End
// ---------------------------------------------------------------------------
