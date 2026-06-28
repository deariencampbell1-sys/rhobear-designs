/**
 * Page + job storage — simple JSON files keyed by id. Swap for S3/Postgres
 * later; the surface (`readPage`, `writePage`, `readJob`, `writeJob`) is what
 * the rest of the service depends on.
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG, readJSON, writeJSON, listJSON } from './config.js';

function pagesDir() { return join(CONFIG.dataDir, 'pages'); }
function jobsDir() { return join(CONFIG.dataDir, 'jobs'); }

export function pagePath(id) { return join(pagesDir(), `${id}.json`); }
export function jobPath(id) { return join(jobsDir(), `${id}.json`); }

export function readPage(id) {
  const p = pagePath(id);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return null; }
}

export function writePage(page) {
  writeJSON(pagePath(page.page_id), page);
}

export function deletePage(id) {
  try {
    const p = pagePath(id);
    if (existsSync(p)) unlinkSync(p);
  } catch { /* */ }
}

export function listPages(workspace_id) {
  const all = listJSON(pagesDir());
  const filtered = workspace_id
    ? all.filter((p) => p.workspace_id === workspace_id)
    : all;
  return filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export function readJob(id) {
  return readJSON(jobPath(id), null);
}
export function writeJob(job) { writeJSON(jobPath(job.job_id), job); }
export function listJobs() { return listJSON(jobsDir()); }