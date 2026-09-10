import { ExternalLink, LayoutGrid, List, SlidersHorizontal, SquareCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '../../db';
import { applyFilters, emptyFilters, sortImages, totalBytes, type SortKey } from '../../lib/filters';
import { duplicateIds } from '../../lib/hash';
import { downloadTextFile, imagesToCsv } from '../../lib/export';
import { uid } from '../../lib/ids';
import { formatBytes } from '../../lib/images';
import { sendRuntime } from '../../lib/messaging';
import type { FilterState, ImageCandidate, ScanRecord, Workflow } from '../../lib/types';
import { IconButton } from './IconButton';
import { ImageGrid } from './ImageGrid';
import { FilterPanel } from './FilterPanel';
import { FooterBar } from './FooterBar';
import { PreviewModal } from './PreviewModal';
import { useLiveQuery } from '../useLiveQuery';

export function ScanWorkspace({
  scan,
  workflow,
  compact,
  onOpenFull,
}: {
  scan: ScanRecord;
  workflow: Workflow;
  compact?: boolean;
  onOpenFull?: () => void;
}) {
  const [view, setView] = useState<'grid' | 'filters' | 'list'>('grid');
  const [filters, setFilters] = useState<FilterState>(emptyFilters());
  const [sort, setSort] = useState<SortKey>('pixels');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');

  const favoriteUrls = useLiveQuery(
    async () => new Set((await db.favorites.toArray()).map((f) => f.image.url)),
    new Set<string>(),
    [],
  );

  const dups = useMemo(() => duplicateIds(scan.images), [scan.images]);
  const visible = useMemo(
    () => sortImages(applyFilters(scan.images, filters, dups), sort),
    [scan.images, filters, dups, sort],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected(new Set(visible.map((i) => i.id)));
  }

  const chosen: ImageCandidate[] =
    selected.size > 0 ? visible.filter((i) => selected.has(i.id)) : visible;

  async function favorite(image: ImageCandidate) {
    const existing = await db.favorites.where('id').equals(`fav_${image.id}`).first();
    if (existing) await db.favorites.delete(existing.id);
    else {
      await db.favorites.put({
        id: `fav_${image.id}`,
        image,
        tags: [],
        createdAt: Date.now(),
      });
    }
  }

  async function runDownload(zip = false) {
    setStatus(zip ? 'Preparing ZIP…' : 'Downloading…');
    const result = (await sendRuntime({
      type: 'DOWNLOAD_IMAGES',
      images: chosen,
      workflow,
      zip,
    })) as { ok?: number; failed?: number; error?: string };
    if (result?.error) setStatus(result.error);
    else setStatus(`Saved ${result.ok ?? 0}${result.failed ? `, ${result.failed} failed` : ''}`);
  }

  async function copy(kind: 'url' | 'filename') {
    const text = chosen.map((i) => (kind === 'url' ? i.url : i.filename)).join('\n');
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${chosen.length} ${kind === 'url' ? 'links' : 'filenames'}`);
  }

  async function saveFilters() {
    await db.savedSearches.add({
      id: uid('search'),
      name: `${scan.domain} filters`,
      createdAt: Date.now(),
      filters,
      scanId: scan.id,
    });
    setStatus('Filters saved');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--text-muted)]">
        <div>
          {visible.length} images · {formatBytes(totalBytes(visible))}
        </div>
        <select
          className="rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-1 py-0.5"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="pixels">Pixels</option>
          <option value="size">File size</option>
          <option value="width">Width</option>
          <option value="type">Type</option>
        </select>
      </div>
      <div className="flex items-center gap-1 px-2">
        <IconButton label="Grid" active={view === 'grid'} onClick={() => setView('grid')}>
          <LayoutGrid size={16} />
        </IconButton>
        <IconButton label="Filters" active={view === 'filters'} onClick={() => setView('filters')}>
          <SlidersHorizontal size={16} />
        </IconButton>
        <IconButton label="List" active={view === 'list'} onClick={() => setView('list')}>
          <List size={16} />
        </IconButton>
        <button
          type="button"
          className="ml-1 inline-flex items-center gap-1 text-xs text-[var(--accent)]"
          onClick={selectVisible}
        >
          <SquareCheck size={14} /> Select all
        </button>
        {onOpenFull && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--accent)]"
            onClick={onOpenFull}
          >
            Open in Full Mode <ExternalLink size={12} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {view === 'filters' ? (
          <FilterPanel filters={filters} images={scan.images} onChange={setFilters} onSave={saveFilters} />
        ) : (
          <ImageGrid
            images={visible}
            selected={selected}
            favorites={favoriteUrls}
            list={view === 'list'}
            compact={compact}
            onToggle={toggle}
            onFavorite={favorite}
            onOpen={setPreview}
          />
        )}
      </div>
      {status && <div className="px-3 pb-1 text-xs text-[var(--text-muted)]">{status}</div>}
      <FooterBar
        count={chosen.length}
        onDownload={() => void runDownload(false)}
        onZip={() => void runDownload(true)}
        onCopyLinks={() => void copy('url')}
        onCopyNames={() => void copy('filename')}
        onCsv={() => downloadTextFile(`${scan.domain}.csv`, imagesToCsv(chosen), 'text/csv')}
      />
      {preview != null && (
        <PreviewModal
          images={visible}
          index={preview}
          onClose={() => setPreview(null)}
          onIndex={setPreview}
          onDownload={(image) =>
            void sendRuntime({ type: 'DOWNLOAD_IMAGES', images: [image], workflow })
          }
          onFavorite={favorite}
          onCopy={(text) => void navigator.clipboard.writeText(text)}
        />
      )}
    </div>
  );
}
