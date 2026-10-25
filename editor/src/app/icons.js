// Inline line-icons for the editor chrome — replaces color-emoji buttons
// (🗑 🎙 🎯) (no emoji as UI icons). Monochrome, currentColor,
// so each button tints via its own `color`. Returns an SVG STRING for the
// vanilla-DOM `innerHTML` / template usage in this codebase.
const PATHS = {
  trash: '<path d="M4.5 7h15M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18.5 7M10 10.5v6M14 10.5v6"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.5v3M12 19.5v3M22.5 12h-3M4.5 12h-3"/>',
  check: '<path d="M5 12.5 10 17 19 6.5"/>',
};

export function svgIcon(name, size = 16) {
  const p = PATHS[name];
  if (!p) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-0.15em">${p}</svg>`;
}
