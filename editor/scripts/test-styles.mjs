import { JSDOM } from 'jsdom';
import grapesjs from 'grapesjs';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.DOMParser = dom.window.DOMParser;

const OUR_PROPS = [
  'display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap',
  'position', 'top', 'right', 'bottom', 'left', 'z-index', 'overflow',
  'width', 'height', 'max-width', 'min-height', 'margin', 'padding',
  'font-family', 'font-size', 'font-weight', 'letter-spacing', 'color',
  'line-height', 'text-align', 'text-decoration', 'text-shadow',
  'background-color', 'background', 'border-radius', 'border', 'box-shadow', 'opacity',
];

const ed = grapesjs.init({
  headless: true,
  storageManager: false,
  autorender: false,
  selectorManager: { componentFirst: true },
});

const sm = ed.StyleManager;
const builtIn = sm.properties || sm.getProperties?.() || [];

// probe each property via temp sector
for (const prop of OUR_PROPS) {
  const sector = sm.addSector(`test-${prop}`, { name: 'T', properties: [prop] });
  const p = sector.get('properties').at(0);
  const type = p?.get('type');
  const property = p?.get('property');
  if (!type || type === 'base' || !property) {
    console.log('BROKEN:', prop, type, property);
  }
  sm.removeSector(`test-${prop}`);
}

ed.destroy();
console.log('done');