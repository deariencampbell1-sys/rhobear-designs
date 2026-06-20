/**
 * @file Headless "Build from scratch" (Mode B) lifecycle wrapper around
 *       the vendored GrapesJS editor.
 *
 *       The product exposes two editing experiences:
 *         - Mode A ("Edit Live Site") — wrapper around an existing page
 *           source; non-destructive overlay editing (see live-render.js,
 *           overlay.js, style-overrides.js, diff-serializer.js, …).
 *         - Mode B ("Build from scratch") — a clean GrapesJS canvas
 *           bound to a fresh, empty project. This file.
 *
 *       This module is the ONLY surface in the project that touches
 *       GrapesJS directly. The human-built shell MUST go through
 *       `mountModeB(container, opts)` to obtain a `handle` and then
 *       call only the documented handle methods. The shell never
 *       `import`s grapesjs or `../editor/grapes-init.js` itself.
 *
 *       Why this seam exists:
 *         - The GrapesJS plugin (presets, blocks, custom-code) and the
 *           panel DOM targets (`#gjs-blocks`, `#gjs-layers`, …) are
 *           wired in `editor/src/editor/grapes-init.js`. That file
 *           assumes a specific shell layout.
 *         - The shell may be redesigned, restyled, or replaced. By
 *           forcing all GrapesJS coupling through one function, we
 *           keep the rest of the codebase — including the headless
 *           document core — decoupled from a particular GrapesJS
 *           version or shell layout.
 *
 *       Public API:
 *
 *         mountModeB(container, opts?) -> Promise<handle>
 *           Initialize a GrapesJS editor inside the given container
 *           element. The container is augmented with the DOM scaffolding
 *           the existing GrapesJS init expects (canvas + block/layer/
 *           style/trait panels + status row). Returns a `handle` object
 *           exposing the full set of operations below. Safe to call
 *           multiple times on different containers; each call returns an
 *           independent handle. The function is async because the
 *           GrapesJS-coupled helper module is loaded via dynamic
 *           import so the headless test surface stays runnable in
 *           plain Node without a CSS loader.
 *
 *         handle.setContent({ html, css })
 *           Replace the editor's current canvas with the given HTML
 *           fragment + CSS. Equivalent to "open this document". Pass
 *           either field as an empty string to leave that slot alone.
 *
 *         handle.getContent() -> { html, css }
 *           Return the current document as `{ html, css }` in the
 *           canonical shape used throughout the engine: body-level
 *           HTML fragment (no <html>/<head>/<body> wrapper) + collected
 *           CSS. The output is round-trip stable through the headless
 *           `core` serializer: `serialize(deserialize(getContent()))`
 *           equals the structure of `getContent()` (modulo cosmetic
 *           attribute ordering) and is safe to feed to `setContent`
 *           again.
 *
 *         handle.onChange(cb)
 *           Subscribe to editor change events. The callback receives a
 *           normalized payload `{ html, css, source: 'component' | 'style'
 *           | 'reset' | 'project' }` whenever the canvas or stylesheet
 *           has changed. Multiple subscribers are supported; each
 *           receives a `dispose()` function that unsubscribes.
 *
 *         handle.addSection() / handle.addText() / handle.addImage(src?)
 *         / handle.insertEmbed(code)
 *           Thin delegates to the existing `editor/grapes-init.js`
 *           helpers. They are exposed as no-arg handle methods so the
 *           shell never needs to know the helpers' signatures.
 *
 *         handle.undo() / handle.redo()
 *           Step the GrapesJS UndoManager. Returns `true` if a step was
 *           performed, `false` otherwise (e.g. nothing to undo).
 *
 *         handle.destroy()
 *           Idempotent teardown. Detaches every listener, releases the
 *           GrapesJS editor (calling `editor.destroyAll()`), removes the
 *           DOM scaffolding we added to the container, and resolves
 *           the handle to a no-op stub. Safe to call twice.
 *
 *         handle.isDestroyed() -> boolean
 *           True once `destroy()` has been called.
 *
 *       Stability contract:
 *         - No DOM dependency for the headless helpers (`getContent`,
 *           `setContent` core round-trip, change-payload normalization,
 *           teardown idempotency). They can be unit-tested in Node
 *           without a real GrapesJS instance.
 *         - The DOM-dependent mount path is covered by a Playwright
 *           spec at `editor/tests/e2e/mode-b.spec.js`.
 *         - The handle's public surface is locked: methods documented
 *           here are part of the API; everything else is an internal
 *           detail and may change.
 *
 *       Limits:
 *         - GrapesJS's editor instance, UndoManager, and plugin options
 *           are NOT exposed on the handle. The handle is intentionally
 *           narrower than the underlying editor to keep GrapesJS
 *           specifics out of the shell.
 *         - The CSS slot only handles a single global stylesheet. The
 *           canvas's own <style> blocks remain in `getHtml()`; the
 *           `css` slot aggregates the editor's CSS rules. Mixing inline
 *           `<style>` tags inside `setContent({ html })` is supported
 *           and they will be reflected in subsequent `getContent()`
 *           calls (GrapesJS re-extracts them on read).
 *
 *       Why `mountModeB` is async:
 *         The GrapesJS-coupled helper module
 *         (`../editor/grapes-init.js`) transitively imports a CSS
 *         stylesheet (`../vendor/grapesjs/.../grapes.min.css`) which
 *         only resolves under a bundler (Vite). Node's loader refuses
 *         it. We use a dynamic import inside `mountModeB` so that the
 *         headless test surface (which is the explicitly required
 *         scope per the spec) runs in plain Node. The shell awaits the
 *         returned promise; headless tests never reach this branch.
 */

