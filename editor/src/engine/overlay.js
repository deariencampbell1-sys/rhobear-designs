/**
 * @file Selection / hover overlay for the "Edit Live Site" mode.
 *
 *       The overlay is a sibling DOM element positioned on top of the
 *       iframe that hosts the live page. When the parent receives a
 *       `select` / `hover` message from the bridge (carrying the
 *       iframe-document rect of the target element), this module
 *       translates that rect into the parent viewport and repositions
 *       one (or two) absolutely positioned boxes inside a container.
 *
 *       Two layers:
 *         1. Pure geometry helpers (computeOverlayRect, clampRect,
 *            projectIframeRectToContainer) — usable in Node tests.
 *         2. createOverlay(container, iframe) — DOM controller that
 *            builds the boxes once and exposes showSelection /
 *            showHover / clear / destroy.
 *
 *       --------------------------------------------------------------------------
 *       Visuals are intentionally minimal and un-themed: a 1px solid
 *       outline for the selection, a 1px dashed outline for hover, and
 *       a small label chip in the top-left corner. No toolbar, no
 *       panel, no chrome. The human owner restyles ALL of it.
 *
 * @example
 *   const ov = createOverlay(document.getElementById('overlay-host'), iframe);
 *   bridge.onSelect(({ rect }) => ov.showSelection(rect));
 *   bridge.onHover(({ rect })  => ov.showHover(rect));
 *   bridge.onDeselect(() => ov.clear());
 */

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */

/** Default box colors. Plain, un-themed; restyled by the human owner. */
const SELECTION_COLOR = '#7c5cff'; // RHOBEAR brand purple (neutral choice)
const HOVER_COLOR     = '#3dd68c'; // success-green (neutral choice)

const Z_SELECTION = 2;
const Z_HOVER     = 1;

// ---------------------------------------------------------------------------
// Pure geometry (no DOM)
// ---------------------------------------------------------------------------

/**
 * Compute a DOMRect-like object. Useful in tests and for callers that
 * want to construct a Rect from raw inputs.
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {Rect}
 */
export function makeRect(x, y, width, height) {
  return {
    x: Number.isFinite(+x) ? +x : 0,
    y: Number.isFinite(+y) ? +y : 0,
    width: Number.isFinite(+width) ? Math.max(0, +width) : 0,
    height: Number.isFinite(+height) ? Math.max(0, +height) : 0,
  };
}

/**
 * Clamp a rect so it stays inside a viewport. Returns a new Rect; never
 * mutates the input. Negative sizes are replaced with 0.
 *
 * @param {Rect} rect
 * @param {Rect} viewport
 * @returns {Rect}
 */
export function clampRect(rect, viewport) {
  const x = Math.max(rect.x, viewport.x);
  const y = Math.max(rect.y, viewport.y);
  const right = Math.min(rect.x + rect.width, viewport.x + viewport.width);
  const bottom = Math.min(rect.y + rect.height, viewport.y + viewport.height);
  return makeRect(x, y, Math.max(0, right - x), Math.max(0, bottom - y));
}

/**
 * Translate an iframe-document-space rect into the parent's container
 * coordinate system, accounting for the iframe's bounding rect and
 * scroll offsets (the iframe is itself a scrollable document).
 *
 *   parentX = iframeRect.left - iframeScrollLeft + iframeRect.x_in_parent
 *
 * where iframeRect.left and iframeRect.top come from
 * `iframe.getBoundingClientRect()` (we read those here, but they can
 * be passed in explicitly for testing).
 *
 * @param {Rect}  iframeRect       — rect in the iframe's document coords
 * @param {Rect}  iframeBoxInParent — result of iframe.getBoundingClientRect()
 * @param {{x:number,y:number}} [scroll] — iframe content scroll (default 0,0)
 * @returns {Rect} a rect in the container's coordinate space, anchored
 *                 to the iframe's content (not its viewport scrollbars)
 */
export function projectIframeRectToContainer(iframeRect, iframeBoxInParent, scroll) {
  const sx = (scroll && Number.isFinite(scroll.x)) ? scroll.x : 0;
  const sy = (scroll && Number.isFinite(scroll.y)) ? scroll.y : 0;
  return makeRect(
    iframeBoxInParent.x + (iframeRect.x - sx),
    iframeBoxInParent.y + (iframeRect.y - sy),
    iframeRect.width,
    iframeRect.height,
  );
}

/**
 * Combine the two steps above: take an iframe-document-space rect and
 * produce a container-space rect, clamped to the container viewport.
 *
 * @param {Rect} iframeRect
 * @param {Rect} iframeBoxInParent
 * @param {Rect} containerViewport        — rect of the overlay container
 * @param {{x:number,y:number}} [scroll] — iframe content scroll
 * @returns {Rect}
 */
export function computeOverlayRect(iframeRect, iframeBoxInParent, containerViewport, scroll) {
  const projected = projectIframeRectToContainer(iframeRect, iframeBoxInParent, scroll);
  return clampRect(projected, containerViewport);
}

// ---------------------------------------------------------------------------
// DOM controller
// ---------------------------------------------------------------------------

