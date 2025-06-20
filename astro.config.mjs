// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor code for better caching
            vendor: ['@supabase/supabase-js'],
            // Split booking functionality
            booking: ['./src/scripts/booking.js'],
            // Split flower functionality
            flowers: ['./src/scripts/flowers.js'],
          }
        }
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable source maps for debugging
      sourcemap: false
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['@supabase/supabase-js']
    }
  },
  build: {
    inlineStylesheets: 'auto',
    assets: 'assets',
    format: 'directory'
  },
  compressHTML: true
});