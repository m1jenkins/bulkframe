import { coerceFolder, sanitizeFolder } from './downloadPath.ts';
import { domainFromUrl } from './pages.ts';

export { coerceFolder, sanitizeFolder };

export const SCHEDULES_KEY = 'bulkframe.schedules';
export const SCHEDULE_ALARM_PREFIX = 'bf-sched:';

export function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23) return null;
  return { hours, minutes };
}

export function normalizeTime(value: string): string | null {
  const parsed = parseTime(value);
  if (!parsed) return null;
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
}

export function localDateStamp(at = new Date()): string {
  return [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
  ].join('-');
}

export function expandScheduleFolder(folder: string, url: string, at = new Date()): string {
  return coerceFolder(
    coerceFolder(folder)
      .replaceAll('{date}', localDateStamp(at))
      .replaceAll('{domain}', domainFromUrl(url)),
  );
}

export function localOccurrenceOnDay(time: string, day: Date): number {
  const parsed = parseTime(time);
  if (!parsed) throw new Error('Invalid time');
  const next = new Date(day);
  next.setSeconds(0, 0);
  next.setHours(parsed.hours, parsed.minutes, 0, 0);
  return next.getTime();
}

export function nextLocalOccurrence(time: string, from = Date.now()): number {
  const today = localOccurrenceOnDay(time, new Date(from));
  if (today > from) return today;
  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localOccurrenceOnDay(time, tomorrow);
}

export function shouldRunMissed(
  schedule: {
    enabled: boolean;
    time: string;
    createdAt: number;
    armedAt?: number;
    lastAttemptAt?: number;
  },
  now = Date.now(),
): boolean {
  if (!schedule.enabled) return false;
  const todayAt = localOccurrenceOnDay(schedule.time, new Date(now));
  if (now < todayAt) return false;
  const armedAt = schedule.armedAt ?? schedule.createdAt;
  if (armedAt > todayAt) return false;
  if (schedule.lastAttemptAt == null) return true;
  return schedule.lastAttemptAt < todayAt;
}

export function alarmName(id: string): string {
  return `${SCHEDULE_ALARM_PREFIX}${id}`;
}

export function scheduleIdFromAlarm(name: string): string | null {
  if (!name.startsWith(SCHEDULE_ALARM_PREFIX)) return null;
  return name.slice(SCHEDULE_ALARM_PREFIX.length) || null;
}
