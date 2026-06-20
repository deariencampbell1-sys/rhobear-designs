/**
 * GrapesJS initialization — MIT core (grapesjs) + preset plugins.
 */

import grapesjs from '../vendor/grapesjs/grapesjs/dist/grapes.mjs';
import '../vendor/grapesjs/grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from '../vendor/grapesjs/grapesjs-preset-webpage/dist/index.js';
import gjsBlocksBasic from '../vendor/grapesjs/grapesjs-blocks-basic/dist/index.js';
import gjsPluginForms from '../vendor/grapesjs/grapesjs-plugin-forms/dist/index.js';
import gjsCustomCode from '../vendor/grapesjs/grapesjs-custom-code/dist/index.js';

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
    styleManager: {
      appendTo: '#gjs-styles',
      sectors: [
        {
          name: 'Layout',
          open: true,
          properties: [
            'display',
            'flex-direction',
            'justify-content',
            'align-items',
            'flex-wrap',
            'gap',
            'position',
            'top',
            'right',
            'bottom',
            'left',
            'z-index',
            'overflow',
          ],
        },
        {
          name: 'Size',
          open: false,
          properties: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
        },
        {
          name: 'Typography',
          open: false,
          properties: [
            'font-family',
            'font-size',
            'font-weight',
            'letter-spacing',
            'color',
            'line-height',
            'text-align',
            'text-decoration',
            'text-shadow',
          ],
        },
        {
          name: 'Decorations',
          open: false,
          properties: [
            'background-color',
            'background',
            'border-radius',
            'border',
            'box-shadow',
            'opacity',
          ],
        },
      ],
    },
    traitManager: {
      appendTo: '#gjs-traits',
    },
    selectorManager: { componentFirst: true },
    richTextEditor: {
      actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
    },
    plugins: [gjsPresetWebpage, gjsBlocksBasic, gjsPluginForms, gjsCustomCode],
    pluginsOpts: {
      [gjsPresetWebpage]: {
        modalImportTitle: 'Import',
        modalImportButton: 'Import',
        importViewerOptions: {},
      },
      [gjsCustomCode]: {},
    },
    panels: { defaults: [] },
  });

  editor.setComponents(BLANK_PAGE);

  editor.on('component:selected', (component) => {
    const el = document.getElementById('status-selection');
    if (el) {
      const tag = component.get('tagName') || 'element';
      const type = component.get('type') || tag;
      el.textContent = `Selected: <${tag}> (${type})`;
    }
  });

  editor.on('component:deselected', () => {
    const el = document.getElementById('status-selection');
    if (el) el.textContent = 'No selection';
  });

  editor.on('load', () => {
    editor.Panels.getPanels().reset([]);
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