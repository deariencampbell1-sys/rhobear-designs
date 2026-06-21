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

const _ELEMENTS = Array.isArray(elementsManifest) ? elementsManifest : (elementsManifest.elements || []);
const _ELEMENT_CATS = [...new Set(_ELEMENTS.map((e) => e.category))];
const listCategories = () => _ELEMENT_CATS;
const listElements = (cat) => _ELEMENTS.filter((e) => e.category === cat);
const getElement = (id) => _ELEMENTS.find((e) => e.id === id);

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
  };

  let mode = 'live';
  let docTitleStr = 'Untitled page';
  let loadedAny = false;

  const setStatus = (m) => { if (refs.statusMsg) refs.statusMsg.textContent = m; };
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
  });

  const build = createBuildMode({ onStatus: setStatus, onSelectionChange });

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
    qa('[data-action="mode-live"],[data-action="mode-build"]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.action === `mode-${next}`));
    qa('[data-build-only]').forEach((el) => el.classList.toggle('is-gone', next !== 'build'));
    qa('[data-live-only]').forEach((el) => el.classList.toggle('is-gone', next !== 'live'));
    refs.liveHost.classList.toggle('is-active', next === 'live');
    refs.inspector.classList.add('is-hidden');
    if (next === 'build') {
      build.ensure();
      hideEmpty();
    } else {
      // live mode: empty until a page is loaded
      if (!loadedAny) showEmpty(); else hideEmpty();
    }
    setStatus(next === 'live' ? 'Edit Live Site — open a page to begin' : 'Build from scratch');
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

    'undo': () => { if (mode === 'build') build.undo(); refreshUndo(); },
    'redo': () => { if (mode === 'build') build.redo(); refreshUndo(); },
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

    'ai-toggle': () => refs.aiPanel.classList.toggle('is-open'),
    'open-settings': () => { refs.aiPanel.classList.remove('is-open'); refs.settingsModal.showModal(); },
    'settings-close': () => refs.settingsModal.close(),
    'settings-save': () => {
      try {
        localStorage.setItem('rb-ai', JSON.stringify({ provider: $('ai-provider').value, key: $('ai-key').value }));
      } catch (_e) { /* ignore */ }
      refs.settingsModal.close();
      setStatus('LLM settings saved locally');
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

  // grab handle → drag-to-move the selected element (live mode)
  if (refs.floatGrab) refs.floatGrab.addEventListener('mousedown', (e) => { e.preventDefault(); live.startMove(); });

  // element library (the stash) in the live-mode Add rail
  function renderElementLibrary() {
    const host = refs.elementLibrary;
    if (!host) return;
    const cats = listCategories();
    if (!cats || !cats.length) return;
    let active = cats[0];
    const chips = document.createElement('div'); chips.className = 'rb-lib-cats';
    const grid = document.createElement('div'); grid.className = 'rb-lib-grid';
    function renderGrid() {
      grid.innerHTML = '';
      for (const el of listElements(active)) {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'rb-lib-card';
        card.title = `${el.name || el.id} · ${el.category} — click to add or drag onto the canvas`;
        card.innerHTML = `<span class="rb-lib-card__name">${escapeHtml(el.name || el.id)}</span>`;
        card.draggable = true;
        card.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', el.id); live.beginDragInsert(getElement(el.id)); });
        card.addEventListener('click', () => live.insertElement(getElement(el.id)));
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
    const hint = document.createElement('p'); hint.className = 'rb-lib-hint';
    hint.textContent = 'Click to add. Select a container first to nest inside it.';
    host.appendChild(chips); host.appendChild(hint); host.appendChild(grid);
    renderGrid();
  }

  // boot: live mode + onboarding
  setMode('live');
  try { renderElementLibrary(); } catch (_e) { /* library optional */ }
  setStatus('Editor ready — open a page or build from scratch');

  return { setMode, live, build, get mode() { return mode; } };
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
