/**
 * Projects + folders — lightweight client-side persistence (localStorage) so
 * work can be separated and saved without a backend. (The W5 store can swap in
 * later behind this same surface.)
 * MIT — RHOBEAR Designs (original)
 */
const KEY = 'rb-designs-projects-v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"projects":[]}'); }
  catch (_e) { return { projects: [] }; }
}
function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_e) { /* quota */ }
}
function uid() { return 'p' + Math.abs(hash(String(Object.keys(read()).length) + navigator.userAgent + read().projects.length)).toString(36) + read().projects.length; }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; }

export function listProjects() { return read().projects; }

export function saveProject({ name, html, mode, ts }) {
  const state = read();
  const id = uid();
  state.projects.unshift({ id, name: name || 'Untitled', html: html || '', mode: mode || 'live', ts: ts || 'now' });
  write(state);
  return id;
}

export function getProject(id) { return read().projects.find((p) => p.id === id) || null; }

export function deleteProject(id) {
  const state = read();
  state.projects = state.projects.filter((p) => p.id !== id);
  write(state);
}

export function renameProject(id, name) {
  const state = read();
  const p = state.projects.find((x) => x.id === id);
  if (p) { p.name = name; write(state); }
}
