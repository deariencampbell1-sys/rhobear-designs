/**
 * Build mode — "Build from scratch". Thin controller over the proven
 * GrapesJS init (grapes-init.js), which mounts into the existing DOM ids
 * (#gjs, #gjs-blocks, #gjs-layers, #gjs-styles, #gjs-traits). Lazy-mounted
 * on first entry so the live-first experience loads instantly.
 * MIT — RHOBEAR Designs (original)
 */
import {
  createEditor, addSection, addTextBlock, addImageBlock, insertEmbed,
} from '../editor/grapes-init.js';

export function createBuildMode(refs) {
  const { onStatus, onSelectionChange } = refs;
  let editor = null;

  function ensure() {
    if (editor) return editor;
    editor = createEditor();
    editor.on('component:selected', (c) => {
      const tag = (c && c.get && (c.get('tagName') || c.get('type'))) || 'element';
      if (onSelectionChange) onSelectionChange({ tag, component: c });
    });
    editor.on('component:deselected', () => { if (onSelectionChange) onSelectionChange(null); });
    return editor;
  }

  const ops = {
    ensure,
    get editor() { return editor; },
    addSection() { addSection(ensure()); onStatus && onStatus('Added section'); },
    addText() { addTextBlock(ensure()); onStatus && onStatus('Added text block'); },
    addImage(src) { addImageBlock(ensure(), src); onStatus && onStatus('Added image'); },
    embed(code) { insertEmbed(ensure(), code); onStatus && onStatus('Embed inserted'); },
    undo() { editor && editor.UndoManager.undo(); },
    redo() { editor && editor.UndoManager.redo(); },
    setDevice(name) { editor && editor.setDevice(name); },
    duplicate() {
      const sel = editor && editor.getSelected();
      if (sel && !sel.is('wrapper')) { const p = sel.parent(); if (p) { const c = sel.clone(); p.append(c); editor.select(c); onStatus && onStatus('Duplicated element'); } }
    },
    remove() {
      const sel = editor && editor.getSelected();
      if (sel && !sel.is('wrapper')) { sel.remove(); onStatus && onStatus('Deleted element'); }
    },
    newPage() { const e = ensure(); e.setComponents(''); e.setStyle(''); e.UndoManager.clear(); onStatus && onStatus('New blank page'); },
    loadContent(html, css) { const e = ensure(); e.setComponents(html || ''); if (css) e.setStyle(css); e.UndoManager.clear(); },
    getExport(title) {
      const e = ensure();
      const html = e.getHtml(); const css = e.getCss();
      return wrap(html, css, title);
    },
    getHtmlCss() { const e = ensure(); return { html: e.getHtml(), css: e.getCss() }; },
    hasUndo() { return !!(editor && editor.UndoManager.hasUndo()); },
    hasRedo() { return !!(editor && editor.UndoManager.hasRedo()); },
    onChange(cb) { ensure().on('update', cb); },
  };
  return ops;
}

function wrap(html, css, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title || 'Untitled page')}</title>
<style>
${css || ''}
</style>
</head>
<body>
${html || ''}
</body>
</html>`;
}
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
