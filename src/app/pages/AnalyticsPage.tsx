import { Fragment, useMemo, useState } from 'react';
import { eventsInRange, RANGE_LABELS, rangeBounds } from '../../lib/analytics';
import { csvEscape } from '../../lib/csv';
import { downloadTextFile } from '../../lib/export';
import { formatBytes } from '../../lib/images';
import { resolutionBucket } from '../../lib/images';
import type { AnalyticsEvent, DateRangeKey, Workflow } from '../../lib/types';
import { db } from '../../db';
import { btn } from '../ui';
import { useLiveQuery } from '../useLiveQuery';

const KEYS: DateRangeKey[] = ['today', 'yesterday', 'last7', 'last30', 'wtd', 'mtd', 'last12', 'ytd', 'all'];

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeKey>('last30');
  const events = useLiveQuery(() => db.analytics.toArray(), [] as AnalyticsEvent[], []);
  const scans = useLiveQuery(() => db.scans.toArray(), [], []);

  const filtered = useMemo(() => {
    const { from, to } = rangeBounds({ key: range });
    return events.filter((e) => e.timestamp >= from && e.timestamp <= to);
  }, [events, range]);

  const scansE = filtered.filter((e) => e.type === 'scan');
  const downloads = filtered.filter((e) => e.type === 'download');
  const imagesFound = scansE.reduce((s, e) => s + (e.count ?? 0), 0);
  const foundBytes = scansE.reduce((s, e) => s + (e.byteSize ?? 0), 0);
  const downloaded = downloads.length;
  const downloadedBytes = downloads.reduce((s, e) => s + (e.byteSize ?? 0), 0);

  const types = new Map<string, number>();
  for (const scan of scans) {
    for (const img of scan.images) types.set(img.type, (types.get(img.type) ?? 0) + 1);
  }
  const typeEntries = [...types.entries()].sort((a, b) => b[1] - a[1]);
  const typeTotal = typeEntries.reduce((s, [, n]) => s + n, 0) || 1;

  const domains = new Map<string, number>();
  for (const s of scans) domains.set(s.domain, (domains.get(s.domain) ?? 0) + s.images.length);
  const topDomains = [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const e of scansE) {
    const d = new Date(e.timestamp);
    const day = heatmap[d.getDay()];
    if (day) day[d.getHours()] = (day[d.getHours()] ?? 0) + (e.count ?? 0);
  }
  const maxHeat = Math.max(1, ...heatmap.flat());

  const workflow: Record<Workflow, number> = { popup: 0, dashboard: 0, wand: 0 };
  for (const d of downloads) {
    if (d.workflow) workflow[d.workflow] += 1;
  }

  const buckets = { S: 0, M: 0, L: 0, XL: 0, '—': 0 };
  for (const scan of scans) {
    for (const img of scan.images) buckets[resolutionBucket(img.width, img.height)] += 1;
  }

  const largest = scans
    .flatMap((s) => s.images)
    .filter((i) => i.byteSize)
    .sort((a, b) => (b.byteSize ?? 0) - (a.byteSize ?? 0))
    .slice(0, 10);

  function exportReport(format: 'csv' | 'json' | 'txt' | 'xls') {
    const highlights = {
      scans: scansE.length,
      imagesFound,
      foundBytes,
      downloaded,
      downloadedBytes,
    };
    if (format === 'json') {
      downloadTextFile('bulkframe-analytics.json', JSON.stringify({ highlights, typeEntries, topDomains, workflow }, null, 2), 'application/json');
      return;
    }
    const csv = [
      'metric,value',
      `scans,${highlights.scans}`,
      `imagesFound,${highlights.imagesFound}`,
      `downloaded,${highlights.downloaded}`,
      ...typeEntries.map(([k, v]) => `type_${k},${v}`),
    ].join('\n');
    if (format === 'txt') {
      downloadTextFile('bulkframe-analytics.txt', csv.replaceAll(',', ': '));
      return;
    }
    if (format === 'xls') {
      const html = `<table><tr><th>metric</th><th>value</th></tr>${csv
        .split('\n')
        .slice(1)
        .map((line) => {
          const [a, b] = line.split(',');
          return `<tr><td>${csvEscape(a ?? '')}</td><td>${csvEscape(b ?? '')}</td></tr>`;
        })
        .join('')}</table>`;
      downloadTextFile('bulkframe-analytics.xls', html, 'application/vnd.ms-excel');
      return;
    }
    downloadTextFile('bulkframe-analytics.csv', csv, 'text/csv');
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bf-scroll h-full overflow-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1"
            value={range}
            onChange={(e) => setRange(e.target.value as DateRangeKey)}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {RANGE_LABELS[k]}
              </option>
            ))}
          </select>
          {(['csv', 'json', 'txt', 'xls'] as const).map((fmt) => (
            <button key={fmt} type="button" className={btn('ghost')} onClick={() => exportReport(fmt)}>
              Export {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Scans" value={String(scansE.length)} />
        <Stat label="Images found" value={String(imagesFound)} />
        <Stat label="Found size" value={formatBytes(foundBytes)} />
        <Stat label="Downloads" value={`${downloaded} · ${formatBytes(downloadedBytes)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-[var(--bg-elev)] p-4">
          <h2 className="mb-3 font-medium">File types</h2>
          <div className="flex items-center gap-6">
            <Donut segments={typeEntries} total={typeTotal} />
            <ul className="text-sm">
              {typeEntries.slice(0, 6).map(([k, v]) => (
                <li key={k}>
                  {k.toUpperCase()} · {v}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="rounded-2xl bg-[var(--bg-elev)] p-4">
          <h2 className="mb-3 font-medium">Downloads by workflow</h2>
          {(['popup', 'dashboard', 'wand'] as Workflow[]).map((w) => (
            <Bar key={w} label={w} value={workflow[w]} max={Math.max(1, ...Object.values(workflow))} />
          ))}
        </section>
        <section className="rounded-2xl bg-[var(--bg-elev)] p-4 lg:col-span-2">
          <h2 className="mb-3 font-medium">Activity heatmap</h2>
          <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-[var(--text-muted)]">
                {h}
              </div>
            ))}
            {heatmap.map((row, d) => (
              <Fragment key={d}>
                <div className="text-[var(--text-muted)]">{days[d]}</div>
                {row.map((v, h) => (
                  <div
                    key={`${d}-${h}`}
                    title={`${days[d]} ${h}:00 · ${v}`}
                    className="aspect-square rounded-sm"
                    style={{ background: `color-mix(in srgb, var(--accent) ${(v / maxHeat) * 100}%, var(--line))` }}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-[var(--bg-elev)] p-4">
          <h2 className="mb-3 font-medium">Top domains</h2>
          {topDomains.map(([d, n]) => (
            <Bar key={d} label={d} value={n} max={topDomains[0]?.[1] || 1} />
          ))}
        </section>
        <section className="rounded-2xl bg-[var(--bg-elev)] p-4">
          <h2 className="mb-3 font-medium">Largest files</h2>
          <ul className="space-y-1 text-sm">
            {largest.map((img) => (
              <li key={img.id} className="truncate">
                {img.filename} · {formatBytes(img.byteSize)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-elev)] p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Donut({ segments, total }: { segments: [string, number][]; total: number }) {
  const colors = ['#0f766e', '#14b8a6', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#84cc16', '#64748b'];
  let acc = 0;
  const stops = segments.map(([_, n], i) => {
    const start = acc;
    acc += (n / total) * 100;
    return `${colors[i % colors.length]} ${start}% ${acc}%`;
  });
  return (
    <div
      className="size-28 rounded-full"
      style={{ background: `conic-gradient(${stops.join(',')})` }}
      title={`${total} images`}
    />
  );
}

