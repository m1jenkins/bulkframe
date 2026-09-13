import {
  IMAGE_TYPES,
  KIND_LABELS,
  MEDIA_KINDS,
  MEDIA_QUALITIES,
  QUALITY_LABELS,
  TYPE_LABELS,
  type FilterState,
  type ImageCandidate,
  type MediaQuality,
  type Orientation,
} from '../../lib/types';
import { emptyFilters, isDefaultFilters, isKindActive, kindCounts, toggleKind, typeCounts } from '../../lib/filters';
import { btn, cx } from '../ui';
import type { ReactNode } from 'react';

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'square', label: 'Square' },
];

const EDGE_PRESETS: { label: string; min?: number }[] = [
  { label: 'Any' },
  { label: '640px+', min: 640 },
  { label: '1080px+', min: 1080 },
  { label: '1440px+', min: 1440 },
];

const SIZE_PRESETS: { label: string; minBytes?: number }[] = [
  { label: 'Any' },
  { label: '50 KB+', minBytes: 50 * 1024 },
  { label: '200 KB+', minBytes: 200 * 1024 },
  { label: '1 MB+', minBytes: 1024 * 1024 },
];

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx(
        'rounded-full border px-2.5 py-1 text-xs',
        on
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--line)] text-[var(--text)]',
      )}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function QualitySelect({
  value,
  onChange,
}: {
  value: MediaQuality;
  onChange: (quality: MediaQuality) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
      Quality
      <select
        aria-label="Media quality"
        className={cx(
          'rounded-full border px-2 py-1 text-xs',
          value !== 'any'
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--line)] bg-[var(--bg-elev)] text-[var(--text)]',
        )}
        value={value}
        title="Hides icons, thumbnails, and tiny clips using resolution and file size — not a visual analysis."
        onChange={(e) => onChange(e.target.value as MediaQuality)}
      >
        {MEDIA_QUALITIES.map((quality) => (
          <option key={quality} value={quality}>
            {QUALITY_LABELS[quality]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({
  filters,
  images,
  onChange,
}: {
  filters: FilterState;
  images: ImageCandidate[];
  onChange: (filters: FilterState) => void;
}) {
  const counts = kindCounts(images);
  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] px-2 py-1.5">
      <QualitySelect
        value={filters.quality ?? 'good'}
        onChange={(quality) => patch({ quality })}
      />
      {MEDIA_KINDS.map((kind) => (
        <Chip
          key={kind}
          on={isKindActive(filters.types, kind)}
          onClick={() => patch({ types: toggleKind(filters.types, kind) })}
        >
          {KIND_LABELS[kind]}
          {counts[kind] ? ` ${counts[kind]}` : ''}
        </Chip>
      ))}
      <Chip on={filters.hideDuplicates} onClick={() => patch({ hideDuplicates: !filters.hideDuplicates })}>
        Hide dups
      </Chip>
    </div>
  );
}

export function FilterPanel({
  filters,
  images,
  onChange,
  onSave,
}: {
  filters: FilterState;
  images: ImageCandidate[];
  onChange: (filters: FilterState) => void;
  onSave?: () => void;
}) {
  const counts = typeCounts(images);
  function patch(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }
  function num(v: string) {
    const n = Number(v);
    return v === '' || Number.isNaN(n) ? undefined : n;
  }

  const customDims = Boolean(filters.minWidth || filters.minHeight || filters.maxWidth || filters.maxHeight);
  const customSize = filters.maxBytes != null;

  return (
    <div className="bf-scroll max-h-[46%] space-y-3 overflow-auto border-b border-[var(--line)] px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-muted)]">
          Hide low drops icons, thumbs, and tiny clips. High only keeps HD-ish files.
        </p>
        {onSave && (
          <button type="button" className="shrink-0 text-xs text-[var(--accent)]" onClick={onSave}>
            Save
          </button>
        )}
      </div>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">Orientation</div>
        <div className="flex flex-wrap gap-1">
          {ORIENTATIONS.map((o) => {
            const on = filters.orientations.includes(o.id);
            return (
              <Chip
                key={o.id}
                on={on}
                onClick={() =>
                  patch({
                    orientations: on
                      ? filters.orientations.filter((x) => x !== o.id)
                      : [...filters.orientations, o.id],
                  })
                }
              >
                {o.label}
              </Chip>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">Shortest side</div>
        <div className="flex flex-wrap gap-1">
          {EDGE_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              on={
                preset.min == null
                  ? filters.minEdge == null && !customDims
                  : !customDims && filters.minEdge === preset.min
              }
              onClick={() =>
                patch({
                  minEdge: preset.min,
                  minWidth: undefined,
                  minHeight: undefined,
                  maxWidth: undefined,
                  maxHeight: undefined,
                })
              }
            >
              {preset.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">File size</div>
        <div className="flex flex-wrap gap-1">
          {SIZE_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              on={
                preset.minBytes == null
                  ? filters.minBytes == null && !customSize
                  : !customSize && filters.minBytes === preset.minBytes
              }
              onClick={() => patch({ minBytes: preset.minBytes, maxBytes: undefined })}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
          File types
          {filters.types.length > 0 && (
            <button type="button" className="text-[var(--accent)]" onClick={() => patch({ types: [] })}>
              Show all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {IMAGE_TYPES.map((type) => (
            <Chip
              key={type}
              on={filters.types.includes(type)}
              onClick={() => {
                if (!filters.types.length) {
                  patch({ types: [type] });
                  return;
                }
                const set = new Set(filters.types);
                if (set.has(type)) set.delete(type);
                else set.add(type);
                const next = IMAGE_TYPES.filter((t) => set.has(t));
                patch({ types: !next.length || next.length === IMAGE_TYPES.length ? [] : next });
              }}
            >
              {TYPE_LABELS[type]} {counts[type]}
            </Chip>
          ))}
        </div>
      </section>

      <details className="text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer font-medium">Custom min / max</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Min width"
            type="number"
            value={filters.minWidth ?? ''}
            onChange={(e) => patch({ minWidth: num(e.target.value), minEdge: undefined })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Min height"
            type="number"
            value={filters.minHeight ?? ''}
            onChange={(e) => patch({ minHeight: num(e.target.value), minEdge: undefined })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Max width"
            type="number"
            value={filters.maxWidth ?? ''}
            onChange={(e) => patch({ maxWidth: num(e.target.value), minEdge: undefined })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Max height"
            type="number"
            value={filters.maxHeight ?? ''}
            onChange={(e) => patch({ maxHeight: num(e.target.value), minEdge: undefined })}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Min KB"
            type="number"
            value={filters.minBytes != null ? Math.round(filters.minBytes / 1024) : ''}
            onChange={(e) => {
              const v = num(e.target.value);
              patch({ minBytes: v == null ? undefined : v * 1024 });
            }}
          />
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-2 py-1.5 text-[var(--text)]"
            placeholder="Max KB"
            type="number"
            value={filters.maxBytes != null ? Math.round(filters.maxBytes / 1024) : ''}
            onChange={(e) => {
              const v = num(e.target.value);
              patch({ maxBytes: v == null ? undefined : v * 1024 });
            }}
          />
        </div>
      </details>

      <button
        type="button"
        className={btn('ghost')}
        disabled={isDefaultFilters(filters)}
        onClick={() => onChange(emptyFilters())}
      >
        Reset filters
      </button>
    </div>
  );
}
