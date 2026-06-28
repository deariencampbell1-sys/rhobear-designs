/**
 * HTTP helpers + route handlers for the Designs API.
 */
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { CONFIG } from './config.js';
import { readPage, writePage, readJob, listPages } from './store.js';
import { checkQuota } from './quota.js';
import { generateAsync, iterateAsync, redoAsync } from './pipelines.js';
import { editorUrlFor } from './config.js';

const MAX_BODY = 1_000_000; // 1 MB

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX_BODY) {
        reject(Object.assign(new Error('body too large'), { code: 'payload_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(Object.assign(new Error('invalid JSON body'), { code: 'bad_json' })); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    ...extraHeaders,
  });
  res.end(json);
}

export function ok(res, data, status = 200, extraHeaders = {}) {
  sendJson(res, status, { ok: true, data }, extraHeaders);
}
export function fail(res, status, code, message, extra = {}) {
  sendJson(res, status, { ok: false, error: { code, message, ...extra } });
}

function constantTimeEquals(a, b) {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}

export function checkAuth(req) {
  if (CONFIG.dev) return { ok: true, dev: true };
  if (!CONFIG.serviceToken) return { ok: true, open: true }; // open if no token configured
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return { ok: false, reason: 'missing' };
  return constantTimeEquals(m[1].trim(), CONFIG.serviceToken)
    ? { ok: true }
    : { ok: false, reason: 'mismatch' };
}

// ─── Route table ─────────────────────────────────────────────────────────────
export const ROUTES = [
  { method: 'GET',  path: '/health',                    handler: handleHealth },
  { method: 'GET',  path: '/v1',                        handler: handleIndex },
  { method: 'GET',  path: '/v1/quota',                  handler: handleQuota },
  { method: 'POST', path: '/v1/quota/check',            handler: handleQuotaCheck },

  { method: 'POST', path: '/v1/pages/generate',         handler: handleGenerate },
  { method: 'GET',  path: '/v1/pages',                  handler: handleListPages },
  { method: 'GET',  path: '/v1/pages/:id',              handler: handleGetPage },
  { method: 'POST', path: '/v1/pages/:id/iterate',      handler: handleIterate },
  { method: 'POST', path: '/v1/pages/:id/redo',         handler: handleRedo },
  { method: 'POST', path: '/v1/pages/:id/export',       handler: handleExport },
  { method: 'POST', path: '/v1/pages/:id/deploy',       handler: handleDeploy },
  { method: 'GET',  path: '/v1/pages/:id/editor_url',   handler: handleEditorUrl },
  { method: 'GET',  path: '/v1/pages/:id/preview',      handler: handlePreview },

  { method: 'GET',  path: '/v1/jobs/:id',               handler: handleGetJob },
];

// ─── Handlers ────────────────────────────────────────────────────────────────
async function handleHealth(_req, res) {
  return ok(res, {
    status: 'ok',
    service: 'rhobear-designs-api',
    version: '0.1.0',
    time: new Date().toISOString(),
    config: {
      model: CONFIG.openrouter.defaultModel,
      fallback: CONFIG.openrouter.fallbackModel,
      has_openrouter_key: Boolean(CONFIG.openrouter.apiKey),
      has_board_render: Boolean(CONFIG.boardRenderUrl),
      bypass_quota: CONFIG.bypassQuota,
      dev_mode: CONFIG.dev,
      editor_url: CONFIG.editorBaseUrl,
    },
  });
}

async function handleIndex(_req, res) {
  return ok(res, {
    service: 'rhobear-designs-api',
    contract: 'family-api/designs/v0',
    endpoints: ROUTES.map((r) => ({ method: r.method, path: r.path })),
  });
}

async function handleQuota(req, res) {
  const url = new URL(req.url, 'http://x');
  const workspace_id = url.searchParams.get('workspace_id');
  if (!workspace_id) return fail(res, 400, 'bad_request', 'workspace_id query param required');
  const q = await checkQuota(workspace_id, 'generate');
  return ok(res, { workspace_id, ...q });
}

async function handleQuotaCheck(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.code || 'bad_request', e.message); }
  const { workspace_id, billable } = body || {};
  if (!workspace_id) return fail(res, 400, 'bad_request', '`workspace_id` is required');
  const q = await checkQuota(workspace_id, billable || 'generate');
  return ok(res, { workspace_id, billable: billable || 'generate', ...q });
}

async function handleGenerate(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.code || 'bad_request', e.message); }
  const { prompt, workspace_id, brand, target } = body || {};
  if (!prompt || typeof prompt !== 'string') return fail(res, 400, 'bad_request', '`prompt` (string) is required');
  if (!workspace_id || typeof workspace_id !== 'string') return fail(res, 400, 'bad_request', '`workspace_id` (string) is required');

  const job = await generateAsync({ prompt, workspace_id, brand, target });
  return ok(res, {
    job_id: job.job_id,
    status: job.status,
    poll_url: `/v1/jobs/${job.job_id}`,
  }, 202);
}

