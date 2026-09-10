import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function roundedRect(px, size, x, y, w, h, r, color) {
  const [cr, cg, cb, ca] = color;
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const inside =
        ix >= x &&
        ix < x + w &&
        iy >= y &&
        iy < y + h &&
        !(ix < x + r && iy < y + r && (ix - (x + r)) ** 2 + (iy - (y + r)) ** 2 > r * r) &&
        !(ix >= x + w - r && iy < y + r && (ix - (x + w - r - 1)) ** 2 + (iy - (y + r)) ** 2 > r * r) &&
        !(ix < x + r && iy >= y + h - r && (ix - (x + r)) ** 2 + (iy - (y + h - r - 1)) ** 2 > r * r) &&
        !(ix >= x + w - r && iy >= y + h - r && (ix - (x + w - r - 1)) ** 2 + (iy - (y + h - r - 1)) ** 2 > r * r);
      if (inside) {
        const i = (iy * size + ix) * 4;
        px[i] = cr;
        px[i + 1] = cg;
        px[i + 2] = cb;
        px[i + 3] = ca;
      }
    }
  }
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const pad = Math.round(size * 0.08);
  const r = Math.round(size * 0.22);
  roundedRect(px, size, pad, pad, size - pad * 2, size - pad * 2, r, [15, 118, 110, 255]);

  const framePad = Math.round(size * 0.28);
  const frameW = size - framePad * 2;
  const frameH = Math.round(size * 0.32);
  const frameY = Math.round(size * 0.26);
  roundedRect(px, size, framePad, frameY, frameW, frameH, Math.round(size * 0.06), [240, 253, 250, 255]);
  roundedRect(
    px,
    size,
    framePad + Math.round(size * 0.05),
    frameY + Math.round(size * 0.05),
    frameW - Math.round(size * 0.1),
    frameH - Math.round(size * 0.1),
    Math.round(size * 0.04),
    [15, 118, 110, 255],
  );

  const arrowX = Math.round(size * 0.42);
  const arrowY = Math.round(size * 0.58);
  const arrowW = Math.round(size * 0.16);
  const arrowH = Math.round(size * 0.18);
  roundedRect(px, size, arrowX, arrowY, arrowW, arrowH, Math.round(size * 0.04), [240, 253, 250, 255]);
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const cx = size / 2;
      const top = Math.round(size * 0.72);
      const dy = iy - top;
      const dx = Math.abs(ix - cx);
      if (dy >= 0 && dy <= Math.round(size * 0.14) && dx <= dy + Math.round(size * 0.02)) {
        const i = (iy * size + ix) * 4;
        px[i] = 240;
        px[i + 1] = 253;
        px[i + 2] = 250;
        px[i + 3] = 255;
      }
    }
  }
  return encodePng(size, size, px);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), drawIcon(size));
}

console.log('Wrote icons to', outDir);
