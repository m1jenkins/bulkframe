import { db } from '../db';
import { logScan } from '../lib/analytics';
import { downloadRoute } from '../lib/downloadPath';
import { downloadImages } from '../lib/downloadPipeline';
import { applyScheduleFilters } from '../lib/filters';
import { assertFolderHandleStored } from '../lib/folderAccess';
import { getFolderWriteJob, handleFolderWriteDone } from '../lib/folderWrite';
import { uid } from '../lib/ids';
import type { Msg } from '../lib/messaging';
import { domainFromUrl, isScannableUrl } from '../lib/pages';
import {
  alarmName,
  deleteSchedule,
  expandScheduleFolder,
  getSchedule,
  listSchedules,
  nextLocalOccurrence,
  patchSchedule,
  SCHEDULES_KEY,
  scheduleIdFromAlarm,
  shouldRunMissed,
  syncScheduleAlarms,
  upsertSchedule,
} from '../lib/schedule';
import { getSettings } from '../lib/settings';
import { deepScanTab, scanTab } from '../lib/tabScan';
import type { ImageCandidate, ScanRecord, ScheduledScan } from '../lib/types';

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

async function scanOpenedUrl(
  url: string,
  opts?: { settleMs?: number; deep?: boolean },
): Promise<{ url: string; title: string; images: ImageCandidate[] }> {
  const settleMs = opts?.settleMs ?? 800;
  const settings = await getSettings();
  let tabId: number | undefined;
  try {
    const tab = await browser.tabs.create({ url, active: false });
    tabId = tab.id;
    if (!tabId) throw new Error('Could not open the page.');
    await waitForTab(tabId);
    await new Promise((r) => setTimeout(r, settleMs));
    const scanOpts = {
      skip1x1: settings.skip1x1,
      skipRedditAvatars: settings.skipRedditAvatars,
      skipTypes: settings.skipTypes,
    };
    const result = opts?.deep
      ? await deepScanTab(tabId, scanOpts)
      : await scanTab(tabId, scanOpts);
    return { url: result.url, title: result.title, images: result.images };
  } finally {
    if (tabId) await browser.tabs.remove(tabId).catch(() => undefined);
  }
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
        skipRedditAvatars: settings.skipRedditAvatars,
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
  const urls = [...new Set(inputUrls.map((u) => u.trim()).filter((u) => isScannableUrl(u)))];
  const images: ImageCandidate[] = [];
  const scanned: string[] = [];
  for (const url of urls) {
    try {
      const result = await scanOpenedUrl(url);
      images.push(...result.images);
      scanned.push(result.url);
    } catch {
      /* skip */
    }
  }
  const scanId = await saveMergedScan('links', `Mass scan · ${scanned.length} links`, scanned, images);
  return { scanId, count: images.length, sourceType: 'links' as const };
}

let scheduleChain = Promise.resolve();

function enqueueSchedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = scheduleChain.then(fn, fn);
  scheduleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function scheduleNextAlarm(schedule: ScheduledScan) {
  if (!schedule.enabled) {
    await browser.alarms.clear(alarmName(schedule.id));
    return;
  }
  await browser.alarms.create(alarmName(schedule.id), { when: nextLocalOccurrence(schedule.time) });
}

async function runScheduledScan(id: string, opts?: { force?: boolean }) {
  const schedule = await getSchedule(id);
  if (!schedule) throw new Error('Scheduled scan not found.');
  if (!schedule.enabled && !opts?.force) return { skipped: true as const };

  if (!opts?.force && !shouldRunMissed(schedule)) {
    await scheduleNextAlarm(schedule);
    return { skipped: true as const };
  }

  await patchSchedule(id, { lastAttemptAt: Date.now(), lastError: '' });
  try {
    const result = await scanOpenedUrl(schedule.url, { settleMs: 1600, deep: true });
    const images = applyScheduleFilters(result.images, schedule.filters);
    const domain = domainFromUrl(result.url);
    const scanId = await saveMergedScan(
      'schedule',
      schedule.name || `Scheduled · ${domain}`,
      [result.url],
      images,
    );
    let downloaded = 0;
    if (schedule.download && images.length) {
      const destFolder = expandScheduleFolder(schedule.destFolder, result.url);
      if (downloadRoute(destFolder).kind === 'filesystem') {
        await assertFolderHandleStored(destFolder);
      }
      const saved = await downloadImages({
        images,
        workflow: 'schedule',
        destFolder,
        saveAs: false,
      });
      downloaded = saved.ok;
    }
    await patchSchedule(id, {
      lastRunAt: Date.now(),
      lastScanId: scanId,
      lastCount: images.length,
      lastDownloaded: downloaded,
      lastError: '',
    });
    return { scanId, count: images.length, downloaded, sourceType: 'schedule' as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scheduled scan failed';
    await patchSchedule(id, { lastError: message });
    throw err;
  } finally {
    const latest = (await getSchedule(id)) ?? schedule;
    await scheduleNextAlarm(latest);
  }
}

async function catchUpMissedSchedules() {
  const list = await listSchedules();
  for (const item of list) {
    if (!shouldRunMissed(item)) continue;
    try {
      await enqueueSchedule(() => runScheduledScan(item.id));
    } catch {
      /* recorded on the schedule */
    }
  }
}

async function bootSchedules() {
  await syncScheduleAlarms();
  await catchUpMissedSchedules();
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const settings = await getSettings();
    await applyActionBehavior(settings.openInSidePanel);
    await bootSchedules();
  });

  browser.runtime.onStartup.addListener(async () => {
    const settings = await getSettings();
    await applyActionBehavior(settings.openInSidePanel);
    await bootSchedules();
  });

  void bootSchedules();

  browser.alarms.onAlarm.addListener((alarm) => {
    const id = scheduleIdFromAlarm(alarm.name);
    if (!id) return;
    return enqueueSchedule(() => runScheduledScan(id));
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['bulkframe.settings']) {
      const next = changes['bulkframe.settings'].newValue as { openInSidePanel?: boolean } | undefined;
      void applyActionBehavior(Boolean(next?.openInSidePanel));
    }
    if (changes[SCHEDULES_KEY]) void syncScheduleAlarms();
  });

  browser.runtime.onMessage.addListener((message: Msg) => {
    return (async () => {
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
        case 'SCHEDULE_UPSERT': {
          const schedule = await upsertSchedule(message.schedule);
          await syncScheduleAlarms();
          return { schedule };
        }
        case 'SCHEDULE_DELETE':
          await deleteSchedule(message.id);
          await browser.alarms.clear(alarmName(message.id));
          return { ok: true };
        case 'SCHEDULE_RUN':
          return enqueueSchedule(() => runScheduledScan(message.id, { force: true }));
        case 'FOLDER_WRITE_JOB':
          return { job: getFolderWriteJob(message.jobId) };
        case 'FOLDER_WRITE_DONE':
          handleFolderWriteDone(message);
          return { ok: true };
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
    })().catch((err: Error) => ({ error: err.message }));
  });
});