import { serialize, deserialize } from '../core/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * DOM IDs the existing `createEditor()` expects to find in the page.
 * Mounted into the container before GrapesJS is initialized so the
 * shell never needs to know about these specific IDs.
 * @type {readonly string[]}
 */
const REQUIRED_IDS = Object.freeze([
  'gjs',              // main canvas
  'gjs-blocks',       // block manager append target
  'gjs-layers',       // layer manager append target
  'gjs-styles',       // style manager append target
  'gjs-traits',       // trait manager append target
  'status-selection', // selected-component status row
]);

/** Container class we add to the host element so CSS can scope overrides. */
const HOST_CLASS = 'rb-modeb-host';

/**
 * GrapesJS events we listen on. Listed in one place so wire/unwire
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
 * Read `{ html, css }` from a GrapesJS editor instance. The editor is
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
 * Write a `{ html, css }` payload into a GrapesJS editor instance via
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
// DOM scaffolding (browser-only)
// ---------------------------------------------------------------------------

/**
 * Build the DOM scaffolding `createEditor()` requires, inside the host
 * container. Returns a teardown function that removes every node we
 * added, restoring the container to its pre-mount state.
 *
 * Idempotent: if the container already has the required nodes (e.g.
 * because the shell pre-rendered them) we still consider the mount
 * successful and the teardown function will only remove the nodes we
 * actually own (i.e. ones that did NOT exist before mount).
 *
 * @param {Element} container
 * @returns {{ created: boolean, teardown: () => void }}
 */
