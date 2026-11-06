import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5188,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
