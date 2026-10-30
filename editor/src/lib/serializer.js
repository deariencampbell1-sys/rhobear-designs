/**
 * HTML/CSS serializer — wraps editor output with a clean document shell.
 * MIT — RHOBEAR Designs (original)
 */

export function wrapExportedHtml({ html, css, title = 'Untitled page' }) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
${css || ''}
  </style>
</head>
<body>
${html || ''}
</body>
</html>`;
}

export function parseImportedHtml(raw) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  const styles = [...doc.querySelectorAll('style')]
    .map((el) => el.textContent || '')
    .join('\n');

  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')]
    .map((el) => `@import url('${el.getAttribute('href')}');`)
    .join('\n');

  const bodyHtml = doc.body?.innerHTML?.trim() || raw;

  return {
    html: bodyHtml,
    css: [links, styles].filter(Boolean).join('\n'),
    title: doc.querySelector('title')?.textContent?.trim() || 'Imported page',
  };
}

export function extractBodyFromFragment(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { html: '', css: '' };
  if (!trimmed.includes('<')) {
    return { html: `<p>${escapeHtml(trimmed)}</p>`, css: '' };
  }
  return parseImportedHtml(trimmed.startsWith('<!') ? trimmed : `<body>${trimmed}</body>`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}