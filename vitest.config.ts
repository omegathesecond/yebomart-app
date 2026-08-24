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
  // tsconfig.app.json excludes *.test.tsx (so the production `tsc -b` build
  // doesn't type-check test files / need jest-dom's ambient types), which
  // means Vite's tsconfig-based JSX-mode auto-detection no longer covers
  // those files. Set the mode explicitly so component tests don't fall back
  // to the classic transform (which needs `React` in scope) instead.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
