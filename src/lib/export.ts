import { csvEscape } from './csv';
import type { ImageCandidate } from './types';

export function imagesToCsv(images: ImageCandidate[]): string {
  const header = ['filename', 'url', 'pageUrl', 'type', 'width', 'height', 'bytes', 'source'];
  const rows = images.map((img) =>
    [
      img.filename,
      img.url,
      img.pageUrl,
      img.type,
      img.width ?? '',
      img.height ?? '',
      img.byteSize ?? '',
      img.source,
    ]
      .map((v) => csvEscape(String(v)))
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
