import { formatBytes } from '../../lib/images';
import { totalBytes } from '../../lib/filters';
import type { ScanRecord } from '../../lib/types';
import { db } from '../../db';
import { useLiveQuery } from '../useLiveQuery';
import { cx } from '../ui';

export function ScanList({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (scan: ScanRecord) => void;
}) {
  const scans = useLiveQuery(() => db.scans.orderBy('createdAt').reverse().toArray(), [] as ScanRecord[], []);
  const searches = useLiveQuery(() => db.savedSearches.orderBy('createdAt').reverse().toArray(), [], []);

  return (
    <aside className="bf-scroll w-72 shrink-0 overflow-auto border-r border-[var(--line)] p-3">
      <h2 className="mb-3 font-semibold">Scan Results</h2>
      <ul className="space-y-2">
        {scans.map((scan) => (
          <li key={scan.id}>
            <button
              type="button"
              onClick={() => onSelect(scan)}
              className={cx(
                'w-full rounded-xl px-3 py-2 text-left',
                selectedId === scan.id ? 'bg-[var(--accent-soft)]' : 'bg-[var(--bg-elev)]',
              )}
            >
              <div className="flex justify-between text-sm font-medium">
                <span className="truncate">{scan.domain}</span>
                <span className="text-[var(--text-muted)]">
                  {new Date(scan.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {scan.images.length} · {formatBytes(totalBytes(scan.images))}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {searches.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">Saved searches</h3>
          <ul className="space-y-1 text-sm">
            {searches.map((s) => (
              <li key={s.id} className="rounded-lg bg-[var(--bg-elev)] px-2 py-1">
                {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
