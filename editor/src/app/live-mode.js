/**
 * Live mode — "Edit Live Site". The real page renders untouched in a same-origin
 * srcdoc iframe (scripts/CSS/fonts intact); editing is driven from the parent:
 *   single-click  → select (and the element becomes draggable)
 *   double-click  → edit text inline (contentEditable)
 *   drag          → reorder (HTML5 DnD) — works for any element incl. word groups
 *   drag a stash card onto the canvas → insert at the drop target
 *   inspector     → live style via inline props (recorded to an override store for export)
 * MIT — RHOBEAR Designs (original)
 */
import { buildLiveDocument } from '../engine/live-render.js';
import { importHtml, exportHtml } from '../engine/io.js';
import { createOverlay } from '../engine/overlay.js';
import { computeSelectorPath, isTextEditableTag } from '../engine/inline-edit.js';
import { createOverrideStore, toStylesheet } from '../engine/style-overrides.js';
import { listFonts, getFont, fontStack } from '../library/fonts/index.js';

const EDIT_TRANSITIONS =
  '*{transition:background-color .25s ease,color .25s ease,border-color .25s ease,' +
  'padding .25s ease,margin .25s ease,font-size .25s ease,opacity .25s ease,box-shadow .25s ease,' +
  'background-image .25s ease!important}';
// In edit mode every element shows it's grabbable.
const EDIT_CURSOR = 'body *{cursor:pointer!important}[contenteditable="true"]{cursor:text!important;outline:2px solid #2dd4bf}';

const GRADIENTS = [
  'linear-gradient(135deg,#2dd4bf,#5eead4)',
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#0f2027,#2c5364)',
  'linear-gradient(135deg,#ff9a9e,#fad0c4)',
  'linear-gradient(135deg,#30cfd0,#330867)',
  'linear-gradient(135deg,#08080a,#1d2022)',
  'linear-gradient(120deg,#84fab0,#8fd3f4)',
];
const SHADOWS = [
  { label: 'None', value: 'none' },
  { label: 'Soft', value: '0 2px 8px rgba(0,0,0,.08)' },
  { label: 'Medium', value: '0 8px 24px rgba(0,0,0,.12)' },
  { label: 'Large', value: '0 20px 50px rgba(0,0,0,.2)' },
  { label: 'Glow', value: '0 0 24px rgba(45,212,191,.5)' },
];

