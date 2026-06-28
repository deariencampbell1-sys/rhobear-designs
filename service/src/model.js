/**
 * OpenRouter — house model caller. Default = Expert tier (minimax/minimax-m3)
 * for design quality. The fallback (`minimax/minimax-m2.7`) kicks in if the
 * primary call fails with a non-retryable error.
 */
import { CONFIG } from './config.js';

export const SYSTEM_PROMPT =
  'You are a senior web designer producing HTML for the RHOBEAR Designs editor. ' +
  'Produce a SINGLE complete HTML document (a full <!DOCTYPE html>.../html> page) that ' +
  'loads in any browser without external network requests beyond Google Fonts (optional). ' +
  'Inline all CSS in a <style> block at the top of <head>. Use tasteful, modern design: ' +
  'clear hierarchy, generous spacing, accessible color contrast, semantic HTML5, ' +
  'responsive layout. Replace any real brand logos with neutral placeholder blocks. ' +
  'Do NOT include analytics, tracking, or external scripts. ' +
  'Respond with a one-sentence summary, then a single ```html``` code fence containing ' +
  'the full page. The HTML inside the fence must parse as a complete document; it will ' +
  'be opened in a visual editor immediately.';

export const EDIT_SYSTEM_PROMPT =
  'You are editing an existing web page inside the RHOBEAR Designs editor. ' +
  'The user gives an instruction; you return the COMPLETE updated HTML for the page inside ' +
  'one ```html``` fence. Inline all CSS. Preserve the existing intent and quality; make ' +
  'the smallest change that satisfies the request. Respond with a one-sentence summary, ' +
  'then a single ```html``` code fence.';

export async function callOpenRouter({ system, user, model, maxTokens }) {
  if (!CONFIG.openrouter.apiKey) throw new Error('OPENROUTER_API_KEY not set');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), CONFIG.openrouter.timeoutMs);
  try {
    const res = await fetch(`${CONFIG.openrouter.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${CONFIG.openrouter.apiKey}`,
        'http-referer': 'https://rhobear.ai',
        'x-title': 'RHOBEAR Designs',
      },
      body: JSON.stringify({
        model: model || CONFIG.openrouter.defaultModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens || CONFIG.openrouter.maxTokens,
        reasoning: { effort: 'medium' },
      }),
      signal: ctl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `OpenRouter ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    const text = body?.choices?.[0]?.message?.content || '';
    const reasoning = body?.choices?.[0]?.message?.reasoning || '';
    return { text, reasoning, raw: body };
  } finally {
    clearTimeout(t);
  }
}

export function parsePageReply(text) {
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const html = fence ? fence[1].trim() : '';
  const summary = (text.split('```')[0] || '').trim();
  if (!html) throw new Error('Model reply did not contain an ```html``` fence');
  if (!/<html[\s>]/i.test(html)) {
    throw new Error('Model returned HTML but it is missing the <html> root element');
  }
  return { html, summary: summary || 'Page generated.' };
}

export function extractBodyFragment(html) {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Edited page</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px}</style></head><body>${html}</body></html>`;
}