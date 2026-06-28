import { defineConfig } from 'vite';
import { transformSync as esbuildTransform } from 'esbuild';

// The vendored GrapesJS plugins ship CJS UMD bundles
// (grapesjs-cli output: dist/index.js). They must be served as ESM to
// the browser because our app imports them as ESM modules. We solve
// this in two places:
//
//   1. For the **production build** (rollup), Vite's
//      `@rollup/plugin-commonjs` is wired up. We add our vendor dir
//      to `commonjsOptions.include` (keeping the default /node_modules/
//      entry so file-saver + jszip still get CJS interop).
//
//   2. For the **dev server**, Vite's middleware serves files
//      straight from disk. Direct path imports like
//      `/src/vendor/grapesjs/<pkg>/dist/index.js` bypass node_modules
//      resolution and the dev prebundle, so we register a tiny inline
//      plugin that runs esbuild's CJS->ESM transform on the vendored
//      files before Vite serves them. The vendored source files are
//      NEVER modified on disk — they remain verbatim upstream copies.

const vendorCommonjsInclude = /src[\\/]vendor[\\/]grapesjs[\\/]/;
const vendoredCjsFile = /src[\\/]vendor[\\/]grapesjs[\\/][^\\/]+[\\/]dist[\\/]index\.js$/;

const vendorCjsToEsmPlugin = {
  name: 'rhobear-vendor-grapesjs-cjs-to-esm',
  enforce: 'pre',
  transform(code, id) {
    // Strip query string (?import, ?t=...) and any HMR timestamp suffix
    // before matching, so a cache-busted URL still hits our transform.
    const filePath = id.split('?')[0];
    if (!vendoredCjsFile.test(filePath)) return null;
    const result = esbuildTransform(code, {
      loader: 'js',
      format: 'esm',
      target: 'es2020',
      sourcemap: true,
    });
    return {
      code: result.code,
      map: result.map,
    };
  },
};

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
  plugins: [vendorCjsToEsmPlugin],
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      // Vite's default is just /node_modules/ — we must keep that to
      // preserve CJS interop for file-saver and jszip, and add our
      // vendored CJS plugin dist files.
      include: [/node_modules/, vendorCommonjsInclude],
    },
  },
  optimizeDeps: {
    // Pre-bundle the vendored files via esbuild in dev mode. esbuild
    // converts the CJS UMD wrapper into proper ESM with a default
    // export. Without this, Vite's prebundle optimizer treats the
    // vendored files as opaque ESM and breaks the `import default`
    // interop used in grapes-init.js.
    include: [
      './src/vendor/grapesjs/grapesjs/dist/grapes.mjs',
      './src/vendor/grapesjs/grapesjs-preset-webpage/dist/index.js',
      './src/vendor/grapesjs/grapesjs-blocks-basic/dist/index.js',
      './src/vendor/grapesjs/grapesjs-plugin-forms/dist/index.js',
      './src/vendor/grapesjs/grapesjs-custom-code/dist/index.js',
    ],
  },
});