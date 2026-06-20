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

    // overlay tracking the iframe
    if (overlay) overlay.destroy();
    overlay = createOverlay(overlayEl, frame);

    // interaction listeners (same-origin srcdoc → direct)
    doc.addEventListener('mousemove', onHover, true);
    doc.addEventListener('mouseleave', () => overlay && overlay.showHover(null));
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('input', onInlineInput, true);
    win.addEventListener('scroll', reposition, true);
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
    if (!selectedPath) return;
    store.setStyle(selectedPath, prop, value);
    applyOverrideStylesheet();
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
    if (f.type === 'select') {
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
    deselect(); dirty = true; setStatus('Deleted element');
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

  return { load, deselect, duplicateSelected, deleteSelected, getExport, isDirty, hasSelection, reposition };
}

/** Best-effort rgb()/hex → #hex for <input type=color>. */
function rgbToHex(v) {
  if (!v) return '#000000';
  if (v[0] === '#') return v.length === 7 ? v : '#000000';
  const m = String(v).match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
