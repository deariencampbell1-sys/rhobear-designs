/**
 * Shell controller — ties the two modes, the toolbar, the rail, the
 * contextual inspector, onboarding, and the AI/settings seams together.
 * Calm by default: the inspector stays hidden until something is selected.
 * MIT — RHOBEAR Designs (original)
 */
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { createLiveMode } from './live-mode.js';
import { svgIcon } from './icons.js';
import { createBuildMode } from './build-mode.js';
// Import the element manifest JSON directly — the library's index.js loader is
// node:fs-based (browser-incompatible); Vite bundles JSON natively.
import elementsManifest from '../library/elements/manifest.json';

import { createTemplatesGallery } from './templates-gallery.js';
import { listProjects, saveProject, deleteProject, getProject } from './projects.js';
import { chat as aiChat, chatWithTools, parseEdit, SYSTEM_PROMPT, PROVIDER_LABELS } from '../ai/llm-client.js';
import { openAiToolsParam, runTool, TOOLS_SYSTEM_PROMPT } from '../ai/tools.js';
import { createThreeMode } from './three-mode.js';
import { isPro, requirePro, showUpgrade } from './pro.js';
import { initAuth, isSignedIn, signIn, signOut, onAuthChange } from './auth.js';
import { loadLocalCache, seedPrefs, getPref, setPrefs, hydratePrefs } from './prefs.js';
import { STYLES, styleById, styleDirective } from '../ai/styles.js';
import { voiceSupported, createVoice } from '../ai/voice.js';

const _ELEMENTS = Array.isArray(elementsManifest) ? elementsManifest : (elementsManifest.elements || []);
const _ELEMENT_CATS = [...new Set(_ELEMENTS.map((e) => e.category))];
const listCategories = () => _ELEMENT_CATS;
const listElements = (cat) => _ELEMENTS.filter((e) => e.category === cat);
const getElement = (id) => _ELEMENTS.find((e) => e.id === id);

