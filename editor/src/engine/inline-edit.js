/**
 * @file Iframe-side edit agent — click-to-select, hover, and inline text
 *       editing (contentEditable) for the "Edit Live Site" mode.
 *
 *       Two layers:
 *
 *         1. Pure helpers (computeSelectorPath, isTextEditableTag) —
 *            usable in Node tests.
 *
 *         2. createEditAgent(windowObj) — DOM controller that binds
 *            mouse + keyboard + contentEditable listeners inside the
 *            iframe and emits messages through the bridge agent.
 *
 *       --------------------------------------------------------------------------
 *       Editing model
 *       --------------------------------------------------------------------------
 *       The agent's job is REACTIVE — it surfaces what the user did and
 *       emits typed messages. It does NOT mutate the document model. The
 *       bridge / parent decides what to do with the edit (apply via the
 *       command bus, surface in a properties panel, etc.).
 *
 *       Inline text editing:
 *         - Single click on a text-bearing element → emit `select`.
 *         - Double click on the same element → enable contentEditable.
 *         - `input` while editing → emit `text-changed` (debounced ~150ms).
 *         - `Escape` or blur → disable contentEditable.
 *
 *       Hover:
 *         - `mousemove` → rAF-throttled, emits `hover` for the deepest
 *           element under the pointer (different from last hover only).
 *
 *       Select:
 *         - Single click → emit `select` with the deepest non-empty-rect
 *           element at the click point.
 *
 *       Deselect:
 *         - Click on document body / scrollbar area → emit `deselect`.
 *         - Escape key → emit `deselect`.
 *
 * @example
 *   import { createAgent } from './iframe-bridge.js';
 *   import { createEditAgent } from './inline-edit.js';
 *
 *   const bridge = createAgent(window);
 *   const editor = createEditAgent(window, {
 *     bridge,
 *     onTextChange: ({ path, text }) => console.log(path, text),
 *   });
 */

import { createAgent } from './iframe-bridge.js';

/**
 * Tags that meaningfully hold user-visible text. Inline-edit only
 * enables contentEditable on these (otherwise we'd accidentally let
 * users type into <html> or <meta>).
 */
export const TEXT_EDITABLE_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'a', 'li', 'button', 'label',
  'td', 'th', 'em', 'strong', 'i', 'b', 'u', 'small',
  'blockquote', 'figcaption', 'dt', 'dd', 'caption',
  'div', 'section', 'article', 'header', 'footer', 'main', 'nav',
  'title',
]);

/** @param {string} tag @returns {boolean} */
export function isTextEditableTag(tag) {
  if (typeof tag !== 'string') return false;
  return TEXT_EDITABLE_TAGS.has(tag.toLowerCase());
}

/** Return the lowercase tag name for any element-like or DOM node. */
function tagOf(el) {
  if (!el) return '';
  if (typeof el.tagName === 'string') return el.tagName.toLowerCase();
  return '';
}

/**
 * Compute a stable "nth-of-type" selector path from `el` up to `root`.
 *
 * The format is `html > body > section:nth-of-type(2) > div:nth-of-type(1) > p:nth-of-type(1)`.
 * nth-of-type counts same-tag siblings that come BEFORE the element
 * (1-based). The path is stable as long as the document tree is stable —
 * additions above the element do not change its path.
 *
 * Pure: works on any element-like object exposing `tagName` and
 * `parentElement`. For the real DOM, `tagName` is upper-case and we
 * lowercase here.
 *
 * @param {object|null} el
 * @param {object} [root] — stop walking at this node (defaults to el.ownerDocument.documentElement if el is a real Element)
 * @returns {string} "" if el is null; otherwise a " > " joined path
 */
export function computeSelectorPath(el, root) {
  if (!el || typeof el !== 'object') return '';
  // Walk up via parentElement, building parts bottom-up.
  /** @type {string[]} */
  const parts = [];
  let cur = el;
  // If `root` is a Document-like object, the walker stops when cur.parentElement is null and cur === root.
  let stop = root || null;
  if (!stop && el.ownerDocument && el.ownerDocument.documentElement) {
    stop = el.ownerDocument.documentElement;
  }

  // Cap the walk at a generous depth to defend against accidental cycles.
  for (let depth = 0; depth < 200; depth++) {
    const tag = tagOf(cur);
    if (!tag) break;
    const parent = cur.parentElement;
    const indexAmongSiblings = indexOfType(cur, parent);
    parts.push(indexAmongSiblings > 1 ? `${tag}:nth-of-type(${indexAmongSiblings})` : tag);
    if (stop && cur === stop) break;
    if (!parent) break;
    cur = parent;
  }

  return parts.reverse().join(' > ');
}

/**
 * Count this element's 1-based position among its same-tag siblings.
 * Pure: works with plain objects exposing `tagName` and `parentElement.children`.
 * @param {object} el
 * @param {object|null} parent
 */
function indexOfType(el, parent) {
  if (!parent || !Array.isArray(parent.children)) return 1;
  const tag = tagOf(el);
  let n = 0;
  for (const sib of parent.children) {
    if (tagOf(sib) === tag) {
      n += 1;
      if (sib === el) return n;
    }
  }
  return Math.max(1, n);
}

