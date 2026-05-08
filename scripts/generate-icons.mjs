import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

const outDir = resolve('src/extension/icons');
const sizes = [16, 32, 48, 128];
const ink = [17, 24, 39, 255];
const blue = [37, 99, 235, 255];
const white = [255, 255, 255, 255];

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color[0];
  png.data[idx + 1] = color[1];
  png.data[idx + 2] = color[2];
  png.data[idx + 3] = color[3];
}

function rect(png, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setPixel(png, col, row, color);
    }
  }
}

function roundedTile(png, radius) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const left = x < radius ? radius - x : 0;
      const right = x >= png.width - radius ? x - (png.width - radius - 1) : 0;
      const top = y < radius ? radius - y : 0;
      const bottom = y >= png.height - radius ? y - (png.height - radius - 1) : 0;
      const dx = Math.max(left, right);
      const dy = Math.max(top, bottom);
      if (dx === 0 || dy === 0 || dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, ink);
      }
    }
  }
}

function drawDigitBars(png, size) {
  const scale = size / 128;
  const unit = Math.max(1, Math.round(7 * scale));
  const left = Math.round(24 * scale);
  const top = Math.round(34 * scale);
  const digitWidth = Math.round(27 * scale);
  const digitHeight = Math.round(60 * scale);
  const gap = Math.round(9 * scale);
  const colonX = left + digitWidth + gap;
  const secondLeft = colonX + Math.round(13 * scale);

  const drawZero = (x) => {
    rect(png, x, top, digitWidth, unit, white);
    rect(png, x, top + digitHeight - unit, digitWidth, unit, white);
    rect(png, x, top, unit, digitHeight, white);
    rect(png, x + digitWidth - unit, top, unit, digitHeight, white);
  };

  const drawOne = (x) => {
    rect(png, x + digitWidth - unit, top, unit, digitHeight, white);
    rect(
      png,
      x + Math.round(8 * scale),
      top + digitHeight - unit,
      digitWidth - Math.round(8 * scale),
      unit,
      white
    );
  };

  drawZero(left);
  drawOne(secondLeft);
  rect(
    png,
    colonX,
    top + Math.round(14 * scale),
    Math.max(1, Math.round(7 * scale)),
    Math.max(1, Math.round(7 * scale)),
    blue
  );
  rect(
    png,
    colonX,
    top + Math.round(39 * scale),
    Math.max(1, Math.round(7 * scale)),
    Math.max(1, Math.round(7 * scale)),
    blue
  );
}

function makeIcon(size) {
  const png = new PNG({ width: size, height: size });
  roundedTile(png, Math.round(size * 0.18));
  drawDigitBars(png, size);
  return PNG.sync.write(png);
}

await mkdir(outDir, { recursive: true });

for (const size of sizes) {
  await writeFile(resolve(outDir, `icon-${size}.png`), makeIcon(size));
}

await writeFile(
  resolve(outDir, 'icon-source.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Clockboard icon">
  <rect width="128" height="128" rx="24" fill="#111827"/>
  <path fill="#fff" d="M24 34h27v7H31v46h20v7H24V34Zm20 0h7v60h-7V34Zm53 0h7v60h-7V34Zm-19 53h26v7H78v-7Z"/>
  <path fill="#2563eb" d="M60 48h7v7h-7v-7Zm0 25h7v7h-7v-7Z"/>
</svg>
`
);
