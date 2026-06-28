/**
 * Quota — Family API Contract section 4 (Designs).
 *
 * Authoritative source: board-render's `/v1/quota/check` and `/v1/quota/use`.
 * Fallback: a small JSON ledger under `service/data/quota/ledger.json` so the
 * service can boot in isolation. Once board-render ships the canonical
 * endpoint the architect points `BOARD_RENDER_URL` at it and the fallback
 * goes away.
 */
import { join } from 'node:path';
import { CONFIG, readJSON, writeJSON, todayUtc } from './config.js';

const LEDGER_PATH = join(CONFIG.dataDir, 'quota', 'ledger.json');

function readLedger() { return readJSON(LEDGER_PATH, { workspaces: {} }); }
function writeLedger(l) { writeJSON(LEDGER_PATH, l); }

function rollBucket(w) {
  if (w.reset_at !== todayUtc()) { w.generations_today = 0; w.reset_at = todayUtc(); }
  return w;
}

function localCheck(workspace_id) {
  const l = readLedger();
  const w = rollBucket(l.workspaces[workspace_id] || { generations_today: 0, reset_at: todayUtc() });
  const limit = CONFIG.localDailyLimit;
  const remaining = Math.max(0, limit - w.generations_today);
  return { allowed: remaining > 0, remaining, limit, reset_at: `${w.reset_at}T00:00:00Z`, source: 'local' };
}

function localUse(workspace_id, n) {
  const l = readLedger();
  const w = rollBucket(l.workspaces[workspace_id] || { generations_today: 0, reset_at: todayUtc() });
  w.generations_today += n;
  w.last_at = new Date().toISOString();
  l.workspaces[workspace_id] = w;
  writeLedger(l);
  return { ok: true, source: 'local', remaining: Math.max(0, CONFIG.localDailyLimit - w.generations_today), limit: CONFIG.localDailyLimit, reset_at: `${w.reset_at}T00:00:00Z` };
}

export async function checkQuota(workspace_id, kind = 'generate') {
  if (CONFIG.bypassQuota) {
    return { allowed: true, remaining: -1, source: 'bypass' };
  }
  if (!CONFIG.boardRenderUrl) return localCheck(workspace_id);

  const url = `${CONFIG.boardRenderUrl.replace(/\/$/, '')}/v1/quota/check`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(CONFIG.boardRenderToken ? { authorization: `Bearer ${CONFIG.boardRenderToken}` } : {}),
      },
      body: JSON.stringify({ workspace_id, billable: kind }),
      signal: ctl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 402) return { allowed: false, source: 'board-render', ...(body?.data || {}) };
    if (!res.ok || !body?.ok) return { allowed: false, source: 'unavailable', http_status: res.status };
    return { allowed: true, source: 'board-render', ...(body?.data || {}) };
  } catch (e) {
    return { allowed: false, source: 'unavailable', error: e.message };
  } finally {
    clearTimeout(t);
  }
}

export async function recordQuotaUsage(workspace_id, kind = 'generate', n = 1) {
  if (CONFIG.bypassQuota) return { ok: true, source: 'bypass' };
  if (!CONFIG.boardRenderUrl) return localUse(workspace_id, n);

  const url = `${CONFIG.boardRenderUrl.replace(/\/$/, '')}/v1/quota/use`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(CONFIG.boardRenderToken ? { authorization: `Bearer ${CONFIG.boardRenderToken}` } : {}),
      },
      body: JSON.stringify({ workspace_id, billable: kind, n }),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (e) {
    return { ok: false, error: e.message };
  }
}