import { describePage, scanDocument } from './scan';
import type { ScanPageResult } from './messaging';
import { isScannableUrl } from './pages';
import type { ImageType } from './types';

export async function ensureContentScript(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'PING' });
    return;
  } catch {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/content.js'],
    });
  }
}

export async function scanTab(
  tabId: number,
  options: { skip1x1: boolean; skipTypes: ImageType[] },
): Promise<ScanPageResult> {
  const tab = await browser.tabs.get(tabId);
  if (!isScannableUrl(tab.url)) {
    throw new Error('This page cannot be scanned. Open a regular website and try again.');
  }
  await ensureContentScript(tabId);
  return browser.tabs.sendMessage(tabId, {
    type: 'SCAN_PAGE',
    skip1x1: options.skip1x1,
    skipTypes: options.skipTypes,
  }) as Promise<ScanPageResult>;
}

export { describePage, scanDocument };
