import { useEffect, useMemo, useState } from 'react';
import { db } from '../db';
import { similarGroups } from '../lib/hash';
import { hashScanImages } from '../lib/downloadPipeline';
import type { ScanRecord } from '../lib/types';
import { ScanList } from './components/ScanList';
import { ScanWorkspace } from './components/ScanWorkspace';
import { MassScanPage } from './pages/MassScanPage';
import { ScheduledPage } from './pages/ScheduledPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { LibraryPage } from './pages/LibraryPage';
import { RulesPage } from './pages/RulesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettings } from './useSettings';
import { cx } from './ui';
import { Frame } from 'lucide-react';
import { MediaThumb } from './components/MediaThumb';

const NAV = [
  { id: 'scans', label: 'Scan Results' },
  { id: 'mass', label: 'Mass Scan' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'library', label: 'Library' },
  { id: 'rules', label: 'Rules' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'similar', label: 'Similar' },
  { id: 'settings', label: 'Settings' },
] as const;

type View = (typeof NAV)[number]['id'];

export function DashboardApp() {
  useSettings();
  const params = new URLSearchParams(location.search);
  const [view, setView] = useState<View>((params.get('view') as View) || 'scans');
  const [scan, setScan] = useState<ScanRecord | null>(null);

  useEffect(() => {
    const id = params.get('scan');
    if (!id) return;
    void db.scans.get(id).then((s) => {
      if (s) {
        setScan(s);
        setView('scans');
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-[var(--bg)]">
      <nav className="flex w-52 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-elev)] p-3">
        <div className="mb-6 flex items-center gap-2 px-1">
          <div className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-white">
            <Frame size={16} />
          </div>
          <div className="font-semibold">Bulkframe</div>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(
              'rounded-lg px-3 py-2 text-left text-sm',
              view === item.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--line)]',
            )}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="flex min-w-0 flex-1">
        {view === 'scans' && (
          <>
            <ScanList selectedId={scan?.id} onSelect={setScan} />
            {scan ? (
              <ScanWorkspace scan={scan} workflow="dashboard" />
            ) : (
              <div className="grid flex-1 place-items-center text-[var(--text-muted)]">
                Select a scan or run Search images from the popup.
              </div>
            )}
          </>
        )}
        {view === 'mass' && <MassScanPage onOpenScan={(id) => void db.scans.get(id).then((s) => s && (setScan(s), setView('scans')))} />}
        {view === 'scheduled' && (
          <ScheduledPage onOpenScan={(id) => void db.scans.get(id).then((s) => s && (setScan(s), setView('scans')))} />
        )}
        {view === 'favorites' && <FavoritesPage />}
        {view === 'library' && <LibraryPage />}
        {view === 'rules' && <RulesPage />}
        {view === 'analytics' && <AnalyticsPage />}
        {view === 'similar' && <SimilarPage scan={scan} />}
        {view === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

function SimilarPage({ scan }: { scan: ScanRecord | null }) {
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<string[][]>([]);
  const current = scan;

  const images = current?.images ?? [];

  async function run() {
    if (!current) return;
    setBusy(true);
    await hashScanImages(current.id);
    const next = await db.scans.get(current.id);
    if (!next) return;
    const map = similarGroups(next.images);
    setGroups([...map.values()]);
    setBusy(false);
  }

  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  if (!current) {
    return <div className="grid flex-1 place-items-center p-6 text-[var(--text-muted)]">Open a scan first, then find visually similar images.</div>;
  }

  return (
    <div className="bf-scroll flex-1 overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Visually similar</h1>
        <button
          type="button"
          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? 'Hashing…' : 'Find similar images'}
        </button>
      </div>
      <div className="space-y-6">
        {groups.map((ids, i) => (
          <div key={i} className="rounded-2xl bg-[var(--bg-elev)] p-3">
            <div className="mb-2 text-sm text-[var(--text-muted)]">Group {i + 1} · {ids.length} images</div>
            <div className="flex flex-wrap gap-2">
              {ids.map((id) => {
                const img = byId.get(id);
                if (!img) return null;
                return <MediaThumb key={id} image={img} className="h-24 w-24 rounded-lg object-cover" alt="" />;
              })}
            </div>
          </div>
        ))}
        {!groups.length && <p className="text-sm text-[var(--text-muted)]">Run detection to group similar images from the current scan.</p>}
      </div>
    </div>
  );
}
