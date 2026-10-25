import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    fileParallelism: false,
    isolate: false,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', '.next', '.turbo', 'dist', 'e2e'],
  },
});
