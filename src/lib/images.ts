import type { ImageType, Orientation } from './types';

const EXT_MAP: Record<string, ImageType> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  jpe: 'jpeg',
  png: 'png',
  gif: 'gif',
  bmp: 'bmp',
  svg: 'svg',
  tif: 'tiff',
  tiff: 'tiff',
  webp: 'webp',
  avif: 'other',
  ico: 'other',
};

const MIME_MAP: Record<string, ImageType> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
};

export function filenameFromUrl(url: string): string {
  try {
    const noHash = url.split('#')[0] ?? url;
    const clean = noHash.split('?')[0] ?? noHash;
    const last = clean.split('/').filter(Boolean).pop() || 'image';
    const decoded = decodeURIComponent(last);
    return decoded.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'image';
  } catch {
    return 'image';
  }
}

export function extFromFilename(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? '';
}

export function inferType(url: string, mime?: string, filename?: string): ImageType {
  if (mime) {
    const key = mime.split(';')[0]?.trim().toLowerCase() ?? mime;
    if (MIME_MAP[key]) return MIME_MAP[key];
    if (key.startsWith('image/')) return 'other';
  }
  const name = filename || filenameFromUrl(url);
  const ext = extFromFilename(name);
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  const path = url.toLowerCase();
  for (const [k, v] of Object.entries(EXT_MAP)) {
    if (path.includes(`.${k}`)) return v;
  }
  return 'other';
}

export function typeToExt(type: ImageType, format?: 'original' | 'jpg' | 'png'): string {
  if (format === 'jpg') return 'jpg';
  if (format === 'png') return 'png';
  switch (type) {
    case 'jpeg':
      return 'jpg';
    case 'tiff':
      return 'tif';
    case 'other':
      return 'img';
    default:
      return type;
  }
}

export function orientationOf(width?: number, height?: number): Orientation | undefined {
  if (!width || !height) return undefined;
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function formatPixels(width?: number, height?: number): string {
  if (!width || !height) return '—';
  return `${width}×${height}`;
}

export function pixelCount(width?: number, height?: number): number {
  if (!width || !height) return 0;
  return width * height;
}

export function resolutionBucket(width?: number, height?: number): 'S' | 'M' | 'L' | 'XL' | '—' {
  const n = pixelCount(width, height);
  if (!n) return '—';
  if (n < 360_000) return 'S';
  if (n < 1_960_000) return 'M';
  if (n < 6_250_000) return 'L';
  return 'XL';
}

export function ensureExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  const safe = (base || 'image').slice(0, 180);
  return `${safe}.${ext}`;
}

export function parseSrcset(srcset: string): { url: string; width: number }[] {
  return srcset
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bits = part.split(/\s+/);
      const url = bits[0] ?? '';
      const desc = bits[1] || '';
      const width = desc.endsWith('w') ? parseInt(desc, 10) : desc.endsWith('x') ? parseFloat(desc) * 1000 : 0;
      return { url, width: Number.isFinite(width) ? width : 0 };
    })
    .filter((item) => item.url);
}

export function largestSrcsetUrl(srcset: string): string | undefined {
  const items = parseSrcset(srcset);
  if (!items.length) return undefined;
  items.sort((a, b) => b.width - a.width);
  return items[0]?.url;
}

const MAGIC: Array<{ type: ImageType; mime: string; test: (b: Uint8Array) => boolean }> = [
  { type: 'jpeg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 },
  { type: 'png', mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: 'gif', mime: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { type: 'webp', mime: 'image/webp', test: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { type: 'bmp', mime: 'image/bmp', test: (b) => b[0] === 0x42 && b[1] === 0x4d },
  { type: 'tiff', mime: 'image/tiff', test: (b) => (b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d) },
];

export function sniffType(bytes: Uint8Array): { type: ImageType; mime: string } | undefined {
  const head = bytes.slice(0, 16);
  const text = new TextDecoder().decode(head).trimStart();
  if (text.startsWith('<svg') || text.startsWith('<?xml')) {
    return { type: 'svg', mime: 'image/svg+xml' };
  }
  return MAGIC.find((m) => m.test(bytes))
    ? { type: MAGIC.find((m) => m.test(bytes))!.type, mime: MAGIC.find((m) => m.test(bytes))!.mime }
    : undefined;
}
