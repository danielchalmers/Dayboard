import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

import { createManifest } from './extension-manifest';

export function buildManifestPlugin(target: string): Plugin {
  return {
    name: 'clockboard-extension-manifest',
    async writeBundle(options) {
      const outDir = options.dir ?? `dist/${target}`;
      await mkdir(outDir, { recursive: true });
      await cp(resolve('src/extension/icons'), resolve(outDir, 'icons'), {
        recursive: true
      });
      await cp(resolve('src/extension/_locales'), resolve(outDir, '_locales'), {
        recursive: true
      });
      await writeFile(
        resolve(outDir, 'manifest.json'),
        `${JSON.stringify(createManifest(), null, 2)}\n`
      );
    }
  };
}
