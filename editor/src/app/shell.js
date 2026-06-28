/**
 * Shell controller — ties the two modes, the toolbar, the rail, the
 * contextual inspector, onboarding, and the AI/settings seams together.
 * Calm by default: the inspector stays hidden until something is selected.
 * MIT — RHOBEAR Designs (original)
 */
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { createLiveMode } from './live-mode.js';
import { createBuildMode } from './build-mode.js';
// Import the element manifest JSON directly — the library's index.js loader is
// node:fs-based (browser-incompatible); Vite bundles JSON natively.
import elementsManifest from '../library/elements/manifest.json';

import { createTemplatesGallery } from './templates-gallery.js';
import { listProjects, saveProject, deleteProject, getProject } from './projects.js';
import { chat as aiChat, parseEdit, SYSTEM_PROMPT, PROVIDER_LABELS } from '../ai/llm-client.js';
import { createThreeMode } from './three-mode.js';

const _ELEMENTS = Array.isArray(elementsManifest) ? elementsManifest : (elementsManifest.elements || []);
const _ELEMENT_CATS = [...new Set(_ELEMENTS.map((e) => e.category))];
const listCategories = () => _ELEMENT_CATS;
const listElements = (cat) => _ELEMENTS.filter((e) => e.category === cat);
const getElement = (id) => _ELEMENTS.find((e) => e.id === id);

// User stash — items the user saved (e.g. a 3D scene), kept locally + shown in the Add panel.
function userStash() { try { return JSON.parse(localStorage.getItem('rb-user-stash') || '[]'); } catch (_e) { return []; } }
function addUserStash(el) { const a = userStash(); a.unshift(el); try { localStorage.setItem('rb-user-stash', JSON.stringify(a.slice(0, 100))); } catch (_e) { console.error('addUserStash:', _e); } }

// Quick structural inserts (clean defaults — distinct from the category filters)
const QUICK = [
  { name: 'Section', html: '<section style="padding:64px 24px"><div style="max-width:1080px;margin:0 auto"><h2 style="margin:0 0 12px">Section title</h2><p style="color:#555;max-width:60ch;line-height:1.6">Body text — double-click to edit.</p></div></section>' },
  { name: 'Header', html: '<header style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px"><strong>Brand</strong><nav style="display:flex;gap:20px"><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav></header>' },
  { name: 'Nav', html: '<nav style="display:flex;gap:20px;padding:14px 24px"><a href="#">Home</a><a href="#">Work</a><a href="#">About</a><a href="#">Contact</a></nav>' },
  { name: 'Footer', html: '<footer style="padding:40px 24px;text-align:center;color:#888">© 2026 Brand · <a href="#">Privacy</a> · <a href="#">Terms</a></footer>' },
  { name: 'Heading', html: '<h2 style="font-size:2rem;margin:0">Heading</h2>' },
  { name: 'Text', html: '<p style="line-height:1.6;color:#444">New paragraph — double-click to edit.</p>' },
  { name: 'Button', html: '<a href="#" style="display:inline-block;padding:12px 24px;background:#e94560;color:#04110f;border-radius:8px;text-decoration:none;font-weight:600">Button</a>' },
  { name: 'Image', html: '' },
];

const $ = (id) => document.getElementById(id);
const qa = (sel) => Array.from(document.querySelectorAll(sel));

