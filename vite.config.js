import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // For main GitHub Pages site (username.github.io)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 3000,
    open: true
  }
})
