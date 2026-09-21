import { defineConfig } from 'vite';

// Tauri 期望固定端口、不自动打开浏览器、不清屏。
export default defineConfig({
  root: '.',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false
  }
});
