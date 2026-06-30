/**
 * RHOBEAR Designs — agent-control API. Boots HTTP on $HOST:$PORT (default
 * 127.0.0.1:8765). See README.md for the contract surface and config.
 *
 * MIT — RHOBEAR Designs (original)
 */
import http from 'node:http';
import { CONFIG, ensureDirs } from './config.js';
import { checkAuth, matchRoute, ok, fail } from './http.js';

ensureDirs();

const server = http.createServer(async (req, res) => {
  const ts0 = Date.now();
  // Strip query for routing.
  const fullUrl = req.url || '/';
  const pathOnly = fullUrl.split('?')[0];

  // CORS preflight — short-circuit without auth.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-max-age': '600',
    });
    res.end();
    return;
  }

  // Public routes (no auth) — health, root index, preview GET is intentional
  // (it's the user-facing URL the browser hits to see the page).
  const isPublic = (req.method === 'GET' && (
    pathOnly === '/health' ||
    pathOnly === '/' ||
    pathOnly === '/v1'
  ));
  // Public read endpoints (the editor + embedding use them from the browser):
  //   GET /v1/pages/:id              — fetch a page (editor auto-load)
  //   GET /v1/pages/:id/preview      — render the embeddable HTML
  //   GET /v1/pages/:id/editor_url   — fetch the editor URL (cheap, no secret)
  const isPublicPageRead = req.method === 'GET' && (
    /^\/v1\/pages\/[^/]+$/.test(pathOnly) ||
    /^\/v1\/pages\/[^/]+\/preview$/.test(pathOnly) ||
    /^\/v1\/pages\/[^/]+\/editor_url$/.test(pathOnly)
  );
  if (!isPublic && !isPublicPageRead) {
    const auth = checkAuth(req);
    if (!auth.ok) {
      if (auth.reason === 'unconfigured') {
        return fail(res, 503, 'unconfigured',
          'RHOBEAR_SERVICE_TOKEN is not set on the server — the agent API is fail-closed and refuses all calls until a token is configured.');
      }
      return fail(res, 401, 'unauthorized',
        'Missing or invalid `Authorization: Bearer $RHOBEAR_SERVICE_TOKEN`');
    }
  }

  const m = matchRoute(req.method, pathOnly);
  if (!m) return fail(res, 404, 'not_found', `No route for ${req.method} ${pathOnly}`);

  try {
    await m.route.handler(req, res, {
      params: m.params,
      query: new URL(fullUrl, 'http://x').searchParams,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[handler error]', req.method, pathOnly, e);
    const status = e.code === 'not_found' ? 404
      : e.code === 'over_quota' ? 402
      : e.code === 'quota_unavailable' ? 503
      : e.code === 'payload_too_large' ? 413
      : e.code === 'bad_json' ? 400
      : 500;
    if (!res.headersSent) fail(res, status, e.code || 'internal_error', e.message || 'internal error');
  } finally {
    const ms = Date.now() - ts0;
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathOnly} → ${res.statusCode} ${ms}ms`);
  }
});

// Make 502/504 graceful: surface real underlying errors.
server.on('clientError', (err, socket) => {
  try {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  } catch { /* */ }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  // eslint-disable-next-line no-console
  console.log(`[designs-api] listening on http://${CONFIG.host}:${CONFIG.port}`);
  // eslint-disable-next-line no-console
  console.log(`[designs-api] model=${CONFIG.openrouter.defaultModel} fallback=${CONFIG.openrouter.fallbackModel} or_key=${CONFIG.openrouter.apiKey ? 'yes' : 'NO'} editor=${CONFIG.editorBaseUrl}`);
  // eslint-disable-next-line no-console
  console.log(`[designs-api] board-render=${CONFIG.boardRenderUrl || '(none — local ledger)'} bypass_quota=${CONFIG.bypassQuota} dev=${CONFIG.dev}`);
});

// Graceful shutdown — used by tests + ops.
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[designs-api] ${signal} received, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { server };