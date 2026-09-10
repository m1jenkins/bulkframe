import { useMemo, useState } from 'react';
import { db } from '../../db';
import { formatBytes, formatPixels } from '../../lib/images';
import { sendRuntime } from '../../lib/messaging';
import { duplicateIds } from '../../lib/hash';
import type { DownloadRecord } from '../../lib/types';
import { btn } from '../ui';
import { useLiveQuery } from '../useLiveQuery';
import { csvEscape } from '../../lib/csv';
import { downloadTextFile } from '../../lib/export';

type Tab = 'downloads' | 'duplicates' | 'large';

export function LibraryPage() {
  const records = useLiveQuery(
    () => db.library.orderBy('timestamp').reverse().toArray(),
    [] as DownloadRecord[],
    [],
  );
  const [tab, setTab] = useState<Tab>('downloads');

  const dupGroups = useMemo(() => {
    const ids = duplicateIds(records.map((r) => ({ id: r.id, url: r.url })));
    return records.filter((r) => ids.has(r.id));
  }, [records]);

  const large = useMemo(
    () => [...records].sort((a, b) => (b.byteSize ?? 0) - (a.byteSize ?? 0)).slice(0, 50),
    [records],
  );

  const view = tab === 'downloads' ? records : tab === 'duplicates' ? dupGroups : large;

  async function removeOlder() {
    const byUrl = new Map<string, DownloadRecord[]>();
    for (const r of records) {
      const list = byUrl.get(r.url) ?? [];
      list.push(r);
      byUrl.set(r.url, list);
    }
    const toDelete: DownloadRecord[] = [];
    for (const group of byUrl.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => b.timestamp - a.timestamp);
      toDelete.push(...group.slice(1));
    }
    const chromeIds = toDelete.map((r) => r.chromeDownloadId).filter((id): id is number => id != null);
    if (chromeIds.length) await sendRuntime({ type: 'DELETE_DOWNLOADS', chromeIds });
    await db.library.bulkDelete(toDelete.map((r) => r.id));
  }

  function exportReport() {
    const csv = [
      'filename,url,status,bytes,type,timestamp',
      ...view.map((r) =>
        [r.filename, r.url, r.status, r.byteSize ?? '', r.type, new Date(r.timestamp).toISOString()]
          .map((v) => csvEscape(String(v)))
          .join(','),
      ),
    ].join('\n');
    downloadTextFile('bulkframe-library.csv', csv, 'text/csv');
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Download Library</h1>
        <div className="flex gap-2">
          <button type="button" className={btn('ghost')} onClick={exportReport}>
            Export
          </button>
          {tab === 'duplicates' && (
            <button type="button" className={btn('danger')} onClick={() => void removeOlder()}>
              Delete older copies
            </button>
          )}
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        {(['downloads', 'duplicates', 'large'] as Tab[]).map((id) => (
          <button key={id} type="button" className={btn(tab === id ? 'primary' : 'ghost')} onClick={() => setTab(id)}>
            {id === 'large' ? 'Large images' : `${id.charAt(0).toUpperCase()}${id.slice(1)}`}
          </button>
        ))}
      </div>
      <div className="bf-scroll min-h-0 flex-1 overflow-auto rounded-xl bg-[var(--bg-elev)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--text-muted)]">
              <th className="p-2">File</th>
              <th className="p-2">Type</th>
              <th className="p-2">Size</th>
              <th className="p-2">Status</th>
              <th className="p-2">When</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)]">
                <td className="p-2">
                  <div className="font-medium">{r.filename}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{r.url}</div>
                </td>
                <td className="p-2 uppercase">{r.type}</td>
                <td className="p-2">
                  {formatPixels(r.width, r.height)} · {formatBytes(r.byteSize)}
                </td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 text-[var(--text-muted)]">{new Date(r.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
