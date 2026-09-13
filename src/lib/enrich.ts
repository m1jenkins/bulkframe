import { inferType, isVideoType, sniffType } from './images';
import type { ImageCandidate } from './types';

async function headSize(url: string): Promise<{ byteSize?: number; mime?: string }> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma);
    const mime = meta.split(';')[0];
    const payload = url.slice(comma + 1);
    const byteSize = Math.round((payload.length * 3) / 4);
    return { byteSize, mime };
  }
  try {
    const res = await fetch(url, { method: 'HEAD', credentials: 'include' });
    if (!res.ok) return {};
    const len = res.headers.get('content-length');
    const mime = res.headers.get('content-type')?.split(';')[0];
    return { byteSize: len ? Number(len) : undefined, mime: mime || undefined };
  } catch {
    return {};
  }
}

function loadDimensions(url: string): Promise<{ width?: number; height?: number }> {
  if (url.startsWith('data:image/svg')) return Promise.resolve({});
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer-when-downgrade';
    const done = (width?: number, height?: number) => {
      img.onload = null;
      img.onerror = null;
      resolve({ width, height });
    };
    img.onload = () => done(img.naturalWidth || undefined, img.naturalHeight || undefined);
    img.onerror = () => done();
    img.src = url;
    setTimeout(() => done(img.naturalWidth || undefined, img.naturalHeight || undefined), 4000);
  });
}

export async function enrichImages(
  images: ImageCandidate[],
  concurrency = 8,
): Promise<ImageCandidate[]> {
  const queue = [...images];
  const out: ImageCandidate[] = [];
  async function worker() {
    while (queue.length) {
      const item = queue.shift()!;
      const next = { ...item };
      try {
        const skipDims = Boolean(next.width && next.height) || isVideoType(next.type);
        const [head, dims] = await Promise.all([
          next.byteSize
            ? Promise.resolve({ byteSize: undefined as number | undefined, mime: undefined as string | undefined })
            : headSize(next.url),
          skipDims
            ? Promise.resolve({ width: undefined as number | undefined, height: undefined as number | undefined })
            : loadDimensions(next.url),
        ]);
        if (head.byteSize) next.byteSize = head.byteSize;
        if (head.mime) next.mime = head.mime;
        if (dims.width) next.width = dims.width;
        if (dims.height) next.height = dims.height;
        next.type = inferType(next.url, next.mime, next.filename);
      } catch {
        /* keep original */
      }
      out.push(next);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, images.length || 1) }, () => worker()));
  return images.map((orig) => out.find((i) => i.id === orig.id) ?? orig);
}

export async function sniffBlob(image: ImageCandidate, blob: Blob): Promise<ImageCandidate> {
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const sniffed = sniffType(bytes);
  return {
    ...image,
    byteSize: blob.size,
    mime: sniffed?.mime || blob.type || image.mime,
    type: sniffed?.type || image.type,
  };
}