/**
 * Resolve a stored selector path back to an element in the current
 * document. Returns null on miss or if any step is invalid.
 *
 * @param {Document|object} doc        — Document or document-like with querySelectorAll
 * @param {string} selectorPath        — output of computeSelectorPath
 * @returns {object|null}
 */
export function resolveSelectorPath(doc, selectorPath) {
  if (!doc || typeof selectorPath !== 'string' || !selectorPath) return null;
  try {
    return doc.querySelector(selectorPath) || null;
  } catch (_err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM controller
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} EditAgentOptions
 * @property {ReturnType<typeof createAgent>} [bridge] — reuse an existing bridge agent (recommended)
 * @property {number} [hoverThrottleMs=50] — min interval between hover messages
 * @property {number} [textChangeDebounceMs=150] — debounce before emitting text-changed
 * @property {(payload: {path: string, prevText: string, text: string}) => void} [onTextChange]
 * @property {(payload: {path: string, rect: object, tagName: string, textPreview: string}) => void} [onSelect]
 * @property {(payload: {path: string, rect: object, tagName: string, textPreview: string}) => void} [onHover]
 * @property {() => void} [onDeselect]
 * @property {boolean} [autoStart=true] — bind document listeners immediately
 */

/**
 * @param {Window} windowObj
 * @param {EditAgentOptions} [opts]
 */
export function createEditAgent(windowObj, opts) {
  const o = opts || {};
  if (!windowObj || !windowObj.document) {
    throw new Error('createEditAgent: windowObj must be a Window with a document');
  }
  const doc = windowObj.document;
  const bridge = o.bridge || createAgent(windowObj, {
    expectedParentOrigin: o.expectedParentOrigin || '*',
    targetOrigin: o.targetOrigin || '*',
    autoStart: true,
  });

  const hoverThrottleMs = Number.isFinite(o.hoverThrottleMs) ? o.hoverThrottleMs : 50;
  const textChangeDebounceMs = Number.isFinite(o.textChangeDebounceMs) ? o.textChangeDebounceMs : 150;

  /** @type {Element|null} */ let selectedEl = null;
  /** @type {Element|null} */ let hoveredEl = null;
  /** @type {Element|null} */ let editingEl = null;
  let editingPrevText = '';
  let lastHoverAt = 0;
  let pendingHoverRaf = 0;
  let textChangeTimer = 0;
  let bound = false;

  // ----- helpers ----------------------------------------------------------

  function buildSelectPayload(el) {
    if (!el) return null;
    return {
      path: computeSelectorPath(el),
      rect: getIframeRect(el),
      tagName: tagOf(el),
      textPreview: textPreviewOf(el),
    };
  }

  function buildHoverPayload(el) {
    if (!el) return null;
    return {
      path: computeSelectorPath(el),
      rect: getIframeRect(el),
    };
  }

  function emitSelect(el) {
    if (!el) return;
    const payload = buildSelectPayload(el);
    bridge.emit('select', payload);
    if (typeof o.onSelect === 'function') o.onSelect(payload);
  }

  function emitHover(el) {
    if (!el) return;
    const payload = buildHoverPayload(el);
    bridge.emit('hover', payload);
    if (typeof o.onHover === 'function') o.onHover(payload);
  }

  function emitDeselect() {
    bridge.emit('deselect', {});
    if (typeof o.onDeselect === 'function') o.onDeselect();
  }

  function emitTextChange(el, prevText, text) {
    const payload = {
      path: computeSelectorPath(el),
      prevText,
      text,
    };
    bridge.emit('text-changed', payload);
    if (typeof o.onTextChange === 'function') o.onTextChange(payload);
  }

  /**
   * Get the element's rect in the iframe's document coordinates
   * (NOT in viewport coordinates — the parent does the projection).
   * @param {Element} el
   */
  function getIframeRect(el) {
    const r = el.getBoundingClientRect();
    // getBoundingClientRect is viewport-relative. To make it
    // document-relative we subtract the documentElement scroll. The
    // bridge's projectIframeRectToContainer adds scroll back in.
    const sx = doc.documentElement ? (doc.documentElement.scrollLeft || 0) : 0;
    const sy = doc.documentElement ? (doc.documentElement.scrollTop  || 0) : 0;
    return {
      x: r.left + sx,
      y: r.top + sy,
      width: r.width,
      height: r.height,
    };
  }

  function textPreviewOf(el) {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return t.length > 80 ? t.slice(0, 77) + '...' : t;
  }

  /**
   * Hit-test to the deepest element at the given point, returning the
   * deepest element with a non-empty bounding rect that is NOT the
   * document body itself (unless it's the only thing under the point).
   * @param {number} x
   * @param {number} y
   */
  function deepestAt(x, y) {
    // Use elementFromPoint then walk down via querySelectorAll('*') at
    // that exact point? Simpler: just use elementFromPoint which already
    // returns the topmost stacked element. For "deepest non-empty rect"
    // we accept that — clicks reach the visible topmost element which is
    // what users expect.
    let el = doc.elementFromPoint(x, y);
    if (!el) return null;
    // If we hit the document body, walk up to find the nearest element
    // with a non-empty rect (the body itself can have 0-height rect).
    let cur = el;
    while (cur && cur !== doc.documentElement) {
      const r = cur.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  // ----- event handlers ---------------------------------------------------

  function onMouseDown(ev) {
    const el = deepestAt(ev.clientX, ev.clientY);
    if (!el || el === doc.documentElement) {
      // Empty area click — deselect.
      selectedEl = null;
      stopEditing();
      emitDeselect();
      return;
    }
    selectedEl = el;
    emitSelect(el);
  }

  function onMouseMove(ev) {
    if (pendingHoverRaf) return;
    pendingHoverRaf = windowObj.requestAnimationFrame(() => {
      pendingHoverRaf = 0;
      const now = Date.now();
      if (now - lastHoverAt < hoverThrottleMs) return;
      lastHoverAt = now;
      const el = deepestAt(ev.clientX, ev.clientY);
      if (!el) return;
      if (el === hoveredEl) return;
      hoveredEl = el;
      emitHover(el);
    });
  }

  function onDblClick(ev) {
    const el = deepestAt(ev.clientX, ev.clientY);
    if (!el) return;
    if (!isTextEditableTag(tagOf(el))) return;
    startEditing(el);
  }

  function onKeyDown(ev) {
    if (ev.key === 'Escape') {
      if (editingEl) {
        // Exit edit mode first (committing any pending text), then
        // deselect. Matches what users expect from design tools:
        // Escape is the universal "get me out" key.
        stopEditing(true);
        selectedEl = null;
        emitDeselect();
      } else {
        selectedEl = null;
        emitDeselect();
      }
    }
  }

  function onInput(ev) {
    if (!editingEl) return;
    const target = ev.target;
    if (target !== editingEl) return;
    if (textChangeTimer) windowObj.clearTimeout(textChangeTimer);
    textChangeTimer = windowObj.setTimeout(() => {
      textChangeTimer = 0;
      const text = (editingEl.textContent || '');
      if (text === editingPrevText) return;
      emitTextChange(editingEl, editingPrevText, text);
      editingPrevText = text;
    }, textChangeDebounceMs);
  }

  function onBlur(ev) {
    if (!editingEl) return;
    if (ev.target !== editingEl) return;
    stopEditing(true);
  }

  // ----- editing ----------------------------------------------------------

  function startEditing(el) {
    if (editingEl && editingEl !== el) stopEditing(true);
    editingEl = el;
    editingPrevText = (el.textContent || '');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-rb-editing', 'true');
    try {
      el.focus();
      // Select all so the user can immediately type to replace.
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = windowObj.getSelection && windowObj.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (_e) { /* focus might fail on non-focusable elements */ }
  }

  /**
   * @param {boolean} [commit] — when true, flush any pending text change before disabling
   */
  function stopEditing(commit) {
    if (!editingEl) return;
    const el = editingEl;
    editingEl = null;
    if (textChangeTimer) {
      windowObj.clearTimeout(textChangeTimer);
      textChangeTimer = 0;
    }
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-rb-editing');
    const newText = (el.textContent || '');
    if (commit && newText !== editingPrevText) {
      emitTextChange(el, editingPrevText, newText);
    }
    editingPrevText = '';
  }

  // ----- lifecycle --------------------------------------------------------

  function bind() {
    if (bound) return;
    doc.addEventListener('mousedown',  onMouseDown,  true);
    doc.addEventListener('mousemove',  onMouseMove,  true);
    doc.addEventListener('dblclick',   onDblClick,   true);
    doc.addEventListener('keydown',    onKeyDown,    true);
    doc.addEventListener('input',      onInput,      true);
    doc.addEventListener('blur',       onBlur,       true);
    bound = true;
  }

  function unbind() {
    if (!bound) return;
    doc.removeEventListener('mousedown',  onMouseDown,  true);
    doc.removeEventListener('mousemove',  onMouseMove,  true);
    doc.removeEventListener('dblclick',   onDblClick,   true);
    doc.removeEventListener('keydown',    onKeyDown,    true);
    doc.removeEventListener('input',      onInput,      true);
    doc.removeEventListener('blur',       onBlur,       true);
    bound = false;
  }

  function enable() { bridge.enable(); bind(); }
  function disable() { unbind(); stopEditing(false); bridge.disable(); }
  function destroy() { disable(); bridge.destroy && bridge.destroy(); }

  // Auto-enable by default unless the caller opts out. The bridge has its
  // own autoStart; for createEditAgent, "enable" also binds the document
  // listeners (mousedown, mousemove, dblclick, etc.) so the agent actually
  // reacts to user gestures. Callers can pass { autoStart: false } to wire
  // up their own lifecycle.
  if (o.autoStart !== false) {
    enable();
  }

  return {
    enable,
    disable,
    destroy,
    getSelected: () => selectedEl,
    getHovered:  () => hoveredEl,
    getEditing:  () => editingEl,
    computeSelectorPath: (el) => computeSelectorPath(el),
    resolveSelectorPath: (path) => resolveSelectorPath(doc, path),
  };
}