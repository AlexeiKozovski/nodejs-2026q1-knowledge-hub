import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/**/*.e2e.spec.ts'],
    pool: 'forks',
    setupFiles: [path.join(__dirname, 'test', 'vitest.setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      src: path.join(__dirname, 'src'),
    },
  },
});