/**
 * Mount an overlay onto `container` and align it with `iframe`.
 *
 * The container MUST be positioned (position: relative / absolute / fixed)
 * and must overlay the iframe exactly (same size & offset, pointer-events:
 * none). This module does not enforce that — it is the integrator's job.
 *
 * The iframe MAY be any HTMLIFrameElement. We read its bounding rect and
 * scroll on every show*() call so the overlay tracks layout changes.
 *
 * @param {HTMLElement} container
 * @param {HTMLIFrameElement|null} iframe  — may be null; geometry is supplied per-call
 * @param {Object} [opts]
 * @param {{x:number,y:number,width:number,height:number}} [opts.fixedIframeBox] —
 *        override the iframe bounding rect (useful when iframe is null, e.g.
 *        in headless tests).
 * @returns {{
 *   showSelection: (iframeRect: Rect) => boolean,
 *   showHover:     (iframeRect: Rect) => boolean,
 *   clear:         () => void,
 *   destroy:       () => void,
 *   elements:      { selection: HTMLElement, hover: HTMLElement, label: HTMLElement },
 * }}
 */
export function createOverlay(container, iframe, opts) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('createOverlay: container must be an HTMLElement');
  }
  const o = opts || {};
  const fixedIframeBox = o.fixedIframeBox || null;

  /** @type {HTMLElement} */
  const hover = createBox('rb-overlay-hover');
  /** @type {HTMLElement} */
  const selection = createBox('rb-overlay-selection');
  /** @type {HTMLElement} */
  const label = document.createElement('div');
  label.className = 'rb-overlay-label';
  selection.appendChild(label);

  container.appendChild(hover);
  container.appendChild(selection);
  setHidden(hover, true);
  setHidden(selection, true);

  /** Last iframe content scroll, refreshed per-call. */
  let lastScroll = { x: 0, y: 0 };

  /**
   * Read the iframe's current state.
   * @returns {{box: Rect, scroll: {x:number,y:number}, viewport: Rect}|null}
   */
  function readState() {
    const viewport = makeRect(0, 0, container.clientWidth, container.clientHeight);
    let box = fixedIframeBox;
    if (!box && iframe) {
      const r = iframe.getBoundingClientRect();
      box = makeRect(r.left, r.top, r.width, r.height);
    }
    if (!box) return null;

    let scroll = lastScroll;
    if (iframe) {
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.documentElement) {
          scroll = { x: doc.documentElement.scrollLeft || 0, y: doc.documentElement.scrollTop || 0 };
          lastScroll = scroll;
        }
      } catch (_err) {
        // Cross-origin: can't read scroll. Use cached value.
        scroll = lastScroll;
      }
    }
    return { box, scroll, viewport };
  }

  /**
   * Position a box at the given iframe-document rect and reveal it.
   * @param {HTMLElement} el
   * @param {Rect} iframeRect
   * @returns {boolean}
   */
  function place(el, iframeRect) {
    const state = readState();
    if (!state) return false;
    const rect = computeOverlayRect(iframeRect, state.box, state.viewport, state.scroll);
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    return true;
  }

  /**
   * @param {Rect} iframeRect
   */
  function showSelection(iframeRect) {
    if (!iframeRect) { clear(); return; }
    if (place(selection, iframeRect)) {
      setHidden(selection, false);
    }
  }

  /**
   * Set the small label inside the selection box. Pass null to clear.
   * @param {string|null} text
   */
  function setLabel(text) {
    if (text == null) {
      label.textContent = '';
      label.style.display = 'none';
    } else {
      label.textContent = text;
      label.style.display = '';
    }
  }

  /**
   * @param {Rect} iframeRect
   */
  function showHover(iframeRect) {
    if (!iframeRect) {
      setHidden(hover, true);
      return;
    }
    if (place(hover, iframeRect)) {
      setHidden(hover, false);
    }
  }

  function clear() {
    setHidden(selection, true);
    setHidden(hover, true);
    setLabel(null);
  }

  function destroy() {
    try { container.removeChild(hover); } catch (_e) { console.error('overlay destroy hover:', _e); }
    try { container.removeChild(selection); } catch (_e) { console.error('overlay destroy selection:', _e); }
    setHidden(hover, true);
    setHidden(selection, true);
  }

  // Expose a test/debug handle to current elements.
  return {
    showSelection,
    showHover,
    setLabel,
    clear,
    destroy,
    elements: { selection, hover, label },
  };
}

// ---------------------------------------------------------------------------
// Internal DOM helpers (browser-only)
// ---------------------------------------------------------------------------

/**
 * @param {string} className
 * @returns {HTMLElement}
 */
function createBox(className) {
  const el = document.createElement('div');
  el.className = className;
  // Functional, un-themed defaults. The owner restyles.
  el.style.position = 'absolute';
  el.style.boxSizing = 'border-box';
  el.style.pointerEvents = 'none';
  el.style.willChange = 'transform, width, height';
  el.style.background = 'transparent';
  el.style.margin = '0';
  el.style.padding = '0';
  return el;
}

/** @param {HTMLElement} el @param {boolean} hidden */
function setHidden(el, hidden) {
  el.style.display = hidden ? 'none' : 'block';
  // The label is its own thing; we just hide the whole box.
}

// Apply un-themed visual defaults via injected style. Kept minimal so
// the human owner can rewrite it. Injected once on module load in
// browsers; ignored in Node.
if (typeof document !== 'undefined' && !document.getElementById('rb-overlay-styles')) {
  const s = document.createElement('style');
  s.id = 'rb-overlay-styles';
  s.textContent = `
    .rb-overlay-selection {
      border: 1px solid ${SELECTION_COLOR};
      z-index: ${Z_SELECTION};
    }
    .rb-overlay-hover {
      border: 1px dashed ${HOVER_COLOR};
      z-index: ${Z_HOVER};
    }
    .rb-overlay-label {
      position: absolute;
      left: 0;
      top: 0;
      transform: translateY(-100%);
      background: ${SELECTION_COLOR};
      color: #fff;
      font: 11px/1.2 system-ui, sans-serif;
      padding: 2px 6px;
      white-space: nowrap;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}