import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

import { buildManifestPlugin } from './scripts/vite-manifest-plugin.mjs';

const root = resolve(__dirname);

function extensionMode(): 'chromium' | 'firefox' {
  return process.env.npm_lifecycle_event?.includes('firefox') ||
    process.env.MODE === 'firefox'
    ? 'firefox'
    : 'chromium';
}

export default defineConfig(({ mode }) => {
  const target = mode === 'firefox' ? 'firefox' : extensionMode();

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
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.ts'],
      globals: true
    }
  };
});
