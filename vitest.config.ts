import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'tests/**/*.test.ts'
    ],
    globals: true
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './apps/web/src'),
      'next/cache': path.resolve(__dirname, './tests/mocks/next-cache.ts')
    }
  }
});