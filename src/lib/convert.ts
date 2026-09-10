import type { DownloadFormat } from './types';

export async function convertBlob(blob: Blob, format: Exclude<DownloadFormat, 'original'>): Promise<Blob> {
  if (blob.type.includes('svg')) {
    throw new Error('SVG conversion is skipped');
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const out = await canvas.convertToBlob({ type, quality: format === 'jpg' ? 0.92 : undefined });
  bitmap.close();
  return out;
}

export async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
