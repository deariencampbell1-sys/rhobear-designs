/**
 * Build-mode editor seam.
 *
 * The previous implementation has been removed. This stand-in keeps the
 * same public exports so the shell and the headless mode wrapper still
 * load, and tells the user plainly that the feature is being rebuilt.
 */

const REBUILD_MESSAGE = 'This feature is being rebuilt.';

function renderStandIn() {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('gjs');
  if (!host) return;
  host.innerHTML = `<p class="rb-rebuild" role="status">${REBUILD_MESSAGE}</p>`;
}

function noop() {}

export function createEditor() {
  renderStandIn();
  return {
    on: noop,
    off: noop,
    destroy: noop,
    destroyAll: noop,
    getHtml: () => `<p class="rb-rebuild">${REBUILD_MESSAGE}</p>`,
    getCss: () => '',
    setComponents: noop,
    setStyle: noop,
    getSelected: () => null,
    getWrapper: () => ({ append: noop }),
    select: noop,
    setDevice: noop,
    UndoManager: {
      undo: noop,
      redo: noop,
      hasUndo: () => false,
      hasRedo: () => false,
      clear: noop,
    },
    AssetManager: { add: noop },
    Panels: { getPanels: () => ({ reset: noop }) },
  };
}

export function addSection() {
  return REBUILD_MESSAGE;
}

export function addTextBlock() {
  return REBUILD_MESSAGE;
}

export function addImageBlock() {
  return REBUILD_MESSAGE;
}

export function insertEmbed() {
  return REBUILD_MESSAGE;
}
