import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5180,
    open: true,
    // Allow serving the repo-root samples/ (one level above this editor app)
    // so the templates gallery can bundle template HTML via import.meta.glob.
    fs: { allow: ['..'] },
    // Proxy the Designs API so the editor can call it from the browser
    // (no CORS dance needed). The default points at the canonical local
    // dev service on port 8765; override with RHOBEAR_DESIGNS_API_TARGET.
    proxy: {
      '/v1': {
        target: process.env.RHOBEAR_DESIGNS_API_TARGET || 'http://127.0.0.1:8765',
        changeOrigin: true,
        // Don't rewrite — the service already lives at /v1/*.
      },
      // User-configured MiniMax calls need a same-origin development seam.
      // The browser's Authorization header is forwarded only by the local
      // Vite dev server; production builds contain no proxy.
      '/mm': {
        target: 'https://api.minimax.io',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/mm/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/v1': {
        target: process.env.RHOBEAR_DESIGNS_API_TARGET || 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Device-explicit shells — one engine, three purpose-built surfaces.
      input: {
        main: 'index.html',
        mobile: 'm.html',
        tablet: 't.html',
      },
    },
    commonjsOptions: {
      // Vite's default is just /node_modules/ — keep CJS interop for
      // file-saver and jszip.
      include: [/node_modules/],
    },
  },
});