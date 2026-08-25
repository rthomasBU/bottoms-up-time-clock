import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'Bottoms Up Time Clock',
        short_name: 'Time Clock',
        description: 'Employee time clock and PTO tracking for Bottoms Up.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#000000',
        background_color: '#F5F4F2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. Anything hitting Supabase (auth,
        // clock in/out, timesheets, PTO) must always go to the network -
        // this app has no offline write queue, so a stale cached response
        // would be actively misleading (e.g. showing "clocked out" when the
        // employee is actually clocked in). Clock actions fail with a clear
        // "you're offline" message instead (see useClockStatus/useAuth).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
        // 'push'/'notificationclick' listeners for the overtime alert
        // (public/push-sw.js), spliced into the generated service worker
        // via importScripts - kept as a separate plain file instead of
        // switching this whole PWA to the injectManifest strategy, so
        // precaching/the Supabase NetworkOnly rule above are untouched.
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
})
