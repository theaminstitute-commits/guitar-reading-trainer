/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'samples/**/*'],
      manifest: {
        name: 'Guitar Reading Trainer',
        short_name: 'ReadGuitar',
        description: 'Hear a melody on the fretboard, write it on the staff, learn from every mistake.',
        theme_color: '#1c1a17',
        background_color: '#1c1a17',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,mp3,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  base: './',
  build: { assetsInlineLimit: 4 * 1024 * 1024 },
  server: { port: 5181 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
