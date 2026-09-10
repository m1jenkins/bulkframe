import { db } from '../db';
import { logScan } from '../lib/analytics';
import { downloadImages } from '../lib/downloadPipeline';
import { uid } from '../lib/ids';
import type { Msg } from '../lib/messaging';
import { domainFromUrl, isScannableUrl } from '../lib/pages';
import { getSettings } from '../lib/settings';
import { scanTab } from '../lib/tabScan';
import type { ImageCandidate, ScanRecord } from '../lib/types';

async function applyActionBehavior(openInSidePanel: boolean) {
  await browser.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
  await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: openInSidePanel });
  await browser.action.setPopup({ popup: openInSidePanel ? '' : 'popup.html' });
}

function waitForTab(tabId: number, timeout = 25000) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, timeout);
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    function finish() {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    browser.tabs.onUpdated.addListener(listener);
  });
}

function dedupeImages(images: ImageCandidate[]): ImageCandidate[] {
  const map = new Map<string, ImageCandidate>();
  for (const img of images) {
    if (!map.has(img.url)) map.set(img.url, img);
  }
  return [...map.values()];
}

async function saveMergedScan(
  sourceType: ScanRecord['sourceType'],
  title: string,
  urls: string[],
  images: ImageCandidate[],
): Promise<string> {
  const unique = dedupeImages(images);
  const id = uid('scan');
  const domain = urls[0] ? domainFromUrl(urls[0]) : 'multiple';
  await db.scans.add({
    id,
    createdAt: Date.now(),
    sourceType,
    title,
    domain: urls.length > 1 ? `${urls.length} pages` : domain,
    urls,
    images: unique,
  });
  await logScan(domain, unique);
  return id;
}

async function massScanTabs(tabIds?: number[]) {
  const settings = await getSettings();
  const current = await browser.windows.getCurrent();
  const tabs = await browser.tabs.query({ windowId: current.id });
  const targets = tabs.filter((t) => t.id && isScannableUrl(t.url) && (!tabIds || tabIds.includes(t.id)));
  const images: ImageCandidate[] = [];
  const urls: string[] = [];
  for (const tab of targets) {
    try {
      const result = await scanTab(tab.id!, {
        skip1x1: settings.skip1x1,
        skipTypes: settings.skipTypes,
      });
      images.push(...result.images);
      urls.push(result.url);
    } catch {
      /* skip tab */
    }
  }
  const scanId = await saveMergedScan('tabs', `Mass scan · ${urls.length} tabs`, urls, images);
  return { scanId, count: images.length, sourceType: 'tabs' as const };
}

async function massScanUrls(inputUrls: string[]) {
  const settings = await getSettings();
  const urls = [...new Set(inputUrls.map((u) => u.trim()).filter((u) => isScannableUrl(u)))];
  const images: ImageCandidate[] = [];
  const scanned: string[] = [];
  for (const url of urls) {
    let tabId: number | undefined;
    try {
      const tab = await browser.tabs.create({ url, active: false });
      tabId = tab.id;
      if (!tabId) continue;
      await waitForTab(tabId);
      await new Promise((r) => setTimeout(r, 800));
      const result = await scanTab(tabId, {
        skip1x1: settings.skip1x1,
        skipTypes: settings.skipTypes,
      });
      images.push(...result.images);
      scanned.push(result.url);
    } catch {
      /* skip */
    } finally {
      if (tabId) await browser.tabs.remove(tabId).catch(() => undefined);
    }
  }
  const scanId = await saveMergedScan('links', `Mass scan · ${scanned.length} links`, scanned, images);
  return { scanId, count: images.length, sourceType: 'links' as const };
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const settings = await getSettings();
    await applyActionBehavior(settings.openInSidePanel);
  });

  browser.runtime.onStartup.addListener(async () => {
    const settings = await getSettings();
    await applyActionBehavior(settings.openInSidePanel);
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes['bulkframe.settings']) return;
    const next = changes['bulkframe.settings'].newValue as { openInSidePanel?: boolean } | undefined;
    void applyActionBehavior(Boolean(next?.openInSidePanel));
  });

  browser.runtime.onMessage.addListener((message: Msg, _sender, sendResponse) => {
    const handle = async () => {
      switch (message.type) {
        case 'DOWNLOAD_IMAGES':
          return downloadImages({
            images: message.images,
            workflow: message.workflow,
            format: message.format,
            zip: message.zip,
          });
        case 'MASS_SCAN_TABS':
          return massScanTabs(message.tabIds);
        case 'MASS_SCAN_URLS':
          return massScanUrls(message.urls);
        case 'OPEN_DASHBOARD': {
          const params = new URLSearchParams();
          if (message.scanId) params.set('scan', message.scanId);
          if (message.view) params.set('view', message.view);
          const qs = params.toString();
          const url = browser.runtime.getURL(qs ? `/dashboard.html?${qs}` : '/dashboard.html');
          await browser.tabs.create({ url });
          return { ok: true };
        }
        case 'OPEN_SIDE_PANEL': {
          const window = await browser.windows.getCurrent();
          if (window.id != null) await browser.sidePanel.open({ windowId: window.id });
          return { ok: true };
        }
        case 'DELETE_DOWNLOADS': {
          for (const id of message.chromeIds) {
            try {
              await browser.downloads.removeFile(id);
            } catch {
              /* already gone */
            }
            try {
              await browser.downloads.erase({ id });
            } catch {
              /* ignore */
            }
          }
          return { ok: true };
        }
        case 'WAND_EVENT': {
          if (message.action === 'download' || message.action === 'tray-download') {
            return downloadImages({ images: message.images, workflow: 'wand', zip: false });
          }
          if (message.action === 'tray-zip') {
            return downloadImages({ images: message.images, workflow: 'wand', zip: true });
          }
          return { ok: true };
        }
        default:
          return { ok: false };
      }
    };
    handle()
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ error: err.message }));
    return true;
  });
});
