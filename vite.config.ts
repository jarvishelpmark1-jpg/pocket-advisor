/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pocket-advisor/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Pocket Advisor',
        short_name: 'Pocket',
        description: 'Personal finance advisor and analyst',
        theme_color: '#0B0F1A',
        background_color: '#0B0F1A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/pocket-advisor/',
        start_url: '/pocket-advisor/',
        icons: [
          { src: '/pocket-advisor/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pocket-advisor/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pocket-advisor/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/pocket-advisor/index.html',
      },
    }),
  ],
})
