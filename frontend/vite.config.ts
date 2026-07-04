import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8888,
    fs: {
      allow: [
        // Allow importing the agentii-template.md from repo root
        resolve(__dirname, '../../templates'),
        // Default: project root
        resolve(__dirname),
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'lightweight-charts': ['lightweight-charts', 'fancy-canvas'],
          'react-plotly': ['plotly.js-dist-min', 'react-plotly.js'],
        },
      },
    },
  },
})
