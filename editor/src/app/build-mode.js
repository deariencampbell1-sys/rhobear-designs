/**
 * Build mode — temporary stand-in for the previous implementation.
 * The editing surface shows a rebuild notice while the feature is replaced.
 * MIT — RHOBEAR Designs (original)
 */

const NOTICE = 'This feature is being rebuilt.';

function showNotice() {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('build-canvas');
  if (host) host.textContent = NOTICE;
}

export function createBuildMode(refs) {
  const { onStatus, onSelectionChange } = refs;
  let announced = false;

  function ensure() {
    showNotice();
    if (!announced) {
      announced = true;
      if (onStatus) onStatus(NOTICE);
    }
    return null;
  }

  const ops = {
    ensure,
    get editor() { return null; },
    addSection() { ensure(); },
    addText() { ensure(); },
    addImage() { ensure(); },
    embed() { ensure(); },
    undo() { ensure(); },
    redo() { ensure(); },
    setDevice() { ensure(); },
    duplicate() { ensure(); },
    remove() { ensure(); },
    newPage() { ensure(); },
    loadContent() { ensure(); },
    getExport() { ensure(); return NOTICE; },
    getHtmlCss() { ensure(); return { html: NOTICE, css: '' }; },
    hasUndo() { return false; },
    hasRedo() { return false; },
    onChange() { ensure(); },
  };
  return ops;
}
