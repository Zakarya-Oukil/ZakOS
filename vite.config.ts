import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Heavy libraries the lazy pages need are bundled at startup, so the first visit to Brain or Files does not stall on a re-optimise.
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js', '@phosphor-icons/react', 'motion/react', 'gsap', '@monaco-editor/react', '@xterm/xterm', '@xterm/addon-fit', 'marked'],
  },
  server: {
    warmup: { clientFiles: ['./src/main.tsx', './src/os/Shell.tsx', './src/os/modules/*/*.tsx', './src/os/modules/*.tsx'] },
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:4000',
        ws: true,
      },
    },
  },
});
