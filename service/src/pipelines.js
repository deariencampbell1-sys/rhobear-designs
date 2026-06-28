/**
 * Generation + iteration pipelines. The heart of the API.
 */
import { newJobId, newPageId, CONFIG, editorUrlFor } from './config.js';
import { readPage, writePage, readJob, writeJob } from './store.js';
import { checkQuota, recordQuotaUsage } from './quota.js';
import { callOpenRouter, SYSTEM_PROMPT, EDIT_SYSTEM_PROMPT, parsePageReply } from './model.js';

function deriveName(prompt) {
  const words = String(prompt || '').trim().split(/\s+/).slice(0, 6).join(' ');
  return (words || 'Untitled').slice(0, 80);
}

function renderGeneratePrompt({ prompt, brand, target }) {
  const lines = ['Brief: ' + String(prompt || '').trim()];
  if (brand) lines.push('Brand context: ' + JSON.stringify(brand));
  if (target) lines.push('Target audience / device: ' + String(target));
  lines.push('Produce the page now.');
  return lines.join('\n');
}

// ─── Quota + model call shared by generate / redo ────────────────────────────
async function generateOnce({ prompt, workspace_id, brand, target, page_id, kind, tick }) {
  // 1) Quota check
  if (tick) tick('checking_quota');
  const q = await checkQuota(workspace_id, 'generate');
  if (!q.allowed) {
    const code = q.source === 'unavailable' ? 'quota_unavailable' : 'over_quota';
    const msg = code === 'over_quota'
      ? `Workspace ${workspace_id} is over its daily generation quota (remaining=${q.remaining ?? 0}, resets=${q.reset_at}).`
      : `Quota service is unreachable; refusing generation to avoid untracked billing. Set RHOBEAR_DESIGNS_BYPASS_QUOTA=1 for local dev.`;
    throw Object.assign(new Error(msg), { code });
  }

  // 2) Model call (with fallback) — also retry once on parse failure.
  if (tick) tick('generating');
  const userMsg = renderGeneratePrompt({ prompt, brand, target });
  let modelName = CONFIG.openrouter.defaultModel;
  let reply;
  try {
    reply = await callOpenRouter({ system: SYSTEM_PROMPT, user: userMsg, model: modelName });
  } catch (err) {
    if (CONFIG.openrouter.fallbackModel && CONFIG.openrouter.fallbackModel !== modelName) {
      modelName = CONFIG.openrouter.fallbackModel;
      reply = await callOpenRouter({ system: SYSTEM_PROMPT, user: userMsg, model: modelName });
    } else {
      throw err;
    }
  }
  let parsed;
  try {
    parsed = parsePageReply(reply.text);
  } catch (parseErr) {
    // Retry once with an explicit "must include html fence" reminder.
    if (tick) tick('retrying_parse');
    const retryMsg = `${userMsg}\n\nIMPORTANT: Your previous reply did not include a complete HTML document inside an \`\`\`html\`\`\` fence. You MUST respond with exactly: (1) one short summary sentence, (2) one fenced \`\`\`html code block containing a complete <!DOCTYPE html>.../html> document. Do not include any other code blocks.`;
    let retryReply;
    try {
      retryReply = await callOpenRouter({ system: SYSTEM_PROMPT, user: retryMsg, model: modelName });
    } catch (e) {
      throw parseErr; // original parse error is more informative
    }
    try {
      parsed = parsePageReply(retryReply.text);
    } catch (_e) {
      throw parseErr; // original parse error wins
    }
  }
  const { html, summary } = parsed;

  // 3) Persist + decrement quota
  const now = new Date().toISOString();
  const existing = page_id ? readPage(page_id) : null;
  const page = existing || {
    page_id: page_id || newPageId(),
    workspace_id,
    name: deriveName(prompt),
    mode: 'live',
    history: [],
    created_at: now,
  };
  page.html = html;
  page.summary = summary;
  page.model = modelName;
  page.target = target || page.target || null;
  page.brand = brand || page.brand || null;
  page.last_generation = { at: now, prompt, kind: kind || 'generate' };
  page.updated_at = now;
  page.history = page.history || [];
  page.history.push({ at: now, kind: kind || 'generate', prompt, summary, model: modelName });
  if (page.history.length > 50) page.history.splice(0, page.history.length - 50);
  writePage(page);

  await recordQuotaUsage(workspace_id, 'generate', 1);

  return {
    page_id: page.page_id,
    editor_url: editorUrlFor(page.page_id),
    preview_url: previewUrlFor(page.page_id),
    summary,
    model: modelName,
  };
}

