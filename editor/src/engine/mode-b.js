/**
 * @file Mode-B ("Build from scratch") lifecycle wrapper.
 *
 *       The editing surface previously provided by a third-party
 *       implementation is being rebuilt. `mountModeB` keeps its public
 *       name and renders a plain rebuild notice into the host container.
 *       The pure content helpers and handle factory below remain for
 *       the rest of the engine and its headless tests.
 */

import { serialize, deserialize } from '../core/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Editor events we listen on. Listed in one place so wire/unwire
 * stay in sync. Each entry is `[eventName, payloadSource]`.
 * @type {readonly (readonly [string, string])[]}
 */
const CHANGE_EVENTS = Object.freeze([
  ['component:update',      'component'],
  ['component:create',     'component'],
  ['component:delete',     'component'],
  ['component:styleUpdate', 'component'],
  ['style:update',         'style'],
  ['change:style',         'style'],
  ['undo',                 'reset'],
  ['redo',                 'reset'],
  ['project:load',         'project'],
  ['project:loaded',       'project'],
  ['load',                 'project'],
]);

// ---------------------------------------------------------------------------
// Pure content helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a `{ html, css }` input into the canonical shape used by
 * `setContent` / `getContent`. Accepts missing fields, non-strings,
 * and nullish input. Pure / side-effect-free.
 *
 * @param {unknown} input
 * @returns {{ html: string, css: string }}
 */
export function normalizeContent(input) {
  const out = { html: '', css: '' };
  if (!input || typeof input !== 'object') return out;
  const obj = /** @type {Record<string, unknown>} */ (input);
  if (typeof obj.html === 'string') out.html = obj.html;
  if (typeof obj.css === 'string') out.css = obj.css;
  return out;
}

/**
 * Read `{ html, css }` from an editor instance. The editor is
 * assumed to expose `getHtml()` and `getCss()`. Returns a normalized
 * `{ html, css }` object. Defensive against either method throwing or
 * returning non-strings.
 *
 * @param {{ getHtml?: () => unknown, getCss?: () => unknown }} editor
 * @returns {{ html: string, css: string }}
 */
export function readEditorContent(editor) {
  let html = '';
  let css = '';
  if (editor && typeof editor.getHtml === 'function') {
    try {
      const v = editor.getHtml();
      if (typeof v === 'string') html = v;
    } catch (_err) {
      // Ignore — leave html as empty string.
    }
  }
  if (editor && typeof editor.getCss === 'function') {
    try {
      const v = editor.getCss();
      if (typeof v === 'string') css = v;
    } catch (_err) {
      // Ignore — leave css as empty string.
    }
  }
  return { html, css };
}

/**
 * Write a `{ html, css }` payload into an editor instance via
 * `setComponents` and `setStyle`. Both calls are best-effort; either
 * may be skipped if the editor doesn't expose the corresponding method
 * or the input field is empty. Never throws.
 *
 * @param {{
 *   setComponents?: (html: string, opt?: object) => unknown,
 *   setStyle?: (css: string, opt?: object) => unknown,
 * }} editor
 * @param {{ html?: string, css?: string }} content
 * @returns {{ htmlApplied: boolean, cssApplied: boolean }}
 */
export function writeEditorContent(editor, content) {
  const data = normalizeContent(content);
  let htmlApplied = false;
  let cssApplied = false;
  if (data.html && editor && typeof editor.setComponents === 'function') {
    try {
      editor.setComponents(data.html);
      htmlApplied = true;
    } catch (_err) {
      // Ignore — keep previous canvas.
    }
  }
  if (data.css && editor && typeof editor.setStyle === 'function') {
    try {
      editor.setStyle(data.css);
      cssApplied = true;
    } catch (_err) {
      // Ignore — keep previous stylesheet.
    }
  }
  return { htmlApplied, cssApplied };
}

/**
 * Push the editor's current content through the headless core
 * serializer and back, so callers can verify that `getContent()` is
 * round-trip stable against the canonical engine shape. This is the
 * `getContent() → deserialize → serialize` contract the spec calls for.
 *
 * If the editor exposes no working `getHtml`/`getCss`, returns
 * `{ html: '', css: '' }` and sets `ok=false` so callers can detect
 * the no-op case.
 *
 * @param {{ getHtml?: () => unknown, getCss?: () => unknown }} editor
 * @returns {{ content: { html: string, css: string }, ok: boolean }}
 */
export function coreRoundTripFromEditor(editor) {
  const raw = readEditorContent(editor);
  if (!raw.html && !raw.css) {
    return { content: { html: '', css: '' }, ok: false };
  }
  const doc = deserialize(raw);
  const out = serialize(doc);
  return { content: out, ok: true };
}

