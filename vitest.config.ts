import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts', 'src/storage/**/*.ts']
    }
  }
});
