import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  base: '/forgotten-wilds/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // `firebase emulators:export` (see /run_local's stop step) writes to a `firebase-export-*`
      // temp dir at the project root, then renames it to `emulator-data/`. Vite's watcher picking
      // up that brand-new directory mid-write held a file handle on Windows long enough that the
      // rename failed with EPERM (reproduced live - the export only succeeded once Vite was
      // stopped first). Ignoring both paths outright means the export no longer has to race Vite's
      // watcher at all.
      ignored: ['**/emulator-data/**', '**/firebase-export-*/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser is large and changes far less often than app code - splitting it into its own
        // chunk means a normal app-code deploy doesn't invalidate players' cached copy of it.
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
})