// User stash — items the user saved (e.g. a 3D scene), kept locally + shown in the Add panel.
function userStash() { try { return JSON.parse(localStorage.getItem('rb-user-stash') || '[]'); } catch (_e) { return []; } }
function addUserStash(el) { const a = userStash(); a.unshift(el); try { localStorage.setItem('rb-user-stash', JSON.stringify(a.slice(0, 100))); } catch (_e) { console.error('addUserStash:', _e); } }
// Sanitize user-supplied content before rendering into the editor chrome —
// strips event handlers and javascript: URLs that an attacker could plant via
// a compromised localStorage key (e.g. rb-user-stash). innerHTML never runs
// <script> tags, but event handlers and CSS expression() exfiltration would
// work in the editor's same-origin chrome, so we strip those too.
function sanitizeUserHtml(html) {
  if (!html) return '';
  // Strip event handler attributes (onclick, onerror, onmouseover, onload, etc.)
  let s = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ' ');
  // Strip javascript: URLs in href/src/action/formaction
  s = s.replace(/\s+(href|src|action|formaction)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, ' $1=""');
  return s;
}
function sanitizeUserCss(css) {
  if (!css) return '';
  // Strip CSS expression() (IE legacy, defense in depth)
  return css.replace(/expression\s*\(/gi, '/* blocked */').replace(/javascript:/gi, 'blocked:');
}

// Quick structural inserts (clean defaults — distinct from the category filters)
const QUICK = [
  { name: 'Section', html: '<section style="padding:64px 24px"><div style="max-width:1080px;margin:0 auto"><h2 style="margin:0 0 12px">Section title</h2><p style="color:#555;max-width:60ch;line-height:1.6">Body text — double-click to edit.</p></div></section>' },
  { name: 'Header', html: '<header style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px"><strong>Brand</strong><nav style="display:flex;gap:20px"><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav></header>' },
  { name: 'Nav', html: '<nav style="display:flex;gap:20px;padding:14px 24px"><a href="#">Home</a><a href="#">Work</a><a href="#">About</a><a href="#">Contact</a></nav>' },
  { name: 'Footer', html: '<footer style="padding:40px 24px;text-align:center;color:#888">© 2026 Brand · <a href="#">Privacy</a> · <a href="#">Terms</a></footer>' },
  { name: 'Heading', html: '<h2 style="font-size:2rem;margin:0">Heading</h2>' },
  { name: 'Text', html: '<p style="line-height:1.6;color:#444">New paragraph — double-click to edit.</p>' },
  { name: 'Button', html: '<a href="#" style="display:inline-block;padding:12px 24px;background:#e94560;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Button</a>' },
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
    aiAsk: $('ai-ask'),
    aiCtx: $('ai-ctx'),
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

  // ── Auth + server-synced preferences ─────────────────────────────────────
  // Init auth (picks up ?rhobear_session from URL redirect), load the local
  // pref cache, and migrate any existing localStorage values so the transition
  // is seamless. If signed in, hydrate from the server in the background.
  const { signedIn } = initAuth();
  loadLocalCache();
  seedPrefs({
    'rb-ai': (() => { try { return JSON.parse(localStorage.getItem('rb-ai') || '{}'); } catch { return {}; } })(),
    'rb-ai-style': (() => { try { return localStorage.getItem('rb-ai-style') || 'default'; } catch { return 'default'; } })(),
    'rb-ai-deep': (() => { try { return localStorage.getItem('rb-ai-deep') === '1'; } catch { return false; } })(),
    'rb-designs-api': (() => { try { return localStorage.getItem('rb-designs-api') || ''; } catch { return ''; } })(),
  });
  if (signedIn) { hydratePrefs().catch(() => {}); }

  // Sign-in / out button in toolbar
  const authBtn = document.getElementById('rb-signin-btn');
  function updateAuthBtn(signed) {
    if (!authBtn) return;
    authBtn.hidden = false;
    authBtn.textContent = signed ? 'Sign out' : 'Sign in';
    authBtn.title = signed ? 'Sign out of RHOBEAR auth' : 'Sign in for cross-device sync';
  }
  updateAuthBtn(signedIn);
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (isSignedIn()) { signOut(); updateAuthBtn(false); }
      else signIn();
    });
  }
  onAuthChange((signed) => { updateAuthBtn(signed); });

  const onSelectionChange = (sel) => {
    if (sel) {
      refs.inspector.classList.remove('is-hidden');
      if (refs.statusSel) refs.statusSel.textContent = `Selected <${sel.tag}>`;
    } else {
      refs.inspector.classList.add('is-hidden');
      if (refs.statusSel) refs.statusSel.textContent = 'No selection';
    }
    // Chat composer context chip — the assistant works on what you select.
    if (refs.aiCtx) {
      if (sel) { refs.aiCtx.textContent = `editing <${sel.tag}>`; refs.aiCtx.classList.add('is-on'); }
      else { refs.aiCtx.classList.remove('is-on'); }
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

  // ---- studio start screen (the empty state) — content first, Canva-style:
  // template thumbnails + recent projects front and center, not buried behind
  // a toolbar button.
  function renderStartScreen() {
    const tplHost = $('start-templates');
    if (tplHost && !tplHost.dataset.built) {
      tplHost.dataset.built = '1';
      const list = gallery.entries().filter((e) => e.thumbUrl).slice(0, 8);
      for (const e of list) {
        const card = document.createElement('button');
        card.type = 'button'; card.className = 'rb-tpl-card rb-tpl-card--start';
        card.title = e.description || e.name;
        card.innerHTML = `<span class="rb-tpl-card__thumb" style="background-image:url('${e.thumbUrl}')"></span>` +
          `<span class="rb-tpl-card__name">${escapeHtml(e.name || e.id)}</span>`;
        card.addEventListener('click', () => gallery.openEntry(e));
        tplHost.appendChild(card);
      }
      const more = document.createElement('button');
      more.type = 'button'; more.className = 'rb-tpl-card rb-tpl-card--start rb-tpl-card--more';
      more.innerHTML = `<span class="rb-tpl-card__thumb rb-tpl-card__thumb--ph">→</span>` +
        `<span class="rb-tpl-card__name">All ${gallery.count} templates</span>`;
      more.addEventListener('click', () => gallery.open());
      tplHost.appendChild(more);
    }
    const rHost = $('start-recents'); const rWrap = $('start-recents-wrap');
    if (rHost && rWrap) {
      const ps = listProjects().slice(0, 6);
      rWrap.hidden = !ps.length;
      rHost.innerHTML = '';
      for (const p of ps) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'rb-start__recent';
        b.innerHTML = `<span class="rb-start__recent-name">${escapeHtml(p.name)}</span>` +
          `<span class="rb-proj-mode">${escapeHtml(p.mode)}</span>`;
        b.addEventListener('click', () => openProject(p.id));
        rHost.appendChild(b);
      }
    }
  }

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
      del.type = 'button'; del.className = 'rb-btn rb-btn--icon rb-btn--ghost'; del.innerHTML = svgIcon('trash'); del.title = 'Delete';
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
    'toggle-rail': () => {
      refs.rail.classList.toggle('is-collapsed');
      // Narrow shells (index/t at ≤480px) present the rail as a bottom sheet:
      // the scrim mirrors the open state. Gated to phone widths so a desktop
      // toggle never leaves narrow-state classes behind for a later resize.
      const scrim = $('narrow-scrim');
      if (scrim && matchMedia('(max-width: 480px)').matches) {
        refs.rail.classList.toggle('is-narrow-open');
        scrim.classList.toggle('is-on', refs.rail.classList.contains('is-narrow-open'));
      }
    },
    'narrow-close': () => {
      // Scrim tap (or any sheet-close): return the rail to its desktop
      // default (visible/not-collapsed) so a resize never leaves it hidden.
      refs.rail.classList.remove('is-collapsed', 'is-narrow-open');
      const scrim = $('narrow-scrim');
      if (scrim) scrim.classList.remove('is-on');
    },

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
      refs.projName.value = ''; renderProjects(); renderStartScreen(); setStatus(`Saved project "${name}"`);
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
      if ($('ai-model')) $('ai-model').value = c.model || '';
      if ($('ai-base')) $('ai-base').value = c.baseUrl || '';
      refs.aiPanel.classList.remove('is-open'); refs.settingsModal.showModal();
    },
    'settings-close': () => refs.settingsModal.close(),
    'settings-save': () => {
      setPrefs({ 'rb-ai': {
        provider: $('ai-provider').value,
        key: $('ai-key').value,
        model: ($('ai-model') && $('ai-model').value.trim()) || '',
        baseUrl: ($('ai-base') && $('ai-base').value.trim()) || '',
      } });
      refs.settingsModal.close();
      aiRefresh();
      setStatus('LLM key saved' + (isSignedIn() ? ' ✓' : ' locally'));
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
        // Visual preview: render the element's own (scoped-class) HTML+CSS in a
        // scaled stage — you pick what you SEE, not a text label. innerHTML
        // never executes <script>, so saved 3D embeds stay static here.
        card.innerHTML = `<span class="rb-lib-card__preview" aria-hidden="true"><span class="rb-lib-card__stage"></span></span>` +
          `<span class="rb-lib-card__name">${escapeHtml(el.name || el.id)}</span>`;
        try {
          const stage = card.querySelector('.rb-lib-card__stage');
          stage.innerHTML = (el.css ? `<style>${sanitizeUserCss(el.css)}</style>` : '') + sanitizeUserHtml(el.html || '');
          stage.querySelectorAll('img').forEach((im) => { im.loading = 'lazy'; });
        } catch (_e) { /* preview is best-effort; the name still shows */ }
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
  function aiConfig() { const c = getPref('rb-ai', {}); return (c && typeof c === 'object') ? c : {}; }

  // ---- Pro layer: generation style · deep thinking · voice (never crimps free) ----
  function aiStyle() { return getPref('rb-ai-style', 'default'); }
  function setAiStyle(v) { setPrefs({ 'rb-ai-style': v }); }
  function aiDeep() { return !!getPref('rb-ai-deep', false); }
  function setAiDeep(v) { setPrefs({ 'rb-ai-deep': !!v }); }

  let voice = null; let voiceBtn = null;
  function injectProToolbar() {
    if (!refs.aiForm || document.getElementById('rb-ai-pro')) return;
    if (!document.getElementById('rb-ai-pro-style')) {
      const st = document.createElement('style'); st.id = 'rb-ai-pro-style';
      st.textContent = `
        .rb-ai-pro{display:flex;gap:.4rem;align-items:center;padding:.4rem .6rem;flex-wrap:wrap}
        .rb-ai-pro__style{flex:1;min-width:120px;font-size:.85rem;padding:.3rem .4rem}
        .rb-ai-pro__deep,.rb-ai-pro__mic{border:1px solid var(--rb-brand-glow);background:transparent;color:inherit;border-radius:8px;padding:.3rem .55rem;font-size:.82rem;cursor:pointer;line-height:1}
        .rb-ai-pro__deep:hover,.rb-ai-pro__mic:hover{border-color:var(--rb-brand)}
        .rb-ai-pro__deep.is-on{background:var(--rb-brand);border-color:var(--rb-brand);color:#fff}
        .rb-ai-pro__mic.is-live{background:var(--rb-brand);border-color:var(--rb-brand);color:#fff;animation:rbPulse 1s infinite}
        .rb-ai-pro__mic:disabled{opacity:.4;cursor:not-allowed}
        .rb-ai-pro__cta{background:linear-gradient(135deg,var(--rb-brand),var(--rb-brand-press));border:1px solid transparent;color:#fff;border-radius:999px;padding:.3rem .7rem;font-size:.8rem;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 4px 14px -6px var(--rb-brand-glow)}
        .rb-ai-pro__cta:hover{filter:brightness(1.08)}
        @keyframes rbPulse{0%,100%{box-shadow:0 0 0 0 var(--rb-brand-glow)}50%{box-shadow:0 0 0 5px transparent}}
      `;
      document.head.appendChild(st);
    }
    const bar = document.createElement('div');
    bar.id = 'rb-ai-pro'; bar.className = 'rb-ai-pro';

    const style = document.createElement('select');
    style.className = 'rb-input rb-ai-pro__style'; style.title = 'Generation style (Pro)';
    for (const s of STYLES) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + (s.pro ? ' ◆' : ''); style.appendChild(o); }
    style.value = aiStyle();
    style.addEventListener('change', () => {
      const s = styleById(style.value);
      if (s.pro && !isPro()) { style.value = 'default'; setAiStyle('default'); showUpgrade('Generation styles'); return; }
      setAiStyle(style.value);
    });

    const deep = document.createElement('button');
    deep.type = 'button'; deep.className = 'rb-ai-pro__deep' + (aiDeep() ? ' is-on' : '');
    deep.textContent = '◆ Deep'; deep.title = 'Deep thinking — higher-reasoning pass (Pro)';
    deep.setAttribute('aria-pressed', aiDeep() ? 'true' : 'false');
    deep.addEventListener('click', () => {
      if (!isPro()) { showUpgrade('Deep thinking'); return; }
      const now = !aiDeep(); setAiDeep(now); deep.classList.toggle('is-on', now); deep.setAttribute('aria-pressed', now ? 'true' : 'false');
    });

    voiceBtn = document.createElement('button');
    voiceBtn.type = 'button'; voiceBtn.className = 'rb-ai-pro__mic'; voiceBtn.innerHTML = svgIcon('mic', 18);
    voiceBtn.title = voiceSupported() ? 'Voice — tap to talk (Pro)' : 'Voice not supported in this browser';
    voiceBtn.disabled = !voiceSupported();
    voiceBtn.addEventListener('click', () => {
      if (!isPro()) { showUpgrade('Voice control'); return; }
      if (!voice) voice = createVoice({
        onText: (t) => { if (refs.aiPrompt) refs.aiPrompt.value = t; sendAi(t); },
        onState: (st, d) => {
          voiceBtn.classList.toggle('is-live', st === 'listening');
          if (st === 'partial' && refs.aiPrompt) refs.aiPrompt.value = d || '';
          if (st === 'error') setStatus('Voice: ' + (d || 'error'));
        },
      });
      if (!voice) { voiceBtn.disabled = true; return; }
      if (voice.active()) voice.stop(); else voice.start();
    });

    const cta = document.createElement('button');
    cta.type = 'button'; cta.className = 'rb-ai-pro__cta'; cta.textContent = '✦ Get Pro';
    cta.title = 'Unlock voice, generation styles, and deep thinking';
    cta.addEventListener('click', () => showUpgrade());
    bar.appendChild(style); bar.appendChild(deep); bar.appendChild(voiceBtn); bar.appendChild(cta);
    refs.aiForm.parentNode.insertBefore(bar, refs.aiForm);
    const refreshCta = () => { cta.style.display = isPro() ? 'none' : ''; };
    refreshCta();
    window.addEventListener('rb-pro-changed', refreshCta);
  }
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
        ? 'Connected. Select an element on the page, then tell me what to change — e.g. "make this hero dark with a red headline".'
        : 'Add your API key below (Connect) — Anthropic, OpenAI, or Google. The editor works fully without me.');
    }
  }
  // Editor tool surface for a paired LLM (the "MCP tools" — Designs' slice of the
  // family agent layer). Each method is the executor behind a tool spec in
  // ai/tools.js; the model calls them by name to inspect and change the page.
  let aiOutlineCache = [];
  const editorAdapter = {
    get_page_outline() {
      aiOutlineCache = (live.getOutline && live.getOutline()) || [];
      return aiOutlineCache.map((e, i) => ({ index: i, depth: e.depth, label: e.label, text: e.text }));
    },
    get_selection_html() { return (live.getSelectionHtml && live.getSelectionHtml()) || ''; },
    select_element({ index }) {
      const e = aiOutlineCache[index];
      if (!e) throw new Error(`No element at index ${index} — call get_page_outline first.`);
      live.selectNode(e.node);
      return `selected [${index}] ${e.label || ''}`.trim();
    },
    replace_selection({ html }) {
      const applied = live.applyAIEdit(html);
      if (applied) setStatus('AI applied a change');
      return applied ? 'replaced' : 'nothing selected (or invalid HTML) — try select_element first';
    },
    insert_html({ html, name }) { live.insertElement({ html, name: name || 'element' }); setStatus('AI inserted an element'); return 'inserted'; },
  };

  async function sendAi(prompt) {
    const c = aiConfig();
    if (!c.key || !c.provider) { addAiMsg('assistant', 'No key set — click "Connect / change LLM key" below.'); return; }
    addAiMsg('user', prompt);
    if (refs.aiAsk) refs.aiAsk.classList.add('is-busy');
    try { await sendAiInner(prompt, c); } finally { if (refs.aiAsk) refs.aiAsk.classList.remove('is-busy'); }
  }
  async function sendAiInner(prompt, c) {
    const pending = addAiMsg('assistant', '…thinking');
    // Tool-driven path: pair an OpenAI-compatible model (incl. a local endpoint)
    // with the editor tools so it can inspect the page and act directly across
    // rounds. Falls back to single-shot chat for other providers or if the model
    // doesn't support tool calls.
    const canUseTools = (c.provider === 'compatible' || c.provider === 'openai') && mode === 'live';
    if (canUseTools) {
      try {
        const user = `${prompt}\n\nUse the editor tools to inspect the page and make the change.`;
        const { text, calls } = await chatWithTools({
          apiKey: c.key, model: c.model, baseUrl: c.baseUrl,
          system: TOOLS_SYSTEM_PROMPT + styleDirective(aiStyle()), user, tools: openAiToolsParam(),
          dispatch: (name, args) => runTool(name, args, editorAdapter), deep: aiDeep(),
        });
        const acted = (calls || []).filter((k) => k.out && k.out.ok).map((k) => k.name);
        pending.textContent = text || (acted.length ? `Done — ${acted.join(', ')}.` : 'Done.');
        return;
      } catch (err) {
        // Tool calls unsupported (older/local model) or transport error — fall
        // through to plain chat rather than failing the request.
        console.warn('Tool-mode AI failed, falling back to plain chat:', err?.message || err);
      }
    }
    const ctx = (mode === 'live') ? live.getSelectionHtml() : (build.getHtmlCss().html || '');
    const user = `${prompt}\n\nSelected element (return its complete replacement if you change it):\n\`\`\`html\n${ctx}\n\`\`\``;
    try {
      const text = await aiChat({ provider: c.provider, apiKey: c.key, model: c.model, baseUrl: c.baseUrl, system: SYSTEM_PROMPT + styleDirective(aiStyle()), user, deep: aiDeep() });
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
  try { renderStartScreen(); } catch (_e) { console.error('renderStartScreen:', _e); }
  try { injectProToolbar(); } catch (_e) { console.error('injectProToolbar:', _e); }
  setStatus('Editor ready — open a page or build from scratch');

  // ---- auto-load from RHOBEAR Designs API ---------------------------------
  // `?designs_page_id=<id>` (optionally with `&designs_api=<baseUrl>`) tells
  // the editor to fetch the page state from the Designs API and open it in
  // Live mode for hand-editing. This is the entry point the agent uses.
  //
  // Resolution order for the API base URL:
  //   1. `?designs_api=<baseUrl>` query param (per-link override)
  //   2. `window.__RB_DESIGNS_API__` global (host page config)
  //   3. `rb-designs-api` preference (set via settings, synced if signed in)
  //   4. `/v1` same-origin (when the editor is reverse-proxied behind the API)
  (async function autoLoadFromApi() {
    try {
      const url = new URL(window.location.href);
      const pageId = url.searchParams.get('designs_page_id');
      if (!pageId) return;
      const fromQuery = (url.searchParams.get('designs_api') || '').replace(/\/$/, '');
      const fromGlobal = (typeof window !== 'undefined' && window.__RB_DESIGNS_API__) || '';
      let fromLs = '';
      try { fromLs = (getPref('rb-designs-api', '') || '').replace(/\/$/, ''); } catch (_e) { console.warn('designs-api prefs read:', _e); }
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
