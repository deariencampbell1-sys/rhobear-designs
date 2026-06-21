/**
 * Live mode — "Edit Live Site".
 * The real page renders untouched in a same-origin srcdoc iframe (scripts +
 * CSS + fonts intact), and we drive editing from the PARENT directly:
 * click-to-select, inline text edit, and non-destructive style overrides
 * injected as a stylesheet (graceful repaint, never a reload).
 *
 * Pure engine helpers do the heavy lifting:
 *   live-render.buildLiveDocument  — faithful render
 *   io.importHtml / io.exportHtml  — model + clean export
 *   overlay.createOverlay          — selection/hover boxes
 *   inline-edit.computeSelectorPath / isTextEditableTag
 *   style-overrides.createOverrideStore / toStylesheet
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
  'padding .25s ease,margin .25s ease,font-size .25s ease,opacity .25s ease!important}';

export function createLiveMode(refs) {
  const { frame, overlayEl, inspectorBody, inspectorTag, floatbar, onStatus, onSelectionChange } = refs;

  let store = createOverrideStore();
  let overlay = null;
  let rawSource = '';
  let parts = { html: '', css: '', scripts: [], title: null };
  let selectedEl = null;
  let selectedPath = '';
  let doc = null;
  let win = null;
  let dirty = false;

  function setStatus(msg) { if (onStatus) onStatus(msg); }

  /** Load raw HTML text and render it faithfully. */
  function load(rawText, title) {
    rawSource = String(rawText || '');
    parts = importHtml(rawSource);
    store = createOverrideStore();
    selectedEl = null; selectedPath = '';
    const docString = buildLiveDocument({ html: rawSource });
    frame.addEventListener('load', onFrameLoad, { once: true });
    frame.srcdoc = docString;
    setStatus(`Loaded ${title || parts.title || 'page'} — click any element to edit`);
    return parts.title || title || 'Untitled page';
  }

  function onFrameLoad() {
    try {
      doc = frame.contentDocument;
      win = frame.contentWindow;
    } catch (_e) { doc = null; win = null; }
    if (!doc) { setStatus('Could not access page (cross-origin) — preview only'); return; }

    // graceful repaint transitions
    injectStyle('rb-edit-transitions', EDIT_TRANSITIONS);
    ensureOverrideStyle();

    // overlay tracking the iframe. overlayEl COINCIDES with the iframe (inset:0
    // over it), so the overlay's coordinate origin is already the iframe's
    // top-left — pass a zero-origin box so the engine doesn't add the iframe's
    // parent-viewport offset again (that double-offset was the ~1-line drop).
    if (overlay) overlay.destroy();
    overlay = createOverlay(overlayEl, frame, {
      fixedIframeBox: { x: 0, y: 0, width: overlayEl.clientWidth, height: overlayEl.clientHeight },
    });

    // interaction listeners (same-origin srcdoc → direct)
    doc.addEventListener('mousemove', onHover, true);
    doc.addEventListener('mouseleave', () => overlay && overlay.showHover(null));
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('contextmenu', onContext, true);
    doc.addEventListener('input', onInlineInput, true);
    doc.addEventListener('dragover', onDragOver, true);
    doc.addEventListener('drop', onDrop, true);
    win.addEventListener('scroll', reposition, true);
    refreshOutline();
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  function onHover(e) {
    const el = e.target;
    if (!el || el === doc.body || el === doc.documentElement) { overlay && overlay.showHover(null); return; }
    overlay && overlay.showHover(rectOf(el));
  }

  function onClick(e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    // Let links/buttons not navigate while editing
    e.preventDefault(); e.stopPropagation();
    selectElement(el);
  }

  function selectElement(el) {
    selectedEl = el;
    try { selectedPath = computeSelectorPath(el, doc.documentElement); }
    catch (_e) { selectedPath = ''; }
    overlay && overlay.showSelection(rectOf(el));
    positionFloatbar(el);
    const tag = (el.tagName || 'el').toLowerCase();
    if (inspectorTag) inspectorTag.textContent = `<${tag}>`;
    // inline text editing for text-bearing elements
    const editable = isTextEditableTag(tag) || (el.children.length === 0 && el.textContent.trim());
    if (editable) { el.setAttribute('contenteditable', 'true'); }
    buildInspector(el, tag);
    if (onSelectionChange) onSelectionChange({ tag, el });
    setStatus(`Selected <${tag}>`);
  }

  function deselect() {
    if (selectedEl) selectedEl.removeAttribute('contenteditable');
    selectedEl = null; selectedPath = '';
    overlay && overlay.clear();
    hideFloatbar();
    if (inspectorTag) inspectorTag.textContent = '—';
    if (inspectorBody) inspectorBody.innerHTML = '';
    if (onSelectionChange) onSelectionChange(null);
  }

  function reposition() {
    if (selectedEl && overlay) overlay.showSelection(rectOf(selectedEl));
  }

  // ---- inline text ----
  function onInlineInput(e) {
    const el = e.target;
    if (!el || el.getAttribute('contenteditable') !== 'true') return;
    dirty = true;
    setStatus('Text edited');
    if (overlay) overlay.showSelection(rectOf(el));
  }

  // ---- style overrides ----
  function ensureOverrideStyle() { injectStyle('rb-overrides', ''); }
  function injectStyle(id, css) {
    if (!doc) return;
    let el = doc.getElementById(id);
    if (!el) { el = doc.createElement('style'); el.id = id; doc.head.appendChild(el); }
    el.textContent = css;
    return el;
  }
  function applyOverrideStylesheet() {
    injectStyle('rb-overrides', toStylesheet(store));
    dirty = true;
    if (selectedEl && overlay) overlay.showSelection(rectOf(selectedEl));
  }
  function setStyle(prop, value) {
    if (!selectedEl) return;
    // Apply inline for reliable, immediate, high-specificity effect (Fill /
    // Text / Spacing / Effects all "just work" — beats the page's own CSS).
    try { selectedEl.style.setProperty(prop, value); } catch (_e) { /* invalid value */ }
    // Also record in the override store for clean export + future AI/undo.
    if (selectedPath) { store.setStyle(selectedPath, prop, value); applyOverrideStylesheet(); }
    dirty = true;
    if (overlay && selectedEl) overlay.showSelection(rectOf(selectedEl));
  }

  // ---- intent inspector (clean, no dial-wall) ----
  function buildInspector(el, tag) {
    if (!inspectorBody) return;
    const cs = win.getComputedStyle(el);
    const groups = [
      { id: 'fill', name: 'Fill', open: true, fields: [
        { label: 'Background', prop: 'background-color', type: 'color', value: cs.backgroundColor },
      ]},
      { id: 'text', name: 'Text', open: true, fields: [
        { label: 'Font', prop: 'font-family', type: 'font', value: cs.fontFamily },
        { label: 'Color', prop: 'color', type: 'color', value: cs.color },
        { label: 'Size', prop: 'font-size', type: 'text', value: cs.fontSize },
        { label: 'Weight', prop: 'font-weight', type: 'select', value: cs.fontWeight,
          options: ['300','400','500','600','700','800'] },
        { label: 'Align', prop: 'text-align', type: 'select', value: cs.textAlign,
          options: ['left','center','right','justify'] },
      ]},
      { id: 'spacing', name: 'Spacing', open: false, fields: [
        { label: 'Padding', prop: 'padding', type: 'text', value: cs.padding },
        { label: 'Margin', prop: 'margin', type: 'text', value: cs.margin },
        { label: 'Radius', prop: 'border-radius', type: 'text', value: cs.borderRadius },
      ]},
      { id: 'layout', name: 'Layout', open: false, fields: [
        { label: 'Display', prop: 'display', type: 'select', value: cs.display,
          options: ['block','flex','inline-block','inline','grid','none'] },
        { label: 'Width', prop: 'width', type: 'text', value: el.style.width || '' },
      ]},
      { id: 'effects', name: 'Effects', open: false, fields: [
        { label: 'Opacity', prop: 'opacity', type: 'text', value: cs.opacity },
        { label: 'Shadow', prop: 'box-shadow', type: 'text', value: el.style.boxShadow || '' },
      ]},
    ];
    inspectorBody.innerHTML = '';
    for (const g of groups) inspectorBody.appendChild(renderSector(g));
  }

  function renderSector(g) {
    const sec = document.createElement('div');
    sec.className = 'rb-sector' + (g.open ? ' is-open' : '');
    const head = document.createElement('button');
    head.type = 'button'; head.className = 'rb-sector__head';
    head.innerHTML = `${g.name}<span class="rb-sector__chev">›</span>`;
    head.addEventListener('click', () => sec.classList.toggle('is-open'));
    const body = document.createElement('div');
    body.className = 'rb-sector__body';
    for (const f of g.fields) body.appendChild(renderField(f));
    sec.appendChild(head); sec.appendChild(body);
    return sec;
  }

  function renderField(f) {
    const wrap = document.createElement('div');
    wrap.className = 'rb-field';
    const label = document.createElement('span');
    label.className = 'rb-field__label'; label.textContent = f.label;
    const row = document.createElement('div'); row.className = 'rb-field__row';
    let input;
    if (f.type === 'font') {
      input = document.createElement('select'); input.className = 'rb-select';
      const cur = document.createElement('option'); cur.value = ''; cur.textContent = '— font —';
      input.appendChild(cur);
      for (const fo of listFonts()) {
        const o = document.createElement('option'); o.value = fo.family; o.textContent = fo.family;
        input.appendChild(o);
      }
      input.addEventListener('change', () => { if (input.value) applyFont(input.value); });
    } else if (f.type === 'select') {
      input = document.createElement('select'); input.className = 'rb-select';
      for (const o of f.options) {
        const opt = document.createElement('option'); opt.value = o; opt.textContent = o;
        if (String(f.value) === o) opt.selected = true;
        input.appendChild(opt);
      }
      input.addEventListener('change', () => setStyle(f.prop, input.value));
    } else if (f.type === 'color') {
      input = document.createElement('input'); input.type = 'color'; input.className = 'rb-swatch';
      input.value = rgbToHex(f.value);
      input.addEventListener('input', () => setStyle(f.prop, input.value));
      const txt = document.createElement('input'); txt.className = 'rb-input'; txt.value = f.value || '';
      txt.addEventListener('change', () => setStyle(f.prop, txt.value));
      row.appendChild(input); row.appendChild(txt);
      wrap.appendChild(label); wrap.appendChild(row); return wrap;
    } else {
      input = document.createElement('input'); input.type = 'text'; input.className = 'rb-input';
      input.value = f.value || '';
      input.addEventListener('change', () => setStyle(f.prop, input.value));
    }
    row.appendChild(input);
    wrap.appendChild(label); wrap.appendChild(row);
    return wrap;
  }

  // ---- floating select bar ----
  function positionFloatbar(el) {
    if (!floatbar) return;
    const fr = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = fr.top + r.top - 44;
    const left = fr.left + r.left;
    floatbar.style.top = `${Math.max(fr.top + 6, top)}px`;
    floatbar.style.left = `${left}px`;
    floatbar.classList.add('is-visible');
  }
  function hideFloatbar() { if (floatbar) floatbar.classList.remove('is-visible'); }

  // ---- toolbar ops ----
  function duplicateSelected() {
    if (!selectedEl || !selectedEl.parentNode) return;
    const clone = selectedEl.cloneNode(true);
    selectedEl.parentNode.insertBefore(clone, selectedEl.nextSibling);
    dirty = true; setStatus('Duplicated element'); reposition();
  }
  function deleteSelected() {
    if (!selectedEl || !selectedEl.parentNode) return;
    selectedEl.parentNode.removeChild(selectedEl);
    deselect(); dirty = true; setStatus('Deleted element'); refreshOutline();
  }
  function moveSelected(dir) {
    const el = selectedEl; if (!el || !el.parentNode) return;
    if (dir < 0 && el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling);
    else if (dir > 0 && el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el);
    dirty = true; reposition(); positionFloatbar(el); setStatus('Moved element');
  }

  // ---- insert / replace from the element library (chips/buttons/cards/…) ----
  let pendingReplace = false;

  function nodeFromElObj(elObj) {
    if (elObj.css) {
      const cur = doc.getElementById('rb-lib-css');
      injectStyle('rb-lib-css', (cur ? cur.textContent : '') + '\n' + elObj.css);
    }
    const tmp = doc.createElement('div');
    tmp.innerHTML = String(elObj.html || '').trim();
    return tmp.firstElementChild || tmp;
  }

  function insertElement(elObj, atTarget) {
    if (!doc || !elObj) return;
    const node = nodeFromElObj(elObj);
    if (pendingReplace && selectedEl && selectedEl.parentNode) {
      selectedEl.parentNode.replaceChild(node, selectedEl);
      pendingReplace = false;
      dirty = true; setStatus(`Replaced with ${elObj.name || 'element'}`);
      selectElement(node);
      refreshOutline();
      return;
    }
    let container, before = null;
    if (atTarget && atTarget.nodeType === 1) {
      container = atTarget.parentNode || doc.body; before = atTarget.nextSibling;
    } else {
      container = (selectedEl && isContainer(selectedEl)) ? selectedEl : doc.body;
    }
    container.insertBefore(node, before);
    dirty = true; setStatus(`Inserted ${elObj.name || 'element'}`);
    try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_e) {}
    selectElement(node);
    refreshOutline();
  }

  function isContainer(el) {
    return /^(div|section|main|article|aside|nav|footer|header|ul|ol|form|body)$/i.test(el.tagName);
  }

  function beginReplace() {
    if (!selectedEl) { setStatus('Select an element first, then pick a replacement'); return; }
    pendingReplace = true;
    setStatus('Replace mode — click an element in the stash to swap it in');
  }

  function insertImage(url, alt) {
    if (!doc || !url) return;
    const img = doc.createElement('img');
    img.src = url; img.alt = alt || 'image'; img.style.maxWidth = '100%'; img.style.display = 'block';
    const container = (selectedEl && isContainer(selectedEl)) ? selectedEl : doc.body;
    container.appendChild(img);
    dirty = true; setStatus('Inserted image'); selectElement(img); refreshOutline();
  }

  // ---- drag from stash → drop onto canvas (same-origin DnD) ----
  let dragPayload = null;
  function beginDragInsert(elObj) { dragPayload = elObj; }
  function onDragOver(e) { if (dragPayload) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (overlay) overlay.showHover(rectOf(e.target)); } }
  function onDrop(e) {
    if (!dragPayload) return;
    e.preventDefault();
    const target = e.target && e.target.nodeType === 1 ? e.target : null;
    insertElement(dragPayload, target);
    dragPayload = null;
    if (overlay) overlay.showHover(null);
  }

  // ---- grab + drag to MOVE/reorder a selected element ----
  let moving = false; let moveIndicator = null;
  function startMove() {
    if (!selectedEl || !doc) return;
    moving = true; setStatus('Moving — drop it where you want');
    if (!moveIndicator) { moveIndicator = doc.createElement('div'); moveIndicator.id = 'rb-drop-line'; doc.body.appendChild(moveIndicator); }
    moveIndicator.style.cssText = 'position:fixed;height:3px;background:#2dd4bf;z-index:2147483647;pointer-events:none;box-shadow:0 0 8px #2dd4bf;display:none';
    doc.addEventListener('mousemove', onMoveTrack, true);
    doc.addEventListener('mouseup', onMoveDrop, true);
    document.addEventListener('mouseup', cancelMoveSoon, true);
  }
  let moveTarget = null; let moveAfter = false;
  function onMoveTrack(e) {
    if (!moving) return;
    const t = doc.elementFromPoint(e.clientX, e.clientY);
    if (!t || t === selectedEl || t === moveIndicator || t === doc.body || t === doc.documentElement) return;
    moveTarget = t;
    const r = t.getBoundingClientRect();
    moveAfter = (e.clientY - r.top) > r.height / 2;
    moveIndicator.style.display = 'block';
    moveIndicator.style.left = `${r.left}px`;
    moveIndicator.style.width = `${r.width}px`;
    moveIndicator.style.top = `${(moveAfter ? r.bottom : r.top) - 1}px`;
  }
  function onMoveDrop() {
    if (!moving) return;
    finishMove();
    if (moveTarget && moveTarget.parentNode && selectedEl && moveTarget !== selectedEl) {
      moveTarget.parentNode.insertBefore(selectedEl, moveAfter ? moveTarget.nextSibling : moveTarget);
      dirty = true; setStatus('Moved element'); reposition(); refreshOutline();
    }
  }
  function cancelMoveSoon() { if (moving) finishMove(); }
  function finishMove() {
    moving = false;
    if (moveIndicator) moveIndicator.style.display = 'none';
    doc.removeEventListener('mousemove', onMoveTrack, true);
    doc.removeEventListener('mouseup', onMoveDrop, true);
    document.removeEventListener('mouseup', cancelMoveSoon, true);
  }

  // ---- live layers outline ----
  let onOutline = null;
  function setOutlineHandler(cb) { onOutline = cb; }
  function refreshOutline() { if (onOutline) onOutline(getOutline()); }
  function getOutline() {
    if (!doc || !doc.body) return [];
    const out = [];
    (function walk(el, depth) {
      for (const child of el.children) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'link' || child.id === 'rb-drop-line') continue;
        const cls = child.className && typeof child.className === 'string' ? '.' + child.className.trim().split(/\s+/)[0] : '';
        out.push({ node: child, depth, label: tag + (cls || ''), text: (child.textContent || '').trim().slice(0, 24) });
        if (depth < 5 && out.length < 300) walk(child, depth + 1);
      }
    })(doc.body, 0);
    return out;
  }
  function selectNode(node) { if (node) { selectElement(node); try { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_e) {} } }

  // ---- fonts (load into the iframe + apply) ----
  function loadFontInFrame(family) {
    const f = getFont(family); if (!f || !doc) return;
    const id = 'rb-font-' + family.replace(/\W+/g, '-');
    if (doc.getElementById(id)) return;
    const link = doc.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = f.cssUrl;
    doc.head.appendChild(link);
  }
  function applyFont(family) { loadFontInFrame(family); setStyle('font-family', fontStack(family)); }

  // ---- right-click context menu ----
  let ctxEl = null;
  function ensureCtx() {
    if (ctxEl) return ctxEl;
    ctxEl = document.createElement('div');
    ctxEl.className = 'rb-ctx';
    document.body.appendChild(ctxEl);
    document.addEventListener('click', hideCtx, true);
    window.addEventListener('blur', hideCtx);
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
      ['⧉  Duplicate', () => duplicateSelected()],
      ['↑  Move up', () => moveSelected(-1)],
      ['↓  Move down', () => moveSelected(1)],
      ['✎  Edit text', () => { if (selectedEl) { selectedEl.setAttribute('contenteditable', 'true'); selectedEl.focus(); } }],
      ['🗑  Delete', () => deleteSelected()],
    ];
    m.innerHTML = '';
    for (const [label, fn] of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rb-ctx__item'; b.textContent = label;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); hideCtx(); fn(); });
      m.appendChild(b);
    }
    m.style.left = `${fr.left + e.clientX}px`;
    m.style.top = `${fr.top + e.clientY}px`;
    m.classList.add('is-open');
  }

  // ---- export ----
  function captureEditedHtml() {
    // pull the live (edited) body markup back out of the iframe
    if (doc && doc.body) {
      const clone = doc.body.cloneNode(true);
      clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
      clone.querySelectorAll('#rb-overrides,#rb-edit-transitions').forEach((n) => n.remove());
      return clone.innerHTML;
    }
    return parts.html;
  }
  function getExport(title) {
    const html = captureEditedHtml();
    try {
      return exportHtml({ html, css: parts.css, scripts: parts.scripts, title: title || parts.title }, store);
    } catch (_e) {
      // defensive fallback: wrap minimally
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title || 'page'}</title><style>${parts.css || ''}\n${toStylesheet(store)}</style></head><body>${html}</body></html>`;
    }
  }

  function isDirty() { return dirty; }
  function hasSelection() { return !!selectedEl; }

  return {
    load, deselect, duplicateSelected, deleteSelected, moveSelected, insertElement,
    insertImage, beginReplace, beginDragInsert, startMove,
    setOutlineHandler, getOutline, selectNode,
    getExport, isDirty, hasSelection, reposition,
  };
}

/** Best-effort rgb()/hex → #hex for <input type=color>. */
function rgbToHex(v) {
  if (!v) return '#000000';
  if (v[0] === '#') return v.length === 7 ? v : '#000000';
  const m = String(v).match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
