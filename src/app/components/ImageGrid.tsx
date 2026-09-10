import { formatBytes, formatPixels } from '../../lib/images';
import { TYPE_LABELS, type ImageCandidate } from '../../lib/types';
import { ImageTile } from './ImageTile';

export function ImageGrid({
  images,
  selected,
  favorites,
  onToggle,
  onFavorite,
  onOpen,
  list,
  compact,
}: {
  images: ImageCandidate[];
  selected: Set<string>;
  favorites: Set<string>;
  onToggle: (id: string) => void;
  onFavorite: (image: ImageCandidate) => void;
  onOpen: (index: number) => void;
  list?: boolean;
  compact?: boolean;
}) {
  if (!images.length) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--text-muted)]">
        No images match the current filters.
      </div>
    );
  }

  if (list) {
    return (
      <div className="bf-scroll flex flex-col gap-1 overflow-auto p-2">
        {images.map((image, index) => (
          <label
            key={image.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg bg-[var(--bg-elev)] px-2 py-1.5"
          >
            <input
              type="checkbox"
              checked={selected.has(image.id)}
              onChange={() => onToggle(image.id)}
            />
            <img src={image.url} alt="" className="size-10 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{image.filename}</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {formatPixels(image.width, image.height)} · {TYPE_LABELS[image.type]} ·{' '}
                {formatBytes(image.byteSize)}
              </div>
            </div>
            <button type="button" className="text-xs text-[var(--accent)]" onClick={() => onOpen(index)}>
              Preview
            </button>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="bf-scroll grid grid-cols-2 gap-2 overflow-auto p-2">
      {images.map((image, index) => (
        <ImageTile
          key={image.id}
          image={image}
          compact={compact}
          selected={selected.has(image.id)}
          favorited={favorites.has(image.url)}
          onToggle={() => onToggle(image.id)}
          onFavorite={() => onFavorite(image)}
          onOpen={() => onOpen(index)}
        />
      ))}
    </div>
  );
}