async function handleIterate(req, res, ctx) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.code || 'bad_request', e.message); }
  const { instruction } = body || {};
  if (!instruction || typeof instruction !== 'string') return fail(res, 400, 'bad_request', '`instruction` (string) is required');
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);

  const job = await iterateAsync({ page_id: page.page_id, instruction, workspace_id: page.workspace_id });
  return ok(res, {
    job_id: job.job_id,
    page_id: page.page_id,
    status: job.status,
    poll_url: `/v1/jobs/${job.job_id}`,
  }, 202);
}

async function handleRedo(req, res, ctx) {
  let body = {};
  try { body = await readJsonBody(req); } catch (_e) { /* tolerate empty */ }
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  const lastGen = page.last_generation;
  if (!lastGen || !lastGen.prompt) return fail(res, 409, 'cannot_redo', 'No prior generation on this page');

  const job = await redoAsync({
    page_id: page.page_id,
    workspace_id: page.workspace_id,
    lastPrompt: lastGen.prompt,
    brand: body.brand || page.brand,
    target: body.target || page.target,
  });
  return ok(res, {
    job_id: job.job_id,
    page_id: page.page_id,
    status: job.status,
    poll_url: `/v1/jobs/${job.job_id}`,
  }, 202);
}

async function handleGetPage(req, res, ctx) {
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.get('history') !== '1') {
    const { history, ...rest } = page;
    return ok(res, rest);
  }
  return ok(res, page);
}

async function handleListPages(req, res) {
  const url = new URL(req.url, 'http://x');
  const workspace_id = url.searchParams.get('workspace_id') || '';
  const pages = listPages(workspace_id).map(({ html, history, ...meta }) => meta);
  return ok(res, { pages, count: pages.length });
}

async function handleExport(req, res, ctx) {
  let body = {};
  try { body = await readJsonBody(req); } catch (_e) { /* tolerate empty */ }
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  return ok(res, {
    page_id: page.page_id,
    name: page.name,
    format: body.format || 'html',
    html: page.html,
    bytes: Buffer.byteLength(page.html || '', 'utf-8'),
  });
}

async function handleEditorUrl(req, res, ctx) {
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  return ok(res, {
    page_id: page.page_id,
    editor_url: editorUrlFor(page.page_id),
  });
}

async function handlePreview(req, res, ctx) {
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(page.html || '<!DOCTYPE html><html><body><p>Empty page.</p></body></html>');
}

async function handleDeploy(req, res, ctx) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.code || 'bad_request', e.message); }
  const page = readPage(ctx.params.id);
  if (!page) return fail(res, 404, 'not_found', `Page ${ctx.params.id} not found`);
  const { repo, branch, commit_message, target_path } = body || {};
  if (!repo || typeof repo !== 'string') return fail(res, 400, 'bad_request', '`repo` (string, e.g. "owner/name") is required');
  if (!branch || typeof branch !== 'string') return fail(res, 400, 'bad_request', '`branch` (string) is required');

  const op = CONFIG.githubOperatorUrl;
  const sr = CONFIG.storageRouterUrl;
  const file = {
    repo,
    branch,
    path: target_path || 'index.html',
    content: page.html,
    message: commit_message || `designs: deploy ${page.page_id}`,
  };
  let lastErr = null;
  for (const [name, url] of [['github-operator', op], ['storage-router', sr]]) {
    if (!url) continue;
    const target = `${url.replace(/\/$/, '')}/v1/github/contents`;
    try {
      const r = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(CONFIG.serviceToken ? { authorization: `Bearer ${CONFIG.serviceToken}` } : {}),
        },
        body: JSON.stringify(file),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok) {
        return ok(res, { provider: name, page_id: page.page_id, ...j.data });
      }
      lastErr = { name, status: r.status, body: j };
    } catch (e) {
      lastErr = { name, error: e.message };
    }
  }
  if (lastErr) {
    return fail(res, 502, 'deploy_failed',
      'Both github-operator and storage-router are unavailable. Configure one and retry.',
      lastErr);
  }
  return fail(res, 503, 'deploy_not_configured',
    'No github-operator or storage-router configured. Set GITHUB_OPERATOR_URL or STORAGE_ROUTER_URL.');
}

async function handleGetJob(req, res, ctx) {
  const job = readJob(ctx.params.id);
  if (!job) return fail(res, 404, 'not_found', `Job ${ctx.params.id} not found`);
  const out = { ...job };
  if (job.status === 'succeeded' && job.result?.page_id) {
    out.result = { ...job.result, editor_url: editorUrlFor(job.result.page_id) };
  }
  return ok(res, out);
}

// ─── Router ──────────────────────────────────────────────────────────────────
export function matchRoute(method, urlPath) {
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const re = new RegExp('^' + r.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => `(?<${k}>[^/]+)`) + '$');
    const m = re.exec(urlPath);
    if (m) return { route: r, params: m.groups || {} };
  }
  return null;
}