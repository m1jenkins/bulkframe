import JSZip from 'jszip';
import type { ImageCandidate } from './types';

export async function zipImages(
  files: { image: ImageCandidate; blob: Blob; filename: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const used = new Map<string, number>();
  files.forEach(({ filename, blob }, i) => {
    let name = filename;
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    if (n > 0) {
      const parts = name.split('.');
      const ext = parts.length > 1 ? parts.pop() : '';
      name = `${parts.join('.')}-${n + 1}${ext ? `.${ext}` : ''}`;
    }
    zip.file(name, blob);
    onProgress?.(i + 1, files.length);
  });
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
