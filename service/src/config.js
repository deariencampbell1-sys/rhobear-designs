/**
 * RHOBEAR Designs — agent-control API service.
 *
 * Implements the Designs section of the Family API Contract:
 *   POST /v1/pages/generate        — billable; quota-checked; opens page in editor
 *   POST /v1/pages/{id}/iterate    — edit existing page (not a generation)
 *   POST /v1/pages/{id}/redo       — full re-generation (counts as new)
 *   GET  /v1/pages/{id}            — fetch page state
 *   POST /v1/pages/{id}/export     — embeddable HTML
 *   POST /v1/pages/{id}/deploy     — deploy to GitHub Pages (via github-operator)
 *   GET  /v1/pages/{id}/editor_url — URL the browser hits to open the page in the editor
 *
 * Long generations return `{ ok:true, data:{ job_id, status } }` immediately and
 * the caller polls `GET /v1/jobs/{job_id}` for completion.
 *
 * Auth: `Authorization: Bearer $RHOBEAR_SERVICE_TOKEN` on every call.
 *
 * Quota: a billable call (generate / redo) hits board-render's entitlement
 * endpoint before the model call. If board-render is unreachable the service
 * refuses with `error.code="quota_unavailable"` so the caller can choose to
 * retry later or fall back.
 *
 * Persistence: simple JSON files under `service/data/pages/<id>.json`. Good
 * enough for an editor-page (one HTML blob + metadata).
 *
 * MIT — RHOBEAR Designs (original)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Config (env-driven, never read secrets from disk) ────────────────────────
export const CONFIG = {
  port: parseInt(process.env.PORT || '8765', 10),
  host: process.env.HOST || '127.0.0.1',
  serviceToken: process.env.RHOBEAR_SERVICE_TOKEN || '',
  dev: process.env.RHOBEAR_DESIGNS_DEV === '1',
  bypassQuota: process.env.RHOBEAR_DESIGNS_BYPASS_QUOTA === '1',

  // OpenRouter — house model for design quality. Expert tier by default.
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultModel: process.env.RHOBEAR_DESIGNS_MODEL || 'minimax/minimax-m3',
    fallbackModel: process.env.RHOBEAR_DESIGNS_FALLBACK_MODEL || 'minimax/minimax-m2.7',
    maxTokens: parseInt(process.env.RHOBEAR_DESIGNS_MAX_TOKENS || '12000', 10),
    timeoutMs: parseInt(process.env.RHOBEAR_DESIGNS_TIMEOUT_MS || '90000', 10),
  },

  // Editor base URL — where the generated page is opened for hand-editing.
  editorBaseUrl: process.env.RHOBEAR_DESIGNS_EDITOR_URL || 'http://127.0.0.1:5180',

  // board-render entitlement endpoint (Family API Contract section 4).
  boardRenderUrl: process.env.BOARD_RENDER_URL || '',
  boardRenderToken: process.env.BOARD_RENDER_SERVICE_TOKEN || process.env.RHOBEAR_SERVICE_TOKEN || '',

  // github-operator / storage-router — used by /deploy.
  githubOperatorUrl: process.env.GITHUB_OPERATOR_URL || '',
  storageRouterUrl: process.env.STORAGE_ROUTER_URL || '',

  dataDir: process.env.RHOBEAR_DESIGNS_DATA_DIR || join(ROOT, 'data'),
  publicUrl: process.env.RHOBEAR_DESIGNS_PUBLIC_URL || '',

  // Job queue tuning
  maxConcurrentJobs: parseInt(process.env.RHOBEAR_DESIGNS_MAX_CONCURRENCY || '2', 10),
  localDailyLimit: parseInt(process.env.RHOBEAR_DESIGNS_LOCAL_DAILY_LIMIT || '20', 10),
};

export function ensureDirs() {
  mkdirSync(CONFIG.dataDir, { recursive: true });
  mkdirSync(join(CONFIG.dataDir, 'pages'), { recursive: true });
  mkdirSync(join(CONFIG.dataDir, 'jobs'), { recursive: true });
  mkdirSync(join(CONFIG.dataDir, 'quota'), { recursive: true });
}

export function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return fallback; }
}

export function writeJSON(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2));
}

export function listJSON(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const v = readJSON(join(dir, f), null);
    if (v) out.push(v);
  }
  return out;
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function newPageId() {
  return 'pg_' + randomUUID().replace(/-/g, '').slice(0, 16);
}

export function newJobId() {
  return 'j_' + randomUUID().replace(/-/g, '').slice(0, 16);
}

export function editorUrlFor(page_id) {
  const base = CONFIG.editorBaseUrl.replace(/\/$/, '');
  return `${base}/?designs_page_id=${encodeURIComponent(page_id)}`;
}