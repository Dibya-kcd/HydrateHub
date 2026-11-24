import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

import type { Plugin } from 'vite';

function disableHmrClientWsPlugin(): Plugin {
  let disableWsAndHmr = process.env.DISABLE_HMR === 'true';
  return {
    name: 'disable-hmr-client-ws',
    apply: 'serve',
    configResolved(config) {
      disableWsAndHmr =
        config.server.hmr === false ||
        config.server.ws === false ||
        process.env.DISABLE_HMR === 'true';
    },
    transform(code, id) {
      if (!disableWsAndHmr) return null;
      const cleanId = id.split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith('/vite/dist/client/client.mjs')) return null;
      const next = code.replace(
        /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
        'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });',
      );
      return { code: next, map: null };
    },
  };
}

export default defineConfig(() => {
  // GitHub Pages serves the site from /<repo-name>/ : the workflow sets VITE_BASE_PATH=/MrWaterBeverages/.
  // Everywhere else (server.ts, Android, iOS) the app lives at the root.
  const rawBase = process.env.VITE_BASE_PATH || '/';
  const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      disableHmrClientWsPlugin(),
      VitePWA({
        registerType: 'prompt', // never reload the page on its own; the user taps "Update" when ready
        injectRegister: null,
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2 MB
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**', '**/aistudio/**'],
          navigateFallbackDenylist: [/^\/api\//],
        },
        manifest: {
          id: base,
          name: 'Hydrate Hub',
          short_name: 'Hydrate Hub',
          description: 'Beverage distribution ledger with offline stock management, schemes, vehicle trip reconciliation, and audits.',
          theme_color: '#0A1F44',
          background_color: '#F3F5FF',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    build: {
      rollupOptions: {
        output: {
          // Libraries that rarely change get their own files, so a normal deploy only makes phones download the
          // app code again, not React / Supabase / icons. (jsPDF and xlsx stay out of this list on purpose:
          // they are loaded on demand and must not be pulled into the startup files.)
          manualChunks(id: string) {
            const normId = id.replace(/\\/g, '/');
            if (normId.includes('node_modules')) {
              if (/node_modules\/(react|react-dom|scheduler)\//.test(normId)) return 'vendor-react';
              if (normId.includes('node_modules/@supabase/')) return 'vendor-supabase';
              if (normId.includes('node_modules/lucide-react/')) return 'vendor-icons';
              return undefined;
            }
            if (normId.includes('/src/lib/') || normId.includes('/src/utils/storage/')) return 'app-sync';
            if (normId.includes('/src/i18n/') || normId.includes('/src/utils/odia')) return 'app-i18n';
            if (normId.includes('/src/tax/') || normId.includes('/src/context/ledger')) return 'app-ledger-core';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      ...(process.env.DISABLE_HMR === 'true' ? { ws: false as const } : {}),
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
