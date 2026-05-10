import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import archiver from 'archiver';
import packageJson from '../package.json' with { type: 'json' };

const targets = process.argv[2] ? [process.argv[2]] : ['chromium'];
const artifactsDir = resolve('artifacts');
const summaries = [];

async function zipDirectory(sourceDir, outputFile) {
  await mkdir(artifactsDir, { recursive: true });

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolvePromise);
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function checksum(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const input = createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolvePromise);
  });
  return hash.digest('hex');
}

for (const target of targets) {
  if (target !== 'chromium') {
    throw new Error(`Unsupported package target: ${target}`);
  }

  const sourceDir = resolve('dist', target);
  const manifestPath = join(sourceDir, 'manifest.json');
  await stat(manifestPath);

  const zipName = `clockboard-${target}-v${packageJson.version}.zip`;
  const zipPath = join(artifactsDir, zipName);
  await zipDirectory(sourceDir, zipPath);

  const digest = await checksum(zipPath);
  const summary = `${digest}  ${basename(zipPath)}`;
  summaries.push(summary);
  await writeFile(`${zipPath}.sha256`, `${summary}\n`);
}

if (summaries.length > 0) {
  console.log(summaries.join('\n'));
}
