import { Heart, Square, SquareCheck } from 'lucide-react';
import { formatBytes, formatPixels } from '../../lib/images';
import { TYPE_LABELS, type ImageCandidate } from '../../lib/types';
import { cx } from '../ui';

export function ImageTile({
  image,
  selected,
  favorited,
  onToggle,
  onFavorite,
  onOpen,
  compact,
}: {
  image: ImageCandidate;
  selected: boolean;
  favorited: boolean;
  onToggle: () => void;
  onFavorite: () => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl bg-[var(--bg-elev)] shadow-[var(--shadow)]">
      <button type="button" className="block w-full" onClick={onOpen}>
        <div className={cx('bg-slate-200', compact ? 'h-28' : 'h-36')}>
          <img
            src={image.url}
            alt={image.alt || image.filename}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      </button>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-[var(--text-muted)]">
        <span className="truncate">{formatPixels(image.width, image.height)}</span>
        <span>{TYPE_LABELS[image.type]}</span>
        <span className="truncate">{formatBytes(image.byteSize)}</span>
      </div>
      <button
        type="button"
        className="absolute left-1.5 top-1.5 rounded-md bg-white/90 p-0.5 text-slate-700 shadow"
        onClick={onToggle}
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        {selected ? <SquareCheck size={16} className="text-[var(--accent)]" /> : <Square size={16} />}
      </button>
      <button
        type="button"
        className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-0.5 shadow"
        onClick={onFavorite}
        aria-label="Favorite"
      >
        <Heart size={16} className={favorited ? 'fill-rose-500 text-rose-500' : 'text-slate-600'} />
      </button>
    </article>
  );
}
