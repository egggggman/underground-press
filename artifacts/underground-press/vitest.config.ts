import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '@assets': path.join(root, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    clearMocks: true,
    restoreMocks: true,
    include: ['src/**/*.test.tsx'],
  },
});
