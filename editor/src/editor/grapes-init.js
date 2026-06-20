/**
 * GrapesJS initialization — MIT core (grapesjs) + preset plugins.
 */

import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import gjsPluginForms from 'grapesjs-plugin-forms';
import gjsCustomCode from 'grapesjs-custom-code';
import { STYLE_MANAGER_CONFIG } from './style-sectors.js';

const BLANK_PAGE = `
<section style="padding: 60px 24px; text-align: center; font-family: system-ui, sans-serif;">
  <h1 style="font-size: 2.5rem; margin-bottom: 16px;">Your page title</h1>
  <p style="color: #666; max-width: 560px; margin: 0 auto 24px;">Click any element to edit. Drag blocks from the left panel or use the toolbar to add sections.</p>
  <a href="#" style="display: inline-block; padding: 12px 28px; background: #7c5cff; color: #fff; text-decoration: none; border-radius: 8px;">Get started</a>
</section>`;

export function createEditor() {
  const editor = grapesjs.init({
    container: '#gjs',
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,
    undoManager: { trackSelection: false },
    assetManager: {
      embedAsBase64: true,
      assets: [],
    },
    canvas: {
      styles: [
        'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap',
      ],
    },
    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '992px' },
        { name: 'Mobile', width: '375px', widthMedia: '480px' },
      ],
    },
    blockManager: {
      appendTo: '#gjs-blocks',
    },
    layerManager: {
      appendTo: '#gjs-layers',
    },
    styleManager: STYLE_MANAGER_CONFIG,
    traitManager: {
      appendTo: '#gjs-traits',
    },
    selectorManager: {
      componentFirst: true,
    },
    richTextEditor: {
      actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
    },
    plugins: [gjsPresetWebpage, gjsBlocksBasic, gjsPluginForms, gjsCustomCode],
    pluginsOpts: {
      [gjsPresetWebpage]: {
        modalImportTitle: 'Import',
        modalImportButton: 'Import',
        importViewerOptions: {},
        useCustomTheme: false,
      },
      [gjsCustomCode]: {},
    },
    panels: { defaults: [] },
  });

  editor.setComponents(BLANK_PAGE);

  const syncStyleManager = (component) => {
    editor.StyleManager.select(component || null);
  };

  editor.on('component:selected', (component) => {
    syncStyleManager(component);
    const el = document.getElementById('status-selection');
    if (el) {
      const tag = component.get('tagName') || 'element';
      const type = component.get('type') || tag;
      el.textContent = `Selected: <${tag}> (${type})`;
    }
  });

  editor.on('component:deselected', () => {
    syncStyleManager(null);
    const el = document.getElementById('status-selection');
    if (el) el.textContent = 'No selection';
  });

  editor.on('style:property:update', (data) => {
    const el = document.getElementById('status-message');
    if (!el || !data?.property) return;
    const prop = data.property;
    const name = prop.getName?.() || prop.get?.('property') || 'style';
    const value = data.value ?? prop.getValue?.() ?? '';
    el.textContent = `Style: ${name} → ${value}`;
  });

  editor.on('load', () => {
    editor.Panels.getPanels().reset([]);
    const host = document.getElementById('gjs-styles');
    if (host && host.childElementCount === 0) {
      editor.StyleManager.render();
    }
  });

  return editor;
}

export function addSection(editor) {
  const wrapper = editor.getWrapper();
  wrapper.append({
    tagName: 'section',
    style: { padding: '48px 24px', 'background-color': '#f8f8fa' },
    components: [
      {
        tagName: 'div',
        style: { 'max-width': '960px', margin: '0 auto' },
        components: [
          { tagName: 'h2', type: 'text', content: 'Section heading' },
          { tagName: 'p', type: 'text', content: 'Add your content here. Double-click text to edit inline.' },
        ],
      },
    ],
  });
}

export function addTextBlock(editor) {
  const selected = editor.getSelected();
  const target = selected || editor.getWrapper();
  target.append({
    tagName: 'p',
    type: 'text',
    content: 'New paragraph — double-click to edit.',
    style: { 'font-size': '16px', 'line-height': '1.6', color: '#333' },
  });
}

export function addImageBlock(editor, src) {
  const selected = editor.getSelected();
  const target = selected || editor.getWrapper();
  target.append({
    type: 'image',
    attributes: { alt: 'Image' },
    style: { width: '100%', 'max-width': '480px', display: 'block' },
    ...(src ? { src } : {}),
  });
}

export function insertEmbed(editor, code) {
  const selected = editor.getSelected();
  const target = selected || editor.getWrapper();
  target.append({
    tagName: 'div',
    attributes: { class: 'embed-wrap', 'data-embed': 'true' },
    style: { width: '100%', 'min-height': '120px' },
    components: code,
  });
}