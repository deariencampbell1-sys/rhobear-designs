/**
 * Toolbar action router — every data-action maps to one handler.
 * MIT — RHOBEAR Designs (original)
 */

import { addSection, addTextBlock, addImageBlock, insertEmbed } from './build-editor.js';
import { wrapExportedHtml } from '../lib/serializer.js';

const PANEL_MAP = {
  blocks: 'panel-blocks',
  layers: 'panel-layers',
  styles: 'panel-styles',
};

export function wireToolbar(editor, fileIO) {
  const embedModal = document.getElementById('embed-modal');
  const previewModal = document.getElementById('preview-modal');
  const previewFrame = document.getElementById('preview-frame');
  const fileHtmlInput = document.getElementById('file-html');
  const fileFolderInput = document.getElementById('file-folder');
  const fileImageInput = document.getElementById('file-image');

  const actions = {
    new: () => {
      if (confirm('Start a new blank page? Unsaved changes will be lost.')) {
        fileIO.newProject();
      }
    },

    'open-html': () => fileHtmlInput.click(),

    'open-folder': () => fileFolderInput.click(),

    'save-html': () => fileIO.saveHtml(),

    'export-zip': () => fileIO.exportZip(),

    undo: () => editor.UndoManager.undo(),

    redo: () => editor.UndoManager.redo(),

    delete: () => {
      const sel = editor.getSelected();
      if (sel && !sel.is('wrapper')) {
        sel.remove();
        fileIO.setStatus('Deleted selected element');
      }
    },

    duplicate: () => {
      const sel = editor.getSelected();
      if (sel && !sel.is('wrapper')) {
        const parent = sel.parent();
        if (parent) {
          const clone = sel.clone();
          parent.append(clone);
          editor.select(clone);
          fileIO.setStatus('Duplicated element');
        }
      }
    },

    'add-section': () => {
      addSection(editor);
      fileIO.setStatus('Added section');
    },

    'add-text': () => {
      addTextBlock(editor);
      fileIO.setStatus('Added text block');
    },

    'add-image': () => fileImageInput.click(),

    embed: () => embedModal.showModal(),

    'embed-cancel': () => embedModal.close(),

    'device-desktop': () => setDevice(editor, 'Desktop', 'device-desktop'),

    'device-tablet': () => setDevice(editor, 'Tablet', 'device-tablet'),

    'device-mobile': () => setDevice(editor, 'Mobile', 'device-mobile'),

    preview: () => {
      const payload = fileIO.getExportPayload();
      const html = wrapExportedHtml(payload);
      previewFrame.srcdoc = html;
      previewModal.showModal();
    },

    'preview-close': () => previewModal.close(),

    'toggle-blocks': () => togglePanel('blocks'),

    'toggle-layers': () => togglePanel('layers'),

    'toggle-styles': () => togglePanel('styles'),
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const handler = actions[action];
    if (handler) {
      e.preventDefault();
      handler();
    }
  });

  document.getElementById('embed-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('embed-code').value.trim();
    if (code) {
      insertEmbed(editor, code);
      document.getElementById('embed-code').value = '';
      embedModal.close();
      fileIO.setStatus('Embed inserted');
    }
  });

  fileHtmlInput.addEventListener('change', async () => {
    const file = fileHtmlInput.files?.[0];
    if (file) {
      try {
        await fileIO.loadHtmlFile(file);
      } catch (err) {
        fileIO.setStatus(`Error: ${err.message}`);
      }
    }
    fileHtmlInput.value = '';
  });

  fileFolderInput.addEventListener('change', async () => {
    const files = fileFolderInput.files;
    if (files?.length) {
      try {
        await fileIO.loadFolder(files);
      } catch (err) {
        fileIO.setStatus(`Error: ${err.message}`);
      }
    }
    fileFolderInput.value = '';
  });

  fileImageInput.addEventListener('change', async () => {
    const file = fileImageInput.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      editor.AssetManager.add({ src: url, name: file.name });
      addImageBlock(editor, url);
      fileIO.setStatus(`Added image: ${file.name}`);
    }
    fileImageInput.value = '';
  });

  editor.on('change:changesCount', () => {
    const um = editor.UndoManager;
    setBtnDisabled('btn-undo', !um.hasUndo());
    setBtnDisabled('btn-redo', !um.hasRedo());
  });

  return actions;
}

function setDevice(editor, name, btnAction) {
  editor.setDevice(name);
  document.querySelectorAll('[data-action^="device-"]').forEach((b) => {
    b.classList.toggle('rb-btn--active', b.dataset.action === btnAction);
  });
}

function togglePanel(panel) {
  const id = PANEL_MAP[panel];
  const el = document.getElementById(id);
  const btn = document.querySelector(`[data-panel="${panel}"]`);
  if (!el || !btn) return;
  const hidden = el.classList.toggle('is-hidden');
  btn.classList.toggle('rb-btn--active', !hidden);
}

function setBtnDisabled(testId, disabled) {
  const btn = document.querySelector(`[data-testid="${testId}"]`);
  if (btn) btn.disabled = disabled;
}