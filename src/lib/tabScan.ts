import { describePage, scanDocument } from './scan';
import type { ScanPageResult } from './messaging';
import {
  advanceDeepLoad,
  DEEP_LOAD_DEFAULTS,
  initialDeepLoadState,
  wait,
  type DeepLoadOptions,
} from './pageLoad';
import { isScannableUrl } from './pages';
import type { ImageCandidate, ImageType } from './types';

type ScanOpts = { skip1x1: boolean; skipRedditAvatars: boolean; skipTypes: ImageType[] };

export async function ensureContentScript(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['/content-scripts/content.js'],
    });
    return;
  }
  await browser.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      files: ['/content-scripts/content.js'],
    })
    .catch(() => undefined);
}

function mergeFrameScans(frames: { frameId: number; result?: ScanPageResult | null }[]): ScanPageResult | null {
  const pages = frames
    .map((frame) => frame.result)
    .filter((result): result is ScanPageResult => Boolean(result?.ok));
  if (!pages.length) return null;
  const top = frames.find((frame) => frame.frameId === 0)?.result ?? pages[0];
  const map = new Map<string, ImageCandidate>();
  for (const page of pages) {
    for (const image of page.images) {
      if (!map.has(image.url)) map.set(image.url, image);
    }
  }
  return {
    ok: true,
    title: top!.title,
    url: top!.url,
    domain: top!.domain,
    images: [...map.values()],
  };
}

async function collectTabScan(tabId: number, options: ScanOpts): Promise<ScanPageResult> {
  try {
    const frames = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (opts: ScanOpts) => {
        const scan = (globalThis as unknown as { __bulkframeScan?: (o: ScanOpts) => ScanPageResult }).__bulkframeScan;
        return scan ? scan(opts) : null;
      },
      args: [options],
    });
    const merged = mergeFrameScans(frames);
    if (merged) return merged;
  } catch {
    /* isolated-world helper missing; fall back to top-frame message */
  }
  return browser.tabs.sendMessage(tabId, {
    type: 'SCAN_PAGE',
    skip1x1: options.skip1x1,
    skipRedditAvatars: options.skipRedditAvatars,
    skipTypes: options.skipTypes,
  }) as Promise<ScanPageResult>;
}

async function measureTab(tabId: number): Promise<{ scrollHeight: number; mediaCount: number }> {
  try {
    const frames = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const scrolling = document.scrollingElement || document.documentElement;
        let nested = 0;
        document.querySelectorAll('main, [role="main"], [role="feed"], shreddit-feed').forEach((node) => {
          const el = node as HTMLElement;
          if (el.scrollHeight > nested) nested = el.scrollHeight;
        });
        return {
          scrollHeight: Math.max(
            scrolling?.scrollHeight ?? 0,
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
            nested,
          ),
          mediaCount: document.images.length + document.querySelectorAll('video').length,
        };
      },
    });
    return frames[0]?.result ?? { scrollHeight: 0, mediaCount: 0 };
  } catch {
    return { scrollHeight: 0, mediaCount: 0 };
  }
}

async function spoofTabVisible(tabId: number): Promise<void> {
  await browser.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
        } catch {
          /* page may lock these */
        }
      },
    })
    .catch(() => undefined);
}

async function scrollTab(tabId: number): Promise<void> {
  await browser.scripting
    .executeScript({
      target: { tabId },
      func: () => {
        const dy = Math.max(window.innerHeight || 800, 720) * 0.9;
        document.querySelectorAll('img[loading="lazy"]').forEach((node) => {
          (node as HTMLImageElement).loading = 'eager';
        });
        window.scrollBy(0, dy);
        const scrolling = document.scrollingElement || document.documentElement;
        if (scrolling) scrolling.scrollTop = Math.min(scrolling.scrollHeight, (scrolling.scrollTop || 0) + dy);
        document.querySelectorAll('div, main, section, [role="main"], [role="feed"], shreddit-feed').forEach((node) => {
          const el = node as HTMLElement;
          const overflow = el.scrollHeight - el.clientHeight;
          if (overflow < 240) return;
          const overflowY = String(getComputedStyle(el).overflowY);
          if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return;
          el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + dy);
        });
        window.dispatchEvent(new Event('scroll'));
      },
    })
    .catch(() => undefined);
}

export async function scanTab(tabId: number, options: ScanOpts): Promise<ScanPageResult> {
  const tab = await browser.tabs.get(tabId);
  if (!isScannableUrl(tab.url)) {
    throw new Error('This page cannot be scanned. Open a regular website and try again.');
  }
  await ensureContentScript(tabId);
  return collectTabScan(tabId, options);
}

export async function deepScanTab(
  tabId: number,
  options: ScanOpts,
  load: DeepLoadOptions = {},
): Promise<ScanPageResult> {
  const tab = await browser.tabs.get(tabId);
  if (!isScannableUrl(tab.url)) {
    throw new Error('This page cannot be scanned. Open a regular website and try again.');
  }
  await ensureContentScript(tabId);
  await spoofTabVisible(tabId);

  const startedAt = Date.now();
  let state = initialDeepLoadState();
  const map = new Map<string, ImageCandidate>();
  let meta: Pick<ScanPageResult, 'title' | 'url' | 'domain'> | null = null;

  while (true) {
    const page = await collectTabScan(tabId, options);
    meta = { title: page.title, url: page.url, domain: page.domain };
    for (const image of page.images) {
      if (!map.has(image.url)) map.set(image.url, image);
    }

    const measured = await measureTab(tabId);
    const { stop, next } = advanceDeepLoad(
      state,
      {
        scrollHeight: measured.scrollHeight,
        uniqueImages: map.size,
        mediaCount: measured.mediaCount,
      },
      Date.now(),
      startedAt,
      load,
    );
    state = next;
    if (stop) break;
    await scrollTab(tabId);
    await wait(load.stepMs ?? DEEP_LOAD_DEFAULTS.stepMs);
  }

  if (!meta) throw new Error('Could not scan the page.');
  return { ok: true, ...meta, images: [...map.values()] };
}

export { describePage, scanDocument };
