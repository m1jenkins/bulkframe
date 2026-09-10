import { db } from '../db';
import { uid } from './ids';
import type { AnalyticsEvent, DateRange, DateRangeKey, ImageCandidate, Workflow } from './types';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function rangeBounds(range: DateRange): { from: number; to: number } {
  const now = new Date();
  const to = range.to ?? Date.now();
  const today = startOfDay(now);
  switch (range.key) {
    case 'today':
      return { from: today, to };
    case 'yesterday':
      return { from: today - 86400000, to: today };
    case 'last7':
      return { from: today - 6 * 86400000, to };
    case 'last30':
      return { from: today - 29 * 86400000, to };
    case 'wtd': {
      const day = now.getDay() || 7;
      return { from: today - (day - 1) * 86400000, to };
    }
    case 'mtd':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to };
    case 'last12':
      return { from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime(), to };
    case 'ytd':
      return { from: new Date(now.getFullYear(), 0, 1).getTime(), to };
    case 'custom':
      return { from: range.from ?? 0, to: range.to ?? to };
    case 'all':
    default:
      return { from: 0, to };
  }
}

export async function logScan(domain: string, images: ImageCandidate[]) {
  await db.analytics.add({
    id: uid('evt'),
    type: 'scan',
    timestamp: Date.now(),
    domain,
    count: images.length,
    byteSize: images.reduce((s, i) => s + (i.byteSize ?? 0), 0),
  });
}

export async function logDownload(opts: {
  domain?: string;
  workflow: Workflow;
  byteSize?: number;
  imageType?: ImageCandidate['type'];
  width?: number;
  height?: number;
}) {
  await db.analytics.add({
    id: uid('evt'),
    type: 'download',
    timestamp: Date.now(),
    ...opts,
    count: 1,
  });
}

export async function eventsInRange(range: DateRange): Promise<AnalyticsEvent[]> {
  const { from, to } = rangeBounds(range);
  return db.analytics.where('timestamp').between(from, to, true, true).toArray();
}

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  wtd: 'Week to date',
  mtd: 'Month to date',
  last12: 'Last 12 months',
  ytd: 'Year to date',
  all: 'All time',
  custom: 'Custom',
};
