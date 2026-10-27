import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['demos/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
  },
});