export function bootShell() {
  const refs = {
    docTitle: $('doc-title'),
    statusMsg: $('status-message'),
    statusSel: $('status-selection'),
    inspector: $('inspector'),
    inspectorTag: $('inspector-tag'),
    inspectorLive: $('inspector-live'),
    rail: $('rail'),
    emptyState: $('empty-state'),
    liveHost: $('live-host'),
    liveFrame: $('live-frame'),
    liveOverlay: $('live-overlay'),
    floatbar: $('floatbar'),
    aiPanel: $('ai-panel'),
    embedModal: $('embed-modal'),
    settingsModal: $('settings-modal'),
    previewModal: $('preview-modal'),
    previewFrame: $('preview-frame'),
    fileHtml: $('file-html'),
    fileFolder: $('file-folder'),
    fileImage: $('file-image'),
    file3d: $('file-3d'),
    threeHost: $('three-host'),
    threeRail: $('three-rail'),
    inspector3d: $('inspector-3d'),
    elementLibrary: $('element-library'),
    liveLayers: $('live-layers'),
    floatGrab: $('float-grab'),
    templatesModal: $('templates-modal'),
    templatesGrid: $('templates-grid'),
    templatesSearch: $('templates-search'),
    templatesCount: $('templates-count'),
    projectsModal: $('projects-modal'),
    projectsList: $('projects-list'),
    projName: $('proj-name'),
    aiPanelEl: $('ai-panel'),
    aiMessages: $('ai-messages'),
    aiForm: $('ai-form'),
    aiPrompt: $('ai-prompt'),
    aiStatus: $('ai-status'),
  };

  let mode = 'live';
  let docTitleStr = 'Untitled page';
  let loadedAny = false;

  const setStatus = (m) => { if (refs.statusMsg) refs.statusMsg.textContent = m; };
  let toastEl = null; let toastTimer = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'rb-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('is-show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2800);
  }
  const setTitle = (t) => { docTitleStr = t || 'Untitled page'; if (refs.docTitle) refs.docTitle.textContent = docTitleStr; };

  const onSelectionChange = (sel) => {
    if (sel) {
      refs.inspector.classList.remove('is-hidden');
      if (refs.statusSel) refs.statusSel.textContent = `Selected <${sel.tag}>`;
    } else {
      refs.inspector.classList.add('is-hidden');
      if (refs.statusSel) refs.statusSel.textContent = 'No selection';
    }
    refreshUndo();
  };

  const live = createLiveMode({
    frame: refs.liveFrame,
    overlayEl: refs.liveOverlay,
    inspectorBody: refs.inspectorLive,
    inspectorTag: refs.inspectorTag,
    floatbar: refs.floatbar,
    onStatus: setStatus,
    onSelectionChange,
    onEdit3D: (json) => { setMode('3d'); three.loadScene(json); },
  });

  const build = createBuildMode({ onStatus: setStatus, onSelectionChange });
  const three = createThreeMode({
    host: refs.threeHost, railEl: refs.threeRail, inspectorEl: refs.inspector3d, fileInput: refs.file3d, onStatus: setStatus,
    onSaveToStash: (el) => { addUserStash(el); try { renderElementLibrary(); } catch (_e) { console.error('renderElementLibrary on save:', _e); } toast('Saved to stash ✓ — find it in Edit Live Site → Add → Saved'); },
  });

  // templates gallery
  const gallery = createTemplatesGallery({
    modal: refs.templatesModal, grid: refs.templatesGrid, search: refs.templatesSearch,
    countEl: refs.templatesCount, onStatus: setStatus,
    onOpen: (html, meta) => {
      if (!html) return;
      setMode('live'); loadedAny = true; hideEmpty();
      setTitle(live.load(html, meta && meta.name) || (meta && meta.name) || 'Template');
    },
  });

  // live layers outline → rail Layers pane
  live.setOutlineHandler((outline) => renderLiveLayers(outline));
  function renderLiveLayers(outline) {
    const host = refs.liveLayers; if (!host) return;
    host.innerHTML = '';
    if (!outline || !outline.length) { host.innerHTML = '<p class="rb-lib-hint">Open a page to see its layers.</p>'; return; }
    for (const n of outline) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rb-layer'; b.style.paddingLeft = `${8 + n.depth * 12}px`;
      b.innerHTML = `<span class="rb-layer__tag">${escapeHtml(n.label)}</span>` + (n.text ? `<span class="rb-layer__txt">${escapeHtml(n.text)}</span>` : '');
      b.addEventListener('click', () => live.selectNode(n.node));
      host.appendChild(b);
    }
  }

  // projects + folders
  function renderProjects() {
    const host = refs.projectsList; if (!host) return;
    host.innerHTML = '';
    const ps = listProjects();
    if (!ps.length) { host.innerHTML = '<p class="rb-lib-hint">No saved projects yet — name one and Save current.</p>'; return; }
    for (const p of ps) {
      const row = document.createElement('div'); row.className = 'rb-proj-row';
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'rb-proj-open';
      open.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="rb-proj-mode">${escapeHtml(p.mode)}</span>`;
      open.addEventListener('click', () => openProject(p.id));
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'rb-btn rb-btn--icon rb-btn--ghost'; del.textContent = '🗑'; del.title = 'Delete';
      del.addEventListener('click', () => { deleteProject(p.id); renderProjects(); });
      row.appendChild(open); row.appendChild(del); host.appendChild(row);
    }
  }
  function openProject(id) {
    const p = getProject(id); if (!p) return;
    refs.projectsModal.close();
    setMode('live'); loadedAny = true; hideEmpty();
    setTitle(live.load(p.html, p.name) || p.name);
  }

  // ---------------------------------------------------------------- modes
  function setMode(next) {
    mode = next;
    qa('[data-action="mode-live"],[data-action="mode-build"],[data-action="mode-3d"]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.action === `mode-${next}`));
    qa('[data-build-only]').forEach((el) => el.classList.toggle('is-gone', next !== 'build'));
    qa('[data-live-only]').forEach((el) => el.classList.toggle('is-gone', next !== 'live'));
    qa('[data-3d-only]').forEach((el) => el.classList.toggle('is-gone', next !== '3d'));
    refs.liveHost.classList.toggle('is-active', next === 'live');
    if (next === '3d') {
      hideEmpty();
      refs.inspector.classList.remove('is-hidden'); // 3D controls live in the inspector
      three.ensure();
      setStatus('3D Studio — insert a model or primitive, drag to orbit, click a part to edit');
    } else {
      refs.inspector.classList.add('is-hidden');
      if (next === 'build') { build.ensure(); hideEmpty(); }
      else if (!loadedAny) showEmpty(); else hideEmpty();
      setStatus(next === 'live' ? 'Edit Live Site — open a page to begin' : 'Build from scratch');
    }
  }

  function showEmpty() { refs.emptyState.classList.add('is-active'); }
  function hideEmpty() { refs.emptyState.classList.remove('is-active'); }

  // ---------------------------------------------------------------- rail
  function setRailTab(tab) {
    qa('[data-rail-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.railTab === tab));
    qa('[data-rail-pane]').forEach((p) => p.classList.toggle('is-active', p.dataset.railPane === tab));
  }

  // --------------------------------------------------------------- export
  function currentExport() {
    return mode === 'live' ? live.getExport(docTitleStr) : build.getExport(docTitleStr);
  }
  function doSave() {
    const html = currentExport();
    saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), slug(docTitleStr) + '.html');
    setStatus(`Saved ${slug(docTitleStr)}.html`);
  }
  async function doZip() {
    const zip = new JSZip();
    const base = slug(docTitleStr);
    if (mode === 'build') {
      const { html, css } = build.getHtmlCss();
      zip.file('index.html', `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>${escapeHtml(docTitleStr)}</title>\n<link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n${html || ''}\n</body>\n</html>`);
      zip.file('styles.css', css || '/* RHOBEAR Designs */');
    } else {
      zip.file('index.html', currentExport());
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${base}.zip`);
    setStatus(`Exported ${base}.zip`);
  }
  function doPreview() {
    refs.previewFrame.srcdoc = currentExport();
    refs.previewModal.showModal();
  }

  function refreshUndo() {
    const u = $('btn-undo'); const r = $('btn-redo');
    if (mode === 'build') {
      if (u) u.disabled = !build.hasUndo();
      if (r) r.disabled = !build.hasRedo();
    } else { if (u) u.disabled = false; if (r) r.disabled = false; }
  }

  // ------------------------------------------------------------- actions
  const actions = {
    'mode-live': () => setMode('live'),
    'mode-build': () => setMode('build'),
    'mode-3d': () => setMode('3d'),
    'toggle-rail': () => refs.rail.classList.toggle('is-collapsed'),

    'new': () => {
      if (!confirm('Start a new blank page? Unsaved changes will be lost.')) return;
      setMode('build'); build.newPage(); setTitle('Untitled page'); loadedAny = true; hideEmpty();
    },
    'open-html': () => refs.fileHtml.click(),
    'open-folder': () => refs.fileFolder.click(),
    'save-html': doSave,
    'export-zip': doZip,
    'preview': doPreview,
    'preview-close': () => refs.previewModal.close(),

    'open-templates': () => gallery.open(),
    'templates-close': () => refs.templatesModal.close(),
    'open-projects': () => { renderProjects(); refs.projectsModal.showModal(); },
    'projects-close': () => refs.projectsModal.close(),
    'proj-save': () => {
      const name = (refs.projName.value || '').trim() || docTitleStr || 'Untitled';
      saveProject({ name, html: currentExport(), mode });
      refs.projName.value = ''; renderProjects(); setStatus(`Saved project "${name}"`);
    },
    'replace': () => live.beginReplace(),
    'select-parent': () => live.selectParent(),

    'undo': () => undoCurrent(),
    'redo': () => redoCurrent(),
    'duplicate': () => { mode === 'build' ? build.duplicate() : live.duplicateSelected(); },
    'delete': () => { mode === 'build' ? build.remove() : live.deleteSelected(); },

    'device-desktop': () => setDevice('Desktop', 'device-desktop'),
    'device-tablet': () => setDevice('Tablet', 'device-tablet'),
    'device-mobile': () => setDevice('Mobile', 'device-mobile'),

    'add-section': () => { setMode('build'); build.addSection(); loadedAny = true; },
    'add-text': () => { setMode('build'); build.addText(); loadedAny = true; },
    'add-image': () => refs.fileImage.click(),
    'embed': () => refs.embedModal.showModal(),
    'embed-cancel': () => refs.embedModal.close(),

    'ai-toggle': () => { refs.aiPanel.classList.toggle('is-open'); aiRefresh(); },
    'open-settings': () => {
      const c = aiConfig();
      if (c.provider) $('ai-provider').value = c.provider;
      if (c.key) $('ai-key').value = c.key;
      refs.aiPanel.classList.remove('is-open'); refs.settingsModal.showModal();
    },
    'settings-close': () => refs.settingsModal.close(),
    'settings-save': () => {
      try {
        localStorage.setItem('rb-ai', JSON.stringify({ provider: $('ai-provider').value, key: $('ai-key').value }));
      } catch (_e) { /* ignore */ }
      refs.settingsModal.close();
      aiRefresh();
      setStatus('LLM key saved locally');
    },
  };

  function setDevice(name, btnAction) {
    qa('[data-action^="device-"]').forEach((b) => b.classList.toggle('is-active', b.dataset.action === btnAction));
    if (mode === 'build') build.setDevice(name);
    else {
      const w = name === 'Tablet' ? '768px' : name === 'Mobile' ? '375px' : '100%';
      refs.liveFrame.style.maxWidth = w;
      refs.liveFrame.style.margin = w === '100%' ? '0' : '0 auto';
      live.reposition();
    }
    setStatus(`${name} view`);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const fn = actions[btn.dataset.action];
    if (fn) { e.preventDefault(); fn(); }
  });
  qa('[data-rail-tab]').forEach((b) => b.addEventListener('click', () => setRailTab(b.dataset.railTab)));

  // embed form
  $('embed-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('embed-code').value.trim();
    if (code) { setMode('build'); build.embed(code); $('embed-code').value = ''; refs.embedModal.close(); loadedAny = true; }
  });

  // file inputs
  refs.fileHtml.addEventListener('change', async () => {
    const f = refs.fileHtml.files && refs.fileHtml.files[0];
    if (f) {
      const text = await f.text();
      setMode('live'); loadedAny = true; hideEmpty();
      const t = live.load(text, f.name.replace(/\.html?$/i, ''));
      setTitle(t);
    }
    refs.fileHtml.value = '';
  });
  refs.fileFolder.addEventListener('change', async () => {
    const files = refs.fileFolder.files ? Array.from(refs.fileFolder.files) : [];
    const htmlFile = files.find((f) => /\.html?$/i.test(f.name)) || files.find((f) => f.name.toLowerCase() === 'index.html');
    if (htmlFile) {
      const text = await htmlFile.text();
      setMode('live'); loadedAny = true; hideEmpty();
      setTitle(live.load(text, htmlFile.name.replace(/\.html?$/i, '')));
      setStatus(`Loaded folder (${files.length} files)`);
    } else { setStatus('No .html file found in folder'); }
    refs.fileFolder.value = '';
  });
  refs.fileImage.addEventListener('change', () => {
    const f = refs.fileImage.files && refs.fileImage.files[0];
    if (f) {
      const url = URL.createObjectURL(f);
      if (mode === 'live') live.insertImage(url, f.name); else build.addImage(url);
      loadedAny = true;
    }
    refs.fileImage.value = '';
  });

  refs.file3d.addEventListener('change', () => {
    const f = refs.file3d.files && refs.file3d.files[0];
    if (f) three.loadModelFile(f);
    refs.file3d.value = '';
  });


  // element library (the stash) in the live-mode Add rail
  function renderElementLibrary() {
    const host = refs.elementLibrary;
    if (!host) return;
    const cats = (userStash().length ? ['saved'] : []).concat(listCategories());
    if (!cats || !cats.length) return;
    let active = cats[0];
    const chips = document.createElement('div'); chips.className = 'rb-lib-cats';
    const grid = document.createElement('div'); grid.className = 'rb-lib-grid';
    function renderGrid() {
      grid.innerHTML = '';
      const els = active === 'saved' ? userStash() : listElements(active);
      for (const el of els) {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'rb-lib-card';
        card.title = `${el.name || el.id} · ${el.category} — click to add or drag onto the canvas`;
        card.innerHTML = `<span class="rb-lib-card__name">${escapeHtml(el.name || el.id)}</span>`;
        card.draggable = true;
        card.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', el.id); live.beginDragInsert(el); });
        card.addEventListener('click', () => live.insertElement(el));
        grid.appendChild(card);
      }
    }
    for (const c of cats) {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'rb-lib-cat' + (c === active ? ' is-active' : '');
      chip.textContent = c;
      chip.addEventListener('click', () => {
        active = c;
        host.querySelectorAll('.rb-lib-cat').forEach((x) => x.classList.toggle('is-active', x.textContent === c));
        renderGrid();
      });
      chips.appendChild(chip);
    }
    host.innerHTML = '';
    // Quick structural inserts (header / nav / footer / section / …)
    const quick = document.createElement('div'); quick.className = 'rb-quick';
    quick.innerHTML = '<span class="rb-field__label">Quick add</span>';
    const qgrid = document.createElement('div'); qgrid.className = 'rb-quick-grid';
    for (const q of QUICK) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-quick-btn'; b.textContent = q.name;
      b.addEventListener('click', () => { if (q.name === 'Image') refs.fileImage.click(); else live.insertElement({ name: q.name, html: q.html }); });
      qgrid.appendChild(b);
    }
    quick.appendChild(qgrid); host.appendChild(quick);
    // Media: upload an image or paste an image/GIF URL (bucket browse comes with the media lib)
    const media = document.createElement('div'); media.className = 'rb-media-row';
    const up = document.createElement('button'); up.type = 'button'; up.className = 'rb-btn'; up.style.width = '100%'; up.textContent = '⬆  Add image / media';
    up.addEventListener('click', () => refs.fileImage.click());
    const u = document.createElement('input'); u.className = 'rb-input'; u.placeholder = 'or paste an image / GIF URL…'; u.style.marginTop = '6px';
    u.addEventListener('change', () => { if (u.value) { live.insertImage(u.value, 'media'); u.value = ''; } });
    media.appendChild(up); media.appendChild(u);
    const hint = document.createElement('p'); hint.className = 'rb-lib-hint';
    hint.textContent = 'Click an element to add · drag it onto the canvas · select a container to nest.';
    host.appendChild(media); host.appendChild(chips); host.appendChild(hint); host.appendChild(grid);
    renderGrid();
  }

  // ---- AI assist (bring-your-own key) ----
  function aiConfig() { try { return JSON.parse(localStorage.getItem('rb-ai') || '{}'); } catch (_e) { return {}; } }
  function addAiMsg(role, text) {
    const el = document.createElement('div');
    el.className = `rb-ai-msg rb-ai-msg--${role}`;
    el.textContent = text;
    refs.aiMessages.appendChild(el);
    refs.aiMessages.scrollTop = refs.aiMessages.scrollHeight;
    return el;
  }
  function aiRefresh() {
    const c = aiConfig(); const ok = !!(c.key && c.provider);
    if (refs.aiStatus) refs.aiStatus.textContent = ok ? (PROVIDER_LABELS[c.provider] || c.provider) : 'offline';
    if (refs.aiPrompt) refs.aiPrompt.disabled = !ok;
    if (refs.aiMessages && !refs.aiMessages.dataset.greeted) {
      refs.aiMessages.dataset.greeted = '1';
      addAiMsg('assistant', ok
        ? 'Connected. Select an element on the page, then tell me what to change — e.g. "make this hero dark with a teal headline".'
        : 'Add your API key below (Connect) — Anthropic, OpenAI, or Google. The editor works fully without me.');
    }
  }
  async function sendAi(prompt) {
    const c = aiConfig();
    if (!c.key || !c.provider) { addAiMsg('assistant', 'No key set — click "Connect / change LLM key" below.'); return; }
    addAiMsg('user', prompt);
    const pending = addAiMsg('assistant', '…thinking');
    const ctx = (mode === 'live') ? live.getSelectionHtml() : (build.getHtmlCss().html || '');
    const user = `${prompt}\n\nSelected element (return its complete replacement if you change it):\n\`\`\`html\n${ctx}\n\`\`\``;
    try {
      const text = await aiChat({ provider: c.provider, apiKey: c.key, model: c.model, system: SYSTEM_PROMPT, user });
      const { html, reply } = parseEdit(text);
      pending.textContent = reply;
      if (html && mode === 'live') { if (live.applyAIEdit(html)) setStatus('AI applied a change'); }
      else if (html) { addAiMsg('assistant', '(Switch to Edit Live Site to apply page changes.)'); }
    } catch (err) {
      pending.textContent = `Error: ${err.message}`;
      pending.classList.add('rb-ai-msg--err');
    }
  }
  refs.aiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const p = (refs.aiPrompt.value || '').trim();
    if (p) { refs.aiPrompt.value = ''; sendAi(p); }
  });

  // ---- global undo/redo + Esc (works in every mode) ----
  function undoCurrent() { if (mode === '3d') three.undo(); else if (mode === 'build') build.undo(); else live.undo(); refreshUndo(); }
  function redoCurrent() { if (mode === '3d') three.redo(); else if (mode === 'build') build.redo(); else live.redo(); refreshUndo(); }
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.getAttribute && t.getAttribute('contenteditable') === 'true'));
    if (e.key === 'Escape' && !typing) { if (mode === '3d') three.deselect(); else if (mode === 'live') live.deselect(); return; }
    if (typing) return; // let native text undo work in fields
    const z = e.key === 'z' || e.key === 'Z';
    const y = e.key === 'y' || e.key === 'Y';
    if ((e.ctrlKey || e.metaKey) && z) { e.preventDefault(); if (e.shiftKey) redoCurrent(); else undoCurrent(); }
    else if ((e.ctrlKey || e.metaKey) && y) { e.preventDefault(); redoCurrent(); }
  });

  // boot: live mode + onboarding
  setMode('live');
  try { renderElementLibrary(); } catch (_e) { /* library optional */ }
  setStatus('Editor ready — open a page or build from scratch');

  // ---- auto-load from RHOBEAR Designs API ---------------------------------
  // `?designs_page_id=<id>` (optionally with `&designs_api=<baseUrl>`) tells
  // the editor to fetch the page state from the Designs API and open it in
  // Live mode for hand-editing. This is the entry point the agent uses.
  //
  // Resolution order for the API base URL:
  //   1. `?designs_api=<baseUrl>` query param (per-link override)
  //   2. `window.__RB_DESIGNS_API__` global (host page config)
  //   3. `localStorage.rb-designs-api` (user preference set via settings)
  //   4. `/v1` same-origin (when the editor is reverse-proxied behind the API)
  (async function autoLoadFromApi() {
    try {
      const url = new URL(window.location.href);
      const pageId = url.searchParams.get('designs_page_id');
      if (!pageId) return;
      const fromQuery = (url.searchParams.get('designs_api') || '').replace(/\/$/, '');
      const fromGlobal = (typeof window !== 'undefined' && window.__RB_DESIGNS_API__) || '';
      let fromLs = '';
      try { fromLs = (localStorage.getItem('rb-designs-api') || '').replace(/\/$/, ''); } catch (_e) { console.warn('designs-api localStorage read:', _e); }
      const base = fromQuery || fromGlobal || fromLs || `${url.origin}/v1`;
      const r = await fetch(`${base}/pages/${encodeURIComponent(pageId)}`);
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.ok) {
        setStatus(`Designs API: ${body?.error?.message || `failed (${r.status})`}`);
        return;
      }
      const page = body.data;
      if (!page.html) { setStatus(`Designs API: page ${pageId} has no html yet`); return; }
      setMode('live');
      loadedAny = true; hideEmpty();
      const t = live.load(page.html, page.name || page.page_id);
      setTitle(t || page.name || `Page ${pageId}`);
      setStatus(`Loaded page ${pageId} from Designs API`);
    } catch (err) {
      setStatus(`Designs API load failed: ${err.message}`);
    }
  })();

  return { setMode, live, build, three, get mode() { return mode; } };
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
