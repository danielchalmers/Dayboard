import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

import { buildManifestPlugin } from './scripts/vite-manifest-plugin';

const root = resolve(__dirname);

export default defineConfig(({ mode }) => {
  const target = mode === 'chromium' ? mode : 'chromium';

  return {
    root,
    base: './',
    plugins: [svelte(), buildManifestPlugin(target) as Plugin],
    build: {
      emptyOutDir: true,
      outDir: `dist/${target}`,
      sourcemap: true,
      rollupOptions: {
        input: {
          newtab: resolve(root, 'newtab.html'),
          popup: resolve(root, 'popup.html'),
          options: resolve(root, 'options.html')
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    },
    test: {
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
      globals: true
    }
  };
});
