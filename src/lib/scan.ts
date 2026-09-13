import { hashString, uid } from './ids';
import { filenameFromUrl, inferType, largestSrcsetUrl, withoutRedditAvatars } from './images';
import { upgradeRedgifsMediaUrl } from './redgifs.ts';
import type { ImageCandidate, ImageType } from './types';
import { pickVideoFile } from './videoScan.ts';

function absUrl(url: string, base = location.href): string | null {
  if (!url || url.startsWith('data:text/html')) return null;
  try {
    const resolved = new URL(url, base).href;
    if (resolved.startsWith('javascript:')) return null;
    return resolved;
  } catch {
    return null;
  }
}

function cssUrls(value: string): string[] {
  const out: string[] = [];
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const u = m[2];
    if (!u) continue;
    if (u.startsWith('data:image') || !u.startsWith('data:')) out.push(u);
  }
  return out;
}

function pushCandidate(
  map: Map<string, ImageCandidate>,
  rawUrl: string,
  extra: Partial<ImageCandidate> & Pick<ImageCandidate, 'source'>,
) {
  const resolved = absUrl(rawUrl);
  if (!resolved) return;
  const upgraded = upgradeRedgifsMediaUrl(resolved);
  const url = upgraded?.url ?? resolved;
  if (url.startsWith('data:') && url.length < 32) return;
  const existing = map.get(url);
  const poster = extra.poster || upgraded?.poster;
  if (existing) {
    if ((extra.width ?? 0) > (existing.width ?? 0)) {
      existing.width = extra.width;
      existing.height = extra.height;
    }
    if (poster && !existing.poster) existing.poster = poster;
    return;
  }
  const filename = extra.filename || filenameFromUrl(url);
  map.set(url, {
    id: `img_${hashString(url)}`,
    url,
    pageUrl: location.href,
    type: extra.type || inferType(url, extra.mime, filename),
    filename,
    source: extra.source,
    width: extra.width,
    height: extra.height,
    mime: extra.mime,
    alt: extra.alt,
    byteSize: extra.byteSize,
    poster,
  });
}

export interface ScanOptions {
  skip1x1: boolean;
  skipRedditAvatars: boolean;
  skipTypes: ImageType[];
}

export function scanDocument(options: ScanOptions): ImageCandidate[] {
  const map = new Map<string, ImageCandidate>();

  document.querySelectorAll('img').forEach((img) => {
    const w = img.naturalWidth || img.width || undefined;
    const h = img.naturalHeight || img.height || undefined;
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    const lazy =
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy');
    const current = img.currentSrc || img.src || lazy || '';
    const largest = srcset ? largestSrcsetUrl(srcset) : undefined;
    pushCandidate(map, largest || current, {
      source: srcset ? 'srcset' : 'img',
      width: w,
      height: h,
      alt: img.alt || undefined,
    });
    if (lazy && lazy !== current) {
      pushCandidate(map, lazy, { source: 'img', width: w, height: h, alt: img.alt || undefined });
    }
  });

  document.querySelectorAll('picture source').forEach((el) => {
    const srcset = el.getAttribute('srcset');
    if (!srcset) return;
    const url = largestSrcsetUrl(srcset);
    if (url) pushCandidate(map, url, { source: 'srcset' });
  });

  document.querySelectorAll('video').forEach((el) => {
    const video = el as HTMLVideoElement;
    const poster = video.getAttribute('poster') || undefined;
    const sourceSrcs = [...video.querySelectorAll('source')]
      .map((source) => source.getAttribute('src') || '')
      .filter(Boolean);
    const picked = pickVideoFile({
      src: video.getAttribute('src') || undefined,
      currentSrc: video.currentSrc || undefined,
      poster,
      sourceSrcs,
    });
    const width = video.videoWidth || video.width || undefined;
    const height = video.videoHeight || video.height || undefined;
    if (picked) {
      pushCandidate(map, picked.url, {
        source: 'video',
        width,
        height,
        poster: picked.poster,
      });
      return;
    }
    if (poster) pushCandidate(map, poster, { source: 'video', width, height });
  });

  document
    .querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]')
    .forEach((el) => {
      const content = el.getAttribute('content');
      if (content) pushCandidate(map, content, { source: 'video' });
    });

  document.querySelectorAll('image, svg image').forEach((el) => {
    const href = el.getAttribute('href') || el.getAttribute('xlink:href');
    if (href) pushCandidate(map, href, { source: 'svg' });
  });

  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[itemprop="image"]').forEach(
    (el) => {
      const content = el.getAttribute('content');
      if (content) pushCandidate(map, content, { source: 'meta' });
    },
  );

  document.querySelectorAll('[style*="url("]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    for (const u of cssUrls(style)) pushCandidate(map, u, { source: 'background' });
  });

  const styled = document.querySelectorAll('div, section, header, a, span, figure, li, article, aside, main');
  const limit = Math.min(styled.length, 900);
  for (let i = 0; i < limit; i++) {
    const el = styled[i] as HTMLElement;
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      for (const u of cssUrls(bg)) pushCandidate(map, u, { source: 'background' });
    }
  }

  document.querySelectorAll('canvas').forEach((canvas, index) => {
    try {
      if (canvas.width < 2 || canvas.height < 2) return;
      const url = canvas.toDataURL('image/png');
      pushCandidate(map, url, {
        source: 'canvas',
        width: canvas.width,
        height: canvas.height,
        filename: `canvas-${index + 1}.png`,
        type: 'png',
        mime: 'image/png',
      });
    } catch {
      /* tainted canvas */
    }
  });

  let images = [...map.values()];
  if (options.skip1x1) {
    images = images.filter((img) => !(img.width === 1 && img.height === 1));
  }
  images = withoutRedditAvatars(images, options.skipRedditAvatars);
  if (options.skipTypes.length) {
    images = images.filter((img) => !options.skipTypes.includes(img.type));
  }
  return images;
}

