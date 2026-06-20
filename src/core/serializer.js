/**
 * @file Serializer for the document model.
 *
 *       serialize(doc)   → { html, css }    body-level fragment + collected CSS
 *       deserialize({html, css}) → doc      parse back into a document
 *
 *       Output conventions:
 *         - No <html>/<head>/<body> shell. The editor's exporter wraps the
 *           body fragment + collected CSS into a full document, mirroring
 *           the existing app's wrapExportedHtml() output.
 *         - Each element's `styles` object is inlined as a `style="..."` attribute.
 *         - Void elements (img, br, ...) are written without a closing tag.
 *         - Non-void empty elements are written self-closing: `<span />`.
 *         - Attribute values are double-quoted; boolean attrs have no value.
 *         - Text is HTML-escaped (& < > ").
 *         - Ids are NOT written into the output — they are editor-internal.
 *           On deserialize, new ids are generated. Structural model is
 *           therefore round-trip stable.
 *
 *       Round-trip stability:
 *         serialize(d) == serialize(deserialize(serialize(d)))
 *       The parser is tolerant of the canonical output, and the canonical
 *       output is deterministic.
 */

import { createDocument, VOID_TAGS, parseStyleString } from './document-model.js';

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a document to { html, css }.
 * @param {object} doc
 * @returns {{html: string, css: string}}
 */
export function serialize(doc) {
  const css = (doc && doc.css) ? String(doc.css) : '';
  if (!doc || !doc.root) return { html: '', css };
  const html = doc.root.children.map(renderNode).join('');
  return { html, css };
}

/** @param {object} node */
function renderNode(node) {
  if (!node) return '';
  if (node.tag === '#text') {
    return escapeText(node.text == null ? '' : String(node.text));
  }
  if (node.tag === '#document') {
    return (node.children || []).map(renderNode).join('');
  }

  const tag = node.tag || 'div';
  const attrs = renderAttrs(node.attrs || {});
  const style = renderInlineStyle(node.styles || {});

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrs}${style}>`;
  }
  const childrenHtml = (node.children || []).map(renderNode).join('');
  const text = node.text != null ? escapeText(String(node.text)) : '';
  if (!childrenHtml && !text) {
    return `<${tag}${attrs}${style} />`;
  }
  return `<${tag}${attrs}${style}>${childrenHtml}${text}</${tag}>`;
}

/** @param {object} attrs */
function renderAttrs(attrs) {
  let s = '';
  for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v === true) {
      s += ` ${k}`;
    } else if (v === null || v === undefined || v === false) {
      // skip
    } else {
      s += ` ${k}="${escapeAttr(String(v))}"`;
    }
  }
  return s;
}

/** @param {object} styles */
function renderInlineStyle(styles) {
  const keys = Object.keys(styles);
  if (!keys.length) return '';
  const parts = [];
  for (const k of keys) {
    const v = styles[k];
    if (v == null || v === '') continue;
    parts.push(`${k}:${v}`);
  }
  if (!parts.length) return '';
  return ` style="${escapeAttr(parts.join(';'))}"`;
}

/** @param {string} s */
function escapeText(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/**
 * Parse { html, css } into a document.
 *
 * @param {{html?: string, css?: string}} [input]
 * @returns {object} a document from createDocument()
 */
export function deserialize(input) {
  const data = input || {};
  const doc = createDocument();
  if (typeof data.css === 'string' && data.css.length) {
    doc.css = String(data.css);
  }
  if (typeof data.html === 'string' && data.html.length) {
    // Use the same HTML parser the document model uses for createDocument.
    // We re-parse here so that any <style> blocks already present in the
    // html are merged into doc.css (matching the serialize→deserialize
    // contract) and ids are assigned.
    const fresh = createDocument(data.html);
    if (fresh.css) doc.css = (doc.css ? doc.css + '\n' : '') + fresh.css;
    for (const node of fresh.root.children) {
      doc.root.children.push(node);
    }
    // Copy generated ids into this doc's index.
    for (const node of fresh.root.children) {
      indexFromNode(doc, node);
    }
  }
  return doc;
}

function indexFromNode(doc, node) {
  if (!node) return;
  if (node.id) doc.index.set(node.id, node);
  for (const c of (node.children || [])) indexFromNode(doc, c);
}

// ---------------------------------------------------------------------------
// Helpers exposed for round-trip verification
// ---------------------------------------------------------------------------

/** Re-export so consumers can validate the inline style encoding. */
export { parseStyleString };
