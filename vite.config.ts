import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 用相对路径，静态托管到任意子路径（GitHub Pages 的 /仓库名/）都能直接跑
  base: './',
  server: { port: 5199 },
  preview: { port: 5199 },
  build: { chunkSizeWarningLimit: 1200 }
});
