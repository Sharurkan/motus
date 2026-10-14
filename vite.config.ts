import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site under /<repository-name>/.
const PAGES_BASE = '/motus/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  build: {
    target: 'es2020',
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
}));
