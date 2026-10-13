import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserTests = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/lib/press', replacement: path.join(browserTests, 'mocks/press.ts') },
      { find: '@/hooks/use-toast', replacement: path.join(browserTests, 'mocks/toast.ts') },
      { find: '@', replacement: path.join(root, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    entries: [path.join(browserTests, 'fixture.html')],
  },
  server: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
  },
});