function mountScaffolding(container) {
  /** @type {Array<{ id: string, el: HTMLElement, owned: boolean }>} */
  const nodes = [];
  let anyCreated = false;

  for (const id of REQUIRED_IDS) {
    let el = /** @type {HTMLElement | null} */ (container.querySelector('#' + id));
    let owned = false;
    if (!el) {
      el = /** @type {HTMLElement} */ (document.createElement('div'));
      el.id = id;
      container.appendChild(el);
      owned = true;
      anyCreated = true;
    }
    nodes.push({ id, el, owned });
  }

  function teardown() {
    // Only remove the nodes we created; pre-existing nodes (if any) are
    // the caller's responsibility.
    for (const n of nodes) {
      if (n.owned && n.el.parentNode) {
        n.el.parentNode.removeChild(n.el);
      }
    }
  }

  return { created: anyCreated, teardown };
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
 * Create a handle that wraps a GrapesJS editor instance. Pure logic
 * where possible: change-payload normalization, content read/write,
 * and destroy idempotency are all testable without a real browser
 * by passing a mock editor object. Only `mountModeB` requires a real
 * DOM + GrapesJS to run.
 *
 * The optional `insertHelpers` parameter carries the GrapesJS-coupled
 * insertion functions. In production they come from
 * `editor/grapes-init.js`. In tests they can be left undefined (the
 * insert methods become no-ops) or supplied as lightweight mocks.
 *
 * @param {object} editor              GrapesJS editor instance
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
 * Mount a "Build from scratch" (Mode B) editor into the given
 * container.
 *
 * The function:
 *   1. Validates the container.
 *   2. Dynamically loads the GrapesJS-coupled helper module
 *      (`editor/src/editor/grapes-init.js`) — this is async because
 *      that module transitively imports a CSS file that only a
 *      bundler can resolve.
 *   3. Adds the required DOM scaffolding for the existing GrapesJS
 *      init (`#gjs`, `#gjs-blocks`, `#gjs-layers`, `#gjs-styles`,
 *      `#gjs-traits`, `#status-selection`).
 *   4. Calls `createEditor()`.
 *   5. Returns a `handle` that exposes the full API documented above.
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

    // Load the GrapesJS-coupled helper module. We use a dynamic
    // import so the headless test surface (which only imports the
    // pure helpers from this file) never sees the CSS import.
    import('../editor/grapes-init.js').then((gjs) => {
      try {
        // 1. DOM scaffolding
        const scaffold = mountScaffolding(el);

        // 2. Initialize GrapesJS via the existing helper.
        let editor;
        try {
          editor = gjs.createEditor();
        } catch (err) {
          // If GrapesJS init fails, roll back the DOM we added.
          scaffold.teardown();
          reject(err);
          return;
        }

        // 3. Build the handle, wiring DOM teardown + insert helpers.
        const handle = buildHandle(editor, {
          onDomTeardown: scaffold.teardown,
          insertHelpers: {
            addSection:    gjs.addSection,
            addTextBlock:  gjs.addTextBlock,
            addImageBlock: gjs.addImageBlock,
            insertEmbed:   gjs.insertEmbed,
          },
        });

        // 4. Mark the host container so the shell can scope CSS if it wants.
        if (typeof el.classList !== 'undefined') {
          el.classList.add(HOST_CLASS);
        }

        // 5. Apply initial content if provided.
        const initial = opts && opts.initial;
        if (initial) {
          // setComponents must run after GrapesJS is fully ready; we
          // do it synchronously here and again on `load` (GrapesJS
          // may reset components on the very first 'load' event
          // depending on plugin order). Idempotent: the second call
          // is a no-op if the canvas already matches.
          try {
            handle.setContent(initial);
          } catch (_err) { /* swallow — handle.setContent never throws */ }

          if (typeof editor.on === 'function') {
            const apply = () => {
              try { handle.setContent(initial); } catch (_err) { /* swallow */ }
            };
            editor.on('load', apply);
          }
        }

        // 6. Wire optional callbacks. `onChange` is a sugar wrapper
        //    around `handle.onChange` so the shell doesn't have to
        //    manage dispose unless it wants to.
        if (opts && typeof opts.onChange === 'function') {
          handle.onChange(opts.onChange);
        }

        // 7. Optional load callback. Fires once GrapesJS is fully ready.
        if (opts && typeof opts.onLoad === 'function') {
          const fire = () => {
            if (handle.isDestroyed()) return;
            try { opts.onLoad(handle); } catch (_err) { /* swallow */ }
          };
          if (typeof editor.on === 'function') {
            editor.on('load', fire);
          } else {
            // Defensive: fire on next microtask if 'on' is unavailable.
            Promise.resolve().then(fire);
          }
        }

        resolve(handle);
      } catch (err) {
        reject(err);
      }
    }, (err) => {
      // Could not load the GrapesJS helper module (e.g. CSS not
      // resolvable outside a bundler).
      reject(err);
    });
  });
}
