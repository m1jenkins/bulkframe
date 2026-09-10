import { domainFromUrl } from './pages';
import type { ImageCandidate } from './types';

export const RENAME_TOKENS = [
  '{domain}',
  '{filename}',
  '{index}',
  '{width}',
  '{height}',
  '{date}',
  '{ext}',
] as const;

export function applyRename(
  image: ImageCandidate,
  index: number,
  pattern: string,
  separator: string,
  ext: string,
): string {
  const stem = image.filename.replace(/\.[a-z0-9]+$/i, '') || 'image';
  const date = new Date().toISOString().slice(0, 10);
  const raw = pattern
    .replaceAll('{domain}', domainFromUrl(image.pageUrl || image.url))
    .replaceAll('{filename}', stem)
    .replaceAll('{index}', String(index + 1).padStart(3, '0'))
    .replaceAll('{width}', image.width ? String(image.width) : 'w')
    .replaceAll('{height}', image.height ? String(image.height) : 'h')
    .replaceAll('{date}', date)
    .replaceAll('{ext}', ext);
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, separator || '-')
    .slice(0, 180);
  return `${cleaned || 'image'}.${ext}`;
}

export function previewRename(pattern: string, separator: string): string {
  const sample: ImageCandidate = {
    id: 'sample',
    url: 'https://cdn.example.com/photos/hero-shot.jpg',
    pageUrl: 'https://example.com/gallery',
    width: 1920,
    height: 1080,
    type: 'jpeg',
    filename: 'hero-shot.jpg',
    source: 'img',
  };
  return applyRename(sample, 0, pattern || '{filename}', separator || '-', 'jpg');
}
