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
      include: [
        'src/common/guards/jwt-auth.guard.ts',
        'src/common/guards/roles.guard.ts',
        'src/common/interceptors/**/*.ts',
        'src/article/dto/create-article.dto.ts',
        'src/auth/dto/login.dto.ts',
        'src/auth/dto/signup.dto.ts',
        'src/user/dto/create-user.dto.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      src: path.join(__dirname, 'src'),
    },
  },
});
