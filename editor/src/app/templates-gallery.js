/**
 * Templates gallery — browse the bundled template bank (62+ designs) and open
 * one into the live editor. Template HTML is bundled at build time via
 * import.meta.glob (works in dev + prod, no fetch); thumbnails likewise.
 * MIT — RHOBEAR Designs (original)
 */
import templatesManifest from '../library/templates/manifest.json';

const ENTRIES = (templatesManifest && templatesManifest.entries) || [];
// Lazy raw-string loaders for every sample HTML in the repo-root samples/ dir.
const htmlLoaders = import.meta.glob('../../../samples/**/*.html', { query: '?raw', import: 'default' });
// Eager thumbnail URLs.
const thumbUrls = import.meta.glob('../library/templates/thumbs/*.png', { query: '?url', import: 'default', eager: true });

function htmlLoaderFor(sourcePath) {
  const tail = String(sourcePath || '').replace(/^samples\//, '');
  const key = Object.keys(htmlLoaders).find((k) => k.endsWith('/' + tail) || k.endsWith(tail));
  return key ? htmlLoaders[key] : null;
}
function thumbFor(entry) {
  if (!entry.thumb) return null;
  const base = String(entry.thumb).split('/').pop();
  const key = Object.keys(thumbUrls).find((k) => k.endsWith('/' + base) || k.endsWith(base));
  return key ? thumbUrls[key] : null;
}

export function createTemplatesGallery({ modal, grid, search, countEl, onOpen, onStatus }) {
  let built = false;

  function build(filter) {
    grid.innerHTML = '';
    const q = (filter || '').toLowerCase().trim();
    const list = ENTRIES.filter((e) =>
      !q || `${e.name} ${(e.tags || []).join(' ')} ${e.description || ''} ${e.collection || ''}`.toLowerCase().includes(q));
    if (countEl) countEl.textContent = String(list.length);
    for (const e of list) {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'rb-tpl-card';
      const thumb = thumbFor(e);
      const thumbHtml = thumb
        ? `<span class="rb-tpl-card__thumb" style="background-image:url('${thumb}')"></span>`
        : `<span class="rb-tpl-card__thumb rb-tpl-card__thumb--ph">${escapeHtml((e.name || '?').trim()[0] || '?')}</span>`;
      card.innerHTML = `${thumbHtml}<span class="rb-tpl-card__name">${escapeHtml(e.name || e.id)}</span>` +
        `<span class="rb-tpl-card__meta">${escapeHtml(e.description || e.collection || '')}</span>`;
      card.addEventListener('click', async () => {
        const loader = htmlLoaderFor(e.sourcePath);
        if (!loader) { if (onStatus) onStatus(`Template source missing: ${e.sourcePath}`); return; }
        if (onStatus) onStatus(`Opening ${e.name}…`);
        try {
          const html = await loader();
          modal.close();
          onOpen(html, e);
        } catch (err) {
          if (onStatus) onStatus(`Failed to open template: ${err.message}`);
        }
      });
      grid.appendChild(card);
    }
  }

  function open() {
    if (!built) { build(''); built = true; }
    modal.showModal();
  }

  if (search) search.addEventListener('input', () => build(search.value));
  return { open, build, count: ENTRIES.length };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
