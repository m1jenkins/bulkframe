import { ChevronUp, Copy, Download, FileArchive } from 'lucide-react';
import { useState } from 'react';
import { btn, cx } from '../ui';

export function FooterBar({
  count,
  onDownload,
  onZip,
  onCopyLinks,
  onCopyNames,
  onCsv,
}: {
  count: number;
  onDownload: () => void;
  onZip: () => void;
  onCopyLinks: () => void;
  onCopyNames: () => void;
  onCsv?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <footer className="relative flex items-center gap-2 border-t border-[var(--line)] bg-[var(--bg-elev)] p-2">
      <button type="button" className={cx(btn(), 'flex-1')} disabled={!count} onClick={onDownload}>
        <Download size={16} /> Download Selected ({count})
      </button>
      <button
        type="button"
        className={btn('soft')}
        onClick={() => setOpen((v) => !v)}
        aria-label="More download actions"
      >
        <ChevronUp size={16} />
      </button>
      {open && (
        <div className="absolute bottom-12 right-2 z-20 min-w-48 overflow-hidden rounded-xl bg-[var(--bg-elev)] shadow-[var(--shadow)]">
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--line)]" onClick={onCopyNames}>
            <Copy size={14} /> Copy filenames
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--line)]" onClick={onCopyLinks}>
            <Copy size={14} /> Copy links
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--line)]" onClick={onZip}>
            <FileArchive size={14} /> Download selected as ZIP
          </button>
          {onCsv && (
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--line)]" onClick={onCsv}>
              Export CSV
            </button>
          )}
        </div>
      )}
    </footer>
  );
}
