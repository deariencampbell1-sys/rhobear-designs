/**
 * Style manager sectors — GrapesJS built-in properties only.
 * MIT — RHOBEAR Designs (original)
 */

export const STYLE_MANAGER_CONFIG = {
  appendTo: '#gjs-styles',
  highlightComputed: true,
  showComputed: true,
  clearProperties: true,
  avoidComputed: ['width', 'height'],
  sectors: [
    {
      id: 'layout',
      name: 'Layout',
      open: true,
      properties: [
        'display',
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'overflow',
      ],
    },
    {
      id: 'flex',
      name: 'Flex',
      open: false,
      properties: [
        'flex-direction',
        'flex-wrap',
        'justify-content',
        'align-items',
        'align-content',
        {
          name: 'Gap',
          property: 'gap',
          type: 'number',
          units: ['px', 'em', 'rem', '%'],
          defaults: '0',
          requires: { display: ['flex', 'inline-flex', 'grid', 'inline-grid'] },
        },
      ],
    },
    {
      id: 'size',
      name: 'Size',
      open: true,
      properties: [
        'width',
        'height',
        'max-width',
        'min-height',
        'margin',
        'padding',
      ],
    },
    {
      id: 'typography',
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
        'text-shadow',
      ],
    },
    {
      id: 'decorations',
      name: 'Decorations',
      open: false,
      properties: [
        'background-color',
        'border-radius',
        'border',
        'box-shadow',
        'background',
        'opacity',
      ],
    },
  ],
};