async function iterateOnce({ page_id, instruction, tick }) {
  const page = readPage(page_id);
  if (!page) throw Object.assign(new Error(`Page ${page_id} not found`), { code: 'not_found' });

  if (tick) tick('iterating');
  const userMsg = `Current page HTML:\n\n${page.html}\n\nInstruction: ${String(instruction || '').trim()}\n\nReturn the full updated page.`;
  const reply = await callOpenRouter({
    system: EDIT_SYSTEM_PROMPT,
    user: userMsg,
    model: CONFIG.openrouter.defaultModel,
  });
  let parsed;
  try {
    parsed = parsePageReply(reply.text);
  } catch (parseErr) {
    if (tick) tick('retrying_parse');
    const retryMsg = `${userMsg}\n\nIMPORTANT: Your previous reply did not include a complete HTML document inside an \`\`\`html\`\`\` fence. You MUST respond with exactly: (1) one short summary sentence, (2) one fenced \`\`\`html code block containing a complete <!DOCTYPE html>.../html> document.`;
    const retry = await callOpenRouter({ system: EDIT_SYSTEM_PROMPT, user: retryMsg, model: CONFIG.openrouter.defaultModel });
    parsed = parsePageReply(retry.text);
  }
  const { html, summary } = parsed;

  const now = new Date().toISOString();
  page.html = html;
  page.summary = summary;
  page.updated_at = now;
  page.history = page.history || [];
  page.history.push({ at: now, kind: 'iterate', instruction, summary, model: CONFIG.openrouter.defaultModel });
  if (page.history.length > 50) page.history.splice(0, page.history.length - 50);
  writePage(page);

  return {
    page_id: page.page_id,
    editor_url: editorUrlFor(page.page_id),
    preview_url: previewUrlFor(page.page_id),
    summary,
  };
}

function previewUrlFor(page_id) {
  const base = CONFIG.publicUrl || `http://${CONFIG.host}:${CONFIG.port}`;
  return `${base.replace(/\/$/, '')}/v1/pages/${page_id}/preview`;
}

// ─── Job runner ──────────────────────────────────────────────────────────────
export function enqueueJob({ kind, page_id, payload, run }) {
  const job_id = newJobId();
  const now = new Date().toISOString();
  const job = {
    job_id,
    kind,
    page_id: page_id || null,
    status: 'queued',
    created_at: now,
    updated_at: now,
    payload,
    result: null,
    error: null,
  };
  writeJob(job);
  // Helper the run() callback can use to tick progress without holding the
  // job object in closure.
  const tick = (status) => {
    job.status = status;
    job.updated_at = new Date().toISOString();
    writeJob(job);
  };
  // Run async — return the job immediately so the caller can poll.
  setImmediate(async () => {
    try {
      const result = await run({ tick });
      job.status = 'succeeded';
      job.result = result;
    } catch (err) {
      job.status = 'failed';
      job.error = { code: err.code || 'job_failed', message: err.message || String(err) };
    } finally {
      job.updated_at = new Date().toISOString();
      writeJob(job);
    }
  });
  return job;
}

export async function generateAsync(args) {
  const job = enqueueJob({
    kind: 'generate',
    payload: { prompt: args.prompt, workspace_id: args.workspace_id, brand: args.brand, target: args.target },
    run: async ({ tick }) => {
      tick('checking_quota');
      const r = await generateOnce({ ...args, kind: 'generate', tick });
      return r;
    },
  });
  return job;
}

export async function iterateAsync(args) {
  const job = enqueueJob({
    kind: 'iterate',
    page_id: args.page_id,
    payload: { instruction: args.instruction, workspace_id: args.workspace_id },
    run: async ({ tick }) => {
      tick('iterating');
      const r = await iterateOnce({ ...args, tick });
      return r;
    },
  });
  return job;
}

export async function redoAsync(args) {
  const job = enqueueJob({
    kind: 'redo',
    page_id: args.page_id,
    payload: { prompt: args.lastPrompt, workspace_id: args.workspace_id, brand: args.brand, target: args.target },
    run: async ({ tick }) => {
      tick('checking_quota');
      const r = await generateOnce({
        prompt: args.lastPrompt,
        workspace_id: args.workspace_id,
        brand: args.brand,
        target: args.target,
        page_id: args.page_id,
        kind: 'redo',
        tick,
      });
      return r;
    },
  });
  return job;
}