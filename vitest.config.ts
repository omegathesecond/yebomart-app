import { defineConfig } from 'vitest/config';
import path from 'path';

// Dedicated test config — intentionally does NOT load the app's Vite plugins
// (PWA, Tailwind) so the unit suite stays fast and has no service-worker/CSS
// machinery. Only the `@` alias is shared with the app.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
  },
});
