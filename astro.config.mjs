// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server',
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
  compressHTML: true,
  adapter: netlify()
});