import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'commander',
        'node:crypto',
        'node:fs',
        'node:fs/promises',
        'node:path',
      ],
      output: [
        {
          format: 'es',
          entryFileNames: '[name].mjs',
          dir: 'dist',
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          dir: 'dist',
        },
      ],
    },
    target: 'node18',
    minify: false,
    sourcemap: true,
  },
  esbuild: {
    platform: 'node',
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'coverage/**',
        'examples/**',
        'dist/**',
        '*.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
