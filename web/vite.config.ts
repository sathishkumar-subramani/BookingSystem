import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // keep the animation player out of the first download
        manualChunks: (id) => (id.includes('lottie') ? 'lottie' : id.includes('node_modules/motion') || id.includes('framer-motion') ? 'motion' : undefined),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
