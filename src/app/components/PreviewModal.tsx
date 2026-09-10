import { ChevronLeft, ChevronRight, Download, Heart, Link2, X } from 'lucide-react';
import { formatBytes, formatPixels } from '../../lib/images';
import { TYPE_LABELS, type ImageCandidate } from '../../lib/types';
import { btn } from '../ui';

export function PreviewModal({
  images,
  index,
  onClose,
  onIndex,
  onDownload,
  onFavorite,
  onCopy,
}: {
  images: ImageCandidate[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  onDownload: (image: ImageCandidate) => void;
  onFavorite: (image: ImageCandidate) => void;
  onCopy: (text: string) => void;
}) {
  const image = images[index];
  if (!image) return null;
  return (
    <div className="fixed inset-0 z-50 grid grid-rows-[auto_1fr_auto] bg-black/80 text-white">
      <header className="flex items-center justify-between px-3 py-2">
        <div className="text-sm">
          {index + 1} / {images.length} · {image.filename}
        </div>
        <button type="button" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </header>
      <div className="relative grid place-items-center overflow-hidden p-4">
        <img src={image.url} alt="" className="max-h-full max-w-full object-contain" />
        <button
          type="button"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2"
          onClick={() => onIndex((index - 1 + images.length) % images.length)}
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2"
          onClick={() => onIndex((index + 1) % images.length)}
        >
          <ChevronRight />
        </button>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 bg-black/40 px-3 py-2 text-sm">
        <div className="text-white/80">
          {formatPixels(image.width, image.height)} · {TYPE_LABELS[image.type]} · {formatBytes(image.byteSize)}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn('soft')} onClick={() => onCopy(image.url)}>
            <Link2 size={14} /> Copy link
          </button>
          <button type="button" className={btn('soft')} onClick={() => onFavorite(image)}>
            <Heart size={14} /> Favorite
          </button>
          <button type="button" className={btn()} onClick={() => onDownload(image)}>
            <Download size={14} /> Download
          </button>
        </div>
      </footer>
    </div>
  );
}
