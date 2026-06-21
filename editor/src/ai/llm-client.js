/**
 * Bring-your-own-key LLM client. Talks directly from the browser to the user's
 * chosen provider (Anthropic / OpenAI / Google). Keys are the user's own,
 * stored locally — never sent to RHOBEAR. This is the AI seam: the editor works
 * without it; with a key, the assistant returns edits the editor applies.
 * MIT — RHOBEAR Designs (original)
 */
export const PROVIDER_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
};

export const PROVIDER_LABELS = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  google: 'Google (Gemini)',
};

/**
 * @param {{provider:string, apiKey:string, model?:string, system:string, user:string}} opts
 * @returns {Promise<string>} assistant text
 */
export async function chat({ provider, apiKey, model, system, user }) {
  if (!apiKey) throw new Error('No API key set — add one in settings.');
  const m = model || PROVIDER_MODELS[provider];
  if (provider === 'anthropic') return anthropic(apiKey, m, system, user);
  if (provider === 'openai') return openai(apiKey, m, system, user);
  if (provider === 'google') return google(apiKey, m, system, user);
  throw new Error(`Unknown provider: ${provider}`);
}

async function anthropic(key, model, system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: [{ role: 'user', content: user }] }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || `Anthropic error ${res.status}`);
  return (d.content || []).map((c) => c.text || '').join('');
}

async function openai(key, model, system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || `OpenAI error ${res.status}`);
  return d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
}

async function google(key, model, system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || `Google error ${res.status}`);
  const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
  return (parts || []).map((p) => p.text || '').join('');
}

/** Split an assistant reply into the conversational text + any fenced HTML edit. */
export function parseEdit(text) {
  const m = String(text || '').match(/```(?:html)?\s*([\s\S]*?)```/i);
  const html = m ? m[1].trim() : null;
  const reply = String(text || '').replace(/```[\s\S]*?```/g, '').trim();
  return { html, reply: reply || (html ? 'Done — applied the change.' : String(text || '')) };
}

export const SYSTEM_PROMPT =
  'You are a web-design assistant embedded in a live visual website editor. The user is editing a real ' +
  'web page. You will be given the currently SELECTED element\'s HTML (or the page body if nothing is ' +
  'selected). When the user asks for a change, reply with a short sentence, then provide the COMPLETE ' +
  'replacement HTML for the selected element inside ONE ```html code block. Keep it self-contained with ' +
  'inline styles, preserve the element\'s intent, and make it tasteful. If the user only asks a question, ' +
  'just answer — no code block.';
