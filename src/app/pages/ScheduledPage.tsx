import { useEffect, useState } from 'react';
import { FilterBar, FilterPanel } from '../components/FilterPanel';
import { coerceFolder, destFolderLabel, isAbsoluteFolder } from '../../lib/downloadPath';
import { emptyFilters, normalizeFilters, summarizeFilters } from '../../lib/filters';
import { hasFolderAccess, pickAndStoreFolderHandle } from '../../lib/folderAccess';
import { sendRuntime } from '../../lib/messaging';
import { domainFromUrl } from '../../lib/pages';
import { requestHostPermission } from '../../lib/permissions';
import { listSchedules, nextLocalOccurrence, watchSchedules } from '../../lib/schedule';
import type { FilterState, ScheduledScan } from '../../lib/types';
import { btn } from '../ui';

type Draft = {
  id: string;
  name: string;
  url: string;
  time: string;
  destFolder: string;
  download: boolean;
  filters: FilterState;
};

function emptyDraft(): Draft {
  return {
    id: '',
    name: '',
    url: '',
    time: '09:00',
    destFolder: 'Bulkframe/{domain}',
    download: true,
    filters: emptyFilters(),
  };
}

function formatWhen(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatClock(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ScheduledPage({ onOpenScan }: { onOpenScan: (id: string) => void }) {
  const [schedules, setSchedules] = useState<ScheduledScan[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState('');
  const [status, setStatus] = useState('');
  const [folderAccess, setFolderAccess] = useState(false);
  const [folderNote, setFolderNote] = useState('');

  useEffect(() => {
    void listSchedules().then(setSchedules);
    return watchSchedules(setSchedules);
  }, []);

  useEffect(() => {
    if (!isAbsoluteFolder(coerceFolder(draft.destFolder))) {
      setFolderAccess(true);
      setFolderNote('');
      return;
    }
    void hasFolderAccess(draft.destFolder).then(setFolderAccess);
  }, [draft.destFolder]);

  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const granted = await requestHostPermission();
      if (!granted) throw new Error('Allow page access so Bulkframe can open this link on a schedule.');
      const result = (await sendRuntime({
        type: 'SCHEDULE_UPSERT',
        schedule: {
          id: draft.id || undefined,
          name: draft.name,
          url: draft.url,
          time: draft.time,
          destFolder: draft.destFolder,
          download: draft.download,
          enabled: draft.id ? (schedules.find((item) => item.id === draft.id)?.enabled ?? true) : true,
          filters: draft.filters,
        },
      })) as { schedule?: ScheduledScan; error?: string };
      if (result.error) throw new Error(result.error);
      setDraft(emptyDraft());
      setStatus(
        isAbsoluteFolder(coerceFolder(draft.destFolder)) && !folderAccess
          ? 'Saved. Allow the destination folder so files can be written there.'
          : 'Saved. Chrome must be running at the scheduled time.',
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save schedule');
    } finally {
      setBusy(false);
    }
  }

  async function grantFolder() {
    setStatus('');
    try {
      const result = await pickAndStoreFolderHandle(draft.destFolder);
      setFolderAccess(true);
      setFolderNote(
        result.mismatch
          ? `Access granted to “${result.name}”, but the path ends with “${result.expectedName}”. Pick the matching folder if files land in the wrong place.`
          : `Access granted to “${result.name}”.`,
      );
    } catch (err) {
      setFolderAccess(false);
      setStatus(err instanceof Error ? err.message : 'Could not allow that folder');
    }
  }

  async function toggle(item: ScheduledScan, enabled: boolean) {
    await sendRuntime({
      type: 'SCHEDULE_UPSERT',
      schedule: {
        id: item.id,
        name: item.name,
        url: item.url,
        time: item.time,
        destFolder: item.destFolder,
        download: item.download,
        enabled,
        filters: item.filters,
      },
    });
  }

  async function runNow(item: ScheduledScan) {
    setRunningId(item.id);
    setStatus('Scrolling the page so more images load…');
    try {
      const granted = await requestHostPermission();
      if (!granted) throw new Error('Allow page access to run this scan.');
      const result = (await sendRuntime({ type: 'SCHEDULE_RUN', id: item.id })) as {
        scanId?: string;
        count?: number;
        downloaded?: number;
        error?: string;
      };
      if (result.error) throw new Error(result.error);
      setStatus(
        `Found ${result.count ?? 0} images${result.downloaded ? `, saved ${result.downloaded}` : ''}`,
      );
      if (result.scanId) onOpenScan(result.scanId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Scheduled scan failed');
    } finally {
      setRunningId('');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled scans</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Open a page once a day, scroll it so lazy feeds like Reddit cards load more media, scan it, and
          optionally save files that match your filters.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl bg-[var(--bg-elev)] p-4">
        <h2 className="font-medium">{draft.id ? 'Edit schedule' : 'New daily scan'}</h2>
        <label className="block text-sm">
          Label
          <input
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
            placeholder="Optional name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Page URL
          <input
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
            placeholder="https://example.com/gallery"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Time
          <input
            type="time"
            className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
            value={draft.time}
            onChange={(e) => setDraft({ ...draft, time: e.target.value })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Download found images
          <input
            type="checkbox"
            checked={draft.download}
            onChange={(e) => setDraft({ ...draft, download: e.target.checked })}
          />
        </label>
        {draft.download && (
          <div className="space-y-2">
            <label className="block text-sm">
              Destination folder
              <input
                className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2"
                placeholder="Bulkframe/{domain} or /Users/you/PeekIngest/drop"
                value={draft.destFolder}
                onChange={(e) => setDraft({ ...draft, destFolder: e.target.value })}
              />
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                Relative paths save under Downloads. Absolute paths save to that folder after you allow access.
                Tokens: {'{domain}'} {'{date}'}
              </span>
            </label>
            {isAbsoluteFolder(coerceFolder(draft.destFolder)) && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={btn('soft')} onClick={() => void grantFolder()}>
                    Allow this folder
                  </button>
                  <span className="text-[var(--text-muted)]">
                    {folderAccess
                      ? folderNote || 'Folder access is granted.'
                      : 'Chrome cannot write here until you pick this folder once.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)]">
          <div className="px-3 pt-2 text-xs font-medium text-[var(--text-muted)]">Filters</div>
          <FilterBar
            filters={draft.filters}
            images={[]}
            onChange={(filters) => setDraft({ ...draft, filters })}
          />
          <details className="px-3 pb-3">
            <summary className="cursor-pointer py-2 text-xs text-[var(--text-muted)]">More filters</summary>
            <FilterPanel
              embedded
              filters={draft.filters}
              images={[]}
              onChange={(filters) => setDraft({ ...draft, filters })}
            />
          </details>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn()} disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : draft.id ? 'Update schedule' : 'Save schedule'}
          </button>
          {draft.id && (
            <button type="button" className={btn('ghost')} onClick={() => setDraft(emptyDraft())}>
              Cancel
            </button>
          )}
        </div>
      </section>

      <ul className="space-y-2">
        {schedules.map((item) => {
          const next = item.enabled ? nextLocalOccurrence(item.time) : null;
          return (
            <li key={item.id} className="rounded-2xl bg-[var(--bg-elev)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {item.name || domainFromUrl(item.url)} · {formatClock(item.time)}
                  </div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{item.url}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {summarizeFilters(item.filters)}
                    {item.download ? ` · Save to ${destFolderLabel(item.destFolder)}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.lastError
                      ? `Last error: ${item.lastError}`
                      : item.lastRunAt
                        ? `Last run ${formatWhen(item.lastRunAt)} · ${item.lastCount ?? 0} images${
                            item.lastDownloaded ? `, saved ${item.lastDownloaded}` : ''
                          }`
                        : 'Not run yet'}
                    {next ? ` · Next ${formatWhen(next)}` : ''}
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => void toggle(item, e.target.checked)}
                  />
                  On
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn('soft')}
                  disabled={Boolean(runningId)}
                  onClick={() => void runNow(item)}
                >
                  {runningId === item.id ? 'Running…' : 'Run now'}
                </button>
                <button
                  type="button"
                  className={btn('ghost')}
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      name: item.name,
                      url: item.url,
                      time: item.time,
                      destFolder: item.destFolder,
                      download: item.download,
                      filters: normalizeFilters(item.filters),
                    })
                  }
                >
                  Edit
                </button>
                {item.lastScanId && (
                  <button type="button" className={btn('ghost')} onClick={() => onOpenScan(item.lastScanId!)}>
                    Open last scan
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => void sendRuntime({ type: 'SCHEDULE_DELETE', id: item.id })}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
        {!schedules.length && (
          <li className="text-sm text-[var(--text-muted)]">No daily scans yet. Add a page URL and time above.</li>
        )}
      </ul>
      {status && <p className="text-sm text-[var(--text-muted)]">{status}</p>}
    </div>
  );
}