// ---------------------------------------------------------------------------
// Container resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a container argument (Element or selector string) to a
 * DOM Element. Returns null if the resolved element is invalid or
 * the document is not available. Exposed for tests.
 *
 * @param {Element|string|null|undefined} container
 * @returns {Element|null}
 */
export function resolveContainer(container) {
  if (!container) return null;
  if (typeof container === 'string') {
    if (typeof document === 'undefined') return null;
    const found = document.querySelector(container);
    if (!found) return null;
    // `Element` is a browser global — guard the `instanceof` so
    // resolveContainer is safe to import in non-browser environments
    // (e.g. the Node test runner).
    if (typeof Element === 'undefined') return null;
    return (found instanceof Element) ? found : null;
  }
  // Non-string, non-nullish: must be a real Element. `Element` may be
  // undefined in Node; in that case we cannot validate the input and
  // return null.
  if (typeof Element === 'undefined') return null;
  return (container instanceof Element) ? container : null;
}

// ---------------------------------------------------------------------------
// Handle factory
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ModeBInsertHelpers
 * @property {(ed: object) => void} addSection
 * @property {(ed: object) => void} addTextBlock
 * @property {(ed: object, src?: string) => void} addImageBlock
 * @property {(ed: object, code: string) => void} insertEmbed
 */

/**
 * Create a handle that wraps an editor instance. Pure logic
 * where possible: change-payload normalization, content read/write,
 * and destroy idempotency are all testable without a real browser
 * by passing a mock editor object. Only `mountModeB` requires a real DOM to run.
 *
 * The optional `insertHelpers` parameter carries the insertion functions. In tests they can be left undefined (the
 * insert methods become no-ops) or supplied as lightweight mocks.
 *
 * @param {object} editor              editor instance
 * @param {{
 *   onDomTeardown?: () => void,      // optional DOM cleanup callback
 *   insertHelpers?: ModeBInsertHelpers,
 * }} [opts]
 * @returns {object} handle
 */
