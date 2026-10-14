import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts?(x)'],
    // Every test starts from fresh mocks: per-test return values and spies never leak into the next test.
    mockReset: true,
    restoreMocks: true,
  },
});