export function createLiveMode(refs) {
  const { frame, overlayEl, inspectorBody, inspectorTag, floatbar, onStatus, onSelectionChange, onEdit3D, onZoomGesture, onPanGesture, onLoad } = refs;
  // Canvas zoom: the parent scales #live-host (iframe + overlay together), so the
  // overlay stays aligned. We only need the scale here to place the screen-space
  // chrome (floatbar / context menu / text bar) at the right spot.
  let viewportScale = 1;
  let spaceHeld = false;

  let store = createOverrideStore();
  let overlay = null;
  let rawSource = '';
  let parts = { html: '', css: '', scripts: [], title: null };
  let selectedEl = null;
  let selectedPath = '';
  let doc = null;
  let win = null;
  let dirty = false;
  let dragPayload = null;    // element-library card being dragged in
  let draggingEl = null;     // existing element being reordered
  let dropLine = null;
  let onOutline = null;
  let history = []; let hi = -1; let snapTimer = null; let mo = null; let restoring = false;
  let pickTargetLink = null; let textbar = null; let linkEl = null; let editing = false;

  const setStatus = (m) => { if (onStatus) onStatus(m); };

  function load(rawText, title) {
    rawSource = String(rawText || '');
    parts = importHtml(rawSource);
    store = createOverrideStore();
    selectedEl = null; selectedPath = '';
    frame.addEventListener('load', onFrameLoad, { once: true });
    frame.srcdoc = buildLiveDocument({ html: rawSource });
    setStatus(`Loaded ${title || parts.title || 'page'} — click to select, double-click to edit text, drag to move`);
    return parts.title || title || 'Untitled page';
  }

  function onFrameLoad() {
    try { doc = frame.contentDocument; win = frame.contentWindow; } catch (_e) { doc = null; win = null; }
    if (!doc) { setStatus('Could not access page (cross-origin) — preview only'); return; }
    injectStyle('rb-edit-transitions', EDIT_TRANSITIONS);
    injectStyle('rb-edit-cursor', EDIT_CURSOR);
    injectStyle('rb-overrides', '');
    // EDITOR-ONLY embed normalization (this <style> lives in the iframe head and is
    // never exported). Force every 3D embed transparent, keep the host selectable /
    // draggable even though its exported inline style is pointer-events:none, and stop
    // the inner canvas from swallowing clicks — this also rescues OLDER saves whose
    // baked-in OrbitControls canvas used to hijack every click over the embed.
    injectStyle('rb-embed-fix', '.rb-3d-embed{background:transparent!important;pointer-events:auto!important}.rb-3d-embed canvas{pointer-events:none!important;background:transparent!important}');
    dropLine = doc.createElement('div'); dropLine.id = 'rb-drop-line';
    dropLine.style.cssText = 'position:fixed;height:3px;background:#2dd4bf;z-index:2147483647;pointer-events:none;box-shadow:0 0 8px #2dd4bf;display:none';
    doc.body.appendChild(dropLine);

    if (overlay) overlay.destroy();
    overlay = createOverlay(overlayEl, frame, {
      fixedIframeBox: { x: 0, y: 0, width: overlayEl.clientWidth, height: overlayEl.clientHeight },
    });

    doc.addEventListener('mousemove', onHover, true);
    doc.addEventListener('mouseleave', () => overlay && overlay.showHover(null));
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('dblclick', onDblClick, true);
    doc.addEventListener('contextmenu', onContext, true);
    doc.addEventListener('focusout', onFocusOut, true);
    doc.addEventListener('input', () => { dirty = true; }, true);
    // Ctrl+Z/Y inside the iframe never reaches the parent document — handle it here.
    doc.addEventListener('keydown', onDocKeydown, true);
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('dragover', onDragOver, true);
    doc.addEventListener('drop', onDrop, true);
    win.addEventListener('scroll', reposition, true);
    // Canvas zoom/pan gestures originate INSIDE the iframe (events there don't
    // bubble to the parent), so we capture them here and forward to the shell.
    doc.addEventListener('wheel', onWheelGesture, { passive: false });
    doc.addEventListener('keydown', onSpaceKeyDown, true);
    doc.addEventListener('keyup', onSpaceKeyUp, true);
    refreshOutline();
    history = []; hi = -1; snap(); startObserving();
    onLoad && onLoad();
  }

  // ---- canvas zoom / pan (gestures forwarded to the shell viewport) ----
  function isTypingTarget(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el.getAttribute && el.getAttribute('contenteditable') === 'true'));
  }
  function onWheelGesture(e) {
    // Trackpad pinch arrives as a wheel event with ctrlKey set; Ctrl/Cmd+wheel too.
    if (!(e.ctrlKey || e.metaKey) || !onZoomGesture) return;
    e.preventDefault();
    onZoomGesture(e.deltaY, e.clientX, e.clientY);
  }
  function onSpaceKeyDown(e) { if (e.code === 'Space' && !editing && !isTypingTarget(e.target)) { spaceHeld = true; if (doc.body) doc.body.style.cursor = 'grab'; } }
  function onSpaceKeyUp(e) { if (e.code === 'Space') { spaceHeld = false; if (doc.body) doc.body.style.cursor = ''; } }
  let panLast = null;
  function startPan(e) {
    e.preventDefault();
    panLast = { x: e.clientX, y: e.clientY };
    if (doc.body) doc.body.style.cursor = 'grabbing';
    doc.addEventListener('pointermove', onPanMove, true);
    doc.addEventListener('pointerup', onPanUp, true);
  }
  function onPanMove(e) {
    if (!panLast || !onPanGesture) return;
    // iframe-internal deltas → screen px = ×scale (the host is scaled by `viewportScale`).
    onPanGesture((e.clientX - panLast.x) * viewportScale, (e.clientY - panLast.y) * viewportScale);
    panLast = { x: e.clientX, y: e.clientY };
  }
  function onPanUp() {
    panLast = null;
    if (doc.body) doc.body.style.cursor = spaceHeld ? 'grab' : '';
    doc.removeEventListener('pointermove', onPanMove, true);
    doc.removeEventListener('pointerup', onPanUp, true);
  }
  function setViewportScale(z) { viewportScale = z || 1; reposition(); if (selectedEl) positionFloatbar(selectedEl); }

  // ---- undo / redo (snapshot the page, cleaned of editor-only attrs) ----
  function cleanBodyHtml() {
    const clone = doc.body.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('[draggable]').forEach((n) => n.removeAttribute('draggable'));
    const dl = clone.querySelector('#rb-drop-line'); if (dl) dl.remove();
    return clone.innerHTML;
  }
  function snap() {
    if (!doc || restoring) return;
    const html = cleanBodyHtml();
    if (history[hi] === html) return;
    history = history.slice(0, hi + 1); history.push(html); hi = history.length - 1;
    if (history.length > 50) { history.shift(); hi--; }
  }
  function snapDebounced() { clearTimeout(snapTimer); snapTimer = setTimeout(snap, 350); }
  function startObserving() {
    if (mo) mo.disconnect();
    // While editing text, don't snapshot every keystroke — we snap once on focusout
    // so a single Ctrl+Z reverts the whole text change, not one character batch.
    mo = new win.MutationObserver(() => { if (!restoring && !editing) snapDebounced(); });
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  function restoreSnap(html) {
    restoring = true;
    deselect();
    if (dropLine && dropLine.parentNode) dropLine.remove();
    doc.body.innerHTML = html;
    doc.body.appendChild(dropLine);
    refreshOutline();
    setTimeout(() => { restoring = false; }, 0);
  }
  function undo() { if (hi > 0) { hi--; restoreSnap(history[hi]); setStatus('Undo'); } else setStatus('Nothing to undo'); }
  function redo() { if (hi < history.length - 1) { hi++; restoreSnap(history[hi]); setStatus('Redo'); } }

  // Keydown fired inside the iframe — mirror the parent's undo/redo/Escape so the
  // shortcut works while the user's focus is on the page they're editing.
  function onDocKeydown(e) {
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
      (t.getAttribute && t.getAttribute('contenteditable') === 'true'));
    if (e.key === 'Escape') { if (!inField) deselect(); else if (t.blur) t.blur(); return; }
    if (inField) return; // let native text undo work while actively editing a field
    const z = e.key === 'z' || e.key === 'Z';
    const y = e.key === 'y' || e.key === 'Y';
    if ((e.ctrlKey || e.metaKey) && z) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.ctrlKey || e.metaKey) && y) { e.preventDefault(); redo(); }
  }

  function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }

  function onHover(e) {
    if (draggingEl || dragPayload) return;
    const el = e.target;
    if (!el || el === doc.body || el === doc.documentElement || el === dropLine) { overlay && overlay.showHover(null); return; }
    overlay && overlay.showHover(rectOf(el));
  }

  function onClick(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1 || el === dropLine) return;
    // link-target picking: one click to choose where a link jumps
    if (pickTargetLink) {
      e.preventDefault(); e.stopPropagation();
      if (el !== doc.body && el !== doc.documentElement) {
        if (!el.id) el.id = 'rb-sec-' + Date.now().toString(36);
        pickTargetLink.setAttribute('href', '#' + el.id);
        setStatus(`Link now jumps to #${el.id}`);
      }
      pickTargetLink = null; injectStyle('rb-pick', ''); snap();
      return;
    }
    if (el.getAttribute('contenteditable') === 'true') return; // let caret work while editing
    e.preventDefault(); e.stopPropagation();
    if (el === doc.body || el === doc.documentElement) { deselect(); return; }
    selectElement(el);
  }

  function onDblClick(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    e.preventDefault(); e.stopPropagation();
    selectElement(el);
    snap(); // capture the pre-edit text so one Ctrl+Z reverts the whole change
    editing = true;
    el.setAttribute('contenteditable', 'true');
    el.draggable = false;
    el.focus();
    showTextbar(el);
    setStatus('Editing text — change font, size, color above; click away when done');
  }

  function onFocusOut(e) {
    const el = e.target;
    if (el && el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      el.removeAttribute('contenteditable');
      el.draggable = true;
      editing = false;
      dirty = true; hideTextbar(); snap();
    }
  }

  function selectElement(el) {
    // never select/drag the page itself — that's what dragged "everything"
    if (!el || el.nodeType !== 1 || el === doc.body || el === doc.documentElement) return;
    selectedEl = el;
    try { selectedPath = computeSelectorPath(el, doc.documentElement); } catch (_e) { selectedPath = ''; }
    overlay && overlay.showSelection(rectOf(el));
    positionFloatbar(el);
    const tag = (el.tagName || 'el').toLowerCase();
    if (inspectorTag) inspectorTag.textContent = `<${tag}>`;
    buildInspector(el, tag);
    if (onSelectionChange) onSelectionChange({ tag, el });
    setStatus(`Selected <${tag}> — drag to move, double-click to edit text`);
  }

  function selectParent() {
    const p = selectedEl && selectedEl.parentElement;
    if (p && p !== doc.body && p !== doc.documentElement) selectElement(p);
    else setStatus('Already at the top-level section');
  }

  function deselect() {
    if (selectedEl) { selectedEl.removeAttribute('contenteditable'); selectedEl.draggable = false; }
    selectedEl = null; selectedPath = '';
    overlay && overlay.clear(); hideFloatbar();
    if (inspectorTag) inspectorTag.textContent = '—';
    if (inspectorBody) inspectorBody.innerHTML = '';
    if (onSelectionChange) onSelectionChange(null);
  }

  function reposition() { if (selectedEl && overlay) overlay.showSelection(rectOf(selectedEl)); }

  // ---- styles (inline + override store) ----
  function injectStyle(id, css) {
    if (!doc) return null;
    let el = doc.getElementById(id);
    if (!el) { el = doc.createElement('style'); el.id = id; doc.head.appendChild(el); }
    el.textContent = css; return el;
  }
  function setStyle(prop, value) {
    if (!selectedEl) return;
    try { selectedEl.style.setProperty(prop, value); } catch (_e) {}
    if (selectedPath) { store.setStyle(selectedPath, prop, value); injectStyle('rb-overrides', toStylesheet(store)); }
    dirty = true;
    if (overlay) overlay.showSelection(rectOf(selectedEl));
  }

  // ---- drag a stash card onto the canvas (HTML5 DnD from the rail) ----
  function showDropLine(target, e) {
    if (!dropLine || !target || target === dropLine) return;
    const r = target.getBoundingClientRect();
    const after = (e.clientY - r.top) > r.height / 2;
    dropLine._target = target; dropLine._after = after;
    dropLine.style.display = 'block';
    dropLine.style.left = `${r.left}px`; dropLine.style.width = `${r.width}px`;
    dropLine.style.top = `${(after ? r.bottom : r.top) - 1}px`;
  }
  function hideDropLine() { if (dropLine) { dropLine.style.display = 'none'; dropLine._target = null; } }
  function onDragOver(e) {
    if (!dragPayload) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (_e) {}
    const t = e.target;
    if (t && t.nodeType === 1 && t !== dropLine) showDropLine(t, e);
  }
  function onDrop(e) {
    if (!dragPayload) return;
    e.preventDefault();
    const target = dropLine && dropLine._target ? dropLine._target : (e.target && e.target.nodeType === 1 ? e.target : null);
    insertElement(dragPayload, target, dropLine && dropLine._after);
    dragPayload = null; hideDropLine();
  }

  // ---- FREE MOVE: pointer-drag any element to place it ANYWHERE (transform) ----
  // Infinite-canvas feel — drag to the side, overlap, arrange. Non-destructive
  // (a CSS translate), exported as-is. Click without moving still just selects.
  let mvStart = null, mvBase = null, mvEl = null, mvMoved = false;
  function parseTranslate(el) {
    const m = (el.style.transform || '').match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px/);
    return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
  }
  function onPointerDown(e) {
    if (e.button === 1 || (e.button === 0 && spaceHeld)) { startPan(e); return; } // middle-drag / space-drag = pan
    if (pickTargetLink || e.button !== 0) return;
    const el = e.target;
    if (!el || el.nodeType !== 1 || el === dropLine) return;
    if (el === doc.body || el === doc.documentElement) return;
    if (el.getAttribute('contenteditable') === 'true') return;
    mvEl = el; mvStart = { x: e.clientX, y: e.clientY }; mvBase = parseTranslate(el); mvMoved = false;
    doc.addEventListener('pointermove', onPointerMove, true);
    doc.addEventListener('pointerup', onPointerUp, true);
  }
  function onPointerMove(e) {
    if (!mvStart) return;
    const dx = e.clientX - mvStart.x, dy = e.clientY - mvStart.y;
    if (!mvMoved && Math.hypot(dx, dy) < 4) return; // movement threshold (so clicks still select)
    if (!mvMoved) {
      mvMoved = true;
      if (selectedEl !== mvEl) selectElement(mvEl);
      mvEl.style.willChange = 'transform';
      setStatus('Moving — drop it anywhere');
    }
    e.preventDefault();
    mvEl.style.transform = `translate(${mvBase.x + dx}px, ${mvBase.y + dy}px)`;
    if (overlay) overlay.showSelection(rectOf(mvEl));
    positionFloatbar(mvEl);
  }
  function onPointerUp() {
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    if (mvMoved && mvEl) { mvEl.style.willChange = ''; dirty = true; snap(); setStatus('Placed'); }
    mvStart = null; mvEl = null; mvMoved = false;
  }

  // ---- insert / replace from element library ----
  let pendingReplace = false;
  function isContainer(el) { return /^(div|section|main|article|aside|nav|footer|header|ul|ol|form|body)$/i.test(el.tagName); }
  function nodeFromElObj(elObj) {
    if (elObj.css) { const cur = doc.getElementById('rb-lib-css'); injectStyle('rb-lib-css', (cur ? cur.textContent : '') + '\n' + elObj.css); }
    const tmp = doc.createElement('div'); tmp.innerHTML = String(elObj.html || '').trim();
    return tmp.firstElementChild || tmp;
  }
  // innerHTML-inserted <script> tags don't execute — re-create them so embeds (3D, etc.) run.
  function executeScripts(root) {
    if (!root || !doc) return;
    const list = root.tagName === 'SCRIPT' ? [root] : Array.from(root.querySelectorAll ? root.querySelectorAll('script') : []);
    for (const old of list) {
      const s = doc.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      s.textContent = old.textContent;
      if (old.parentNode) old.parentNode.replaceChild(s, old);
    }
  }
  function insertElement(elObj, atTarget, after) {
    if (!doc || !elObj) return;
    const node = nodeFromElObj(elObj);
    if (node.classList && node.classList.contains('rb-3d-embed')) node.style.background = 'transparent';
    if (pendingReplace && selectedEl && selectedEl.parentNode) {
      selectedEl.parentNode.replaceChild(node, selectedEl);
      pendingReplace = false; dirty = true; setStatus(`Replaced with ${elObj.name || 'element'}`);
      executeScripts(node); selectElement(node); refreshOutline(); return;
    }
    if (atTarget && atTarget.nodeType === 1 && atTarget.parentNode) {
      atTarget.parentNode.insertBefore(node, after ? atTarget.nextSibling : atTarget);
    } else {
      const c = (selectedEl && isContainer(selectedEl)) ? selectedEl : doc.body; c.appendChild(node);
    }
    executeScripts(node);
    dirty = true; setStatus(`Inserted ${elObj.name || 'element'}`);
    try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) {}
    selectElement(node); refreshOutline();
  }
  function beginReplace() {
    if (!selectedEl) { setStatus('Select an element first, then pick a replacement from the stash'); return; }
    pendingReplace = true; setStatus('Replace mode — click any element in the stash to swap it in');
  }
  function beginDragInsert(elObj) { dragPayload = elObj; }
  function insertImage(url, alt) {
    if (!doc || !url) return;
    const img = doc.createElement('img'); img.src = url; img.alt = alt || 'image';
    img.style.maxWidth = '100%'; img.style.display = 'block';
    const c = (selectedEl && isContainer(selectedEl)) ? selectedEl : doc.body; c.appendChild(img);
    dirty = true; setStatus('Inserted image'); selectElement(img); refreshOutline();
  }

  // ---- fonts ----
  function loadFontInFrame(family) {
    const f = getFont(family); if (!f || !doc) return;
    const id = 'rb-font-' + family.replace(/\W+/g, '-');
    if (doc.getElementById(id)) return;
    const link = doc.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = f.cssUrl; doc.head.appendChild(link);
  }
  function applyFont(family) { loadFontInFrame(family); setStyle('font-family', fontStack(family)); }

  // ---- toolbar ops ----
  function duplicateSelected() {
    if (!selectedEl || !selectedEl.parentNode) return;
    const clone = selectedEl.cloneNode(true); clone.removeAttribute('contenteditable');
    const t = parseTranslate(selectedEl);
    clone.style.transform = `translate(${t.x + 24}px, ${t.y + 24}px)`; // offset so the copy is visible
    selectedEl.parentNode.insertBefore(clone, selectedEl.nextSibling);
    dirty = true; setStatus('Duplicated (offset so you can see it)'); selectElement(clone); refreshOutline(); snap();
  }
  function deleteSelected() {
    if (!selectedEl || !selectedEl.parentNode) return;
    selectedEl.parentNode.removeChild(selectedEl); deselect(); dirty = true; setStatus('Deleted element'); refreshOutline();
  }
  function moveSelected(dir) {
    const el = selectedEl; if (!el || !el.parentNode) return;
    if (dir < 0 && el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling);
    else if (dir > 0 && el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el);
    dirty = true; reposition(); positionFloatbar(el); setStatus('Moved element'); refreshOutline();
  }

  // ---- context menu ----
  let ctxEl = null;
  function ensureCtx() {
    if (ctxEl) return ctxEl;
    ctxEl = document.createElement('div'); ctxEl.className = 'rb-ctx'; document.body.appendChild(ctxEl);
    document.addEventListener('click', hideCtx, true); window.addEventListener('blur', hideCtx);
    return ctxEl;
  }
  function hideCtx() { if (ctxEl) ctxEl.classList.remove('is-open'); }
  function onContext(e) {
    e.preventDefault();
    const el = e.target; if (!el || el.nodeType !== 1) return;
    selectElement(el);
    const fr = frame.getBoundingClientRect();
    const m = ensureCtx();
    const items = [
      ['⧉  Duplicate', duplicateSelected],
      ['⇄  Replace from stash', beginReplace],
      ['↰  Select parent', selectParent],
      ['↑  Move up', () => moveSelected(-1)],
      ['↓  Move down', () => moveSelected(1)],
      ['✎  Edit text', () => { selectedEl.setAttribute('contenteditable', 'true'); selectedEl.draggable = false; selectedEl.focus(); showTextbar(selectedEl); }],
      ['🗑  Delete', deleteSelected],
    ];
    m.innerHTML = '';
    for (const [label, fn] of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-ctx__item'; b.textContent = label;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); hideCtx(); fn(); });
      m.appendChild(b);
    }
    m.style.left = `${fr.left + e.clientX * viewportScale}px`; m.style.top = `${fr.top + e.clientY * viewportScale}px`; m.classList.add('is-open');
  }

  // ---- floating select bar ----
  function positionFloatbar(el) {
    if (!floatbar) return;
    const fr = frame.getBoundingClientRect(); const r = el.getBoundingClientRect();
    floatbar.style.top = `${Math.max(fr.top + 6, fr.top + r.top * viewportScale - 44)}px`;
    floatbar.style.left = `${fr.left + r.left * viewportScale}px`;
    floatbar.classList.add('is-visible');
  }
  function hideFloatbar() { if (floatbar) floatbar.classList.remove('is-visible'); }

  // ---- intent inspector ----
  function buildInspector(el, tag) {
    if (!inspectorBody) return;
    const cs = win.getComputedStyle(el);
    inspectorBody.innerHTML = '';
    inspectorBody.appendChild(renderFillSector(el, cs));
    inspectorBody.appendChild(renderSector({ name: 'Text', open: true, fields: [
      { label: 'Font', prop: 'font-family', type: 'font' },
      { label: 'Color', prop: 'color', type: 'color', value: cs.color },
      { label: 'Size', prop: 'font-size', type: 'text', value: cs.fontSize },
      { label: 'Weight', prop: 'font-weight', type: 'select', value: cs.fontWeight, options: ['300', '400', '500', '600', '700', '800'] },
      { label: 'Align', prop: 'text-align', type: 'select', value: cs.textAlign, options: ['left', 'center', 'right', 'justify'] },
    ] }));
    inspectorBody.appendChild(renderSector({ name: 'Spacing', open: false, fields: [
      { label: 'Padding', prop: 'padding', type: 'text', value: el.style.padding || cs.padding },
      { label: 'Margin', prop: 'margin', type: 'text', value: el.style.margin || cs.margin },
      { label: 'Radius', prop: 'border-radius', type: 'text', value: cs.borderRadius },
    ] }));
    inspectorBody.appendChild(renderSector({ name: 'Layout', open: false, fields: [
      { label: 'Display', prop: 'display', type: 'select', value: cs.display, options: ['block', 'flex', 'inline-block', 'inline', 'grid', 'none'] },
      { label: 'Width', prop: 'width', type: 'text', value: el.style.width || '' },
      { label: 'Height', prop: 'height', type: 'text', value: el.style.height || '' },
    ] }));
    inspectorBody.appendChild(renderEffectsSector(el, cs));
    if (linkInfo()) inspectorBody.appendChild(renderLinkSector());
    if (el.classList && el.classList.contains('rb-3d-embed')) inspectorBody.appendChild(render3DEmbedSector(el));
  }

  function render3DEmbedSector(el) {
    const body = document.createElement('div'); body.style.padding = '0 14px 14px';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rb-btn rb-btn--primary'; btn.style.width = '100%'; btn.textContent = '✦ Edit in 3D Studio';
    btn.addEventListener('click', () => { try { onEdit3D && onEdit3D(JSON.parse(el.getAttribute('data-rb-3d'))); } catch (_e) {} });
    body.appendChild(btn);
    return renderSector({ name: '3D scene', open: true, extra: body });
  }

  // ---- contextual text toolbar (font / size / color / bold / italic while editing) ----
  function ensureTextbar() {
    if (textbar) return textbar;
    textbar = document.createElement('div'); textbar.className = 'rb-textbar';
    document.body.appendChild(textbar);
    return textbar;
  }
  function mkBtn(label, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-textbar__btn'; b.textContent = label;
    b.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
    return b;
  }
  function showTextbar(el) {
    const bar = ensureTextbar(); bar.innerHTML = '';
    const cs = win.getComputedStyle(el);
    const font = document.createElement('select'); font.className = 'rb-select rb-textbar__font';
    const f0 = document.createElement('option'); f0.value = ''; f0.textContent = 'Font'; font.appendChild(f0);
    for (const fo of listFonts()) { const o = document.createElement('option'); o.value = fo.family; o.textContent = fo.family; font.appendChild(o); }
    font.addEventListener('change', () => { if (font.value) applyFont(font.value); });
    const size = document.createElement('input'); size.type = 'number'; size.className = 'rb-input rb-textbar__size'; size.min = '8'; size.max = '200';
    size.value = String(parseInt(cs.fontSize, 10) || 16);
    size.addEventListener('input', () => setStyle('font-size', size.value + 'px'));
    const color = document.createElement('input'); color.type = 'color'; color.className = 'rb-swatch'; color.value = rgbToHex(cs.color);
    color.addEventListener('input', () => setStyle('color', color.value));
    const bold = mkBtn('B', () => { doc.execCommand('bold'); dirty = true; }); bold.style.fontWeight = '800';
    const ital = mkBtn('i', () => { doc.execCommand('italic'); dirty = true; }); ital.style.fontStyle = 'italic';
    bar.appendChild(font); bar.appendChild(size); bar.appendChild(color); bar.appendChild(bold); bar.appendChild(ital);
    const fr = frame.getBoundingClientRect(); const r = el.getBoundingClientRect();
    bar.style.top = `${Math.max(56, fr.top + r.top * viewportScale - 46)}px`; bar.style.left = `${fr.left + r.left * viewportScale}px`;
    bar.classList.add('is-open');
  }
  function hideTextbar() { if (textbar) textbar.classList.remove('is-open'); }

  // ---- link editing ----
  function linkInfo() {
    if (!selectedEl) { linkEl = null; return null; }
    linkEl = (selectedEl.tagName === 'A') ? selectedEl : (selectedEl.querySelector ? selectedEl.querySelector('a') : null);
    return linkEl;
  }
  function pageAnchors() {
    const out = []; if (!doc) return out;
    doc.querySelectorAll('[id]').forEach((el) => { if (el.id && el.id !== 'rb-drop-line' && el.id.indexOf('rb-edit') !== 0) out.push({ id: el.id }); });
    return out;
  }
  function renderLinkSector() {
    const body = document.createElement('div');
    const hf = document.createElement('div'); hf.className = 'rb-field'; hf.innerHTML = '<span class="rb-field__label">Link URL</span>';
    const hrow = document.createElement('div'); hrow.className = 'rb-field__row';
    const input = document.createElement('input'); input.className = 'rb-input'; input.value = linkEl.getAttribute('href') || ''; input.placeholder = 'https://… or #section';
    input.addEventListener('change', () => { linkEl.setAttribute('href', input.value); dirty = true; snap(); setStatus('Link updated'); });
    hrow.appendChild(input); hf.appendChild(hrow); body.appendChild(hf);
    const jf = document.createElement('div'); jf.className = 'rb-field'; jf.innerHTML = '<span class="rb-field__label">Jump to a section on this page</span>';
    const sel = document.createElement('select'); sel.className = 'rb-select';
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = '— choose a section —'; sel.appendChild(o0);
    for (const a of pageAnchors()) { const o = document.createElement('option'); o.value = '#' + a.id; o.textContent = '#' + a.id; sel.appendChild(o); }
    sel.addEventListener('change', () => { if (sel.value) { linkEl.setAttribute('href', sel.value); input.value = sel.value; dirty = true; snap(); setStatus('Link jumps to ' + sel.value); } });
    jf.appendChild(sel); body.appendChild(jf);
    const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'rb-btn'; pick.style.width = '100%'; pick.textContent = '🎯 Pick a spot on the page';
    pick.addEventListener('click', () => { pickTargetLink = linkEl; injectStyle('rb-pick', 'body *{outline:1px dashed rgba(45,212,191,.5)!important}'); setStatus('Now click the spot this link should jump to'); });
    body.appendChild(pick);
    return renderSector({ name: 'Link', open: true, extra: body });
  }

  function renderSector(g) {
    const sec = document.createElement('div'); sec.className = 'rb-sector' + (g.open ? ' is-open' : '');
    const head = document.createElement('button'); head.type = 'button'; head.className = 'rb-sector__head';
    head.innerHTML = `${g.name}<span class="rb-sector__chev">›</span>`;
    head.addEventListener('click', () => sec.classList.toggle('is-open'));
    const body = document.createElement('div'); body.className = 'rb-sector__body';
    for (const f of (g.fields || [])) body.appendChild(renderField(f));
    if (g.extra) body.appendChild(g.extra);
    sec.appendChild(head); sec.appendChild(body); return sec;
  }

  function renderFillSector(el, cs) {
    const body = document.createElement('div');
    body.appendChild(renderField({ label: 'Background color', prop: 'background-color', type: 'color', value: cs.backgroundColor }));
    // gradients
    const gl = document.createElement('div'); gl.className = 'rb-field';
    gl.innerHTML = '<span class="rb-field__label">Gradient</span>';
    const grid = document.createElement('div'); grid.className = 'rb-swatch-grid';
    for (const g of GRADIENTS) {
      const s = document.createElement('button'); s.type = 'button'; s.className = 'rb-grad'; s.style.backgroundImage = g;
      s.title = 'Apply gradient'; s.addEventListener('click', () => setStyle('background-image', g));
      grid.appendChild(s);
    }
    gl.appendChild(grid); body.appendChild(gl);
    // background image
    const bi = document.createElement('div'); bi.className = 'rb-field';
    bi.innerHTML = '<span class="rb-field__label">Background image (URL)</span>';
    const row = document.createElement('div'); row.className = 'rb-field__row';
    const url = document.createElement('input'); url.className = 'rb-input'; url.placeholder = 'https://… or paste a gif';
    url.addEventListener('change', () => { if (url.value) { setStyle('background-image', `url('${url.value}')`); setStyle('background-size', 'cover'); setStyle('background-position', 'center'); } });
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'rb-btn rb-btn--icon'; clr.textContent = '✕'; clr.title = 'Clear';
    clr.addEventListener('click', () => setStyle('background-image', 'none'));
    row.appendChild(url); row.appendChild(clr); bi.appendChild(row); body.appendChild(bi);
    return renderSector({ name: 'Fill', open: true, extra: body });
  }

  function renderEffectsSector(el, cs) {
    const body = document.createElement('div');
    // opacity slider
    const op = document.createElement('div'); op.className = 'rb-field';
    op.innerHTML = '<span class="rb-field__label">Opacity</span>';
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'rb-range';
    slider.value = String(Math.round((parseFloat(cs.opacity) || 1) * 100));
    const val = document.createElement('span'); val.className = 'rb-range__val'; val.textContent = `${slider.value}%`;
    slider.addEventListener('input', () => { val.textContent = `${slider.value}%`; setStyle('opacity', String(slider.value / 100)); });
    const orow = document.createElement('div'); orow.className = 'rb-field__row'; orow.appendChild(slider); orow.appendChild(val);
    op.appendChild(orow); body.appendChild(op);
    // shadow presets
    const sh = document.createElement('div'); sh.className = 'rb-field';
    sh.innerHTML = '<span class="rb-field__label">Shadow</span>';
    const chips = document.createElement('div'); chips.className = 'rb-preset-row';
    for (const s of SHADOWS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-preset'; b.textContent = s.label;
      b.addEventListener('click', () => { setStyle('box-shadow', s.value); chips.querySelectorAll('.rb-preset').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); });
      chips.appendChild(b);
    }
    sh.appendChild(chips); body.appendChild(sh);
    return renderSector({ name: 'Effects', open: false, extra: body });
  }

  function renderField(f) {
    const wrap = document.createElement('div'); wrap.className = 'rb-field';
    const label = document.createElement('span'); label.className = 'rb-field__label'; label.textContent = f.label;
    const row = document.createElement('div'); row.className = 'rb-field__row';
    let input;
    if (f.type === 'font') {
      input = document.createElement('select'); input.className = 'rb-select';
      const cur = document.createElement('option'); cur.value = ''; cur.textContent = '— font —'; input.appendChild(cur);
      for (const fo of listFonts()) { const o = document.createElement('option'); o.value = fo.family; o.textContent = fo.family; input.appendChild(o); }
      input.addEventListener('change', () => { if (input.value) applyFont(input.value); });
    } else if (f.type === 'select') {
      input = document.createElement('select'); input.className = 'rb-select';
      for (const o of f.options) { const opt = document.createElement('option'); opt.value = o; opt.textContent = o; if (String(f.value) === o) opt.selected = true; input.appendChild(opt); }
      input.addEventListener('change', () => setStyle(f.prop, input.value));
    } else if (f.type === 'color') {
      input = document.createElement('input'); input.type = 'color'; input.className = 'rb-swatch'; input.value = rgbToHex(f.value);
      input.addEventListener('input', () => setStyle(f.prop, input.value));
      const txt = document.createElement('input'); txt.className = 'rb-input'; txt.value = f.value || '';
      txt.addEventListener('change', () => setStyle(f.prop, txt.value));
      row.appendChild(input); row.appendChild(txt);
      wrap.appendChild(label); wrap.appendChild(row); return wrap;
    } else {
      input = document.createElement('input'); input.type = 'text'; input.className = 'rb-input'; input.value = f.value || '';
      input.addEventListener('change', () => setStyle(f.prop, input.value));
    }
    row.appendChild(input); wrap.appendChild(label); wrap.appendChild(row); return wrap;
  }

  // ---- live layers outline ----
  function setOutlineHandler(cb) { onOutline = cb; }
  function refreshOutline() { if (onOutline) onOutline(getOutline()); }
  function getOutline() {
    if (!doc || !doc.body) return [];
    const out = [];
    (function walk(el, depth) {
      for (const child of el.children) {
        const tag = child.tagName.toLowerCase();
        if (['script', 'style', 'link'].includes(tag) || child.id === 'rb-drop-line') continue;
        const cls = (child.className && typeof child.className === 'string') ? '.' + child.className.trim().split(/\s+/)[0] : '';
        out.push({ node: child, depth, label: tag + cls, text: (child.textContent || '').trim().slice(0, 24) });
        if (depth < 5 && out.length < 300) walk(child, depth + 1);
      }
    })(doc.body, 0);
    return out;
  }
  function selectNode(node) { if (node) { selectElement(node); try { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_e) {} } }

  // ---- AI hooks: give the assistant context, apply its edits ----
  function getSelectionHtml() {
    if (selectedEl) return selectedEl.outerHTML;
    return doc ? doc.body.innerHTML.slice(0, 6000) : '';
  }
  function applyAIEdit(html) {
    if (!doc || !html) return false;
    const tmp = doc.createElement('div'); tmp.innerHTML = String(html).trim();
    const node = tmp.firstElementChild;
    if (!node) return false;
    if (selectedEl && selectedEl.parentNode) selectedEl.parentNode.replaceChild(node, selectedEl);
    else doc.body.appendChild(node);
    dirty = true; selectElement(node); refreshOutline(); snap();
    try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) {}
    return true;
  }

  // ---- export ----
  function captureEditedHtml() {
    if (doc && doc.body) {
      const clone = doc.body.cloneNode(true);
      clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
      clone.querySelectorAll('[draggable]').forEach((n) => n.removeAttribute('draggable'));
      clone.querySelectorAll('#rb-overrides,#rb-edit-transitions,#rb-edit-cursor,#rb-drop-line,#rb-lib-css').forEach((n) => n.remove());
      return clone.innerHTML;
    }
    return parts.html;
  }
  function getExport(title) {
    const html = captureEditedHtml();
    try { return exportHtml({ html, css: parts.css, scripts: parts.scripts, title: title || parts.title }, store); }
    catch (_e) { return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || 'page'}</title><style>${parts.css || ''}\n${toStylesheet(store)}</style></head><body>${html}</body></html>`; }
  }

  return {
    load, deselect, duplicateSelected, deleteSelected, moveSelected, selectParent,
    insertElement, insertImage, beginReplace, beginDragInsert,
    setOutlineHandler, getOutline, selectNode, undo, redo,
    getSelectionHtml, applyAIEdit,
    getExport, isDirty: () => dirty, hasSelection: () => !!selectedEl, reposition,
    setViewportScale,
  };
}

function rgbToHex(v) {
  if (!v) return '#000000';
  if (v[0] === '#') return v.length === 7 ? v : '#000000';
  const m = String(v).match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
