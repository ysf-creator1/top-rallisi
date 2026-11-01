/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages alt yolu: depo adı değişirse burası da değişmeli.
const BASE = '/top-rallisi/';

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { host: false },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Top Rallisi',
        short_name: 'Top Rallisi',
        description: 'Halatları çek, topu parkurda tut, bitiş deliğine ulaştır.',
        lang: 'tr',
        start_url: BASE,
        scope: BASE,
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#F6F1E8',
        theme_color: '#C7E2EE',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    execArgv: ['--no-experimental-webstorage'],
    include: ['tests/**/*.test.ts'],
  },
});
