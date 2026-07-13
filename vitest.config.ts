import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/test/**',
        'src/updateDB/**',
        'src/scripts/**',
        'src/app.ts',
        'src/jobs/**',
        'src/services/syncExternalProducts.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 75,
      },
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
});
