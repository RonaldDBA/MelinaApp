import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** CSP only in the built version (dev mode uses Vite's inline scripts). */
const csp = (): Plugin => ({
  name: 'melina-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

/** Each build changes the script and stylesheet URL (?v=…): a new version never gets stuck in the cache. */
const buildStamp = (): Plugin => ({
  name: 'melina-build-stamp',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml(html) {
    const v = Date.now().toString(36);
    return html.replace(/(src|href)="(\/assets\/[^"?]+\.(?:js|css))"/g, `$1="$2?v=${v}"`);
  },
});

export default defineConfig({
  plugins: [react(), csp(), buildStamp()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    // fixed names: each update replaces the same files instead of piling up old versions
    rollupOptions: {
      output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
