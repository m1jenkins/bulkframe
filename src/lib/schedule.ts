import { normalizeFilters } from './filters';
import { uid } from './ids';
import { isScannableUrl } from './pages';
import {
  alarmName,
  coerceFolder,
  expandScheduleFolder,
  localOccurrenceOnDay,
  nextLocalOccurrence,
  normalizeTime,
  sanitizeFolder,
  SCHEDULE_ALARM_PREFIX,
  SCHEDULES_KEY,
  scheduleIdFromAlarm,
  shouldRunMissed,
} from './scheduleLogic';
import type { FilterState, ScheduledScan } from './types';

export type ScheduleInput = {
  id?: string;
  url: string;
  time: string;
  destFolder?: string;
  download?: boolean;
  enabled?: boolean;
  name?: string;
  filters?: FilterState;
};

export {
  alarmName,
  coerceFolder,
  expandScheduleFolder,
  localOccurrenceOnDay,
  nextLocalOccurrence,
  normalizeTime,
  sanitizeFolder,
  SCHEDULE_ALARM_PREFIX,
  SCHEDULES_KEY,
  scheduleIdFromAlarm,
  shouldRunMissed,
};

function hydrateSchedule(item: ScheduledScan): ScheduledScan {
  return { ...item, destFolder: coerceFolder(item.destFolder), filters: normalizeFilters(item.filters) };
}

export async function listSchedules(): Promise<ScheduledScan[]> {
  const stored = await browser.storage.local.get(SCHEDULES_KEY);
  const value = stored[SCHEDULES_KEY];
  return Array.isArray(value) ? (value as ScheduledScan[]).map(hydrateSchedule) : [];
}

export async function saveSchedules(schedules: ScheduledScan[]): Promise<void> {
  await browser.storage.local.set({ [SCHEDULES_KEY]: schedules });
}

export async function getSchedule(id: string): Promise<ScheduledScan | undefined> {
  return (await listSchedules()).find((item) => item.id === id);
}

export async function upsertSchedule(input: ScheduleInput): Promise<ScheduledScan> {
  const url = input.url.trim();
  if (!isScannableUrl(url)) throw new Error('Enter a regular http(s) page URL.');
  const time = normalizeTime(input.time);
  if (!time) throw new Error('Choose a valid time.');
  const list = await listSchedules();
  const existing = input.id ? list.find((item) => item.id === input.id) : undefined;
  const record: ScheduledScan = {
    id: existing?.id ?? uid('sched'),
    createdAt: existing?.createdAt ?? Date.now(),
    url,
    time,
    destFolder: coerceFolder(input.destFolder ?? existing?.destFolder ?? ''),
    download: input.download ?? existing?.download ?? true,
    enabled: input.enabled ?? existing?.enabled ?? true,
    name: (input.name ?? existing?.name ?? '').trim(),
    armedAt: Date.now(),
    filters: normalizeFilters(input.filters ?? existing?.filters),
    lastRunAt: existing?.lastRunAt,
    lastAttemptAt: existing?.lastAttemptAt,
    lastError: existing?.lastError,
    lastScanId: existing?.lastScanId,
    lastCount: existing?.lastCount,
    lastDownloaded: existing?.lastDownloaded,
  };
  const next = existing ? list.map((item) => (item.id === record.id ? record : item)) : [...list, record];
  await saveSchedules(next);
  return record;
}

export async function patchSchedule(id: string, patch: Partial<ScheduledScan>): Promise<ScheduledScan | undefined> {
  const list = await listSchedules();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const current = list[index];
  if (!current) return undefined;
  const next = { ...current, ...patch, id };
  list[index] = next;
  await saveSchedules(list);
  return next;
}

export async function deleteSchedule(id: string): Promise<void> {
  const list = await listSchedules();
  await saveSchedules(list.filter((item) => item.id !== id));
}

export async function syncScheduleAlarms(schedules?: ScheduledScan[]): Promise<void> {
  const list = schedules ?? (await listSchedules());
  const existing = await browser.alarms.getAll();
  const enabled = new Set(list.filter((item) => item.enabled).map((item) => item.id));
  for (const alarm of existing) {
    const id = scheduleIdFromAlarm(alarm.name);
    if (id && !enabled.has(id)) await browser.alarms.clear(alarm.name);
  }
  for (const item of list) {
    if (!item.enabled) continue;
    await browser.alarms.create(alarmName(item.id), { when: nextLocalOccurrence(item.time) });
  }
}

export function watchSchedules(cb: (schedules: ScheduledScan[]) => void): () => void {
  const listener = (changes: { [key: string]: { newValue?: unknown } }, area: string) => {
    if (area !== 'local' || !changes[SCHEDULES_KEY]) return;
    const value = changes[SCHEDULES_KEY].newValue;
    cb(Array.isArray(value) ? (value as ScheduledScan[]).map(hydrateSchedule) : []);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
