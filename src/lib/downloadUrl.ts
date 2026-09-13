import type { DownloadFormat } from './types';

export function isDirectlyDownloadable(url: string): boolean {
  return /^(https?:|data:)/i.test(url);
}

export function downloadStrategy(
  imageUrl: string,
  format: DownloadFormat,
): 'direct' | 'blob' {
  if (format === 'original' && isDirectlyDownloadable(imageUrl)) return 'direct';
  return 'blob';
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const type = blob.type || 'application/octet-stream';
  return `data:${type};base64,${btoa(binary)}`;
}
