import { useMemo, useState } from 'react';
import { db } from '../../db';
import { uid } from '../../lib/ids';
import { sendRuntime } from '../../lib/messaging';
import type { FavoriteFolder, FavoriteRecord } from '../../lib/types';
import { ImageGrid } from '../components/ImageGrid';
import { FooterBar } from '../components/FooterBar';
import { useLiveQuery } from '../useLiveQuery';
import { btn } from '../ui';

export function FavoritesPage() {
  const favorites = useLiveQuery(() => db.favorites.orderBy('createdAt').reverse().toArray(), [] as FavoriteRecord[], []);
  const folders = useLiveQuery(() => db.folders.toArray(), [] as FavoriteFolder[], []);
  const [folderId, setFolderId] = useState<string | 'all'>('all');
  const [tag, setTag] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');

  const visible = useMemo(
    () =>
      favorites.filter((f) => {
        if (folderId !== 'all' && f.folderId !== folderId) return false;
        if (tag && !f.tags.includes(tag)) return false;
        return true;
      }),
    [favorites, folderId, tag],
  );
  const images = visible.map((f) => f.image);
  const chosen = images.filter((i) => selected.has(i.id));

  async function addFolder() {
    if (!name.trim()) return;
    await db.folders.add({ id: uid('folder'), name: name.trim(), createdAt: Date.now() });
    setName('');
  }

  async function applyToSelected(patch: (fav: FavoriteRecord) => FavoriteRecord) {
    const targets = visible.filter((f) => selected.has(f.image.id));
    for (const fav of targets) await db.favorites.put(patch(fav));
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 space-y-3 border-r border-[var(--line)] p-3">
        <h2 className="font-semibold">Favorites</h2>
        <button type="button" className="block w-full text-left text-sm" onClick={() => setFolderId('all')}>
          All ({favorites.length})
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className="block w-full text-left text-sm"
            onClick={() => setFolderId(folder.id)}
          >
            {folder.name}
          </button>
        ))}
        <div className="flex gap-1">
          <input
            className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-sm"
            placeholder="New folder"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className={btn('soft')} onClick={() => void addFolder()}>
            Add
          </button>
        </div>
        <input
          className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-sm"
          placeholder="Filter or add tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <button
          type="button"
          className={btn('ghost')}
          onClick={() =>
            void applyToSelected((fav) => ({
              ...fav,
              tags: tag && !fav.tags.includes(tag) ? [...fav.tags, tag] : fav.tags,
            }))
          }
        >
          Tag selected
        </button>
        {folderId !== 'all' && (
          <button
            type="button"
            className={btn('ghost')}
            onClick={() => void applyToSelected((fav) => ({ ...fav, folderId }))}
          >
            Move selected here
          </button>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ImageGrid
          images={images}
          selected={selected}
          favorites={new Set(images.map((i) => i.url))}
          onToggle={(id) =>
            setSelected((s) => {
              const n = new Set(s);
              n.has(id) ? n.delete(id) : n.add(id);
              return n;
            })
          }
          onFavorite={(image) => void db.favorites.delete(`fav_${image.id}`)}
          onOpen={() => undefined}
        />
        <FooterBar
          count={chosen.length || images.length}
          onDownload={() =>
            void sendRuntime({
              type: 'DOWNLOAD_IMAGES',
              images: chosen.length ? chosen : images,
              workflow: 'dashboard',
            })
          }
          onZip={() =>
            void sendRuntime({
              type: 'DOWNLOAD_IMAGES',
              images: chosen.length ? chosen : images,
              workflow: 'dashboard',
              zip: true,
            })
          }
          onCopyLinks={() =>
            void navigator.clipboard.writeText((chosen.length ? chosen : images).map((i) => i.url).join('\n'))
          }
          onCopyNames={() =>
            void navigator.clipboard.writeText((chosen.length ? chosen : images).map((i) => i.filename).join('\n'))
          }
        />
      </div>
    </div>
  );
}
