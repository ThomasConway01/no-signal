/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Vite build plus the service worker that precaches the shell.
 */

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Vite's config runs in Node, so the base comes from VITE_BASE here. The app and
// the service worker then read the same value back as import.meta.env.BASE_URL.
const rawBase = process.env.VITE_BASE || '/';
const APP_BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig({
  base: APP_BASE,
  build: {
    // WebLLM's runtime is one chunk on purpose. It is precached, not fetched per visit.
    chunkSizeWarningLimit: 7000,
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      // Icons and the favicon are already picked up by the precache glob.
      includeManifestIcons: false,
      manifest: {
        name: 'NO SIGNAL',
        short_name: 'NO SIGNAL',
        description: 'A bunker assistant that sulks online and works in airplane mode.',
        start_url: APP_BASE,
        scope: APP_BASE,
        display: 'standalone',
        background_color: '#140c06',
        theme_color: '#140c06',
        icons: [
          {
            src: `${APP_BASE}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${APP_BASE}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${APP_BASE}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        // The WebLLM glue chunk is several megabytes and must be precached
        // so the engine can still be imported with the radio off.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    }),
  ],
});