export function describePage() {
  return {
    title: document.title || location.hostname,
    url: location.href,
    domain: location.hostname.replace(/^www\./, ''),
  };
}

export function findImageAtPoint(x: number, y: number): ImageCandidate | null {
  const node = document.elementFromPoint(x, y);
  if (!node) return null;
  const video = node instanceof HTMLVideoElement ? node : node.closest('video');
  if (video instanceof HTMLVideoElement) {
    const poster = video.getAttribute('poster') || undefined;
    const sourceSrcs = [...video.querySelectorAll('source')]
      .map((source) => source.getAttribute('src') || '')
      .filter(Boolean);
    const picked = pickVideoFile({
      src: video.getAttribute('src') || undefined,
      currentSrc: video.currentSrc || undefined,
      poster,
      sourceSrcs,
    });
    const url = absUrl(picked?.url || poster || '');
    if (!url) return null;
    return {
      id: `img_${hashString(url)}`,
      url,
      pageUrl: location.href,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      type: inferType(url),
      filename: filenameFromUrl(url),
      source: 'video',
      poster: picked?.poster || poster,
    };
  }
  const img = node instanceof HTMLImageElement ? node : node.closest('img');
  if (img instanceof HTMLImageElement) {
    const raw = img.currentSrc || img.src;
    if (!raw) return null;
    const upgraded = upgradeRedgifsMediaUrl(raw);
    const url = upgraded?.url || raw;
    return {
      id: `img_${hashString(url)}`,
      url,
      pageUrl: location.href,
      width: img.naturalWidth || undefined,
      height: img.naturalHeight || undefined,
      type: inferType(url),
      filename: filenameFromUrl(url),
      source: 'img',
      alt: img.alt || undefined,
      poster: upgraded?.poster,
    };
  }
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (el) {
    const bg = getComputedStyle(el).backgroundImage;
    const urls = cssUrls(bg);
    if (urls[0]) {
      const resolved = absUrl(urls[0]);
      if (!resolved) return null;
      const upgraded = upgradeRedgifsMediaUrl(resolved);
      const url = upgraded?.url ?? resolved;
      return {
        id: `img_${hashString(url)}`,
        url,
        pageUrl: location.href,
        type: inferType(url),
        filename: filenameFromUrl(url),
        source: 'background',
        poster: upgraded?.poster,
      };
    }
  }
  return null;
}

export function uniqueScanId() {
  return uid('scan');
}