function buildHandle(editor, opts) {
  const listeners = new Set();
  const helpers = (opts && opts.insertHelpers) || null;
  let destroyed = false;

  /**
   * Fire a change event to all registered listeners. Wrapped in
   * try/catch so a single misbehaving listener cannot break the rest.
   * @param {object} payload
   */
  function emit(payload) {
    for (const cb of Array.from(listeners)) {
      try { cb(payload); } catch (_err) { /* swallow */ }
    }
  }

  /**
   * Wire the editor's change events to our normalized payload. Each
   * entry in CHANGE_EVENTS is `[eventName, payloadSource]`. We bind
   * `editor.on(eventName, …)` (Backbone-style); if the editor doesn't
   * support `on` (e.g. a bare object) the wire-up is a no-op.
   */
  function wireChangeEvents() {
    if (!editor || typeof editor.on !== 'function') return;
    for (const [ev, source] of CHANGE_EVENTS) {
      editor.on(ev, () => {
        if (destroyed) return;
        emit(Object.assign({ source }, readEditorContent(editor)));
      });
    }
  }

  /**
   * Unwire every event we registered on the editor. We rely on
   * `editor.off` (Backbone-style) when present, otherwise the teardown
   * is implicit via `editor.destroyAll()` which clears the listeners
   * for us. Defensive: missing method = no-op.
   */
  function unwireChangeEvents() {
    if (!editor || typeof editor.off !== 'function') return;
    for (const [ev] of CHANGE_EVENTS) {
      try { editor.off(ev); } catch (_err) { /* swallow */ }
    }
  }

  wireChangeEvents();

  // ----- Public handle methods ----------------------------------------

  const handle = {
    /** True after destroy() has run. */
    isDestroyed() { return destroyed; },

    /**
     * Replace the editor's canvas + stylesheet.
     * @param {{ html?: string, css?: string }} content
     * @returns {{ htmlApplied: boolean, cssApplied: boolean }}
     */
    setContent(content) {
      if (destroyed) return { htmlApplied: false, cssApplied: false };
      const result = writeEditorContent(editor, content);
      if (result.htmlApplied || result.cssApplied) {
        emit(Object.assign({ source: 'reset' }, readEditorContent(editor)));
      }
      return result;
    },

    /**
     * Snapshot the current canvas + stylesheet into the canonical
     * `{ html, css }` shape. Pure read; no side effects.
     * @returns {{ html: string, css: string }}
     */
    getContent() {
      if (destroyed) return { html: '', css: '' };
      return readEditorContent(editor);
    },

    /**
     * Subscribe to change events. Multiple subscribers are supported.
     * The returned function unsubscribes.
     * @param {(payload: { html: string, css: string, source: string }) => void} cb
     * @returns {() => void} dispose
     */
    onChange(cb) {
      if (typeof cb !== 'function') return () => {};
      if (destroyed) return () => {};
      listeners.add(cb);
      return function dispose() { listeners.delete(cb); };
    },

    /** Insert a generic section block. */
    addSection() {
      if (destroyed) return;
      if (!helpers || typeof helpers.addSection !== 'function') return;
      try { helpers.addSection(editor); } catch (_err) { /* swallow */ }
    },

    /** Insert a text block. */
    addText() {
      if (destroyed) return;
      if (!helpers || typeof helpers.addTextBlock !== 'function') return;
      try { helpers.addTextBlock(editor); } catch (_err) { /* swallow */ }
    },

    /**
     * Insert an image block.
     * @param {string} [src] optional image source URL
     */
    addImage(src) {
      if (destroyed) return;
      if (!helpers || typeof helpers.addImageBlock !== 'function') return;
      try { helpers.addImageBlock(editor, src); } catch (_err) { /* swallow */ }
    },

    /**
     * Insert an arbitrary embed (HTML/iframe/script) wrapped in a
     * data-embed div so the live-render pipeline can find it.
     * @param {string} code
     */
    insertEmbed(code) {
      if (destroyed) return;
      if (typeof code !== 'string' || !code.length) return;
      if (!helpers || typeof helpers.insertEmbed !== 'function') return;
      try { helpers.insertEmbed(editor, code); } catch (_err) { /* swallow */ }
    },

    /**
     * Step the UndoManager back by one. Returns true if a step was
     * actually performed.
     * @returns {boolean}
     */
    undo() {
      if (destroyed) return false;
      if (!editor || !editor.UndoManager) return false;
      try {
        const before = editor.UndoManager.hasUndo();
        editor.UndoManager.undo();
        return before === true;
      } catch (_err) {
        return false;
      }
    },

    /**
     * Step the UndoManager forward by one. Returns true if a step was
     * actually performed.
     * @returns {boolean}
     */
    redo() {
      if (destroyed) return false;
      if (!editor || !editor.UndoManager) return false;
      try {
        const before = editor.UndoManager.hasRedo();
        editor.UndoManager.redo();
        return before === true;
      } catch (_err) {
        return false;
      }
    },

    /**
     * Idempotent teardown. Safe to call twice. After destroy() every
     * other handle method is a no-op and `isDestroyed()` returns true.
     * @returns {void}
     */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unwireChangeEvents();
      try {
        if (editor && typeof editor.destroyAll === 'function') {
          editor.destroyAll();
        }
      } catch (_err) { /* swallow */ }
      listeners.clear();
      if (opts && typeof opts.onDomTeardown === 'function') {
        try { opts.onDomTeardown(); } catch (_err) { /* swallow */ }
      }
    },
  };

  return handle;
}

/**
 * Build a handle directly from a (possibly-mock) editor. Useful in
 * unit tests so the headless-testable surface can be exercised
 * without a real browser. Production code should always go through
 * `mountModeB` instead.
 *
 * @param {object} editor
 * @param {{ onDomTeardown?: () => void, insertHelpers?: ModeBInsertHelpers }} [opts]
 * @returns {object} handle
 */
export function createHandleForEditor(editor, opts) {
  return buildHandle(editor, opts);
}

// ---------------------------------------------------------------------------
// Public mount function
// ---------------------------------------------------------------------------

/**
 * Mount a "Build from scratch" (Mode B) surface into the given
 * container. The previous implementation has been removed; this
 * stand-in renders a plain rebuild notice and returns a no-op handle.
 *
 * In Node (no `document`/`window`) this rejects with a clear error.
 *
 * @param {Element|string} container  DOM element (or `selector` of one)
 * @param {{
 *   initial?: { html?: string, css?: string },
 *   onChange?: (payload: { html: string, css: string, source: string }) => void,
 *   onLoad?:   (handle: object) => void,
 * }} [opts]
 * @returns {Promise<object>} handle
 */
export function mountModeB(container, opts) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('mountModeB: requires a browser environment (document/window)'));
      return;
    }
    const el = resolveContainer(container);
    if (!el) {
      reject(new Error('mountModeB: container not found or not an Element'));
      return;
    }

    const notice = document.createElement('p');
    notice.textContent = 'This feature is being rebuilt.';
    el.textContent = '';
    el.appendChild(notice);

    const handle = buildHandle({}, {
      onDomTeardown() { notice.remove(); },
    });

    if (opts && typeof opts.onChange === 'function') {
      handle.onChange(opts.onChange);
    }
    if (opts && typeof opts.onLoad === 'function') {
      try { opts.onLoad(handle); } catch (_err) { /* swallow */ }
    }

    resolve(handle);
  });
}
